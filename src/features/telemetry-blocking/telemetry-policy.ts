import type { NativeContext, NativePlugin, LifecycleOptions } from '../../shared/host/native.ts';
import { PluginPolicy } from '../../shared/host/plugin-policy.ts';

// Disable intake before exporter; enable exporter before intake.
const TARGETS = [
  ['product-analytics', '@deepseek-ai/dsh-client-product-analytics'],
  ['ui-message-feedback', '@deepseek-ai/dsh-client-ui-message-feedback'],
  ['command-feedback', '@deepseek-ai/dsh-command-feedback'],
  ['session-log-deepseek', '@deepseek-ai/dsh-session-log-deepseek'],
  ['plugin-package-inventory-deepseek', '@deepseek-ai/dsh-plugin-package-inventory-deepseek'],
  ['session-telemetry-otel', '@deepseek-ai/dsh-session-telemetry-otel'],
  ['desktop-product-telemetry', '@deepseek-ai/dsh-host-product-telemetry-otel'],
];

function matches(entry: NativePlugin) {
  return TARGETS.some(([id, name]) => entry.entryId === `include:${id}`
    && entry.patchId === id && entry.moduleName === name);
}

export class TelemetryPolicy extends PluginPolicy {
  constructor(ctx: NativeContext, options: LifecycleOptions = {}) {
    super(ctx, {
      matches, flag: 'blockOfficialTelemetry', label: 'official-telemetry',
    }, options);
  }

  targets(entries: NativePlugin[]) {
    return TARGETS.flatMap(([id]) => entries.filter(entry => entry.patchId === id && matches(entry)));
  }

  async protected() { return (await this.status()).protected; }

  async status() {
    const entries = await this.ctx.pluginManager.listPlugins();
    const senders = TARGETS.map(([id, name]) => {
      const entry = entries.find(item => item.entryId === `include:${id}` && item.moduleName === name && item.patchId === id);
      return { id, available: Boolean(entry), enabled: entry?.enabled ?? false, active: entry?.fiberPhase === 'active' };
    });
    return {
      protected: senders.some(item => item.available) && senders.every(item => !item.enabled && !item.active),
      senders,
    };
  }
}
