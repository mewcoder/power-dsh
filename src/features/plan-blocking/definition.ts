import type { FeatureDefinition } from '../../shared/types/feature.ts';

export const definition = Object.freeze({
  id: 'plan-blocking', category: 'simplify', order: 11.5,
  keys: Object.freeze(['blockPlan'] as const),
  spec: 'src/features/plan-blocking/spec.md',
} satisfies FeatureDefinition);
export default definition;
