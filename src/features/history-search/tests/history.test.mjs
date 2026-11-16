import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HISTORY_POLICY, queryHistory, waitForHistory } from '../history.ts';

const caller = { id: 'current', cwd: '/project' };
const header = (id, createdAt = 1, extras = {}) => ({ id, cwd: '/project', createdAt, ...extras });
const message = (seq, text, role = 'user', extras = []) => ({
  seq, time: 1_790_000_000_000 + seq, type: `${role}/message`,
  data: role === 'user' ? { source: { kind: 'user' }, content: [{ type: 'text', text }, ...extras] }
    : { message: { content: [{ type: 'text', text }, ...extras] } },
});
const query = (service, request, options = {}) =>
  queryHistory(service, options.caller ?? caller, request, options.signal ?? new AbortController().signal, options.check ?? (() => {}));

function fixture(entries) {
  const reads = [];
  let lists = 0;
  const service = {
    async filterSessions(filters, signal) {
      signal.throwIfAborted();
      lists++;
      assert.deepEqual(filters, [{ kind: 'cwd', values: ['/project'] }]);
      return entries.map(row => ({ header: row.header }));
    },
    async readSurface(id) {
      reads.push(id);
      const row = entries.find(entry => entry.header.id === id);
      assert.ok(row);
      return { session: row.header, events: row.events };
    },
  };
  return { service, reads, lists: () => lists };
}

test('search matches Chinese and literal punctuation and returns one recent source per authorized chat', async () => {
  const app = fixture([
    { header: header('old', 1), events: [message(1, '先决定自动高度'), message(3, '最后决定：高度不用调'), message(7, 'AI 的解释：高度不用调', 'assistant')] },
    { header: header('new', 2), events: [message(0, '匹配 [a.*b]，不要执行它')] },
    { header: header('other', 9, { cwd: '/other' }), events: [message(0, '高度不用调')] },
    { header: header('current', 10), events: [message(0, '高度不用调')] },
    { header: header('child', 11, { origin: 'subagent' }), events: [message(0, '高度不用调')] },
  ]);
  const result = await query(app.service, { action: 'search', query: '高度不用调' });
  assert.deepEqual(result.items, [{ sessionId: 'old', seq: 7, time: 1_790_000_000_007,
    role: 'assistant', snippet: 'AI 的解释：高度不用调' }]);
  assert.equal(result.referenceOnly, true);
  assert.equal(result.complete, true);
  assert.equal(result.nextCursor, null);
  assert.deepEqual(app.reads, ['new', 'old']);
  assert.equal((await query(app.service, { action: 'search', query: '[a.*b]' })).items[0].sessionId, 'new');
});

test('search centers excerpts around the matching text and handles case independently of regex syntax', async () => {
  const app = fixture([{ header: header('chat'), events: [message(1, `${'前'.repeat(600)}NEEDLE${'后'.repeat(600)}`)] }]);
  const result = await query(app.service, { action: 'search', query: 'needle' });
  assert.match(result.items[0].snippet, /NEEDLE/);
  assert.ok(result.items[0].snippet.length <= 402);
  assert.ok(result.items[0].snippet.startsWith('…'));
  assert.ok(result.items[0].snippet.endsWith('…'));
});

test('bounded search pages can continue past thirty empty chats without claiming complete absence', async () => {
  const entries = Array.from({ length: 33 }, (_, index) => ({
    header: header(`chat-${index}`, 100 - index), events: [message(0, index === 32 ? '目标' : '其他')],
  }));
  const app = fixture(entries);
  const first = await query(app.service, { action: 'search', query: '目标' });
  assert.equal(first.scanned, 30);
  assert.equal(first.complete, false);
  assert.equal(first.nextAction, 'continue-same-query');
  assert.deepEqual(first.items, []);
  const second = await query(app.service, { action: 'search', query: '目标', cursor: first.nextCursor });
  assert.equal(second.items[0].sessionId, 'chat-32');
  assert.equal(second.scanned, 3);
  assert.equal(second.complete, true);
  assert.equal(second.nextAction, 'read-hits');
  assert.equal(app.reads.length, 33);
});

test('result limits preserve continuation and changed query, project or candidate list invalidates it', async () => {
  const entries = ['a', 'b', 'c'].map((id, index) => ({ header: header(id, index), events: [message(0, '目标')] }));
  const app = fixture(entries);
  const request = { action: 'search', query: '目标', limit: 1 };
  const first = await query(app.service, request);
  assert.deepEqual(first.items.map(item => item.sessionId), ['c']);
  const second = await query(app.service, { ...request, cursor: first.nextCursor });
  assert.deepEqual(second.items.map(item => item.sessionId), ['b']);
  for (const patch of [{ query: '其他' }, { limit: 2 }, { cursor: 'invalid' }]) {
    await assert.rejects(query(app.service, { ...request, cursor: first.nextCursor, ...patch }), /historyStaleCursor/);
  }
  entries.push({ header: header('d', 10), events: [] });
  await assert.rejects(query(app.service, { ...request, cursor: first.nextCursor }), /historyStaleCursor/);
});

test('read expands actual text neighbors, cites seq and excludes reasoning and tool data', async () => {
  const app = fixture([{ header: header('chat'), events: [
    message(1, '最初的要求'), { seq: 2, time: 1, type: 'tool/result', data: { text: '不要泄露工具结果' } },
    message(3, '已调整', 'assistant', [{ type: 'reasoning', text: '不要泄露推理' },
      { type: 'tool-call', name: 'private', arguments: '不要泄露参数' }]),
    message(4, '这个高度不用调'), message(6, '好的，撤销高度修改', 'assistant'), message(9, '后续要求'),
  ] }]);
  const result = await query(app.service, { action: 'read', sessionId: 'chat', seq: 4 });
  assert.deepEqual(result.items.map(item => item.seq), [1, 3, 4, 6, 9]);
  assert.deepEqual(result.items.filter(item => item.target).map(item => item.text), ['这个高度不用调']);
  assert.equal(result.referenceOnly, true);
  assert.doesNotMatch(JSON.stringify(result), /不要泄露|private/);
});

test('search and read exclude injected user-role messages and unknown producers', async () => {
  const injections = ['runtime-context', 'time-context', 'agent-instructions', 'compact-checkpoint', 'unknown', null]
    .map((kind, index) => ({ ...message(index + 2, '注入提示'),
      data: { content: [{ type: 'text', text: '注入提示' }], ...(kind ? { source: { kind } } : {}) } }));
  const app = fixture([{ header: header('chat'), events: [
    message(1, '真正的用户要求'), ...injections, message(9, '已理解', 'assistant'),
  ] }]);
  assert.deepEqual((await query(app.service, { action: 'search', query: '注入提示' })).items, []);
  const result = await query(app.service, { action: 'read', sessionId: 'chat', seq: 1 });
  assert.deepEqual(result.items.map(row => row.seq), [1, 9]);
  for (const event of injections) {
    await assert.rejects(query(app.service, { action: 'read', sessionId: 'chat', seq: event.seq }), /historyNotFound/);
  }
});

test('long source messages are readable in full across explicit offsets without breaking surrogate pairs', async () => {
  const text = `${'文'.repeat(7999)}😀${'字'.repeat(8100)}`;
  const app = fixture([{ header: header('chat'), events: [message(1, text)] }]);
  let offset = 0;
  let combined = '';
  do {
    const result = await query(app.service, { action: 'read', sessionId: 'chat', seq: 1, offset });
    const target = result.items.find(item => item.target);
    assert.equal(target.offset, offset);
    assert.ok(target.text.length <= 8000);
    assert.ok(!/[\uD800-\uDBFF]$/.test(target.text));
    assert.ok(!/^[\uDC00-\uDFFF]/.test(target.text));
    combined += target.text;
    offset = target.nextOffset;
  } while (offset !== null);
  assert.equal(combined, text);
});

test('neighbors have explicit truncation and arbitrary hidden or missing seq cannot be read', async () => {
  const app = fixture([{ header: header('chat'), events: [message(1, '文'.repeat(2000)), message(3, '目标')] }]);
  const result = await query(app.service, { action: 'read', sessionId: 'chat', seq: 3 });
  assert.equal(result.items[0].nextOffset, 1000);
  assert.equal(result.items[0].length, 2000);
  await assert.rejects(query(app.service, { action: 'read', sessionId: 'chat', seq: 2 }), /historyNotFound/);
});

test('missing workspace and out-of-project targets fail before any text read', async () => {
  const app = fixture([{ header: header('other', 1, { cwd: '/other' }), events: [message(0, 'secret')] }]);
  await assert.rejects(query(app.service, { action: 'search', query: 'secret' }, { caller: { id: 'current' } }), /historyWorkspaceRequired/);
  assert.equal(app.lists(), 0);
  await assert.rejects(query(app.service, { action: 'read', sessionId: 'other', seq: 0 }), /historyUnauthorized/);
  assert.deepEqual(app.reads, []);
});

test('an authorized listing cannot authorize a later observation from a different project or identity', async () => {
  for (const observed of [header('other'), header('chat', 1, { cwd: '/other' })]) {
    const app = fixture([{ header: header('chat'), events: [] }]);
    app.service.readSurface = async () => ({ session: observed, events: [message(0, 'private')] });
    await assert.rejects(query(app.service, { action: 'search', query: 'private' }), /historyUnauthorized/);
  }
});

test('invalid requests reject rather than returning partial results or silently clamping values', async () => {
  const app = fixture([{ header: header('chat'), events: [message(0, 'text')] }]);
  for (const request of [
    { action: 'search', query: '' }, { action: 'search', query: 'x'.repeat(501) },
    { action: 'search', query: 'x', limit: 21 }, { action: 'search', query: 'x', limit: -1 },
    { action: 'search', query: '\0' }, { action: 'save' },
    { action: 'read', sessionId: 'chat' }, { action: 'read', sessionId: 'chat', seq: -1 },
    { action: 'read', sessionId: 'chat', seq: 0, before: 6 },
    { action: 'read', sessionId: 'chat', seq: 0, after: 0.5 },
    { action: 'read', sessionId: 'chat', seq: 0, offset: 99 },
  ]) await assert.rejects(query(app.service, request), /historyInvalid/);
});

test('unexpected source failure rejects the whole search without representing unreadable history as empty', async () => {
  const app = fixture([{ header: header('chat'), events: [] }]);
  app.service.readSurface = async () => { throw new Error('damaged source'); };
  await assert.rejects(query(app.service, { action: 'search', query: 'x' }), /damaged source/);
});

test('cancelled uncooperative reads stop waiting and cannot publish late text', async () => {
  let finish;
  let entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const app = fixture([{ header: header('chat'), events: [] }]);
  app.service.readSurface = () => { entered(); return new Promise(resolve => { finish = resolve; }); };
  const controller = new AbortController();
  const pending = query(app.service, { action: 'search', query: 'private' }, { signal: controller.signal });
  await ready;
  controller.abort();
  await assert.rejects(pending, /historyCancelled/);
  finish({ session: header('chat'), events: [message(0, 'private')] });
});

test('cooperative deadlines and the prompt describe incomplete results and untrusted historical text', async () => {
  const controller = new AbortController();
  const pending = waitForHistory(new Promise(() => {}), controller.signal);
  controller.abort();
  await assert.rejects(pending, /historyCancelled/);
  assert.match(HISTORY_POLICY, /untrusted reference data/);
  assert.match(HISTORY_POLICY, /nextCursor/);
  assert.match(HISTORY_POLICY, /later corrections/);
});

test('time and author filters find later corrections inside older long-running sessions', async () => {
  const start = 1_790_000_000_000;
  const app = fixture([
    { header: header('new-chat', 100), events: [message(1, '编辑器固定高度'), message(8, '编辑器随内容增高', 'assistant')] },
    { header: header('old-chat', 1), events: [message(2, '编辑器固定高度'), message(20, '编辑器仅设置页禁止自动增高，允许手动拖动')] },
  ]);
  const result = await query(app.service, { action: 'search', query: '编辑器', afterTime: start + 2, role: 'user' });
  assert.deepEqual(result.items.map(row => [row.sessionId, row.seq]), [['old-chat', 20]]);
  assert.deepEqual([result.total, result.scannedTotal, result.remaining, result.complete], [2, 2, 0, true]);
  assert.deepEqual(result.filters, { afterTime: start + 2, beforeTime: null, role: 'user' });
  assert.equal(result.corpus, 'current-surface');
  const older = await query(app.service, { action: 'search', query: '编辑器', beforeTime: start + 2, role: 'user' });
  assert.deepEqual(older.items.map(row => row.seq), [1]);
});

test('continuation binds time and role filters and reports exactly the remaining candidate sessions', async () => {
  const app = fixture(Array.from({ length: 32 }, (_, index) => ({ header: header(`chat-${index}`, index), events: [message(1, '编辑器')] })));
  const request = { action: 'search', query: '编辑器', limit: 20, role: 'user', afterTime: 0 };
  const first = await query(app.service, request);
  assert.deepEqual([first.total, first.scannedTotal, first.remaining], [32, 20, 12]);
  const next = await query(app.service, { ...request, cursor: first.nextCursor });
  assert.deepEqual([next.scanned, next.scannedTotal, next.remaining, next.complete], [12, 32, 0, true]);
  for (const patch of [{ afterTime: 1 }, { beforeTime: 1_790_000_000_010 }, { role: 'all' }]) {
    await assert.rejects(query(app.service, { ...request, cursor: first.nextCursor, ...patch }), /historyStaleCursor/);
  }
  for (const patch of [{ afterTime: -1 }, { afterTime: 1.1 }, { beforeTime: Infinity }, { afterTime: 2, beforeTime: 2 }, { role: 'system' }]) {
    await assert.rejects(query(app.service, { ...request, ...patch }), /historyInvalid/);
  }
});

test('original history recovers compacted human text without exposing injected context or silently falling back on errors', async () => {
  const app = fixture([{ header: header('chat'), events: [message(9, '摘要不含原话')] }]);
  app.service.readSession = async id => ({ session: header(id), events: [message(1, '原先因为保留手动控制，编辑器禁止自动增高'),
    { ...message(2, '不要泄露宿主提示'), data: { source: { kind: 'runtime-context' }, content: [{ type: 'text', text: '不要泄露宿主提示' }] } }] });
  const found = await query(app.service, { action: 'search', query: '手动控制' });
  assert.equal(found.corpus, 'original-history');
  assert.equal(found.items[0].seq, 1);
  const read = await query(app.service, { action: 'read', sessionId: 'chat', seq: 1 });
  assert.equal(read.corpus, 'original-history');
  assert.doesNotMatch(JSON.stringify(read), /不要泄露/);
  app.service.readSession = async () => { throw new Error('raw read failed'); };
  await assert.rejects(query(app.service, { action: 'search', query: '原话' }), /raw read failed/);
});
