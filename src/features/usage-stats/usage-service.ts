import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
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

interface CacheEntry { id: string; revision: string; zone: string; fold: SessionUsageFold }

/** Bump when the persisted fold shape or aggregation semantics change. */
const CACHE_VERSION = 3;
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
  private readonly pending = new Map<string, Promise<UsageSnapshot>>();
  private cacheLoaded = false;
  private dirty = false;

  private readonly cacheFile: string | undefined;

  constructor(cacheFile?: string) {
    this.cacheFile = cacheFile;
  }

  async snapshot(timeZone: string, signal?: AbortSignal): Promise<UsageSnapshot> {
    const zone = normalizeZone(timeZone);
    const existing = this.pending.get(zone);
    if (existing) return existing;
    const operation = this.project(zone, signal);
    this.pending.set(zone, operation);
    try {
      return await operation;
    } finally {
      if (this.pending.get(zone) === operation) this.pending.delete(zone);
    }
  }

  private async project(zone: string, signal?: AbortSignal): Promise<UsageSnapshot> {
    const persistence = this.persistence;
    if (!persistence) throw new Error('usageUnavailable');
    await this.loadCache();
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
    if (this.dirty) await this.saveCache();
    const entries = new Map(stored.map(entry => [entry.header.id, entry]));
    interface FamilyUsage {
      path: string;
      totalTokens: number;
      activeMs: number;
      sessionDays: Set<string>;
      days: Map<string, { totalTokens: number; activeMs: number }>;
    }
    const families = new Map<string, FamilyUsage>();
    for (const [id, fold] of folds) {
      let root = entries.get(id)!;
      const seen = new Set([id]);
      while (root.header.origin === 'subagent' && root.header.parentSession) {
        const parent = entries.get(root.header.parentSession);
        if (!parent || seen.has(parent.header.id)) break;
        seen.add(parent.header.id);
        root = parent;
      }
      const family = families.get(root.header.id) ?? {
        path: root.header.cwd ?? '', totalTokens: 0, activeMs: 0, sessionDays: new Set<string>(), days: new Map(),
      };
      family.totalTokens += fold.totalTokens;
      for (const day of fold.days) {
        family.activeMs += day.activeMs;
        family.sessionDays.add(day.date);
        const current = family.days.get(day.date) ?? { totalTokens: 0, activeMs: 0 };
        current.totalTokens += day.totalTokens;
        current.activeMs += day.activeMs;
        family.days.set(day.date, current);
      }
      families.set(root.header.id, family);
    }
    snapshot.sessionDays = [...families.values()].filter(family => family.sessionDays.size > 0)
      .map(family => [...family.sessionDays].sort());
    snapshot.summary.sessionCount = snapshot.sessionDays.length;
    interface WorkspaceUsage {
      path: string;
      totalTokens: number;
      activeMs: number;
      sessionDays: string[][];
      days: Map<string, { totalTokens: number; activeMs: number }>;
    }
    const workspaces = new Map<string, WorkspaceUsage>();
    for (const family of families.values()) {
      if (family.sessionDays.size === 0) continue;
      const workspace = workspaces.get(family.path) ?? {
        path: family.path, totalTokens: 0, activeMs: 0, sessionDays: [] as string[][], days: new Map(),
      };
      workspace.totalTokens += family.totalTokens;
      workspace.activeMs += family.activeMs;
      workspace.sessionDays.push([...family.sessionDays].sort());
      for (const [date, day] of family.days) {
        const current = workspace.days.get(date) ?? { totalTokens: 0, activeMs: 0 };
        current.totalTokens += day.totalTokens;
        current.activeMs += day.activeMs;
        workspace.days.set(date, current);
      }
      workspaces.set(family.path, workspace);
    }
    snapshot.workspaces = [...workspaces.values()]
      .map(workspace => ({
        path: workspace.path,
        totalTokens: workspace.totalTokens,
        activeMs: workspace.activeMs,
        sessionDays: workspace.sessionDays,
        days: [...workspace.days.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([date, day]) => ({ date, totalTokens: day.totalTokens, activeMs: day.activeMs })),
      }))
      .sort((left, right) => right.totalTokens - left.totalTokens || left.path.localeCompare(right.path));
    return snapshot;
  }

  private async fold(entry: PersistenceSnapshotLike, zone: string, signal?: AbortSignal): Promise<SessionUsageFold> {
    const persistence = this.persistence;
    if (!persistence) throw new Error('usageUnavailable');
    const key = `${zone}\u0000${entry.header.id}`;
    const cached = this.cache.get(key);
    if (cached && cached.revision === entry.revision && cached.zone === zone) return cached.fold;
    const handle = await persistence.open(entry.header.id, 'read', { signal });
    let events: readonly unknown[];
    try {
      events = (await handle.read(handle.inheritedEventCount, Number.MAX_SAFE_INTEGER, { signal })).events;
    } finally {
      await handle.close().catch(() => undefined);
    }
    const fold = foldSession({ createdAt: entry.header.createdAt, events: events as readonly UsageEventLike[] }, dayKeyFormatter(zone));
    this.cache.delete(key);
    this.cache.set(key, { id: entry.header.id, revision: entry.revision, zone, fold });
    this.dirty = true;
    return fold;
  }

  /** Load the optional profile-local aggregate cache once; missing or corrupt files are ignored. */
  private async loadCache() {
    if (this.cacheLoaded) return;
    this.cacheLoaded = true;
    if (!this.cacheFile) return;
    try {
      const parsed: unknown = JSON.parse(await readFile(this.cacheFile, 'utf8'));
      if (!isRecord(parsed) || parsed.version !== CACHE_VERSION || !Array.isArray(parsed.entries)) return;
      for (const value of parsed.entries) {
        if (!isRecord(value) || typeof value.id !== 'string' || typeof value.revision !== 'string'
          || typeof value.zone !== 'string' || !isCacheFold(value.fold)) continue;
        this.cache.set(`${value.zone}\u0000${value.id}`, {
          id: value.id, revision: value.revision, zone: value.zone, fold: value.fold,
        });
      }
    } catch {
      // A missing or unreadable cache is rebuilt from the durable session logs.
    }
  }

  /** Persist the aggregate cache; failure only costs the next full rebuild. */
  private async saveCache() {
    if (!this.cacheFile) return;
    this.dirty = false;
    try {
      await mkdir(dirname(this.cacheFile), { recursive: true, mode: 0o700 });
      const temporary = `${this.cacheFile}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify({ version: CACHE_VERSION, entries: [...this.cache.values()] }), { mode: 0o600 });
      await rename(temporary, this.cacheFile);
    } catch {
      // The cache is an optional acceleration; the session logs remain the source of truth.
    }
  }

  /** Drop cache rows for sessions that no longer exist, then enforce the bound. */
  private prune(live: ReadonlySet<string>) {
    for (const [key, entry] of this.cache) if (!live.has(entry.id)) this.cache.delete(key);
    while (this.cache.size > MAX_CACHED_SESSIONS) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) return;
      this.cache.delete(oldest);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Validate the cached fold envelope before it can feed the page. */
function isCacheFold(value: unknown): value is SessionUsageFold {
  return isRecord(value) && Array.isArray(value.days) && Array.isArray(value.models)
    && Array.isArray(value.dailyModels)
    && typeof value.hasUsage === 'boolean'
    && typeof value.totalTokens === 'number' && typeof value.turnCount === 'number'
    && typeof value.longestSpanMs === 'number'
    && (typeof value.firstTime === 'number' || value.firstTime === null)
    && (typeof value.lastTime === 'number' || value.lastTime === null);
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
