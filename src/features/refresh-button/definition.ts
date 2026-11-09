import type { FeatureDefinition } from '../../shared/types/feature.ts';
// Environment-independent metadata shared by Host and Client.
export const definition = Object.freeze({
  id: 'refresh-button', category: 'general', order: 1,
  keys: Object.freeze(['showRefreshButton'] as const),
  spec: 'src/features/refresh-button/spec.md',
} satisfies FeatureDefinition);
export default definition;
