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
  const state = { listed: 0, opened: [], closed: 0, reads: 0, readOffsets: [] };
  const byId = new Map(sessions.map(session => [session.id, session]));
  return {
    state,
    set(id, session) { byId.set(id, session); },
    async list() {
      state.listed++;
      return [...byId.values()].map(session => ({
        header: { id: session.id, createdAt: session.createdAt, ...session.header },
        revision: session.revision,
        location: { kind: 'jsonl', path: `/logs/${session.id}` },
      }));
    },
    async open(id) {
      const session = byId.get(id);
      if (!session) throw new Error('missing');
      state.opened.push(id);
      return {
        inheritedEventCount: session.inheritedEventCount ?? 0,
        async read(offset = 0, length = Number.MAX_SAFE_INTEGER) {
          state.reads++;
          state.readOffsets.push([id, offset]);
          return { eventState: 'detached', events: session.events.slice(offset, offset + length) };
        },
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

test('fork history is read once and nested subagent activity counts as one family', async () => {
  const first = at('2026-03-01'), second = at('2026-03-02'), third = at('2026-03-03');
  const parentEvents = [
    { type: 'step/start', time: first },
    assistant(first + 30_000, { inputTokens: 100, outputTokens: 10, totalTokens: 110 }),
    { type: 'step/end', time: first + 60_000 },
  ];
  const childEvents = [...parentEvents,
    { type: 'session/end-seed', time: second, data: { inherited: true } },
    { type: 'step/start', time: second },
    assistant(second + 60_000, { inputTokens: 10, cacheReadTokens: 90, outputTokens: 20, totalTokens: 120 }),
    { type: 'step/end', time: second + 120_000 },
  ];
  const grandEvents = [...childEvents,
    { type: 'session/end-seed', time: second + 180_000, data: { inherited: true } },
    assistant(second + 181_000, { inputTokens: 0, cacheReadTokens: 50, outputTokens: 5, totalTokens: 55 }),
  ];
  const forkEvents = [...parentEvents,
    { type: 'session/end-seed', time: third, data: { inherited: true } },
    assistant(third, { inputTokens: 20, outputTokens: 10, totalTokens: 30 }),
  ];
  const store = persistence([
    entry('parent', first, parentEvents),
    { ...entry('child', second, childEvents), inheritedEventCount: parentEvents.length,
      header: { origin: 'subagent', parentSession: 'parent' } },
    { ...entry('grandchild', second + 180_000, grandEvents), inheritedEventCount: childEvents.length,
      header: { origin: 'subagent', parentSession: 'child' } },
    { ...entry('fork', third, forkEvents), inheritedEventCount: parentEvents.length,
      header: { parentSession: 'parent' } },
  ]);
  const service = new UsageService(); service.persistence = store;
  const report = await service.snapshot('UTC');
  assert.equal(report.summary.totalTokens, 315, 'Copied ancestor token usage is never charged again.');
  assert.equal(report.summary.cacheReadTokens, 140);
  assert.equal(report.days.reduce((sum, day) => sum + day.requestCount, 0), 4);
  assert.equal(report.days.reduce((sum, day) => sum + day.activeMs, 0), 180_000);
  assert.equal(report.summary.sessionCount, 2, 'Ordinary forks remain independent; subagents join their parent.');
  assert.deepEqual(report.sessionDays, [['2026-03-01', '2026-03-02'], ['2026-03-03']]);
  assert.deepEqual(store.state.readOffsets.sort(([a], [b]) => a.localeCompare(b)),
    [['child', parentEvents.length], ['fork', parentEvents.length], ['grandchild', childEvents.length], ['parent', 0]]);
});
