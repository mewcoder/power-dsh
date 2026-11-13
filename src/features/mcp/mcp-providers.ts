import type { NativeContext, NativeFiber, NativePayload, LifecycleOptions } from '../../shared/host/native.ts';
import type { McpServer, McpRuntimeState, McpTransport, McpConnection, McpProbe } from './rpc.ts';
import { isOneOf, isRecord } from '../../shared/types/protocol.ts';
import { sanitizeDiagnosticText } from '../../shared/types/diagnostics.ts';
export interface ConfiguredMcp { entryId: string; uid?: number; name: string; tools: string[]; runtimeState: McpRuntimeState; transport: McpTransport; connection?: McpConnection }
interface ManagedTarget { id: string; name: string; namespace: string; owner: NativeFiber | undefined; enabled: boolean }
const MCP_CLIENT = '@deepseek-ai/dsh-mcp-client';
const identifier = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const failure = (key: string) => new Error(key);
const FIBER_STATES = ['pending', 'loading', 'active', 'failed', 'inactive', 'unloading'] as const;

function fiberRuntimeState(fiber: NativeFiber | undefined | null): McpRuntimeState {
  try {
    if (fiber == null) return 'inactive';
    const state = fiber.state;
    return Number.isInteger(state) && state >= 0 && state < FIBER_STATES.length ? FIBER_STATES[state] : 'unknown';
  } catch { return 'unknown'; }
}

function configuredRuntimeState(state: McpRuntimeState, enabled: unknown): McpRuntimeState {
  return state === 'inactive' && enabled === false ? 'disabled' : state;
}

const CONNECTION_STATES = ['connected', 'connecting', 'reconnecting', 'waiting-credentials', 'failed', 'closed'] as const;

/** Project the native connection status onto the small wire shape; unknown or unreadable values stay absent. */
function normalizeConnection(value: unknown): McpConnection | null {
  try {
    if (!isRecord(value) || !isOneOf(value.state, CONNECTION_STATES)) return null;
    const connection: McpConnection = { state: value.state };
    for (const key of ['toolCount', 'connectedAt', 'attempt', 'maxAttempts'] as const) {
      const number = value[key];
      if (typeof number === 'number' && Number.isFinite(number)) connection[key] = number;
    }
    if (isOneOf(value.reason, ['gave-up', 'reconnect-disabled', 'unclosed-generation'])) connection.reason = value.reason;
    return connection;
  } catch { return null; }
}

/** Bound and redact the free-form native probe outcome; only whitelisted fields cross the wire. */
function normalizeProbe(value: unknown): McpProbe {
  const record = isRecord(value) ? value : {};
  const durationMs = typeof record.durationMs === 'number' && Number.isFinite(record.durationMs) ? record.durationMs : 0;
  const cleanupFailed = record.closeConfirmed === false || typeof record.cleanupError === 'string';
  if (record.ok === true) {
    const toolNames = Array.isArray(record.toolNames)
      ? record.toolNames.filter((name): name is string => typeof name === 'string' && name.length > 0)
        .slice(0, 200).map(name => name.slice(0, 200)) : [];
    const info = isRecord(record.serverInfo) && typeof record.serverInfo.name === 'string' && typeof record.serverInfo.version === 'string'
      ? { name: record.serverInfo.name.slice(0, 200), version: record.serverInfo.version.slice(0, 200) } : undefined;
    return { ok: true, ...(info ? { serverInfo: info } : {}), toolNames, truncated: record.truncated === true, durationMs, cleanupFailed };
  }
  const stage = isOneOf(record.stage, ['connect', 'list']) ? record.stage : 'connect';
  const message = typeof record.message === 'string' ? sanitizeDiagnosticText(record.message) : '';
  return { ok: false, stage, message, durationMs, cleanupFailed };
}

/** Project only the native transport discriminator, without inspecting connection credentials or targets. */
function transportOf(...configs: (NativePayload | undefined)[]): McpTransport {
  try {
    for (const config of configs) {
      const value = config?.transport;
      if (value !== undefined) return isOneOf(value, ['stdio', 'streamable-http']) ? value : 'unknown';
    }
  } catch { return 'unknown'; }
  return 'unknown';
}

function belongsTo(fiber: NativeFiber, owner: NativeFiber): boolean {
  for (let cursor = fiber; cursor; cursor = cursor.parent?.fiber) {
    if (cursor === owner || cursor.uid === owner.uid) return true;
    if (cursor.uid === 0 || cursor.parent?.fiber === cursor) break;
  }
  return false;
}

function providingPlugin(fiber: NativeFiber): string {
  for (let cursor = fiber; cursor; cursor = cursor.parent?.fiber) {
    const names = [cursor.entry?.options.name, cursor.runtime?.name];
    const source = names.find(name => identifier(name) && !name.startsWith('cordis:')
      && ![MCP_CLIENT, 'mcp-client', 'include', 'loader', 'scope', 'root'].includes(name));
    if (source) return source;
    if (cursor.uid === 0 || cursor.parent?.fiber === cursor) break;
  }
  return '';
}

/** Read native MCP providers without discovering files, opening connections, or owning their lifetimes. */
export class McpProviders {
  ctx: NativeContext;
  ensureActive: () => void;
  closed: boolean;
  ready: Promise<void> | null = null;
  native: unknown;
  scopeOf!: (ctx: NativeContext) => unknown;
  scopeChainOf!: (key: unknown) => unknown[];
  constructor(ctx: NativeContext, { ensureActive = () => {} }: LifecycleOptions = {}) {
    this.ctx = ctx; this.ensureActive = ensureActive;
    this.closed = false;
  }

  active() {
    this.ensureActive();
    if (this.closed) throw failure('mcpUnavailable');
  }

  async initialize() {
    const [native, scopes] = await Promise.all([
      this.ctx.loader.import(MCP_CLIENT),
      this.ctx.loader.import('@deepseek-ai/dsh-scope'),
    ]);
    this.active();
    this.native = native;
    this.scopeOf = scopes.scopeOf;
    this.scopeChainOf = scopes.scopeChainOf;
  }

  /** Read registered names in this server's own scope, excluding inherited definitions. */
  toolNames(name: string, ctx: NativeContext = this.ctx): string[] {
    this.active();
    const tools = ctx.get('tools');
    if (!tools) return [];
    const scope = this.scopeOf(ctx);
    const prefix = `mcp__${name}__`;
    if (typeof tools.definitions === 'function') {
      const inherited = scope === undefined ? new Set() : new Set(tools.definitions(this.scopeChainOf(scope)[1]));
      return tools.definitions(scope).filter(tool => !inherited.has(tool) && tool.name.startsWith(prefix))
        .map(tool => tool.name.slice(prefix.length)).filter(Boolean);
    }
    // Older hosts project schemas to enumerate names. Recover definition identity
    // through get(), since schema copies cannot identify inherited registrations.
    const parent = scope === undefined ? undefined : this.scopeChainOf(scope)[1];
    return tools.schemas(scope).flatMap(({ name: fullName }) => {
      if (!fullName.startsWith(prefix) || fullName.length === prefix.length) return [];
      const definition = tools.get(fullName, scope);
      if (!definition || scope !== undefined && definition === tools.get(fullName, parent)) return [];
      return [fullName.slice(prefix.length)];
    });
  }

  /** Read one live instance's connection status from the native MCP client, when it registers a handle. */
  connectionOf(fiber: NativeFiber | undefined | null): McpConnection | null {
    if (!fiber) return null;
    try {
      const native = this.native as { connectionStatusOf?: (fiber: unknown) => { current(): unknown } | undefined } | undefined;
      if (typeof native?.connectionStatusOf !== 'function') return null;
      const handle = native.connectionStatusOf(fiber);
      return handle ? normalizeConnection(handle.current()) : null;
    } catch { return null; }
  }

  configured(): ConfiguredMcp[] {
    this.active();
    return [...this.ctx.loader.entries()].flatMap(entry => {
      if (entry.options.name !== MCP_CLIENT) return [];
      let fiber;
      let runtimeState: McpRuntimeState;
      try { fiber = entry.fiber; runtimeState = fiberRuntimeState(fiber); }
      catch { runtimeState = 'unknown'; }
      const name = fiber?.effectiveConfig?.serverName ?? fiber?.config?.serverName ?? fiber?.rawConfig?.serverName ?? entry.options.config?.serverName;
      const tools = identifier(name) && fiber?.ctx && ['pending', 'loading', 'active', 'failed'].includes(runtimeState)
        ? this.toolNames(name, fiber.ctx) : [];
      const connection = this.connectionOf(fiber);
      return [{ entryId: entry.id, uid: fiber?.uid, name: identifier(name) ? name : '', tools, runtimeState,
        transport: transportOf(fiber?.effectiveConfig, fiber?.config, entry.options.config), ...(connection ? { connection } : {}) }];
    });
  }

  presetEntries() {
    this.active();
    return [...this.ctx.loader.entries()].flatMap(entry => {
      if (entry.options.name !== '@deepseek-ai/dsh-agent-preset') return [];
      const id = entry.fiber?.effectiveConfig?.id ?? entry.fiber?.config?.id;
      return identifier(id) && identifier(entry.id) ? [{ id, entryId: entry.id }] : [];
    });
  }

  /**
   * Declared configuration for a manager or runtime instance, without resolving secrets.
   * @param id - the projected server id (`manager:...` or `runtime:...`).
   * @returns the entry configuration, or undefined when it cannot be confirmed.
   */
  configFor(id: string): unknown {
    this.active();
    if (id.startsWith('manager:')) {
      const manager = this.ctx.get('mcpManager');
      const target = this.managed().targets.find(row => row.id === id);
      if (!manager || !target) return undefined;
      try {
        const configs = manager.config.servers.get();
        return Object.hasOwn(configs, target.name) ? configs[target.name] : undefined;
      } catch { return undefined; }
    }
    if (id.startsWith('runtime:')) {
      const uid = Number(id.slice('runtime:'.length));
      if (!Number.isSafeInteger(uid)) return undefined;
      try {
        const fiber = [...(this.ctx.registry.get(this.native)?.fibers ?? [])].find(row => row.uid === uid);
        return fiber?.effectiveConfig ?? fiber?.config ?? fiber?.rawConfig;
      } catch { return undefined; }
    }
    return undefined;
  }

  /**
   * Declared configuration of one profile or preset MCP row.
   * @param id - the projected server id (`<entryId>` or `preset:<presetId>:<rowId>`).
   * @returns the declared config object, or undefined when no unique row matches.
   */
  declared(id: string): unknown {
    this.active();
    const preset = /^preset:([^:]+):(.+)$/.exec(id);
    if (!preset) {
      const matches = [...this.ctx.loader.entries()].filter(entry => entry.id === id && entry.options.name === MCP_CLIENT);
      return matches.length === 1 ? matches[0].options.config : undefined;
    }
    const [, presetId, rowId] = preset;
    const owners = [...this.ctx.loader.entries()].filter(entry => entry.options.name === '@deepseek-ai/dsh-agent-preset'
      && (entry.fiber?.effectiveConfig?.id ?? entry.fiber?.config?.id) === presetId);
    if (owners.length !== 1) return undefined;
    const found: unknown[] = [];
    // Composition rows flatten group rows, whose children live in `config`.
    const walk = (rows: unknown): void => {
      if (!Array.isArray(rows)) return;
      for (const row of rows) {
        if (!isRecord(row)) continue;
        if (row.group === true) { walk(row.config); continue; }
        if (row.name === MCP_CLIENT && row.id === rowId) found.push(row.config);
      }
    };
    walk(owners[0].options.config?.plugins);
    return found.length === 1 ? found[0] : undefined;
  }

  /**
   * Resolve the raw declared config and its owning context so one server can be probed.
   * Mirrors `configFor`/`declared` resolution but keeps the context needed for credential templates.
   */
  private probeTarget(id: string): { config: NativePayload | undefined; ctx: NativeContext | undefined } {
    this.active();
    const preset = /^preset:([^:]+):(.+)$/.exec(id);
    if (preset) {
      const [, presetId, rowId] = preset;
      const owners = [...this.ctx.loader.entries()].filter(entry => entry.options.name === '@deepseek-ai/dsh-agent-preset'
        && (entry.fiber?.effectiveConfig?.id ?? entry.fiber?.config?.id) === presetId);
      if (owners.length !== 1) return { config: undefined, ctx: undefined };
      const found: NativePayload[] = [];
      const walk = (rows: unknown): void => {
        if (!Array.isArray(rows)) return;
        for (const row of rows) {
          if (!isRecord(row)) continue;
          if (row.group === true) { walk(row.config); continue; }
          if (row.name === MCP_CLIENT && row.id === rowId) found.push(row.config as NativePayload);
        }
      };
      walk(owners[0].options.config?.plugins);
      const raw = found.length === 1 ? found[0] : undefined;
      if (!raw) return { config: undefined, ctx: undefined };
      // Prefer the child instance's resolved config (schema defaults applied) when it is unambiguous.
      let resolvedFiber: NativeFiber | undefined;
      try {
        const owner = owners[0].fiber;
        const serverName = raw.serverName;
        if (owner) resolvedFiber = [...(this.ctx.registry.get(this.native)?.fibers ?? [])].find(fiber =>
          belongsTo(fiber, owner) && (fiber.effectiveConfig?.serverName ?? fiber.config?.serverName ?? fiber.rawConfig?.serverName) === serverName);
      } catch { resolvedFiber = undefined; }
      return { config: (resolvedFiber?.effectiveConfig ?? raw) as NativePayload, ctx: resolvedFiber?.ctx ?? owners[0].fiber?.ctx };
    }
    if (id.startsWith('manager:')) {
      const manager = this.ctx.get('mcpManager');
      const target = this.managed().targets.find(row => row.id === id);
      if (!manager || !target) return { config: undefined, ctx: undefined };
      try {
        const configs = manager.config.servers.get();
        return { config: Object.hasOwn(configs, target.name) ? configs[target.name] as NativePayload : undefined, ctx: target.owner?.ctx };
      } catch { return { config: undefined, ctx: undefined }; }
    }
    if (id.startsWith('runtime:')) {
      const uid = Number(id.slice('runtime:'.length));
      if (!Number.isSafeInteger(uid)) return { config: undefined, ctx: undefined };
      try {
        const fiber = [...(this.ctx.registry.get(this.native)?.fibers ?? [])].find(row => row.uid === uid);
        return { config: (fiber?.effectiveConfig ?? fiber?.config ?? fiber?.rawConfig) as NativePayload | undefined, ctx: fiber?.ctx };
      } catch { return { config: undefined, ctx: undefined }; }
    }
    const matches = [...this.ctx.loader.entries()].filter(entry => entry.id === id && entry.options.name === MCP_CLIENT);
    if (matches.length !== 1) return { config: undefined, ctx: undefined };
    // Prefer the instance's resolved config so schema defaults (env/cwd/args) reach the probe.
    return {
      config: (matches[0].fiber?.effectiveConfig ?? matches[0].fiber?.config ?? matches[0].options.config) as NativePayload | undefined,
      ctx: matches[0].fiber?.ctx,
    };
  }

  /**
   * Run a read-only connectivity probe for one server: it connects, lists tools, and closes.
   * @param id - the projected server id from the catalog.
   * @returns the bounded, sanitized probe outcome.
   */
  async probe(id: string): Promise<McpProbe> {
    this.active();
    const { config, ctx } = this.probeTarget(id);
    const native = this.native as {
      probeServer?: (context: NativeContext, config: NativePayload, options?: { timeoutMs?: number }) => Promise<unknown>;
    } | undefined;
    if (!config || typeof native?.probeServer !== 'function') throw failure('mcpProbeFailed');
    let raw: unknown;
    try { raw = await native.probeServer(ctx ?? this.ctx, config, { timeoutMs: 15000 }); }
    catch { this.active(); throw failure('mcpProbeFailed'); }
    this.active();
    return normalizeProbe(raw);
  }

  /** Read only the manager's exact native child instance, never its connection-status payload. */
  managedMetadata(name: string, owner: NativeFiber | undefined): { runtimeState: McpRuntimeState; transport: McpTransport; connection?: McpConnection } {
    const unknown: { runtimeState: McpRuntimeState; transport: McpTransport; connection?: McpConnection } = { runtimeState: 'unknown', transport: 'unknown' };
    if (!owner) return unknown;
    try {
      const matches = [...(this.ctx.registry.get(this.native)?.fibers ?? [])].filter(fiber =>
        belongsTo(fiber, owner) && (fiber.effectiveConfig?.serverName ?? fiber.config?.serverName ?? fiber.rawConfig?.serverName) === name);
      if (matches.length !== 1) return unknown;
      const fiber = matches[0];
      const connection = this.connectionOf(fiber);
      return { runtimeState: fiberRuntimeState(fiber), transport: transportOf(fiber.effectiveConfig, fiber.config), ...(connection ? { connection } : {}) };
    } catch { return unknown; }
  }

  managed(): { servers: McpServer[]; owner: NativeFiber | null; targets: ManagedTarget[] } {
    this.active();
    const manager = this.ctx.get('mcpManager');
    if (!manager) return { servers: [], owner: null, targets: [] };
    // A third-party gateway may also use this service name with a different API.
    // Confirm the native Loader owner before reading any manager-specific fields.
    // Service.ctx is rebound to the caller and cannot establish that ownership.
    const candidates = [...this.ctx.loader.entries()].filter(entry => entry.options.name === '@deepseek-ai/dsh-mcp-manager'
      && entry.fiber?.state === 2);
    if (!candidates.length) return { servers: [], owner: null, targets: [] };
    const entries = candidates.filter(entry => entry.ctx.get('mcpManager')?.config === manager.config);
    if (entries.length !== 1) return { servers: [], owner: null, targets: [] };
    const entry = entries[0];
    const configs = manager.config.servers.get();
    const owner = entry.fiber;
    const namespace = entry.options.id;
    const settings = this.ctx.get('settings');
    const editable = identifier(namespace) && typeof settings?.describe === 'function' && typeof settings?.mutate === 'function';
    const targets: ManagedTarget[] = [];
    const servers: McpServer[] = manager.list().filter(row => row.configured).map(row => {
      if (!identifier(row.name)) throw failure('mcpLoadFailed');
      const configured = Object.hasOwn(configs, row.name);
      const enabled = configured ? configs[row.name]?.enabled : true;
      const stateKnown = typeof enabled === 'boolean';
      const id = `manager:${JSON.stringify([namespace ?? '', row.name])}`;
      const canToggle = Boolean(configured && stateKnown && editable);
      if (canToggle) targets.push({ id, name: row.name, namespace: namespace!, owner, enabled: enabled as boolean });
      const metadata = this.managedMetadata(row.name, owner);
      return { id, name: row.name, source: 'manager', origin: configured ? namespace ?? '' : '',
        group: configured ? 'user' : 'builtin', enabled: enabled === true, stateKnown, canToggle,
        runtimeState: configuredRuntimeState(metadata.runtimeState, enabled),
        transport: metadata.transport !== 'unknown' ? metadata.transport : configured ? transportOf(configs[row.name]) : 'unknown',
        ...(metadata.connection ? { connection: metadata.connection } : {}),
        tools: enabled === true ? this.toolNames(row.name, owner?.ctx ?? this.ctx) : [],
        reason: canToggle ? '' : configured ? 'manager-managed' : 'plugin-managed' };
    });
    return { servers, targets, owner: owner ?? null };
  }

  /** List Host-global native instances, excluding Agent and other scoped registrations. */
  list() {
    this.active();
    const managed = this.managed();
    const servers = [...managed.servers];
    const runtime = this.ctx.registry.get(this.native);
    const configured = new Set(this.configured().map(row => row.uid).filter(Number.isSafeInteger));
    for (const fiber of runtime?.fibers ?? []) {
      const runtimeState = fiberRuntimeState(fiber);
      if (!Number.isSafeInteger(fiber.uid) || runtimeState === 'inactive') continue;
      if (managed.owner && belongsTo(fiber, managed.owner)) continue;
      const key = this.scopeOf(fiber.ctx);
      if (key !== undefined || configured.has(fiber.uid)) continue;
      const name = fiber.effectiveConfig?.serverName ?? fiber.config?.serverName ?? fiber.rawConfig?.serverName;
      if (!identifier(name)) continue;
      const origin = providingPlugin(fiber.parent.fiber);
      const connection = this.connectionOf(fiber);
      servers.push({ id: `runtime:${fiber.uid}`, name, source: 'plugin', origin, group: 'builtin',
        enabled: true, stateKnown: true, canToggle: false, reason: 'plugin-managed', runtimeState,
        transport: transportOf(fiber.effectiveConfig, fiber.config),
        ...(connection ? { connection } : {}),
        tools: ['pending', 'loading', 'active', 'failed'].includes(runtimeState) ? this.toolNames(name, fiber.ctx) : [] });
    }
    this.active();
    return { complete: true, servers };
  }

  /** Change only a Settings-configured native manager entry, preserving its other fields and revision. */
  async setEnabled(id: string, enabled: boolean) {
    this.active();
    const target = this.managed().targets.find(row => row.id === id);
    if (!target || typeof enabled !== 'boolean') throw failure('mcpUnavailable');
    if (target.enabled === enabled) return;
    const settings = this.ctx.get('settings');
    const descriptor = settings.describe({ redactSecrets: true }).find(row => row.ns === target.namespace);
    if (!descriptor || !Number.isSafeInteger(descriptor.revision)) throw failure('mcpUnavailable');
    this.active();
    let rejected = false;
    try {
      await settings.mutate(descriptor.ns, [{ op: 'set', path: ['servers', target.name, 'enabled'], value: enabled }], descriptor.revision);
    } catch { rejected = true; }
    this.active();
    let after;
    try { after = this.managed().targets.find(row => row.id === id); }
    catch { this.active(); throw failure('mcpChangeUncertain'); }
    this.active();
    if (rejected) throw failure('mcpChangeFailed');
    if (!after || after.owner !== target.owner) throw failure('mcpChangeUncertain');
    if (after.enabled !== enabled) throw failure('mcpChangeOverridden');
  }

  close() { this.closed = true; }
}
