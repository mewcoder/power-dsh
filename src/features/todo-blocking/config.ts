import z from '@deepseek-ai/schemastery';

export const configFields = {
  blockTodo: z.boolean().default(false).volatile(),
};
