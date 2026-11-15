import z from '@deepseek-ai/schemastery';

export const configFields = {
  blockOfficialSearch: z.boolean().default(false).volatile(),
};
