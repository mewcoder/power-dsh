import type { NativeContext } from '../../shared/host/native.ts';
import type { HostService } from '../../shared/host/feature.ts';
import { PluginReleases } from './releases.ts';
import manifest from '../../../package.json' with { type: 'json' };

export function createHost(ctx: NativeContext) {
  return { pluginReleases: new PluginReleases(ctx) };
}

export const methods = {
  pluginRuntimeVersion() {
    return this.run(() => manifest.version);
  },
  readPluginRelease() {
    return this.run(() => this.pluginReleases.read());
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
