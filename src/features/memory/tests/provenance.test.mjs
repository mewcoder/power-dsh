import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { MemoryStore, parseMemoryFile } from '../memory-store.ts';
import { MemorySources } from '../sources.ts';
import { createMemoryTool } from '../memory-tool.ts';
import { parseMemorySource } from '../provenance.ts';
import { READ_MEMORY_ENTRY_RPC, READ_MEMORY_SOURCE_RPC } from '../rpc.ts';
import { parseCleanupPlan } from '../cleanup-plan.ts';
import { randomUUID } from 'node:crypto';

const digest = text => createHash('sha256').update(text).digest('hex');
const user = (seq, text) => ({ seq, time: 1794800000000 + seq, type: 'user/message',
  data: { source: { kind: 'user' }, content: [{ type: 'text', text }] } });
const assistant = (seq, text) => ({ seq, time: 1794800000000 + seq, type: 'assistant/message',
  data: { message: { content: [{ type: 'text', text }, { type: 'reasoning', text: 'private reasoning' },
    { type: 'tool-call', name: 'secret', arguments: 'private arguments' }] } } });
const point = (sessionId, event) => ({ sessionId, seq: event.seq, time: event.time, hash: digest(event.data.content[0].text) });
const input = (patch = {}) => ({ type: 'feedback', name: 'editor-height', description: '编辑器高度',
  content: '保持当前编辑器高度。', revision: '', originSessionId: 'chat-a', ...patch });

async function fixture(t) {
  const home = await mkdtemp(join(tmpdir(), 'power-dsh-provenance-'));
  const store = new MemoryStore(home);
  const sources = new MemorySources();
  const sessions = new Map([
    ['chat-a', { session: { id: 'chat-a', cwd: '/project' }, events: [user(1, '这个高度不用调'), assistant(3, '好的，保持高度')] }],
    ['chat-b', { session: { id: 'chat-b', cwd: '/project' }, events: [user(1, '只针对设置页编辑器，其他高度按需要调整')] }],
  ]);
  const service = { async readSurface(id) {
    const value = sessions.get(id);
    if (!value) throw Object.assign(new Error('private missing path'), { code: 'SESSION_QUERY_SESSION_NOT_FOUND' });
    return structuredClone(value);
  } };
  sources.bind(service);
  const values = { memoryEnabled: true, memoryGlobalEnabled: true, memoryWorkspaceEnabled: true };
  const config = Object.fromEntries(Object.entries(values).map(([key]) => [key, { get: () => values[key] }]));
  const tool = createMemoryTool(store, config, () => true, sources);
  const exec = (id = 'chat-a', cwd = '/project') => ({ signal: new AbortController().signal,
    agent: { session: { header: { id, cwd } } } });
  t.after(async () => { sources.close(); store.close(); await rm(home, { recursive: true, force: true }); });
  return { home, store, sources, sessions, service, tool, exec, values };
}

test('new saves capture verified user messages and corrections replace current content and source after restart', async t => {
  const app = await fixture(t);
  const saved = await app.tool.execute({ action: 'save', scope: 'global', ...input(), sourceQuote: '这个高度不用调' }, app.exec());
  assert.equal(saved.ok, true);
  assert.equal(saved.data.sourceRecorded, true);
  let detail = await app.store.read('global', saved.data.entry.id);
  assert.deepEqual(detail.source, point('chat-a', user(1, '这个高度不用调')));
  assert.equal(detail.history, undefined);
  const updated = await app.tool.execute({ action: 'save', scope: 'global', ...input({
    revision: detail.revision, content: '只保持设置页编辑器高度，其他位置可调整。',
  }), sourceQuote: '只针对设置页编辑器' }, app.exec('chat-b'));
  assert.equal(updated.ok, true);
  assert.equal(updated.data.entry.originSessionId, 'chat-a');
  const restarted = new MemoryStore(app.home);
  t.after(() => restarted.close());
  detail = await restarted.read('global', saved.data.entry.id);
  assert.equal(detail.source.sessionId, 'chat-b');
  assert.equal(detail.history, undefined);
  assert.equal(detail.content, '只保持设置页编辑器高度，其他位置可调整。');
  const stored = await readFile(join(app.home, 'power-dsh/memory/editor-height.md'), 'utf8');
  assert.match(stored, /schemaVersion: 2/);
  assert.doesNotMatch(stored, /^history: /m);
  const listed = await app.store.list('global');
  assert.equal(listed.entries[0].source, undefined);
  assert.equal(listed.entries[0].history, undefined);
  const read = await app.tool.execute({ action: 'read', scope: 'global', id: detail.id }, app.exec('chat-b'));
  assert.equal(read.data.history, undefined);
  const result = await app.tool.execute({ action: 'source', scope: 'global', id: detail.id, revision: detail.revision }, app.exec('chat-b'));
  assert.equal(result.ok, true);
  assert.equal(result.data.available, true);
  assert.equal(result.data.source.sessionId, 'chat-b');
  assert.doesNotMatch(JSON.stringify(result), /private reasoning|private arguments/);
});

test('quoted assistant claims or tool data cannot become verified user evidence and failed saves keep the file', async t => {
  const app = await fixture(t);
  const saved = await app.store.save('global', input());
  const original = await readFile(join(app.home, 'power-dsh/memory/editor-height.md'), 'utf8');
  for (const sourceQuote of ['好的，保持高度', 'private reasoning', '不存在的用户原话']) {
    const result = await app.tool.execute({ action: 'save', scope: 'global', ...input({ revision: saved.entry.revision }), sourceQuote }, app.exec());
    assert.deepEqual(result, { ok: false, error: 'memorySourceNotFound', data: null });
    assert.equal(await readFile(join(app.home, 'power-dsh/memory/editor-height.md'), 'utf8'), original);
  }
});

test('only human source messages supply evidence or neighbors, excluding injected and unknown producers', async t => {
  const app = await fixture(t);
  const human = user(1, '这个高度不用调');
  const injections = ['runtime-context', 'time-context', 'agent-instructions', 'compact-checkpoint', 'unknown', null]
    .map((kind, index) => ({ ...user(index + 2, '注入的提示不代表用户原话'),
      data: { content: [{ type: 'text', text: '注入的提示不代表用户原话' }], ...(kind ? { source: { kind } } : {}) } }));
  app.sessions.get('chat-a').events = [human, ...injections, assistant(9, '保留用户要求')];
  const source = await app.sources.capture({ id: 'chat-a', cwd: '/project' }, undefined, app.exec().signal, () => {});
  assert.deepEqual(source, point('chat-a', human));
  await assert.rejects(app.sources.capture({ id: 'chat-a', cwd: '/project' }, '注入的提示',
    app.exec().signal, () => {}), /memorySourceNotFound/);
  const result = await app.sources.read(source, 0, app.exec().signal, () => {});
  assert.deepEqual(result.messages.map(row => row.seq), [1, 9]);
  assert.doesNotMatch(JSON.stringify(result), /注入的提示/);
  app.sessions.get('chat-a').events = injections;
  assert.equal(await app.sources.capture({ id: 'chat-a', cwd: '/project' }, undefined, app.exec().signal, () => {}), null);
});

test('exact duplicate reuse leaves source and timestamp unchanged', async t => {
  const app = await fixture(t);
  const args = { action: 'save', scope: 'global', ...input() };
  const saved = await app.tool.execute(args, app.exec());
  const before = await app.store.read('global', saved.data.entry.id);
  const duplicate = await app.tool.execute({ ...args, name: 'same-topic' }, app.exec('chat-b'));
  assert.equal(duplicate.data.reused, true);
  assert.deepEqual(await app.store.read('global', before.id), before);
});

test('legacy version one remains readable without invented message references and upgrades only on change', async t => {
  const app = await fixture(t);
  await app.store.save('global', input());
  const path = join(app.home, 'power-dsh/memory/editor-height.md');
  const legacy = (await readFile(path, 'utf8')).replace('schemaVersion: 2', 'schemaVersion: 1')
    .split('\n').filter(line => !line.startsWith('source: ') && !line.startsWith('history: ')).join('\n');
  await writeFile(path, legacy);
  const read = await app.store.read('global', 'feedback/editor-height');
  assert.equal(read.source, null);
  assert.equal(read.history, undefined);
  assert.equal(await readFile(path, 'utf8'), legacy);
  const unavailable = await app.tool.execute({ action: 'source', scope: 'global', id: read.id, revision: read.revision }, app.exec());
  assert.equal(unavailable.data.reason, 'not-recorded');
  await app.store.save('global', input({ revision: read.revision, content: '只适用于设置页。' }));
  const updated = await app.store.read('global', read.id);
  assert.equal(updated.history, undefined);
  assert.equal(updated.source, null);
  assert.equal(updated.content, '只适用于设置页。');
});

test('missing source services allow honest unverified saves and reject explicit quotes requiring verification', async t => {
  const app = await fixture(t);
  app.sources.close();
  const saved = await app.tool.execute({ action: 'save', scope: 'global', ...input() }, app.exec());
  assert.equal(saved.ok, true);
  assert.equal(saved.data.sourceRecorded, false);
  const result = await app.tool.execute({ action: 'save', scope: 'global', ...input({ name: 'another' }), sourceQuote: '这个高度不用调' }, app.exec());
  assert.equal(result.error, 'memorySourceUnavailable');
});

test('source reads distinguish absent, deleted, compacted, changed and cross-project evidence', async t => {
  const app = await fixture(t);
  const source = await app.sources.capture({ id: 'chat-a', cwd: '/project' }, undefined, app.exec().signal, () => {});
  const read = caller => app.sources.read(source, 0, app.exec().signal, () => {}, caller);
  assert.equal((await read({ id: 'chat-b', cwd: '/other' })).reason, 'workspace');
  app.sessions.get('chat-a').events = [user(1, '已修改原文')];
  assert.equal((await read()).reason, 'changed');
  app.sessions.get('chat-a').events = [user(9, '压缩后的新内容')];
  assert.equal((await read()).reason, 'not-found');
  app.sessions.delete('chat-a');
  assert.equal((await read()).reason, 'not-found');
  app.sources.close();
  assert.equal((await read()).reason, 'unavailable');
});

test('compacted sources remain verifiable in raw history and are explicitly historical with project and hash checks', async t => {
  const app = await fixture(t);
  const source = await app.sources.capture({ id: 'chat-a', cwd: '/project' }, undefined, app.exec().signal, () => {});
  const original = structuredClone(app.sessions.get('chat-a'));
  app.sessions.get('chat-a').events = [user(9, '压缩摘要')];
  app.service.readSession = async () => structuredClone(original);
  const result = await app.sources.read(source, 0, app.exec().signal, () => {}, { id: 'chat-b', cwd: '/project' });
  assert.equal(result.available, true);
  assert.equal(result.historical, true);
  assert.equal(result.messages.find(row => row.target).text, '这个高度不用调');
  assert.equal(READ_MEMORY_SOURCE_RPC.result.create().parse(result).historical, true);
  original.session.cwd = '/other';
  assert.equal((await app.sources.read(source, 0, app.exec().signal, () => {}, { id: 'chat-b', cwd: '/project' })).reason, 'workspace');
  original.session.cwd = '/project';
  original.events = [user(1, '原文被修改')];
  assert.equal((await app.sources.read(source, 0, app.exec().signal, () => {})).reason, 'changed');
});

test('source reads require matching memory revision and cannot bypass disabled scope through a global source', async t => {
  const app = await fixture(t);
  const saved = await app.tool.execute({ action: 'save', scope: 'global', ...input() }, app.exec());
  const args = { action: 'source', scope: 'global', id: saved.data.entry.id, revision: saved.data.entry.revision };
  assert.equal((await app.tool.execute({ ...args, revision: 'a'.repeat(64) }, app.exec())).error, 'memoryConflict');
  assert.equal((await app.tool.execute(args, app.exec('chat-b', '/other'))).data.reason, 'workspace');
  app.values.memoryGlobalEnabled = false;
  assert.equal((await app.tool.execute(args, app.exec())).error, 'memoryDisabled');
});

test('source pagination preserves complete Unicode text and bounded user/assistant neighbors', async t => {
  const app = await fixture(t);
  const text = `${'文'.repeat(7999)}😀${'字'.repeat(9000)}`;
  app.sessions.get('chat-a').events = [assistant(0, '前'.repeat(2000)), user(1, text), assistant(2, '后'.repeat(2000))];
  const source = await app.sources.capture({ id: 'chat-a', cwd: '/project' }, undefined, app.exec().signal, () => {});
  let offset = 0;
  let assembled = '';
  do {
    const result = await app.sources.read(source, offset, app.exec().signal, () => {});
    const projected = READ_MEMORY_SOURCE_RPC.result.create().parse(result);
    const target = projected.messages.find(row => row.target);
    assert.equal(target.offset, offset);
    assembled += target.text;
    offset = target.nextOffset;
    assert.equal(projected.messages[0].text.length, 1000);
  } while (offset !== null);
  assert.equal(assembled, text);
});

test('cancellation and replacement stop uncooperative reads and reject late source identities', async t => {
  const app = await fixture(t);
  for (const transition of ['cancel', 'replace', 'close']) {
    let entered;
    let finish;
    const ready = new Promise(resolve => { entered = resolve; });
    app.sources.bind({ readSurface() { entered(); return new Promise(resolve => { finish = resolve; }); } });
    const pending = app.sources.capture({ id: 'chat-a', cwd: '/project' }, undefined, app.exec().signal, () => {});
    await ready;
    if (transition === 'cancel') app.sources.cancel();
    if (transition === 'replace') app.sources.bind(app.service);
    if (transition === 'close') app.sources.close();
    await assert.rejects(pending, /memorySourceUnavailable/);
    finish(app.sessions.get('chat-a'));
  }
  app.sources.bind({ async readSurface() { return { session: { id: 'wrong', cwd: '/project' }, events: [user(1, 'x')] }; } });
  await assert.rejects(app.sources.capture({ id: 'chat-a', cwd: '/project' }, undefined, app.exec().signal, () => {}), /memorySourceUnavailable/);
});

test('repeated corrections do not accumulate old versions or introduce a revision capacity limit', async t => {
  const app = await fixture(t);
  let saved = await app.store.save('global', input());
  for (let index = 0; index < 70; index++) {
    saved = await app.store.save('global', input({ revision: saved.entry.revision, content: `第 ${index} 次修订。` }));
  }
  const path = join(app.home, 'power-dsh/memory/editor-height.md');
  assert.doesNotMatch(await readFile(path, 'utf8'), /^history: /m);
  const current = await app.store.read('global', saved.entry.id);
  assert.equal(current.history, undefined);
  assert.equal(current.content, '第 69 次修订。');
});

test('existing experimental history stays unchanged on disk and is excluded from reads and wire results', async t => {
  const app = await fixture(t);
  await app.store.save('global', input());
  const path = join(app.home, 'power-dsh/memory/editor-height.md');
  const original = await readFile(path, 'utf8');
  const legacyHistory = `history: ${JSON.stringify([{ content: '旧实验正文', source: point('chat-a', user(1, '这个高度不用调')) }])}`;
  await writeFile(path, original.replace('source: null', `source: null\n${legacyHistory}`));
  const previous = await app.store.read('global', 'feedback/editor-height');
  assert.equal(previous.history, undefined);
  const read = await app.tool.execute({ action: 'read', scope: 'global', id: previous.id }, app.exec());
  assert.doesNotMatch(JSON.stringify(read), /旧实验正文/);
  await app.store.save('global', input({ revision: previous.revision, content: '仅更新当前正文。' }));
  assert.equal((await readFile(path, 'utf8')).split('\n').find(line => line.startsWith('history: ')), legacyHistory);
  const projected = READ_MEMORY_ENTRY_RPC.result.create().parse({ ...previous, path, history: [{ content: '旧实验正文' }] });
  assert.equal(projected.history, undefined);
});

test('organization clears a merged source and retains originals in existing backups without creating revision history', async t => {
  const app = await fixture(t);
  const first = await app.store.save('global', input({ source: point('chat-a', user(1, '这个高度不用调')) }));
  await app.store.save('global', input({ name: 'editor-scope', content: '仅针对设置页编辑器。', originSessionId: 'chat-b',
    source: point('chat-b', user(1, '只针对设置页编辑器，其他高度按需要调整')) }));
  await app.store.save('global', input({ revision: first.entry.revision, content: '保持原高度与拖拽调节。', source: null }));
  const snapshot = await app.store.cleanupSnapshot('global');
  const changes = parseCleanupPlan(JSON.stringify({ changes: [{ id: 'feedback/editor-height', description: '设置页编辑器高度',
    content: '仅设置页编辑器保持原高度与拖拽调节。', remove: ['feedback/editor-scope'], reason: '合并同主题' }] }), snapshot.details);
  changes[0].before.source = { ...point('invented', user(1, 'fake')) };
  const result = await app.store.applyCleanup({ token: randomUUID(), scope: 'global', revision: snapshot.scope.revision, changes });
  const current = await app.store.read('global', 'feedback/editor-height');
  assert.equal(current.source, null);
  assert.equal(current.history, undefined);
  assert.doesNotMatch(JSON.stringify(current), /invented/);
  assert.doesNotMatch(await readFile(join(app.home, 'power-dsh/memory/editor-height.md'), 'utf8'), /^history: /m);
  assert.match(await readFile(join(result.backup, 'editor-height.md'), 'utf8'), /保持原高度与拖拽调节/);
  assert.match(await readFile(join(result.backup, 'editor-scope.md'), 'utf8'), /chat-b/);
});

test('strict disk and wire parsing reject forged source metadata', async t => {
  const app = await fixture(t);
  await app.store.save('global', input());
  const text = await readFile(join(app.home, 'power-dsh/memory/editor-height.md'), 'utf8');
  assert.throws(() => parseMemoryFile(text.replace('schemaVersion: 2', 'schemaVersion: "2"'), 'editor-height'), /memoryInvalid/);
  const source = point('chat-a', user(1, 'text'));
  for (const value of [{ ...source, seq: -1 }, { ...source, hash: 'fake' }, { ...source, secret: 'no' }]) {
    assert.throws(() => parseMemorySource(value), /memoryInvalid/);
  }
  const detail = await app.store.read('global', 'feedback/editor-height');
  const wire = READ_MEMORY_ENTRY_RPC.result.create().parse({ ...detail, path: '/test/memory', extra: 'private' });
  assert.equal(wire.extra, undefined);
  const project = join(app.home, 'project');
  await mkdir(project);
  const workspace = await app.store.workspace(project);
  assert.equal((await app.store.list(workspace.id)).entries.length, 0);
});
