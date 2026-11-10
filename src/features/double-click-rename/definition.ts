import type { FeatureDefinition } from '../../shared/types/feature.ts';
// Environment-independent metadata shared by Host and Client.
export const definition = Object.freeze({
  id: 'double-click-rename', category: 'other', order: 3,
  keys: Object.freeze(['blockDoubleClickRename'] as const),
  spec: 'src/features/double-click-rename/spec.md',
} satisfies FeatureDefinition);
export default definition;
