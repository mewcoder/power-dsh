import type { FeatureDefinition } from '../../shared/types/feature.ts';
// Environment-independent metadata shared by Host and Client.
export const definition = Object.freeze({
  id: 'thinking-effort', category: 'interface', order: 3,
  keys: Object.freeze(['showThinkingEffortSwitcher', 'thinkingEffortGlyph'] as const),
  spec: 'src/features/thinking-effort/spec.md',
} satisfies FeatureDefinition);
export default definition;
