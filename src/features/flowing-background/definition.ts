import type { FeatureDefinition } from '../../shared/types/feature.ts';
export const definition = Object.freeze({
  id: 'flowing-background', category: 'interface', order: 5,
  keys: Object.freeze(['flowingBackgroundEnabled', 'flowingBackgroundKind', 'flowingBackgroundOpacity', 'flowingBackgroundBlur', 'showBackgroundShortcut'] as const),
  spec: 'src/features/flowing-background/spec.md',
} satisfies FeatureDefinition);
