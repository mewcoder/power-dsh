import z from '@deepseek-ai/schemastery';

export const configFields = {
  blockOfficialAccount: z.boolean().default(false).volatile(),
};
