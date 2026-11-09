import type { FeatureDefinition } from '../../shared/types/feature.ts';
// Environment-independent metadata shared by Host and Client.
export const definition = Object.freeze({
  id: 'todo-blocking', category: 'simplify', order: 11,
  keys: Object.freeze(['blockTodo'] as const),
  spec: 'src/features/todo-blocking/spec.md',
} satisfies FeatureDefinition);
export default definition;
