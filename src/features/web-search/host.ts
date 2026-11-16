/**
 * Host half: registers the aggregate `web` providers, keeps them fed with the
 * user's enabled backends and resolved keys, and owns every write the settings
 * page performs (key storage, enable/disable, ordering).
 *
 * The providers are registered into the native `ctx.web` seam, so the built-in
 * `web_search` / `web_fetch` tools keep working unchanged — this feature changes
 * who answers them, not which tools the model sees.
 *
 * @module power-dsh/web-search/host
 */

import type { NativeContext, NativeEntry, Release } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { HostOptions, HostService } from '../../shared/host/feature.ts';
import { BACKENDS, backendOf } from './backends.ts';
import { AggregateFetchProvider, AggregateSearchProvider, FETCH_PROVIDER_ID, SEARCH_PROVIDER_ID, type BackendSlot, type Capability, type LocalFetcher } from './provider.ts';
import { credentialsOf, readSlotRows, resolveKey, writeKey, type Credentials, type SlotPreference } from './state.ts';
import type { WebSearchCatalog, WebSearchProbe } from './types.ts';
import { probeDiagnostic } from './probe-diagnostics.ts';

/** The native `web` seam this feature registers into. */
interface WebSeam {
  registerSearchProvider(provider: unknown): Release;
  registerFetchProvider(provider: unknown): Release;
}

/** Narrow the native context to the `web` seam, when the profile mounts it. */
function webOf(ctx: NativeContext): WebSeam | undefined {
  const service: unknown = (ctx as { web?: unknown }).web;
  if (!service || typeof service !== 'object') return undefined;
  const candidate = service as Partial<WebSeam>;
  return typeof candidate.registerSearchProvider === 'function' && typeof candidate.registerFetchProvider === 'function'
    ? service as WebSeam : undefined;
}

/** The `web` Loader entry whose provider selection this feature pins. */
const WEB_MODULE = '@deepseek-ai/dsh-web';

/**
 * Read one stored chain, dropping instances whose vendor this build no longer
 * ships and any repeated instance id. The stored order IS the fallback order.
 * Two entries may share a vendor — they are distinct instances with their own keys.
 */
function chainOf(value: unknown, capability: Capability, reserved: ReadonlySet<string>): SlotPreference[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const legacyProviders = new Set<string>();
  return value.flatMap(row => {
    if (typeof row === 'string') {
      if (!backendOf(row) || legacyProviders.has(row)) return [];
      legacyProviders.add(row);
      const base = `legacy-${capability}-${row}`;
      const id = reserved.has(base) ? newSlotId(base, new Set([...reserved, ...seen])) : base;
      seen.add(id);
      return [{ id, provider: row, legacyCredentialId: row }];
    }
    if (typeof row !== 'object' || row === null) return [];
    const { id, provider } = row as { id?: unknown; provider?: unknown };
    if (typeof id !== 'string' || typeof provider !== 'string') return [];
    if (backendOf(provider) === undefined || id === '' || seen.has(id)) return [];
    seen.add(id);
    return [{ id, provider }];
  });
}

/** Every instance id the two chains currently hold. */
function instanceIds(search: readonly SlotPreference[], fetch: readonly SlotPreference[]): Set<string> {
  return new Set([...search, ...fetch].map(slot => slot.id));
}

/** Build an instance id that no chain is using yet: `<vendor>-<n>`. */
function newSlotId(provider: string, taken: ReadonlySet<string>): string {
  for (let index = 1; ; index++) {
    const candidate = `${provider}-${String(index)}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export function createHost(ctx: NativeContext, config: LivePreferences, { owner, ensureActive, setThirdPartySearchActive }: HostOptions) {
  let alive = true;
  let seam: WebSeam | null = null;
  /** Held from a child context that DECLARES `credentials`, never read off the root. */
  let credentials: Credentials | null = null;
  let releases: Release[] = [];
  /** Serializes provider registration and the pin write, so they cannot interleave. */
  let tail: Promise<unknown> = Promise.resolve();
  /** Which capabilities this feature currently has pinned to its own provider. */
  const pinned = { search: false, fetch: false };

  // Each capability has its own chain. The providers read their slot list on
  // every call, so a key or order change reaches the next request without
  // re-registering anything.
  let currentSearch: BackendSlot[] = [];
  let currentFetch: BackendSlot[] = [];
  /** The machine's own fetcher, resolved from the native package when present. */
  let localFetcher: LocalFetcher | null = null;
  const search = new AggregateSearchProvider(() => currentSearch);
  const fetchProvider = new AggregateFetchProvider(() => currentFetch, () => localFetcher);

  const enabled = () => config.webSearchEnabled?.get() === true;
  const reservedIds = () => new Set([...(config.webSearchChain?.get() ?? []), ...(config.webFetchChain?.get() ?? [])]
    .flatMap(row => typeof row === 'object' && row !== null ? [row.id] : []));
  const searchChain = () => chainOf(config.webSearchChain?.get(), 'search', reservedIds());
  const fetchChain = () => chainOf(config.webFetchChain?.get(), 'fetch', reservedIds());

  /** Resolve one chain into slots, reading each instance's own key. */
  const slotsOf = async (chain: readonly SlotPreference[]): Promise<BackendSlot[]> => {
    const slots: BackendSlot[] = [];
    for (const slot of chain) {
      const backend = backendOf(slot.provider);
      if (!backend) continue;
      slots.push({ id: slot.id, backend, apiKey: await resolveKey(credentials ?? undefined, slot.legacyCredentialId ?? slot.id) });
    }
    return slots;
  };

  const refreshSlots = async (): Promise<void> => {
    const [nextSearch, nextFetch] = await Promise.all([slotsOf(searchChain()), slotsOf(fetchChain())]);
    currentSearch = nextSearch;
    currentFetch = nextFetch;
  };

  /** The `web` entry this feature pins provider selection on, when editable. */
  const webEntry = (): NativeEntry | undefined => {
    try {
      return ctx.configEditor.entries().find(entry => entry.options.name === WEB_MODULE);
    } catch {
      return undefined;
    }
  };

  /**
   * Point one capability's selection at this feature's provider.
   *
   * Search is always pinned while the feature is on: the aggregate provider is
   * the only thing that can serve the user's third-party chain. Fetch is pinned
   * only when the user actually put something in the fetch chain — otherwise the
   * native local `http` provider keeps serving fetches, which is free and reaches
   * intranet and loopback addresses. Pinning fetch unconditionally used to take
   * that away from anyone who merely turned the feature on.
   */
  const pinCapability = async (capability: Capability): Promise<boolean> => {
    const entry = webEntry();
    if (!entry) return false;
    const field = capability === 'search' ? 'searchProvider' : 'fetchProvider';
    const ours = capability === 'search' ? SEARCH_PROVIDER_ID : FETCH_PROVIDER_ID;
    if ((entry.options.config ?? {})[field] === ours) return true;
    await ctx.configEditor.edit(entry, (current: Record<string, unknown>) => ({ ...current, [field]: ours }));
    const next = webEntry()?.options.config ?? {};
    return next[field] === ours;
  };

  /**
   * Undo one capability's pin, but only while it is still ours: a selection the
   * user changed on the native page since is theirs and must survive. The
   * composed value the profile would have had without this feature is restored
   * instead of a guess.
   */
  const unpinCapability = async (capability: Capability): Promise<void> => {
    const entry = webEntry();
    if (!entry) return;
    const field = capability === 'search' ? 'searchProvider' : 'fetchProvider';
    const ours = capability === 'search' ? SEARCH_PROVIDER_ID : FETCH_PROVIDER_ID;
    if ((entry.options.config ?? {})[field] !== ours) return;
    // Called through `configEditor` so `this` stays the service: the native
    // editor reads `this.ownerContext`, so a detached function reference would
    // throw "Cannot read properties of undefined". The inherited layer is what a
    // clean restore needs.
    const edit = ctx.configEditor.edit as unknown as (
      this: unknown,
      entry: NativeEntry,
      change: (current: Record<string, unknown>, inherited: Record<string, unknown>) => Record<string, unknown>,
    ) => Promise<unknown>;
    await edit.call(ctx.configEditor, entry, (current, inherited) => {
      const next: Record<string, unknown> = { ...current };
      if (next[field] !== ours) return next;
      if (inherited[field] === undefined) Reflect.deleteProperty(next, field);
      else next[field] = inherited[field];
      return next;
    });
  };

  /**
   * Register both providers. The fetch provider is registered unconditionally
   * because it fronts the local fetcher: with an empty chain it behaves exactly
   * like the native `http` provider, and with members it adds the fallback. One
   * provider for both states means the page never has to explain a difference
   * the user cannot observe.
   */
  const mount = (): boolean => {
    if (!seam || releases.length > 0) return releases.length > 0;
    try {
      releases = [seam.registerSearchProvider(search), seam.registerFetchProvider(fetchProvider)];
      return true;
    } catch {
      for (const release of releases.splice(0)) release();
      return false;
    }
  };

  const unmount = (): void => {
    for (const release of releases.splice(0).reverse()) release();
  };

  /**
   * Reconcile the live state with the stored preference: refresh keys, then
   * mount/unmount and pin/unpin each capability in an order that never leaves the
   * seam pointing at an unregistered provider.
   *
   * Fetch is intentionally left alone when its chain is empty: the native local
   * `http` provider keeps serving it, free and with intranet access.
   */
  const reconcile = (): Promise<void> => {
    const task = tail.then(async () => {
      if (!alive) return;
      await refreshSlots();
      if (!alive) return;
      const wanted = enabled() && seam !== null;
      if (wanted) {
        const service = seam;
        try {
          if (!mount() || !await pinCapability('search')) throw new Error('webSearchUnavailable');
          pinned.search = true;
          if (!await pinCapability('fetch')) throw new Error('webSearchUnavailable');
          pinned.fetch = true;
          if (!alive || seam !== service) throw new Error('webSearchUnavailable');
          await setThirdPartySearchActive?.(true);
        } catch (error) {
          try {
            await setThirdPartySearchActive?.(false);
          } finally {
            try {
              await unpinCapability('fetch');
              await unpinCapability('search');
            } finally {
              pinned.fetch = pinned.search = false;
              unmount();
            }
          }
          throw error;
        }
        return;
      }
      await setThirdPartySearchActive?.(false);
      if (pinned.fetch) { await unpinCapability('fetch'); pinned.fetch = false; }
      if (pinned.search) { await unpinCapability('search'); pinned.search = false; }
      unmount();
    });
    tail = task.catch(() => {});
    return task;
  };

  /**
   * Settings-page read: the toggle, every configured instance with its key
   * state, and both chains. `slots` carries one row per instance — two rows may
   * name the same vendor with different keys.
   */
  const catalog = async (): Promise<WebSearchCatalog> => {
    ensureActive();
    await reconcile();
    const store = credentials;
    const searchSlots = searchChain();
    const fetchSlots = fetchChain();
    const all = [...searchSlots, ...fetchSlots];
    const rows = await readSlotRows(store ?? undefined, all);
    return {
      enabled: enabled(),
      available: seam !== null,
      slots: all.map(slot => {
        const backend = backendOf(slot.provider);
        const row = rows.find(candidate => candidate.id === slot.id);
        return {
          id: slot.id,
          provider: slot.provider,
          keyUrl: backend?.keyUrl ?? '',
          configured: row?.configured ?? false,
          hasKey: row?.hasKey ?? false,
          writable: row?.writable ?? false,
        };
      }),
      search: { ids: searchSlots.map(slot => slot.id) },
      fetch: { ids: fetchSlots.map(slot => slot.id) },
    };
  };

  /**
   * Persist one capability's chain. Only that capability's field is written, so
   * editing the search order can never disturb the fetch order.
   */
  const persistChain = async (capability: Capability, next: readonly SlotPreference[]): Promise<void> => {
    ensureActive();
    const field = capability === 'search' ? 'webSearchChain' : 'webFetchChain';
    for (const slot of next) {
      if (slot.legacyCredentialId === undefined) continue;
      if (!credentials) throw new Error('webSearchCredentialsUnavailable');
      const record = await credentials.readRecord(`power-dsh/${slot.legacyCredentialId}`);
      ensureActive();
      if (record?.kind === 'api-key' && typeof record.key === 'string' && record.key !== '') {
        await writeKey(credentials, slot.id, record.key);
        ensureActive();
      }
    }
    // Through `configEditor` for the same reason as `unpin`: the native editor
    // is a class method that reads `this.ownerContext`.
    const edit = ctx.configEditor.edit as unknown as (
      this: unknown,
      entry: NativeEntry,
      change: (current: Record<string, unknown>, inherited: Record<string, unknown>) => Record<string, unknown>,
    ) => Promise<unknown>;
    await edit.call(ctx.configEditor, owner.fiber.entry, (current, inherited) => {
      ensureActive();
      const rows = next.map(slot => ({ id: slot.id, provider: slot.provider }));
      if (rows.length === 0 && !Array.isArray(inherited[field])) {
        const without = { ...current };
        Reflect.deleteProperty(without, field);
        return without;
      }
      return { ...current, [field]: rows };
    });
    ensureActive();
    await reconcile();
  };

  /** Resolve which chain an operation addresses, rejecting an unknown capability. */
  const chainFor = (capability: string): { slots: SlotPreference[]; capability: Capability } => {
    if (capability !== 'search' && capability !== 'fetch') throw new TypeError('capability must be search or fetch');
    return { slots: capability === 'search' ? searchChain() : fetchChain(), capability };
  };

  ctx.inject(['credentials'], child => {
    const service = credentialsOf(child);
    if (!service) return;
    credentials = service;
    child.effect(() => () => { if (credentials === service) credentials = null; });
  });

  /**
   * Resolve the native local fetcher so the fetch chain can try the machine
   * first. Its public class is loaded through the loader rather than reimplemented:
   * URL validation, same-origin redirects, size and charset limits are all
   * behaviour this feature must not fork. Absence is not an error — the chain
   * simply starts at the first third-party backend.
   */
  ctx.inject(['loader'], child => {
    let active = true;
    void (async () => {
      try {
        const native: unknown = await child.loader.import('@deepseek-ai/dsh-web-fetch-http');
        if (!active || !native || typeof native !== 'object') return;
        const HttpFetchProvider = (native as { HttpFetchProvider?: unknown }).HttpFetchProvider;
        if (typeof HttpFetchProvider !== 'function') return;
        // The constructor's limits are the native defaults the shipped row uses.
        const instance = new (HttpFetchProvider as new (limits: unknown) => LocalFetcher)({
          maxResponseBytes: 5_000_000, maxBodyChars: 100_000, timeoutMs: 30_000,
          maxRedirects: 5, userAgent: 'deepseek-harness/0.0.1 (+https://github.com/deepseek-ai)',
        });
        if (!active) return;
        localFetcher = instance;
      } catch {
        // An older or restructured host: the chain just starts at the backends.
      }
    })();
    child.effect(() => () => {
      active = false;
      if (localFetcher) localFetcher = null;
    });
  });

  ctx.inject(['web'], child => {
    const service = webOf(child);
    if (!service) return;
    seam = service;
    void reconcile().catch(() => {});
    child.effect(() => () => {
      if (seam !== service) return;
      void setThirdPartySearchActive?.(false).catch(() => {});
      unmount();
      seam = null;
      currentSearch = [];
      currentFetch = [];
    });
  });

  ctx.on('settings/document-updated', namespace => {
    if (namespace === owner.fiber.entry?.options.id) void reconcile().catch(() => {});
  });
  ctx.effect(() => () => {
    alive = false;
    void setThirdPartySearchActive?.(false).catch(() => {});
    unmount();
    seam = null;
    credentials = null;
    currentSearch = [];
    currentFetch = [];
  });

  return {
    webSearch: {
      catalog,
      /**
       * Add one provider instance to the end of ONE chain. Each call creates a
       * new instance with its own credential record, so adding the same vendor
       * twice yields two independent keys rather than one shared one.
       */
      async addSlot(capability: string, provider: string) {
        const backend = backendOf(provider);
        if (!backend) throw new Error('webSearchUnknownBackend');
        const { slots, capability: kind } = chainFor(capability);
        const taken = instanceIds(searchChain(), fetchChain());
        await persistChain(kind, [...slots, { id: newSlotId(provider, taken), provider }]);
        return catalog();
      },
      /** Remove one instance from ONE chain and drop its credential record. */
      async removeSlot(capability: string, id: string) {
        const { slots, capability: kind } = chainFor(capability);
        if (!slots.some(slot => slot.id === id)) throw new Error('webSearchUnknownBackend');
        await persistChain(kind, slots.filter(slot => slot.id !== id));
        // The instance is gone from the page, so its key has no owner left.
        ensureActive();
        if (credentials) {
          try { await credentials.deleteRecord(`power-dsh/${id}`); } catch { /* A record left behind is invisible and harmless. */ }
        }
        return catalog();
      },
      /**
       * Replace one chain's whole order. A drag reports the final order, so one
       * atomic write replaces the repeated single-step moves a button pair needs.
       * The submitted ids must be exactly the chain's current instances: a stale
       * drag (another window changed the chain meanwhile) is rejected rather than
       * silently dropping an instance.
       */
      async reorder(capability: string, ids: readonly string[]) {
        const { slots, capability: kind } = chainFor(capability);
        if (ids.length !== slots.length) throw new Error('webSearchOrderChanged');
        const seen = new Set<string>();
        for (const id of ids) {
          if (typeof id !== 'string' || !slots.some(slot => slot.id === id) || seen.has(id)) throw new Error('webSearchOrderChanged');
          seen.add(id);
        }
        if (ids.every((id, index) => id === slots[index]?.id)) return catalog();
        const byId = new Map(slots.map(slot => [slot.id, slot]));
        await persistChain(kind, ids.map(id => byId.get(id)!));
        return catalog();
      },
      async saveKey(id: string, value: string) {
        const searchSlots = searchChain();
        const fetchSlots = fetchChain();
        const slot = [...searchSlots, ...fetchSlots].find(candidate => candidate.id === id);
        if (!slot) throw new Error('webSearchUnknownBackend');
        if (typeof value !== 'string' || value.length > 4096) throw new TypeError('invalid key');
        ensureActive();
        if (slot.legacyCredentialId !== undefined) {
          const kind = searchSlots.some(candidate => candidate.id === id) ? 'search' : 'fetch';
          await persistChain(kind, kind === 'search' ? searchSlots : fetchSlots);
        }
        await writeKey(credentials ?? undefined, id, value.trim());
        ensureActive();
        await reconcile();
        return catalog();
      },
      /** Run one real search against one instance so its key can be verified. */
      async probeSearch(id: string): Promise<WebSearchProbe> {
        const slot = [...searchChain(), ...fetchChain()].find(candidate => candidate.id === id);
        const backend = slot ? backendOf(slot.provider) : undefined;
        if (!slot || !backend) throw new Error('webSearchUnknownBackend');
        ensureActive();
        const apiKey = await resolveKey(credentials ?? undefined, slot.legacyCredentialId ?? slot.id);
        if (apiKey === '') {
          return { ok: false, resultCount: 0, durationMs: 0, message: 'webSearchKeyMissing', diagnostic: {
            ...probeDiagnostic(null, slot.provider, 'missing', 'credentials'), reason: 'key-missing',
          } };
        }
        const startedAt = Date.now();
        try {
          const result = await backend.search({ query: 'DeepSeek', maxResults: 5 }, apiKey, AbortSignal.timeout(30_000));
          return { ok: true, resultCount: result.sources.length, durationMs: Date.now() - startedAt, message: '' };
        } catch (error) {
          const diagnostic = probeDiagnostic(error, slot.provider, 'api-key');
          return {
            ok: false, resultCount: 0, durationMs: Date.now() - startedAt,
            message: `webSearchProbeReason_${diagnostic.reason}`, diagnostic,
          };
        }
      },
      /** Run one real fetch against one instance so its key can be verified. */
      async probeFetch(id: string): Promise<WebSearchProbe> {
        const slot = [...searchChain(), ...fetchChain()].find(candidate => candidate.id === id);
        const backend = slot ? backendOf(slot.provider) : undefined;
        if (!slot || !backend) throw new Error('webSearchUnknownBackend');
        ensureActive();
        const apiKey = await resolveKey(credentials ?? undefined, slot.legacyCredentialId ?? slot.id);
        if (apiKey === '') {
          return { ok: false, resultCount: 0, durationMs: 0, message: 'webSearchKeyMissing', diagnostic: {
            ...probeDiagnostic(null, slot.provider, 'missing', 'credentials'), reason: 'key-missing',
          } };
        }
        const startedAt = Date.now();
        try {
          const result = await backend.fetch('https://example.com', apiKey, AbortSignal.timeout(30_000));
          return { ok: true, resultCount: result.content.length, durationMs: Date.now() - startedAt, message: '' };
        } catch (error) {
          const diagnostic = probeDiagnostic(error, slot.provider, 'api-key');
          return {
            ok: false, resultCount: 0, durationMs: Date.now() - startedAt,
            message: `webSearchProbeReason_${diagnostic.reason}`, diagnostic,
          };
        }
      },
    },
  };
}

export const methods = {
  readWebSearch(): Promise<WebSearchCatalog> {
    return this.run(() => this.webSearch.catalog());
  },
  addWebSearchSlot(capability: string, provider: string): Promise<WebSearchCatalog> {
    return this.run(() => this.webSearch.addSlot(capability, provider));
  },
  removeWebSearchSlot(capability: string, id: string): Promise<WebSearchCatalog> {
    return this.run(() => this.webSearch.removeSlot(capability, id));
  },
  reorderWebSearchChain(capability: string, ids: readonly string[]): Promise<WebSearchCatalog> {
    return this.run(() => this.webSearch.reorder(capability, ids));
  },
  saveWebSearchKey(id: string, value: string): Promise<WebSearchCatalog> {
    return this.run(() => this.webSearch.saveKey(id, value));
  },
  probeWebSearchSearch(id: string): Promise<WebSearchProbe> {
    return this.run(() => this.webSearch.probeSearch(id));
  },
  probeWebSearchFetch(id: string): Promise<WebSearchProbe> {
    return this.run(() => this.webSearch.probeFetch(id));
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
