import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import ToolsService from '@deepseek-ai/dsh-tools';
const { apply, inject, Config } = await import(process.env.POWER_DSH_HOST_TEST_ENTRY ?? new URL('../../src/index.ts', import.meta.url));

// The compatibility runner can load production dependencies with an older Host injector.
const require = createRequire(import.meta.resolve('@deepseek-ai/dsh-tools'));
const { Context } = await import(pathToFileURL(require.resolve('@deepseek-ai/cordis')).href);
const { default: SessionProjectionRegistry } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-session-projection')).href);

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
    async get(name) {
      return name === 'memory-skill' ? { ...candidates[0], content: '# Memory\n\nBody text.' } : undefined;
    },
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
  const config = {
    disabledSkills: { get: () => [] },
    autoArchiveDays: { get: () => 0 },
    autoArchivedSessions: { get: () => [] },
    ...Object.fromEntries([
      'blockDoubleClickRename', 'blockTodo', 'blockPlan', 'blockGoal', 'blockOfficialTelemetry', 'blockOfficialAccount', 'blockOfficialSearch', 'showVersion', 'showThemeSwitcher', 'showRefreshButton', 'showRestartButton', 'searchPopupEnabled',
    ].map(field => [field, { get: () => false }])),
  };
  function fixtureMod(ctx) {
    ctx.fiber.entry = { options: { id: managedId } };
    apply(ctx, config);
  }
  fixtureMod.inject = inject;
  const fiber = await root.plugin(fixtureMod);
  assert.equal(root.get('tools').get('power_dsh_settings'), undefined);
  const session = { id: 'unopened-host-fixture', header: {}, inheritedEventCount: 0,
    seq: 0, snapshotEvents: () => [], eventAt: () => undefined };
  assert.deepEqual(root.get('sessionProjections').snapshot(session).values.powerDshNotifications, { seq: -1, turn: 0, reason: '' });
  return { root, fiber, session, service: root.get('powerDsh'), providers, lookups, writes };
}

test('the Host exposes no settings tool and preserves preferences for canonical and legacy managed entries', async t => {
  for (const managedId of ['power-dsh', 'dsh-x-mod', 'dsh-mod']) {
    const { root, fiber, session, service, providers, writes } = await fixture(t, { managedId });
    assert.equal(Config.dict.blockDoubleClickRename.meta.default, false);
    assert.deepEqual(writes, [], 'Loading must not migrate or save an existing managed entry.');
    await fiber.dispose();
    assert.equal(root.get('tools').get('power_dsh_settings'), undefined);
    assert.equal(Object.hasOwn(root.get('sessionProjections').snapshot(session).values, 'powerDshNotifications'), false);
    assert.equal(providers.size, 0);
    await assert.rejects(service.setAccountBlocked(true), /unloaded/);
    assert.deepEqual(writes, [], 'Unloading must not migrate or save preferences.');
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
  assert.deepEqual(result.workspaces, [{ path: resolve('/memory-only/project'), title: 'Memory project' }]);
  assert.equal(Object.hasOwn(result, 'preset'), false);
  assert.equal(Object.hasOwn(result, 'presets'), false);
  assert.equal(result.complete, true);
  assert.equal(result.skills[0].name, 'memory-skill');
  assert.equal(result.skills[0].enabled, true);
  assert.ok(providers.size > 0);
  // The body is read on demand through the same preset scope the catalog used.
  const detail = await service.readSkill('', '', 'memory-skill');
  assert.equal(detail.name, 'memory-skill');
  assert.equal(detail.content, '# Memory\n\nBody text.');
  assert.equal(detail.source, 'runtime');
  assert.equal(detail.enabled, true);
  assert.equal(await service.readSkill('', '', 'missing-skill'), null);
  await assert.rejects(service.readSkill('', '', '../bad'), /Invalid skill operation/);
});

test('the Host MCP directory serves only global metadata without a workspace dependency', async t => {
  const { service } = await fixture(t, { hostWorkspace: false });
  assert.ok(service.mcp.providers);
  const global = await service.listMcpServers();
  assert.deepEqual(global, { complete: true, servers: [] });
  await assert.rejects(service.setMcpServerEnabled('runtime:1', false), /mcpUnavailable/);
  assert.equal(await service.readMcpServer('include:missing'), null);
  await assert.rejects(service.readMcpServer(''), /mcpUnavailable/);
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
    ['restartStatus', []], ['restartApp', []], ['restartAfterUpdate', []], ['pluginRuntimeVersion', []], ['listSystemSounds', []], ['notificationTransport', []], ['readPluginRelease', []],
    ['setAccountBlocked', [true]], ['setTelemetryBlocked', [true]],
    ['setTodoBlocked', [true]], ['setPlanBlocked', [true]], ['setGoalBlocked', [true]], ['setSearchBlocked', [true]], ['setSearchPopupEnabled', [true]],
    ['readPersonalization', []], ['savePersonalization', ['text', 'revision']],
    ['listMemoryEntries', []], ['readMemoryEntry', ['global', 'user/example']],
    ['deleteMemoryEntry', ['global', 'user/example', 'revision']],
    ['clearMemoryScope', ['global', 'revision']],
    ['listSkills', ['', '']], ['readSkill', ['', '', 'review']], ['setSkillEnabled', ['', '', 'review', false]],
    ['listMcpServers', []], ['readMcpServer', ['include:browser']], ['setMcpServerEnabled', ['server', false]],
  ]) {
    await assert.rejects(async () => service[method](...args), /Only the profile owner can change Mod policies/, method);
  }
  await assert.rejects(async () => service.playSystemSound('default', true), /Only the profile owner can play system sounds/);
  await assert.rejects(async () => service.readWebSearchQuota('tavily-1'), /Only the profile owner can read web search quotas/);
  await assert.rejects(async () => service.showWindowsNotification({}), /Only the profile owner can send native notifications/);
  await assert.rejects(async () => service.clearWindowsNotifications('group', ''), /Only the profile owner can send native notifications/);
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

test('all feature configuration defaults survive composition without a settings tool', async t => {
  await fixture(t);
  const expected = {
    showVersion: false, showThemeSwitcher: false, showRefreshButton: false, showRestartButton: false,
    notificationsEnabled: false, notificationMode: 'background', notificationSoundEnabled: true, notificationSound: 'default',
    blockOfficialAccount: false, blockOfficialSearch: false, blockOfficialTelemetry: false,
    blockTodo: false, blockPlan: false, blockGoal: false, blockDoubleClickRename: false, personalizationEnabled: false,
    skillManagerEnabled: false, mcpManagerEnabled: false, disabledSkills: [],
    memoryEnabled: false, memoryAutoCapture: true, memoryGlobalEnabled: true, memoryWorkspaceEnabled: true,
    historySearchEnabled: false,
    showThinkingEffortSwitcher: false,
    thinkingEffortGlyph: 'arc',
    standalonePageEnabled: false,
    flowingBackgroundEnabled: false,
    showBackgroundShortcut: false,
    flowingBackgroundKind: 'pattern',
    flowingBackgroundOpacity: 100,
    flowingBackgroundBlur: 0,
    wallpaperEnabled: undefined,
    wallpaperSelection: undefined,
    wallpaperVisibility: undefined,
    wallpaperBlur: undefined,
    archiveManagerEnabled: false,
    autoArchiveDays: 0,
    autoArchivedSessions: [],
    projectManagerEnabled: false,
    usageStatsEnabled: false,
    searchPopupEnabled: false,
    webSearchEnabled: false,
    webSearchChain: [],
    webFetchChain: [],
  };
  assert.deepEqual(Object.keys(Config.dict).sort(), Object.keys(expected).sort());
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(Config.dict[key].meta.default, value, key);
});
