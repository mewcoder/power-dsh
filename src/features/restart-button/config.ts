import z from '@deepseek-ai/schemastery';

export const configFields = {
  showRestartButton: z.boolean().default(false).volatile(),
};
