import z from '@deepseek-ai/schemastery';

export const configFields = {
  blockPlan: z.boolean().default(false).volatile(),
};
