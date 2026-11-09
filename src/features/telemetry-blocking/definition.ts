import type { FeatureDefinition } from '../../shared/types/feature.ts';
// Environment-independent metadata shared by Host and Client.
export const definition = Object.freeze({
  id: 'telemetry-blocking', category: 'simplify', order: 10,
  keys: Object.freeze(['blockOfficialTelemetry'] as const),
  spec: 'src/features/telemetry-blocking/spec.md',
} satisfies FeatureDefinition);
export default definition;
