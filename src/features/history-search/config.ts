import z from '@deepseek-ai/schemastery';

export const configFields = {
  historySearchEnabled: z.boolean().default(false).volatile(),
};
