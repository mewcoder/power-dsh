import type { FeatureDefinition } from '../../shared/types/feature.ts';
// Environment-independent metadata shared by Host and Client.
export const definition = Object.freeze({
  id: 'search-popup', category: 'interface', order: 8.5,
  keys: Object.freeze(['searchPopupEnabled'] as const),
  spec: 'src/features/search-popup/spec.md',
} satisfies FeatureDefinition);
export default definition;
