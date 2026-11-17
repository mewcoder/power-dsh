import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BACKENDS, backendOf } from '../backends.ts';
import { AggregateSearchProvider } from '../provider.ts';
import { parseProbeDiagnostic, probeDiagnostic } from '../probe-diagnostics.ts';

const recorded = [];
const realFetch = globalThis.fetch;

/** Replace global fetch for one test and capture the request it received. */
function capture(reply) {
  recorded.length = 0;
  globalThis.fetch = async (url, init) => {
    recorded.push({ url: String(url), init });
    return {
      ok: reply.ok ?? true,
      status: reply.status ?? 200,
      statusText: '',
      json: async () => reply.body,
      text: async () => JSON.stringify(reply.body ?? ''),
    };
  };
}

function restore() { globalThis.fetch = realFetch; }

test('every listed backend is one of the free-tier vendors and carries an id', () => {
  assert.deepEqual(BACKENDS.map(backend => backend.id), ['tavily', 'firecrawl', 'tinyfish', 'exa']);
  for (const backend of BACKENDS) {
    assert.ok(backend.credentialId.length > 0);
    assert.equal(typeof backend.search, 'function');
    assert.equal(typeof backend.fetch, 'function');
  }
  assert.equal(backendOf('nope'), undefined);
  // Only vendors with a documented free tier belong here.
  assert.equal(backendOf('perplexity'), undefined);
  assert.equal(backendOf('bing'), undefined);
});

test('Tavily sends a bearer key for search and extraction', async t => {
  t.after(restore);
  capture({ body: { answer: 'yes', results: [{ url: 'https://a.test', title: 'A', content: 'x'.repeat(2000), published_date: '2026-01-02' }] } });
  const withKey = await backendOf('tavily').search({ query: 'q', maxResults: 3 }, 'tvly-1', new AbortController().signal);
  assert.equal(recorded[0].url, 'https://api.tavily.com/search');
  assert.equal(recorded[0].init.headers.Authorization, 'Bearer tvly-1');
  assert.equal(JSON.parse(recorded[0].init.body).max_results, 3);
  assert.equal(withKey.content, 'yes');
  assert.equal(withKey.sources[0].publishedAt, '2026-01-02');
  assert.ok(withKey.sources[0].snippet.length <= 801, 'a full page body must be trimmed to a snippet');

  assert.equal(recorded[0].init.headers['X-Tavily-Access-Mode'], undefined);
  capture({ body: { results: [{ raw_content: 'page content' }] } });
  await backendOf('tavily').fetch('https://a.test', 'tvly-1', new AbortController().signal);
  assert.equal(recorded[0].init.headers.Authorization, 'Bearer tvly-1');
  assert.equal(recorded[0].init.headers['X-Tavily-Access-Mode'], undefined);
});

test('Tavily reports an empty result set as a failure so the chain moves on', async t => {
  t.after(restore);
  capture({ body: { results: [] } });
  await assert.rejects(backendOf('tavily').search({ query: 'q' }, 'k', new AbortController().signal), /no results/);
});

test('Tavily extract surfaces a per-URL failure reason', async t => {
  t.after(restore);
  capture({ body: { results: [], failed_results: [{ error: 'blocked by robots' }] } });
  await assert.rejects(backendOf('tavily').fetch('https://a.test', 'k', new AbortController().signal), /blocked by robots/);
});

test('Firecrawl sends a bearer key and reads data.web', async t => {
  t.after(restore);
  capture({ body: { success: true, data: { web: [{ url: 'https://b.test', title: 'B', description: 'desc' }] } } });
  const result = await backendOf('firecrawl').search({ query: 'q' }, 'fc-1', new AbortController().signal);
  assert.equal(recorded[0].url, 'https://api.firecrawl.dev/v2/search');
  assert.equal(recorded[0].init.headers.Authorization, 'Bearer fc-1');
  assert.equal(result.sources[0].snippet, 'desc');
});

test('Firecrawl scrape reports truncation through its warning field', async t => {
  t.after(restore);
  capture({ body: { success: true, data: { markdown: '# Hi' }, warning: 'partial' } });
  const result = await backendOf('firecrawl').fetch('https://b.test', 'fc-1', new AbortController().signal);
  assert.equal(recorded[0].init.headers.Authorization, 'Bearer fc-1');
  assert.deepEqual(result, { content: '# Hi', truncated: true });
});

test('a non-2xx response carries its status so quota failures are distinguishable', async t => {
  t.after(restore);
  capture({ ok: false, status: 402, body: {} });
  await assert.rejects(backendOf('firecrawl').search({ query: 'q' }, 'k', new AbortController().signal), error => {
    assert.equal(error.status, 402);
    return true;
  });
});

test('TinyFish sends X-API-Key on both its subdomains and maps each field set', async t => {
  t.after(restore);
  capture({ body: { results: [{ url: 'https://c.test', title: 'C', snippet: 'snip', published_at: '2026-02-03' }] } });
  const search = await backendOf('tinyfish').search({ query: 'hello world' }, 'tf-1', new AbortController().signal);
  const searchUrl = new URL(recorded[0].url);
  assert.equal(searchUrl.origin, 'https://api.search.tinyfish.ai');
  assert.equal(searchUrl.searchParams.get('query'), 'hello world');
  assert.equal(recorded[0].init.headers['X-API-Key'], 'tf-1');
  assert.equal(search.sources[0].publishedAt, '2026-02-03');

  capture({ body: { results: [{ text: '# Doc' }], errors: [] } });
  const fetched = await backendOf('tinyfish').fetch('https://c.test', 'tf-1', new AbortController().signal);
  assert.equal(recorded[0].url, 'https://api.fetch.tinyfish.ai');
  assert.equal(JSON.parse(recorded[0].init.body).format, 'markdown');
  assert.equal(fetched.content, '# Doc');
});

test('Exa search authenticates with its saved key and requests bounded highlights', async context => {
  context.after(restore);
  const signal = new AbortController().signal;
  capture({ body: { results: [null, { title: 'missing URL' }, { url: 'https://exa.test', title: 'Exa',
    highlights: ['x'.repeat(1000), 42, 'more'], publishedDate: '2026-11-17', text: 'unrequested full body' }] } });
  const result = await backendOf('exa').search({ query: 'q', maxResults: 1000 }, 'exa-test-key', signal);
  const call = recorded[0];
  assert.equal(call.url, 'https://api.exa.ai/search');
  assert.equal(call.init.headers['x-api-key'], 'exa-test-key');
  assert.equal(call.init.signal, signal);
  assert.equal(call.init.redirect, 'error');
  assert.equal(call.init.cache, 'no-store');
  assert.deepEqual(JSON.parse(call.init.body), { query: 'q', type: 'auto', numResults: 100,
    contents: { highlights: { maxCharacters: 800 } } });
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].publishedAt, '2026-11-17');
  assert.ok(result.sources[0].snippet.length <= 801);
  assert.doesNotMatch(JSON.stringify(result), /unrequested full body|exa-test-key/);
  capture({ body: { results: [{ url: 'https://exa.test', text: 'fallback text' }] } });
  assert.equal((await backendOf('exa').search({ query: 'q' }, 'key', signal)).sources[0].snippet, 'fallback text');
  assert.equal(JSON.parse(recorded[0].init.body).numResults, undefined);
});

test('Exa contents preserves readable text and flags the local delivery bound', async context => {
  context.after(restore);
  const signal = new AbortController().signal;
  capture({ body: { results: [{ url: 'https://exa.test', text: '# Exa' }], statuses: [{ status: 'success' }] } });
  const result = await backendOf('exa').fetch('https://exa.test', 'key', signal);
  assert.deepEqual(result, { content: '# Exa', truncated: false });
  assert.equal(recorded[0].url, 'https://api.exa.ai/contents');
  assert.equal(recorded[0].init.headers['x-api-key'], 'key');
  assert.equal(recorded[0].init.signal, signal);
  assert.equal(recorded[0].init.redirect, 'error');
  assert.deepEqual(JSON.parse(recorded[0].init.body), { urls: ['https://exa.test'], text: { maxCharacters: 100001 } });
  capture({ body: { results: [{ text: 'x'.repeat(100001) }] } });
  const long = await backendOf('exa').fetch('https://exa.test', 'key', signal);
  assert.equal(long.content.length, 100000);
  assert.equal(long.truncated, true);
});

test('Exa rejects malformed, empty and per-URL failures without exposing upstream error payloads', async context => {
  context.after(restore);
  const signal = new AbortController().signal;
  for (const body of [null, {}, { results: [] }, { results: [null, { url: '' }] }]) {
    capture({ body });
    await assert.rejects(backendOf('exa').search({ query: 'q' }, 'key', signal));
  }
  for (const body of [null, {}, { results: [] }, { results: [{ text: ' ' }] },
    { results: [{ text: 'stale' }], statuses: [{ status: 'error', error: { message: 'private-payload' } }] }]) {
    capture({ body });
    await assert.rejects(backendOf('exa').fetch('https://exa.test', 'key', signal), error => {
      assert.doesNotMatch(error.message, /private-payload/);
      return true;
    });
  }
  for (const status of [401, 402, 429]) {
    capture({ ok: false, status, body: { error: 'private-payload' } });
    await assert.rejects(backendOf('exa').search({ query: 'q' }, 'key', signal), error => {
      assert.equal(error.status, status);
      assert.equal(parseProbeDiagnostic(probeDiagnostic(error, 'exa', 'api-key')).provider, 'exa');
      assert.doesNotMatch(error.message, /private-payload/);
      return true;
    });
  }
});

test('Exa failures continue through the existing search chain', async context => {
  context.after(restore);
  let fallbackCalls = 0;
  const provider = new AggregateSearchProvider(() => [
    { id: 'exa-1', backend: backendOf('exa'), apiKey: 'key' },
    { id: 'fallback', apiKey: 'key', backend: { id: 'fallback', search: async () => {
      fallbackCalls++; return { sources: [{ url: 'https://fallback.test' }] };
    } } },
  ]);
  for (const reply of [{ ok: false, status: 429 }, { body: { results: [] } }]) {
    capture(reply);
    assert.equal((await provider.search({ query: 'q' })).sources[0].url, 'https://fallback.test');
  }
  assert.equal(fallbackCalls, 2);
});

test('every backend rejects empty keys before sending any search or fetch request', async context => {
  context.after(restore);
  capture({ body: {} });
  for (const backend of BACKENDS) {
    for (const key of ['', '   ']) {
      await assert.rejects(backend.search({ query: 'q' }, key, new AbortController().signal), /webSearchKeyMissing/);
      await assert.rejects(backend.fetch('https://example.com', key, new AbortController().signal), /webSearchKeyMissing/);
    }
  }
  assert.equal(recorded.length, 0);
});

test('every backend publishes an https key page so a key can be obtained without guessing', () => {
  for (const backend of BACKENDS) {
    assert.ok(backend.keyUrl.length > 0, `${backend.id} has no key page`);
    const url = new URL(backend.keyUrl);
    assert.equal(url.protocol, 'https:', `${backend.id} key page must be https`);
  }
  assert.equal(backendOf('tavily').keyUrl, 'https://app.tavily.com/home');
  assert.equal(backendOf('tinyfish').keyUrl, 'https://agent.tinyfish.ai/api-keys');
  assert.equal(backendOf('exa').keyUrl, 'https://dashboard.exa.ai/api-keys');
});
