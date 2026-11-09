import z from '@deepseek-ai/schemastery';

export const configFields = {
  personalizationEnabled: z.boolean().default(false).volatile(),
};
