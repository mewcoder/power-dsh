import type { UsageSnapshot } from '../../shared/types/wire.ts';
import { dayKeyFormatter, foldSession, mergeUsage, type SessionUsageFold, type UsageEventLike } from './usage-fold.ts';

/** Structural view of one native session-persistence read handle. */
export interface PersistenceHandleLike {
  /** Exact number of ancestor events; excluded from this session's accounting. */
  readonly inheritedEventCount: number;
  read(offset?: number, length?: number, options?: { signal?: AbortSignal }): Promise<{
    eventState: string;
    events: readonly unknown[];
  }>;
  close(): Promise<void>;
}
/** Structural view of one stored session's metadata. */
export interface PersistenceSnapshotLike {
  header: { id: string; createdAt: number; cwd?: string; origin?: 'subagent'; parentSession?: string };
  revision: string;
  location?: { kind: string; path: string };
}
/** Structural view of the native session persistence service. */
export interface SessionPersistenceLike {
  list(options?: { signal?: AbortSignal }): Promise<readonly PersistenceSnapshotLike[]>;
  open(id: string, access: 'read' | 'write', options?: { signal?: AbortSignal }): Promise<PersistenceHandleLike>;
}

interface CacheEntry { revision: string; zone: string; fold: SessionUsageFold }

/** Bound the per-session fold cache so a long-lived Host never grows without limit. */
const MAX_CACHED_SESSIONS = 512;
/** Bound concurrent log reads: each cold read decodes and parses a whole log. */
const READ_CONCURRENCY = 4;

/**
 * Folds every readable stored session log into one lifetime usage projection.
 *
 * Only provider-reported assistant usage counts; the fold never estimates.
 * Per-session results are cached by the persistence revision and reporting
 * zone, so a refresh only re-reads logs that actually changed.
 */
export class UsageService {
  persistence: SessionPersistenceLike | null = null;
  private readonly cache = new Map<string, CacheEntry>();

  async snapshot(timeZone: string, signal?: AbortSignal): Promise<UsageSnapshot> {
    const persistence = this.persistence;
    if (!persistence) throw new Error('usageUnavailable');
    const zone = normalizeZone(timeZone);
    const stored = await persistence.list({ signal });
    signal?.throwIfAborted();
    const folds = new Map<string, SessionUsageFold>();
    let complete = true;
    const queue = [...stored].sort((left, right) => left.header.createdAt - right.header.createdAt);
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const entry = queue[cursor++];
        if (!entry) return;
        signal?.throwIfAborted();
        try {
          folds.set(entry.header.id, await this.fold(entry, zone, signal));
        } catch (error) {
          if (signal?.aborted) throw error;
          complete = false;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(READ_CONCURRENCY, queue.length) }, worker));
    signal?.throwIfAborted();
    this.prune(new Set(stored.map(entry => entry.header.id)));
    const snapshot = mergeUsage({ timeZone: zone, complete, generatedAt: Date.now(), sessions: [...folds.values()] });
    const entries = new Map(stored.map(entry => [entry.header.id, entry]));
    const families = new Map<string, Set<string>>();
    for (const [id, fold] of folds) {
      let root = entries.get(id)!;
      const seen = new Set([id]);
      while (root.header.origin === 'subagent' && root.header.parentSession) {
        const parent = entries.get(root.header.parentSession);
        if (!parent || seen.has(parent.header.id)) break;
        seen.add(parent.header.id);
        root = parent;
      }
      const dates = families.get(root.header.id) ?? new Set<string>();
      for (const day of fold.days) dates.add(day.date);
      families.set(root.header.id, dates);
    }
    snapshot.sessionDays = [...families.values()].filter(dates => dates.size > 0).map(dates => [...dates].sort());
    snapshot.summary.sessionCount = snapshot.sessionDays.length;
    return snapshot;
  }

  private async fold(entry: PersistenceSnapshotLike, zone: string, signal?: AbortSignal): Promise<SessionUsageFold> {
    const persistence = this.persistence;
    if (!persistence) throw new Error('usageUnavailable');
    const cached = this.cache.get(entry.header.id);
    if (cached && cached.revision === entry.revision && cached.zone === zone) return cached.fold;
    const handle = await persistence.open(entry.header.id, 'read', { signal });
    let events: readonly unknown[];
    try {
      events = (await handle.read(handle.inheritedEventCount, Number.MAX_SAFE_INTEGER, { signal })).events;
    } finally {
      await handle.close().catch(() => undefined);
    }
    const fold = foldSession({ createdAt: entry.header.createdAt, events: events as readonly UsageEventLike[] }, dayKeyFormatter(zone));
    this.cache.delete(entry.header.id);
    this.cache.set(entry.header.id, { revision: entry.revision, zone, fold });
    return fold;
  }

  /** Drop cache rows for sessions that no longer exist, then enforce the bound. */
  private prune(live: ReadonlySet<string>) {
    for (const id of this.cache.keys()) if (!live.has(id)) this.cache.delete(id);
    while (this.cache.size > MAX_CACHED_SESSIONS) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) return;
      this.cache.delete(oldest);
    }
  }
}

/** Fall back to UTC for a missing or unknown zone rather than failing the page. */
function normalizeZone(timeZone: unknown): string {
  if (typeof timeZone === 'string' && timeZone.trim()) {
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone });
      return timeZone;
    } catch {
      // Fall through to UTC below.
    }
  }
  return 'UTC';
}
