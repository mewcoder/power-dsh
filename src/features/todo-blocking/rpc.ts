import { policyRpc } from '../../shared/rpc/codecs.ts';

export const TODO_RPC = policyRpc('setTodoBlocked', 'TodoPolicyResult');

export const rpc = [TODO_RPC];
