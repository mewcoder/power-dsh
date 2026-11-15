import z from '@deepseek-ai/schemastery';

export const configFields = {
  memoryEnabled: z.boolean().default(false).volatile(),
  memoryAutoCapture: z.boolean().default(true).volatile(),
  memoryGlobalEnabled: z.boolean().default(true).volatile(),
  memoryWorkspaceEnabled: z.boolean().default(true).volatile(),
};
