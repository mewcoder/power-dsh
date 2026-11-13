import { isRecord, isArray, isStringArray, hasStrings, hasBooleans, isOneOf, type Codec, type RpcDescriptor } from '../../shared/types/protocol.ts';
import type { McpRuntimeState, McpTransport, McpServer, McpCatalog, McpReconnectConfig, McpServerConfig, McpServerDetail, McpConnection, McpProbe } from '../../shared/types/wire.ts';
export type { McpRuntimeState, McpTransport, McpServer, McpCatalog, McpServerConfig, McpServerDetail, McpConnection, McpProbe } from '../../shared/types/wire.ts';
import { redactMcpArgs } from './mcp-args.ts';
import { stringCodec, booleanCodec } from '../../shared/rpc/codecs.ts';

const connectionCodec: Codec<McpConnection> = {
  mode: 'strict', typeSymbol: 'power-dsh#McpConnection',
  create: () => ({ parse(value) {
    if (!isRecord(value)
      || !isOneOf(value.state, ['connected', 'connecting', 'reconnecting', 'waiting-credentials', 'failed', 'closed'])) {
      throw new TypeError('Invalid MCP connection');
    }
    const connection: McpConnection = { state: value.state };
    for (const key of ['toolCount', 'connectedAt', 'attempt', 'maxAttempts'] as const) {
      const number = value[key];
      if (number === undefined) continue;
      if (typeof number !== 'number' || !Number.isFinite(number)) throw new TypeError('Invalid MCP connection');
      connection[key] = number;
    }
    if (value.reason !== undefined) {
      if (!isOneOf(value.reason, ['gave-up', 'reconnect-disabled', 'unclosed-generation'])) throw new TypeError('Invalid MCP connection');
      connection.reason = value.reason;
    }
    return connection;
  } }),
};

const serverCodec: Codec<McpServer> = {
  mode: 'strict', typeSymbol: 'power-dsh#McpServer',
  create: () => ({ parse(value) {
    if (!isRecord(value) || !hasStrings(value, ['id', 'name', 'source', 'origin', 'reason'])
      || !isOneOf(value.group, ['user', 'builtin'])
      || !isOneOf(value.transport, ['stdio', 'streamable-http', 'unknown'])
      || !isOneOf(value.runtimeState, ['pending', 'loading', 'active', 'failed', 'unloading', 'inactive', 'disabled', 'unknown'])
      || !isStringArray(value.tools)
      || !hasBooleans(value, ['enabled', 'stateKnown', 'canToggle'])) throw new TypeError('Invalid MCP entry');
    const server: McpServer = { id: value.id, name: value.name, source: value.source, origin: value.origin, group: value.group, enabled: value.enabled,
      stateKnown: value.stateKnown, runtimeState: value.runtimeState, transport: value.transport, canToggle: value.canToggle, reason: value.reason, tools: value.tools.slice() };
    if (value.connection !== undefined) server.connection = connectionCodec.create().parse(value.connection);
    return server;
  } }),
};

const mcpCatalogCodec: Codec<McpCatalog> = {
  mode: 'strict', typeSymbol: 'power-dsh#McpCatalog',
  create: () => ({ parse(value) {
    if (!isRecord(value) || typeof value.complete !== 'boolean' || !isArray(value.servers)) throw new TypeError('Invalid MCP catalog');
    const servers = value.servers.map(row => serverCodec.create().parse(row));
    return { complete: value.complete, servers };
  } }),
};

const optionalText = (value: unknown) => value === undefined || typeof value === 'string';

/** Only the HTTP(S) origin is displayable: any other URL component can carry credentials. */
export function projectEndpoint(value: unknown): { url?: string; hidden: boolean } {
  if (typeof value !== 'string' || value === '') return { hidden: false };
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { hidden: true };
    return { url: parsed.origin, hidden: parsed.href !== `${parsed.origin}/` || /[?#]/.test(value) };
  } catch {
    return { hidden: true };
  }
}

const reconnectCodec = {
  parse(value: unknown) {
    if (!isRecord(value) || !(value.enabled === undefined || typeof value.enabled === 'boolean')) {
      throw new TypeError('Invalid MCP reconnect policy');
    }
    const config: McpReconnectConfig = {};
    if (typeof value.enabled === 'boolean') config.enabled = value.enabled;
    for (const key of ['initialDelayMs', 'maxDelayMs', 'maxAttempts'] as const) {
      const number = value[key];
      if (number === undefined) continue;
      if (typeof number !== 'number' || !Number.isFinite(number)) throw new TypeError('Invalid MCP reconnect policy');
      config[key] = number;
    }
    return config;
  },
};

const configCodec: Codec<McpServerConfig> = {
  mode: 'strict', typeSymbol: 'power-dsh#McpServerConfig',
  create: () => ({ parse(value) {
    if (!isRecord(value)
      || !isOneOf(value.transport, ['stdio', 'streamable-http', 'unknown'])
      || !isStringArray(value.envKeys) || !isStringArray(value.headerKeys)
      || !isStringArray(value.expressions) || typeof value.urlQueryHidden !== 'boolean'
      || !optionalText(value.serverName) || !optionalText(value.command) || !optionalText(value.cwd)
      || !optionalText(value.url) || !(value.args === undefined || isStringArray(value.args))
      || !(value.reconnect === undefined || isRecord(value.reconnect))) throw new TypeError('Invalid MCP configuration');
    if (value.argsHidden === true && value.args === undefined) throw new TypeError('mcpDetailOutdated');
    const endpoint = projectEndpoint(value.url);
    const config: McpServerConfig = {
      transport: value.transport,
      envKeys: value.envKeys.slice(),
      headerKeys: value.headerKeys.slice(),
      expressions: value.expressions.slice(),
      urlQueryHidden: value.urlQueryHidden || endpoint.hidden,
    };
    if (typeof value.serverName === 'string' && value.serverName) config.serverName = value.serverName;
    if (typeof value.command === 'string' && value.command) config.command = value.command;
    if (isStringArray(value.args)) config.args = redactMcpArgs(value.args);
    if (typeof value.cwd === 'string' && value.cwd) config.cwd = value.cwd;
    if (endpoint.url !== undefined) config.url = endpoint.url;
    if (value.reconnect !== undefined) config.reconnect = reconnectCodec.parse(value.reconnect);
    return config;
  } }),
};

const detailCodec: Codec<McpServerDetail | null> = {
  mode: 'strict', typeSymbol: 'power-dsh#McpServerDetail',
  create: () => ({ parse(value) {
    if (value === null) return null;
    if (!isRecord(value) || !Object.hasOwn(value, 'server') || !Object.hasOwn(value, 'config')) throw new TypeError('Invalid MCP detail');
    const server = serverCodec.create().parse(value.server);
    const config = value.config === null ? null : configCodec.create().parse(value.config);
    return { server, config };
  } }),
};

export const parseMcpServerDetail = detailCodec.create().parse;

const probeCodec: Codec<McpProbe> = {
  mode: 'strict', typeSymbol: 'power-dsh#McpProbe',
  create: () => ({ parse(value) {
    if (!isRecord(value) || typeof value.ok !== 'boolean' || typeof value.cleanupFailed !== 'boolean'
      || typeof value.durationMs !== 'number' || !Number.isFinite(value.durationMs)) {
      throw new TypeError('Invalid MCP probe');
    }
    if (value.ok) {
      if (!isStringArray(value.toolNames) || typeof value.truncated !== 'boolean') throw new TypeError('Invalid MCP probe');
      const probe: McpProbe = { ok: true, toolNames: value.toolNames.slice(), truncated: value.truncated,
        durationMs: value.durationMs, cleanupFailed: value.cleanupFailed };
      if (value.serverInfo !== undefined) {
        if (!isRecord(value.serverInfo) || !hasStrings(value.serverInfo, ['name', 'version'])) throw new TypeError('Invalid MCP probe');
        probe.serverInfo = { name: value.serverInfo.name, version: value.serverInfo.version };
      }
      return probe;
    }
    if (!isOneOf(value.stage, ['connect', 'list']) || typeof value.message !== 'string') throw new TypeError('Invalid MCP probe');
    return { ok: false, stage: value.stage, message: value.message, durationMs: value.durationMs, cleanupFailed: value.cleanupFailed };
  } }),
};

export const parseMcpProbe = probeCodec.create().parse;

function mcpRpc<M extends string>(method: M, fields: string[], result: Codec<unknown>): RpcDescriptor<M> {
  return {
    id: `power-dsh#powerDsh/${method}`,
    service: 'powerDsh', namespace: 'powerDsh', method,
    invocation: { kind: 'direct' },
    parameters: fields.map(name => ({ name, wire: name, source: 'json', codec: name === 'enabled' ? booleanCodec : stringCodec })),
    result,
  };
}
export const LIST_MCP_SERVERS_RPC = mcpRpc('listMcpServers', [], mcpCatalogCodec);
export const READ_MCP_SERVER_RPC = mcpRpc('readMcpServer', ['id'], detailCodec);
export const SET_MCP_SERVER_ENABLED_RPC = mcpRpc('setMcpServerEnabled', ['id', 'enabled'], mcpCatalogCodec);
export const PROBE_MCP_SERVER_RPC = mcpRpc('probeMcpServer', ['id'], probeCodec);

export const rpc = [LIST_MCP_SERVERS_RPC, READ_MCP_SERVER_RPC, SET_MCP_SERVER_ENABLED_RPC, PROBE_MCP_SERVER_RPC];
