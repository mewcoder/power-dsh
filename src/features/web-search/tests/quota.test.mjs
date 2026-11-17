import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QuotaReader, parseTavilyUsage, parseFirecrawlUsage, parseTinyfishBalance } from '../quota.ts';
import { webSearchQuotaCodec } from '../rpc.ts';

const tavily = (key = {}, account = {}) => ({ key: { usage: 7, limit: null, ...key },
  account: { plan_usage: 80, plan_limit: 1000, paygo_limit: 30, paygo_usage: 4, ...account } });
const response = data => new Response(JSON.stringify(data), { status: 200 });

test('Tavily distinguishes key limits, shared account usage, unlimited plans and pay-as-you-go credits', () => {
  assert.deepEqual(parseTavilyUsage(tavily()), { kind: 'credits', scope: 'account', used: 80,
    limit: 1000, remaining: 920, paygoRemaining: 26 });
  assert.deepEqual(parseTavilyUsage(tavily({ limit: 10 })), { kind: 'credits', scope: 'key', used: 7,
    limit: 10, remaining: 3, paygoRemaining: 26 });
  assert.equal(parseTavilyUsage(tavily({ limit: 0 })).remaining, 0);
  assert.deepEqual(parseTavilyUsage(tavily({}, { plan_limit: null })), { kind: 'credits', scope: 'key', used: 7,
    limit: null, remaining: null, paygoRemaining: 26 });
  assert.equal(parseTavilyUsage(tavily({}, { plan_usage: 1200 })).used, 1200);
  for (const invalid of [null, {}, { key: { usage: 0 } }, tavily({}, { plan_usage: undefined }),
    tavily({ limit: '100' }), tavily({}, { plan_limit: -1 }), tavily({ usage: null, limit: null }, { plan_limit: null }),
    tavily({}, { plan_limit: Infinity }), tavily({}, { paygo_usage: 'zero' })]) {
    assert.throws(() => parseTavilyUsage(invalid), /Invalid/);
  }
});

test('Firecrawl keeps remaining credits separate from the plan while TinyFish preserves exact negative wallet amounts', () => {
  assert.deepEqual(parseFirecrawlUsage({ success: true, data: { remainingCredits: 1200, planCredits: 1000,
    billingPeriodEnd: 'private-extra' } }), { kind: 'credits', scope: 'account', remaining: 1200, limit: 1000 });
  assert.deepEqual(parseTinyfishBalance({ available_balance: '-0.012345', currency: 'USD', auto_reload: { state: 'on' } }),
    { kind: 'balance', currency: 'USD', balance: '-0.012345' });
  for (const invalid of [{ success: false }, { success: true, data: { planCredits: 1000 } },
    { success: true, data: { remainingCredits: null, planCredits: 0 } }]) assert.throws(() => parseFirecrawlUsage(invalid));
  for (const invalid of ['NaN', '1e3', '001', '1.1234567', 'secret']) {
    assert.throws(() => parseTinyfishBalance({ available_balance: invalid, currency: 'USD' }));
  }
});

test('quota reads authenticate only to fixed official endpoints and project safe RPC fields', async t => {
  const calls = [];
  const reader = new QuotaReader({ fetcher: async (url, options) => {
    calls.push({ url, options });
    return response(url.includes('tavily') ? tavily()
      : url.includes('firecrawl') ? { success: true, data: { remainingCredits: 50, planCredits: 1000 } }
        : { available_balance: '21.44', currency: 'USD', auto_reload: { secret: 'not-for-rpc' } });
  } });
  t.after(() => reader.dispose());
  for (const provider of ['tavily', 'firecrawl', 'tinyfish']) {
    const result = await reader.read(provider, 'test-key');
    assert.equal(result.status, 'ready');
    assert.deepEqual(webSearchQuotaCodec.create().parse(result), result);
    assert.doesNotMatch(JSON.stringify(result), /test-key|not-for-rpc|auto_reload/);
  }
  assert.deepEqual(calls.map(call => call.url), ['https://api.tavily.com/usage',
    'https://api.firecrawl.dev/v2/team/credit-usage', 'https://agent.tinyfish.ai/v1/wallet']);
  for (const { url, options } of calls) {
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers[url.includes('tinyfish') ? 'X-API-Key' : 'Authorization'],
      url.includes('tinyfish') ? 'test-key' : 'Bearer test-key');
  }
  assert.deepEqual(await reader.read('tavily', ' '), { status: 'missing' });
  assert.deepEqual(await reader.read('not-a-provider', 'test-key'), { status: 'unsupported' });
  assert.deepEqual(await reader.read('exa', 'ordinary-search-key'), { status: 'unsupported' });
  assert.equal(calls.length, 3);
});

test('identical keys share concurrent reads and two-minute caches, including failures', async t => {
  let now = 1000;
  let requests = 0;
  let release;
  let failing = false;
  const reader = new QuotaReader({ now: () => now, fetcher: async () => {
    requests++;
    if (requests === 1) await new Promise(resolve => { release = resolve; });
    return failing ? new Response('private error', { status: 429 }) : response(tavily());
  } });
  t.after(() => reader.dispose());
  const first = reader.read('tavily', 'same-key');
  const second = reader.read('tavily', 'same-key');
  release();
  assert.deepEqual(await first, await second);
  assert.equal(requests, 1);
  now += 119_999;
  await reader.read('tavily', 'same-key');
  assert.equal(requests, 1);
  now++;
  failing = true;
  const failed = await reader.read('tavily', 'same-key');
  assert.equal(failed.status, 'error');
  assert.equal(failed.diagnostic.reason, 'rate-limit');
  assert.deepEqual(await reader.read('tavily', 'same-key'), failed);
  assert.equal(requests, 2);
  await reader.read('tavily', 'another-key');
  assert.equal(requests, 3);
});

test('credential invalidation cancels pending requests and prevents late results from restoring an old cache', async t => {
  let requests = 0;
  let finish;
  let signal;
  const reader = new QuotaReader({ fetcher: async (_url, options) => {
    requests++;
    if (requests === 1) {
      signal = options.signal;
      await new Promise(resolve => { finish = resolve; });
    }
    return response(tavily());
  } });
  t.after(() => reader.dispose());
  const pending = reader.read('tavily', 'old-key');
  reader.clear();
  assert.equal(signal.aborted, true);
  finish();
  await pending;
  assert.equal(reader.cache.size, 0);
  await reader.read('tavily', 'old-key');
  assert.equal(requests, 2);
  reader.dispose();
  await assert.rejects(reader.read('tavily', 'old-key'), /Unavailable/);
});

test('failed and oversized responses remain unknown and never expose raw errors or a zero quota', async t => {
  for (const fetcher of [async () => new Response('secret-response', { status: 401 }),
    async () => response({}), async () => new Response('x'.repeat(65_537)),
    async () => { throw new TypeError('secret-key https://private.example', {
      cause: Object.assign(new Error('private'), { code: 'ECONNRESET' }),
    }); }]) {
    const reader = new QuotaReader({ fetcher });
    t.after(() => reader.dispose());
    const result = webSearchQuotaCodec.create().parse(await reader.read('tavily', 'secret-key'));
    assert.equal(result.status, 'error');
    assert.equal(result.data, undefined);
    assert.doesNotMatch(JSON.stringify(result), /secret|private|https:/);
  }
  for (const data of [{ kind: 'balance', currency: 'CNY', balance: '10' },
    { kind: 'credits', scope: 'key', used: 0, limit: 10, remaining: null },
    { kind: 'credits', scope: 'account', used: NaN, limit: null, remaining: null }]) {
    assert.throws(() => webSearchQuotaCodec.create().parse({ status: 'ready', observedAt: new Date().toISOString(), data }));
  }
});
