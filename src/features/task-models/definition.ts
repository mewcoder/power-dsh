import type { FeatureDefinition } from '../../shared/types/feature.ts';

export const definition = Object.freeze({
  id: 'task-models', category: 'enhance', order: 15,
  keys: Object.freeze(['taskModelsEnabled', 'taskModelBindings'] as const),
  spec: 'src/features/task-models/spec.md',
} satisfies FeatureDefinition);
