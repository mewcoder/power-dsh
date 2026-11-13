import { isRecord, hasStrings, hasBooleans, isOneOf, type Codec, type RpcDescriptor } from '../../shared/types/protocol.ts';
import type { RestartStatus, RestartAccepted } from '../../shared/types/wire.ts';
export type { RestartStatus, RestartAccepted } from '../../shared/types/wire.ts';
export const RESTART_STATUS_RPC: RpcDescriptor<'restartStatus', RestartStatus> = {
  id: 'power-dsh#powerDsh/restartStatus', service: 'powerDsh', namespace: 'powerDsh', method: 'restartStatus',
  invocation: { kind: 'direct' }, parameters: [],
  result: { mode: 'strict', typeSymbol: 'power-dsh#RestartStatus', create: () => ({ parse(value) {
    if (!isRecord(value) || typeof value.supported !== 'boolean' || typeof value.running !== 'boolean'
      || !isOneOf(value.error, ['', 'restartFailed'])) throw new TypeError('Invalid restart status');
    return { supported: value.supported, running: value.running, error: value.error };
  } }) },
};
export const RESTART_APP_RPC: RpcDescriptor<'restartApp', RestartAccepted> = {
  id: 'power-dsh#powerDsh/restartApp', service: 'powerDsh', namespace: 'powerDsh', method: 'restartApp',
  invocation: { kind: 'direct' }, parameters: [],
  result: { mode: 'strict', typeSymbol: 'power-dsh#RestartAccepted', create: () => ({ parse(value) {
    if (!isRecord(value) || value.accepted !== true) throw new TypeError('Invalid restart acceptance');
    return { accepted: true };
  } }) },
};

export const RESTART_AFTER_UPDATE_RPC: RpcDescriptor<'restartAfterUpdate', RestartAccepted> = {
  ...RESTART_APP_RPC, id: 'power-dsh#powerDsh/restartAfterUpdate', method: 'restartAfterUpdate',
};

export const rpc = [RESTART_STATUS_RPC, RESTART_APP_RPC, RESTART_AFTER_UPDATE_RPC];
