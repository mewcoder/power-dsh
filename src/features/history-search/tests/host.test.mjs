import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ToolsService from '@deepseek-ai/dsh-tools';
import { createHost } from '../host.ts';
import { createHistoryTool } from '../tool.ts';

function fixture(t, { enabled = false, available = true } = {}) {
  const values = { historySearchEnabled: enabled };
  const tools = new Map();
  const sections = new Map();
  const listeners = new Map();
  const effects = [];
  const bindings = [];
  const header = { id: 'past', cwd: '/project', createdAt: 1 };
  const event = { seq: 0, time: 1, type: 'user/message',
    data: { source: { kind: 'user' }, content: [{ type: 'text', text: '原文' }] } };
  let reads = 0;
  let bind;
  const query = {
    async filterSessions() { reads++; return [{ header }]; },
    async readSurface() { reads++; return { session: header, events: [event] }; },
  };
  const prompt = { section(options) { assert.equal(sections.has(options.name), false); sections.set(options.name, options); return () => sections.delete(options.name); } };
  const ctx = {
    fiber: { entry: { options: { id: 'power-dsh' } } },
    tools: { register(tool) { assert.equal(tools.has(tool.name), false); tools.set(tool.name, tool); return () => tools.delete(tool.name); } },
    effect(effect) { const dispose = effect(); if (dispose) effects.push(dispose); },
    on(name, listener) {
      listeners.set(name, listener);
      effects.push(() => listeners.delete(name));
      return () => listeners.delete(name);
    },
    inject(deps, callback) {
      assert.deepEqual(deps, ['sessionQuery', 'systemPrompt']);
      bind = (service = query) => {
        const disposers = [];
        callback({ sessionQuery: service, systemPrompt: prompt, effect(effect) {
          const dispose = effect(); if (dispose) disposers.push(dispose);
        } });
        const dispose = () => disposers.splice(0).reverse().forEach(release => release());
        bindings.push(dispose);
        return dispose;
      };
      if (available) bind();
    },
  };
  createHost(ctx, { historySearchEnabled: { get: () => values.historySearchEnabled } }, { owner: ctx, ensureActive() {} });
  const dispose = () => {
    effects.splice(0).reverse().forEach(release => release());
    bindings.splice(0).reverse().forEach(release => release());
  };
  t.after(dispose);
  const update = enabled => { values.historySearchEnabled = enabled; listeners.get('settings/document-updated')?.('power-dsh'); };
  const exec = { signal: new AbortController().signal, agent: { session: { header: { id: 'current', cwd: '/project' } } } };
  const execute = async (args = { action: 'search', query: '原文' }, context = exec, tool = tools.get('power_dsh_history')) =>
    JSON.parse(await tool.execute(args, context));
  return { tools, sections, query, update, execute, exec, dispose, bind: service => bind(service), reads: () => reads };
}

test('the experimental toggle registers one tool only when enabled and never reads at startup', t => {
  const app = fixture(t);
  assert.equal(app.tools.size + app.sections.size, 0);
  assert.equal(app.reads(), 0);
  for (let cycle = 0; cycle < 3; cycle++) {
    app.update(true);
    app.update(true);
    assert.equal(app.tools.size, 1);
    assert.equal(app.sections.size, 1);
    assert.equal(app.sections.get('power-dsh:history-search').interpolate, false);
    app.update(false);
    assert.equal(app.tools.size + app.sections.size, 0);
  }
  assert.equal(app.reads(), 0);
});

test('the tool works with memory and search popup absent and refuses callers without a workspace', async t => {
  const app = fixture(t, { enabled: true });
  const result = await app.execute();
  assert.equal(result.ok, true);
  assert.equal(result.data.items[0].snippet, '原文');
  assert.equal((await app.execute(undefined, { signal: app.exec.signal })).error, 'historyWorkspaceRequired');
  const missing = fixture(t, { enabled: true, available: false });
  assert.equal(missing.tools.size, 0);
});

test('SDK output contains fixed errors and never exposes an unexpected native diagnostic', async t => {
  const app = fixture(t, { enabled: true });
  app.query.filterSessions = async () => { throw new Error('/private/project api_key=credential'); };
  const result = await app.execute();
  assert.deepEqual(result, { ok: false, error: 'historyFailed', data: null });
});

test('the registered tool preserves native readSession binding and reports original history', async t => {
  const app = fixture(t, { enabled: true });
  app.query.readSession = async function (id) {
    assert.equal(this, app.query);
    return { session: { id, cwd: '/project', createdAt: 1 }, events: [{ seq: 3, time: 10, type: 'user/message',
      data: { source: { kind: 'user' }, content: [{ type: 'text', text: '压缩前原话' }] } }] };
  };
  app.query.readSurface = async () => { throw new Error('Should use original history'); };
  const result = await app.execute({ action: 'search', query: '压缩前', role: 'user', afterTime: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.data.corpus, 'original-history');
  assert.equal(result.data.items[0].seq, 3);
});

test('failed native registration cleans up its partial policy and does not report activation success', t => {
  const app = fixture(t);
  app.tools.set('power_dsh_history', { name: 'foreign-owner' });
  assert.throws(() => app.update(true), /^Error: historyUnavailable$/);
  assert.equal(app.sections.size, 0);
  assert.equal(app.tools.get('power_dsh_history').name, 'foreign-owner');
  app.tools.clear();
  app.update(true);
  assert.equal(app.tools.size, 1);
});

test('an already cancelled caller cannot start reading history', async t => {
  const app = fixture(t, { enabled: true });
  const controller = new AbortController();
  controller.abort();
  const result = await app.execute(undefined, { ...app.exec, signal: controller.signal });
  assert.deepEqual(result, { ok: false, error: 'historyCancelled', data: null });
  assert.equal(app.reads(), 0);
});

test('disable, immediate reenable, service replacement and disposal invalidate pending and captured tools', async t => {
  for (const transition of ['disable', 'reenable', 'replace', 'dispose']) {
    const app = fixture(t, { enabled: true });
    let entered;
    let finish;
    const ready = new Promise(resolve => { entered = resolve; });
    app.query.readSurface = () => { entered(); return new Promise(resolve => { finish = resolve; }); };
    const old = app.tools.get('power_dsh_history');
    const pending = app.execute();
    await ready;
    if (transition === 'disable') app.update(false);
    if (transition === 'reenable') { app.update(false); app.update(true); }
    if (transition === 'replace') app.bind({ ...app.query });
    if (transition === 'dispose') app.dispose();
    assert.equal((await pending).ok, false);
    assert.equal((await app.execute(undefined, app.exec, old)).ok, false);
    finish({ session: { id: 'past', cwd: '/project', createdAt: 1 }, events: [] });
  }
});

test('service removal releases tool and policy while a stale disposer cannot remove a replacement', t => {
  const app = fixture(t, { enabled: true, available: false });
  const old = app.bind();
  const replacement = app.bind();
  old();
  assert.equal(app.tools.size, 1);
  replacement();
  assert.equal(app.tools.size + app.sections.size, 0);
});

test('real Tools SDK accepts history search and disposes its canonical output contract', async t => {
  const require = createRequire(import.meta.resolve('@deepseek-ai/dsh-tools'));
  const { Context } = await import(pathToFileURL(require.resolve('@deepseek-ai/cordis')).href);
  const root = new Context();
  t.after(() => root.fiber.dispose());
  root.reflect.provide('systemPrompt', { tools: () => () => {} });
  await root.plugin(ToolsService);
  const tool = createHistoryTool(async () => JSON.stringify({ ok: true }));
  const release = root.get('tools').register(tool);
  assert.equal(root.get('tools').get('power_dsh_history').name, 'power_dsh_history');
  release();
  assert.equal(root.get('tools').get('power_dsh_history'), undefined);
});
