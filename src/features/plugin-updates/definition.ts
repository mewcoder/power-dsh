import type { FeatureDefinition } from '../../shared/types/feature.ts';

export const definition = Object.freeze({
  id: 'plugin-updates', category: 'other', order: 100,
  keys: Object.freeze(['pluginUpdatesEnabled'] as const),
  spec: 'src/features/plugin-updates/spec.md',
} satisfies FeatureDefinition);
