import type { FeatureDefinition } from '../../shared/types/feature.ts';
// Environment-independent metadata shared by Host and Client.
export const definition = Object.freeze({
  id: 'search-blocking', category: 'simplify', order: 9,
  keys: Object.freeze(['blockOfficialSearch'] as const),
  spec: 'src/features/search-blocking/spec.md',
} satisfies FeatureDefinition);
export default definition;
