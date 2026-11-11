import { AsyncLocalStorage } from 'node:async_hooks';
import type { LifecycleOptions, NativeContext, Release } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import { DAY_MS, idleSince, isTimestamp, normalizeDays } from './auto-archive-policy.ts';

// The queue-time check depends on the verified WorkspaceRegistry implementation.
const VERIFIED_RELEASE = '0.2.2-rc.1';
const ACTIVITY = 'workspace/session-activity';
const skip = new Error('autoArchiveCandidateChanged');
type Activity = readonly unknown[];
type ActivityRequest = { sessionId: string };
type Preferences = Pick<LivePreferences, 'autoArchiveDays' | 'autoArchivedSessions'>;
type Observation = Disposable & {
  header: { id: string; createdAt: number; cwd?: string; origin?: string };
  source: 'live' | 'prepared'; cursor: number;
  projections?: { values: Record<string, unknown> };
};
type ArchiveContext = NativeContext & {
  on(event: typeof ACTIVITY, fn: (req: ActivityRequest, next: () => Promise<Activity>) => Promise<Activity>,
    options: { global: true; prepend: true }): Release;
  waterfall(event: typeof ACTIVITY, req: ActivityRequest, next: () => Promise<Activity>): Promise<Activity>;
  sessionQuery?: { observeSession(id: string, options: { signal: AbortSignal }): Promise<Observation> };
  sessions: { get(id: string): { seq: number } | undefined };
  workspaceRegistry: {
    readonly archivedSessionIds: readonly string[];
    readonly pinnedSessionIds: readonly string[];
    archiveSession(id: string, options: { readonly stopActivity: false }): Promise<void>;
    unarchiveSession(id: string): Promise<void>;
  };
  logger?: { warn(message: string): void };
};

export function installAutoArchive(ctx: NativeContext, prefs: Preferences,
  { owner = ctx, ensureActive }: LifecycleOptions & { owner?: NativeContext } = {}): void {
  ctx.inject(['workspaceRegistry', 'sessionController', 'sessionQuery', 'sessions', 'agents', 'configEditor', 'clientModules'], injected => {
    const child = injected as ArchiveContext;
    const { workspaceRegistry: registry, sessionQuery: query, sessionController: controller, sessions, agents, configEditor } = child;
    if (child.clientModules?.graph().release?.version !== VERIFIED_RELEASE
      || typeof child.waterfall !== 'function' || typeof query?.observeSession !== 'function'
      || typeof controller?.list !== 'function' || typeof sessions?.get !== 'function' || typeof agents?.get !== 'function'
      || typeof registry?.archiveSession !== 'function' || typeof registry.unarchiveSession !== 'function'
      || typeof configEditor?.edit !== 'function') return;

    const lifetime = new AbortController();
    const { signal } = lifetime;
    const days = () => normalizeDays(prefs.autoArchiveDays.get());
    const checkRunning = (expected: number) => {
      if (signal.aborted || days() !== expected) throw skip;
      ensureActive?.();
    };
    const free = (id: string) => !registry.archivedSessionIds.includes(id) && !registry.pinnedSessionIds.includes(id);
    const running = (id: string) => {
      const agent = agents.get(id);
      return agent !== undefined && 'status' in agent && agent.status === 'running';
    };
    let lastWarning: string | undefined;
    const warn = (reason: string) => {
      if (lastWarning === reason) return;
      lastWarning = reason;
      try { child.logger?.warn(`PowerDSH auto archive: ${reason}`); }
      catch { /* Diagnostics must not prevent native recovery. */ }
    };

    async function observe(id: string) {
      try {
        using observation = await query!.observeSession(id, { signal });
        const { header, source, cursor } = observation;
        const activityAt = idleSince(header.createdAt, observation.projections?.values.sessionListMetadata);
        const live = sessions.get(id);
        if (activityAt === undefined || header.id !== id || typeof header.cwd !== 'string' || header.origin === 'subagent'
          || (source === 'live' ? live?.seq !== cursor + 1 : source !== 'prepared' || live !== undefined)) return;
        return { activityAt, cursor, source, live };
      } catch { /* An unreadable or no-longer-visible session is not a candidate. */ }
    }

    type Attempt = { id: string; days: number; queued: boolean; activityAt: number; cursor?: number };
    const ownArchive = new AsyncLocalStorage<Attempt>();
    child.on(ACTIVITY, async ({ sessionId: id }, next) => {
      const attempt = ownArchive.getStore();
      if (attempt?.id !== id) return next();
      checkRunning(attempt.days);
      if (!free(id) || running(id)) throw skip;
      const point = await observe(id);
      if (!point || point.activityAt !== attempt.activityAt || point.activityAt > Date.now() - attempt.days * DAY_MS) throw skip;
      const activity = await next();
      checkRunning(attempt.days);
      const live = sessions.get(id);
      if (activity.length || !free(id) || running(id) || live !== point.live
        || (live !== undefined && live.seq !== point.cursor + 1)) throw skip;
      attempt.cursor = point.cursor;
      return activity;
    }, { global: true, prepend: true });

    async function archive(id: string, threshold: number, activityAt: number) {
      const attempt: Attempt = { id, days: threshold, queued: false, activityAt };
      let failed = false;
      try {
        await ownArchive.run(attempt, () => registry.archiveSession(id, {
          get stopActivity() {
            // This first read is inside the native mutation queue, immediately before the
            // activity waterfall. It still protects pins and teardown if the listener unloaded.
            if (!attempt.queued) {
              checkRunning(threshold);
              if (!free(id) || running(id)) throw skip;
              attempt.queued = true;
            }
            return false as const;
          },
        }));
      } catch (error) {
        if (error === skip) return;
        failed = true;
        if (!signal.aborted) warn('native archive failed');
      }
      // An already archived id is a native no-op before the options read; never undo it.
      if (!attempt.queued || !registry.archivedSessionIds.includes(id)) return;
      const observed = await observe(id);
      let conflict = failed || !observed || observed.cursor !== attempt.cursor
        || observed.activityAt !== activityAt || signal.aborted || days() !== threshold;
      if (!conflict) {
        try { conflict = (await child.waterfall(ACTIVITY, { sessionId: id }, async () => [])).length > 0 || running(id); }
        catch { conflict = true; }
      }
      if (!conflict) return;
      try {
        await registry.unarchiveSession(id);
        if (registry.archivedSessionIds.includes(id)) warn('archive rollback could not be verified');
      } catch { warn('archive rollback failed'); }
    }

    async function scan(threshold: number) {
      const cutoff = Date.now() - threshold * DAY_MS;
      const { items } = await controller!.list({}, signal);
      for (const row of items) {
        checkRunning(threshold);
        const id = row.sessionId;
        if (!id || !isTimestamp(row.updatedAt) || row.updatedAt > cutoff
          || !free(id) || running(id) || prefs.autoArchivedSessions.get().includes(id)) continue;
        const point = await observe(id);
        if (!point || point.activityAt > cutoff || !free(id) || running(id)) continue;
        try {
          await configEditor.edit(owner.fiber.entry, raw => {
            checkRunning(threshold);
            if (!free(id) || running(id)) throw skip;
            const saved = raw.autoArchivedSessions ?? [];
            const effective = prefs.autoArchivedSessions.get();
            if (!Array.isArray(saved) || saved.some(value => typeof value !== 'string')) throw new Error('Invalid auto archive exclusions');
            if (saved.includes(id) || effective.includes(id)) throw skip;
            return { ...raw, autoArchivedSessions: [...new Set<string>([...saved, ...effective, id])] };
          });
          checkRunning(threshold);
          if (!prefs.autoArchivedSessions.get().includes(id)) {
            warn('durable exclusion was not read back');
            return;
          }
        } catch (error) {
          if (error === skip) continue;
          if (!signal.aborted) warn('durable exclusion could not be written');
          return;
        }
        // A recorded exclusion is intentionally retained if the operation loses a race.
        await archive(id, threshold, point.activityAt);
      }
    }

    let lastDays = 0;
    let task: Promise<void> | undefined;
    let rerun = false;
    function tick() {
      if (signal.aborted) return;
      const threshold = lastDays = days();
      if (!threshold) return;
      if (task) { rerun = true; return; }
      task = scan(threshold).catch(error => {
        if (error !== skip && !signal.aborted) warn('candidate scan failed');
      }).finally(() => {
        task = undefined;
        if (rerun) { rerun = false; tick(); }
      });
    }
    const changed = () => { if (days() !== lastDays) tick(); };
    child.on('settings/document-updated', namespace => {
      if (namespace === owner.fiber.entry.options.id) changed();
    });
    child.on('app-boot/config-reload', changed);
    child.effect(() => {
      const start = setTimeout(tick, 0);
      const interval = setInterval(tick, DAY_MS);
      start.unref?.();
      interval.unref?.();
      return () => {
        lifetime.abort();
        clearTimeout(start);
        clearInterval(interval);
      };
    });
  });
}
