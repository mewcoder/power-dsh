import type { ArchiveCatalog, ArchiveSessionRow } from '../../shared/types/wire.ts';

/** The subset of the native Workspace baseline this feature reads. */
export interface ArchiveBaseline {
  readonly items: readonly {
    readonly workspaceId: string;
    readonly title: string;
    /** Native Workspace directory; absent in older baselines. */
    readonly path?: string;
    readonly sessionIds: readonly string[];
  }[];
  readonly archivedSessionIds: readonly string[];
}
export interface ArchiveTitleEntry {
  readonly title: string;
  readonly updatedAt: number;
  readonly createdAt: number;
}
export type ArchiveSort = 'updated' | 'created';

/**
 * Fold the native Workspace baseline and the archived-session titles into a
 * plain projection. Ordering is deterministic so identical inputs render alike.
 */
export function buildArchiveCatalog(baseline: ArchiveBaseline, titles: ReadonlyMap<string, ArchiveTitleEntry>): ArchiveCatalog {
  const pathOf = (item: ArchiveBaseline['items'][number]) => typeof item.path === 'string' ? item.path : '';
  const workspaces = baseline.items.map(item => ({ workspaceId: item.workspaceId, title: item.title, path: pathOf(item) }));
  const owner = new Map<string, { workspaceId: string; title: string; path: string }>();
  for (const item of baseline.items) {
    for (const sessionId of item.sessionIds) {
      if (!owner.has(sessionId)) owner.set(sessionId, { workspaceId: item.workspaceId, title: item.title, path: pathOf(item) });
    }
  }
  const seen = new Set<string>();
  const sessions: ArchiveSessionRow[] = [];
  for (const sessionId of baseline.archivedSessionIds) {
    if (seen.has(sessionId)) continue;
    seen.add(sessionId);
    const workspace = owner.get(sessionId);
    const meta = titles.get(sessionId);
    sessions.push({
      sessionId,
      title: meta?.title ?? '',
      workspaceId: workspace?.workspaceId ?? '',
      workspaceTitle: workspace?.title ?? '',
      workspacePath: workspace?.path ?? '',
      updatedAt: meta?.updatedAt ?? 0,
      createdAt: meta?.createdAt ?? 0,
    });
  }
  return { complete: true, workspaces, sessions };
}

export interface ArchiveGroup {
  key: string;
  title: string;
  /** Workspace directory for the group; empty for the trailing ungrouped group. */
  path: string;
  sessions: ArchiveSessionRow[];
}
export interface ArchiveViewOptions {
  readonly sortBy?: ArchiveSort;
  readonly projectId?: string;
}

function comparator(sortBy: ArchiveSort) {
  if (sortBy === 'created') return (a: ArchiveSessionRow, b: ArchiveSessionRow) => b.createdAt - a.createdAt;
  return (a: ArchiveSessionRow, b: ArchiveSessionRow) => b.updatedAt - a.updatedAt;
}

/**
 * Group archived sessions by workspace, keeping the native workspace order and
 * placing sessions without a workspace in one trailing group. Search matches
 * the session title or its workspace title; the optional project filter keeps
 * one workspace, and the optional sort orders rows inside each group.
 */
export function groupArchivedSessions(
  catalog: ArchiveCatalog,
  query: string,
  ungroupedLabel: string,
  options: ArchiveViewOptions = {},
): ArchiveGroup[] {
  const sortBy = options.sortBy ?? 'updated';
  const projectId = options.projectId ?? '';
  const needle = query.trim().toLocaleLowerCase();
  const rows = catalog.sessions.filter(row => {
    if (projectId && row.workspaceId !== projectId) return false;
    return !needle || `${row.title} ${row.workspaceTitle}`.toLocaleLowerCase().includes(needle);
  });
  const order: string[] = [];
  const groups = new Map<string, ArchiveGroup>();
  for (const workspace of catalog.workspaces) {
    order.push(workspace.workspaceId);
    groups.set(workspace.workspaceId, { key: workspace.workspaceId, title: workspace.title, path: workspace.path, sessions: [] });
  }
  const ungroupedKey = '__ungrouped__';
  for (const row of rows) {
    const key = row.workspaceId || ungroupedKey;
    let group = groups.get(key);
    if (!group) {
      group = { key, title: row.workspaceTitle || ungroupedLabel, path: row.workspacePath, sessions: [] };
      groups.set(key, group);
      order.push(key);
    }
    group.sessions.push(row);
  }
  const compare = comparator(sortBy);
  return order
    .map(key => groups.get(key)!)
    .filter(group => group.sessions.length > 0)
    .map(group => ({ ...group, sessions: [...group.sessions].sort(compare) }));
}
