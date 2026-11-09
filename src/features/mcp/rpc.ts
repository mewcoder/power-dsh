import { isRecord, isArray, isStringArray, hasStrings, hasBooleans, isOneOf, type Codec, type RpcDescriptor } from '../../shared/types/protocol.ts';
import type { McpRuntimeState, McpTransport, McpServer, McpCatalog } from '../../shared/types/wire.ts';
export type { McpRuntimeState, McpTransport, McpServer, McpCatalog } from '../../shared/types/wire.ts';
import { stringCodec, booleanCodec } from '../../shared/rpc/codecs.ts';

const mcpCatalogCodec: Codec<McpCatalog> = {
  mode: 'strict', typeSymbol: 'power-dsh#McpCatalog',
  create: () => ({ parse(value) {
    if (!isRecord(value) || typeof value.complete !== 'boolean' || !isArray(value.servers)) throw new TypeError('Invalid MCP catalog');
    const servers = value.servers.map(row => {
      if (!isRecord(row) || !hasStrings(row, ['id', 'name', 'source', 'origin', 'reason'])
        || !isOneOf(row.group, ['user', 'builtin'])
        || !isOneOf(row.transport, ['stdio', 'streamable-http', 'unknown'])
        || !isOneOf(row.runtimeState, ['pending', 'loading', 'active', 'failed', 'unloading', 'inactive', 'disabled', 'unknown'])
        || !isStringArray(row.tools)
        || !hasBooleans(row, ['enabled', 'stateKnown', 'canToggle'])) throw new TypeError('Invalid MCP entry');
      return { id: row.id, name: row.name, source: row.source, origin: row.origin, group: row.group, enabled: row.enabled,
        stateKnown: row.stateKnown, runtimeState: row.runtimeState, transport: row.transport, canToggle: row.canToggle, reason: row.reason, tools: row.tools.slice() };
    });
    return { complete: value.complete, servers };
  } }),
};
function mcpRpc<M extends string>(method: M, fields: string[]): RpcDescriptor<M, McpCatalog> {
  return {
    id: `power-dsh#powerDsh/${method}`,
    service: 'powerDsh', namespace: 'powerDsh', method,
    invocation: { kind: 'direct' },
    parameters: fields.map(name => ({ name, wire: name, source: 'json', codec: name === 'enabled' ? booleanCodec : stringCodec })),
    result: mcpCatalogCodec,
  };
}
export const LIST_MCP_SERVERS_RPC = mcpRpc('listMcpServers', []);
export const SET_MCP_SERVER_ENABLED_RPC = mcpRpc('setMcpServerEnabled', ['id', 'enabled']);

export const rpc = [LIST_MCP_SERVERS_RPC, SET_MCP_SERVER_ENABLED_RPC];
