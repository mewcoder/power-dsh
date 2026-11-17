import type { FeatureDefinition } from '../../shared/types/feature.ts';
// Environment-independent metadata shared by Host and Client.
export const definition = Object.freeze({
  id: 'archive', category: 'management', order: 10.5,
  keys: Object.freeze(['archiveManagerEnabled', 'autoArchiveDays', 'autoArchivedSessions'] as const),
  spec: 'src/features/archive/spec.md',
} satisfies FeatureDefinition);
export default definition;
