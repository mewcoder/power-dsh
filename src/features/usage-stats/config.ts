import z from '@deepseek-ai/schemastery';

export const configFields = {
  usageStatsEnabled: z.boolean().default(false).volatile(),
};
