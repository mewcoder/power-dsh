import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import ToolsService from '@deepseek-ai/dsh-tools';
import { McpProviders } from '../mcp-providers.js';
import { OperationQueue } from '../operation-queue.js';

const require = createRequire(import.meta.resolve('@deepseek-ai/dsh-tools'));
const { Context, Service } = await import(require.resolve('@deepseek-ai/cordis'));
const scopes = await import(require.resolve('@deepseek-ai/dsh-scope'));
const SECRET = 'private-MCP-configuration';

function registerTool(ctx, name, schemaReadable = false) {
  const tools = ctx.get('tools');
  const projectsSchema = schemaReadable || typeof tools.definitions !== 'function';
  return tools.register({ name,
    get description() { if (!projectsSchema) throw new Error(SECRET); return SECRET; },
    get parameters() {
      if (!projectsSchema) throw new Error(SECRET);
      return { type: 'object', properties: { private: { type: 'string', description: SECRET } } };
    },
    get execute() { throw new Error('Listing tools must never read or invoke execution callbacks.'); },
    output: { schema: { type: 'boolean' }, render() { throw new Error('Listing tools must never render a result.'); } },
  });
}

async function fixture(t) {
  const root = new Context();
  t.after(() => root.fiber.dispose());
  root.reflect.provide('systemPrompt', { tools: () => () => {} });
  await root.plugin(ToolsService);
  const entries = [];
  const imports = [];
  let starts = 0;
  let stops = 0;
  const native = { name: 'mcp-client', async apply(ctx) {
    starts++;
    ctx.effect(() => () => { stops++; });
  } };
  root.reflect.provide('loader', { entries: () => entries, async import(name) {
    imports.push(name);
    if (name === '@deepseek-ai/dsh-mcp-client') return native;
    assert.equal(name, '@deepseek-ai/dsh-scope');
    return scopes;
  } });
  const queue = new OperationQueue();
  let catalog;
  await root.plugin({ name: 'mod-fixture', async apply(ctx) {
    catalog = new McpProviders(ctx, { ensureActive: () => queue.ensureActive() });
    catalog.ready = catalog.initialize();
    await catalog.ready;
    ctx.effect(() => () => catalog.close());
  } });
  async function provider(name = 'example-provider') {
    let ctx;
    await root.plugin({ name, async apply(child) { ctx = child; } });
    ctx.fiber.entry = { id: `include:${name}`, options: { id: name, name: `@example/${name}` }, fiber: ctx.fiber, ctx };
    return ctx;
  }
  return { root, catalog, queue, entries, imports, native, provider,
    get starts() { return starts; }, get stops() { return stops; } };
}

test('global inventory excludes Agent, nested and opaque scopes without reading project services', async t => {
  const app = await fixture(t);
  assert.equal(app.starts, 0);
  assert.deepEqual(app.imports.sort(), ['@deepseek-ai/dsh-mcp-client', '@deepseek-ai/dsh-scope']);
  for (const name of ['agents', 'workspaceRegistry', 'workingDirectory']) {
    app.root.reflect.provide(name, new Proxy({}, { get() { assert.fail(`Global MCP inventory must not read ${name}.`); } }));
  }
  const provider = await app.provider();
  await provider.plugin(app.native, { serverName: 'global', cwd: '/project-a' });
  const agent = { id: 'session-a', session: { get header() { assert.fail('Session paths must not be read.'); } } };
  const scoped = scopes.createScope(provider, agent);
  const descendant = scopes.createScope(provider, {}, { parent: agent });
  await scoped.ctx.plugin(app.native, { serverName: 'local' });
  await descendant.ctx.plugin(app.native, { serverName: 'nested' });
  await scopes.createScope(provider, {}).ctx.plugin(app.native, { serverName: 'opaque' });
  await provider.plugin({ name: 'mcp-client', async apply() {} }, { serverName: 'impostor' });
  const starts = app.starts;
  const view = app.catalog.list();
  assert.deepEqual(Object.keys(view).sort(), ['complete', 'servers']);
  assert.deepEqual(view.servers.map(row => row.name), ['global']);
  assert.equal(view.servers[0].canToggle, false);
  assert.equal(view.servers[0].reason, 'plugin-managed');
  assert.equal(app.starts, starts);
  assert.equal(app.stops, 0);
  await scoped.dispose();
  assert.deepEqual(app.catalog.list().servers.map(row => row.name), ['global']);
  const stops = app.stops;
  app.catalog.close();
  assert.equal(app.stops, stops);
  assert.throws(() => app.catalog.list(), /mcpUnavailable/);
});

test('static Loader rows are not duplicated and runtime catalog reads only whitelisted server metadata', async t => {
  const app = await fixture(t);
  const provider = await app.provider();
  const config = { serverName: 'safe' };
  for (const key of ['env', 'headers', 'command', 'args', 'url', 'cwd']) {
    Object.defineProperty(config, key, { get() { throw new Error(SECRET); } });
  }
  await provider.plugin(app.native, config);
  const staticFiber = await provider.plugin(app.native, { serverName: 'static' });
  // Runtime metadata can inherit the include node instead of the leaf Loader entry.
  staticFiber.entry = { options: { name: 'cordis:include' }, fiber: app.root.fiber };
  app.entries.push({ id: 'include:static', options: { name: '@deepseek-ai/dsh-mcp-client' },
    fiber: { uid: staticFiber.uid, effectiveConfig: { serverName: 'static' } } });
  assert.notEqual(app.entries[0].fiber, staticFiber);
  assert.deepEqual(app.catalog.configured(), [{ entryId: 'include:static', uid: staticFiber.uid, name: 'static', tools: [], runtimeState: 'unknown', transport: 'unknown' }]);
  const view = app.catalog.list();
  assert.deepEqual(view.servers.map(row => row.name), ['safe']);
  assert.ok(!JSON.stringify(view).includes(SECRET));
  assert.deepEqual(Object.keys(view.servers[0]).sort(), ['id', 'name', 'source', 'origin', 'group', 'enabled', 'runtimeState', 'stateKnown', 'canToggle', 'reason', 'tools', 'transport'].sort());
  await assert.rejects(app.catalog.setEnabled(view.servers[0].id, false), /mcpUnavailable/);
  assert.equal(app.stops, 0);
});

test('transport reads only native discriminators and keeps missing, unsupported or unreadable types unknown', async t => {
  const app = await fixture(t);
  const provider = await app.provider();
  for (const [name, transport] of [['local', 'stdio'], ['remote', 'streamable-http'], ['unsupported', 'sse'], ['missing', undefined]]) {
    const config = { serverName: name, transport };
    for (const key of ['command', 'args', 'env', 'url', 'headers', 'cwd']) {
      Object.defineProperty(config, key, { get() { throw new Error(SECRET); } });
    }
    await provider.plugin(app.native, config);
  }
  const unreadable = { serverName: 'unreadable', get transport() { throw new Error(SECRET); } };
  await provider.plugin(app.native, unreadable);
  const rows = app.catalog.list().servers;
  assert.deepEqual(Object.fromEntries(rows.map(row => [row.name, row.transport])), {
    local: 'stdio', remote: 'streamable-http', unsupported: 'unknown', missing: 'unknown', unreadable: 'unknown',
  });
  const disabledConfig = { transport: 'streamable-http', get url() { throw new Error(SECRET); } };
  app.entries.push({ id: 'include:disabled', options: { name: '@deepseek-ai/dsh-mcp-client', config: disabledConfig } });
  assert.equal(app.catalog.configured().find(row => row.entryId === 'include:disabled').transport, 'streamable-http');
  assert.ok(!JSON.stringify({ rows, configured: app.catalog.configured() }).includes(SECRET));
});

test('actual Cordis lifecycle fibers report pending, loading, active, failed, unloading and disposed states', async t => {
  await t.test('pending', async t => {
    const app = await fixture(t);
    app.native.inject = ['unavailable-runtime-gate'];
    const provider = await app.provider();
    const fiber = provider.plugin(app.native, { serverName: 'pending' });
    assert.equal(fiber.state, 0);
    const identity = fiber.effectiveConfig?.serverName ?? fiber.config?.serverName ?? fiber.rawConfig?.serverName;
    if (identity === undefined) assert.deepEqual(app.catalog.list().servers, []);
    else assert.equal(app.catalog.list().servers[0].runtimeState, 'pending');
    app.entries.push({ id: 'include:pending', options: { name: '@deepseek-ai/dsh-mcp-client', config: { serverName: 'pending' } }, fiber });
    assert.equal(app.catalog.configured()[0].runtimeState, 'pending');
    assert.equal(app.catalog.configured()[0].name, 'pending');
  });
  await t.test('loading', async t => {
    const app = await fixture(t);
    const gate = Promise.withResolvers();
    const started = Promise.withResolvers();
    app.native.apply = async () => { started.resolve(); await gate.promise; };
    const provider = await app.provider();
    const fiber = provider.plugin(app.native, { serverName: 'loading' });
    try {
      await started.promise;
      assert.equal(fiber.state, 1);
      assert.equal(app.catalog.list().servers[0].runtimeState, 'loading');
    } finally {
      gate.resolve();
      await fiber.await();
    }
    assert.equal(app.catalog.list().servers[0].runtimeState, 'active');
  });
  await t.test('failed', async t => {
    const app = await fixture(t);
    app.native.apply = async () => { throw new Error(SECRET); };
    const provider = await app.provider();
    const fiber = provider.plugin(app.native, { serverName: 'failed' });
    await assert.rejects(fiber.await(), error => error.message.includes(SECRET));
    assert.equal(fiber.state, 3);
    const view = app.catalog.list();
    assert.equal(view.servers[0].runtimeState, 'failed');
    assert.ok(!JSON.stringify(view).includes(SECRET));
  });
  await t.test('unloading and disposed', async t => {
    const app = await fixture(t);
    const gate = Promise.withResolvers();
    app.native.apply = ctx => { ctx.effect(() => () => gate.promise); };
    const provider = await app.provider();
    const fiber = await provider.plugin(app.native, { serverName: 'stopping' });
    app.entries.push({ id: 'include:stopping', options: { name: '@deepseek-ai/dsh-mcp-client' }, fiber });
    assert.equal(app.catalog.configured()[0].runtimeState, 'active');
    const stopped = fiber.dispose();
    try {
      assert.equal(fiber.state, 5);
      assert.equal(app.catalog.configured()[0].runtimeState, 'unloading');
      // Cordis withdraws a dynamic instance's registration as soon as disposal starts.
      assert.deepEqual(app.catalog.list().servers, []);
    } finally {
      gate.resolve();
      await stopped;
    }
    assert.equal(fiber.state, 4);
    assert.equal(app.catalog.configured()[0].runtimeState, 'inactive');
    assert.deepEqual(app.catalog.list().servers, []);
  });
});

test('unreadable or unknown Fiber states remain unknown without exposing errors or old tools', async t => {
  const app = await fixture(t);
  app.entries.push({ id: 'include:unknown', options: { name: '@deepseek-ai/dsh-mcp-client', config: { serverName: 'unknown' } }, fiber: {
    uid: 99, ctx: app.root, get state() { throw new Error(SECRET); },
  } });
  const metadata = app.catalog.configured();
  assert.equal(metadata[0].runtimeState, 'unknown');
  assert.deepEqual(metadata[0].tools, []);
  assert.ok(!JSON.stringify(metadata).includes(SECRET));
  app.entries.push({ id: 'include:unmounted', options: { name: '@deepseek-ai/dsh-mcp-client', config: { serverName: 'unmounted' } } });
  assert.equal(app.catalog.configured()[1].runtimeState, 'inactive');
});

test('global tools exclude names and definitions registered only in Agent scopes', async t => {
  const app = await fixture(t);
  const provider = await app.provider();
  const global = await provider.plugin(app.native, { serverName: 'same' });
  registerTool(global.ctx, 'mcp__same__root_only');
  registerTool(global.ctx, 'mcp__same__shared');
  registerTool(global.ctx, 'mcp__same-other__foreign');
  const scoped = scopes.createScope(provider, {});
  const local = await scoped.ctx.plugin(app.native, { serverName: 'same' });
  registerTool(local.ctx, 'mcp__same__local_only');
  registerTool(local.ctx, 'mcp__same__shared');
  assert.deepEqual(app.catalog.list().servers[0].tools, ['root_only', 'shared']);
  app.entries.push({ id: 'include:known', options: { name: '@deepseek-ai/dsh-mcp-client' }, fiber: global });
  assert.deepEqual(app.catalog.configured()[0].tools, ['root_only', 'shared']);
  assert.deepEqual(app.catalog.list().servers, []);
});

test('schema enumeration preserves scoped shadows and restrictions using native definition identity', async t => {
  const app = await fixture(t);
  const parentKey = {};
  const childKey = {};
  const parent = scopes.createScope(app.root, parentKey);
  const child = scopes.createScope(app.root, childKey, { parent: parentKey });
  registerTool(app.root, 'mcp__same__hidden', true);
  registerTool(app.root, 'mcp__same__shared', true);
  registerTool(parent.ctx, 'mcp__same__inherited', true);
  registerTool(child.ctx, 'mcp__same__child_only', true);
  registerTool(child.ctx, 'mcp__same__shared', true);
  registerTool(child.ctx, 'mcp__different__foreign', true);
  child.ctx.get('tools').restrict({ deny: ['mcp__same__hidden'] });
  const tools = app.root.get('tools');
  let projections = 0;
  const legacy = {
    schemas(scope) { projections++; return tools.schemas(scope); },
    get(name, scope) { return tools.get(name, scope); },
  };
  const request = { get: name => { assert.equal(name, 'tools'); return legacy; } };
  app.catalog.scopeOf = () => childKey;
  const first = app.catalog.toolNames('same', request);
  assert.deepEqual(first, ['shared', 'child_only']);
  assert.deepEqual(app.catalog.toolNames('same', request), first);
  assert.equal(projections, 2);
  assert.ok(!JSON.stringify(first).includes(SECRET));
  assert.notEqual(tools.schemas(childKey)[0], tools.schemas(childKey)[0], 'Schemas are copies, so reference comparison must use native get().');
});

test('definition enumeration does not invoke schema projection or execution getters', () => {
  const tools = {
    definitions: () => [{ name: 'mcp__safe__visible', get execute() { assert.fail('Must not inspect execution.'); } }],
    schemas() { assert.fail('New hosts must not project schemas to list names.'); },
  };
  const catalog = new McpProviders({ get: () => tools });
  catalog.scopeOf = () => undefined;
  assert.deepEqual(catalog.toolNames('safe'), ['visible']);
});

test('a legacy schema projection failure stays a failure instead of an empty tool list', async t => {
  const app = await fixture(t);
  app.root.get('tools').register({ name: 'unrelated_tool',
    get description() { throw new Error(SECRET); }, parameters: {},
    output: { schema: { type: 'boolean' }, render: () => [] }, execute: async () => true,
  });
  const tools = app.root.get('tools');
  const request = { get: () => ({ schemas: scope => tools.schemas(scope), get: (name, scope) => tools.get(name, scope) }) };
  app.catalog.scopeOf = () => undefined;
  assert.throws(() => app.catalog.toolNames('same', request), error => error.message === SECRET);
});

test('structural include nodes are never displayed as a providing plugin', async t => {
  const app = await fixture(t);
  const include = await app.provider('cordis:include');
  include.fiber.entry.options.name = 'cordis:include';
  await include.plugin(app.native, { serverName: 'provided' });
  const row = app.catalog.list().servers[0];
  assert.equal(row.origin, '');
  assert.equal(row.source, 'plugin');
  assert.ok(!JSON.stringify(row).includes('cordis:include'));
});

async function managedFixture(t) {
  const app = await fixture(t);
  const manual = { enabled: true, transport: 'stdio' };
  for (const key of ['env', 'headers', 'command', 'args', 'url']) Object.defineProperty(manual, key, { get() { throw new Error(SECRET); } });
  const configs = { manual };
  const registrations = ['bundled'];
  class Manager extends Service {
    constructor(ctx) { super(ctx, 'mcpManager'); this.config = { servers: { get: () => configs } }; }
    list() { return [...Object.keys(configs), ...registrations].map(name => ({ name, configured: true,
      get status() { throw new Error(SECRET); } })).concat({ name: 'removed', configured: false }); }
  }
  const owner = await app.root.plugin(Manager);
  const entry = { id: 'include:manager', options: { id: 'manager', name: '@deepseek-ai/dsh-mcp-manager' }, fiber: owner, ctx: owner.ctx };
  owner.entry = entry;
  app.entries.push(entry);
  const writes = [];
  const settings = {
    describe() { return [{ ns: 'manager', revision: 9, get value() { throw new Error(SECRET); } }]; },
    async mutate(...args) { writes.push(args); manual.enabled = args[1][0].value; },
  };
  app.root.reflect.provide('settings', settings);
  const manualBridge = await owner.ctx.plugin(app.native, { serverName: 'manual', transport: 'streamable-http' });
  const bundledBridge = await owner.ctx.plugin(app.native, { serverName: 'bundled', transport: 'stdio' });
  registerTool(manualBridge.ctx, 'mcp__manual__generate');
  registerTool(manualBridge.ctx, 'mcp__manual__poll');
  registerTool(bundledBridge.ctx, 'mcp__bundled__search');
  return { ...app, configs, owner, entry, settings, writes };
}

test('native manager config and plugin registrations keep distinct ownership, with real Loader-based deduplication', async t => {
  const app = await managedFixture(t);
  assert.equal(app.catalog.ctx.get('mcpManager').ctx.fiber, app.catalog.ctx.fiber, 'Cordis rebinds Service.ctx to the caller.');
  const rows = app.catalog.list().servers;
  assert.equal(rows.length, 2);
  const manual = rows.find(row => row.name === 'manual');
  const bundled = rows.find(row => row.name === 'bundled');
  assert.equal(manual.group, 'user');
  assert.equal(manual.canToggle, true);
  assert.equal(manual.runtimeState, 'active');
  assert.equal(manual.transport, 'streamable-http');
  assert.equal(bundled.transport, 'stdio');
  assert.deepEqual(manual.tools, ['generate', 'poll']);
  assert.deepEqual(bundled.tools, ['search']);
  assert.equal(bundled.group, 'builtin');
  assert.equal(bundled.canToggle, false);
  assert.equal(bundled.reason, 'plugin-managed');
  assert.ok(!JSON.stringify(rows).includes(SECRET));
  await app.catalog.setEnabled(manual.id, false);
  assert.deepEqual(app.writes, [['manager', [{ op: 'set', path: ['servers', 'manual', 'enabled'], value: false }], 9]]);
  const disabledWhileRunning = app.catalog.list().servers.find(row => row.name === 'manual');
  assert.equal(disabledWhileRunning.enabled, false);
  assert.equal(disabledWhileRunning.runtimeState, 'active');
  await app.catalog.setEnabled(manual.id, false);
  assert.equal(app.writes.length, 1);
  await assert.rejects(app.catalog.setEnabled(bundled.id, false), /mcpUnavailable/);
});

test('manager lifecycle comes only from an exact native child and never from manager activity, connection status or tools', async t => {
  const app = await managedFixture(t);
  const nativeRuntime = app.root.registry.get(app.native);
  const manualBridge = [...nativeRuntime.fibers].find(fiber => (fiber.effectiveConfig ?? fiber.config)?.serverName === 'manual');
  await manualBridge.dispose();
  app.configs.manual.enabled = false;
  assert.equal(app.catalog.list().servers.find(row => row.name === 'manual').runtimeState, 'unknown');
  assert.equal(app.catalog.list().servers.find(row => row.name === 'manual').transport, 'stdio');
  const otherProvider = await app.provider('unrelated-provider');
  await otherProvider.plugin(app.native, { serverName: 'manual' });
  assert.equal(app.catalog.list().servers.find(row => row.source === 'manager' && row.name === 'manual').runtimeState, 'unknown');
  assert.equal(app.catalog.list().servers.find(row => row.name === 'bundled').runtimeState, 'active');
  assert.ok(!JSON.stringify(app.catalog.list()).includes(SECRET));
});

test('native Settings errors are masked and persisted failures are read back instead of assumed rolled back', async t => {
  const app = await managedFixture(t);
  const row = app.catalog.list().servers.find(row => row.name === 'manual');
  app.settings.mutate = async () => { app.configs.manual.enabled = false; throw new Error(SECRET); };
  await assert.rejects(app.catalog.setEnabled(row.id, false), error => error.message === 'mcpChangeFailed' && !String(error.stack).includes(SECRET));
  assert.equal(app.catalog.list().servers.find(row => row.name === 'manual').enabled, false);
  app.settings.describe = () => { app.queue.close(); return [{ ns: 'manager', revision: 10 }]; };
  let writes = 0;
  app.settings.mutate = async () => { writes++; };
  await assert.rejects(app.catalog.setEnabled(row.id, true), { code: 'mod/unloaded' });
  assert.equal(writes, 0);
});
