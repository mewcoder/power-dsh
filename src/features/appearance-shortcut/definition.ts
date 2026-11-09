import type { FeatureDefinition } from '../../shared/types/feature.ts';
// Environment-independent metadata shared by Host and Client.
export const definition = Object.freeze({
  id: 'appearance-shortcut', category: 'interface', order: 4,
  keys: Object.freeze(['showThemeSwitcher'] as const),
  spec: 'src/features/appearance-shortcut/spec.md',
} satisfies FeatureDefinition);
export default definition;
