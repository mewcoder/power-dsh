import type { FeatureDefinition } from '../../shared/types/feature.ts';

export const definition = Object.freeze({
  id: 'goal-blocking', category: 'simplify', order: 11.75,
  keys: Object.freeze(['blockGoal'] as const),
  spec: 'src/features/goal-blocking/spec.md',
} satisfies FeatureDefinition);
export default definition;
