import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHost } from '../host.ts';
import { OperationQueue } from '../../../shared/host/operation-queue.ts';
import { webSearchCatalogCodec } from '../rpc.ts';

const WEB_MODULE = '@deepseek-ai/dsh-web';

test('search probes keep safe HTTP details and use a bounded request signal', async context => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let requestSignal;
  globalThis.fetch = async (_url, init) => {
    requestSignal = init.signal;
    return { ok: false, status: 403 };
  };
  const app = fixture({ searchChain: [slot('firecrawl-1', 'firecrawl')],
    records: new Map([['power-dsh/firecrawl-1', { kind: 'api-key', key: 'test-key' }]]) });
  const result = await app.host.webSearch.probeSearch('firecrawl-1');
  assert.equal(result.ok, false);
  assert.equal(result.diagnostic.provider, 'firecrawl');
  assert.equal(result.diagnostic.auth, 'api-key');
  assert.equal(result.diagnostic.httpStatus, 403);
  assert.equal(result.message, 'webSearchProbeReason_forbidden');
  assert.ok(requestSignal instanceof AbortSignal);
});

test('fetch probe errors never send raw network exception text over RPC', async context => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new TypeError('secret-key https://private.example', {
    cause: Object.assign(new Error('private payload'), { code: 'ECONNRESET' }),
  }); };
  const app = fixture({ fetchChain: [slot('firecrawl-1', 'firecrawl')],
    records: new Map([['power-dsh/firecrawl-1', { kind: 'api-key', key: 'test-key' }]]) });
  const result = await app.host.webSearch.probeFetch('firecrawl-1');
  assert.equal(result.diagnostic.systemCode, 'ECONNRESET');
  assert.equal(result.diagnostic.reason, 'network');
  assert.doesNotMatch(JSON.stringify(result), /secret-key|private.example|private payload/);
});

test('legacy chains load without writes and keep the original key across independent rows', async () => {
  const app = fixture({ searchChain: ['tavily'], fetchChain: ['tavily'],
    records: new Map([['power-dsh/tavily', { kind: 'api-key', key: 'original' }]]) });
  const catalog = webSearchCatalogCodec.create().parse(await app.host.webSearch.catalog());
  assert.equal(catalog.slots.length, 2);
  assert.notEqual(catalog.search.ids[0], catalog.fetch.ids[0]);
  assert.ok(catalog.slots.every(row => row.hasKey));
  assert.deepEqual(app.ctx.fiber.entry.options.config.webSearchChain, ['tavily']);
  assert.equal(app.records.size, 1);
});

test('editing a legacy chain copies its keys before converting only that chain', async () => {
  const app = fixture({ searchChain: ['tavily'], fetchChain: ['tavily'],
    records: new Map([['power-dsh/tavily', { kind: 'api-key', key: 'original' }]]) });
  const before = await app.host.webSearch.catalog();
  const id = before.search.ids[0];
  await app.host.webSearch.addSlot('search', 'tavily');
  assert.deepEqual(app.ctx.fiber.entry.options.config.webSearchChain[0], { id, provider: 'tavily' });
  assert.deepEqual(app.ctx.fiber.entry.options.config.webFetchChain, ['tavily']);
  assert.equal(app.records.get(`power-dsh/${id}`).key, 'original');
  await app.host.webSearch.saveKey(id, 'replacement');
  assert.equal(app.records.get('power-dsh/tavily').key, 'original');
  assert.equal(app.records.get(`power-dsh/${id}`).key, 'replacement');
  assert.equal((await app.host.webSearch.catalog()).slots.find(row => row.id === before.fetch.ids[0]).hasKey, true);
});

test('clearing a legacy key never restores it from the original shared record', async () => {
  const app = fixture({ searchChain: ['tinyfish'], fetchChain: ['tinyfish'],
    records: new Map([['power-dsh/tinyfish', { kind: 'api-key', key: 'original' }]]) });
  const before = await app.host.webSearch.catalog();
  const after = await app.host.webSearch.saveKey(before.search.ids[0], '');
  assert.equal(after.slots.find(row => row.id === before.search.ids[0]).hasKey, false);
  assert.equal(after.slots.find(row => row.id === before.fetch.ids[0]).hasKey, true);
  assert.equal(app.records.get('power-dsh/tinyfish').key, 'original');
});

test('a failed legacy credential copy leaves the stored chain and key intact', async () => {
  const app = fixture({ searchChain: ['tavily'],
    records: new Map([['power-dsh/tavily', { kind: 'api-key', key: 'original' }]]) });
  app.ctx.inject(['credentials'], child => {
    child.credentials.modifyRecord = async () => { throw new Error('vault unavailable'); };
  });
  await assert.rejects(app.host.webSearch.addSlot('search', 'firecrawl'), /vault unavailable/);
  assert.deepEqual(app.ctx.fiber.entry.options.config.webSearchChain, ['tavily']);
  assert.equal(app.records.get('power-dsh/tavily').key, 'original');
  assert.equal((await app.host.webSearch.catalog()).slots[0].hasKey, true);
});

test('legacy ids avoid existing instance ids in either chain', async () => {
  const app = fixture({ searchChain: ['tavily', 'tavily'],
    fetchChain: [slot('legacy-search-tavily', 'firecrawl')] });
  const catalog = webSearchCatalogCodec.create().parse(await app.host.webSearch.catalog());
  assert.equal(catalog.search.ids.length, 1);
  assert.notEqual(catalog.search.ids[0], catalog.fetch.ids[0]);
});

/** One configured instance; the provider defaults to the id's vendor prefix. */
const slot = (id, provider = id.replace(/-\d+$/, '')) => ({ id, provider });

/** A Host fixture with a web seam, a credentials store, and an editable web row. */
function fixture({ enabled = false, searchChain = [], fetchChain = [], webConfig = { searchProvider: 'deepseek-search-api', fetchProvider: 'http' }, records = new Map(), withWeb = true, withCredentials = true, setThirdPartySearchActive } = {}) {
  const searchProviders = new Map();
  const fetchProviders = new Map();
  const webRow = { options: { id: 'web', name: WEB_MODULE, config: { ...webConfig } } };
  const entries = [webRow];
  // A volatile config field reads the entry's current config, so a write through
  // the editor must be visible to the next `get()` exactly as it is at runtime.
  let masterEnabled = enabled;
  const powerDshRow = { options: { id: 'power-dsh', name: 'power-dsh', config: {
    ...(searchChain.length ? { webSearchChain: searchChain } : {}),
    ...(fetchChain.length ? { webFetchChain: fetchChain } : {}),
  } } };
  const values = {
    webSearchEnabled: { get: () => masterEnabled },
    webSearchChain: { get: () => powerDshRow.options.config?.webSearchChain ?? [] },
    webFetchChain: { get: () => powerDshRow.options.config?.webFetchChain ?? [] },
  };
  const registered = [];
  const unregistered = [];
  const settingsListeners = [];
  // The native ConfigEditor is a class whose `edit` reads `this.ownerContext`.
  // Mirroring that here is what catches a detached `edit` reference, which
  // throws "Cannot read properties of undefined" only when `this` matters.
  class FixtureEditor {
    constructor(rows) { this.ownerContext = { entries: rows }; }
    entries() { return this.ownerContext.entries; }
    async edit(entry, change) {
      if (this.ownerContext === undefined) throw new TypeError("Cannot read properties of undefined (reading 'ownerContext')");
      const inherited = entry.options.id === 'web' ? { searchProvider: 'deepseek-search-api', fetchProvider: 'http' } : {};
      entry.options.config = change(entry.options.config ?? {}, inherited);
    }
  }
  const editor = new FixtureEditor(entries);
  const ctx = {
    profileContext: { home: '/tmp/dsh-home' },
    fiber: { entry: powerDshRow },
    effect: () => () => {},
    // The real Host reaches both optional services through declared child
    // contexts, so the fixture resolves them the same way.
    inject(deps, callback) {
      const child = { ...ctx };
      if (withWeb && deps.includes('web')) child.web = seam;
      if (withCredentials && deps.includes('credentials')) child.credentials = credentials;
      if (deps.includes('web') && !withWeb || deps.includes('credentials') && !withCredentials) return () => {};
      callback(child);
      return () => {};
    },
    on(event, listener) {
      if (event === 'settings/document-updated') settingsListeners.push(listener);
      return () => {};
    },
    configEditor: editor,
  };
  const seam = {
    registerSearchProvider(provider) {
      assert.equal(searchProviders.has(provider.id), false, 'duplicate registration must not happen');
      searchProviders.set(provider.id, provider);
      registered.push(provider.id);
      return () => { searchProviders.delete(provider.id); unregistered.push(provider.id); };
    },
    registerFetchProvider(provider) {
      assert.equal(fetchProviders.has(provider.id), false, 'duplicate registration must not happen');
      fetchProviders.set(provider.id, provider);
      registered.push(provider.id);
      return () => { fetchProviders.delete(provider.id); unregistered.push(provider.id); };
    },
  };
  /** Credentials keyed by full record key (`power-dsh/<instance id>`). */
  const credentials = {
    async describeRecord(key) { return { configured: records.has(key), writable: true }; },
    async readRecord(key) { return records.get(key); },
    async modifyRecord(key, mutate) { const next = await mutate(records.get(key)); if (next !== undefined) records.set(key, next); return next; },
    async deleteRecord(key) { records.delete(key); },
  };
  const queue = new OperationQueue();
  const host = createHost(ctx, values, { owner: ctx, ensureActive: () => queue.ensureActive(), setThirdPartySearchActive });
  return {
    ctx, host, seam, searchProviders, fetchProviders, registered, unregistered, records, webRow,
    // Turning the switch off reaches the Host through a settings document event;
    // the fixture fires the same listener the real Host subscribes to.
    setMasterEnabled(value) { masterEnabled = value; settingsListeners.forEach(listener => listener('power-dsh')); },
  };
}

test('enabling registers exactly one search and one fetch provider and pins the web row', async () => {
  const app = fixture({ enabled: true, searchChain: [slot('tavily-1')], fetchChain: [slot('tavily-1')] });
  await app.host.webSearch.addSlot('search', 'firecrawl');
  assert.deepEqual([...app.searchProviders.keys()], ['power-dsh-search']);
  assert.deepEqual([...app.fetchProviders.keys()], ['power-dsh-fetch']);
  assert.equal(app.webRow.options.config.searchProvider, 'power-dsh-search');
  assert.equal(app.webRow.options.config.fetchProvider, 'power-dsh-fetch');
});

test('the catalog lists every configured instance and never exposes a key value', async () => {
  const app = fixture({ enabled: true, searchChain: [slot('tinyfish-1', 'tinyfish')],
    records: new Map([['power-dsh/tinyfish-1', { kind: 'api-key', key: 'tf-secret' }]]) });
  const catalog = await app.host.webSearch.catalog();
  assert.deepEqual(catalog.search.ids, ['tinyfish-1']);
  assert.deepEqual(catalog.fetch.ids, []);
  const row = catalog.slots.find(candidate => candidate.id === 'tinyfish-1');
  assert.equal(row.provider, 'tinyfish');
  assert.equal(row.hasKey, true);
  assert.equal(row.configured, true);
  assert.ok(!JSON.stringify(catalog).includes('tf-secret'), 'a key value must never cross the RPC boundary');
});

test('the same vendor can be added twice with different keys and they stay independent', async () => {
  // This is the whole point of instances: two Tavily keys are two records.
  const app = fixture({ enabled: true });
  await app.host.webSearch.addSlot('search', 'tavily');
  await app.host.webSearch.addSlot('search', 'tavily');
  let catalog = await app.host.webSearch.catalog();
  assert.deepEqual(catalog.search.ids, ['tavily-1', 'tavily-2']);

  await app.host.webSearch.saveKey('tavily-1', 'first-key');
  await app.host.webSearch.saveKey('tavily-2', 'second-key');
  assert.equal(app.records.get('power-dsh/tavily-1').key, 'first-key');
  assert.equal(app.records.get('power-dsh/tavily-2').key, 'second-key');

  // Removing one instance must not touch the other's credential.
  catalog = await app.host.webSearch.removeSlot('search', 'tavily-1');
  assert.deepEqual(catalog.search.ids, ['tavily-2']);
  assert.equal(app.records.has('power-dsh/tavily-1'), false);
  assert.equal(app.records.get('power-dsh/tavily-2').key, 'second-key');
});

test('a new instance id never collides with an id already used in either chain', async () => {
  const app = fixture({ enabled: true, searchChain: [slot('tavily-1')], fetchChain: [slot('tavily-2')] });
  const catalog = await app.host.webSearch.addSlot('search', 'tavily');
  assert.deepEqual(catalog.search.ids, ['tavily-1', 'tavily-3'], 'the fetch chain already owns tavily-2');
});

test('search and fetch chains are independent', async () => {
  const app = fixture({ enabled: true });
  await app.host.webSearch.addSlot('search', 'tavily');
  await app.host.webSearch.addSlot('fetch', 'firecrawl');
  let catalog = await app.host.webSearch.catalog();
  assert.deepEqual(catalog.search.ids, ['tavily-1']);
  assert.deepEqual(catalog.fetch.ids, ['firecrawl-1']);

  // Removing from one chain leaves the other alone.
  catalog = await app.host.webSearch.removeSlot('search', 'tavily-1');
  assert.deepEqual(catalog.search.ids, []);
  assert.deepEqual(catalog.fetch.ids, ['firecrawl-1']);
});

test('the search provider only ever sees the search chain', async () => {
  const app = fixture({ enabled: true, searchChain: [slot('tavily-1')], fetchChain: [slot('firecrawl-1', 'firecrawl')] });
  await app.host.webSearch.saveKey('tavily-1', 'test-tavily-key');
  await app.host.webSearch.saveKey('firecrawl-1', 'test-firecrawl-key');
  await app.host.webSearch.addSlot('search', 'tinyfish');
  const search = [...app.searchProviders.values()][0];
  const fetch = [...app.fetchProviders.values()][0];
  assert.equal(search.available(), true);
  assert.equal(fetch.available(), true);
  // Reordering the fetch chain must not reorder the search chain.
  await app.host.webSearch.reorder('fetch', ['firecrawl-1']);
  assert.deepEqual((await app.host.webSearch.catalog()).search.ids, ['tavily-1', 'tinyfish-1']);
});

test('saving a key stores it under the instance, not the settings document', async () => {
  const app = fixture({ enabled: true, searchChain: [slot('tinyfish-1', 'tinyfish')] });
  const catalog = await app.host.webSearch.saveKey('tinyfish-1', '  tf-secret  ');
  assert.equal(app.records.get('power-dsh/tinyfish-1').key, 'tf-secret', 'the key is trimmed');
  assert.equal(catalog.slots.find(row => row.id === 'tinyfish-1').hasKey, true);
  assert.deepEqual(app.ctx.fiber.entry.options.config.webSearchChain, [slot('tinyfish-1', 'tinyfish')],
    'the settings document holds instance ids only, never a key');
});

test('a drag reports the whole order and it is written in one go', async () => {
  const app = fixture({ enabled: true, searchChain: [slot('tavily-1'), slot('firecrawl-1', 'firecrawl'), slot('tinyfish-1', 'tinyfish')] });
  const catalog = await app.host.webSearch.reorder('search', ['tinyfish-1', 'tavily-1', 'firecrawl-1']);
  assert.deepEqual(catalog.search.ids, ['tinyfish-1', 'tavily-1', 'firecrawl-1']);
  assert.deepEqual(app.ctx.fiber.entry.options.config.webSearchChain, [
    slot('tinyfish-1', 'tinyfish'), slot('tavily-1'), slot('firecrawl-1', 'firecrawl'),
  ]);
});

test('reordering one chain leaves the other untouched', async () => {
  const app = fixture({ enabled: true, searchChain: [slot('tavily-1'), slot('tinyfish-1', 'tinyfish')],
    fetchChain: [slot('tavily-2'), slot('tinyfish-2', 'tinyfish')] });
  await app.host.webSearch.reorder('fetch', ['tinyfish-2', 'tavily-2']);
  const catalog = await app.host.webSearch.catalog();
  assert.deepEqual(catalog.search.ids, ['tavily-1', 'tinyfish-1']);
  assert.deepEqual(catalog.fetch.ids, ['tinyfish-2', 'tavily-2']);
});

test('an unchanged order is not written at all', async () => {
  const app = fixture({ enabled: true, searchChain: [slot('tavily-1'), slot('tinyfish-1', 'tinyfish')] });
  const before = JSON.stringify(app.ctx.fiber.entry.options.config);
  await app.host.webSearch.reorder('search', ['tavily-1', 'tinyfish-1']);
  assert.equal(JSON.stringify(app.ctx.fiber.entry.options.config), before);
});

test('a stale drag naming an instance that left the chain is rejected, not applied', async () => {
  const app = fixture({ enabled: true, searchChain: [slot('tavily-1'), slot('tinyfish-1', 'tinyfish')] });
  await assert.rejects(app.host.webSearch.reorder('search', ['tinyfish-1', 'firecrawl-1']), /webSearchOrderChanged/);
  await assert.rejects(app.host.webSearch.reorder('search', ['tinyfish-1']), /webSearchOrderChanged/);
  await assert.rejects(app.host.webSearch.reorder('search', ['tinyfish-1', 'tinyfish-1']), /webSearchOrderChanged/);
  assert.deepEqual((await app.host.webSearch.catalog()).search.ids, ['tavily-1', 'tinyfish-1'],
    'a rejected reorder changes nothing');
});

test('emptying a chain removes its stored field instead of leaving an empty override', async () => {
  const app = fixture({ enabled: true, searchChain: [slot('tavily-1')] });
  await app.host.webSearch.removeSlot('search', 'tavily-1');
  assert.equal(Object.hasOwn(app.ctx.fiber.entry.options.config, 'webSearchChain'), false);
});

test('an unknown vendor, capability or instance is rejected rather than silently ignored', async () => {
  const app = fixture({ enabled: true, searchChain: [slot('tavily-1')] });
  await assert.rejects(app.host.webSearch.addSlot('search', 'perplexity'), /webSearchUnknownBackend/);
  await assert.rejects(app.host.webSearch.addSlot('nope', 'tavily'), /capability must be search or fetch/);
  await assert.rejects(app.host.webSearch.reorder('nope', ['tavily-1']), /capability must be search or fetch/);
  await assert.rejects(app.host.webSearch.removeSlot('search', 'ghost-1'), /webSearchUnknownBackend/);
  await assert.rejects(app.host.webSearch.saveKey('ghost-1', 'x'), /webSearchUnknownBackend/);
  await assert.rejects(app.host.webSearch.probeSearch('ghost-1'), /webSearchUnknownBackend/);
  await assert.rejects(app.host.webSearch.probeFetch('ghost-1'), /webSearchUnknownBackend/);
});

test('all probes reject missing keys without making a request', async context => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = () => { assert.fail('missing credentials must not reach the network'); };
  for (const provider of ['tavily', 'firecrawl', 'tinyfish']) {
    const id = `${provider}-1`;
    const app = fixture({ enabled: true, searchChain: [slot(id, provider)], fetchChain: [slot(`${provider}-2`, provider)] });
    for (const result of [await app.host.webSearch.probeSearch(id), await app.host.webSearch.probeFetch(`${provider}-2`)]) {
      assert.equal(result.ok, false);
      assert.equal(result.message, 'webSearchKeyMissing');
      assert.equal(result.resultCount, 0);
      assert.equal(result.diagnostic.auth, 'missing');
      assert.equal(result.diagnostic.reason, 'key-missing');
    }
  }
});

test('without a web seam the catalog reports unavailable and nothing is registered', async () => {
  const app = fixture({ enabled: true, withWeb: false });
  const catalog = await app.host.webSearch.catalog();
  assert.equal(catalog.available, false);
  assert.deepEqual(app.registered, []);
  assert.equal(app.webRow.options.config.searchProvider, 'deepseek-search-api', 'an unavailable seam must not rewrite selection');
});

test('the provider ids the pin writes are the ones the seam actually received', async () => {
  const app = fixture({ enabled: true, searchChain: [slot('tavily-1')], fetchChain: [slot('tavily-1')] });
  await app.host.webSearch.addSlot('search', 'tinyfish');
  assert.equal(app.webRow.options.config.searchProvider, [...app.searchProviders.keys()][0]);
  assert.equal(app.webRow.options.config.fetchProvider, [...app.fetchProviders.keys()][0]);
});

test('a profile without the credentials service still renders the page', async () => {
  const app = fixture({ enabled: true, searchChain: [slot('tinyfish-1', 'tinyfish')], withCredentials: false });
  const catalog = await app.host.webSearch.catalog();
  assert.equal(catalog.available, true);
  const row = catalog.slots.find(candidate => candidate.id === 'tinyfish-1');
  assert.equal(row.hasKey, false);
  assert.equal(row.writable, false);
});

test('disabling the feature restores both native selections', async () => {
  const app = fixture({ enabled: true, searchChain: [slot('tavily-1')], fetchChain: [slot('tinyfish-1', 'tinyfish')] });
  await app.host.webSearch.addSlot('search', 'firecrawl');
  assert.equal(app.webRow.options.config.searchProvider, 'power-dsh-search');
  assert.equal(app.webRow.options.config.fetchProvider, 'power-dsh-fetch');
  app.setMasterEnabled(false);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(app.webRow.options.config.searchProvider, 'deepseek-search-api');
  assert.equal(app.webRow.options.config.fetchProvider, 'http');
});

test('the fetch provider fronts the local fetcher even with an empty chain', async () => {
  const app = fixture({ enabled: true, searchChain: [slot('tavily-1')] });
  await app.host.webSearch.addSlot('search', 'tinyfish');
  assert.deepEqual([...app.fetchProviders.keys()], ['power-dsh-fetch'], 'one fetch provider, empty chain or not');
  assert.equal(app.webRow.options.config.fetchProvider, 'power-dsh-fetch');
});

test('third-party search is allowed only after selection and is blocked before restoring official selection', async () => {
  const calls = [];
  let routed = false;
  const app = fixture({ setThirdPartySearchActive: async active => {
    calls.push(active);
    if (active || routed) {
      assert.equal(app.webRow.options.config.searchProvider, 'power-dsh-search');
      assert.equal(app.searchProviders.has('power-dsh-search'), true);
    }
    routed = active;
  } });
  await app.host.webSearch.catalog();
  app.setMasterEnabled(true);
  await app.host.webSearch.catalog();
  assert.ok(calls.includes(true));
  app.setMasterEnabled(false);
  await app.host.webSearch.catalog();
  assert.equal(app.webRow.options.config.searchProvider, 'deepseek-search-api');
  assert.equal(app.searchProviders.size, 0);
});

test('tool restoration failures reject reads and writes and remove provider pins and registrations', async () => {
  const app = fixture({ enabled: true, setThirdPartySearchActive: async active => {
    if (active) throw new Error('Native search restoration failed');
  } });
  await assert.rejects(app.host.webSearch.catalog(), /restoration failed/);
  await assert.rejects(app.host.webSearch.addSlot('search', 'tavily'), /restoration failed/);
  assert.equal(app.webRow.options.config.searchProvider, 'deepseek-search-api');
  assert.equal(app.webRow.options.config.fetchProvider, 'http');
  assert.equal(app.searchProviders.size, 0);
  assert.equal(app.fetchProviders.size, 0);
});
