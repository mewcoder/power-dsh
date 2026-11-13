import { isRecord, isOneOf, type RpcDescriptor } from '../../shared/types/protocol.ts';
import type { PluginRelease } from '../../shared/types/wire.ts';
import { versionParts } from './versions.ts';
import { parseUpdateDiagnostic } from './diagnostics.ts';

export const READ_PLUGIN_RELEASE_RPC: RpcDescriptor<'readPluginRelease', PluginRelease> = {
  id: 'power-dsh#powerDsh/readPluginRelease', service: 'powerDsh', namespace: 'powerDsh', method: 'readPluginRelease',
  invocation: { kind: 'direct' }, parameters: [],
  result: { mode: 'strict', typeSymbol: 'power-dsh#PluginRelease', create: () => ({ parse(value) {
    if (!isRecord(value)) throw new TypeError('Invalid plugin release');
    if (value.status === 'ready' && typeof value.version === 'string' && versionParts(value.version)
      && typeof value.commit === 'string' && /^[a-f0-9]{40}$/.test(value.commit)) {
      return { status: 'ready', version: value.version, commit: value.commit };
    }
    if (isOneOf(value.status, ['unavailable', 'git-unavailable'])) return { status: value.status,
      ...(value.diagnostic === undefined ? {} : { diagnostic: parseUpdateDiagnostic(value.diagnostic) }) };
    if (value.status === 'rate-limited' && Number.isSafeInteger(value.retryAt) && Number(value.retryAt) > 0) {
      return { status: value.status, retryAt: Number(value.retryAt),
        ...(value.diagnostic === undefined ? {} : { diagnostic: parseUpdateDiagnostic(value.diagnostic) }) };
    }
    throw new TypeError('Invalid plugin release');
  } }) },
};

export const PLUGIN_RUNTIME_VERSION_RPC: RpcDescriptor<'pluginRuntimeVersion', string> = {
  id: 'power-dsh#powerDsh/pluginRuntimeVersion', service: 'powerDsh', namespace: 'powerDsh', method: 'pluginRuntimeVersion',
  invocation: { kind: 'direct' }, parameters: [],
  result: { mode: 'strict', typeSymbol: 'power-dsh#PluginRuntimeVersion', create: () => ({ parse(value) {
    if (typeof value !== 'string' || !versionParts(value)) throw new TypeError('Invalid plugin runtime version');
    return value;
  } }) },
};

export const rpc = [READ_PLUGIN_RELEASE_RPC, PLUGIN_RUNTIME_VERSION_RPC];
