import { policyRpc } from '../../shared/rpc/codecs.ts';

export const ACCOUNT_RPC = policyRpc('setAccountBlocked', 'AccountPolicyResult');

export const rpc = [ACCOUNT_RPC];
