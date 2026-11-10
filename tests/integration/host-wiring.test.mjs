import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import ToolsService from '@deepseek-ai/dsh-tools';
const { apply, inject, Config } = await import(process.env.POWER_DSH_HOST_TEST_ENTRY ?? new URL('../../src/index.ts', import.meta.url));

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
    'blockDoubleClickRename', 'blockTodo', 'blockPlan', 'blockGoal', 'blockOfficialTelemetry', 'blockOfficialAccount', 'blockOfficialSearch', 'showVersion', 'showThemeSwitcher', 'showRefreshButton', 'showRestartButton',
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
    assert.equal(preferences.blockDoubleClickRename, false);
    assert.equal(Config.dict.blockDoubleClickRename.meta.default, false);
    assert.equal(tool.parameters.properties.blockDoubleClickRename.type, 'boolean');
    assert.equal(tool.parameters.properties.blockOfficialSearch.type, 'boolean');
    assert.equal(tool.output.schema.properties.showRestartButton.type, 'boolean');
    assert.ok(tool.output.schema.required.includes('showRestartButton'), 'Restart visibility must remain a required output field.');
    assert.deepEqual(writes, [], 'Reading preferences must not migrate or save an existing managed entry.');
    await tool.execute({ showVersion: true, blockDoubleClickRename: true }, { signal: new AbortController().signal });
    assert.deepEqual(writes, [
      { namespace: managedId, ops: [{ op: 'set', path: ['showVersion'], value: true }] },
      { namespace: managedId, ops: [{ op: 'set', path: ['blockDoubleClickRename'], value: true }] },
    ]);
    await fiber.dispose();
    assert.equal(root.get('tools').get('power_dsh_settings'), undefined);
    assert.equal(Object.hasOwn(root.get('sessionProjections').snapshot(session).values, 'powerDshNotifications'), false);
    assert.equal(providers.size, 0);
    await assert.rejects(service.setAccountBlocked(true), /unloaded/);
    assert.equal(writes.length, 2, 'Unloading must not migrate or save preferences.');
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

test('feature-owned RPC methods retain the invocation owner check through the actual Cordis service', async t => {
  const { root, writes } = await fixture(t);
  const caller = root.extend({ invocation: { peer: { principal: { kind: 'guest' } } } });
  const service = caller.get('powerDsh');
  assert.equal(service.ctx.invocation.peer.principal.kind, 'guest');
  for (const [method, args] of [
    ['restartStatus', []], ['restartApp', []], ['listSystemSounds', []],
    ['setAccountBlocked', [true]], ['setTelemetryBlocked', [true]],
    ['setTodoBlocked', [true]], ['setPlanBlocked', [true]], ['setGoalBlocked', [true]], ['setSearchBlocked', [true]],
    ['readPersonalization', []], ['savePersonalization', ['text', 'revision']],
    ['listSkills', ['', '']], ['setSkillEnabled', ['', '', 'review', false]],
    ['listMcpServers', []], ['setMcpServerEnabled', ['server', false]],
  ]) {
    await assert.rejects(async () => service[method](...args), /Only the profile owner can change Mod policies/, method);
  }
  await assert.rejects(async () => service.playSystemSound('default', true), /Only the profile owner can play system sounds/);
  assert.deepEqual(writes, []);
});

test('duplicate feature and RPC ids fail before Host resources or contexts are accessed', () => {
  const ctx = new Proxy({}, { get() { assert.fail('Invalid feature combinations must fail before Host side effects.'); } });
  const first = { definition: { id: 'first' } };
  assert.throws(() => apply(ctx, {}, [first, first]), /Duplicate Host feature: first/);
  const descriptor = { id: 'power-dsh#powerDsh/test', method: 'test' };
  assert.throws(() => apply(ctx, {}, [
    { ...first, rpc: [descriptor] },
    { definition: { id: 'second' }, rpc: [{ ...descriptor }] },
  ]), /Duplicate Host RPC: power-dsh#powerDsh\/test/);
});

test('all feature configuration defaults and settings tool output requirements survive composition', async t => {
  const { tool } = await fixture(t);
  const expected = {
    showVersion: false, showThemeSwitcher: false, showRefreshButton: false, showRestartButton: false,
    notificationsEnabled: false, notificationSoundEnabled: true, notificationSound: 'default',
    blockOfficialAccount: false, blockOfficialSearch: false, blockOfficialTelemetry: false,
    blockTodo: false, blockPlan: false, blockGoal: false, blockDoubleClickRename: false, personalizationEnabled: false,
    skillManagerEnabled: false, mcpManagerEnabled: false, disabledSkills: [],
    showThinkingEffortSwitcher: false,
    thinkingEffortGlyph: 'arc',
    flowingBackgroundEnabled: false,
    showBackgroundShortcut: false,
    flowingBackgroundKind: 'pattern',
    flowingBackgroundOpacity: 100,
    flowingBackgroundBlur: 0,
    archiveManagerEnabled: false,
    projectManagerEnabled: false,
    usageStatsEnabled: false,
  };
  assert.deepEqual(Object.keys(Config.dict).sort(), Object.keys(expected).sort());
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(Config.dict[key].meta.default, value, key);
  const fields = ['showVersion', 'showThemeSwitcher', 'showRefreshButton', 'showRestartButton',
    'blockOfficialAccount', 'blockOfficialSearch', 'blockDoubleClickRename', 'blockOfficialTelemetry', 'blockTodo', 'blockPlan', 'blockGoal'];
  assert.deepEqual(Object.keys(tool.parameters.properties).sort(), fields.slice().sort());
  assert.deepEqual(Object.keys(tool.output.schema.properties).sort(), [...fields, 'telemetry', 'version'].sort());
  assert.deepEqual(tool.output.schema.required.slice().sort(), [...fields, 'telemetry', 'version'].sort());
  assert.equal(tool.output.schema.additionalProperties, false);
});
