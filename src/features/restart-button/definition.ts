import type { FeatureDefinition } from '../../shared/types/feature.ts';
// Environment-independent metadata shared by Host and Client.
export const definition = Object.freeze({
  id: 'restart-button', category: 'other', order: 2,
  keys: Object.freeze(['showRestartButton'] as const),
  spec: 'src/features/restart-button/spec.md',
} satisfies FeatureDefinition);
export default definition;
