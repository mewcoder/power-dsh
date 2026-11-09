import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import ToolsService, * as toolsSdk from '@deepseek-ai/dsh-tools';
import { SearchPolicy } from '../search-policy.ts';
import { OperationQueue } from '../../../shared/host/operation-queue.ts';
import { SEARCH_RPC } from '../../../app/rpc.ts';

const require = createRequire(import.meta.resolve('@deepseek-ai/dsh-tools'));
const { Context } = await import(require.resolve('@deepseek-ai/cordis'));
const { createScope, scopeTarget } = await import(require.resolve('@deepseek-ai/dsh-scope'));
const { defineTool, TOOL_RUNTIME_SCHEDULER } = toolsSdk;
const { ToolExecutionPipeline } = TOOL_RUNTIME_SCHEDULER === undefined
  ? await import('@deepseek-ai/dsh-tools/pipeline') : {};
const WEB = '@deepseek-ai/dsh-tool-web';
const PRESET = '@deepseek-ai/dsh-agent-preset';
const MCP = 'mcp__thirdparty__web_search';
const rows = plugins => plugins.flatMap(row => row.name === WEB ? [row]
  : row.group === true && Array.isArray(row.config) ? rows(row.config) : []);

async function fixture(t, { blocked = false } = {}) {
  const root = new Context();
  t.after(() => root.fiber.dispose());
  root.reflect.provide('systemPrompt', { tools: () => () => {} });
  await root.plugin(ToolsService);
  const tools = root.get('tools');
  assert.ok(tools, 'The actual Tools service must start.');
  const queue = new OperationQueue();
  const values = { blockOfficialSearch: blocked, blockOfficialAccount: true, blockTodo: true,
    blockOfficialTelemetry: true, notificationsEnabled: true, showVersion: true, customPreference: 'keep' };
  const modEntry = { options: { id: 'power-dsh', config: values } };
  const entries = [
    { disabled: false, options: { id: 'web-global', name: WEB, config: { fetch: true, searchTimeoutMs: 60000 } } },
    { disabled: true, options: { id: 'web-inactive', name: WEB, config: { fetch: true } } },
    { disabled: false, options: { id: 'mode-standard', name: PRESET, config: {
      id: 'standard', title: 'Keep mode metadata', plugins: [
        { id: 'web', name: WEB, config: { fetch: true, searchMaxQueries: 4 } },
        { id: 'group', group: true, config: [
          { id: 'nested-group', group: true, disabled: true, config: [
            { id: 'web-disabled', name: WEB, disabled: true, config: { search: false, fetch: false, searchMaxResults: 2 } },
          ] },
          { name: '@example/search', config: { search: true, fetch: true } },
        ] },
      ],
    } } },
    { disabled: true, options: { id: 'mode-inactive', name: PRESET, config: {
      id: 'inactive', plugins: [{ name: WEB, config: { fetch: true } }],
    } } },
    { disabled: false, options: { id: 'unrelated', name: '@example/plugin', config: { plugins: [{ name: WEB }] } } },
  ];
  const writes = [];
  const calls = [];
  const live = [];
  const configEditor = {
    entries: () => entries,
    async edit(entry, change) {
      assert.equal(Boolean(entry.disabled), false, 'A disabled owner cannot be configured through the native editor.');
      const next = change(structuredClone(entry.options.config));
      writes.push(entry.options.id);
      if (entry === modEntry) {
        for (const key of Object.keys(values)) delete values[key];
        Object.assign(values, next);
      } else entry.options.config = next;
    },
  };
  const agents = { list: () => live, get: id => live.find(agent => agent.id === id) };
  const agentPresets = {
    async compositionInventory() {
      return entries.filter(entry => !entry.disabled && entry.options.name === PRESET).map(entry => ({
        id: entry.options.config.id,
        rows: rows(entry.options.config.plugins).map(row => ({ moduleName: WEB, enabled: !row.disabled })),
      }));
    },
  };
  for (const [name, value] of Object.entries({ configEditor, agents, agentPresets })) root.reflect.provide(name, value);
  const definition = name => defineTool({
    name, description: `Fixture ${name}`, parameters: {},
    output: { schema: { type: 'boolean' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
    async execute() { calls.push(name); return true; },
  });
  const releaseGlobalSearch = tools.register(definition('web_search'));
  tools.register(definition('web_fetch'));
  tools.register(definition(MCP));
  function generation(search = true) {
    const key = {};
    const scope = createScope(root, key);
    if (search) scope.ctx.get('tools').register(definition('web_search'));
    return { key, ...scope };
  }
  // Native edits create newer declarations, but an open Agent can retain this old generation.
  const oldPreset = generation();
  function agent(id, preset = oldPreset, announce = true) {
    const agent = { id };
    const scope = createScope(root, agent, { parent: preset.key });
    Object.assign(agent, { ctx: scope.ctx, scope });
    live.push(agent);
    if (announce) root.emit(scopeTarget(agent, agent), 'agent/created', { agent });
    return agent;
  }
  const existing = agent('existing', oldPreset, false);
  let policy;
  function install(ctx) {
    ctx.fiber.entry = modEntry;
    ctx.effect(() => () => queue.close());
    policy = new SearchPolicy(ctx, { blockOfficialSearch: { get: () => values.blockOfficialSearch } },
      { ensureActive: () => queue.ensureActive() });
    policy.bind(ctx);
  }
  install.inject = ['tools', 'agents', 'agentPresets', 'configEditor'];
  const fiber = await root.plugin(install);
  assert.ok(policy?.context, 'The real Cordis policy context must bind.');
  const scheduler = ToolExecutionPipeline ? new ToolExecutionPipeline(root) : tools[TOOL_RUNTIME_SCHEDULER];
  assert.equal(typeof scheduler?.prepare, 'function');
  async function prepare(name, agent = existing, toolSet) {
    return scheduler.prepare({ name, agent, toolSet, callId: 'search-policy-fixture', arguments: {},
      signal: new AbortController().signal });
  }
  async function invoke(name, agent = existing, toolSet) {
    const prepared = await prepare(name, agent, toolSet);
    const outcome = prepared.kind === 'dispatch' ? await scheduler.dispatch(prepared.exec) : prepared;
    if (ToolExecutionPipeline) return scheduler.complete(prepared.exec, outcome);
    return outcome.kind === 'post-result'
      ? scheduler.finalize(prepared.exec, outcome.result) : scheduler.finish(prepared.exec, outcome.result);
  }
  return { root, tools, policy, queue, fiber, values, modEntry, entries, writes, calls, live,
    configEditor, agentPresets, existing, oldPreset, agent, generation, definition, releaseGlobalSearch, prepare, invoke,
    schemas: (agent = existing, toolSet) => tools.schemas(agent, toolSet).map(schema => schema.name).sort() };
}

test('search toggles independently across active global and nested mode declarations without enabling disabled owners', async t => {
  const app = await fixture(t);
  const before = structuredClone(app.entries);
  const preferences = structuredClone(app.values);
  await app.policy.setBlocked(true);
  assert.equal(app.entries[0].options.config.search, false);
  assert.ok(rows(app.entries[2].options.config.plugins).every(row => row.config.search === false));
  await app.policy.setBlocked(false);
  const expected = structuredClone(before);
  expected[0].options.config.search = true;
  for (const row of rows(expected[2].options.config.plugins)) row.config.search = true;
  assert.deepEqual(app.entries, expected, 'Fetch, disabled children, groups, unrelated modules and metadata must survive both operations.');
  assert.deepEqual(app.values, preferences, 'Account, Todo and all other preferences remain unchanged.');
  assert.ok(app.writes.every(id => ['web-global', 'mode-standard', 'power-dsh'].includes(id)));
});

test('blocking masks old generations and denies dispatch while HTTP fetch and MCP search still execute', async t => {
  const app = await fixture(t);
  assert.equal((await app.invoke('web_search')).isError, false);
  const admitted = typeof app.tools.resolve === 'function'
    ? await app.tools.resolve({ agent: app.existing, signal: new AbortController().signal }) : undefined;
  t.after(() => admitted?.dispose());
  await app.policy.setBlocked(true);
  const later = app.agent('created-after-block');
  for (const agent of [app.existing, later]) {
    const toolSet = agent === app.existing ? admitted : undefined;
    assert.deepEqual(app.schemas(agent, toolSet), [MCP, 'web_fetch']);
    const result = await app.invoke('web_search', agent, toolSet);
    assert.equal(result.isError, true);
    assert.match(result.error.message, /search is disabled/);
    assert.equal((await app.invoke('web_fetch', agent)).isError, false);
    assert.equal((await app.invoke(MCP, agent)).isError, false);
  }
  assert.ok(app.tools.get('web_search', app.oldPreset.key), 'The old generation really remains registered.');
  assert.equal(app.calls.filter(name => name === 'web_search').length, 1);
  await app.policy.setBlocked(false);
  assert.ok(app.schemas().includes('web_search'));
  assert.equal((await app.invoke('web_search')).isError, false);
  assert.equal(app.policy.restrictions.size, 0);
});

test('root guard denies unscoped search even when extensible middleware permits execution', async t => {
  const app = await fixture(t);
  app.root.on('tools/pre-execute', () => ({ kind: 'allow' }));
  await app.policy.setBlocked(true);
  const scheduler = ToolExecutionPipeline ? new ToolExecutionPipeline(app.root) : app.tools[TOOL_RUNTIME_SCHEDULER];
  const prepared = await scheduler.prepare({ name: 'web_search', callId: 'unscoped-search', arguments: {},
    signal: new AbortController().signal });
  assert.equal(prepared.kind, 'post-result');
  assert.match(prepared.result.error.message, /search is disabled/);
  assert.deepEqual(app.calls, []);
});

test('saved flags, settings events, preset changes and pre-step registration synchronize existing and new Agents', async t => {
  const app = await fixture(t, { blocked: true });
  assert.deepEqual(app.schemas(), [MCP, 'web_fetch']);
  assert.deepEqual(app.writes, [], 'Binding restores runtime limits without rewriting profile declarations.');
  app.values.blockOfficialSearch = false;
  app.root.emit('settings/document-updated', 'unrelated');
  assert.ok(!app.schemas().includes('web_search'));
  app.root.emit('settings/document-updated', 'power-dsh');
  assert.ok(app.schemas().includes('web_search'));
  app.values.blockOfficialSearch = true;
  await app.existing.scope.dispose();
  const replacement = createScope(app.root, app.existing);
  Object.assign(app.existing, { ctx: replacement.ctx, scope: replacement });
  app.root.emit('agent-preset/selected', app.existing.id);
  assert.equal(app.policy.restrictions.get(app.existing).context, replacement.ctx);
  app.releaseGlobalSearch();
  const empty = app.generation(false);
  const late = app.agent('late-registration', empty);
  assert.equal(app.policy.restrictions.has(late), false);
  empty.ctx.get('tools').register(app.definition('web_search'));
  let continued = false;
  await app.root.waterfall(scopeTarget(late, late), 'agent/pre-step', { agent: late }, () => {
    continued = true;
    assert.ok(!app.schemas(late).includes('web_search'));
  });
  assert.equal(continued, true);
  app.root.emit(scopeTarget(late, late), 'agent/disposed', { agent: late });
  assert.equal(app.policy.restrictions.has(late), false);
  app.live.splice(app.live.indexOf(late), 1);
  const declarations = structuredClone(app.entries);
  await app.fiber.dispose();
  assert.equal(app.policy.context, null);
  assert.equal(app.policy.restrictions.size, 0);
  assert.ok(app.schemas().includes('web_search'));
  assert.equal((await app.invoke('web_search')).isError, false);
  assert.deepEqual(app.entries, declarations);
});

test('configuration write and readback failures do not save the search flag', async t => {
  for (const fault of ['edit-failed', 'ignored-global', 'changed-mode', 'missing-row', 'flag-write-failed', 'ignored-flag']) {
    const app = await fixture(t);
    const edit = app.configEditor.edit;
    app.configEditor.edit = async (entry, change) => {
      if (fault === 'edit-failed' && entry.options.id === 'mode-standard') throw new Error('Native edit failed');
      if (fault === 'ignored-global' && entry.options.id === 'web-global') return;
      if (fault === 'changed-mode' && entry.options.id === 'mode-standard') return change({ plugins: [] });
      if (fault === 'flag-write-failed' && entry === app.modEntry) throw new Error('Preference write failed');
      if (fault === 'ignored-flag' && entry === app.modEntry) return;
      await edit(entry, change);
      if (fault === 'missing-row' && entry.options.id === 'mode-standard') app.entries.splice(0, 1);
    };
    await assert.rejects(app.policy.setBlocked(true), /failed|changed|did not match/);
    assert.equal(app.values.blockOfficialSearch, false, fault);
    assert.ok(!app.writes.includes('power-dsh'), fault);
  }
});

test('broken, missing or incomplete preset compositions cannot count as successful application', async t => {
  for (const composition of [[], [{ id: 'standard', rows: [] }],
    [{ id: 'standard', broken: 'Mount failed', rows: [{ moduleName: WEB }, { moduleName: WEB }] }]]) {
    const app = await fixture(t);
    app.agentPresets.compositionInventory = async () => composition;
    await assert.rejects(app.policy.setBlocked(true), /mode configuration could not be applied/);
    assert.equal(app.values.blockOfficialSearch, false);
    assert.ok(!app.writes.includes('power-dsh'));
  }
});

test('reapplying skips matching native declarations and reenabling does not invent tools in an old disabled generation', async t => {
  const app = await fixture(t);
  await app.policy.setBlocked(true);
  const nativeWrites = app.writes.filter(id => id !== 'power-dsh').length;
  await app.policy.setBlocked(true);
  assert.equal(app.writes.filter(id => id !== 'power-dsh').length, nativeWrites);
  app.releaseGlobalSearch();
  const openedWhileDisabled = app.agent('disabled-generation', app.generation(false));
  await app.policy.setBlocked(false);
  assert.ok(!app.schemas(openedWhileDisabled).includes('web_search'));
  assert.ok(app.schemas(app.agent('new-generation', app.generation())).includes('web_search'));
});

test('unload cancels edits waiting on native locks and queued operations before later writes', async t => {
  for (const waitingFor of ['mode-standard', 'power-dsh']) {
    const app = await fixture(t);
    const entered = Promise.withResolvers();
    const release = Promise.withResolvers();
    const edit = app.configEditor.edit;
    app.configEditor.edit = async (entry, change) => {
      if (entry.options.id === waitingFor) { entered.resolve(); await release.promise; }
      return edit(entry, change);
    };
    const first = app.queue.run(() => app.policy.setBlocked(true));
    const second = app.queue.run(() => assert.fail('An unloaded queued request ran'));
    await entered.promise;
    await app.fiber.dispose();
    release.resolve();
    await assert.rejects(first, /unloaded/);
    await assert.rejects(second, /unloaded/);
    assert.equal(app.values.blockOfficialSearch, false);
    assert.ok(!app.writes.includes(waitingFor));
  }
});

test('invalid input, unavailable binding and profiles without active target declarations fail before writes', async t => {
  const app = await fixture(t);
  await assert.rejects(app.policy.setBlocked('true'), /boolean/);
  const unbound = new SearchPolicy(app.policy.owner, { blockOfficialSearch: { get: () => false } });
  await assert.rejects(unbound.setBlocked(true), /unavailable/);
  app.entries.splice(0, app.entries.length);
  await assert.rejects(app.policy.setBlocked(true), /No supported built-in search/);
  assert.deepEqual(app.writes, []);
});

test('search RPC accepts only boolean settings and returns the public blocked result', () => {
  assert.equal(SEARCH_RPC.method, 'setSearchBlocked');
  const input = SEARCH_RPC.parameters[0].codec.create();
  const output = SEARCH_RPC.result.create();
  for (const value of [true, false]) {
    assert.equal(input.parse(value), value);
    assert.deepEqual(output.parse({ blocked: value }), { blocked: value });
  }
  for (const invalid of [null, undefined, 0, 'true', {}]) {
    assert.throws(() => input.parse(invalid), /boolean/);
    assert.throws(() => output.parse({ blocked: invalid }), /Invalid policy result/);
  }
});
