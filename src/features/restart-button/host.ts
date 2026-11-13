import type { NativeContext } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { HostOptions, HostService } from '../../shared/host/feature.ts';
import { DesktopRestart } from './restart.ts';

export function createHost(ctx: NativeContext, config: LivePreferences) {
  return { restart: new DesktopRestart(ctx, config) };
}

export const methods = {
  restartStatus() {
    return this.run(() => this.restart.status());
  },
  restartApp() {
    return this.run(() => this.restart.restart());
  },
  restartAfterUpdate() {
    return this.run(() => this.restart.restart(true));
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
