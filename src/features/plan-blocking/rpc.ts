import { policyRpc } from '../../shared/rpc/codecs.ts';

export const PLAN_RPC = policyRpc('setPlanBlocked', 'PlanPolicyResult');
export const rpc = [PLAN_RPC];
