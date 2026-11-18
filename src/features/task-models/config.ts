import z from '@deepseek-ai/schemastery';

export const configFields = {
  taskModelsEnabled: z.boolean().default(false).volatile(),
  taskModelBindings: z.string().default('{}').volatile(),
};
