import type { FeatureDefinition } from '../../shared/types/feature.ts';
// Environment-independent metadata shared by Host and Client.
export const definition = Object.freeze({
  id: 'mcp', category: 'enhance', order: 8,
  keys: Object.freeze(['mcpManagerEnabled'] as const),
  spec: 'src/features/mcp/spec.md',
} satisfies FeatureDefinition);
export default definition;
