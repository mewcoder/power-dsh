import type { FeatureDefinition } from '../../shared/types/feature.ts';
// Environment-independent metadata shared by Host and Client.
export const definition = Object.freeze({
  id: 'account-blocking', category: 'simplify', order: 8,
  keys: Object.freeze(['blockOfficialAccount'] as const),
  spec: 'src/features/account-blocking/spec.md',
} satisfies FeatureDefinition);
export default definition;
