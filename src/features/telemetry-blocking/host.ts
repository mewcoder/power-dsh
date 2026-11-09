import type { NativeContext } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { HostOptions, HostService } from '../../shared/host/feature.ts';
import { TelemetryPolicy } from './telemetry-policy.ts';

export function createHost(_ctx: NativeContext, _config: LivePreferences, { owner, ensureActive }: HostOptions) {
  return { telemetry: new TelemetryPolicy(owner, { ensureActive }) };
}

export const methods = {
  async setTelemetryBlocked(blocked: boolean) {
    return this.run(() => this.telemetry.setBlocked(blocked));
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
