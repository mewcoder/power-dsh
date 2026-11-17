import type { FeatureDefinition } from '../../shared/types/feature.ts';

export const definition = Object.freeze({
  id: 'memory', category: 'management', order: 8,
  keys: Object.freeze(['memoryEnabled', 'memoryAutoCapture', 'memoryGlobalEnabled', 'memoryWorkspaceEnabled'] as const),
  spec: 'src/features/memory/spec.md',
} satisfies FeatureDefinition);
