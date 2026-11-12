import z from '@deepseek-ai/schemastery';

export const configFields = {
  pluginUpdatesEnabled: z.boolean().default(true).volatile(),
};
