import { policyRpc } from '../../shared/rpc/codecs.ts';

export const GOAL_RPC = policyRpc('setGoalBlocked', 'GoalPolicyResult');
export const rpc = [GOAL_RPC];
