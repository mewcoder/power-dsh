import type { SettingsToolContribution } from '../../shared/host/feature.ts';
import z from '@deepseek-ai/schemastery';

export const configFields = {
  blockOfficialSearch: z.boolean().default(false).volatile(),
};

export const settingsTool: SettingsToolContribution = {
  parameters: {
    blockOfficialSearch: {
      type: 'boolean',
      description: 'Disable built-in web_search globally and in modes when true; false enables search in active matching tool declarations. Web fetch, third-party MCP search, and other preferences are preserved. Existing sessions may need reopening after re-enabling. Omit to keep it unchanged.',
    },
  },
  output: {
    blockOfficialSearch: { type: 'boolean', required: true },
  },
  mutations: [{ field: 'blockOfficialSearch', order: 8, method: 'setSearchBlocked' }],
  reads: [{ order: 8,
    read({ config }) {
      return { blockOfficialSearch: config.blockOfficialSearch.get() };
    },
  }],
};
