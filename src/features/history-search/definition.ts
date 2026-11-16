import type { FeatureDefinition } from '../../shared/types/feature.ts';

export const definition = Object.freeze({
  id: 'history-search', category: 'enhance', order: 20,
  keys: Object.freeze(['historySearchEnabled'] as const),
  spec: 'src/features/history-search/spec.md',
} satisfies FeatureDefinition);
