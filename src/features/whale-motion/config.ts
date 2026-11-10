import z from '@deepseek-ai/schemastery';

export const configFields = {
  whaleMotionEnabled: z.boolean().default(false).volatile(),
};
