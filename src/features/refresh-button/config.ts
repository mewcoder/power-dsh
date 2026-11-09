import type { SettingsToolContribution } from '../../shared/host/feature.ts';
import z from '@deepseek-ai/schemastery';

export const configFields = {
  showRefreshButton: z.boolean().default(false).volatile(),
};

export const settingsTool: SettingsToolContribution = {
  parameters: {
    showRefreshButton: {
      type: 'boolean',
      description: 'Show the interface refresh button while the sidebar is expanded. This preference does not trigger a refresh. Omit to keep it unchanged.',
    },
  },
  output: {
    showRefreshButton: { type: 'boolean', required: true },
  },
  mutations: [{ field: 'showRefreshButton', order: 2 }],
  reads: [{ order: 4,
    read({ config }) {
      return { showRefreshButton: config.showRefreshButton.get() };
    },
  }],
};
