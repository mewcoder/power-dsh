import type { NativeContext } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { HostOptions, HostService } from '../../shared/host/feature.ts';
import { TodoPolicy } from './todo-policy.ts';

export function createHost(ctx: NativeContext, config: LivePreferences, { owner, ensureActive }: HostOptions) {
  const todo = new TodoPolicy(owner, config, { ensureActive });
  ctx.inject(['agentPresets'], child => todo.bind(child));
  return { todo };
}

export const methods = {
  async setTodoBlocked(blocked: boolean) {
    return this.run(() => this.todo.setBlocked(blocked));
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
