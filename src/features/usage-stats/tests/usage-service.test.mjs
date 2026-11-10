import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UsageService } from '../usage-service.ts';

const at = (date) => Date.parse(`${date}T12:00:00.000Z`);

function assistant(time, usage, model = 'group/flash') {
  return { type: 'assistant/message', time, data: { turn: 1, step: 1, usage, message: { source: { kind: 'model', provider: 'magpie', model } } } };
}

function entry(id, createdAt, events, revision = `${id}:1`) {
  return { id, createdAt, revision, events };
}

function persistence(sessions) {
  const state = { listed: 0, opened: [], closed: 0, reads: 0 };
  const byId = new Map(sessions.map(session => [session.id, session]));
  return {
    state,
    set(id, session) { byId.set(id, session); },
    async list() {
      state.listed++;
      return [...byId.values()].map(session => ({
        header: { id: session.id, createdAt: session.createdAt },
        revision: session.revision,
        location: { kind: 'jsonl', path: `/logs/${session.id}` },
      }));
    },
    async open(id) {
      const session = byId.get(id);
      if (!session) throw new Error('missing');
      state.opened.push(id);
      return {
        async read() { state.reads++; return { eventState: 'detached', events: session.events }; },
        async close() { state.closed++; },
      };
    },
  };
}

test('snapshot folds every readable session and reports a complete history', async () => {
  const store = persistence([
    entry('a', at('2026-03-01'), [assistant(at('2026-03-01'), { inputTokens: 90, outputTokens: 10, totalTokens: 100 })]),
    entry('b', at('2026-03-02'), [assistant(at('2026-03-02'), { inputTokens: 50, outputTokens: 50, totalTokens: 100 }, 'group/sol')]),
  ]);
  const service = new UsageService();
  service.persistence = store;
  const snapshot = await service.snapshot('UTC');
  assert.equal(snapshot.complete, true);
  assert.equal(snapshot.timeZone, 'UTC');
  assert.equal(snapshot.summary.totalTokens, 200);
  assert.deepEqual(snapshot.models.map(row => row.modelId).sort(), ['group/flash', 'group/sol']);
  assert.equal(store.state.listed, 1);
  assert.equal(store.state.reads, 2);
  assert.equal(store.state.closed, 2, 'Every read handle is released.');
});

test('snapshot reuses cached folds until the revision changes', async () => {
  const store = persistence([
    entry('a', at('2026-03-01'), [assistant(at('2026-03-01'), { inputTokens: 1, outputTokens: 1, totalTokens: 2 })]),
  ]);
  const service = new UsageService();
  service.persistence = store;
  await service.snapshot('UTC');
  await service.snapshot('UTC');
  assert.equal(store.state.reads, 1, 'An unchanged revision is not re-read.');
  store.set('a', entry('a', at('2026-03-01'), [assistant(at('2026-03-01'), { inputTokens: 2, outputTokens: 2, totalTokens: 4 })], 'a:2'));
  const next = await service.snapshot('UTC');
  assert.equal(store.state.reads, 2, 'A new revision is re-read.');
  assert.equal(next.summary.totalTokens, 4);
  const otherZone = await service.snapshot('Asia/Shanghai');
  assert.equal(store.state.reads, 3, 'A different reporting zone refolds.');
  assert.equal(otherZone.timeZone, 'Asia/Shanghai');
});

test('snapshot keeps reading after a broken session and marks the history incomplete', async () => {
  const store = persistence([
    entry('a', at('2026-03-01'), [assistant(at('2026-03-01'), { inputTokens: 1, outputTokens: 1, totalTokens: 2 })]),
    entry('bad', at('2026-03-02'), []),
  ]);
  const original = store.open;
  store.open = async (id, access, options) => {
    if (id === 'bad') throw new Error('corrupt log');
    return original(id, access, options);
  };
  const service = new UsageService();
  service.persistence = store;
  const snapshot = await service.snapshot('UTC');
  assert.equal(snapshot.complete, false);
  assert.equal(snapshot.summary.totalTokens, 2, 'The healthy session still contributes.');
  assert.equal(snapshot.summary.sessionCount, 1);
});

test('snapshot rejects without session persistence and normalizes an unknown zone', async () => {
  const service = new UsageService();
  await assert.rejects(service.snapshot('UTC'), /usageUnavailable/);
  const store = persistence([
    entry('a', at('2026-03-01'), [assistant(Date.parse('2026-03-01T23:30:00.000Z'), { inputTokens: 1, outputTokens: 1, totalTokens: 2 })]),
  ]);
  service.persistence = store;
  const snapshot = await service.snapshot('Not/AZone');
  assert.equal(snapshot.timeZone, 'UTC', 'An unknown zone falls back to UTC instead of failing the page.');
  assert.equal(snapshot.days[0].date, '2026-03-01');
});

test('snapshot drops cached sessions that disappeared from storage', async () => {
  const store = persistence([
    entry('a', at('2026-03-01'), [assistant(at('2026-03-01'), { inputTokens: 1, outputTokens: 1, totalTokens: 2 })]),
    entry('b', at('2026-03-02'), [assistant(at('2026-03-02'), { inputTokens: 1, outputTokens: 1, totalTokens: 2 })]),
  ]);
  const service = new UsageService();
  service.persistence = store;
  await service.snapshot('UTC');
  assert.equal(service.cache.size, 2);
  const remaining = store.list.bind(store);
  store.list = async () => (await remaining()).filter(row => row.header.id !== 'b');
  await service.snapshot('UTC');
  assert.deepEqual([...service.cache.keys()], ['a']);
});
