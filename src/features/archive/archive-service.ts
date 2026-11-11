import { linkSync, lstatSync, mkdtempSync, readdirSync, renameSync, rmdirSync, unlinkSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, normalize } from 'node:path';
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
}
/** Structural view of the native session list; its `updatedAt` is the sidebar's activity time. */
export interface SessionControllerLike {
  list(request: Record<string, never>, signal?: AbortSignal): Promise<{ items: readonly { sessionId: string; updatedAt: number }[] }>;
}
interface PersistenceSnapshot {
  header: { id: string };
  formatStatus?: string;
  revision: string;
  location?: { kind: string; path: string };
}
export interface SessionPersistenceLike {
  readonly name: string;
  stat(id: string): Promise<PersistenceSnapshot | undefined>;
  open(id: string, access: 'write'): Promise<{ header: { id: string }; close(): Promise<void> }>;
}
export interface WorkspaceArchiveStateLike {
  readonly archivedSessionIds: readonly string[];
}
interface DeleteAccess {
  persistence: SessionPersistenceLike;
  registry: WorkspaceArchiveStateLike;
  isLive(id: string): boolean;
}
const ACTIVITY_TTL_MS = 5_000;
// 0.2.2-rc.1 native generation basenames; older generations can become
// visible if the current one disappears, so refuse such directories.
const JSONL_GENERATION = /^session(?:\.v[1-9][0-9]*)?\.jsonl(?:\.zstd)?$/u;
const STAGE_PREFIX = '.power-dsh-delete-';

export class ArchiveService {
  workspaceController: WorkspaceControllerLike | null = null;
  sessionQuery: SessionQueryLike | null = null;
  sessionController: SessionControllerLike | null = null;
  deleteAccess: DeleteAccess | null = null;
  private activityCache: { at: number; value: Map<string, number> } | undefined;

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

  async delete(sessionId: string): Promise<ArchiveCatalog> {
    if (!validSessionId(sessionId)) throw new Error('archiveInvalidSession');
    const access = this.deleteAccess;
    const controller = this.workspaceController;
    if (access?.persistence.name !== 'session-persistence-jsonl' || !controller || !this.sessionQuery) {
      throw new Error('archiveDeleteUnavailable');
    }
    const abort = new AbortController();
    let baseline: ArchiveBaseline;
    try {
      baseline = await readBaseline(controller, abort.signal);
    } catch {
      throw new Error('archiveDeleteCheckFailed');
    } finally {
      abort.abort();
    }
    if (!baseline.archivedSessionIds.includes(sessionId)) throw new Error('archiveNotArchived');
    const { persistence, registry, isLive } = access;
    const check = () => {
      if (this.deleteAccess !== access || this.workspaceController !== controller) throw new Error('archiveDeleteUnavailable');
      if (!registry.archivedSessionIds.includes(sessionId)) throw new Error('archiveNotArchived');
      if (isLive(sessionId)) throw new Error('archiveDeleteBusy');
    };
    check();
    const before = await persistence.stat(sessionId).catch(() => { throw new Error('archiveDeleteStatFailed'); });
    const path = artifactPath(before, sessionId);
    const identity = checkArtifact(path);
    check();
    const handle = await persistence.open(sessionId, 'write').catch(error => {
      throw new Error(error instanceof Error && error.name === 'SessionAlreadyOwnedError' ? 'archiveDeleteBusy' : 'archiveDeleteCheckFailed');
    });
    let deleted = false;
    try {
      const after = await persistence.stat(sessionId).catch(() => { throw new Error('archiveDeleteStatFailed'); });
      if (handle.header.id !== sessionId || artifactPath(after, sessionId) !== path || after?.revision !== before?.revision) {
        throw new Error('archiveDeleteUnsafe');
      }
      const current = checkArtifact(path);
      if (current.dev !== identity.dev || current.ino !== identity.ino || current.ctimeNs !== identity.ctimeNs) {
        throw new Error('archiveDeleteUnsafe');
      }
      // No await between the native marker check and making the file undiscoverable.
      // Keep the directory (and its native lock inode) in place while staging.
      check();
      const stage = stageArtifact(path);
      try {
        await controller.unarchiveSession({ sessionId });
        if (this.deleteAccess !== access || this.workspaceController !== controller || registry.archivedSessionIds.includes(sessionId)) {
          throw new Error('archiveDeleteUnarchiveFailed');
        }
        if (isLive(sessionId)) throw new Error('archiveDeleteBusy');
      } catch {
        restoreArtifact(path, stage);
        throw new Error('archiveDeleteUnarchiveFailed');
      }
      try {
        unlinkSync(stage.file);
        deleted = true;
      } catch {
        restoreArtifact(path, stage);
        throw new Error('archiveDeleteRemoveFailed');
      } finally {
        removeEmptyStage(stage.dir);
      }
    } finally {
      try {
        await handle.close();
      } catch {
        // A lease release fault must not overwrite an earlier deletion failure.
        if (deleted) throw new Error('archiveDeleteReleaseFailed');
      }
    }
    this.activityCache = undefined;
    // Deletion is already committed. If refresh fails, return a clearly partial
    // view so the caller does not mistake a failed refresh for a failed deletion.
    return this.list().catch(() => ({
      ...buildArchiveCatalog({ ...baseline, archivedSessionIds: baseline.archivedSessionIds.filter(id => id !== sessionId) }, new Map()),
      complete: false,
    }));
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
          // The title event time is only a fallback: the native list dates a row
          // by its last user activity, which `activity` supplies when present.
          updatedAt: result.value.title?.updatedAt ?? 0,
          createdAt: result.value.session.createdAt,
        });
      }
    }
    const activity = await this.activity(signal);
    for (const [sessionId, entry] of titles) {
      const lastActive = activity.get(sessionId);
      if (lastActive !== undefined) titles.set(sessionId, { ...entry, updatedAt: lastActive });
    }
    return titles;
  }

  /** Short-lived display cache; never used to admit a mutation. */
  private async activity(signal?: AbortSignal) {
    const cached = this.activityCache;
    if (cached !== undefined && Date.now() - cached.at < ACTIVITY_TTL_MS) return cached.value;
    const activity = new Map<string, number>();
    const controller = this.sessionController;
    if (!controller || typeof controller.list !== 'function') return activity;
    // Activity only decorates rows; a failing list must not hide the archive.
    const { items } = await controller.list({}, signal).catch(() => ({ items: [] }));
    for (const item of items) {
      if (typeof item?.sessionId !== 'string' || typeof item.updatedAt !== 'number' || !Number.isFinite(item.updatedAt)) continue;
      activity.set(item.sessionId, item.updatedAt);
    }
    this.activityCache = { at: Date.now(), value: activity };
    return activity;
  }
}

function artifactPath(snapshot: PersistenceSnapshot | undefined, sessionId: string): string {
  // A write-open can publish a migration. Only open an already-current artifact.
  if (!snapshot || snapshot.formatStatus !== 'current' || snapshot.location?.kind !== 'jsonl' || typeof snapshot.revision !== 'string') {
    throw new Error('archiveDeleteUnsupported');
  }
  const { path } = snapshot.location;
  if (snapshot.header.id !== sessionId || !isAbsolute(path) || normalize(path) !== path
    || basename(dirname(path)) !== sessionId || !JSONL_GENERATION.test(basename(path))) {
    throw new Error('archiveDeleteUnsafe');
  }
  return path;
}

function checkArtifact(path: string) {
  try {
    const dir = dirname(path);
    if (!lstatSync(dir).isDirectory() || !lstatSync(dirname(dir)).isDirectory()) throw new Error('unexpected directory');
    const file = lstatSync(path, { bigint: true });
    if (!file.isFile() || file.nlink !== 1n) throw new Error('unexpected transcript');
    const lock = lstatSync(join(dir, 'session.lock'), { throwIfNoEntry: false });
    if (lock && (!lock.isFile() || lock.nlink !== 1 || lock.size !== 0)) throw new Error('unexpected writer lock');
    const entries = readdirSync(dir);
    if (entries.some(name => name.startsWith(STAGE_PREFIX))) throw new Error('archiveDeleteRecoveryRequired');
    if (entries.some(name => name !== basename(path) && JSONL_GENERATION.test(name))) throw new Error('archiveDeleteUnsupported');
    return file;
  } catch (error) {
    if (error instanceof Error && (error.message === 'archiveDeleteUnsupported' || error.message === 'archiveDeleteRecoveryRequired')) throw error;
    throw new Error('archiveDeleteUnsafe');
  }
}

function stageArtifact(path: string) {
  let dir: string | undefined;
  try {
    dir = mkdtempSync(join(dirname(path), STAGE_PREFIX));
    const file = join(dir, basename(path));
    renameSync(path, file);
    return { dir, file };
  } catch {
    if (dir) removeEmptyStage(dir);
    throw new Error('archiveDeleteRemoveFailed');
  }
}

function restoreArtifact(path: string, stage: ReturnType<typeof stageArtifact>) {
  try {
    // Restore without overwriting a file that has appeared at the source path.
    linkSync(stage.file, path);
    unlinkSync(stage.file);
  } catch {
    throw new Error('archiveDeleteRecoveryRequired');
  } finally {
    removeEmptyStage(stage.dir);
  }
}

function removeEmptyStage(dir: string) {
  try { rmdirSync(dir); } catch { /* An empty directory left behind is harmless; never remove a nonempty one. */ }
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
