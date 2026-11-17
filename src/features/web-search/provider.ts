/**
 * The two host `web` providers this feature registers: one aggregate search
 * provider and one aggregate fetch provider. Each walks the user's enabled
 * backends in order and returns the first usable answer.
 *
 * Registering ONE provider per capability (rather than one per vendor) is what
 * keeps the host's selection unambiguous: `ctx.web` treats two usable providers
 * with no explicit selection as `WEB_PROVIDER_AMBIGUOUS`, so a user with three
 * configured keys would otherwise break search entirely.
 *
 * @module power-dsh/web-search/provider
 */

import { BackendError, type BackendFetchResult, type BackendSearchResult, type WebBackend } from './backends.ts';
import { LOCAL_FETCH } from './chain.ts';

/** Provider ids written into the host's `web.searchProvider` / `web.fetchProvider`. */
export const SEARCH_PROVIDER_ID = 'power-dsh-search';
export const FETCH_PROVIDER_ID = 'power-dsh-fetch';

/** One configured instance in a chain, paired with the key resolved for it. */
export interface BackendSlot {
  /** Instance id; two instances may share a vendor with different keys. */
  id: string;
  backend: WebBackend;
  /** Resolved key; empty means skip this instance. */
  apiKey: string;
}

export type FetchSlot = BackendSlot | typeof LOCAL_FETCH.id;

/** A capability, each with its own chain. */
export type Capability = 'search' | 'fetch';

/**
 * Whether a slot can serve its chain's capability. A backend that needs a key
 * but has none is skipped instead of being attempted and failing on every
 * request: the settings page reports it as unconfigured, and the chain must
 * agree.
 */
export function usable(slot: BackendSlot): boolean {
  return slot.apiKey.trim() !== '';
}

/** The result of walking the chain: a value, or every failure collected. */
export type ChainResult<T> =
  | { ok: true; value: T; backend: string }
  | { ok: false; failures: { backend: string; message: string }[] };

/**
 * Try each usable slot in order until one succeeds. A thrown `BackendError`
 * with a 401/403/429 status is a credential or quota problem that will not
 * resolve within one request, so the chain moves on immediately rather than
 * retrying; every other failure also moves on, because a dead backend must not
 * block the rest. An aborted signal stops the walk and propagates.
 */
async function walk<T>(
  slots: readonly BackendSlot[],
  run: (slot: BackendSlot) => Promise<T>,
  signal: AbortSignal,
): Promise<ChainResult<T>> {
  const failures: { backend: string; message: string }[] = [];
  for (const slot of slots) {
    if (signal.aborted) break;
    if (!usable(slot)) continue;
    try {
      return { ok: true, value: await run(slot), backend: slot.backend.id };
    } catch (error) {
      if (signal.aborted) break;
      failures.push({ backend: slot.id, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { ok: false, failures };
}

/** A readable one-line summary of every failure, for the seam's error message. */
export function describeFailures(failures: readonly { backend: string; message: string }[]): string {
  if (failures.length === 0) return 'no usable web backend is configured';
  return failures.map(failure => `${failure.backend}: ${failure.message}`).join('; ');
}

/**
 * The aggregate search provider. `slots` is read on every call so a settings
 * change or a rotated key applies to the next search without remounting.
 */
export class AggregateSearchProvider {
  readonly id = SEARCH_PROVIDER_ID;
  readonly title = 'power-dsh';
  readonly description = { en: 'Searches through the free web backends enabled in power-dsh', zh: '通过 power-dsh 中已启用的免费网页后端搜索' };

  private readonly slots: () => readonly BackendSlot[];

  constructor(slots: () => readonly BackendSlot[]) { this.slots = slots; }

  /** Cheap local check: at least one slot can serve a search right now. */
  available(): boolean {
    return this.slots().some(slot => usable(slot));
  }

  async search(request: { query: string; maxResults?: number }, signal?: AbortSignal): Promise<BackendSearchResult & { truncated: boolean }> {
    const controller = signal ?? new AbortController().signal;
    const result = await walk(this.slots(),
      slot => slot.backend.search(request, slot.apiKey, controller), controller);
    if (!result.ok) throw new BackendError(`web search failed (${describeFailures(result.failures)})`);
    const bound = request.maxResults;
    const sources = bound === undefined || result.value.sources.length <= bound
      ? result.value.sources : result.value.sources.slice(0, bound);
    return { ...result.value, sources, truncated: sources.length < result.value.sources.length };
  }
}

/** The native local fetcher, duck-typed from its public class. */
export interface LocalFetcher {
  fetch(request: { url: string }, signal?: AbortSignal): Promise<{
    url: string;
    statusCode: number;
    body: { kind: 'html' | 'text'; content: string };
    truncated: boolean;
  }>;
}

/** The aggregate fetch provider walks local and third-party steps in saved order. */
export class AggregateFetchProvider {
  readonly id = FETCH_PROVIDER_ID;
  readonly title = 'power-dsh';
  readonly description = { en: 'Fetches through local and third-party steps in the order configured in power-dsh', zh: '按 power-dsh 中配置的顺序通过本机与第三方后端抓取' };

  private readonly slots: () => readonly FetchSlot[];
  private readonly local: () => LocalFetcher | null;

  constructor(slots: () => readonly FetchSlot[], local: () => LocalFetcher | null = () => null) {
    this.slots = slots;
    this.local = local;
  }

  /** The local fetcher alone makes this provider usable, even with no chain. */
  available(): boolean {
    return this.local() !== null || this.slots().some(slot => typeof slot !== 'string' && usable(slot));
  }

  async fetch(request: { url: string }, signal?: AbortSignal): Promise<{ url: string; statusCode: number; body: { kind: 'html' | 'text'; content: string }; truncated: boolean }> {
    const controller = signal ?? new AbortController().signal;
    const slots = this.slots();
    const ordered: readonly FetchSlot[] = slots.includes(LOCAL_FETCH.id) ? slots : [LOCAL_FETCH.id, ...slots];
    const failures: { backend: string; message: string }[] = [];
    for (const slot of ordered) {
      if (controller.aborted) throw new BackendError('web fetch aborted');
      try {
        if (slot === LOCAL_FETCH.id) {
          const local = this.local();
          if (local) return await local.fetch(request, controller);
          continue;
        }
        if (!usable(slot)) continue;
        const body: BackendFetchResult = await slot.backend.fetch(request.url, slot.apiKey, controller);
        return { url: request.url, statusCode: 200, body: { kind: 'text', content: body.content }, truncated: body.truncated };
      } catch (error) {
        if (controller.aborted) throw new BackendError('web fetch aborted');
        failures.push({ backend: typeof slot === 'string' ? slot : slot.id,
          message: error instanceof Error ? error.message : String(error) });
      }
    }
    throw new BackendError(`web fetch failed (${describeFailures(failures)})`);
  }
}
