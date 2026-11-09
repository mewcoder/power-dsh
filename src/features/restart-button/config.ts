import type { SettingsToolContribution } from '../../shared/host/feature.ts';
import z from '@deepseek-ai/schemastery';

export const configFields = {
  showRestartButton: z.boolean().default(false).volatile(),
};

export const settingsTool: SettingsToolContribution = {
  parameters: {
    showRestartButton: {
      type: 'boolean',
      description: 'Show the desktop application restart button when supported. This preference does not restart the application. Omit to keep it unchanged.',
    },
  },
  output: {
    showRestartButton: { type: 'boolean', required: true },
  },
  mutations: [{ field: 'showRestartButton', order: 3 }],
  reads: [{ order: 5,
    read({ config }) {
      return { showRestartButton: config.showRestartButton.get() };
    },
  }],
};
