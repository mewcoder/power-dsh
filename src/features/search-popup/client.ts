import type { ClientEnvironment, ClientFeature, ClientRuntime, SettingsForm, SnapshotSource } from '../../shared/client/types.ts';
import { errorMessage } from '../../shared/client/runtime.ts';
import { styles } from './styles.ts';

// Native WorkspaceBrowser gestures the popup mirrors: the keystroke pause before a
// content-search request, and the session.search wire cap.
const SEARCH_DEBOUNCE_MS = 250;
const CONTENT_DEBOUNCE_MS = 100;
const SEARCH_QUERY_MAX_CODE_UNITS = 500;
// Fixed by the Host when the sessions face exposes it; a local fallback keeps
// the popup bounded when an older host omits the field.
const DEFAULT_RESULT_LIMIT = 40;
// Default content of the empty popup: the newest non-blank tasks.
const RECENT_ROW_LIMIT = 10;

interface SearchContentItem { sessionId: string; snippet: string }
interface SearchContentPage { items: readonly SearchContentItem[] }
type SearchRequest = (query: string, signal: AbortSignal) => Promise<SearchContentPage>;
type OpenSession = (sessionId: string) => void;

interface SessionsFace {
  search?: (query: string, signal: AbortSignal) => Promise<{ ok: true; value: SearchContentPage } | { ok: false; error: { message: string } }>;
  searchResultLimit?: unknown;
}
interface UiWorkspaceFace {
  openSession?: (sessionId: string) => void;
}
interface WorkspaceRow { workspaceId: string; title: string; path: string; sessionIds: readonly string[] }
interface WorkspaceSnapshot { items?: readonly WorkspaceRow[]; archivedSessionIds?: readonly string[] }
interface WorkspacesFace {
  list?: { getSnapshot(): WorkspaceSnapshot };
}

interface GestureNode { getAttribute(name: string): string | null; tagName?: string; }
// Event paths can contain Window, Document and other non-element targets. Read only this bounded DOM shape.
function isGestureNode(node: unknown): node is GestureNode {
  return typeof node === 'object' && node !== null && 'getAttribute' in node && typeof node.getAttribute === 'function';
}

// Mirrors the native WorkspaceBrowser sanitize: strip NUL and cap at the wire limit without cutting a surrogate pair.
function sanitizeSearchQuery(value: string): string {
  const withoutNul = value.replaceAll('\0', '');
  if (withoutNul.length <= SEARCH_QUERY_MAX_CODE_UNITS) return withoutNul;
  let end = SEARCH_QUERY_MAX_CODE_UNITS;
  const last = withoutNul.charCodeAt(end - 1);
  const next = withoutNul.charCodeAt(end);
  if (last >= 0xD800 && last <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF) end--;
  return withoutNul.slice(0, end);
}

interface ShortcutGesture { code?: unknown; metaKey?: unknown; ctrlKey?: unknown; altKey?: unknown; shiftKey?: unknown; }
// The native catalog binds session.search to the platform primary plus K on desktop
// (Meta on macOS, Control elsewhere) and primary plus Alt on web. Match exactly that
// gesture so the popup takes over the same entries and nothing else.
function isSearchShortcut(gesture: ShortcutGesture, platform: string | null): boolean {
  if (gesture.code !== 'KeyK' || gesture.shiftKey === true) return false;
  if (typeof platform === 'string') {
    if (platform === 'darwin') return gesture.metaKey === true && gesture.ctrlKey !== true && gesture.altKey !== true;
    return gesture.ctrlKey === true && gesture.metaKey !== true && gesture.altKey !== true;
  }
  return gesture.altKey === true && (gesture.metaKey === true || gesture.ctrlKey === true);
}

// Approved narrow DOM exception: only the current gesture's composedPath() is read,
// matching the native search button through its resolved workspace-locale aria label.
// No document scanning, no React fiber, no generated class names. When the host
// removes or changes the marker, nothing matches and the native search stays intact.
function isSearchButton(node: GestureNode, label: string): boolean {
  return node.tagName === 'BUTTON' && node.getAttribute('type') === 'button' && node.getAttribute('aria-label') === label;
}

type SessionRowSummary = {
  displayTitle?: string; title?: string; updatedAt?: number; cwd?: string; blank?: boolean; origin?: string;
};
type SessionListSnapshot = { ids: readonly string[]; byId: Record<string, SessionRowSummary> };

// Mirrors the native browser's `sessionVisible`: subagent children belong to their
// parent header catalog, blank placeholder sessions are not searchable rows, and
// archived sessions stay hidden unless the user shows them. The popup has no
// archived filter, so it always follows the native default view.
function sessionVisible(sessionId: string, summary: SessionRowSummary | undefined, archived: ReadonlySet<string>): boolean {
  if (summary === undefined || summary.origin === 'subagent' || summary.blank === true) return false;
  return !archived.has(sessionId);
}

// One row of the popup result set. Search mode merges the Host content page
// (first, with snippets) and title-only matches from the live session list;
// the empty popup defaults to the newest non-blank tasks, ordered like the
// native browser's recency sort (updatedAt desc, id tiebreak).
interface SearchRow { sessionId: string; title: string; snippet: string }
function mergeSearchRows(
  list: SessionListSnapshot,
  archived: ReadonlySet<string>,
  content: { items: readonly SearchContentItem[]; previews?: readonly SearchContentItem[] },
  query: string,
  limit: number,
): SearchRow[] {
  const needle = query.trim().toLowerCase();
  const rows: SearchRow[] = [];
  const seen = new Set<string>();
  const titleOf = (sessionId: string): string => {
    const row = list.byId[sessionId];
    return row?.displayTitle ?? row?.title ?? sessionId;
  };
  // Content hits are session ids only: drop the ones the native list would never
  // draw (subagent children, blank placeholders, archived rows) before ranking,
  // otherwise the popup would surface rows the sidebar cannot show.
  for (const item of content.items) {
    if (seen.has(item.sessionId)) continue;
    if (!sessionVisible(item.sessionId, list.byId[item.sessionId], archived)) continue;
    seen.add(item.sessionId);
    rows.push({ sessionId: item.sessionId, title: titleOf(item.sessionId), snippet: item.snippet });
  }
  if (needle !== '') {
    // A title match has no content hit, so it borrows the session's newest
    // message as its preview; an empty line under the title reads as a bug.
    const previewOf = new Map((content.previews ?? []).map(item => [item.sessionId, item.snippet]));
    for (const sessionId of list.ids) {
      if (seen.has(sessionId)) continue;
      if (!sessionVisible(sessionId, list.byId[sessionId], archived)) continue;
      if (!titleOf(sessionId).toLowerCase().includes(needle)) continue;
      rows.push({ sessionId, title: titleOf(sessionId), snippet: previewOf.get(sessionId) ?? '' });
    }
  }
  // One homogeneous list: content hits and title-only matches rank together by
  // last activity, so the panel never draws them as two separate groups.
  return rows
    .map(row => ({ row, rank: list.byId[row.sessionId]?.updatedAt ?? 0 }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit)
    .map(({ row }) => row);
}

// Wrap every case-insensitive occurrence of the query in a highlight mark, so
// titles and snippets point at the match like the official result list. The
// runtime's createElement arrives as a parameter: this helper lives at module
// scope, where the factory's `h` is not in view.
type HighlightNode = string | ReturnType<ClientRuntime['h']>;
function highlight(h: ClientRuntime['h'], text: string, needle: string): HighlightNode[] {
  if (needle === '') return [text];
  const haystack = text.toLowerCase();
  const target = needle.toLowerCase();
  const parts: HighlightNode[] = [];
  let index = 0;
  for (;;) {
    const hit = haystack.indexOf(target, index);
    if (hit === -1) break;
    if (hit > index) parts.push(text.slice(index, hit));
    parts.push(h('mark', { className: 'power-dsh-search-popup-hit' }, text.slice(hit, hit + needle.length)));
    index = hit + needle.length;
  }
  if (index < text.length) parts.push(text.slice(index));
  return parts.length > 0 ? parts : [text];
}

// The engine centers its 240-code-point snippet on the first match, but a single
// row line shows roughly half that; the highlighted term could land right past
// the CSS ellipsis (the common "match exists but nothing is highlighted" case).
// Re-window the visible text around the first match so the mark is always on screen.
const SNIPPET_DISPLAY_CODE_POINTS = 64;
function displaySnippet(text: string, needle: string): string {
  const characters = Array.from(text);
  if (characters.length <= SNIPPET_DISPLAY_CODE_POINTS) return text;
  const target = needle.trim().toLowerCase();
  const hit = target === '' ? -1 : text.toLowerCase().indexOf(target);
  if (hit === -1) return `${characters.slice(0, SNIPPET_DISPLAY_CODE_POINTS - 1).join('')}…`;
  const matchStart = Array.from(text.slice(0, hit)).length;
  const matchLength = Math.max(1, Array.from(text.slice(hit, hit + target.length)).length);
  const budget = SNIPPET_DISPLAY_CODE_POINTS - 2;
  const before = Math.max(0, Math.min(matchStart, Math.floor((budget - matchLength) / 3)));
  let start = Math.max(0, matchStart - before);
  if (matchStart + matchLength > start + budget) start = Math.max(0, matchStart + matchLength - budget);
  const end = Math.min(characters.length, start + budget);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < characters.length ? '…' : '';
  return `${prefix}${characters.slice(start, end).join('')}${suffix}`;
}

function recentSessionRows(list: SessionListSnapshot, archived: ReadonlySet<string>): SearchRow[] {
  const titleOf = (sessionId: string): string => {
    const row = list.byId[sessionId];
    return row?.displayTitle ?? row?.title ?? sessionId;
  };
  return list.ids
    .flatMap(sessionId => {
      if (!sessionVisible(sessionId, list.byId[sessionId], archived)) return [];
      return [{ sessionId, rank: list.byId[sessionId]?.updatedAt ?? 0 }];
    })
    .sort((a, b) => a.rank !== b.rank ? b.rank - a.rank : a.sessionId < b.sessionId ? -1 : 1)
    .slice(0, RECENT_ROW_LIMIT)
    .map(({ sessionId }) => ({ sessionId, title: titleOf(sessionId), snippet: '' }));
}

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, Menu, errorFeedback, observable, useSnapshot } = runtime;
  const { ctx, form, t } = env;
  // Resolved at call time from the same workspace locale seat the native button uses,
  // so the match survives interface language changes.
  const workspaceLabel = ctx.locale.bind('workspace');
  const searchButtonLabel = () => workspaceLabel('search.sessions.aria');

  // Optional services: without them the popup degrades to an explicit unavailable
  // status instead of half-working controls. Sources are read per render instead of
  // standing subscriptions: the panel re-renders when it opens or the query changes,
  // so rows resolve from the current snapshots without keeping listeners of its own.
  // The Host serves its own in-memory index when the derived database is usable:
  // measured ~20ms against ~940ms for the native plan on a 412MB index. When it
  // reports the index unavailable, the panel uses the native service unchanged.
  let searchContent: ((query: string, limit: number, previewIds: readonly string[], sessionIds: readonly string[])
    => Promise<{ items: readonly SearchContentItem[]; previews: readonly SearchContentItem[] } | null>) | null = null;
  let readRecentPreviews: ((sessionIds: readonly string[], versions: readonly string[]) => Promise<readonly SearchContentItem[]>) | null = null;
  let searchSessions: SearchRequest | null = null;
  let openSession: OpenSession | null = null;
  let resultLimit = DEFAULT_RESULT_LIMIT;
  const EMPTY_LIST: SessionListSnapshot = { ids: [], byId: {} };
  type SessionListSource = SnapshotSource<SessionListSnapshot>;
  let boundList: SessionListSource | null = null;
  const sessionList = { getSnapshot: (): SessionListSnapshot => boundList?.getSnapshot() ?? EMPTY_LIST };
  ctx.inject(['remote.powerDsh'], child => {
    const face = (child as { remote?: { powerDsh?: {
      readRecentSessionPreviews?(sessionIds: readonly string[], versions: readonly string[]): Promise<
        { ok: true; value: { available: boolean; previews: readonly SearchContentItem[] } }
        | { ok: false; error: { message: string } }>;
      searchSessionContent?(query: string, limit: number, previewIds: readonly string[], sessionIds: readonly string[]): Promise<
        { ok: true; value: { available: boolean; items: readonly SearchContentItem[]; previews: readonly SearchContentItem[] } }
        | { ok: false; error: { message: string } }>;
    } } }).remote;
    const previewMethod = face?.powerDsh?.readRecentSessionPreviews;
    if (typeof previewMethod === 'function') {
      readRecentPreviews = (sessionIds, versions) => previewMethod.call(face!.powerDsh, sessionIds, versions).then(result => {
        if (!result.ok) throw new Error(result.error.message);
        return result.value.available ? result.value.previews : [];
      });
    }
    const method = face?.powerDsh?.searchSessionContent;
    if (typeof method !== 'function') return;
    searchContent = (query, limit, previewIds, sessionIds) => method.call(face!.powerDsh, query, limit, previewIds, sessionIds).then(result => {
      if (!result.ok) throw new Error(result.error.message);
      return result.value.available
        ? { items: result.value.items, previews: result.value.previews ?? [] }
        : null;
    });
  });
  ctx.inject(['sessions'], child => {
    const face = (child as { sessions?: SessionsFace }).sessions;
    if (!face || typeof face.search !== 'function') return;
    searchSessions = (query, signal) => face.search!(query, signal).then(result => {
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    });
    if (typeof face.searchResultLimit === 'number') resultLimit = face.searchResultLimit;
    boundList = (face as SessionsFace & { list?: SessionListSource }).list ?? null;
  });
  ctx.inject(['uiWorkspace'], child => {
    const face = (child as { uiWorkspace?: UiWorkspaceFace }).uiWorkspace;
    if (!face || typeof face.openSession !== 'function') return;
    openSession = sessionId => face.openSession!(sessionId);
  });
  const EMPTY_WORKSPACES: WorkspaceSnapshot = {};
  type WorkspacesSource = SnapshotSource<WorkspaceSnapshot>;
  let boundWorkspaces: WorkspacesSource | null = null;
  const workspaceSnapshot = { getSnapshot: (): WorkspaceSnapshot => boundWorkspaces?.getSnapshot() ?? EMPTY_WORKSPACES };
  const workspaceItems = { getSnapshot: (): readonly WorkspaceRow[] => workspaceSnapshot.getSnapshot().items ?? [] };
  // The archived ids arrive as a plain array on every snapshot; rebuild the lookup
  // set only when that array identity changes, so row memos stay stable.
  let archivedSource: readonly string[] | undefined;
  let archivedSet: ReadonlySet<string> = new Set();
  const archivedSessions = {
    getSnapshot: (): ReadonlySet<string> => {
      const next = workspaceSnapshot.getSnapshot().archivedSessionIds;
      if (next !== archivedSource) {
        archivedSource = next;
        archivedSet = new Set(next ?? []);
      }
      return archivedSet;
    },
  };
  ctx.inject(['workspaces'], child => {
    const face = (child as { workspaces?: WorkspacesFace }).workspaces;
    if (!face?.list) return;
    boundWorkspaces = face.list as unknown as WorkspacesSource;
  });

  // A stable snapshot store: the interception listeners raise one open request,
  // the overlay component consumes it; opening twice while visible stays put.
  const request = observable<{ open: boolean; seq: number }>(() => state);
  let state = { open: false, seq: 0 };
  // Repeating the gesture while the panel is visible must only bring the input
  // back into focus; bumping the sequence re-runs the focus effect while the
  // request effect, keyed on the query alone, stays put.
  const openRequest = () => {
    state = { open: true, seq: state.seq + 1 };
    request.notify();
  };
  const closeRequest = () => {
    if (!state.open) return;
    state = { open: false, seq: state.seq + 1 };
    request.notify();
  };

  const platformMarker = () => document.documentElement.getAttribute('data-platform');
  function bindInterception(currentForm: SettingsForm) {
    let listening = false;
    const enabled = () => {
      const snapshot = currentForm.getSnapshot();
      return snapshot.status === 'ready' && snapshot.value?.searchPopupEnabled === true;
    };
    const onClick = (event: MouseEvent) => {
      if (!enabled() || event.button !== 0) return;
      const path = event.composedPath();
      for (const node of path) {
        if (!isGestureNode(node)) continue;
        if (!isSearchButton(node, searchButtonLabel())) continue;
        event.stopPropagation();
        openRequest();
        return;
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!enabled()) return;
      if (!isSearchShortcut(event, platformMarker())) return;
      event.stopPropagation();
      event.preventDefault();
      openRequest();
    };
    const sync = () => {
      const next = enabled();
      if (next === listening) return;
      listening = next;
      if (next) {
        window.addEventListener('click', onClick, true);
        window.addEventListener('keydown', onKeyDown, true);
      } else {
        window.removeEventListener('click', onClick, true);
        window.removeEventListener('keydown', onKeyDown, true);
        closeRequest();
      }
    };
    const unsubscribe = currentForm.subscribe(sync);
    sync();
    return () => {
      unsubscribe();
      if (listening) {
        window.removeEventListener('click', onClick, true);
        window.removeEventListener('keydown', onKeyDown, true);
        closeRequest();
      }
    };
  }
  ctx.effect(() => bindInterception(form));
  // The frame-wide overlay seat keeps the panel mounted so any intercepted
  // gesture can raise it, wherever the user currently is.
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'power-dsh-search-popup',
  }, SearchPopup));

  function SearchPopup() {
    const current = useSnapshot(request);
    const open = current.open;
    const openedAt = current.seq;
    const [query, setQuery] = React.useState('');
    const [remote, setRemote] = React.useState<SearchContentPage
      & { key: string; status: 'idle' | 'loading' | 'ready' | 'error'; reason?: string;
        previews: readonly SearchContentItem[] }>({
      key: '', status: 'idle', items: [], previews: [],
    });
    const [active, setActive] = React.useState(0);
    const [recentPreviews, setRecentPreviews] = React.useState<{
      key: string; status: 'loading' | 'ready' | 'error'; items: readonly SearchContentItem[];
    }>({ key: '', status: 'ready', items: [] });
    const [workspaceId, setWorkspaceId] = React.useState('');
    // Bumped by the shared feedback retry action; the query itself is unchanged.
    const [attempt, setAttempt] = React.useState(0);
    const [workspaceMenuOpen, setWorkspaceMenuOpen] = React.useState(false);
    const input = React.useRef<{ focus(options?: { preventScroll?: boolean }): void; select?(): void; value?: string } | null>(null);
    const listRef = React.useRef<{ scrollTo?(options: { top?: number }): void } | null>(null);
    const normalizedQuery = sanitizeSearchQuery(query).trim();
    const searchKey = JSON.stringify([normalizedQuery, workspaceId, attempt]);
    const list = sessionList.getSnapshot();
    const workspaces = workspaceItems.getSnapshot();
    const archived = archivedSessions.getSnapshot();
    const enhanced = useSnapshot(form).value?.searchPopupEnabled === true;
    const scopedList = React.useMemo(() => {
      const workspace = workspaces.find(candidate => candidate.workspaceId === workspaceId);
      const ids = list.ids.filter(sessionId => sessionVisible(sessionId, list.byId[sessionId], archived)
        && (workspaceId === '' || workspace?.sessionIds.includes(sessionId)))
        .sort((left, right) => (list.byId[right]?.updatedAt ?? 0) - (list.byId[left]?.updatedAt ?? 0)
          || left.localeCompare(right));
      return { ids, byId: Object.fromEntries(ids.map(id => [id, list.byId[id]!])) };
    }, [list, archived, workspaces, workspaceId]);
    const serviceReady = searchSessions !== null && openSession !== null;
    const dateFormatter = React.useMemo(() => {
      const tag = (typeof document !== 'undefined' && document.documentElement.lang) || 'en';
      return new Intl.DateTimeFormat(tag, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    }, []);
    const dateOf = (sessionId: string): string => {
      const updatedAt = list.byId[sessionId]?.updatedAt;
      return updatedAt === undefined ? '' : dateFormatter.format(updatedAt);
    };
    // Ownership first, then a directory match: sessions working inside a
    // registered workspace without being catalogued under it still name it.
    const workspaceOf = (sessionId: string): string | undefined => {
      const summary = list.byId[sessionId];
      const cwd = summary?.cwd;
      const workspace = workspaces.find(candidate => candidate.sessionIds.includes(sessionId))
        ?? (cwd === undefined ? undefined : workspaces.find(candidate => {
          const root = candidate.path.replace(/\/+$/u, '');
          return cwd === root || cwd.startsWith(`${root}/`);
        }));
      return workspace?.title;
    };
    // Title-only matches the panel can draw right now, in list order. The Host
    // turns these into preview snippets so no row leaves its second line blank.
    const titleMatchIds = (): string[] => {
      const needle = normalizedQuery.toLowerCase();
      if (needle === '') return [];
      return scopedList.ids.filter(sessionId => sessionVisible(sessionId, list.byId[sessionId], archived)
        && (list.byId[sessionId]?.displayTitle ?? list.byId[sessionId]?.title ?? sessionId)
          .toLowerCase().includes(needle)).slice(0, resultLimit);
    };
    const searching = normalizedQuery !== '';
    const currentRemote = enhanced && remote.key === searchKey ? remote : null;
    const pending = searching && enhanced && (searchContent !== null || searchSessions !== null)
      && currentRemote?.status !== 'ready' && currentRemote?.status !== 'error';
    const merged = React.useMemo(
      () => pending ? [] : mergeSearchRows(scopedList, archived,
        currentRemote ?? { items: [] }, normalizedQuery, resultLimit),
      [scopedList, archived, currentRemote, normalizedQuery, pending],
    );
    const recent = React.useMemo(() => recentSessionRows(scopedList, archived), [scopedList, archived]);
    const recentKey = JSON.stringify([workspaceId,
      recent.map(row => [row.sessionId, list.byId[row.sessionId]?.updatedAt ?? 0])]);
    const recentSnippets = new Map(recentPreviews.key === recentKey
      ? recentPreviews.items.map(item => [item.sessionId, item.snippet]) : []);
    const rows = searching ? merged : recent.map(row => ({ ...row, snippet: recentSnippets.get(row.sessionId) ?? '' }));
    React.useEffect(() => {
      if (!open || searching || readRecentPreviews === null || recent.length === 0) return;
      let cancelled = false;
      setRecentPreviews({ key: recentKey, status: 'loading', items: [] });
      readRecentPreviews(recent.map(row => row.sessionId),
        recent.map(row => String(list.byId[row.sessionId]?.updatedAt ?? 0))).then(items => {
        if (!cancelled) setRecentPreviews({ key: recentKey, status: 'ready', items });
      }).catch(() => {
        if (!cancelled) setRecentPreviews({ key: recentKey, status: 'error', items: [] });
      });
      return () => { cancelled = true; };
    }, [open, searching, recentKey, attempt]);
    React.useEffect(() => {
      if (!open) return;
      input.current?.focus({ preventScroll: true });
      if (typeof input.current?.select === 'function') input.current.select();
    }, [open, openedAt]);
    React.useEffect(() => { setActive(0); }, [normalizedQuery, workspaceId]);
    // A new page must not inherit the previous scroll position: the head status
    // would otherwise sit clipped above the viewport like a stale row. Re-focusing
    // an already open panel leaves the reader where they were.
    React.useEffect(() => {
      if (!open || typeof listRef.current?.scrollTo !== 'function') return;
      listRef.current.scrollTo({ top: 0 });
    }, [open, normalizedQuery, workspaceId]);
    React.useEffect(() => {
      if (!open || normalizedQuery === '' || !enhanced || (!searchContent && !searchSessions)) {
        setRemote({ key: searchKey, status: 'idle', items: [], previews: [] });
        return;
      }
      const controller = new AbortController();
      let fallbackTimer: number | undefined;
      setRemote({ key: searchKey, status: 'loading', items: [], previews: [] });
      const startedAt = Date.now();
      const run = async () => {
        if (searchContent) {
          // Title-only matches are known locally, so the Host is asked to preview
          // exactly those sessions in the same round trip.
          const local = await searchContent(normalizedQuery, resultLimit, titleMatchIds(), scopedList.ids);
          if (controller.signal.aborted) return;
          if (local !== null) {
            setRemote({ key: searchKey, status: 'ready', items: local.items, previews: local.previews });
            return;
          }
        }
        if (!searchSessions) {
          setRemote({ key: searchKey, status: 'ready', items: [], previews: [] });
          return;
        }
        const remaining = SEARCH_DEBOUNCE_MS - (Date.now() - startedAt);
        if (remaining > 0) {
          await new Promise<void>(resolve => {
            const finish = () => { controller.signal.removeEventListener('abort', finish); resolve(); };
            fallbackTimer = window.setTimeout(finish, remaining);
            controller.signal.addEventListener('abort', finish, { once: true });
          });
        }
        if (controller.signal.aborted) return;
        const native = await searchSessions(normalizedQuery, controller.signal);
        if (controller.signal.aborted) return;
        setRemote({ key: searchKey, status: 'ready', items: native.items, previews: [] });
      };
      const timer = window.setTimeout(() => {
        run().catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setRemote({ key: searchKey, status: 'error', items: [], previews: [], reason: errorMessage(error) });
        });
      }, searchContent ? CONTENT_DEBOUNCE_MS : SEARCH_DEBOUNCE_MS);
      return () => {
        window.clearTimeout(timer);
        if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
        controller.abort();
      };
    }, [open, normalizedQuery, attempt, enhanced, workspaceId]);
    const retrySearch = () => setAttempt(count => count + 1);
    const choose = (sessionId: string) => {
      closeRequest();
      openSession?.(sessionId);
    };
    const onInputKeyDown = (event: { key?: unknown; preventDefault(): void }) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (rows.length === 0) return;
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        setActive(index => (index + delta + rows.length) % rows.length);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const row = rows[active];
        if (row) choose(row.sessionId);
        return;
      }
      if (event.key === 'Escape') closeRequest();
    };
    // Outlined icons mirror the plugin's other Lucide-derived glyphs (ISC; see
    // docs/third-party-notices.md).
    const searchIcon = h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false },
    h('circle', { cx: 11, cy: 11, r: 7 }), h('path', { d: 'm20.5 20.5-3.8-3.8' }));
    const folderIcon = h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false },
    h('path', { d: 'M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2z' }));
    const chevronIcon = h('svg', { width: 12, height: 12, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor',
      strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false },
    h('path', { d: 'm4 6 4 4 4-4' }));
    const clearIcon = h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none',
      stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', 'aria-hidden': true, focusable: false },
    h('path', { d: 'm3.5 3.5 9 9m0-9-9 9' }));
    // A deployment with the session-query index disabled rejects every content
    // search (SessionQueryError 'SESSION_QUERY_SEARCH_DISABLED', visible in the
    // message). That is a missing capability, not a failure: degrade to a quiet
    // note and keep the title matches instead of a red error line.
    const indexDisabled = currentRemote?.status === 'error' && /search is disabled/u.test(currentRemote.reason ?? '');
    // A cold index build races with live sessions appending to their logs; the
    // engine needs two identical persistence snapshots and gives up after one
    // retry. Surface it as a building state, not a hard failure.
    const indexBuilding = currentRemote?.status === 'error' && /did not stabilize/u.test(currentRemote.reason ?? '');
    // The placeholder states the best-known scope: observed attempts win, and
    // before the first attempt the enhancement switch states the contract. A
    // pending restart keeps titles and names the restart it is waiting for.
    const placeholder = (indexDisabled || indexBuilding) && enhanced ? t('searchPopupPlaceholderPending')
      : indexDisabled || indexBuilding || !enhanced || !serviceReady ? t('searchPopupPlaceholderTitles')
      : t('searchPopupPlaceholder');
    const searchFailed = serviceReady && currentRemote?.status === 'error' && !indexDisabled && !indexBuilding;
    const selectedWorkspace = workspaceId === '' ? undefined : workspaces.find(candidate => candidate.workspaceId === workspaceId);
    return h('div', null, h('style', null, styles), !open ? null : h('div', {
      className: 'power-dsh-search-popup-overlay',
      onClick: (event: { target?: unknown; currentTarget?: unknown }) => {
        if (event.target === event.currentTarget) closeRequest();
      },
    }, h('div', {
      className: 'power-dsh-search-popup-panel', role: 'dialog', 'aria-modal': true, 'aria-label': t('searchPopupTitle'),
    },
    h('div', { className: 'power-dsh-search-popup-top' },
    h('div', { className: 'power-dsh-search-popup-field' },
      searchIcon,
      h('input', {
        ref: input, id: 'power-dsh-search-popup-input', className: 'power-dsh-search-popup-input',
        type: 'text', placeholder, value: query, maxLength: SEARCH_QUERY_MAX_CODE_UNITS,
        'aria-label': t('searchPopupTitle'), autoComplete: 'off', spellCheck: false,
        onChange: (event: { target: { value: string } }) => setQuery(sanitizeSearchQuery(event.target.value)),
        onKeyDown: onInputKeyDown,
      }),
      query !== '' && h('button', {
        type: 'button', className: 'power-dsh-search-popup-clear', 'aria-label': t('searchPopupClear'),
        onClick: () => { setQuery(''); input.current?.focus({ preventScroll: true }); },
      }, clearIcon),
    )),
    h('div', { className: 'power-dsh-search-popup-head' },
      h('span', { className: 'power-dsh-search-popup-head-label' }, searching ? t('searchPopupResults') : t('searchPopupRecent')),
      h('span', { className: 'power-dsh-search-popup-head-controls' },
        h(Menu, {
          open: workspaceMenuOpen && workspaces.length > 0, align: 'end', portal: true, autoFocus: true, minWidthFromAnchor: true,
          className: 'power-dsh-search-popup-workspace-menu',
          selectedId: workspaceId === '' ? 'all' : workspaceId,
          items: [{ id: 'all', label: t('searchPopupAllWorkspaces') },
            ...workspaces.map(workspace => ({ id: workspace.workspaceId, label: workspace.title }))],
          onClose: () => setWorkspaceMenuOpen(false),
          onSelect: (id: string) => { setWorkspaceMenuOpen(false); setWorkspaceId(id === 'all' ? '' : id); },
          anchor: h('button', {
            type: 'button', className: 'power-dsh-search-popup-workspace', disabled: workspaces.length === 0,
            'aria-haspopup': 'menu', 'aria-expanded': workspaceMenuOpen && workspaces.length > 0,
            'aria-label': t('searchPopupAllWorkspaces'),
            onClick: () => setWorkspaceMenuOpen(visible => !visible),
          }, folderIcon,
          h('span', { className: 'power-dsh-search-popup-workspace-label' }, selectedWorkspace?.title ?? t('searchPopupAllWorkspaces')),
          chevronIcon),
        }),
      ),
    ),
    h('div', { ref: listRef, className: 'power-dsh-search-popup-list', 'aria-busy': pending },
      // The raw host message never reaches the panel: the shared feedback keeps the
      // product summary on screen and the original text behind its details dialog.
      !serviceReady && h('p', { className: 'power-dsh-search-popup-status' }, t('searchPopupNoAccess')),
      searchFailed && errorFeedback({
        t, message: t('searchPopupFailed'), code: 'PD-SEARCH-POPUP-QUERY',
        operation: 'sessions.search', placement: 'inline', retry: retrySearch,
        context: { stage: 'search', result: 'failed' },
      }),
      !searching && recentPreviews.key === recentKey && recentPreviews.status === 'error' && errorFeedback({
        t, message: t('searchPopupPreviewFailed'), code: 'PD-SEARCH-POPUP-PREVIEW',
        operation: 'sessions.preview', placement: 'inline', retry: retrySearch,
        context: { stage: 'preview', result: 'failed' },
      }),
      indexBuilding && h('p', { className: 'power-dsh-search-popup-status' }, t('searchPopupIndexBuilding')),
      rows.length > 0 && h('ul', {
        className: 'power-dsh-search-popup-results', role: 'listbox',
        'aria-label': searching ? t('searchPopupResults') : t('searchPopupRecent'),
      }, rows.map((row, index) => {
        const workspace = workspaceOf(row.sessionId);
        return h('li', { key: row.sessionId, role: 'presentation' }, h('button', {
          type: 'button', className: 'power-dsh-search-popup-row', role: 'option',
          'data-active': index === active, 'aria-selected': index === active,
          onClick: () => choose(row.sessionId),
        },
        h('span', { className: 'power-dsh-search-popup-row-main' },
          h('span', { className: 'power-dsh-search-popup-title' }, highlight(h, row.title, normalizedQuery)),
          workspace !== undefined && h('span', { className: 'power-dsh-search-popup-row-workspace' },
            folderIcon, h('span', null, workspace))),
        h('span', { className: 'power-dsh-search-popup-row-line' },
          row.snippet !== '' && h('span', { className: 'power-dsh-search-popup-snippet' },
            highlight(h, displaySnippet(row.snippet, normalizedQuery), normalizedQuery)),
          dateOf(row.sessionId) !== '' && h('span', { className: 'power-dsh-search-popup-date' }, dateOf(row.sessionId)))));
      })),
      pending && h('div', {
        className: 'power-dsh-search-popup-skeleton', role: 'status', 'aria-label': t('searchPopupSearching'),
      }, [0, 1].map(slot => h('div', {
        key: slot, className: 'power-dsh-search-popup-skeleton-row', 'aria-hidden': true,
      },
      h('span', { className: 'power-dsh-search-popup-skeleton-dot' }),
      h('span', { className: 'power-dsh-search-popup-skeleton-bars' },
        h('span', { className: 'power-dsh-search-popup-skeleton-bar' }),
        h('span', { className: 'power-dsh-search-popup-skeleton-bar power-dsh-search-popup-skeleton-bar-wide' }))))),
      searching && rows.length === 0 && (!enhanced || currentRemote?.status === 'ready')
      && h('div', { className: 'power-dsh-search-popup-empty' },
        h('p', { className: 'power-dsh-search-popup-empty-title' }, t('searchPopupNoMatches')),
        h('p', { className: 'power-dsh-search-popup-empty-hint' }, t('searchPopupNoMatchesHint')),
      ),
    ),
    h('div', { className: 'power-dsh-search-popup-foot' },
      searching && !pending && rows.length >= resultLimit && h('span', {
        className: 'power-dsh-search-popup-limit',
        title: t('searchPopupLimited').replace('{n}', () => String(resultLimit)),
      }, t('searchPopupLimited').replace('{n}', () => String(resultLimit))),
      h('span', { className: 'power-dsh-search-popup-count' }, t('searchPopupCount').replace('{n}', () => String(rows.length))),
    ))));
  }

  const setSearchPopupEnabled = async (enabled: boolean) => {
    const result = await ctx.remote.powerDsh.setSearchPopupEnabled(enabled);
    await ctx.configForms.describe().load();
    if (!result.ok) throw new Error(result.error.message);
  };
  return {
    settings: [
      { field: 'searchPopupEnabled', description: 'searchPopupDescription', save: next => setSearchPopupEnabled(next === true) },
    ],
    api: { setSearchPopupEnabled },
    styles,
  } satisfies ClientFeature;
}
