import { isArray, isRecord, hasStrings, type Codec, type RpcDescriptor } from '../../shared/types/protocol.ts';
import type { SearchContentHit, SearchContentResult } from '../../shared/types/wire.ts';
import { numberCodec, policyRpc, stringArrayCodec, stringCodec } from '../../shared/rpc/codecs.ts';

export const SEARCH_POPUP_RPC = policyRpc('setSearchPopupEnabled', 'SearchPopupResult');

function parseHits(value: unknown, label: string): SearchContentHit[] {
  if (!isArray(value) || value.length > 200) throw new TypeError(`Invalid search content ${label}`);
  return value.map(item => {
    if (!isRecord(item) || !hasStrings(item, ['sessionId', 'snippet'])
      || item.sessionId.length > 128 || item.snippet.length > 1024) throw new TypeError(`Invalid search content ${label} row`);
    return { sessionId: item.sessionId, snippet: item.snippet };
  });
}

export const searchContentCodec: Codec<SearchContentResult> = {
  mode: 'strict', typeSymbol: 'power-dsh#SearchContentResult',
  create: () => ({ parse(value) {
    if (!isRecord(value) || typeof value.available !== 'boolean') throw new TypeError('Invalid search content result');
    return {
      available: value.available,
      items: parseHits(value.items, 'hit'),
      // Previews are additive: a Host that predates them still yields usable hits.
      previews: value.previews === undefined ? [] : parseHits(value.previews, 'preview'),
    };
  } }),
};

/** Owner-only content search served by the Host's in-memory index. */
export const SEARCH_CONTENT_RPC: RpcDescriptor<'searchSessionContent', SearchContentResult> = {
  id: 'power-dsh#powerDsh/searchSessionContent',
  service: 'powerDsh', namespace: 'powerDsh', method: 'searchSessionContent',
  invocation: { kind: 'direct' },
  parameters: [
    { name: 'query', wire: 'query', source: 'json', codec: stringCodec },
    { name: 'limit', wire: 'limit', source: 'json', codec: numberCodec },
    { name: 'previewIds', wire: 'previewIds', source: 'json', codec: stringArrayCodec },
    { name: 'sessionIds', wire: 'sessionIds', source: 'json', codec: stringArrayCodec },
  ],
  result: searchContentCodec,
};

export const RECENT_PREVIEWS_RPC: RpcDescriptor<'readRecentSessionPreviews', SearchContentResult> = {
  id: 'power-dsh#powerDsh/readRecentSessionPreviews',
  service: 'powerDsh', namespace: 'powerDsh', method: 'readRecentSessionPreviews',
  invocation: { kind: 'direct' },
  parameters: [
    { name: 'sessionIds', wire: 'sessionIds', source: 'json', codec: stringArrayCodec },
    { name: 'versions', wire: 'versions', source: 'json', codec: stringArrayCodec },
  ],
  result: searchContentCodec,
};

export const rpc = [SEARCH_POPUP_RPC, SEARCH_CONTENT_RPC, RECENT_PREVIEWS_RPC];
