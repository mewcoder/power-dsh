import type { FeatureDefinition } from '../../shared/types/feature.ts';
// Environment-independent metadata shared by Host and Client.
export const definition = Object.freeze({
  id: 'usage-stats', category: 'enhance', order: 12,
  keys: Object.freeze(['usageStatsEnabled'] as const),
  spec: 'src/features/usage-stats/spec.md',
} satisfies FeatureDefinition);
export default definition;
