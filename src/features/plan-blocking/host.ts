import type { NativeContext } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { HostOptions, HostService } from '../../shared/host/feature.ts';
import { PlanPolicy } from './plan-policy.ts';

export function createHost(ctx: NativeContext, config: LivePreferences, { owner, ensureActive }: HostOptions) {
  const plan = new PlanPolicy(owner, config, { ensureActive });
  ctx.inject(['agentPresets'], child => plan.bind(child));
  return { plan };
}

export const methods = {
  async setPlanBlocked(blocked: boolean) {
    return this.run(() => this.plan.setBlocked(blocked));
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
