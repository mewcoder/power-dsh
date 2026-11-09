import { policyRpc } from '../../shared/rpc/codecs.ts';

export const SEARCH_RPC = policyRpc('setSearchBlocked', 'SearchPolicyResult');

export const rpc = [SEARCH_RPC];
