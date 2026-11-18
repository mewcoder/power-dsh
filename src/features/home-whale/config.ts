import z from '@deepseek-ai/schemastery';

export const configFields = { homeWhaleFocusEnabled: z.boolean().default(false).volatile() };
