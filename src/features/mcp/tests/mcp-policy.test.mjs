import assert from 'node:assert/strict';
import { test } from 'node:test';
import { McpPolicy } from '../mcp-policy.ts';
import { OperationQueue } from '../../../shared/host/operation-queue.ts';

const MCP_CLIENT = '@deepseek-ai/dsh-mcp-client';
const SECRET = 'never-expose-this-credential';
const exactError = message => error => {
  assert.equal(error.message, message);
  assert.equal(error.cause, undefined);
  assert.ok(!String(error.stack).includes(SECRET));
  return true;
};

function fixture() {
  const rows = [
    { entryId: 'include:notes', patchId: 'notes', moduleName: MCP_CLIENT, enabled: true, fiberPhase: 'active' },
    { entryId: 'include:files', patchId: 'files', moduleName: MCP_CLIENT, enabled: false, fiberPhase: null },
    { entryId: 'dynamic', moduleName: MCP_CLIENT, enabled: true, readOnlyReason: 'unaddressable' },
    { entryId: 'protected', patchId: 'protected', moduleName: MCP_CLIENT, enabled: true, readOnlyReason: 'management-required' },
    { entryId: 'unknown-readonly', patchId: 'unknown-readonly', moduleName: MCP_CLIENT, enabled: true, readOnlyReason: 'future-native-reason' },
    { entryId: 'no-patch', moduleName: MCP_CLIENT, enabled: true },
    { entryId: 'unknown-state', patchId: 'unknown-state', moduleName: MCP_CLIENT, enabled: 'conditional' },
    { entryId: 'include:mcp-resources', patchId: 'mcp-resources', moduleName: '@deepseek-ai/dsh-mcp-resources', enabled: true },
    { entryId: 'unrelated', patchId: 'unrelated', moduleName: '@example/plugin', enabled: true },
  ];
  const compositions = [{ id: 'creator', rows: [
    { entryId: 'notes', moduleName: MCP_CLIENT, enabled: true },
    { entryId: 'optional', moduleName: MCP_CLIENT, enabled: 'conditional' },
    { entryId: null, moduleName: MCP_CLIENT, enabled: false },
    { entryId: 'resources', moduleName: '@deepseek-ai/dsh-mcp-resources', enabled: true },
  ] }];
  const bundles = [];
  const queue = new OperationQueue();
  const calls = [];
  let reads = 0;
  const ctx = { pluginManager: {
    async listPlugins() { reads++; return rows; },
    async listBundles() { return bundles; },
    async setPluginEnabled(id, enabled) {
      calls.push([id, enabled]);
      rows.find(row => row.entryId === id).enabled = enabled;
      return { application: 'applied', warnings: [] };
    },
  } };
  const policy = new McpPolicy(ctx, { ensureActive: () => queue.ensureActive() });
  policy.presets = { async compositionInventory() { return compositions; } };
  return { policy, ctx, rows, bundles, compositions, queue, calls, get reads() { return reads; } };
}

test('inventory projects only canonical servers and distinguishes writable profile rows from read-only presets', async () => {
  const app = fixture();
  const view = await app.policy.list();
  assert.equal(view.complete, true);
  assert.equal(view.servers.length, 10);
  assert.deepEqual(view.servers[0], { id: 'include:notes', name: 'notes', source: 'profile', origin: '', group: 'user', enabled: true, runtimeState: 'active', transport: 'unknown', stateKnown: true, canToggle: true, reason: '', tools: [] });
  assert.equal(view.servers.find(row => row.id === 'dynamic').reason, 'unaddressable');
  assert.equal(view.servers.find(row => row.id === 'protected').reason, 'management-required');
  for (const id of ['unknown-readonly', 'no-patch', 'unknown-state']) {
    assert.equal(view.servers.find(row => row.id === id).canToggle, false);
    assert.equal(view.servers.find(row => row.id === id).reason, 'read-only');
  }
  assert.equal(view.servers.find(row => row.id === 'unknown-state').stateKnown, false);
  assert.deepEqual(view.servers.find(row => row.id === 'preset:creator:notes'), { id: 'preset:creator:notes', name: 'notes', source: 'preset:creator', origin: 'preset:creator', group: 'builtin', enabled: true, runtimeState: 'inactive', transport: 'unknown', stateKnown: true, canToggle: false, reason: 'preset-managed', tools: [] });
  assert.deepEqual(view.servers.find(row => row.id === 'preset:creator:optional'), { id: 'preset:creator:optional', name: 'optional', source: 'preset:creator', origin: 'preset:creator', group: 'builtin', enabled: false, runtimeState: 'inactive', transport: 'unknown', stateKnown: false, canToggle: false, reason: 'conditional', tools: [] });
  assert.equal(view.servers.find(row => row.id === 'preset:creator:@2').name, 'mcp-client');
  assert.ok(!view.servers.some(row => row.name === 'resources' || row.id === 'include:mcp-resources' || row.id === 'unrelated'));
});

test('profile runtime phases remain distinct from enablement and unknown reads disclose no diagnostic', async () => {
  const app = fixture();
  const row = app.rows[0];
  for (const phase of ['pending', 'loading', 'active', 'failed', 'unloading']) {
    row.fiberPhase = phase;
    row.enabled = false;
    const actual = (await app.policy.list()).servers[0];
    assert.equal(actual.runtimeState, phase);
    assert.equal(actual.enabled, false);
    assert.equal(actual.canToggle, true);
  }
  row.fiberPhase = null;
  assert.equal((await app.policy.list()).servers[0].runtimeState, 'disabled');
  row.enabled = true;
  assert.equal((await app.policy.list()).servers[0].runtimeState, 'inactive');
  row.fiberPhase = 'future-phase';
  assert.equal((await app.policy.list()).servers[0].runtimeState, 'unknown');
  Object.defineProperty(row, 'fiberPhase', { get() { throw new Error(SECRET); } });
  const view = await app.policy.list();
  assert.equal(view.servers[0].runtimeState, 'unknown');
  assert.ok(!JSON.stringify(view).includes(SECRET));
  assert.deepEqual(app.calls, []);
});

test('profile fallback uses only exact Loader metadata and never uses tool count as runtime evidence', async () => {
  const app = fixture();
  delete app.rows[0].fiberPhase;
  const metadata = { entryId: 'include:notes', name: 'notes', tools: ['old_tool'], runtimeState: 'loading' };
  app.policy.providers = { configured: () => [metadata], presetEntries: () => [], list: () => ({ servers: [] }) };
  assert.equal((await app.policy.list()).servers[0].runtimeState, 'loading');
  metadata.runtimeState = 'inactive';
  app.rows[0].enabled = false;
  assert.equal((await app.policy.list()).servers[0].runtimeState, 'disabled');
  metadata.runtimeState = 'active';
  assert.equal((await app.policy.list()).servers[0].runtimeState, 'active');
  metadata.entryId = 'include:other';
  assert.equal((await app.policy.list()).servers[0].runtimeState, 'unknown');
  metadata.entryId = 'include:notes';
  metadata.runtimeState = 'unknown';
  assert.equal((await app.policy.list()).servers[0].runtimeState, 'unknown');
});

test('presets use each MCP row runtime state, not the enclosing preset lifecycle', async () => {
  const app = fixture();
  const notes = app.compositions[0].rows[0];
  const optional = app.compositions[0].rows[1];
  app.policy.providers = {
    presetEntries: () => [{ id: 'creator', entryId: 'include:creator', runtimeState: 'active' }],
    configured: () => [{ entryId: 'include:creator:notes', name: 'notes', runtimeState: 'loading', tools: [] }],
    list: () => ({ servers: [] }),
  };
  const state = async id => (await app.policy.list()).servers.find(row => row.id === `preset:creator:${id}`).runtimeState;
  assert.equal(await state('notes'), 'loading');
  assert.equal(await state('optional'), 'inactive');
  for (const [native, expected] of [[0, 'pending'], [1, 'loading'], [2, 'active'], [3, 'failed'], [4, 'inactive'], [5, 'unloading']]) {
    notes.fiberState = native;
    assert.equal(await state('notes'), expected);
  }
  notes.enabled = false;
  notes.fiberState = 2;
  assert.equal(await state('notes'), 'active');
  notes.fiberState = 4;
  assert.equal(await state('notes'), 'disabled');
  optional.fiberState = 99;
  assert.equal(await state('optional'), 'unknown');
  Object.defineProperty(optional, 'fiberState', { get() { throw new Error(SECRET); } });
  const view = await app.policy.list();
  assert.equal(view.servers.find(row => row.id === 'preset:creator:optional').runtimeState, 'unknown');
  assert.ok(!JSON.stringify(view).includes(SECRET));
});

test('successful changes require actual native readback and same-state requests perform no write', async () => {
  const app = fixture();
  await app.policy.setEnabled('include:notes', true);
  assert.deepEqual(app.calls, []);
  const beforeReads = app.reads;
  const after = await app.policy.setEnabled('include:notes', false);
  assert.equal(app.reads, beforeReads + 2);
  assert.deepEqual(app.calls, [['include:notes', false]]);
  assert.equal(after.servers.find(row => row.id === 'include:notes').enabled, false);
  await app.policy.setEnabled('include:notes', true);
  assert.equal(app.rows[0].enabled, true);
  assert.equal(app.rows[1].enabled, false);
});

test('read-only, preset, unknown, invalid and incomplete requests cannot enter native writes', async () => {
  const app = fixture();
  for (const id of ['dynamic', 'protected', 'unknown-readonly', 'no-patch', 'unknown-state', 'preset:creator:notes', 'unknown', 'include:mcp-resources']) {
    await assert.rejects(app.policy.setEnabled(id, false), exactError('mcpUnavailable'));
  }
  for (const [id, enabled] of [['', false], [null, false], [42, true], ['include:notes', 'false'], ['include:notes', 1]]) {
    await assert.rejects(app.policy.setEnabled(id, enabled), exactError('mcpChangeFailed'));
  }
  app.policy.presets = null;
  const incomplete = await app.policy.list();
  assert.equal(incomplete.complete, false);
  assert.ok(incomplete.servers.every(row => !row.canToggle));
  await assert.rejects(app.policy.setEnabled('include:notes', false), exactError('mcpUnavailable'));
  assert.deepEqual(app.calls, []);
});

test('native outcomes always read back, including persisted failures, and use safe localized keys', async () => {
  const cases = [
    [{ application: 'applied', warnings: [SECRET] }, 'mcpChangeUncertain'],
    [{ application: 'applied', warnings: SECRET }, 'mcpChangeUncertain'],
    [{ application: 'restart-required', restartReason: SECRET }, 'mcpRestartRequired'],
    [{ application: 'overridden', error: { diagnostic: SECRET } }, 'mcpChangeOverridden'],
    [{ application: 'failed', changed: true, error: { diagnostic: SECRET, code: SECRET } }, 'mcpChangeFailed'],
    [{ application: 'cancelled', error: { diagnostic: SECRET } }, 'mcpChangeFailed'],
    [{ application: 'future-result', diagnostic: SECRET }, 'mcpChangeUncertain'],
    [undefined, 'mcpChangeUncertain'],
  ];
  for (const [result, key] of cases) {
    const app = fixture();
    app.ctx.pluginManager.setPluginEnabled = async (id, enabled) => {
      app.calls.push([id, enabled]);
      app.rows[0].enabled = enabled;
      return result;
    };
    await assert.rejects(app.policy.setEnabled('include:notes', false), exactError(key));
    assert.equal(app.reads, 2);
    assert.equal(app.rows[0].enabled, false);
    assert.deepEqual(app.calls, [['include:notes', false]]);
  }
});

test('applied result without matching actual state is rejected; disappearing rows are unavailable', async () => {
  const app = fixture();
  app.ctx.pluginManager.setPluginEnabled = async () => ({ application: 'applied', warnings: [] });
  await assert.rejects(app.policy.setEnabled('include:notes', false), exactError('mcpChangeOverridden'));
  assert.equal(app.reads, 2);
  app.ctx.pluginManager.setPluginEnabled = async () => {
    app.rows.splice(0, 1);
    return { application: 'applied' };
  };
  await assert.rejects(app.policy.setEnabled('include:notes', false), exactError('mcpUnavailable'));
});

test('query failures and thrown writes never expose native diagnostics, and thrown writes still read back', async () => {
  const app = fixture();
  app.ctx.pluginManager.setPluginEnabled = async () => { app.rows[0].enabled = false; throw new Error(SECRET); };
  await assert.rejects(app.policy.setEnabled('include:notes', false), exactError('mcpChangeFailed'));
  assert.equal(app.reads, 2);
  app.ctx.pluginManager.listPlugins = async () => { throw new Error(SECRET); };
  await assert.rejects(app.policy.list(), exactError('mcpPluginsLoadFailed'));
  const presetFailure = fixture();
  presetFailure.policy.presets.compositionInventory = async () => { throw new Error(SECRET); };
  await assert.rejects(presetFailure.policy.list(), exactError('mcpPresetsLoadFailed'));
  const readbackFailure = fixture();
  readbackFailure.ctx.pluginManager.setPluginEnabled = async () => {
    readbackFailure.ctx.pluginManager.listPlugins = async () => { throw new Error(SECRET); };
    return { application: 'failed', changed: true };
  };
  await assert.rejects(readbackFailure.policy.setEnabled('include:notes', false), exactError('mcpChangeUncertain'));
});

test('credentials and resolved configuration are neither inspected nor returned', async () => {
  const app = fixture();
  for (const row of [...app.rows, ...app.compositions[0].rows]) {
    for (const field of ['config', 'effectiveConfig', 'env', 'headers', 'url', 'args', 'diagnostic', 'fiberPhase']) {
      Object.defineProperty(row, field, { enumerable: true, get() { throw new Error(`${SECRET}:${field}`); } });
    }
  }
  const result = await app.policy.setEnabled('include:notes', false);
  assert.ok(!JSON.stringify(result).includes(SECRET));
  const fields = ['id', 'name', 'source', 'origin', 'group', 'enabled', 'runtimeState', 'stateKnown', 'canToggle', 'reason', 'tools', 'transport'].sort();
  for (const row of result.servers) assert.deepEqual(Object.keys(row).sort(), fields);
});

test('unload before, during discovery, and during native writes stops further work', async () => {
  const closed = fixture();
  closed.queue.close();
  await assert.rejects(closed.policy.list(), { code: 'mod/unloaded' });
  await assert.rejects(closed.policy.setEnabled('include:notes', false), { code: 'mod/unloaded' });
  assert.equal(closed.reads, 0);
  const duringRead = fixture();
  duringRead.policy.presets.compositionInventory = async () => { duringRead.queue.close(); return duringRead.compositions; };
  await assert.rejects(duringRead.policy.setEnabled('include:notes', false), { code: 'mod/unloaded' });
  assert.deepEqual(duringRead.calls, []);
  const duringWrite = fixture();
  const native = duringWrite.ctx.pluginManager.setPluginEnabled;
  duringWrite.ctx.pluginManager.setPluginEnabled = async (...args) => {
    const result = await native(...args);
    duringWrite.queue.close();
    return result;
  };
  await assert.rejects(duringWrite.policy.setEnabled('include:notes', false), { code: 'mod/unloaded' });
  assert.deepEqual(duringWrite.calls, [['include:notes', false]]);
  assert.equal(duringWrite.reads, 1);
});

test('global user and builtin groups follow bundle ownership, not module names or user overrides', async () => {
  const app = fixture();
  app.bundles.push({ name: '@example/mcp-provider', enabled: true, rows: [
    { entryId: 'include:files', rowId: 'files', moduleName: MCP_CLIENT },
  ], overrides: ['notes'] });
  app.bundles.push({ name: '@example/disabled', enabled: false, rows: [
    { entryId: 'include:notes', moduleName: MCP_CLIENT },
  ] });
  const view = await app.policy.list();
  assert.deepEqual(Object.keys(view).sort(), ['complete', 'servers']);
  assert.equal(view.servers.find(row => row.id === 'include:notes').group, 'user');
  const bundled = view.servers.find(row => row.id === 'include:files');
  assert.equal(bundled.group, 'builtin');
  assert.equal(bundled.origin, '@example/mcp-provider');
  assert.equal(bundled.canToggle, true);
  assert.equal(view.servers.find(row => row.source === 'preset:creator').group, 'builtin');
  app.ctx.pluginManager.listBundles = async () => { throw new Error(SECRET); };
  await assert.rejects(app.policy.list(), exactError('mcpBundlesLoadFailed'));
});

test('overlapping bundle declarations preserve MCP rows, native write targets and builtin classification', async () => {
  const app = fixture();
  app.policy.providers = {
    presetEntries: () => [{ id: 'creator', entryId: 'include:creator' }],
    configured: () => [], list: () => ({ servers: [] }),
  };
  const rows = [
    { entryId: 'include:notes', moduleName: MCP_CLIENT },
    { entryId: 'include:creator', moduleName: '@deepseek-ai/dsh-agent-preset' },
  ];
  app.bundles.push({ name: '@example/first', enabled: true, rows: [...rows, ...rows] });
  let view = await app.policy.list();
  assert.equal(view.servers.find(row => row.id === 'include:notes').origin, '@example/first');
  for (const name of ['@example/second', '@example/third', '@example/first']) {
    app.bundles.push({ name, enabled: true, rows });
  }
  view = await app.policy.list();
  assert.equal(view.complete, true);
  assert.equal(view.servers.filter(row => row.id === 'include:notes').length, 1);
  const profile = view.servers.find(row => row.id === 'include:notes');
  assert.equal(profile.group, 'builtin');
  assert.equal(profile.origin, '');
  assert.equal(profile.canToggle, true, 'Native patch addressability still decides writes.');
  const preset = view.servers.find(row => row.id === 'preset:creator:notes');
  assert.equal(preset.group, 'builtin');
  assert.equal(preset.origin, 'preset:creator');
  assert.equal(preset.canToggle, false);
  await app.policy.setEnabled(profile.id, false);
  assert.deepEqual(app.calls, [['include:notes', false]]);
  const after = await app.policy.list();
  assert.equal(after.servers.find(row => row.id === profile.id).enabled, false);
  assert.equal(after.servers.find(row => row.id === 'include:files').group, 'user');
});

test('provider and metadata errors identify their stage without leaking native errors or permitting writes', async () => {
  for (const stage of ['providers', 'metadata']) {
    const app = fixture();
    app.policy.providers = {
      list: () => { if (stage === 'providers') throw new Error(SECRET); return { servers: [] }; },
      presetEntries: () => [],
      configured: () => { throw new Error(SECRET); },
    };
    const key = stage === 'providers' ? 'mcpProvidersLoadFailed' : 'mcpMetadataLoadFailed';
    await assert.rejects(app.policy.list(), exactError(key));
    await assert.rejects(app.policy.setEnabled('include:notes', false), exactError(key));
    assert.deepEqual(app.calls, []);
  }
  const stale = fixture();
  stale.policy.providers = { ready: Promise.resolve(), closed: true };
  await assert.rejects(stale.policy.list(), exactError('mcpUnavailable'));
});

test('project and file-declaration sources cannot enter global native writes', async () => {
  const app = fixture();
  const rows = ['project', 'project-file'].map((source, index) => ({
    id: `runtime:${index}`, name: 'scoped', source, origin: '', group: 'builtin',
    enabled: true, runtimeState: 'active', stateKnown: true, canToggle: true, reason: '', tools: [],
  }));
  app.policy.providers = { list: () => ({ servers: rows }), configured: () => [], presetEntries: () => [] };
  for (const row of rows) await assert.rejects(app.policy.setEnabled(row.id, false), exactError('mcpUnavailable'));
  assert.deepEqual(app.calls, []);
});

test('unavailable provider generations and unload during initialization prevent writes', async () => {
  const app = fixture();
  app.policy.providers = { ready: Promise.reject(new Error(SECRET)) };
  await assert.rejects(app.policy.list(), exactError('mcpProviderInitFailed'));
  const closed = fixture();
  closed.policy.providers = { ready: Promise.resolve().then(() => { closed.queue.close(); }) };
  await assert.rejects(closed.policy.setEnabled('include:notes', false), { code: 'mod/unloaded' });
  assert.deepEqual(closed.calls, []);
});

test('native server names replace Loader labels without changing the persistent switch target', async () => {
  const app = fixture();
  app.policy.providers = {
    presetEntries: () => [],
    configured: () => [{ entryId: 'include:notes', name: 'actual-server', uid: 7 }],
    list: () => ({ servers: [] }),
  };
  const row = (await app.policy.list()).servers.find(row => row.id === 'include:notes');
  assert.equal(row.name, 'actual-server');
  assert.equal(row.source, 'profile');
  await app.policy.setEnabled(row.id, false);
  assert.deepEqual(app.calls, [['include:notes', false]]);
});

test('user-configured native presets are not relabeled as builtin; bundled presets retain their actual package', async () => {
  const app = fixture();
  app.policy.providers = {
    presetEntries: () => [{ id: 'creator', entryId: 'include:my-custom-mode' }], configured: () => [],
    list: () => ({ servers: [] }),
  };
  let row = (await app.policy.list()).servers.find(row => row.id === 'preset:creator:notes');
  assert.equal(row.group, 'user');
  assert.equal(row.origin, 'preset:creator');
  app.bundles.push({ name: '@example/mode', enabled: true, rows: [
    { entryId: 'include:my-custom-mode', moduleName: '@deepseek-ai/dsh-agent-preset' },
  ] });
  row = (await app.policy.list()).servers.find(row => row.id === 'preset:creator:notes');
  assert.equal(row.group, 'builtin');
  assert.equal(row.origin, '@example/mode');
  assert.equal(row.canToggle, false);
});

test('transport metadata stays attached to exact profile and preset instances, including disabled entries', async () => {
  const app = fixture();
  const metadata = [
    { entryId: 'include:notes', transport: 'stdio' },
    { entryId: 'include:files', transport: 'streamable-http' },
    { entryId: 'include:my-mode:notes', transport: 'streamable-http' },
  ];
  app.policy.providers = {
    configured: () => metadata,
    presetEntries: () => [{ id: 'creator', entryId: 'include:my-mode' }],
    list: () => ({ servers: [] }),
  };
  const rows = (await app.policy.list()).servers;
  assert.equal(rows.find(row => row.id === 'include:notes').transport, 'stdio');
  assert.equal(rows.find(row => row.id === 'include:files').transport, 'streamable-http');
  assert.equal(rows.find(row => row.id === 'preset:creator:notes').transport, 'streamable-http');
  assert.equal(rows.find(row => row.id === 'preset:creator:optional').transport, 'unknown');
  metadata[0].transport = SECRET;
  const after = await app.policy.list();
  assert.equal(after.servers.find(row => row.id === 'include:notes').transport, 'unknown');
  assert.ok(!JSON.stringify(after).includes(SECRET));
  assert.deepEqual(app.calls, []);
});

test('native manager entries use their Settings control rather than the profile plugin switch', async () => {
  const app = fixture();
  const row = { id: 'manager:user', name: 'managed', source: 'manager', origin: 'mcp-manager', group: 'user',
    enabled: true, runtimeState: 'unknown', stateKnown: true, canToggle: true, reason: '' };
  const changes = [];
  app.policy.providers = {
    presetEntries: () => [], configured: () => [],
    list: async () => ({ complete: true, servers: [row] }),
    async setEnabled(id, enabled) { changes.push([id, enabled]); row.enabled = enabled; },
  };
  const result = await app.policy.setEnabled(row.id, false);
  assert.equal(result.servers.find(server => server.id === row.id).enabled, false);
  assert.deepEqual(changes, [[row.id, false]]);
  assert.deepEqual(app.calls, []);
  app.policy.providers.setEnabled = async () => { throw new Error(SECRET); };
  await assert.rejects(app.policy.setEnabled(row.id, true), exactError('mcpChangeFailed'));
});

test('MCP detail reports only the fields an entry declares and never exposes credential values', async () => {
  const app = fixture();
  app.policy.providers = {
    presetEntries: () => [],
    configured: () => [],
    list: () => ({ servers: [] }),
    declared(id) {
      if (id !== 'include:notes') return undefined;
      return {
        serverName: 'notes', transport: 'stdio', command: 'npx', args: ['-y', 'server', '--api-key', SECRET], cwd: '/work/notes',
        env: { GITHUB_TOKEN: SECRET, OTHER: SECRET }, toolCallTimeoutMs: 60000,
        reconnect: { enabled: true, initialDelayMs: 500, maxDelayMs: 30000, maxAttempts: 10 },
      };
    },
  };
  const detail = await app.policy.read('include:notes');
  assert.equal(detail.server.id, 'include:notes');
  // Defaults the entry did not write (toolCallTimeoutMs, failOnStartupError, ...) stay out.
  assert.deepEqual(detail.config, {
    transport: 'stdio', serverName: 'notes', command: 'npx', argsHidden: true, cwd: '/work/notes',
    envKeys: ['GITHUB_TOKEN', 'OTHER'], headerKeys: [], expressions: [], urlQueryHidden: false,
    reconnect: { enabled: true, initialDelayMs: 500, maxDelayMs: 30000, maxAttempts: 10 },
  });
  assert.ok(!JSON.stringify(detail).includes(SECRET));
  assert.equal(await app.policy.read('include:missing'), null, 'An unknown id returns no row.');
  assert.equal((await app.policy.read('include:files')).config, null, 'A row without declared configuration reports none.');
  await assert.rejects(app.policy.read(''), /mcpUnavailable/);
  assert.deepEqual(app.calls, []);
});

test('MCP detail hides expression fields and endpoint credentials while keeping key names', async () => {
  const app = fixture();
  app.policy.providers = {
    presetEntries: () => [], configured: () => [], list: () => ({ servers: [] }),
    declared: () => ({
      serverName: 'web', transport: 'streamable-http',
      url: 'https://mcp.example.com/mcp?token=' + SECRET + '#fragment',
      headers: { Authorization: 'Bearer ' + SECRET },
      command: { __jsExpr: 'process.env.SECRET' },
      cwd: { __jsExpr: '1 + 1' },
    }),
  };
  const detail = await app.policy.read('include:notes');
  assert.equal(detail.config.url, 'https://mcp.example.com');
  assert.equal(detail.config.urlQueryHidden, true);
  assert.deepEqual(detail.config.headerKeys, ['Authorization']);
  assert.deepEqual(detail.config.expressions, ['command', 'cwd']);
  assert.equal(detail.config.command, undefined, 'An expression field reports its name, never its text.');
  assert.equal(detail.config.cwd, undefined);
  assert.ok(!JSON.stringify(detail).includes(SECRET));
  app.policy.providers.declared = () => { throw new Error(SECRET); };
  await assert.rejects(app.policy.read('include:notes'), exactError('mcpMetadataLoadFailed'));
});

test('MCP detail preserves partial declared reconnect policies without synthesizing defaults', async () => {
  const app = fixture();
  let reconnect;
  app.policy.providers = {
    presetEntries: () => [], configured: () => [], list: () => ({ servers: [] }),
    declared: () => ({ transport: 'stdio', reconnect }),
  };
  for (const value of [{ enabled: true }, { maxAttempts: 3 }, { enabled: false, initialDelayMs: 750 }, { maxDelayMs: 9000 }]) {
    reconnect = value;
    assert.deepEqual((await app.policy.read('include:notes')).config.reconnect, value);
  }
  for (const value of [undefined, {}, { initialDelayMs: { __jsExpr: 'private' } }]) {
    reconnect = value;
    assert.equal((await app.policy.read('include:notes')).config.reconnect, undefined);
  }
  assert.deepEqual(app.calls, []);
});

test('MCP detail removes URL credentials and paths and omits unreadable endpoints', async () => {
  const app = fixture();
  let url;
  app.policy.providers = {
    presetEntries: () => [], configured: () => [], list: () => ({ servers: [] }),
    declared: () => ({ transport: 'streamable-http', url }),
  };
  for (const value of [
    `https://user:${SECRET}@mcp.example.com:8443/mcp`,
    `https://${SECRET}@mcp.example.com:8443/mcp?token=${SECRET}#${SECRET}`,
    `https://user%40host:${SECRET}%3Asecret@mcp.example.com:8443/mcp`,
    `https://mcp.example.com:8443/mcp/${SECRET}`,
  ]) {
    url = value;
    const detail = await app.policy.read('include:notes');
    assert.equal(detail.config.url, 'https://mcp.example.com:8443');
    assert.equal(detail.config.urlQueryHidden, true);
    assert.ok(!JSON.stringify(detail).includes(SECRET));
  }
  for (const value of [`https://user:${SECRET}@[invalid/mcp`, `data:text/plain,${SECRET}`, `//user:${SECRET}@example.com/mcp`]) {
    url = value;
    const detail = await app.policy.read('include:notes');
    assert.equal(detail.config.url, undefined);
    assert.equal(detail.config.urlQueryHidden, true);
    assert.ok(!JSON.stringify(detail).includes(SECRET));
  }
  url = 'http://mcp.example.com';
  const safe = await app.policy.read('include:notes');
  assert.equal(safe.config.url, url);
  assert.equal(safe.config.urlQueryHidden, false);
  assert.deepEqual(app.calls, []);
});
