const MCP_CLIENT = '@deepseek-ai/dsh-mcp-client';

function failure(key) { return new Error(key); }
function identifier(value) { return typeof value === 'string' && value.length > 0; }
const FIBER_STATES = ['pending', 'loading', 'active', 'failed', 'inactive', 'unloading'];

/** Preserve the row's own observed lifecycle; disabled is only derived from a confirmed absent/disposed instance. */
function runtimeState(row, metadata, preset = false) {
  let state = 'unknown';
  try {
    const phase = preset ? row.fiberState : row.fiberPhase;
    if (preset && Number.isInteger(phase) && phase >= 0 && phase < FIBER_STATES.length) state = FIBER_STATES[phase];
    else if (!preset && ['pending', 'loading', 'active', 'failed', 'unloading'].includes(phase)) state = phase;
    else if (metadata && [...FIBER_STATES, 'unknown'].includes(metadata.runtimeState)) state = metadata.runtimeState;
    // Inventory null is no live root. Preset declarations omit fiberState until that exact row has a live mount.
    else if (!preset && phase === null || preset && phase === undefined) state = 'inactive';
  } catch { state = 'unknown'; }
  return state === 'inactive' && row.enabled === false ? 'disabled' : state;
}

function bundleOrigins(bundles) {
  if (!Array.isArray(bundles)) throw failure('mcpLoadFailed');
  const origins = new Map();
  for (const bundle of bundles) {
    if (bundle?.enabled !== true) continue;
    if (!identifier(bundle.name) || !Array.isArray(bundle.rows)) throw failure('mcpLoadFailed');
    for (const row of bundle.rows) {
      if (![MCP_CLIENT, '@deepseek-ai/dsh-agent-preset'].includes(row?.moduleName) || !identifier(row.entryId)) continue;
      if (origins.has(row.entryId)) throw failure('mcpLoadFailed');
      origins.set(row.entryId, bundle.name);
    }
  }
  return origins;
}

// Only native inventory fields cross the RPC boundary; MCP configuration may contain credentials.
function profileServers(entries, complete, origins, configured) {
  if (!Array.isArray(entries)) throw failure('mcpLoadFailed');
  return entries.filter(row => row?.moduleName === MCP_CLIENT).map(row => {
    if (!identifier(row.entryId)) throw failure('mcpLoadFailed');
    const stateKnown = typeof row.enabled === 'boolean';
    const addressable = stateKnown && identifier(row.patchId) && !row.readOnlyReason;
    const reason = ['unaddressable', 'management-required'].includes(row.readOnlyReason) ? row.readOnlyReason : 'read-only';
    const canToggle = complete && addressable;
    const origin = origins.get(row.entryId) ?? '';
    const metadata = configured.find(entry => entry.entryId === row.entryId);
    return {
      id: row.entryId,
      name: metadata?.name || row.entryId.replace(/^include:/, ''),
      tools: row.enabled === true ? metadata?.tools ?? [] : [],
      transport: ['stdio', 'streamable-http'].includes(metadata?.transport) ? metadata.transport : 'unknown',
      source: 'profile',
      origin,
      group: origin ? 'builtin' : 'user',
      enabled: row.enabled === true,
      runtimeState: runtimeState(row, metadata),
      stateKnown,
      canToggle,
      reason: canToggle ? '' : addressable ? 'incomplete' : reason,
    };
  });
}

function presetServers(compositions, entries, origins, configured) {
  if (!Array.isArray(compositions)) throw failure('mcpLoadFailed');
  return compositions.flatMap(preset => {
    if (!identifier(preset?.id) || !Array.isArray(preset.rows)) throw failure('mcpLoadFailed');
    const entry = entries.find(row => row.id === preset.id);
    const origin = entry ? origins.get(entry.entryId) : '';
    const group = entry && !origin ? 'user' : 'builtin';
    return preset.rows.flatMap((row, index) => {
      if (row?.moduleName !== MCP_CLIENT) return [];
      const metadata = entry && configured.find(item => item.entryId === `${entry.entryId}:${row.entryId}`);
      const name = metadata?.name || (identifier(row.entryId) ? row.entryId : 'mcp-client');
      return [{
        id: `preset:${preset.id}:${identifier(row.entryId) ? row.entryId : `@${index}`}`,
        name,
        tools: row.enabled === true ? metadata?.tools ?? [] : [],
        transport: ['stdio', 'streamable-http'].includes(metadata?.transport) ? metadata.transport : 'unknown',
        source: `preset:${preset.id}`,
        origin: origin || `preset:${preset.id}`,
        group,
        enabled: row.enabled === true,
        runtimeState: runtimeState(row, metadata, true),
        stateKnown: typeof row.enabled === 'boolean',
        canToggle: false,
        reason: row.enabled === 'conditional' ? 'conditional' : 'preset-managed',
      }];
    });
  });
}

export class McpPolicy {
  constructor(ctx, { ensureActive = () => {} } = {}) {
    Object.assign(this, { ctx, ensureActive });
    this.presets = null;
    this.providers = null;
  }

  async providerContext() {
    this.ensureActive();
    const manager = this.providers;
    if (!manager) return null;
    try {
      await manager.ready;
      this.ensureActive();
      if (manager.closed || this.providers !== manager) throw failure('mcpUnavailable');
      return manager;
    } catch {
      this.ensureActive();
      throw failure('mcpUnavailable');
    }
  }

  async list() {
    this.ensureActive();
    const manager = await this.providerContext();
    let entries, bundles;
    try {
      entries = await this.ctx.pluginManager.listPlugins();
      this.ensureActive();
      bundles = await this.ctx.pluginManager.listBundles();
    } catch { this.ensureActive(); throw failure('mcpLoadFailed'); }
    this.ensureActive();
    const presets = this.presets;
    let compositions = [];
    if (presets !== null) {
      try { compositions = await presets.compositionInventory(); }
      catch { this.ensureActive(); throw failure('mcpLoadFailed'); }
      this.ensureActive();
    }
    let servers;
    try {
      const provided = manager ? await manager.list() : { servers: [] };
      const origins = bundleOrigins(bundles);
      const presetEntries = manager ? manager.presetEntries() : [];
      const configured = manager ? manager.configured() : [];
      servers = [...profileServers(entries, presets !== null, origins, configured), ...presetServers(compositions, presetEntries, origins, configured), ...provided.servers];
    }
    catch { this.ensureActive(); throw failure('mcpLoadFailed'); }
    this.ensureActive();
    return { complete: presets !== null, servers };
  }

  async setEnabled(id, enabled) {
    if (!identifier(id) || typeof enabled !== 'boolean') throw new TypeError('mcpChangeFailed');
    this.ensureActive();
    const before = await this.list();
    this.ensureActive();
    const row = before.servers.find(server => server.id === id && ['profile', 'manager'].includes(server.source));
    if (!before.complete || !row?.canToggle) throw failure('mcpUnavailable');
    if (row.enabled === enabled) return before;
    if (row.source === 'manager') {
      const provider = this.providers;
      if (!provider) throw failure('mcpUnavailable');
      try { await provider.setEnabled(id, enabled); }
      catch (error) {
        this.ensureActive();
        throw failure(['mcpUnavailable', 'mcpChangeFailed', 'mcpChangeUncertain', 'mcpChangeOverridden'].includes(error.message)
          ? error.message : 'mcpChangeFailed');
      }
      this.ensureActive();
      return this.list();
    }

    let result;
    let rejected = false;
    this.ensureActive();
    try { result = await this.ctx.pluginManager.setPluginEnabled(row.id, enabled); }
    catch { rejected = true; }
    this.ensureActive();
    // Native failures can persist a change before activation fails. Always inspect the actual state.
    let after;
    try { after = await this.list(); }
    catch { this.ensureActive(); throw failure('mcpChangeUncertain'); }
    this.ensureActive();
    if (rejected) throw failure('mcpChangeFailed');
    if (result?.application === 'restart-required') throw failure('mcpRestartRequired');
    if (result?.application === 'overridden') throw failure('mcpChangeOverridden');
    if (result?.application === 'failed' || result?.application === 'cancelled') throw failure('mcpChangeFailed');
    if (result?.application !== 'applied' || (result.warnings !== undefined && (!Array.isArray(result.warnings) || result.warnings.length))) {
      throw failure('mcpChangeUncertain');
    }
    const actual = after.servers.find(server => server.id === id && server.source === 'profile');
    if (!actual?.stateKnown || !actual.canToggle) throw failure('mcpUnavailable');
    if (actual.enabled !== enabled) throw failure('mcpChangeOverridden');
    return after;
  }
}
