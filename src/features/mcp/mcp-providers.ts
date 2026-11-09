import type { NativeContext, NativeFiber, NativePayload, LifecycleOptions } from '../../shared/host/native.ts';
import type { McpServer, McpRuntimeState, McpTransport } from './rpc.ts';
import { isOneOf } from '../../shared/types/protocol.ts';
export interface ConfiguredMcp { entryId: string; uid?: number; name: string; tools: string[]; runtimeState: McpRuntimeState; transport: McpTransport }
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
      return [{ entryId: entry.id, uid: fiber?.uid, name: identifier(name) ? name : '', tools, runtimeState,
        transport: transportOf(fiber?.effectiveConfig, fiber?.config, entry.options.config) }];
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

  /** Read only the manager's exact native child instance, never its connection-status payload. */
  managedMetadata(name: string, owner: NativeFiber | undefined): { runtimeState: McpRuntimeState; transport: McpTransport } {
    const unknown: { runtimeState: McpRuntimeState; transport: McpTransport } = { runtimeState: 'unknown', transport: 'unknown' };
    if (!owner) return unknown;
    try {
      const matches = [...(this.ctx.registry.get(this.native)?.fibers ?? [])].filter(fiber =>
        belongsTo(fiber, owner) && (fiber.effectiveConfig?.serverName ?? fiber.config?.serverName ?? fiber.rawConfig?.serverName) === name);
      if (matches.length !== 1) return unknown;
      const fiber = matches[0];
      return { runtimeState: fiberRuntimeState(fiber), transport: transportOf(fiber.effectiveConfig, fiber.config) };
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
      servers.push({ id: `runtime:${fiber.uid}`, name, source: 'plugin', origin, group: 'builtin',
        enabled: true, stateKnown: true, canToggle: false, reason: 'plugin-managed', runtimeState,
        transport: transportOf(fiber.effectiveConfig, fiber.config),
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
