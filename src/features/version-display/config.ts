import z from '@deepseek-ai/schemastery';

export const configFields = {
  showVersion: z.boolean().default(false).volatile(),
};
