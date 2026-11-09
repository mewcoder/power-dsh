import type { FeatureDefinition } from '../../shared/types/feature.ts';
// Environment-independent metadata shared by Host and Client.
export const definition = Object.freeze({
  id: 'personalization', category: 'enhance', order: 9,
  keys: Object.freeze(['personalizationEnabled'] as const),
  spec: 'src/features/personalization/spec.md',
} satisfies FeatureDefinition);
export default definition;
