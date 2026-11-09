import type { NativeContext } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { HostOptions, HostService } from '../../shared/host/feature.ts';
import { SearchPolicy } from './search-policy.ts';

export function createHost(ctx: NativeContext, config: LivePreferences, { owner, ensureActive }: HostOptions) {
  const search = new SearchPolicy(owner, config, { ensureActive });
  ctx.inject(['agents', 'agentPresets'], child => search.bind(child));
  return { search };
}

export const methods = {
  async setSearchBlocked(blocked: boolean) {
    return this.run(() => this.search.setBlocked(blocked));
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
