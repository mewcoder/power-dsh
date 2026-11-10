import type { ProjectCatalog, ProjectRow } from '../../shared/types/wire.ts';

/** The subset of the native Workspace baseline this feature reads. */
export interface ProjectBaseline {
  readonly items: readonly {
    readonly workspaceId: string;
    readonly title: string;
    /** Native Workspace directory; absent in older baselines. */
    readonly path?: string;
    readonly sessionIds: readonly string[];
  }[];
}
export interface ProjectActivity {
  readonly lastActiveAt: number;
}
export type ProjectSort = 'recent' | 'manual';

/**
 * Fold the native Workspace baseline and the per-session activity into a plain
 * projection. Registry order is preserved so `manual` sorting mirrors DSH.
 */
export function buildProjectCatalog(
  baseline: ProjectBaseline,
  activity: ReadonlyMap<string, ProjectActivity>,
): ProjectCatalog {
  const projects = baseline.items.map(item => {
    let lastActiveAt = 0;
    for (const sessionId of item.sessionIds) {
      const entry = activity.get(sessionId);
      if (entry && entry.lastActiveAt > lastActiveAt) lastActiveAt = entry.lastActiveAt;
    }
    return {
      workspaceId: item.workspaceId,
      title: item.title,
      path: typeof item.path === 'string' ? item.path : '',
      sessionCount: item.sessionIds.length,
      lastActiveAt,
    } satisfies ProjectRow;
  });
  return { complete: true, projects };
}

/**
 * Apply the local search and the sort mode. `manual` keeps the native registry
 * order; `recent` orders by the latest session activity and falls back to the
 * registry order for ties and never-used projects.
 */
export function arrangeProjects(catalog: ProjectCatalog, query: string, sortBy: ProjectSort = 'recent'): ProjectRow[] {
  const needle = query.trim().toLocaleLowerCase();
  const rows = needle
    ? catalog.projects.filter(row => `${row.title} ${row.path}`.toLocaleLowerCase().includes(needle))
    : [...catalog.projects];
  if (sortBy === 'manual') return rows;
  const order = new Map(catalog.projects.map((row, index) => [row.workspaceId, index]));
  return rows.sort((left, right) => right.lastActiveAt - left.lastActiveAt
    || (order.get(left.workspaceId) ?? 0) - (order.get(right.workspaceId) ?? 0));
}

export type RelativeTimeUnit = 'now' | 'minutes' | 'hours' | 'days' | 'months' | 'years';
export interface RelativeTime { unit: RelativeTimeUnit; n: number }

/**
 * Compact relative time using the same buckets as the native session rows so a
 * project's activity reads like DSH's own timestamps.
 */
export function relativeTime(at: number, now: number): RelativeTime {
  const MINUTE = 60_000;
  const HOUR = 3_600_000;
  const DAY = 86_400_000;
  const diff = Math.max(0, now - at);
  if (diff < MINUTE) return { unit: 'now', n: 0 };
  if (diff < HOUR) return { unit: 'minutes', n: Math.floor(diff / MINUTE) };
  if (diff < DAY) return { unit: 'hours', n: Math.floor(diff / HOUR) };
  if (diff < 30 * DAY) return { unit: 'days', n: Math.floor(diff / DAY) };
  if (diff < 365 * DAY) return { unit: 'months', n: Math.floor(diff / (30 * DAY)) };
  return { unit: 'years', n: Math.floor(diff / (365 * DAY)) };
}
