import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AggregateFetchProvider, AggregateSearchProvider, FETCH_PROVIDER_ID, SEARCH_PROVIDER_ID, describeFailures, usable } from '../provider.ts';
import { BackendError } from '../backends.ts';

function backend(id, { search, fetch } = {}) {
  return {
    id, credentialId: id,
    search: search ?? (async () => ({ sources: [{ url: `https://${id}.test/1`, title: id }] })),
    fetch: fetch ?? (async () => ({ content: `# ${id}`, truncated: false })),
  };
}

test('provider ids are stable and distinct', () => {
  assert.equal(SEARCH_PROVIDER_ID, 'power-dsh-search');
  assert.equal(FETCH_PROVIDER_ID, 'power-dsh-fetch');
  assert.notEqual(SEARCH_PROVIDER_ID, FETCH_PROVIDER_ID);
});

test('every unconfigured backend is skipped, including whitespace keys', () => {
  const slot = { id: 'a', backend: backend('a'), apiKey: '' };
  assert.equal(usable(slot), false);
  assert.equal(usable({ ...slot, apiKey: 'k' }), true);
  assert.equal(usable({ ...slot, apiKey: '   ' }), false);
});

test('search walks the chain in order and reports which backend answered', async () => {
  const calls = [];
  const first = backend('first', { search: async () => { calls.push('first'); throw new BackendError('boom', 500); } });
  const second = backend('second', { search: async () => { calls.push('second'); return { sources: [{ url: 'https://ok.test' }] }; } });
  const provider = new AggregateSearchProvider(() => [{ id: (first).id, backend: first, apiKey: 'k' }, { id: (second).id, backend: second, apiKey: 'k' }]);
  assert.equal(provider.available(), true);
  const result = await provider.search({ query: 'q' });
  assert.deepEqual(calls, ['first', 'second']);
  assert.equal(result.sources.length, 1);
  assert.equal(result.truncated, false);
});

test('a 429 falls through to the next backend instead of failing the search', async () => {
  const quota = backend('quota', { search: async () => { throw new BackendError('rate limited', 429); } });
  const ok = backend('ok');
  const provider = new AggregateSearchProvider(() => [{ id: (quota).id, backend: quota, apiKey: 'k' }, { id: (ok).id, backend: ok, apiKey: 'k' }]);
  const result = await provider.search({ query: 'q' });
  assert.equal(result.sources[0].url, 'https://ok.test/1');
});

test('an all-failed chain throws one aggregate error naming each backend', async () => {
  const a = backend('a', { search: async () => { throw new BackendError('denied', 401); } });
  const b = backend('b', { search: async () => { throw new BackendError('offline', 503); } });
  const provider = new AggregateSearchProvider(() => [{ id: (a).id, backend: a, apiKey: 'k' }, { id: (b).id, backend: b, apiKey: 'k' }]);
  await assert.rejects(provider.search({ query: 'q' }), error => {
    assert.match(error.message, /a: denied/);
    assert.match(error.message, /b: offline/);
    return true;
  });
});

test('a chain with nothing usable is unavailable rather than silently empty', () => {
  const provider = new AggregateSearchProvider(() => [{ id: 'needs-key', backend: backend('needs-key'), apiKey: '' }]);
  assert.equal(provider.available(), false);
  assert.equal(describeFailures([]), 'no usable web backend is configured');
});

test('search honors the seam bound and flags the cut', async () => {
  const wide = backend('wide', { search: async () => ({ sources: Array.from({ length: 5 }, (_, index) => ({ url: `https://w.test/${String(index)}` })) }) });
  const provider = new AggregateSearchProvider(() => [{ id: (wide).id, backend: wide, apiKey: 'k' }]);
  const result = await provider.search({ query: 'q', maxResults: 2 });
  assert.equal(result.sources.length, 2);
  assert.equal(result.truncated, true);
});

test('an aborted signal stops the walk', async () => {
  const controller = new AbortController();
  controller.abort();
  const calls = [];
  const a = backend('a', { search: async () => { calls.push('a'); return { sources: [{ url: 'https://a.test' }] }; } });
  const provider = new AggregateSearchProvider(() => [{ id: (a).id, backend: a, apiKey: 'k' }]);
  await assert.rejects(provider.search({ query: 'q' }, controller.signal));
  assert.deepEqual(calls, []);
});

test('fetch returns an extracted text body and falls through failures', async () => {
  const broken = backend('broken', { fetch: async () => { throw new BackendError('no content'); } });
  const good = backend('good', { fetch: async () => ({ content: '# Page', truncated: true }) });
  const provider = new AggregateFetchProvider(() => [{ id: (broken).id, backend: broken, apiKey: 'k' }, { id: (good).id, backend: good, apiKey: 'k' }]);
  const result = await provider.fetch({ url: 'https://example.test/page' });
  assert.equal(result.url, 'https://example.test/page');
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, { kind: 'text', content: '# Page' });
  assert.equal(result.truncated, true);
});

test('each provider walks only its own chain', async () => {
  const searchSlots = [{ id: (backend('search-only')).id, backend: backend('search-only'), apiKey: 'k' }];
  const fetchSlots = [{ id: (backend('fetch-only')).id, backend: backend('fetch-only'), apiKey: 'k' }];
  const search = new AggregateSearchProvider(() => searchSlots);
  const fetchProvider = new AggregateFetchProvider(() => fetchSlots);
  assert.equal((await search.search({ query: 'q' })).sources[0].url, 'https://search-only.test/1');
  assert.equal((await fetchProvider.fetch({ url: 'https://x.test' })).body.content, '# fetch-only');
});

test('an empty chain is unavailable rather than borrowing the other chain', () => {
  const search = new AggregateSearchProvider(() => []);
  const fetchProvider = new AggregateFetchProvider(() => []);
  assert.equal(search.available(), false);
  assert.equal(fetchProvider.available(), false);
});

test('providers read their slots live, so a key change needs no re-registration', async () => {
  let slots = [{ id: 'needs-key', backend: backend('needs-key'), apiKey: '' }];
  const provider = new AggregateSearchProvider(() => slots);
  assert.equal(provider.available(), false);
  slots = [{ id: 'needs-key', backend: backend('needs-key'), apiKey: 'k' }];
  assert.equal(provider.available(), true);
  const result = await provider.search({ query: 'q' });
  assert.equal(result.sources.length, 1);
});

test('fetch tries the local fetcher first and never touches the chain when it succeeds', async () => {
  const calls = [];
  const local = {
    async fetch(request) {
      calls.push(['local', request.url]);
      return { url: request.url, statusCode: 200, body: { kind: 'text', content: 'local body' }, truncated: false };
    },
  };
  const remote = backend('remote', { fetch: async () => { calls.push(['remote']); return { content: 'remote', truncated: false }; } });
  const provider = new AggregateFetchProvider(() => [{ id: (remote).id, backend: remote, apiKey: 'k' }], () => local);
  const result = await provider.fetch({ url: 'https://example.test' });
  assert.deepEqual(calls, [['local', 'https://example.test']]);
  assert.equal(result.body.content, 'local body');
});

test('a failed local fetch falls through to the chain', async () => {
  const calls = [];
  const local = { async fetch() { calls.push('local'); throw new Error('blocked by local policy'); } };
  const remote = backend('remote', { fetch: async () => { calls.push('remote'); return { content: 'remote body', truncated: false }; } });
  const provider = new AggregateFetchProvider(() => [{ id: (remote).id, backend: remote, apiKey: 'k' }], () => local);
  const result = await provider.fetch({ url: 'https://example.test' });
  assert.deepEqual(calls, ['local', 'remote']);
  assert.equal(result.body.content, 'remote body');
});

test('the local fetcher passes its own body kind through unchanged', async () => {
  // The native fetcher decodes HTML itself and the host converts it, so the
  // aggregate provider must not force every body to `text`.
  const local = {
    async fetch(request) {
      return { url: request.url, statusCode: 200, body: { kind: 'html', content: '<p>hi</p>' }, truncated: true };
    },
  };
  const provider = new AggregateFetchProvider(() => [], () => local);
  const result = await provider.fetch({ url: 'https://example.test' });
  assert.deepEqual(result.body, { kind: 'html', content: '<p>hi</p>' });
  assert.equal(result.truncated, true);
});

test('the local fetcher alone makes the provider available with an empty chain', () => {
  const local = { async fetch() { return { url: '', statusCode: 200, body: { kind: 'text', content: '' }, truncated: false }; } };
  assert.equal(new AggregateFetchProvider(() => [], () => local).available(), true);
  assert.equal(new AggregateFetchProvider(() => [], () => null).available(), false);
});

test('an aborted local fetch does not fall through to the chain', async () => {
  const controller = new AbortController();
  const local = { async fetch() { controller.abort(); throw new Error('aborted'); } };
  const calls = [];
  const remote = backend('remote', { fetch: async () => { calls.push('remote'); return { content: 'x', truncated: false }; } });
  const provider = new AggregateFetchProvider(() => [{ id: (remote).id, backend: remote, apiKey: 'k' }], () => local);
  await assert.rejects(provider.fetch({ url: 'https://example.test' }, controller.signal));
  assert.deepEqual(calls, [], 'an aborted request must not start another attempt');
});
