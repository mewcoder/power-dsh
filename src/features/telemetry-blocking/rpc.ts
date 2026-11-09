import { policyRpc } from '../../shared/rpc/codecs.ts';

export const TELEMETRY_RPC = policyRpc('setTelemetryBlocked', 'TelemetryPolicyResult');

export const rpc = [TELEMETRY_RPC];
