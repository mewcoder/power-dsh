import type { SettingsToolContribution } from '../../shared/host/feature.ts';
import z from '@deepseek-ai/schemastery';

export const configFields = {
  blockTodo: z.boolean().default(false).volatile(),
};

export const settingsTool: SettingsToolContribution = {
  parameters: {
    blockTodo: {
      type: 'boolean',
      description: 'Disable the Todo tool plugin globally and in mode declarations for new conversations when true; false enables matching plugins. Already-open conversations keep their current mode revision. Session history and the conversation UI are preserved. Omit to keep it unchanged.',
    },
  },
  output: {
    blockTodo: { type: 'boolean', required: true },
  },
  mutations: [{ field: 'blockTodo', order: 7, method: 'setTodoBlocked' }],
  reads: [{ order: 0,
    read({ config }) {
      return { blockTodo: config.blockTodo.get() };
    },
  }],
};
