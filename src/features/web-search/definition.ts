import type { FeatureDefinition } from '../../shared/types/feature.ts';

export const definition = Object.freeze({
  id: 'web-search', category: 'enhance', order: 9.6,
  keys: Object.freeze(['webSearchEnabled', 'webSearchChain', 'webFetchChain'] as const),
  spec: 'src/features/web-search/spec.md',
} satisfies FeatureDefinition);
export default definition;
