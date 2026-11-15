import z from '@deepseek-ai/schemastery';

export const configFields = {
  blockGoal: z.boolean().default(false).volatile(),
};
