import z from '@deepseek-ai/schemastery';

export const configFields = {
  searchPopupEnabled: z.boolean().default(false).volatile(),
};
