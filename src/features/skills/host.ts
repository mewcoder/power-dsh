import type { NativeContext } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { HostOptions, HostService } from '../../shared/host/feature.ts';
import { SkillPolicy } from './skill-policy.ts';

export function createHost(ctx: NativeContext, config: LivePreferences, { owner, ensureActive }: HostOptions) {
  const skills: { current: SkillPolicy | null } = { current: null };
  ctx.inject(['skills', 'agents', 'agentPresets', 'workspaceRegistry', 'workingDirectory', 'loader'], child => {
    const manager = new SkillPolicy(owner, config, { ensureActive });
    skills.current = manager;
    // Use the running Host's scope module so registry identities match.
    manager.ready = child.loader.import('@deepseek-ai/dsh-scope').then(({ createScope }) => {
      ensureActive();
      if (!manager.closed) manager.bind(child, createScope);
    });
    void manager.ready.catch(() => {}); // Requests report initialization errors, without rejecting Host boot.
    child.effect(() => () => {
      if (skills.current === manager) skills.current = null;
      return manager.close();
    });
  });
  return { skills };
}

export const methods = {
  listSkills(cwd: string, scope: string) {
    return this.run(() => {
      if (!this.skills.current) throw new Error('DSH skill management is unavailable.');
      return this.skills.current.list(cwd, scope);
    });
  },
  readSkill(cwd: string, scope: string, name: string) {
    return this.run(() => {
      if (!this.skills.current) throw new Error('DSH skill management is unavailable.');
      return this.skills.current.read(cwd, scope, name);
    });
  },
  setSkillEnabled(cwd: string, scope: string, name: string, enabled: boolean) {
    return this.run(() => {
      if (!this.skills.current) throw new Error('DSH skill management is unavailable.');
      return this.skills.current.setEnabled(cwd, scope, name, enabled);
    });
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
