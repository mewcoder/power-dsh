import z from '@deepseek-ai/schemastery';

export const configFields = {
  archiveManagerEnabled: z.boolean().default(false).volatile(),
};
