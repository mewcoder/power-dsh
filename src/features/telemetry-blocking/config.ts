import type { SettingsToolContribution } from '../../shared/host/feature.ts';
import z from '@deepseek-ai/schemastery';

export const configFields = {
  blockOfficialTelemetry: z.boolean().default(false).volatile(),
};

export const settingsTool: SettingsToolContribution = {
  parameters: {
    blockOfficialTelemetry: {
      type: 'boolean',
      description: 'Disable built-in analytics, its exporter, feedback UI and command, Session-log uploads and plugin inventory reporting when true; false enables those plugins. Local logs and update checks are unaffected; in-flight and queued uploads may finish. Omit to keep it unchanged.',
    },
  },
  output: {
    blockOfficialTelemetry: { type: 'boolean', required: true },
    telemetry: {
      type: 'object', required: true, additionalProperties: false,
      properties: {
        protected: { type: 'boolean', required: true },
        senders: {
          type: 'array', required: true, items: {
            type: 'object', additionalProperties: false, properties: {
              id: { type: 'string', required: true },
              enabled: { type: 'boolean', required: true },
              active: { type: 'boolean', required: true },
              available: { type: 'boolean', required: true },
            },
          },
        },
      },
    },
  },
  mutations: [{ field: 'blockOfficialTelemetry', order: 6, method: 'setTelemetryBlocked' }],
  reads: [{ order: 1,
    async read({ config, service }) {
      return { blockOfficialTelemetry: config.blockOfficialTelemetry.get(), telemetry: await service.telemetry.status() };
    },
  }],
};
