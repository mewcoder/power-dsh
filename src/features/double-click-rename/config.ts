import type { SettingsToolContribution } from '../../shared/host/feature.ts';
import z from '@deepseek-ai/schemastery';

export const configFields = {
  blockDoubleClickRename: z.boolean().default(false).volatile(),
};

export const settingsTool: SettingsToolContribution = {
  parameters: {
    blockDoubleClickRename: {
      type: 'boolean',
      description: 'Block double-click renaming in the sidebar session list when true. Menu and keyboard renaming remain available. Omit to keep it unchanged.',
    },
  },
  output: {
    blockDoubleClickRename: { type: 'boolean', required: true },
  },
  mutations: [{ field: 'blockDoubleClickRename', order: 4 }],
  reads: [{ order: 6,
    read({ config }) {
      return { blockDoubleClickRename: config.blockDoubleClickRename.get() };
    },
  }],
};
