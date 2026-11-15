import z from '@deepseek-ai/schemastery';

export const configFields = {
  showThemeSwitcher: z.boolean().default(false).volatile(),
};
