import type { FeatureDefinition } from '../../shared/types/feature.ts';
// Environment-independent metadata shared by Host and Client.
export const definition = Object.freeze({
  id: 'version-display', category: 'interface', order: 6,
  keys: Object.freeze(['showVersion'] as const),
  spec: 'src/features/version-display/spec.md',
} satisfies FeatureDefinition);
export default definition;
