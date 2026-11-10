import type { ProjectCatalog } from '../../shared/types/wire.ts';
import { buildProjectCatalog, type ProjectBaseline } from './projects-catalog.ts';

/** Structural view of the native Workspace controller the Host exposes. */
export interface WorkspaceControllerLike {
  follow(signal: AbortSignal): AsyncIterable<{ type: string; value?: ProjectBaseline }>;
  delete(request: { workspaceId: string }): Promise<{ deleted: boolean }>;
}
/** Structural view of the native session list; it is the same activity order the sidebar shows. */
export interface SessionControllerLike {
  list(request: Record<string, never>, signal?: AbortSignal): Promise<{ items: readonly { sessionId: string; updatedAt: number }[] }>;
}

/**
 * Lists the native Workspace registrations with their session counts and latest
 * activity, and removes one registration while keeping files and sessions.
 * Holds no preferences and writes nothing else.
 */
export class ProjectsService {
  workspaceController: WorkspaceControllerLike | null = null;
  sessionController: SessionControllerLike | null = null;

  async list(): Promise<ProjectCatalog> {
    const controller = this.workspaceController;
    if (!controller) throw new Error('projectsUnavailable');
    const abort = new AbortController();
    try {
      const baseline = await readBaseline(controller, abort.signal);
      const activity = await this.activity(abort.signal);
      return buildProjectCatalog(baseline, activity);
    } finally {
      abort.abort();
    }
  }

  /**
   * Remove one Workspace registration. DSH keeps the directory and every
   * session log; sessions fall back to the ungrouped area and stay searchable.
   */
  async remove(workspaceId: string): Promise<ProjectCatalog> {
    const controller = this.workspaceController;
    if (!controller || typeof controller.delete !== 'function') throw new Error('projectsUnavailable');
    if (!validWorkspaceId(workspaceId)) throw new Error('projectsInvalidWorkspace');
    const current = await this.list();
    if (!current.projects.some(row => row.workspaceId === workspaceId)) throw new Error('projectsNotFound');
    await controller.delete({ workspaceId });
    return this.list();
  }

  /** Latest activity per session, taken from the same list the sidebar dates rows with. */
  private async activity(signal: AbortSignal) {
    const activity = new Map<string, { lastActiveAt: number }>();
    const controller = this.sessionController;
    if (!controller || typeof controller.list !== 'function') return activity;
    // Activity only decorates rows; a failing list must not hide the projects.
    const { items } = await controller.list({}, signal).catch(() => ({ items: [] }));
    for (const item of items) {
      if (typeof item?.sessionId !== 'string' || typeof item.updatedAt !== 'number' || !Number.isFinite(item.updatedAt)) continue;
      activity.set(item.sessionId, { lastActiveAt: item.updatedAt });
    }
    return activity;
  }
}

function validWorkspaceId(workspaceId: unknown): workspaceId is string {
  return typeof workspaceId === 'string' && workspaceId.length > 0 && workspaceId.length <= 1024;
}

/** Resolve the first complete Workspace baseline and stop the stream. */
async function readBaseline(controller: WorkspaceControllerLike, signal: AbortSignal): Promise<ProjectBaseline> {
  for await (const frame of controller.follow(signal)) {
    if ((frame.type === 'baseline' || frame.type === 'replace') && frame.value) return frame.value;
  }
  throw new Error('projectsUnavailable');
}
