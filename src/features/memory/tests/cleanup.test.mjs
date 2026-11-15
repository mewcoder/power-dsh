import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { MemoryStore } from '../memory-store.ts';
import { MemoryCleanup } from '../cleanup.ts';
import { CLEANUP_PROMPT, parseCleanupPlan } from '../cleanup-plan.ts';
import { PREPARE_MEMORY_CLEANUP_RPC } from '../rpc.ts';

const selection = { provider: 'configured', model: 'chat-model', reasoningEffort: 'low' };
const catalog = { default: selection, groups: [{ id: 'configured', name: 'Configured', models: [{ id: 'chat-model', name: 'Chat model' }] }] };
const input = (name, content) => ({ name, content, type: 'user', description: name, revision: '', originSessionId: 'source' });
const plan = { changes: [{ id: 'user/short', description: '回答简短', content: '回答简短，使用中文。', remove: ['user/concise'], reason: '相同偏好，保留中文要求' }] };

async function fixture(t) {
  const home = await mkdtemp(join(tmpdir(), 'power-dsh-cleanup-'));
  const store = new MemoryStore(home);
  await store.save('global', input('short', '回答简短。'));
  await store.save('global', input('concise', '回答简洁，使用中文。'));
  let output = JSON.stringify(plan);
  let finish = 'stop';
  const calls = [];
  const service = { catalog: async () => catalog, llm: { async *stream(options) {
    calls.push(options);
    yield { type: 'text-delta', text: output.slice(0, 10) };
    yield { type: 'text-delta', text: output.slice(10) };
    yield { type: 'finish', reason: { kind: finish } };
  } } };
  const cleanup = new MemoryCleanup(store, () => {}, () => service);
  t.after(async () => { cleanup.cancelAll(); store.close(); await rm(home, { recursive: true, force: true }); });
  return { home, store, directory: await store.folder('global'), cleanup, service, calls, output: value => { output = value; }, finish: value => { finish = value; },
    prepare: () => cleanup.prepare('global', JSON.stringify(selection), randomUUID()) };
}

test('preview has no writes; applying uses the selected model, backs up originals and consumes the plan', async t => {
  const app = await fixture(t);
  const before = await readFile(join(app.store.path, 'short.md'), 'utf8');
  const preview = await app.prepare();
  assert.equal(await readFile(join(app.store.path, 'short.md'), 'utf8'), before);
  assert.equal((await app.store.list('global')).entries.length, 2);
  assert.deepEqual(app.calls[0].messages[0].role, 'user');
  assert.equal(app.calls[0].reasoningEffort, 'low');
  assert.equal(app.calls[0].tools, undefined);
  assert.equal(app.calls[0].system, CLEANUP_PROMPT);
  assert.deepEqual(PREPARE_MEMORY_CLEANUP_RPC.result.create().parse(preview), preview);
  const result = await app.cleanup.apply(preview.token);
  assert.equal(result.indexUpdated, true);
  assert.equal(await readFile(join(result.backup, 'short.md'), 'utf8'), before);
  assert.equal((await app.store.list('global')).entries.length, 1);
  assert.equal((await app.store.read('global', 'user/short')).content, plan.changes[0].content);
  assert.equal((await app.store.read('global', 'user/short')).originSessionId, 'source');
  assert.doesNotMatch((await readdir(app.store.path)).join(','), /cleanup-journal/);
  await assert.rejects(app.cleanup.apply(preview.token), /memoryPreviewExpired/);
});

test('changes elsewhere invalidate the entire preview without changing any file', async t => {
  const app = await fixture(t);
  const preview = await app.prepare();
  await app.store.save('global', input('new-fact', '保留新的独立事实。'));
  await assert.rejects(app.cleanup.apply(preview.token), /memoryConflict/);
  assert.equal((await app.store.list('global')).entries.length, 3);
  assert.equal((await app.store.read('global', 'user/short')).content, '回答简短。');
});

test('unavailable models, invalid output and truncated generations cannot create an applicable preview', async t => {
  const app = await fixture(t);
  await assert.rejects(app.cleanup.prepare('global', JSON.stringify({ ...selection, model: 'invented' }), randomUUID()), /memoryModelUnavailable/);
  assert.equal(app.calls.length, 0);
  for (const output of ['not json', '```json\n{}\n```', '{"changes":[{"id":"user/invented"}]}']) {
    app.output(output);
    await assert.rejects(app.prepare(), /memoryCleanupFailed/);
  }
  app.output(JSON.stringify(plan));
  app.finish('max-tokens');
  await assert.rejects(app.prepare(), /memoryCleanupFailed/);
  assert.equal((await app.store.list('global')).entries.length, 2);
});

test('an empty configured catalog reports model unavailability without affecting saved memory', async t => {
  const app = await fixture(t);
  app.service.catalog = async () => ({ default: selection, groups: [] });
  await assert.rejects(app.cleanup.models(), /memoryModelUnavailable/);
  assert.equal((await app.store.list('global')).entries.length, 2);
});

test('plan validation rejects unknown files, reused sources, extra commands and oversized bodies', async t => {
  const { store } = await fixture(t);
  const { details } = await store.cleanupSnapshot('global');
  for (const patch of [
    { id: 'user/nonexistent' }, { remove: ['user/short'] }, { remove: ['user/concise', 'user/concise'] },
    { content: 'x'.repeat(1201) }, { path: '/outside/file.md' }, { remove: ['project/concise'] },
  ]) assert.throws(() => parseCleanupPlan(JSON.stringify({ changes: [{ ...plan.changes[0], ...patch }] }), details));
  assert.throws(() => parseCleanupPlan(JSON.stringify({ changes: [plan.changes[0], plan.changes[0]] }), details));
  assert.match(CLEANUP_PROMPT, /Never invent facts/);
  assert.match(CLEANUP_PROMPT, /delete merely because something is old/);
});

test('cancel releases a hung model request and ignores its late result', async t => {
  const app = await fixture(t);
  let release;
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const waiting = new Promise(resolve => { release = resolve; });
  app.service.llm.stream = async function* () { entered(); await waiting; yield { type: 'text-delta', text: JSON.stringify(plan) }; };
  const id = randomUUID();
  const pending = app.cleanup.prepare('global', JSON.stringify(selection), id);
  await started;
  app.cleanup.cancel(id);
  await assert.rejects(pending, /memoryCleanupFailed/);
  release();
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(app.cleanup.apply(id), /memoryPreviewExpired/);
  assert.equal((await app.store.list('global')).entries.length, 2);
});

test('one generation at a time, expiry and service disposal prevent stale application', async t => {
  const app = await fixture(t);
  const pending = app.prepare();
  await assert.rejects(app.prepare(), /memoryBusy/);
  const preview = await pending;
  app.cleanup.preview.expires = 0;
  await assert.rejects(app.cleanup.apply(preview.token), /memoryPreviewExpired/);
  const next = await app.prepare();
  app.cleanup.cancelAll();
  await assert.rejects(app.cleanup.apply(next.token), /memoryPreviewExpired/);
});

test('an empty suggestion leaves old preferences alone and makes no backup', async t => {
  const app = await fixture(t);
  app.output('{"changes":[]}');
  const preview = await app.prepare();
  assert.equal(preview.changes.length, 0);
  await assert.rejects(app.cleanup.apply(preview.token), /memoryInvalid/);
  await assert.rejects(readdir(join(app.home, 'power-dsh/memory-backups')), { code: 'ENOENT' });
});

test('write failure rolls back a committed file and keeps recoverable backups', async t => {
  const app = await fixture(t);
  const preview = await app.prepare();
  const atomic = app.store.atomic.bind(app.store);
  let failed = false;
  app.store.atomic = async (...args) => {
    await atomic(...args);
    if (!failed && args[0] === app.directory && args[1] === 'short.md') { failed = true; throw new Error('injected I/O failure'); }
  };
  await assert.rejects(app.cleanup.apply(preview.token), /memoryWriteFailed/);
  assert.equal((await app.store.read('global', 'user/short')).content, '回答简短。');
  assert.equal((await app.store.list('global')).entries.length, 2);
  assert.equal((await readdir(join(app.home, 'power-dsh/memory-backups'))).length, 1);
});

test('an interrupted transaction is rolled back by the next store instance', async t => {
  const app = await fixture(t);
  const preview = await app.prepare();
  const atomic = app.store.atomic.bind(app.store);
  app.store.atomic = async (...args) => {
    await atomic(...args);
    if (args[0] === app.directory && args[1] === 'short.md') {
      app.store.recover = async () => { throw new Error('simulated process exit'); };
      throw new Error('simulated process exit');
    }
  };
  await assert.rejects(app.cleanup.apply(preview.token));
  const restarted = new MemoryStore(app.home);
  t.after(() => restarted.close());
  assert.equal((await restarted.read('global', 'user/short')).content, '回答简短。');
  assert.equal((await restarted.list('global')).entries.length, 2);
});

test('recovery preserves an external edit and exposes a fixed recovery error', async t => {
  const app = await fixture(t);
  const preview = await app.prepare();
  const atomic = app.store.atomic.bind(app.store);
  app.store.atomic = async (...args) => {
    await atomic(...args);
    if (args[0] === app.directory && args[1] === 'short.md') {
      await writeFile(join(app.store.path, 'short.md'), 'external edit');
      throw new Error('injected conflict');
    }
  };
  await assert.rejects(app.cleanup.apply(preview.token), /memoryRecoveryRequired/);
  const restarted = new MemoryStore(app.home);
  t.after(() => restarted.close());
  await assert.rejects(restarted.catalog(), /memoryRecoveryRequired/);
  assert.equal(await readFile(join(app.store.path, 'short.md'), 'utf8'), 'external edit');
});

test('a failed index update reports committed cleanup without replaying changes', async t => {
  const app = await fixture(t);
  const preview = await app.prepare();
  const atomic = app.store.atomic.bind(app.store);
  app.store.atomic = async (...args) => { if (args[1] === 'MEMORY.md') throw new Error('index failed'); return atomic(...args); };
  const result = await app.cleanup.apply(preview.token);
  assert.equal(result.indexUpdated, false);
  assert.equal((await app.store.list('global')).entries.length, 1);
  await assert.rejects(app.cleanup.apply(preview.token), /memoryPreviewExpired/);
});
