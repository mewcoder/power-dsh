import z from '@deepseek-ai/schemastery';

export const configFields = {
  blockDoubleClickRename: z.boolean().default(false).volatile(),
};
