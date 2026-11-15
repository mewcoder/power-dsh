import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, rm, readFile, realpath, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHost, methods } from '../host.ts';
import { createMemoryTool } from '../memory-tool.ts';
import ToolsService from '@deepseek-ai/dsh-tools';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

async function fixture(t, { available = true, enabled = false, desktop, llm } = {}) {
  const home = await mkdtemp(join(tmpdir(), 'power-dsh-memory-host-'));
  const values = { memoryEnabled: enabled, memoryAutoCapture: true, memoryGlobalEnabled: true, memoryWorkspaceEnabled: true };
  const config = Object.fromEntries(Object.keys(values).map(key => [key, { get: () => values[key] }]));
  const sections = new Map();
  const contexts = new Map();
  const tools = new Map();
  const listeners = new Map();
  const disposers = [];
  let registrations = 0;
  const register = map => options => {
    assert.equal(map.has(options.name), false);
    map.set(options.name, options);
    registrations++;
    return () => map.delete(options.name);
  };
  const ctx = {
    fiber: { entry: { options: { id: 'power-dsh' } } },
    profileContext: { home },
    sessionController: desktop,
    tools: { register: register(tools) },
    inject(dependencies, callback) {
      if (dependencies.includes('llm')) {
        if (llm) callback({ ...ctx, llm });
        return;
      }
      if (dependencies.includes('sessionController')) {
        if (desktop) callback(ctx);
        return;
      }
      if (available) callback({ ...ctx, systemPrompt: { section: register(sections), context: register(contexts) } });
    },
    on(event, listener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(listener);
      return () => listeners.get(event).delete(listener);
    },
    effect(effect) { const dispose = effect(); if (dispose) disposers.push(dispose); },
  };
  const host = createHost(ctx, config, { owner: ctx, ensureActive() {} });
  const dispose = () => { disposers.splice(0).reverse().forEach(callback => callback()); };
  t.after(async () => { dispose(); await rm(home, { recursive: true, force: true }); });
  const update = patch => {
    Object.assign(values, patch);
    for (const listener of listeners.get('settings/document-updated') ?? []) listener('power-dsh');
  };
  return { home, ctx, host, config, values, sections, contexts, tools, listeners, update, dispose,
    registrations: () => registrations };
}

test('manual organization uses optional public services and disabling memory cancels model work', async t => {
  const catalog = { default: { provider: 'configured', model: 'model' }, groups: [{ id: 'configured', name: 'Configured', models: [{ id: 'model', name: 'Model' }] }] };
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const llm = { async *stream(options) {
    entered();
    await new Promise(resolve => options.signal.addEventListener('abort', resolve, { once: true }));
  } };
  const app = await fixture(t, { enabled: true, desktop: { modelCatalog: async () => catalog }, llm });
  const service = { ...app.host, run: operation => Promise.resolve(operation()) };
  assert.equal((await methods.memoryCleanupModels.call(service)).models[0].model, 'model');
  await app.host.memory.save('global', { type: 'user', name: 'preserved', description: 'Preserved', content: 'Keep this.', revision: '', originSessionId: '' });
  const pending = methods.prepareMemoryCleanup.call(service, 'global', JSON.stringify(catalog.default), randomUUID());
  await started;
  app.update({ memoryEnabled: false });
  await assert.rejects(pending, /memoryCleanupFailed|memoryDisabled/);
  assert.match(await readFile(join(app.home, 'power-dsh/memory/preserved.md'), 'utf8'), /Keep this/);
  app.update({ memoryEnabled: true });
  const noModels = await fixture(t, { enabled: true });
  await assert.rejects(noModels.host.memoryCleanup.models(), /memoryModelUnavailable/);
  assert.equal((await noModels.host.memoryCatalog()).available, true);
});

test('Host activation owns exactly one tool and prompt pair and releases all step listeners', async t => {
  const app = await fixture(t);
  assert.equal(app.tools.size, 0);
  for (let cycle = 0; cycle < 3; cycle++) {
    app.update({ memoryEnabled: true });
    assert.equal(app.tools.size, 1);
    assert.equal(app.sections.size, 1);
    assert.equal(app.contexts.size, 1);
    const count = app.registrations();
    app.update({ memoryGlobalEnabled: false });
    assert.equal(app.registrations(), count);
    assert.equal(app.contexts.get('power-dsh:memory-index').order, 130);
    assert.equal(app.sections.get('power-dsh:memory-policy').interpolate, false);
    assert.match(app.sections.get('power-dsh:memory-policy').text(), /Automatic capture is enabled: proactively save/);
    app.update({ memoryAutoCapture: false });
    assert.match(app.sections.get('power-dsh:memory-policy').text(), /Automatic capture is disabled/);
    assert.equal(app.tools.size, 1);
    assert.equal(app.registrations(), count);
    app.update({ memoryAutoCapture: true });
    app.update({ memoryEnabled: false });
    assert.equal(app.tools.size + app.sections.size + app.contexts.size, 0);
    assert.equal(app.listeners.get('agent/pre-step').size, 0);
  }
  await assert.rejects(app.host.memoryCatalog(), /memoryDisabled/);
});

test('first-step prewarming and subsequent profile writes are reflected in cached prompt data', async t => {
  const app = await fixture(t, { enabled: true });
  const saved = await app.host.memory.save('global', { type: 'user', name: 'short-answers',
    description: '简短回答', content: '回答尽量简短。', revision: '', originSessionId: 'session' });
  const provider = app.contexts.get('power-dsh:memory-index');
  const context = { agent: { session: { header: {} } } };
  const step = [...app.listeners.get('agent/pre-step')][0];
  let nextCalled = false;
  await step(context, () => { nextCalled = true; assert.match(provider.text(context), /简短回答/); });
  assert.equal(nextCalled, true);
  assert.match(app.sections.get('power-dsh:memory-policy').text(), /Automatic capture is enabled: proactively save/);
  app.update({ memoryGlobalEnabled: false });
  assert.doesNotMatch(provider.text(context), /简短回答/);
  app.update({ memoryGlobalEnabled: true });
  await app.host.memory.remove('global', saved.entry.id, saved.entry.revision);
  await step(context, () => {});
  assert.doesNotMatch(provider.text(context), /简短回答/);
  assert.equal(provider.text({}), '');
});

test('missing prompt service is isolated and disabled operation preserves persisted files', async t => {
  const missing = await fixture(t, { available: false, enabled: true });
  assert.equal(missing.tools.size, 0);
  await assert.rejects(missing.host.memoryCatalog(), /memoryUnavailable/);
  const app = await fixture(t, { enabled: true });
  await app.host.memory.save('global', { type: 'user', name: 'keep-this', description: '保留',
    content: '关闭后保留', revision: '', originSessionId: '' });
  app.update({ memoryEnabled: false });
  await assert.rejects(app.host.memory.save('global', { type: 'user', name: 'new-entry',
    description: '禁止', content: '不保存', revision: '', originSessionId: '' }), /memoryDisabled/);
  assert.match(await readFile(join(app.home, 'power-dsh/memory/keep-this.md'), 'utf8'), /关闭后保留/);
});

test('real SDK registration accepts the canonical memory output contract', async t => {
  const app = await fixture(t);
  const require = createRequire(import.meta.resolve('@deepseek-ai/dsh-tools'));
  const { Context } = await import(pathToFileURL(require.resolve('@deepseek-ai/cordis')).href);
  const root = new Context();
  t.after(() => root.fiber.dispose());
  root.reflect.provide('systemPrompt', { tools: () => () => {} });
  await root.plugin(ToolsService);
  const tool = createMemoryTool(app.host.memory, app.config, () => true);
  const release = root.get('tools').register(tool);
  assert.equal(root.get('tools').get('power_dsh_memory').name, 'power_dsh_memory');
  release();
  assert.equal(root.get('tools').get('power_dsh_memory'), undefined);
});

test('folder actions open only the validated global or project memory directory', async t => {
  const opened = [];
  const desktop = {
    canOpenWorkspacePath: () => true,
    async openWorkspacePath(request, signal) { opened.push(request.path); signal.throwIfAborted(); return { opened: true }; },
  };
  const { host, home } = await fixture(t, { enabled: true, desktop });
  const input = { type: 'user', name: 'saved', description: 'Saved', content: 'Remember this', revision: '', originSessionId: '' };
  await host.memory.save('global', input);
  const project = join(home, 'source-project');
  await mkdir(project);
  const workspace = await host.memory.workspace(project);
  await host.memory.save(workspace.id, { ...input, type: 'project' }, workspace.cwd);
  const service = { ...host, run: operation => operation() };
  for (const scope of ['global', workspace.id]) {
    const detail = await methods.readMemoryEntry.call(service, scope, `${scope === 'global' ? 'user' : 'project'}/saved`);
    assert.equal(detail.path, join(await host.memory.folder(scope), 'saved.md'));
    assert.equal(detail.content, input.content);
  }
  assert.equal(await host.memoryOpenFolder('global'), true);
  assert.equal(await host.memoryOpenFolder(workspace.id), true);
  assert.deepEqual(opened, [await host.memory.folder('global'), await host.memory.folder(workspace.id)]);
  assert.equal(opened[0], await realpath(join(home, 'power-dsh/memory')));
  assert.notEqual(opened[1], workspace.cwd);
  await assert.rejects(host.memoryOpenFolder('../outside'), /^Error: memoryInvalid$/);
  await assert.rejects(host.memoryOpenFolder('a'.repeat(64)), /^Error: memoryNotFound$/);
  await rm(join(home, 'power-dsh/memory'), { recursive: true });
  await symlink(project, join(home, 'power-dsh/memory'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(host.memoryOpenFolder('global'), /^Error: memoryInvalid$/);
  assert.equal(opened.length, 2);
});

test('unavailable desktop and opener failures return fixed errors without exposing native messages', async t => {
  const missing = await fixture(t, { enabled: true });
  await assert.rejects(missing.host.memoryOpenFolder('global'), /^Error: memoryFolderUnavailable$/);
  const desktop = { canOpenWorkspacePath: () => false, async openWorkspacePath() { throw new Error('/private/path secret'); } };
  const { host } = await fixture(t, { enabled: true, desktop });
  await assert.rejects(host.memoryOpenFolder('global'), /^Error: memoryFolderUnavailable$/);
  await host.memory.save('global', { type: 'user', name: 'saved', description: 'Saved',
    content: 'Remember this', revision: '', originSessionId: '' });
  desktop.canOpenWorkspacePath = () => true;
  await assert.rejects(host.memoryOpenFolder('global'), /^Error: memoryOpenFolderFailed$/);
  desktop.openWorkspacePath = async () => ({ opened: false });
  await assert.rejects(host.memoryOpenFolder('global'), /^Error: memoryOpenFolderFailed$/);
  assert.equal((await host.memory.catalog()).scopes[0].entries.length, 1);
});

test('disabling or disposing memory cancels pending native folder actions', async t => {
  for (const dispose of [false, true]) {
    let started;
    let signal;
    const ready = new Promise(resolve => { started = resolve; });
    const desktop = {
      canOpenWorkspacePath: () => true,
      openWorkspacePath(_request, lifetime) {
        signal = lifetime;
        started();
        return new Promise((_resolve, reject) => lifetime.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
      },
    };
    const app = await fixture(t, { enabled: true, desktop });
    await app.host.memory.save('global', { type: 'user', name: 'saved', description: 'Saved',
      content: 'Remember this', revision: '', originSessionId: '' });
    const opening = app.host.memoryOpenFolder('global');
    const rejected = assert.rejects(opening, /^Error: memoryOpenFolderFailed$/);
    await ready;
    if (dispose) app.dispose(); else app.update({ memoryEnabled: false });
    await rejected;
    assert.equal(signal.aborted, true);
    await assert.rejects(app.host.memoryOpenFolder('global'), /^Error: memoryDisabled$/);
  }
});
