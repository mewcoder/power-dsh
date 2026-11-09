import type { NativeContext } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { HostOptions, HostService } from '../../shared/host/feature.ts';
import { AccountPolicy } from './account-policy.ts';

export function createHost(_ctx: NativeContext, _config: LivePreferences, { owner, ensureActive }: HostOptions) {
  return { policy: new AccountPolicy(owner, { ensureActive }) };
}

export const methods = {
  async setAccountBlocked(blocked: boolean) {
    return this.run(() => this.policy.setBlocked(blocked));
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
