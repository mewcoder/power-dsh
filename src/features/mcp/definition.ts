import type { FeatureDefinition } from '../../shared/types/feature.ts';
// Environment-independent metadata shared by Host and Client.
export const definition = Object.freeze({
  id: 'mcp', category: 'management', order: 9.5,
  keys: Object.freeze(['mcpManagerEnabled'] as const),
  spec: 'src/features/mcp/spec.md',
} satisfies FeatureDefinition);
export default definition;
