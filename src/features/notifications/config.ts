import z from '@deepseek-ai/schemastery';

export const configFields = {
  notificationsEnabled: z.boolean().default(false).volatile(),
  notificationMode: z.string().default('background').volatile(),
  notificationSoundEnabled: z.boolean().default(true).volatile(),
  notificationSound: z.string().default('default').volatile(),
};
