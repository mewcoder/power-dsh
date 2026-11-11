import { errorMessage, type NativeContext, type NativePlugin, type NativePresets, type NativeComposition, type LifecycleOptions } from '../../shared/host/native.ts';
import { isOneOf } from '../../shared/types/protocol.ts';
import type { McpCatalog, McpServer, McpRuntimeState } from './rpc.ts';
import type { McpServerDetail } from '../../shared/types/wire.ts';
import { projectMcpConfig } from './mcp-config.ts';
import type { McpProviders, ConfiguredMcp } from './mcp-providers.ts';
type Bundle = Awaited<ReturnType<NativeContext['pluginManager']['listBundles']>>[number];
const MCP_CLIENT = '@deepseek-ai/dsh-mcp-client';

function failure(key: string) { return new Error(key); }
function identifier(value: unknown): value is string { return typeof value === 'string' && value.length > 0; }
const FIBER_STATES = ['pending', 'loading', 'active', 'failed', 'inactive', 'unloading'] as const;

/** Preserve the row's own observed lifecycle; disabled is only derived from a confirmed absent/disposed instance. */
function runtimeState(row: { fiberState?: number; fiberPhase?: string | null; enabled: boolean | string }, metadata: ConfiguredMcp | undefined, preset = false): McpRuntimeState {
  let state: McpRuntimeState = 'unknown';
  try {
    const phase = preset ? row.fiberState : row.fiberPhase;
    if (preset && typeof phase === 'number' && Number.isInteger(phase) && phase >= 0 && phase < FIBER_STATES.length) state = FIBER_STATES[phase as number];
    else if (!preset && isOneOf(phase, ['pending', 'loading', 'active', 'failed', 'unloading'])) state = phase;
    else if (metadata && [...FIBER_STATES, 'unknown'].includes(metadata.runtimeState)) state = metadata.runtimeState;
    // Inventory null is no live root. Preset declarations omit fiberState until that exact row has a live mount.
    else if (!preset && phase === null || preset && phase === undefined) state = 'inactive';
  } catch { state = 'unknown'; }
  return state === 'inactive' && row.enabled === false ? 'disabled' : state;
}

function bundleOrigins(bundles: Bundle[]) {
  if (!Array.isArray(bundles)) throw failure('mcpLoadFailed');
  const origins = new Map<string, string>();
  for (const bundle of bundles) {
    if (bundle?.enabled !== true) continue;
    if (!identifier(bundle.name) || !Array.isArray(bundle.rows)) throw failure('mcpLoadFailed');
    for (const row of bundle.rows) {
      if (![MCP_CLIENT, '@deepseek-ai/dsh-agent-preset'].includes(row?.moduleName) || !identifier(row.entryId)) continue;
      // Different bundles may legally insert the same Loader id. Keep its
      // builtin classification, but omit an origin we cannot uniquely confirm.
      if (!origins.has(row.entryId)) origins.set(row.entryId, bundle.name);
      else if (origins.get(row.entryId) !== bundle.name) origins.set(row.entryId, '');
    }
  }
  return origins;
}

// Only native inventory fields cross the RPC boundary; MCP configuration may contain credentials.
function profileServers(entries: NativePlugin[], complete: boolean, origins: Map<string, string>, configured: ConfiguredMcp[]): McpServer[] {
  if (!Array.isArray(entries)) throw failure('mcpLoadFailed');
  return entries.filter(row => row?.moduleName === MCP_CLIENT).map(row => {
    if (!identifier(row.entryId)) throw failure('mcpLoadFailed');
    const stateKnown = typeof row.enabled === 'boolean';
    const addressable = stateKnown && identifier(row.patchId) && !row.readOnlyReason;
    const reason = isOneOf(row.readOnlyReason, ['unaddressable', 'management-required']) ? row.readOnlyReason : 'read-only';
    const canToggle = complete && addressable;
    const origin = origins.get(row.entryId) ?? '';
    const metadata = configured.find(entry => entry.entryId === row.entryId);
    return {
      id: row.entryId,
      name: metadata?.name || row.entryId.replace(/^include:/, ''),
      tools: row.enabled === true ? metadata?.tools ?? [] : [],
      transport: metadata && isOneOf(metadata.transport, ['stdio', 'streamable-http']) ? metadata.transport : 'unknown',
      source: 'profile',
      origin,
      group: origins.has(row.entryId) ? 'builtin' : 'user',
      enabled: row.enabled === true,
      runtimeState: runtimeState(row, metadata),
      stateKnown,
      canToggle,
      reason: canToggle ? '' : addressable ? 'incomplete' : reason,
    };
  });
}

function presetServers(compositions: NativeComposition[], entries: { id: string; entryId: string }[], origins: Map<string, string>, configured: ConfiguredMcp[]): McpServer[] {
  if (!Array.isArray(compositions)) throw failure('mcpLoadFailed');
  return compositions.flatMap(preset => {
    if (!identifier(preset?.id) || !Array.isArray(preset.rows)) throw failure('mcpLoadFailed');
    const entry = entries.find(row => row.id === preset.id);
    const origin = entry ? origins.get(entry.entryId) : '';
    const group = entry && !origins.has(entry.entryId) ? 'user' : 'builtin';
    return preset.rows.flatMap((row, index) => {
      if (row?.moduleName !== MCP_CLIENT) return [];
      const metadata = entry ? configured.find(item => item.entryId === `${entry.entryId}:${row.entryId}`) : undefined;
      const name = metadata?.name || (identifier(row.entryId) ? row.entryId : 'mcp-client');
      return [{
        id: `preset:${preset.id}:${identifier(row.entryId) ? row.entryId : `@${index}`}`,
        name,
        tools: row.enabled === true ? metadata?.tools ?? [] : [],
        transport: metadata && isOneOf(metadata.transport, ['stdio', 'streamable-http']) ? metadata.transport : 'unknown',
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
  ctx: NativeContext;
  ensureActive: () => void;
  presets: NativePresets | null;
  providers: McpProviders | null;
  constructor(ctx: NativeContext, { ensureActive = () => {} }: LifecycleOptions = {}) {
    this.ctx = ctx; this.ensureActive = ensureActive;
    this.presets = null;
    this.providers = null;
  }

  async providerContext() {
    this.ensureActive();
    const manager = this.providers;
    if (!manager) return null;
    try { await manager.ready; }
    catch {
      this.ensureActive();
      throw failure('mcpProviderInitFailed');
    }
    this.ensureActive();
    if (manager.closed || this.providers !== manager) throw failure('mcpUnavailable');
    return manager;
  }

  async list(): Promise<McpCatalog> {
    this.ensureActive();
    const manager = await this.providerContext();
    let entries, bundles;
    try { entries = await this.ctx.pluginManager.listPlugins(); }
    catch { this.ensureActive(); throw failure('mcpPluginsLoadFailed'); }
    this.ensureActive();
    try { bundles = await this.ctx.pluginManager.listBundles(); }
    catch { this.ensureActive(); throw failure('mcpBundlesLoadFailed'); }
    this.ensureActive();
    const presets = this.presets;
    let compositions: NativeComposition[] = [];
    if (presets !== null) {
      try { compositions = await presets.compositionInventory(); }
      catch { this.ensureActive(); throw failure('mcpPresetsLoadFailed'); }
      this.ensureActive();
    }
    let provided;
    try { provided = manager ? await manager.list() : { servers: [] }; }
    catch { this.ensureActive(); throw failure('mcpProvidersLoadFailed'); }
    this.ensureActive();
    let servers;
    try {
      const origins = bundleOrigins(bundles);
      const presetEntries = manager ? manager.presetEntries() : [];
      const configured = manager ? manager.configured() : [];
      servers = [...profileServers(entries, presets !== null, origins, configured), ...presetServers(compositions, presetEntries, origins, configured), ...provided.servers];
    }
    catch { this.ensureActive(); throw failure('mcpMetadataLoadFailed'); }
    this.ensureActive();
    return { complete: presets !== null, servers };
  }

  /**
   * Read one server's declared configuration for the detail dialog.
   *
   * The catalog row and its configuration are read in the same pass, so a
   * stale id cannot pair a current row with another entry's configuration.
   * @param id - projected server id from the catalog.
   * @returns the row plus its display-only configuration, or null when absent.
   */
  async read(id: string): Promise<McpServerDetail | null> {
    if (!identifier(id)) throw new TypeError('mcpUnavailable');
    this.ensureActive();
    const catalog = await this.list();
    this.ensureActive();
    const server = catalog.servers.find(row => row.id === id);
    if (!server) return null;
    const manager = await this.providerContext();
    let raw: unknown;
    try {
      raw = server.source === 'profile' || server.source.startsWith('preset:')
        ? manager?.declared(server.id) ?? null
        : manager?.configFor(server.id) ?? null;
    } catch { this.ensureActive(); throw failure('mcpMetadataLoadFailed'); }
    this.ensureActive();
    return { server, config: projectMcpConfig(raw, server.transport) };
  }

  async setEnabled(id: string, enabled: boolean) {
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
        throw failure(['mcpUnavailable', 'mcpChangeFailed', 'mcpChangeUncertain', 'mcpChangeOverridden'].includes(errorMessage(error))
          ? errorMessage(error) : 'mcpChangeFailed');
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
