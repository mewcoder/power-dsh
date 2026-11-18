import type { FeatureDefinition } from '../../shared/types/feature.ts';

export const definition = Object.freeze({
  id: 'home-whale', category: 'interface', order: 2,
  keys: Object.freeze(['homeWhaleFocusEnabled'] as const),
  spec: 'src/features/home-whale/spec.md',
} satisfies FeatureDefinition);
