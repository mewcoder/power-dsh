import type { SettingsToolContribution } from '../../shared/host/feature.ts';
import z from '@deepseek-ai/schemastery';

export const configFields = {
  blockGoal: z.boolean().default(false).volatile(),
};

export const settingsTool: SettingsToolContribution = {
  parameters: {
    blockGoal: {
      type: 'boolean',
      description: 'Disable the built-in Goal command and tools globally and in mode declarations for new conversations when true; false enables matching plugins. Already-open conversations keep their mode revision. Existing goals, automatic continuation and history are preserved. Omit to keep it unchanged.',
    },
  },
  output: { blockGoal: { type: 'boolean', required: true } },
  mutations: [{ field: 'blockGoal', order: 10, method: 'setGoalBlocked' }],
  reads: [{ order: 0, read({ config }) { return { blockGoal: config.blockGoal.get() }; } }],
};
