import type { NativeContext } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { HostOptions, HostService } from '../../shared/host/feature.ts';
import { ArchiveService } from './archive-service.ts';

export function createHost(ctx: NativeContext, _config: LivePreferences, _options: HostOptions) {
  const archive = new ArchiveService();
  ctx.inject(['workspaceController', 'sessionQuery'], child => {
    archive.workspaceController = child.workspaceController ?? null;
    archive.sessionQuery = child.sessionQuery ?? null;
    child.effect(() => () => {
      archive.workspaceController = null;
      archive.sessionQuery = null;
    });
  });
  ctx.inject(['sessionPersistence'], child => {
    archive.sessionPersistence = child.sessionPersistence ?? null;
    child.effect(() => () => {
      archive.sessionPersistence = null;
    });
  });
  return { archive };
}

export const methods = {
  listArchivedSessions() {
    return this.run(() => this.archive.list());
  },
  restoreArchivedSession(sessionId: string) {
    return this.run(() => this.archive.restore(sessionId));
  },
  deleteArchivedSession(sessionId: string) {
    return this.run(() => this.archive.delete(sessionId));
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
