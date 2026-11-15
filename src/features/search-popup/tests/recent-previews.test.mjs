import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RecentPreviews } from '../recent-previews.ts';

const user = text => ({ type: 'user/message', data: { content: [{ type: 'text', text }] } });
const assistant = content => ({ type: 'assistant/message', data: { message: { content } } });
const flush = () => new Promise(resolve => setImmediate(resolve));

test('recent previews read only requested sessions, skip tools and reuse activity versions without search', async () => {
  const previews = new RecentPreviews();
  const reads = [];
  previews.service = {
    config: { openAt: 'never' },
    searchSessions() { assert.fail('Previews must not start the search index'); },
    async readSurface(id) {
      reads.push(id);
      return { events: [user(' hello \n world '),
        assistant([{ type: 'tool-call', name: 'exec', arguments: 'private tool payload' }])] };
    },
  };
  const first = await previews.read(['a', 'b'], ['1', '2']);
  assert.deepEqual(first.previews, [{ sessionId: 'a', snippet: 'hello world' }, { sessionId: 'b', snippet: 'hello world' }]);
  await previews.read(['a', 'b'], ['1', '2']);
  assert.deepEqual(reads, ['a', 'b']);
  await previews.read(['a', 'b'], ['3', '2']);
  assert.deepEqual(reads, ['a', 'b', 'a']);
  previews.invalidate('b');
  await previews.read(['a', 'b'], ['3', '2']);
  assert.deepEqual(reads, ['a', 'b', 'a', 'b']);
  assert.equal((await previews.read(['c'], ['0'])).previews.length, 1);
  await previews.read(['a'], ['3']);
  assert.deepEqual(reads, ['a', 'b', 'a', 'b', 'c', 'a'], 'Leaving a page releases its cached summaries.');
});

test('previews bound disk concurrency and merge overlapping reads of the same version', async () => {
  const previews = new RecentPreviews();
  const releases = [];
  let reads = 0;
  let running = 0;
  let maximum = 0;
  previews.service = {
    async readSurface() {
      reads++;
      running++;
      maximum = Math.max(maximum, running);
      await new Promise(resolve => releases.push(resolve));
      running--;
      return { events: [user('preview')] };
    },
  };
  const ids = Array.from({ length: 10 }, (_, index) => `s${index}`);
  const versions = ids.map(() => '0');
  const first = previews.read(ids, versions);
  const second = previews.read(ids, versions);
  await flush();
  assert.equal(reads, 2);
  while (releases.length) {
    releases.splice(0).forEach(resolve => resolve());
    await flush();
  }
  assert.equal((await first).previews.length, 10);
  assert.equal((await second).previews.length, 10);
  assert.equal(maximum, 2);
  assert.equal(reads, 10);
  await assert.rejects(previews.read([...ids, 'excess'], [...versions, '0']), /Invalid/);
});

test('live previews use current-surface nodes and release immutable observation leases', async () => {
  const previews = new RecentPreviews();
  const source = { id: 'a', seq: 4, surface: { contentGeneration: 0, nodes: [1, 2] } };
  previews.store = { get: () => source };
  let observations = 0;
  let releases = 0;
  previews.service = {
    async observeSession() {
      observations++;
      return { cursor: 3, events: [user('old'), user('visible'),
        assistant([{ type: 'tool-call', name: 'exec', arguments: 'raw' }]), user('discarded branch')],
      [Symbol.dispose]() { releases++; } };
    },
    readSurface() { assert.fail('A stable live snapshot does not need surface cloning'); },
  };
  assert.equal((await previews.read(['a'], ['0'])).previews[0].snippet, 'visible');
  await previews.read(['a'], ['0']);
  assert.equal(observations, 1);
  source.surface.contentGeneration++;
  await previews.read(['a'], ['0']);
  assert.equal(observations, 2);
  assert.equal(releases, 2);
});

test('empty and long messages stay bounded and unreadable sessions can retry', async () => {
  const previews = new RecentPreviews();
  let fail = true;
  previews.service = {
    async readSurface(id) {
      if (id === 'failure' && fail) throw new Error('unreadable');
      return { events: id === 'empty' ? [user('  ')] : [user('字'.repeat(500))] };
    },
  };
  assert.deepEqual((await previews.read(['empty'], ['0'])).previews, []);
  await assert.rejects(previews.read(['failure'], ['0']), /unreadable/);
  fail = false;
  const result = await previews.read(['failure'], ['0']);
  assert.equal(Array.from(result.previews[0].snippet).length, 240);
  assert.ok(result.previews[0].snippet.endsWith('…'));
});

test('service replacement and unload reject late preview publication', async () => {
  for (const dispose of [false, true]) {
    const previews = new RecentPreviews();
    let release;
    previews.service = { readSurface: () => new Promise(resolve => { release = resolve; }) };
    const request = previews.read(['a'], ['0']);
    await flush();
    if (dispose) previews.dispose();
    else previews.clear();
    release({ events: [user('late')] });
    assert.deepEqual((await request).previews, []);
  }
});
