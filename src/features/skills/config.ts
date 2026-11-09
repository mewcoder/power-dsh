import z from '@deepseek-ai/schemastery';

export const configFields = {
  skillManagerEnabled: z.boolean().default(false).volatile(),
  disabledSkills: z.array(z.object({
    name: z.string().required(), description: z.string().required(), source: z.string().required(),
    provider: z.string().required(), path: z.string().required(),
    scope: z.string().default(''), projectRoot: z.string().default(''), origin: z.string().default(''),
  })).default([]).volatile(),
};
