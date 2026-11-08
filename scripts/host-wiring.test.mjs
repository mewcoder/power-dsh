import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import ToolsService from '@deepseek-ai/dsh-tools';
const { apply, inject } = await import(process.env.POWER_DSH_HOST_TEST_ENTRY ?? new URL('../index.js', import.meta.url));

// The compatibility runner can load production dependencies with an older Host injector.
const require = createRequire(import.meta.resolve('@deepseek-ai/dsh-tools'));
const { Context } = await import(require.resolve('@deepseek-ai/cordis'));
const { default: SessionProjectionRegistry } = await import(require.resolve('@deepseek-ai/dsh-session-projection'));

async function fixture(t, { hostWorkspace = true, managedId = 'power-dsh' } = {}) {
  const root = new Context();
  t.after(() => root.fiber.dispose());
  root.reflect.provide('systemPrompt', { tools: () => () => {} });
  await root.plugin(ToolsService);
  await root.plugin(SessionProjectionRegistry);
  const candidates = [{ name: 'memory-skill', description: 'Memory-only skill', source: 'runtime', provider: 'runtime',
    invocation: { modelInvocable: true, userInvocable: true } }];
  const providers = new Set();
  const lookups = [];
  const skills = {
    registerProvider(create) {
      const controller = new AbortController();
      const provider = create({ signal: controller.signal, invalidate() {} });
      providers.add(provider);
      return () => { providers.delete(provider); controller.abort(); };
    },
    async snapshot(options) { lookups.push(options); return { skills: candidates, complete: true }; },
  };
  const writes = [];
  const values = {
    settings: { configure: () => () => {}, mutate: async (namespace, ops) => { writes.push({ namespace, ops }); } },
    clientModules: { graph: () => ({ release: { version: '0.2.2-rc.1' } }) },
    pluginManager: { listPlugins: async () => [], listBundles: async () => [] },
    typert: { register: () => () => {} },
    configEditor: {},
    profileContext: { home: '/memory-only/dsh-home' },
    skills,
    agents: { list: () => [] },
    agentPresets: {
      defaultId: 'standard', serviceFor: () => undefined,
      list: async () => [{ id: 'standard' }],
      compositionInventory: async () => [{ id: 'standard', rows: [] }],
      acquireScope: async () => ({ key: {}, async [Symbol.asyncDispose]() {} }),
    },
    workingDirectory: { defaultDirectory: '/memory-only/project' },
    loader: {
      await: async () => {},
      entries: () => [],
      import: async name => {
        if (name === '@deepseek-ai/dsh-mcp-client') return { async apply() { assert.fail('Reading the MCP directory must not start a bridge.'); } };
        assert.equal(name, '@deepseek-ai/dsh-scope');
        return { createScope: ctx => ({ ctx, async dispose() {} }), scopeOf: () => undefined, scopeChainOf: () => [] };
      },
    },
  };
  for (const [name, value] of Object.entries(values)) root.reflect.provide(name, value);
  if (hostWorkspace) root.reflect.provide('workspaceRegistry', { list: () => [{ path: '/memory-only/project', title: 'Memory project' }] });
  else root.reflect.provide('workspaces', { list: { getSnapshot: () => ({ items: [] }) } });
  const config = { disabledSkills: { get: () => [] }, ...Object.fromEntries([
    'blockTodo', 'blockOfficialTelemetry', 'blockOfficialAccount', 'blockOfficialSearch', 'showVersion', 'showThemeSwitcher', 'showRefreshButton', 'showRestartButton',
  ].map(field => [field, { get: () => false }])) };
  function fixtureMod(ctx) {
    ctx.fiber.entry = { options: { id: managedId } };
    apply(ctx, config);
  }
  fixtureMod.inject = inject;
  const fiber = await root.plugin(fixtureMod);
  assert.equal(root.get('tools').get('power_dsh_settings')?.name, 'power_dsh_settings');
  const session = { id: 'unopened-host-fixture', header: {}, inheritedEventCount: 0,
    seq: 0, snapshotEvents: () => [], eventAt: () => undefined };
  assert.deepEqual(root.get('sessionProjections').snapshot(session).values.powerDshNotifications, { seq: -1, turn: 0, reason: '' });
  return { root, fiber, session, service: root.get('powerDsh'), providers, lookups, writes, tool: root.get('tools').get('power_dsh_settings') };
}

test('the renamed settings tool writes to the actual managed entry, including an existing legacy install', async t => {
  for (const managedId of ['power-dsh', 'dsh-x-mod', 'dsh-mod']) {
    const { root, fiber, session, service, providers, tool, writes } = await fixture(t, { managedId });
    const preferences = await tool.execute({}, { signal: new AbortController().signal });
    assert.equal(preferences.showVersion, false);
    assert.equal(preferences.blockOfficialSearch, false);
    assert.equal(tool.parameters.properties.blockOfficialSearch.type, 'boolean');
    assert.deepEqual(writes, [], 'Reading preferences must not migrate or save an existing managed entry.');
    await tool.execute({ showVersion: true }, { signal: new AbortController().signal });
    assert.deepEqual(writes, [{ namespace: managedId, ops: [{ op: 'set', path: ['showVersion'], value: true }] }]);
    await fiber.dispose();
    assert.equal(root.get('tools').get('power_dsh_settings'), undefined);
    assert.equal(Object.hasOwn(root.get('sessionProjections').snapshot(session).values, 'powerDshNotifications'), false);
    assert.equal(providers.size, 0);
    await assert.rejects(service.setAccountBlocked(true), /unloaded/);
    assert.equal(writes.length, 1, 'Unloading must not migrate or save preferences.');
  }
});

test('the actual Host injector starts skill management with workspaceRegistry and serves its directory', async t => {
  const { service, providers, lookups } = await fixture(t);
  assert.ok(service.skills.current, 'The Host skill-management dependency injection must activate.');
  await service.skills.current.ready;
  const result = await service.listSkills('', '');
  assert.equal(result.cwd, '');
  assert.ok(lookups.every(options => !Object.hasOwn(options, 'cwd')), 'Global skill queries must omit the project directory.');
  assert.equal(result.scope, 'user');
  assert.deepEqual(result.workspaces, [{ path: '/memory-only/project', title: 'Memory project' }]);
  assert.equal(Object.hasOwn(result, 'preset'), false);
  assert.equal(Object.hasOwn(result, 'presets'), false);
  assert.equal(result.complete, true);
  assert.equal(result.skills[0].name, 'memory-skill');
  assert.equal(result.skills[0].enabled, true);
  assert.ok(providers.size > 0);
});

test('the Host MCP directory serves only global metadata without a workspace dependency', async t => {
  const { service } = await fixture(t, { hostWorkspace: false });
  assert.ok(service.mcp.providers);
  const global = await service.listMcpServers();
  assert.deepEqual(global, { complete: true, servers: [] });
  await assert.rejects(service.setMcpServerEnabled('runtime:1', false), /mcpUnavailable/);
});

test('a Client-shaped workspaces service cannot satisfy the Host workspace dependency', async t => {
  const { service } = await fixture(t, { hostWorkspace: false });
  assert.equal(service.skills.current, null);
  await assert.rejects(service.listSkills('', ''), /unavailable/);
});
