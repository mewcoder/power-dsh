import { isRecord, isArray, hasStrings, hasBooleans, type Codec, type RpcDescriptor } from '../../shared/types/protocol.ts';
import type { WebSearchCatalog, WebSearchProbe, WebSearchQuota, WebSearchQuotaData } from './types.ts';
export type { WebSearchSlotRow, WebSearchCatalog, WebSearchProbe, WebSearchQuota } from './types.ts';
import { booleanCodec, stringArrayCodec, stringCodec } from '../../shared/rpc/codecs.ts';
import { parseProbeDiagnostic } from './probe-diagnostics.ts';
import { LOCAL_FETCH } from './chain.ts';

const slotCodec: Codec<WebSearchCatalog['slots'][number]> = {
  mode: 'strict', typeSymbol: 'power-dsh#WebSearchSlot',
  create: () => ({ parse(value) {
    if (!isRecord(value) || !hasStrings(value, ['id', 'provider', 'keyUrl'])
      || !hasBooleans(value, ['configured', 'hasKey', 'writable'])) {
      throw new TypeError('Invalid web search instance');
    }
    return {
      id: value.id, provider: value.provider, keyUrl: value.keyUrl,
      configured: value.configured, hasKey: value.hasKey, writable: value.writable,
    };
  } }),
};

const chainCodec = (value: unknown, known: ReadonlySet<string>): string[] => {
  if (!isRecord(value) || !isArray(value.ids) || value.ids.length > known.size) throw new TypeError('Invalid web search chain');
  const ids = value.ids.map(id => {
    if (typeof id !== 'string' || !known.has(id)) throw new TypeError('Invalid web search chain');
    return id;
  });
  if (new Set(ids).size !== ids.length) throw new TypeError('Invalid web search chain');
  return ids;
};

export const webSearchCatalogCodec: Codec<WebSearchCatalog> = {
  mode: 'strict', typeSymbol: 'power-dsh#WebSearchCatalog',
  create: () => ({ parse(value) {
    if (!isRecord(value) || typeof value.enabled !== 'boolean' || typeof value.available !== 'boolean'
      || !isArray(value.slots) || value.slots.length > 32) throw new TypeError('Invalid web search catalog');
    const slots = value.slots.map(row => slotCodec.create().parse(row));
    const known = new Set(slots.map(row => row.id));
    if (known.size !== slots.length || known.has(LOCAL_FETCH.id)) throw new TypeError('Invalid web search catalog');
    return {
      enabled: value.enabled, available: value.available, slots,
      search: { ids: chainCodec(value.search, known) },
      fetch: { ids: chainCodec(value.fetch, new Set([...known, LOCAL_FETCH.id])) },
    };
  } }),
};

const probeCodec: Codec<WebSearchProbe> = {
  mode: 'strict', typeSymbol: 'power-dsh#WebSearchProbe',
  create: () => ({ parse(value) {
    if (!isRecord(value) || typeof value.ok !== 'boolean' || typeof value.message !== 'string'
      || value.message.length > 400
      || typeof value.resultCount !== 'number' || !Number.isFinite(value.resultCount)
      || typeof value.durationMs !== 'number' || !Number.isFinite(value.durationMs)) {
      throw new TypeError('Invalid web search probe');
    }
    return { ok: value.ok, resultCount: value.resultCount, durationMs: value.durationMs, message: value.message,
      ...(value.diagnostic === undefined ? {} : { diagnostic: parseProbeDiagnostic(value.diagnostic) }) };
  } }),
};

function parseCredit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
    throw new TypeError('Invalid web search quota');
  }
  return value;
}

export const webSearchQuotaCodec: Codec<WebSearchQuota> = {
  mode: 'strict', typeSymbol: 'power-dsh#WebSearchQuota',
  create: () => ({ parse(value) {
    if (!isRecord(value)) throw new TypeError('Invalid web search quota');
    if (value.status === 'missing' || value.status === 'unsupported') return { status: value.status };
    if (value.status === 'error') return { status: 'error', durationMs: parseCredit(value.durationMs),
      diagnostic: parseProbeDiagnostic(value.diagnostic) };
    if (value.status !== 'ready' || typeof value.observedAt !== 'string' || value.observedAt.length > 40
      || !Number.isFinite(Date.parse(value.observedAt)) || !isRecord(value.data)) throw new TypeError('Invalid web search quota');
    const raw = value.data;
    let data: WebSearchQuotaData;
    if (raw.kind === 'balance' && raw.currency === 'USD' && typeof raw.balance === 'string'
      && /^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(raw.balance)) {
      data = { kind: 'balance', currency: 'USD', balance: raw.balance };
    } else if (raw.kind === 'credits' && (raw.scope === 'key' || raw.scope === 'account')) {
      data = { kind: 'credits', scope: raw.scope,
        limit: raw.limit === null ? null : parseCredit(raw.limit),
        remaining: raw.remaining === null ? null : parseCredit(raw.remaining),
        ...(raw.used === undefined ? {} : { used: parseCredit(raw.used) }),
        ...(raw.paygoRemaining === undefined ? {} : { paygoRemaining: parseCredit(raw.paygoRemaining) }) };
      if (data.remaining === null && (data.limit !== null || data.used === undefined)) throw new TypeError('Invalid web search quota');
    } else throw new TypeError('Invalid web search quota');
    return { status: 'ready', observedAt: value.observedAt, data };
  } }),
};

function descriptor<M extends string, Result>(method: M, parameters: { name: string; codec: Codec<unknown> }[], result: Codec<Result>): RpcDescriptor<M, Result> {
  return {
    id: `power-dsh#powerDsh/${method}`, service: 'powerDsh', namespace: 'powerDsh', method,
    invocation: { kind: 'direct' },
    parameters: parameters.map(({ name, codec }) => ({ name, wire: name, source: 'json', codec })),
    result,
  };
}

export const READ_WEB_SEARCH_RPC = descriptor('readWebSearch', [], webSearchCatalogCodec);
export const READ_WEB_SEARCH_QUOTA_RPC = descriptor('readWebSearchQuota',
  [{ name: 'id', codec: stringCodec }], webSearchQuotaCodec);
export const ADD_WEB_SEARCH_SLOT_RPC = descriptor('addWebSearchSlot',
  [{ name: 'capability', codec: stringCodec }, { name: 'provider', codec: stringCodec }], webSearchCatalogCodec);
export const REMOVE_WEB_SEARCH_SLOT_RPC = descriptor('removeWebSearchSlot',
  [{ name: 'capability', codec: stringCodec }, { name: 'id', codec: stringCodec }], webSearchCatalogCodec);
export const REORDER_WEB_SEARCH_CHAIN_RPC = descriptor('reorderWebSearchChain',
  [{ name: 'capability', codec: stringCodec }, { name: 'ids', codec: stringArrayCodec }], webSearchCatalogCodec);
export const SAVE_WEB_SEARCH_KEY_RPC = descriptor('saveWebSearchKey',
  [{ name: 'id', codec: stringCodec }, { name: 'value', codec: stringCodec }], webSearchCatalogCodec);
export const PROBE_WEB_SEARCH_SEARCH_RPC = descriptor('probeWebSearchSearch',
  [{ name: 'id', codec: stringCodec }], probeCodec);
export const PROBE_WEB_SEARCH_FETCH_RPC = descriptor('probeWebSearchFetch',
  [{ name: 'id', codec: stringCodec }], probeCodec);

export const rpc = [READ_WEB_SEARCH_RPC, ADD_WEB_SEARCH_SLOT_RPC, REMOVE_WEB_SEARCH_SLOT_RPC, REORDER_WEB_SEARCH_CHAIN_RPC,
  SAVE_WEB_SEARCH_KEY_RPC, PROBE_WEB_SEARCH_SEARCH_RPC, PROBE_WEB_SEARCH_FETCH_RPC, READ_WEB_SEARCH_QUOTA_RPC];
