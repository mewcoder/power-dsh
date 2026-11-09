import type { FeatureDefinition } from '../../shared/types/feature.ts';
// Environment-independent metadata shared by Host and Client.
export const definition = Object.freeze({
  id: 'skills', category: 'enhance', order: 7,
  keys: Object.freeze(['skillManagerEnabled', 'disabledSkills'] as const),
  spec: 'src/features/skills/spec.md',
} satisfies FeatureDefinition);
export default definition;
