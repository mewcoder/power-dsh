import type { SettingsToolContribution } from '../../shared/host/feature.ts';
import z from '@deepseek-ai/schemastery';

export const configFields = {
  blockPlan: z.boolean().default(false).volatile(),
};

export const settingsTool: SettingsToolContribution = {
  parameters: {
    blockPlan: {
      type: 'boolean',
      description: 'Disable native Plan mode globally and in mode declarations for new conversations when true; false enables matching plugins. Already-open conversations keep their current mode revision. Plan history is preserved. Omit to keep it unchanged.',
    },
  },
  output: { blockPlan: { type: 'boolean', required: true } },
  mutations: [{ field: 'blockPlan', order: 9, method: 'setPlanBlocked' }],
  reads: [{ order: 0, read({ config }) { return { blockPlan: config.blockPlan.get() }; } }],
};
