import z from '@deepseek-ai/schemastery';
export const configFields = {
  flowingBackgroundEnabled: z.boolean().default(false).volatile(),
  flowingBackgroundKind: z.string().default('pattern').volatile(),
  flowingBackgroundOpacity: z.number().default(100).volatile(),
  flowingBackgroundBlur: z.number().default(0).volatile(),
  // Retained for old profiles; no setting or sidebar shortcut reads this value.
  showBackgroundShortcut: z.boolean().default(false).volatile(),
};
