import z from '@deepseek-ai/schemastery';

export const configFields = {
  standalonePageEnabled: z.boolean().default(false).volatile(),
};
