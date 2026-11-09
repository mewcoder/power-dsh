import type { SettingsToolContribution } from '../../shared/host/feature.ts';
import z from '@deepseek-ai/schemastery';

export const configFields = {
  blockOfficialAccount: z.boolean().default(false).volatile(),
};

export const settingsTool: SettingsToolContribution = {
  parameters: {
    blockOfficialAccount: {
      type: 'boolean',
      description: 'Disable official-account UI, account models, and the built-in DeepSeek API-key integration when true; false enables those plugins. Separately added and third-party providers and stored credentials are preserved. Omit to keep it unchanged.',
    },
  },
  output: {
    blockOfficialAccount: { type: 'boolean', required: true },
  },
  mutations: [{ field: 'blockOfficialAccount', order: 5, method: 'setAccountBlocked' }],
  reads: [{ order: 7,
    read({ config }) {
      return { blockOfficialAccount: config.blockOfficialAccount.get() };
    },
  }],
};
