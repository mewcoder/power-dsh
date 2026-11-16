import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ToolsService, * as toolsSdk from '@deepseek-ai/dsh-tools';
import { apply, inject } from '../../src/app/host.ts';
import { HOST_FEATURES } from '../../src/app/host-features.ts';

const require = createRequire(import.meta.resolve('@deepseek-ai/dsh-tools'));
const { Context } = await import(pathToFileURL(require.resolve('@deepseek-ai/cordis')).href);
const { defineTool, TOOL_RUNTIME_SCHEDULER } = toolsSdk;
const { ToolExecutionPipeline } = TOOL_RUNTIME_SCHEDULER === undefined
  ? await import('@deepseek-ai/dsh-tools/pipeline') : {};

test('the assembled Host restores native search and dispatches to the selected third-party backend while official search stays disabled', async t => {
  const root = new Context();
  t.after(() => root.fiber.dispose());
  root.reflect.provide('systemPrompt', { tools: () => () => {} });
  await root.plugin(ToolsService);
  const tools = root.get('tools');
  const preferences = { blockOfficialSearch: true, webSearchEnabled: true,
    webSearchChain: [{ id: 'tavily-1', provider: 'tavily' }], webFetchChain: [] };
  const power = { options: { id: 'power-dsh', name: 'power-dsh', config: preferences } };
  const web = { options: { id: 'web', name: '@deepseek-ai/dsh-web',
    config: { searchProvider: 'power-dsh-search', fetchProvider: 'power-dsh-fetch' } } };
  const nativeTool = { options: { id: 'web-tool', name: '@deepseek-ai/dsh-tool-web',
    config: { search: false, fetch: true } } };
  const providers = new Map();
  let releaseSearch;
  const nativeSearch = defineTool({
    name: 'web_search', description: 'Native web service routing fixture', parameters: {},
    output: { schema: { type: 'boolean' }, render: () => [{ type: 'text', text: 'Done' }] },
    async execute() {
      const provider = providers.get(web.options.config.searchProvider);
      assert.ok(provider, 'The selected provider must be registered.');
      const result = await provider.search({ query: 'DeepSeek', maxResults: 5 });
      assert.equal(result.sources[0].title, 'Third-party result');
      return true;
    },
  });
  const editor = {
    entries: () => [web, nativeTool],
    async edit(entry, change) {
      const next = change(structuredClone(entry.options.config),
        entry === web ? { searchProvider: 'deepseek-search-api', fetchProvider: 'http' } : {});
      if (entry === power) Object.assign(preferences, next);
      else entry.options.config = next;
      if (entry === nativeTool) {
        releaseSearch?.();
        releaseSearch = next.search ? tools.register(nativeSearch) : undefined;
      }
    },
  };
  for (const [name, value] of Object.entries({
    settings: { configure: () => () => {} },
    clientModules: { graph: () => ({ release: { version: '0.2.2-rc.1' } }) },
    pluginManager: {}, typert: { register: () => () => {} },
    configEditor: editor, profileContext: { home: '/memory-only/dsh-home' },
    agents: { list: () => [] }, agentPresets: { compositionInventory: async () => [] },
    web: {
      registerSearchProvider(provider) { providers.set(provider.id, provider); return () => providers.delete(provider.id); },
      registerFetchProvider: () => () => {},
    },
    credentials: {
      describeRecord: async () => ({ configured: true, writable: true }),
      readRecord: async () => ({ kind: 'api-key', key: 'fixture-key' }),
      modifyRecord: async () => { assert.fail('Routing must not change credentials.'); },
      deleteRecord: async () => { assert.fail('Routing must not change credentials.'); },
    },
  })) root.reflect.provide(name, value);
  const config = Object.fromEntries(Object.keys(preferences).map(key => [key, { get: () => preferences[key] }]));
  function plugin(ctx) {
    ctx.fiber.entry = power;
    apply(ctx, config, HOST_FEATURES.filter(feature => ['search-blocking', 'web-search'].includes(feature.definition.id)));
  }
  plugin.inject = inject;
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; releaseSearch?.(); });
  let requests = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.tavily.com/search');
    assert.equal(options.headers.Authorization, 'Bearer fixture-key');
    requests++;
    return { ok: true, json: async () => ({
      results: [{ title: 'Third-party result', url: 'https://example.com', content: 'Result body' }],
    }) };
  };
  const fiber = await root.plugin(plugin);
  const service = root.get('powerDsh');
  await service.webSearch.catalog();
  assert.equal(nativeTool.options.config.search, true);
  assert.equal(nativeTool.options.config.fetch, true);
  assert.equal(preferences.blockOfficialSearch, true);
  assert.equal(service.search.blocked(), false);
  const scheduler = ToolExecutionPipeline ? new ToolExecutionPipeline(root) : tools[TOOL_RUNTIME_SCHEDULER];
  const prepared = await scheduler.prepare({ name: 'web_search', callId: 'third-party-route',
    arguments: {}, signal: new AbortController().signal });
  assert.equal(prepared.kind, 'dispatch');
  const outcome = await scheduler.dispatch(prepared.exec);
  const result = await (ToolExecutionPipeline ? scheduler.complete(prepared.exec, outcome)
    : outcome.kind === 'post-result' ? scheduler.finalize(prepared.exec, outcome.result)
      : scheduler.finish(prepared.exec, outcome.result));
  assert.equal(result.isError, false, result.error?.message);
  assert.equal(requests, 1);
  await service.setSearchBlocked(true);
  assert.equal(nativeTool.options.config.search, true);
  preferences.webSearchEnabled = false;
  root.emit('settings/document-updated', 'power-dsh');
  await service.webSearch.catalog();
  assert.equal(preferences.blockOfficialSearch, true);
  assert.equal(nativeTool.options.config.search, false);
  assert.equal(nativeTool.options.config.fetch, true);
  assert.equal(web.options.config.searchProvider, 'deepseek-search-api');
  assert.equal(service.search.blocked(), true);
  assert.equal(providers.size, 0);
  const denied = await scheduler.prepare({ name: 'web_search', callId: 'official-blocked',
    arguments: {}, signal: new AbortController().signal });
  assert.equal(denied.kind, 'post-result');
  assert.equal(denied.result.isError, true);
  assert.equal(requests, 1);
  await fiber.dispose();
});
