import z from '@deepseek-ai/schemastery';

export const configFields = {
  showThinkingEffortSwitcher: z.boolean().default(false).volatile(),
  thinkingEffortGlyph: z.string().default('arc').volatile(),
};
