import type { McpReconnectConfig, McpServerConfig, McpTransport } from '../../shared/types/wire.ts';
import { isRecord, isOneOf } from '../../shared/types/protocol.ts';
import { projectEndpoint } from './rpc.ts';
import { redactMcpArgs } from './mcp-args.ts';

/** Loader serializes `!!js` values as this marker object before evaluation. */
function isExpression(value: unknown): value is { __jsExpr: string } {
  return isRecord(value) && Object.keys(value).length === 1 && typeof value.__jsExpr === 'string';
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function reconnectOf(value: unknown): McpReconnectConfig | undefined {
  if (!isRecord(value)) return undefined;
  const config: McpReconnectConfig = {};
  if (typeof value.enabled === 'boolean') config.enabled = value.enabled;
  for (const key of ['initialDelayMs', 'maxDelayMs', 'maxAttempts'] as const) {
    if (typeof value[key] === 'number' && Number.isFinite(value[key])) config[key] = value[key];
  }
  return Object.keys(config).length > 0 ? config : undefined;
}

/**
 * Project one native MCP entry into the fields the detail dialog shows.
 *
 * Only fields the entry actually declares are reported, so the dialog never
 * lists defaults the user did not choose. `env` and `headers` keep key names
 * only, a `!!js` field reports its name instead of unresolved text, and the
 * endpoint is reduced to its origin; argument credential fields are masked.
 * @param raw - the entry's configuration as the profile or preset declares it.
 * @param fallback - transport already confirmed by the catalog projection.
 * @returns the readable configuration, or null when nothing is declared.
 */
export function projectMcpConfig(raw: unknown, fallback: McpTransport): McpServerConfig | null {
  if (!isRecord(raw)) return null;
  const expressions: string[] = [];
  const read = (field: string): unknown => {
    const value = raw[field];
    if (isExpression(value)) { expressions.push(field); return undefined; }
    return value;
  };
  const keysOf = (field: string): string[] => {
    const value = read(field);
    return isRecord(value) ? Object.keys(value).sort() : [];
  };
  const transport = read('transport');
  const endpointValue = projectEndpoint(read('url'));
  const args = read('args');
  const config: McpServerConfig = {
    transport: isOneOf(transport, ['stdio', 'streamable-http']) ? transport : fallback,
    envKeys: keysOf('env'),
    headerKeys: keysOf('headers'),
    expressions,
    urlQueryHidden: endpointValue.hidden,
  };
  const serverName = text(read('serverName'));
  if (serverName !== undefined) config.serverName = serverName;
  const command = text(read('command'));
  if (command !== undefined) config.command = command;
  if (Array.isArray(args) && args.length > 0) config.args = redactMcpArgs(args.filter((arg): arg is string => typeof arg === 'string'));
  const cwd = text(read('cwd'));
  if (cwd !== undefined) config.cwd = cwd;
  if (endpointValue.url !== undefined) config.url = endpointValue.url;
  const reconnect = reconnectOf(read('reconnect'));
  if (reconnect !== undefined) config.reconnect = reconnect;
  return config;
}
