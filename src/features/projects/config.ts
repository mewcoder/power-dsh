import z from '@deepseek-ai/schemastery';

export const configFields = {
  projectManagerEnabled: z.boolean().default(false).volatile(),
};
