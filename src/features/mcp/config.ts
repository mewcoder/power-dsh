import z from '@deepseek-ai/schemastery';

export const configFields = {
  mcpManagerEnabled: z.boolean().default(false).volatile(),
};
