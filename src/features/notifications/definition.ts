import type { FeatureDefinition } from '../../shared/types/feature.ts';
// Environment-independent metadata shared by Host and Client.
export const definition = Object.freeze({
  id: 'notifications', category: 'general', order: 0,
  keys: Object.freeze(['notificationsEnabled', 'notificationMode', 'notificationSoundEnabled', 'notificationSound'] as const),
  spec: 'src/features/notifications/spec.md',
} satisfies FeatureDefinition);
export default definition;
