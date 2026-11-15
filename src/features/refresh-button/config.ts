import z from '@deepseek-ai/schemastery';

export const configFields = {
  showRefreshButton: z.boolean().default(false).volatile(),
};
