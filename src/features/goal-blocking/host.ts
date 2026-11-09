import type { NativeContext } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { HostOptions, HostService } from '../../shared/host/feature.ts';
import { GoalPolicy } from './goal-policy.ts';

export function createHost(ctx: NativeContext, config: LivePreferences, { owner, ensureActive }: HostOptions) {
  const goal = new GoalPolicy(owner, config, { ensureActive });
  ctx.inject(['agentPresets'], child => goal.bind(child));
  return { goal };
}

export const methods = {
  async setGoalBlocked(blocked: boolean) {
    return this.run(() => this.goal.setBlocked(blocked));
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
