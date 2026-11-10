import type { NativeContext } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { HostOptions, HostService } from '../../shared/host/feature.ts';
import { ProjectsService } from './projects-service.ts';

export function createHost(ctx: NativeContext, _config: LivePreferences, _options: HostOptions) {
  const projects = new ProjectsService();
  ctx.inject(['workspaceController', 'sessionController'], child => {
    projects.workspaceController = child.workspaceController ?? null;
    projects.sessionController = child.sessionController ?? null;
    child.effect(() => () => {
      projects.workspaceController = null;
      projects.sessionController = null;
    });
  });
  return { projects };
}

export const methods = {
  listProjects() {
    return this.run(() => this.projects.list());
  },
  removeProject(workspaceId: string) {
    return this.run(() => this.projects.remove(workspaceId));
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
