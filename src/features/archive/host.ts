import type { NativeContext } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import { installAutoArchive } from './auto-archive-host.ts';
import type { HostOptions, HostService } from '../../shared/host/feature.ts';
import { ArchiveService, type SessionPersistenceLike, type WorkspaceArchiveStateLike } from './archive-service.ts';

export function createHost(ctx: NativeContext, config: LivePreferences, options: HostOptions) {
  const archive = new ArchiveService();
  ctx.inject(['workspaceController', 'sessionQuery'], child => {
    archive.workspaceController = child.workspaceController ?? null;
    archive.sessionQuery = child.sessionQuery ?? null;
    child.effect(() => () => {
      archive.workspaceController = null;
      archive.sessionQuery = null;
    });
  });
  ctx.inject(['sessionController'], child => {
    archive.sessionController = child.sessionController ?? null;
    child.effect(() => () => {
      archive.sessionController = null;
    });
  });

  ctx.inject(['workspaceRegistry', 'sessionPersistence', 'sessions', 'agents'], child => {
    // Public host surfaces verified in 0.2.2-rc.1; this feature alone consumes them.
    const registry = child.workspaceRegistry as typeof child.workspaceRegistry & WorkspaceArchiveStateLike;
    const persistence = child.sessionPersistence as SessionPersistenceLike | undefined;
    const sessions = (child as NativeContext & { sessions?: { get(id: string): unknown } }).sessions;
    if (!registry || !('archivedSessionIds' in registry) || typeof persistence?.open !== 'function' || typeof sessions?.get !== 'function') return;
    const access = { registry, persistence, isLive: (id: string) => sessions.get(id) !== undefined || child.agents.get(id) !== undefined };
    archive.deleteAccess = access;
    child.effect(() => () => {
      if (archive.deleteAccess === access) archive.deleteAccess = null;
    });
  });

  installAutoArchive(ctx, config, options);
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
