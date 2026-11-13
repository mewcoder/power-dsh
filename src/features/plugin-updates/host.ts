import type { NativeContext } from '../../shared/host/native.ts';
import type { HostService } from '../../shared/host/feature.ts';
import { PluginReleases } from './releases.ts';

export function createHost(ctx: NativeContext) {
  return { pluginReleases: new PluginReleases(ctx) };
}

export const methods = {
  readPluginRelease() {
    return this.run(() => this.pluginReleases.read());
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
