import type { FeatureDefinition } from '../../shared/types/feature.ts';

export const definition = Object.freeze({
  id: 'standalone-page', category: 'enhance', order: 6.5,
  keys: Object.freeze(['standalonePageEnabled'] as const),
  spec: 'src/features/standalone-page/spec.md',
} satisfies FeatureDefinition);
export default definition;
