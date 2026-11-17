import { createHash } from 'node:crypto';
import { isRecord } from '../../shared/types/protocol.ts';
import type { WebSearchQuota, WebSearchQuotaData } from './types.ts';
import { BackendError } from './backends.ts';
import { probeDiagnostic } from './probe-diagnostics.ts';

const KEEP_MS = 120_000;
const MAX_BYTES = 65_536;
const endpoints: Record<string, string> = {
  tavily: 'https://api.tavily.com/usage',
  firecrawl: 'https://api.firecrawl.dev/v2/team/credit-usage',
  tinyfish: 'https://agent.tinyfish.ai/v1/wallet',
};

function credits(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
    throw new SyntaxError('Invalid credit amount');
  }
  return value;
}

function nullableCredits(value: unknown): number | null {
  return value === null ? null : credits(value);
}

export function parseTavilyUsage(value: unknown): WebSearchQuotaData {
  if (!isRecord(value) || !isRecord(value.key) || !isRecord(value.account)) throw new SyntaxError('Invalid usage response');
  const keyLimit = nullableCredits(value.key.limit);
  const limit = keyLimit ?? nullableCredits(value.account.plan_limit);
  const scope = keyLimit === null && limit !== null ? 'account' : 'key';
  const used = credits(keyLimit !== null || limit === null ? value.key.usage : value.account.plan_usage);
  const paygoRemaining = value.account.paygo_limit === undefined || value.account.paygo_usage === undefined
    || value.account.paygo_limit === null || value.account.paygo_usage === null
    ? undefined : Math.max(0, credits(value.account.paygo_limit) - credits(value.account.paygo_usage));
  return { kind: 'credits', scope, used, limit, remaining: limit === null ? null : Math.max(0, limit - used),
    ...(paygoRemaining === undefined ? {} : { paygoRemaining }) };
}

export function parseFirecrawlUsage(value: unknown): WebSearchQuotaData {
  if (!isRecord(value) || value.success !== true || !isRecord(value.data)) throw new SyntaxError('Invalid usage response');
  return { kind: 'credits', scope: 'account', remaining: credits(value.data.remainingCredits),
    limit: credits(value.data.planCredits) };
}

export function parseTinyfishBalance(value: unknown): WebSearchQuotaData {
  if (!isRecord(value) || value.currency !== 'USD' || typeof value.available_balance !== 'string'
    || !/^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(value.available_balance)) throw new SyntaxError('Invalid wallet response');
  return { kind: 'balance', currency: 'USD', balance: value.available_balance };
}

async function readJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new SyntaxError('Empty quota response');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > MAX_BYTES) throw new SyntaxError('Quota response is too large');
      chunks.push(chunk.value);
    }
    const buffer = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(buffer)) as unknown;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export class QuotaReader {
  cache = new Map<string, { expiresAt: number; value: WebSearchQuota }>();
  pending = new Map<string, Promise<WebSearchQuota>>();
  controller = new AbortController();
  revision = 0;
  closed = false;
  now: () => number;
  fetcher: typeof fetch;

  constructor({ now = Date.now, fetcher = fetch }: { now?: () => number; fetcher?: typeof fetch } = {}) {
    this.now = now;
    this.fetcher = fetcher;
  }

  clear() {
    this.revision++;
    this.controller.abort();
    this.controller = new AbortController();
    this.cache.clear();
    this.pending.clear();
  }

  dispose() { this.closed = true; this.clear(); }

  async read(provider: string, key: string): Promise<WebSearchQuota> {
    if (this.closed) throw new Error('webSearchUnavailable');
    if (!endpoints[provider]) return { status: 'unsupported' };
    if (key.trim() === '') return { status: 'missing' };
    const cacheKey = `${provider}:${createHash('sha256').update(key).digest('hex')}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > this.now()) return cached.value;
    const pending = this.pending.get(cacheKey);
    if (pending) return pending;
    const revision = this.revision;
    const startedAt = this.now();
    const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(15_000)]);
    const task = (async (): Promise<WebSearchQuota> => {
      let result: WebSearchQuota;
      try {
        const response = await this.fetcher(endpoints[provider]!, {
          method: 'GET', redirect: 'error', cache: 'no-store', signal,
          headers: { Accept: 'application/json', ...(provider === 'tinyfish'
            ? { 'X-API-Key': key } : { Authorization: `Bearer ${key}` }) },
        });
        if (!response.ok) {
          await response.body?.cancel().catch(() => {});
          throw new BackendError('Quota request failed', response.status);
        }
        const raw = await readJson(response);
        const data = provider === 'tavily' ? parseTavilyUsage(raw)
          : provider === 'firecrawl' ? parseFirecrawlUsage(raw) : parseTinyfishBalance(raw);
        result = { status: 'ready', observedAt: new Date(this.now()).toISOString(), data };
      } catch (error) {
        result = { status: 'error', durationMs: Math.max(0, this.now() - startedAt),
          diagnostic: probeDiagnostic(error, provider, 'api-key') };
      }
      if (revision === this.revision && !this.closed) {
        if (this.cache.size >= 64) this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(cacheKey, { expiresAt: this.now() + KEEP_MS, value: result });
      }
      return result;
    })();
    this.pending.set(cacheKey, task);
    try { return await task; }
    finally { if (this.pending.get(cacheKey) === task) this.pending.delete(cacheKey); }
  }
}
