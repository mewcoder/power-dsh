import type { FeatureDefinition } from '../../shared/types/feature.ts';
// Environment-independent metadata shared by Host and Client.
export const definition = Object.freeze({
  id: 'projects', category: 'enhance', order: 10.5,
  keys: Object.freeze(['projectManagerEnabled'] as const),
  spec: 'src/features/projects/spec.md',
} satisfies FeatureDefinition);
export default definition;
