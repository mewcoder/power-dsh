import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { NativeContext, NativeSearchSession } from '../../shared/host/native.ts';
import type { SearchContentHit, SearchContentResult } from '../../shared/types/wire.ts';
import { isRecord } from '../../shared/types/protocol.ts';

// The derived index this plugin's own enhancement feature configures. The Host
// half reads it directly because the native query plan is the bottleneck: it
// highlights every MATCH row (94k rows for a term like "dsh") before ranking,
// which measured ~940ms per search on a 412MB index. Scanning the same message
// documents once into memory answers the same query in ~20ms with full recall.
const INDEX_DIRECTORY = 'power-dsh';
const INDEX_FILE = 'session-query-index.sqlite3';
const APPLICATION_ID = 0x44534851;
const SCHEMA_VERSION = 8;
const SNIPPET_CODE_POINTS = 240;
const DEFAULT_LIMIT = 20;
const MAX_DOCUMENTS = 400_000;
const RECHECK_MS = 30_000;
// A page shows at most `searchResultLimit` rows, so previews stay bounded.
const PREVIEW_LIMIT = 100;

interface Statement { all(...parameters: unknown[]): unknown[]; get(...parameters: unknown[]): unknown }
interface Database { prepare(sql: string): Statement; close(): void }
type DatabaseConstructor = new (path: string, options?: { readOnly?: boolean }) => Database;


interface DocumentRow { sessionId: string; time: number; text: string; revision: string }
interface IndexedDocument { time: number; text: string }
interface IndexedSession { id: string; createdAt: number; documents: IndexedDocument[] }
interface GenerationRow { generation: number }

export interface ContentQueryService {
  readonly config?: { readonly openAt?: string };
  searchSessions(request: { query: string; limit: number }, options: { signal: AbortSignal }): Promise<unknown>;
  readSurface(sessionId: string): Promise<{ capturedThroughSeq?: number | null; events: readonly unknown[] }>;
  observeSession?(sessionId: string, options: { signal: AbortSignal; projectionMode: 'none' }): Promise<{
    cursor: number;
    events: readonly unknown[];
    [Symbol.dispose](): void;
  }>;
}

export type ContentProjector = (sessionId: string, events: readonly unknown[]) => readonly {
  type: string; surface: string; time: number; text: string;
}[];
export type ContentSession = NativeSearchSession;

export interface ContentSessionStore {
  get(id: string): ContentSession | undefined;
}

export interface ContentPersistence {
  list(options: { signal: AbortSignal }): Promise<readonly {
    header: { id: string; createdAt: number }; revision: string;
  }[]>;
}

interface LiveEntry {
  source: ContentSession;
  seq: number;
  generation: number;
  value: IndexedSession;
}

function messageDocument(event: unknown): IndexedDocument[] {
  if (!isRecord(event) || !isRecord(event.data) || typeof event.time !== 'number') return [];
  const content = event.type === 'user/message' ? event.data.content
    : event.type === 'assistant/message' && isRecord(event.data.message) ? event.data.message.content : undefined;
  if (!Array.isArray(content)) return [];
  const text = content.flatMap((block: unknown) => {
    if (!isRecord(block)) return [];
    if (block.type === 'text' && typeof block.text === 'string') return [block.text.trim()];
    if (block.type === 'tool-call' && typeof block.name === 'string' && typeof block.arguments === 'string') {
      return [block.name.trim(), block.arguments.trim()];
    }
    return [];
  }).filter(Boolean).join('\n');
  return text === '' ? [] : [{ time: event.time, text }];
}

/** Center a bounded window on the first match, mirroring the engine's snippet contract. */
function makeSnippet(text: string, matchIndex: number, matchLength: number): string {
  const characters = Array.from(text);
  if (characters.length <= SNIPPET_CODE_POINTS) return text;
  const before = Array.from(text.slice(0, matchIndex)).length;
  const length = Math.max(1, Array.from(text.slice(matchIndex, matchIndex + matchLength)).length);
  const budget = SNIPPET_CODE_POINTS - 2;
  const lead = Math.max(0, Math.min(before, Math.floor((budget - length) / 3)));
  let start = Math.max(0, before - lead);
  if (before + length > start + budget) start = Math.max(0, before + length - budget);
  const end = Math.min(characters.length, start + budget);
  return `${start > 0 ? '…' : ''}${characters.slice(start, end).join('')}${end < characters.length ? '…' : ''}`;
}

/** The newest message of a session, used as a preview when only its title matched. */
function previewOf(session: IndexedSession): string {
  let newest: IndexedDocument | undefined;
  for (const document of session.documents) {
    if (newest === undefined || document.time > newest.time) newest = document;
  }
  if (newest === undefined) return '';
  return makeSnippet(newest.text, 0, 0);
}

/**
 * In-memory content index over the deployment's derived session-query database.
 *
 * The durable cache is initialized once and active messages advance on session
 * events. Cold revisions are checked on demand rather than on every keystroke.
 * Every unavailable cache path answers
 * `available: false`, so the Client falls back to the native search service.
 */
export class ContentIndex {
  owner: NativeContext;
  sessions: IndexedSession[] | null = null;
  generation = -1;
  service: ContentQueryService | null = null;
  store: ContentSessionStore | null = null;
  persistence: ContentPersistence | null = null;
  project: ContentProjector | null = null;
  private readonly revisions = new Map<string, string>();
  private readonly live = new Map<string, LiveEntry>();
  private readonly dirty = new Set<string>();
  private readonly removed = new Set<string>();
  private prepared: Promise<boolean> | null = null;
  private checking: Promise<void> | null = null;
  private checkedAt = 0;
  private readonly controller = new AbortController();
  private readonly syncQuery = `power-dsh-index-sync-${randomUUID()}`;
  private epoch = 0;
  private readonly enabled: () => boolean;

  /** Resolved derived-index path; assignable so a probe can target one file. */
  path: string;

  constructor(owner: NativeContext, enabled: () => boolean = () => true) {
    this.owner = owner;
    this.enabled = enabled;
    this.path = join(owner.profileContext.home, INDEX_DIRECTORY, INDEX_FILE);
  }

  async connect(): Promise<Database | null> {
    let db: Database | undefined;
    try {
      const module = await import('node:sqlite') as unknown as { DatabaseSync: DatabaseConstructor };
      db = new module.DatabaseSync(this.path, { readOnly: true });
      const application = db.prepare('PRAGMA application_id').get() as { application_id?: number } | undefined;
      const version = db.prepare('PRAGMA user_version').get() as { user_version?: number } | undefined;
      if (application?.application_id !== APPLICATION_ID || version?.user_version !== SCHEMA_VERSION) {
        db.close();
        return null;
      }
      return db;
    } catch {
      try { db?.close(); } catch {}
      return null;
    }
  }

  clear() {
    this.epoch++;
    this.sessions = null;
    this.generation = -1;
    this.revisions.clear();
    this.live.clear();
    this.dirty.clear();
    this.removed.clear();
    this.checkedAt = 0;
    this.prepared = null;
    this.checking = null;
  }

  dispose() {
    this.controller.abort();
    this.service = null;
    this.store = null;
    this.persistence = null;
    this.project = null;
    this.clear();
  }

  async load(sessionIds?: readonly string[]): Promise<boolean> {
    const epoch = this.epoch;
    const db = await this.connect();
    if (db === null) return false;
    try {
      if (epoch !== this.epoch || this.controller.signal.aborted || !this.enabled()) return false;
      const state = db.prepare('SELECT global_generation AS generation FROM search_state WHERE singleton = 1')
        .get() as GenerationRow | undefined;
      const generation = state?.generation ?? -1;
      if (this.sessions !== null && generation === this.generation) {
        return true;
      }
      const scope = sessionIds === undefined ? null : JSON.stringify(sessionIds);
      const rows = db.prepare(`
        SELECT d.session_id AS sessionId, d.time AS time, d.text AS text, s.created_at AS createdAt, s.revision AS revision
        FROM persisted_docs AS d
        JOIN persisted_sessions AS s ON s.id = d.session_id
        WHERE d.type IN ('user/message','assistant/message') AND d.surface = 'current'
          AND (? IS NULL OR d.session_id IN (SELECT value FROM json_each(?)))
        LIMIT ?
      `).all(scope, scope, MAX_DOCUMENTS + 1) as (DocumentRow & { createdAt: number })[] | undefined;
      if (rows === undefined || rows.length > MAX_DOCUMENTS) {
        this.clear();
        return false;
      }
      const bySession = new Map<string, IndexedSession>();
      const revisions = new Map<string, string>();
      for (const row of rows) {
        let session = bySession.get(row.sessionId);
        if (session === undefined) {
          session = { id: row.sessionId, createdAt: row.createdAt, documents: [] };
          bySession.set(row.sessionId, session);
        }
        session.documents.push({ time: row.time, text: row.text });
        revisions.set(row.sessionId, row.revision);
      }
      this.sessions = [...bySession.values()];
      this.revisions.clear();
      for (const [id, revision] of revisions) this.revisions.set(id, revision);
      this.generation = generation;
      return true;
    } catch {
      this.sessions = null;
      return false;
    } finally {
      db.close();
    }
  }

  invalidate(id: string) {
    if (!this.enabled() || this.controller.signal.aborted || (this.sessions === null && this.prepared === null)) return;
    this.live.delete(id);
    this.dirty.add(id);
    this.removed.delete(id);
  }

  append(source: ContentSession, event: unknown) {
    if (!this.enabled() || this.controller.signal.aborted) return;
    const entry = this.live.get(source.id);
    if (entry === undefined) return;
    try {
      if (entry.source !== source || !isRecord(event) || event.seq !== entry.seq
        || source.surface.contentGeneration !== entry.generation) {
        this.invalidate(source.id);
        return;
      }
      const documents = messageDocument(event);
      if (documents.length > 0 && source.surface.nodes.includes(entry.seq)) {
        entry.value.documents.push(...documents);
      }
      entry.seq++;
    } catch {
      this.invalidate(source.id);
    }
  }

  private active(epoch: number) {
    return epoch === this.epoch && this.enabled() && !this.controller.signal.aborted;
  }

  private async prepare(sessionIds: readonly string[]): Promise<boolean> {
    if (this.prepared !== null) return this.prepared;
    if (this.sessions !== null) return true;
    const service = this.service;
    if (service === null) return false;
    const epoch = this.epoch;
    const operation = (async () => {
      if (service.config?.openAt === 'never') throw new Error('session search is disabled');
      let loaded = await this.load(sessionIds);
      if (!loaded && this.active(epoch)) {
        await service.searchSessions({ query: this.syncQuery, limit: 1 }, { signal: this.controller.signal });
        if (!this.active(epoch)) return false;
        loaded = await this.load(sessionIds);
      }
      if (loaded && this.active(epoch)) {
        await this.checkRevisions(epoch);
        if (this.active(epoch)) this.checkedAt = Date.now();
      }
      return loaded;
    })();
    this.prepared = operation;
    try {
      return await operation;
    } finally {
      if (this.prepared === operation) this.prepared = null;
    }
  }

  private async checkRevisions(epoch: number) {
    if (this.checking !== null) return this.checking;
    if (this.persistence === null || Date.now() - this.checkedAt < RECHECK_MS) return;
    const operation = this.reconcileRevisions(epoch, this.persistence);
    this.checking = operation;
    try {
      await operation;
    } finally {
      if (this.checking === operation) this.checking = null;
    }
  }

  private async reconcileRevisions(epoch: number, persistence: ContentPersistence) {
    const records = await persistence.list({ signal: this.controller.signal });
    if (!this.active(epoch)) return;
    const retained = new Set<string>();
    for (const record of records) {
      const id = record.header.id;
      retained.add(id);
      this.removed.delete(id);
      if (this.revisions.get(id) !== record.revision && this.store?.get(id) === undefined) this.dirty.add(id);
      this.revisions.set(id, record.revision);
    }
    this.sessions = this.sessions?.filter(session => {
      if (retained.has(session.id) || this.store?.get(session.id) !== undefined) return true;
      this.removed.add(session.id);
      this.live.delete(session.id);
      return false;
    }) ?? null;
    for (const id of this.revisions.keys()) {
      if (!retained.has(id)) this.revisions.delete(id);
    }
    for (const id of this.dirty) {
      if (!retained.has(id) && this.store?.get(id) === undefined) this.dirty.delete(id);
    }
    this.checkedAt = Date.now();
  }

  private async updateSession(id: string, base: IndexedSession | undefined, epoch: number): Promise<IndexedSession | undefined> {
    const source = this.store?.get(id);
    if (source === undefined && this.removed.has(id)) return undefined;
    const cached = this.live.get(id);
    const generation = source?.surface.contentGeneration;
    if (source !== undefined && cached?.source === source && cached.seq === source.seq && cached.generation === generation) {
      return cached.value;
    }
    if (source === undefined && !this.dirty.has(id) && base !== undefined) return base;
    const seq = source?.seq;
    const snapshot = await this.readDocuments(id, source, generation);
    if (!this.active(epoch)) return undefined;
    const value = { id, createdAt: source?.header.createdAt ?? base?.createdAt ?? 0,
      documents: snapshot.documents };
    let replaced = false;
    this.sessions = (this.sessions ?? []).map(session => {
      if (session.id !== id) return session;
      replaced = true;
      return value;
    });
    if (!replaced) this.sessions.push(value);
    this.dirty.delete(id);
    if (source !== undefined) {
      this.live.set(id, { source, seq: snapshot.cursor === undefined ? seq! : snapshot.cursor + 1,
        generation: generation!, value });
    }
    return value;
  }

  private async readDocuments(id: string, source: ContentSession | undefined, generation: number | undefined) {
    const service = this.service!;
    if (service.observeSession !== undefined && (source !== undefined || this.project !== null)) {
      const cut = await service.observeSession(id, { signal: this.controller.signal, projectionMode: 'none' });
      try {
        if (source !== undefined && source === this.store?.get(id) && source.seq === cut.cursor + 1
          && source.surface.contentGeneration === generation) {
          const events = cut.events;
          return { cursor: cut.cursor, documents: source.surface.nodes.flatMap(seq => messageDocument(events[seq])) };
        }
        if (this.project !== null) {
          const documents = this.project(id, cut.events)
            .filter(document => document.surface === 'current'
              && (document.type === 'user/message' || document.type === 'assistant/message'))
            .map(document => ({ time: document.time, text: document.text }));
          return { cursor: cut.cursor, documents };
        }
      } finally {
        cut[Symbol.dispose]();
      }
    }
    const surface = await service.readSurface(id);
    return { cursor: surface.capturedThroughSeq ?? undefined, documents: surface.events.flatMap(messageDocument) };
  }

  /** Full-recall literal substring search: match count, then recency. */
  search(query: string, limit = DEFAULT_LIMIT, sessionIds?: readonly string[], sessions = this.sessions): SearchContentHit[] {
    if (query === '' || sessions === null) return [];
    const order = sessionIds === undefined ? null : new Map(sessionIds.map((id, index) => [id, index]));
    // One case-insensitive regex per query: no lowercased copy of the corpus is
    // retained (saves ~13MB here), and the scan is the same speed.
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'giu');
    const codePoints = Array.from(query).length;
    const hits: { sessionId: string; count: number; time: number; createdAt: number;
      index: number; text: string }[] = [];
    const byId = new Map(sessions.map(session => [session.id, session]));
    const ordered = sessionIds === undefined ? sessions : [...new Set(sessionIds)].flatMap(id => {
      const session = byId.get(id);
      return session === undefined ? [] : [session];
    });
    for (const session of ordered) {
      let count = 0;
      let best: { count: number; time: number; index: number; text: string } | null = null;
      for (const document of session.documents) {
        pattern.lastIndex = 0;
        const first = pattern.exec(document.text);
        if (first === null) continue;
        let matches = 1;
        while (pattern.exec(document.text) !== null) matches++;
        count += matches;
        if (best === null || matches > best.count || (matches === best.count && document.time > best.time)) {
          best = { count: matches, time: document.time, index: first.index, text: document.text };
        }
      }
      if (best === null) continue;
      hits.push({ sessionId: session.id, count, time: best.time, createdAt: session.createdAt,
        index: best.index, text: best.text });
      if (order !== null && hits.length >= limit) break;
    }
    hits.sort((left, right) => order === null
      ? right.count - left.count || right.time - left.time || right.createdAt - left.createdAt
      : order.get(left.sessionId)! - order.get(right.sessionId)!);
    // Snippets are the expensive part, so only the visible page pays for them.
    return hits.slice(0, limit).map(hit => ({
      sessionId: hit.sessionId, snippet: makeSnippet(hit.text, hit.index, codePoints),
    }));
  }

  /**
   * Newest-message previews for the given sessions, so a title-only match still
   * fills its snippet line instead of rendering an empty second row.
   */
  previews(sessionIds: readonly string[], limit = PREVIEW_LIMIT, sessions = this.sessions): SearchContentHit[] {
    if (sessions === null) return [];
    const wanted = new Set(sessionIds.slice(0, limit));
    const result: SearchContentHit[] = [];
    for (const session of sessions) {
      if (!wanted.has(session.id)) continue;
      const snippet = previewOf(session);
      if (snippet !== '') result.push({ sessionId: session.id, snippet });
      if (result.length === wanted.size) break;
    }
    return result;
  }

  async query(query: string, limit = DEFAULT_LIMIT, previewIds: readonly string[] = [], sessionIds: readonly string[] = []): Promise<SearchContentResult> {
    if (!this.enabled() || this.controller.signal.aborted) {
      this.clear();
      return { available: true, items: [], previews: [] };
    }
    if (query.trim() === '') return { available: true, items: [], previews: [] };
    if (sessionIds.length === 0) return { available: true, items: [], previews: [] };
    const service = this.service;
    if (service === null) return { available: false, items: [], previews: [] };
    const epoch = this.epoch;
    if (!await this.prepare(sessionIds)) return { available: !this.active(epoch), items: [], previews: [] };
    if (!this.active(epoch)) return { available: true, items: [], previews: [] };
    await this.checkRevisions(epoch);
    if (!this.active(epoch)) return { available: true, items: [], previews: [] };
    const wanted = new Set(sessionIds);
    const byId = new Map((this.sessions ?? []).map(session => [session.id, session]));
    const sessions: IndexedSession[] = [];
    for (const id of wanted) {
      const value = await this.updateSession(id, byId.get(id), epoch);
      if (!this.active(epoch)) return { available: true, items: [], previews: [] };
      if (value !== undefined) sessions.push(value);
    }
    const boundedLimit = Math.max(1, Math.min(100, Number.isSafeInteger(limit) ? limit : DEFAULT_LIMIT));
    return { available: true, items: this.search(query, boundedLimit, sessionIds, sessions),
      previews: this.previews(previewIds.filter(id => wanted.has(id)), PREVIEW_LIMIT, sessions) };
  }
}
