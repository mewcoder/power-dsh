import type { FeatureDefinition } from '../../shared/types/feature.ts';

export const definition = Object.freeze({
  id: 'whale-motion', category: 'interface', order: 5.5,
  keys: Object.freeze(['whaleMotionEnabled'] as const),
  spec: 'src/features/whale-motion/spec.md',
} satisfies FeatureDefinition);
