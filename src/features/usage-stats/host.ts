import type { NativeContext } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { HostOptions, HostService } from '../../shared/host/feature.ts';
import { UsageService } from './usage-service.ts';

export function createHost(ctx: NativeContext, _config: LivePreferences, _options: HostOptions) {
  const usage = new UsageService();
  // Session persistence is optional: a Host without it still loads the Mod,
  // and the page reports that statistics are unavailable.
  ctx.inject(['sessionPersistence'], child => {
    usage.persistence = (child.sessionPersistence as unknown as UsageService['persistence']) ?? null;
    child.effect(() => () => {
      usage.persistence = null;
    });
  });
  return { usage };
}

export const methods = {
  readUsageStats(timeZone: string) {
    return this.run(() => this.usage.snapshot(timeZone));
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
