import type { FeatureDefinition } from '../../shared/types/feature.ts';
// Environment-independent metadata shared by Host and Client.
export const definition = Object.freeze({
  id: 'archive', category: 'enhance', order: 10,
  keys: Object.freeze(['archiveManagerEnabled'] as const),
  spec: 'src/features/archive/spec.md',
} satisfies FeatureDefinition);
export default definition;
