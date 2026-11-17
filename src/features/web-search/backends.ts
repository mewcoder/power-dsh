/**
 * One third-party web backend: what the picker shows, which capabilities it
 * serves, and how one search or fetch reaches it. Everything that differs per
 * vendor lives here; the fallback chain in `provider.ts` only sequences them.
 *
 * Every backend listed here has a documented free tier. A vendor without one
 * does not belong in this file: the feature exists so a user can search without
 * paying, not so the plugin can broker paid APIs.
 *
 * @module power-dsh/web-search/backends
 */

import { isRecord } from '../../shared/types/protocol.ts';

/** A source shape mirroring the host seam's `WebSearchSource`, without importing it. */
export interface BackendSource {
  url: string;
  title?: string;
  snippet?: string;
  publishedAt?: string;
}

export interface BackendSearchResult {
  /** Provider-generated answer text, when the API returns one. */
  content?: string;
  sources: BackendSource[];
}

export interface BackendFetchResult {
  content: string;
  truncated: boolean;
}

/** One search request, already bounded by the host seam. */
export interface BackendSearchRequest {
  query: string;
  maxResults?: number;
}

/**
 * A backend failure carrying the HTTP status when there was one. The chain
 * benches a key on 401/403/429 and retries the next backend on anything else.
 */
export class BackendError extends Error {
  readonly status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'BackendError';
    this.status = status;
  }
}

/** Throw for a non-2xx response, labelled with the operation and vendor. */
function assertOk(response: Response, label: string): void {
  if (response.ok) return;
  throw new BackendError(`${label} failed: HTTP ${String(response.status)}`, response.status);
}

function requireKey(apiKey: string): void {
  if (apiKey.trim() === '') throw new BackendError('webSearchKeyMissing');
}

/** Clamp the seam's bound to what a vendor's count parameter accepts. */
function clampCount(maxResults: number | undefined, max: number): number | undefined {
  if (typeof maxResults !== 'number' || !Number.isFinite(maxResults) || maxResults <= 0) return undefined;
  return Math.min(Math.floor(maxResults), max);
}

/** Upper bound for a snippet: the top of what a source renderer shows. */
const SNIPPET_MAX = 800;

/**
 * Trim a vendor's content blob to a snippet. Several APIs return whole page
 * text per result; passing that through would put a page into the model's
 * context for one search.
 */
function toSnippet(value: unknown, max = SNIPPET_MAX): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.replace(/\s+/g, ' ').trim();
  if (text === '') return undefined;
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** First non-empty string among candidate date fields; vendors name it differently. */
function toPublishedAt(...values: unknown[]): string | undefined {
  for (const value of values) if (typeof value === 'string' && value !== '') return value;
  return undefined;
}

/** A backend as the settings page and the fallback chain both see it. */
export interface WebBackend {
  /** Stable id written into the preference list and used as the credential id. */
  readonly id: string;
  /** Credential record id inside the `power-dsh` scope. */
  readonly credentialId: string;
  /**
   * Where the user creates this vendor's API key. The page links to it beside the
   * key field, so obtaining a key never requires leaving the product to search.
   */
  readonly keyUrl: string;
  /** Whether the vendor serves the search capability at all. */
  search(request: BackendSearchRequest, apiKey: string, signal: AbortSignal): Promise<BackendSearchResult>;
  /** Whether the vendor serves the fetch capability at all. */
  fetch(url: string, apiKey: string, signal: AbortSignal): Promise<BackendFetchResult>;
}

/** Tavily: 1,000 credits/month free with an API key. */
const tavily: WebBackend = {
  id: 'tavily',
  credentialId: 'tavily',
  keyUrl: "https://app.tavily.com/home",
  async search({ query, maxResults }, apiKey, signal) {
    requireKey(apiKey);
    const max = clampCount(maxResults, 20);
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: 'basic',
        include_answer: true,
        ...(max === undefined ? {} : { max_results: max }),
      }),
      signal,
    });
    assertOk(response, 'Tavily search');
    const data = await response.json() as {
      answer?: unknown;
      results?: { url?: unknown; title?: unknown; content?: unknown; published_date?: unknown }[];
    };
    const sources = (Array.isArray(data.results) ? data.results : []).flatMap(row => {
      if (typeof row?.url !== 'string' || row.url === '') return [];
      const source: BackendSource = { url: row.url };
      if (typeof row.title === 'string' && row.title !== '') source.title = row.title;
      const snippet = toSnippet(row.content);
      if (snippet !== undefined) source.snippet = snippet;
      const publishedAt = toPublishedAt(row.published_date);
      if (publishedAt !== undefined) source.publishedAt = publishedAt;
      return [source];
    });
    if (sources.length === 0) throw new BackendError('Tavily search returned no results');
    const answer = typeof data.answer === 'string' ? data.answer.trim() : '';
    return { ...(answer === '' ? {} : { content: answer }), sources };
  },
  async fetch(url, apiKey, signal) {
    requireKey(apiKey);
    const response = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ urls: [url] }),
      signal,
    });
    assertOk(response, 'Tavily extract');
    const data = await response.json() as {
      results?: { raw_content?: unknown }[];
      failed_results?: { error?: unknown }[];
    };
    const content = data.results?.[0]?.raw_content;
    if (typeof content === 'string' && content.trim() !== '') return { content, truncated: false };
    // A URL Tavily could not extract lands in `failed_results`, not as an HTTP error.
    const reason = data.failed_results?.[0]?.error;
    throw new BackendError(`Tavily extract returned no content${typeof reason === 'string' ? `: ${reason}` : ''}`);
  },
};

/** Firecrawl: 1,000 credits/month free with an API key. */
const firecrawl: WebBackend = {
  id: 'firecrawl',
  credentialId: 'firecrawl',
  keyUrl: "https://www.firecrawl.dev/app/api-keys",
  async search({ query, maxResults }, apiKey, signal) {
    requireKey(apiKey);
    const limit = clampCount(maxResults, 100);
    const response = await fetch('https://api.firecrawl.dev/v2/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        // Web results only: without scrape options each hit stays a cheap
        // url/title/description triple instead of a full-page scrape.
        sources: [{ type: 'web' }],
        ...(limit === undefined ? {} : { limit }),
      }),
      signal,
    });
    assertOk(response, 'Firecrawl search');
    const data = await response.json() as {
      success?: unknown;
      data?: { web?: { url?: unknown; title?: unknown; description?: unknown; markdown?: unknown }[] };
    };
    const rows = Array.isArray(data.data?.web) ? data.data.web : [];
    const sources = rows.flatMap(row => {
      if (typeof row?.url !== 'string' || row.url === '') return [];
      const source: BackendSource = { url: row.url };
      if (typeof row.title === 'string' && row.title !== '') source.title = row.title;
      const snippet = toSnippet(row.description) ?? toSnippet(row.markdown);
      if (snippet !== undefined) source.snippet = snippet;
      return [source];
    });
    if (sources.length === 0) throw new BackendError('Firecrawl search returned no results');
    return { sources };
  },
  async fetch(url, apiKey, signal) {
    requireKey(apiKey);
    const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ url, formats: ['markdown'] }),
      signal,
    });
    assertOk(response, 'Firecrawl scrape');
    const data = await response.json() as {
      success?: unknown;
      data?: { markdown?: unknown; warning?: unknown };
      warning?: unknown;
      error?: unknown;
    };
    const markdown = data.data?.markdown;
    if (typeof markdown === 'string' && markdown.trim() !== '') {
      // Firecrawl reports a truncated body through `warning`, whose position
      // has moved between API revisions, so both are read.
      const warning = data.warning ?? data.data?.warning;
      return { content: markdown, truncated: typeof warning === 'string' && warning.trim() !== '' };
    }
    const detail = typeof data.error === 'string' ? `: ${data.error}` : '';
    throw new BackendError(`Firecrawl scrape returned no content${detail}`);
  },
};

/**
 * TinyFish: Search and Fetch are free (rate-limited) with a key. Search and
 * Fetch live on different subdomains and disagree on field names, so each maps
 * its own shape. The published limits are 30 req/min and 500 req/hour for
 * search, 150 urls/min and 1,000 urls/day for fetch; the chain throttles rather
 * than discovering the ceiling through 429s.
 */
const tinyfish: WebBackend = {
  id: 'tinyfish',
  credentialId: 'tinyfish',
  keyUrl: "https://agent.tinyfish.ai/api-keys",
  async search({ query, maxResults }, apiKey, signal) {
    requireKey(apiKey);
    const url = new URL('https://api.search.tinyfish.ai');
    url.searchParams.set('query', query);
    // No count parameter: the API returns a fixed page, so the seam's bound is
    // applied by the caller after the fact.
    void maxResults;
    const response = await fetch(url, { method: 'GET', headers: { 'X-API-Key': apiKey }, signal });
    assertOk(response, 'TinyFish search');
    const data = await response.json() as {
      results?: { url?: unknown; title?: unknown; snippet?: unknown; published_at?: unknown; date?: unknown }[];
    };
    const sources = (Array.isArray(data.results) ? data.results : []).flatMap(row => {
      if (typeof row?.url !== 'string' || row.url === '') return [];
      const source: BackendSource = { url: row.url };
      if (typeof row.title === 'string' && row.title !== '') source.title = row.title;
      const snippet = toSnippet(row.snippet);
      if (snippet !== undefined) source.snippet = snippet;
      const publishedAt = toPublishedAt(row.published_at, row.date);
      if (publishedAt !== undefined) source.publishedAt = publishedAt;
      return [source];
    });
    if (sources.length === 0) throw new BackendError('TinyFish search returned no results');
    return { sources };
  },
  async fetch(url, apiKey, signal) {
    requireKey(apiKey);
    const response = await fetch('https://api.fetch.tinyfish.ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({ urls: [url], format: 'markdown' }),
      signal,
    });
    assertOk(response, 'TinyFish fetch');
    const data = await response.json() as {
      results?: { text?: unknown }[];
      errors?: { url?: unknown; error?: unknown }[];
    };
    const text = data.results?.[0]?.text;
    if (typeof text === 'string' && text !== '') return { content: text, truncated: false };
    // A per-URL failure lands in `errors[]` beside an empty `results[]`.
    const reason = data.errors?.find(entry => entry?.url === url)?.error;
    throw new BackendError(`TinyFish fetch returned no content${typeof reason === 'string' ? `: ${reason}` : ''}`);
  },
};

const exa: WebBackend = {
  id: 'exa',
  credentialId: 'exa',
  keyUrl: 'https://dashboard.exa.ai/api-keys',
  async search({ query, maxResults }, apiKey, signal) {
    requireKey(apiKey);
    const numResults = clampCount(maxResults, 100);
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST', redirect: 'error', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        query, type: 'auto', contents: { highlights: { maxCharacters: SNIPPET_MAX } },
        ...(numResults === undefined ? {} : { numResults }),
      }),
      signal,
    });
    assertOk(response, 'Exa search');
    const data: unknown = await response.json();
    if (!isRecord(data)) throw new SyntaxError('Invalid Exa search response');
    const sources = (Array.isArray(data.results) ? data.results : []).flatMap(row => {
      if (!isRecord(row) || typeof row.url !== 'string' || row.url === '') return [];
      const source: BackendSource = { url: row.url };
      if (typeof row.title === 'string' && row.title !== '') source.title = row.title;
      const highlights = Array.isArray(row.highlights) ? row.highlights.filter(value => typeof value === 'string').join('\n') : '';
      const snippet = toSnippet(highlights) ?? toSnippet(row.text);
      if (snippet !== undefined) source.snippet = snippet;
      const publishedAt = toPublishedAt(row.publishedDate);
      if (publishedAt !== undefined) source.publishedAt = publishedAt;
      return [source];
    });
    if (sources.length === 0) throw new BackendError('Exa search returned no results');
    return { sources };
  },
  async fetch(url, apiKey, signal) {
    requireKey(apiKey);
    const maxCharacters = 100_000;
    const response = await fetch('https://api.exa.ai/contents', {
      method: 'POST', redirect: 'error', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ urls: [url], text: { maxCharacters: maxCharacters + 1 } }),
      signal,
    });
    assertOk(response, 'Exa contents');
    const data: unknown = await response.json();
    if (!isRecord(data)) throw new SyntaxError('Invalid Exa contents response');
    const failed = Array.isArray(data.statuses) && data.statuses.some(status => isRecord(status) && status.status === 'error');
    const row: unknown = Array.isArray(data.results) ? data.results[0] : undefined;
    if (failed || !isRecord(row) || typeof row.text !== 'string' || row.text.trim() === '') {
      throw new BackendError('Exa contents returned no content');
    }
    return { content: row.text.slice(0, maxCharacters), truncated: row.text.length > maxCharacters };
  },
};

/** Every backend this feature serves, in the order the picker lists them. */
export const BACKENDS: readonly WebBackend[] = Object.freeze([tavily, firecrawl, tinyfish, exa]);

/** Look up one backend by its stable id. */
export function backendOf(id: string): WebBackend | undefined {
  return BACKENDS.find(backend => backend.id === id);
}
