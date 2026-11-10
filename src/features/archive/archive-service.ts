import { lstat, rm } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import type { ArchiveCatalog } from '../../shared/types/wire.ts';
import { buildArchiveCatalog, type ArchiveBaseline, type ArchiveTitleEntry } from './archive-catalog.ts';

/** Structural view of the native Workspace controller the Host exposes. */
export interface WorkspaceControllerLike {
  follow(signal: AbortSignal): AsyncIterable<{ type: string; value?: ArchiveBaseline }>;
  unarchiveSession(request: { sessionId: string }): Promise<unknown>;
}
/** Structural view of the native session query service. */
export interface SessionQueryLike {
  readTitleSnapshots(
    sessionIds: readonly string[],
    signal?: AbortSignal,
  ): Promise<readonly (
    { sessionId: string; status: 'fulfilled'; value: { session: { createdAt: number }; title?: { title: string; updatedAt: number } } }
    | { sessionId: string; status: 'rejected'; reason: unknown }
  )[]>;
  listSessions(signal?: AbortSignal): Promise<readonly { header: { id: string }; live: boolean }[]>;
}
/** Structural view of the native session persistence service used for permanent deletion. */
export interface SessionPersistenceLike {
  stat(sessionId: string, options?: { signal?: AbortSignal }): Promise<{
    header: { id: string; cwd?: string };
    location?: { kind: string; path: string };
  } | undefined>;
}

/**
 * Reads the archived set from the native Workspace stream, restores single
 * sessions through the native unarchive operation, and permanently removes a
 * known archived session's transcript artifact. Holds no preferences.
 */
export class ArchiveService {
  workspaceController: WorkspaceControllerLike | null = null;
  sessionQuery: SessionQueryLike | null = null;
  sessionPersistence: SessionPersistenceLike | null = null;

  async list(): Promise<ArchiveCatalog> {
    const controller = this.workspaceController;
    if (!controller || !this.sessionQuery) throw new Error('archiveUnavailable');
    const abort = new AbortController();
    try {
      const baseline = await readBaseline(controller, abort.signal);
      const titles = await this.titlesFor(baseline.archivedSessionIds, abort.signal);
      return buildArchiveCatalog(baseline, titles);
    } finally {
      abort.abort();
    }
  }

  async restore(sessionId: string): Promise<ArchiveCatalog> {
    const controller = this.workspaceController;
    if (!controller) throw new Error('archiveUnavailable');
    if (!validSessionId(sessionId)) throw new Error('archiveInvalidSession');
    await controller.unarchiveSession({ sessionId });
    return this.list();
  }

  /**
   * Permanently delete one archived session. Clears the archive marker first so
   * the list reflects the intent, then removes the resolved transcript
   * artifact. Refuses non-archived ids and sessions whose artifact path cannot
   * be resolved.
   */
  async delete(sessionId: string): Promise<ArchiveCatalog> {
    const controller = this.workspaceController;
    const persistence = this.sessionPersistence;
    if (!controller || !this.sessionQuery) throw new Error('archiveUnavailable');
    if (!persistence) throw new Error('archiveDeleteUnavailable');
    if (!validSessionId(sessionId)) throw new Error('archiveInvalidSession');
    const abort = new AbortController();
    try {
      let baseline: ArchiveBaseline;
      try {
        baseline = await readBaseline(controller, abort.signal);
      } catch {
        throw new Error('archiveDeleteCheckFailed');
      }
      if (!baseline.archivedSessionIds.includes(sessionId)) throw new Error('archiveNotArchived');
      let snapshot: Awaited<ReturnType<SessionPersistenceLike['stat']>>;
      try {
        snapshot = await persistence.stat(sessionId, { signal: abort.signal });
      } catch {
        throw new Error('archiveDeleteStatFailed');
      }
      const remaining = baseline.archivedSessionIds.filter(id => id !== sessionId);
      // Session already gone: just reconcile the archive marker and report.
      if (!snapshot) {
        await controller.unarchiveSession({ sessionId }).catch(() => undefined);
        const titles = await this.titlesFor(remaining, abort.signal).catch(() => new Map<string, ArchiveTitleEntry>());
        return buildArchiveCatalog({ items: baseline.items, archivedSessionIds: remaining }, titles);
      }
      const artifact = snapshot.location?.path;
      // A live/pending session has no materialized artifact path; refuse rather
      // than pretend success, so a running session is never silently "deleted".
      if (typeof artifact !== 'string' || artifact.length === 0) throw new Error('archiveDeleteUnsupported');
      try {
        await controller.unarchiveSession({ sessionId });
      } catch {
        throw new Error('archiveDeleteUnarchiveFailed');
      }
      try {
        await removeArtifact(artifact, sessionId);
      } catch (error) {
        throw error instanceof Error && error.message === 'archiveDeleteUnsafe' ? error : new Error('archiveDeleteRemoveFailed');
      }
      // Build the next catalog from the baseline we already have instead of a
      // second follow, which could otherwise choke on a dangling session id.
      const titles = await this.titlesFor(remaining, abort.signal).catch(() => new Map<string, ArchiveTitleEntry>());
      return buildArchiveCatalog({ items: baseline.items, archivedSessionIds: remaining }, titles);
    } finally {
      abort.abort();
    }
  }

  private async titlesFor(ids: readonly string[], signal?: AbortSignal): Promise<Map<string, ArchiveTitleEntry>> {
    const titles = new Map<string, ArchiveTitleEntry>();
    const query = this.sessionQuery;
    const unique = [...new Set(ids)];
    if (!query || unique.length === 0) return titles;
    const results = await query.readTitleSnapshots(unique, signal);
    for (const result of results) {
      if (result.status === 'fulfilled') {
        titles.set(result.sessionId, {
          title: result.value.title?.title ?? '',
          updatedAt: result.value.title?.updatedAt ?? 0,
          createdAt: result.value.session.createdAt,
        });
      }
    }
    return titles;
  }
}

function validSessionId(sessionId: unknown): sessionId is string {
  return typeof sessionId === 'string' && sessionId.length > 0 && sessionId.length <= 1024;
}

/** Resolve the first complete Workspace baseline and stop the stream. */
async function readBaseline(controller: WorkspaceControllerLike, signal: AbortSignal): Promise<ArchiveBaseline> {
  for await (const frame of controller.follow(signal)) {
    if ((frame.type === 'baseline' || frame.type === 'replace') && frame.value) return frame.value;
  }
  throw new Error('archiveUnavailable');
}

/**
 * Delete the session's own transcript directory when its path segment equals the
 * session id; otherwise delete only the resolved artifact file. Never follows a
 * symbolic link and never removes a shared parent directory.
 */
export async function removeArtifact(artifactPath: string, sessionId: string): Promise<void> {
  const directory = dirname(artifactPath);
  if (basename(directory) === sessionId) {
    const info = await lstat(directory).catch(() => null);
    if (info?.isSymbolicLink()) throw new Error('archiveDeleteUnsafe');
    if (info?.isDirectory()) {
      await rm(directory, { recursive: true, force: true });
      return;
    }
  }
  await rm(artifactPath, { force: true });
}
