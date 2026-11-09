import z from '@deepseek-ai/schemastery';
export const configFields = {
  flowingBackgroundEnabled: z.boolean().default(false).volatile(),
};
