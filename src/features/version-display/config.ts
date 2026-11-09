import type { SettingsToolContribution } from '../../shared/host/feature.ts';
import z from '@deepseek-ai/schemastery';

export const configFields = {
  showVersion: z.boolean().default(false).volatile(),
};

export const settingsTool: SettingsToolContribution = {
  parameters: {
    showVersion: {
      type: 'boolean',
      description: 'Show the DSH version beside the upper-left brand when true. Omit to keep it unchanged.',
    },
  },
  output: {
    showVersion: { type: 'boolean', required: true },
    version: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true },
  },
  mutations: [{ field: 'showVersion', order: 0 }],
  reads: [{ order: 2,
    read({ config }) {
      return { showVersion: config.showVersion.get() };
    },
  }, { order: 9,
    read({ ctx }) {
      return { version: ctx.clientModules.graph().release?.version ?? null };
    },
  }],
};
