import { isRecord } from '../../shared/types/protocol.ts';
import type { SearchContentResult } from '../../shared/types/wire.ts';
import type { ContentQueryService, ContentSession, ContentSessionStore } from './content-index.ts';

const LIMIT = 10;
const SNIPPET_LENGTH = 240;

interface Entry {
  version: string;
  source: ContentSession | undefined;
  seq: number | undefined;
  generation: number | undefined;
  value: Promise<string>;
}

function messageText(event: unknown): string {
  if (!isRecord(event) || !isRecord(event.data)) return '';
  const content = event.type === 'user/message' ? event.data.content
    : event.type === 'assistant/message' && isRecord(event.data.message) ? event.data.message.content : undefined;
  if (!Array.isArray(content)) return '';
  const text = content.flatMap((block: unknown) =>
    isRecord(block) && block.type === 'text' && typeof block.text === 'string' ? [block.text] : [])
    .join(' ').replace(/\s+/gu, ' ').trim();
  const characters = Array.from(text);
  return characters.length <= SNIPPET_LENGTH ? text : `${characters.slice(0, SNIPPET_LENGTH - 1).join('')}…`;
}

function newestText(events: readonly unknown[], nodes?: readonly number[]): string {
  for (let index = (nodes?.length ?? events.length) - 1; index >= 0; index--) {
    const text = messageText(events[nodes?.[index] ?? index]);
    if (text !== '') return text;
  }
  return '';
}

export class RecentPreviews {
  service: ContentQueryService | null = null;
  store: ContentSessionStore | null = null;
  private readonly entries = new Map<string, Entry>();
  private readonly controller = new AbortController();
  private readonly lanes: Promise<unknown>[] = [Promise.resolve(), Promise.resolve()];
  private nextLane = 0;
  private epoch = 0;

  invalidate(id: string) {
    this.entries.delete(id);
  }

  clear() {
    this.epoch++;
    this.entries.clear();
  }

  dispose() {
    this.controller.abort();
    this.service = null;
    this.store = null;
    this.clear();
  }

  private async snippet(id: string, source: ContentSession | undefined, generation: number | undefined): Promise<string> {
    const service = this.service!;
    if (source !== undefined && service.observeSession !== undefined) {
      const cut = await service.observeSession(id, { signal: this.controller.signal, projectionMode: 'none' });
      try {
        if (source === this.store?.get(id) && source.seq === cut.cursor + 1
          && source.surface.contentGeneration === generation) return newestText(cut.events, source.surface.nodes);
      } finally {
        cut[Symbol.dispose]();
      }
    }
    const surface = await service.readSurface(id);
    return newestText(surface.events);
  }

  async read(sessionIds: readonly string[], versions: readonly string[]): Promise<SearchContentResult> {
    if (sessionIds.length > LIMIT || versions.length !== sessionIds.length
      || sessionIds.some(id => id === '' || id.length > 128)) throw new TypeError('Invalid recent-session preview request');
    const empty = { available: false, items: [], previews: [] };
    if (this.service === null || this.controller.signal.aborted) return empty;
    const epoch = this.epoch;
    const wanted = new Set(sessionIds);
    for (const id of this.entries.keys()) if (!wanted.has(id)) this.entries.delete(id);
    const previews: SearchContentResult['previews'] = [];
    let position = 0;
    const worker = async () => {
      while (position < sessionIds.length && epoch === this.epoch && !this.controller.signal.aborted) {
        const index = position++;
        const id = sessionIds[index]!;
        const version = versions[index]!;
        const source = this.store?.get(id);
        const generation = source?.surface.contentGeneration;
        let entry = this.entries.get(id);
        if (entry === undefined || entry.version !== version || entry.source !== source
          || entry.seq !== source?.seq || entry.generation !== generation) {
          const lane = this.nextLane;
          this.nextLane = 1 - lane;
          const value = this.lanes[lane]!.catch(() => {}).then(() =>
            epoch === this.epoch && !this.controller.signal.aborted ? this.snippet(id, source, generation) : '');
          this.lanes[lane] = value;
          entry = { version, source, seq: source?.seq, generation, value };
          this.entries.set(id, entry);
          while (this.entries.size > LIMIT) this.entries.delete(this.entries.keys().next().value!);
        }
        let snippet: string;
        try {
          snippet = await entry.value;
        } catch (error) {
          if (this.entries.get(id) === entry) this.entries.delete(id);
          throw error;
        }
        if (epoch !== this.epoch || this.controller.signal.aborted) return;
        if (snippet !== '') previews.push({ sessionId: id, snippet });
      }
    };
    await Promise.all([worker(), worker()]);
    return epoch === this.epoch && !this.controller.signal.aborted
      ? { available: true, items: [], previews } : empty;
  }
}
