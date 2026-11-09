import type { SettingsToolContribution } from '../../shared/host/feature.ts';
import z from '@deepseek-ai/schemastery';

export const configFields = {
  showThemeSwitcher: z.boolean().default(false).volatile(),
};

export const settingsTool: SettingsToolContribution = {
  parameters: {
    showThemeSwitcher: {
      type: 'boolean',
      description: 'Show the appearance shortcut at the sidebar bottom when expanded. Omit to keep it unchanged.',
    },
  },
  output: {
    showThemeSwitcher: { type: 'boolean', required: true },
  },
  mutations: [{ field: 'showThemeSwitcher', order: 1 }],
  reads: [{ order: 3,
    read({ config }) {
      return { showThemeSwitcher: config.showThemeSwitcher.get() };
    },
  }],
};
