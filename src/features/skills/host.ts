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
  discoverExternalSkills(cwd: string, scope: string) {
    return this.run(() => {
      if (!this.skills.current) throw new Error('DSH skill management is unavailable.');
      return this.skills.current.discoverExternalSkills(cwd, scope);
    });
  },
  readExternalSkill(cwd: string, scope: string, id: string) {
    return this.run(() => {
      if (!this.skills.current) throw new Error('DSH skill management is unavailable.');
      return this.skills.current.readExternal(cwd, scope, id);
    });
  },
  importExternalSkills(cwd: string, scope: string, ids: string[]) {
    return this.run(() => {
      if (!this.skills.current) throw new Error('DSH skill management is unavailable.');
      return this.skills.current.importExternalSkills(cwd, scope, ids);
    });
  },
  addSkill(cwd: string, scope: string, id: string, mode: string, revision: string) {
    return this.run(() => {
      if (!this.skills.current) throw new Error('DSH skill management is unavailable.');
      return this.skills.current.addSkill(cwd, scope, id, mode, revision);
    });
  },
  readSkillImportDestination(cwd: string, scope: string, name: string, flat: boolean) {
    return this.run(() => {
      if (!this.skills.current) throw new Error('DSH skill management is unavailable.');
      return this.skills.current.readSkillImportDestination(cwd, scope, name, flat);
    });
  },
  importSkillTo(cwd: string, scope: string, id: string, revision: string, targetCwd: string) {
    return this.run(() => {
      if (!this.skills.current) throw new Error('DSH skill management is unavailable.');
      return this.skills.current.importSkillTo(cwd, scope, id, revision, targetCwd);
    });
  },
  deleteSkill(cwd: string, scope: string, name: string, revision: string) {
    return this.run(() => {
      if (!this.skills.current) throw new Error('DSH skill management is unavailable.');
      return this.skills.current.deleteSkill(cwd, scope, name, revision).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : '';
        throw new Error(['skill-delete-changed', 'skill-delete-readback-failed', 'skill-delete-unavailable'].includes(message)
          ? message : 'skill-delete-failed');
      });
    });
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
