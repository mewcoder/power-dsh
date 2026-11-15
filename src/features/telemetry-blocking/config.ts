import z from '@deepseek-ai/schemastery';

export const configFields = {
  blockOfficialTelemetry: z.boolean().default(false).volatile(),
};
