import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import ToolsService, * as toolsSdk from '@deepseek-ai/dsh-tools';
import { TodoPolicy } from '../src/todo-policy.js';
import { OperationQueue } from '../src/operation-queue.js';

// Resolve peer dependencies from the SDK so scopes use the registry's own symbols.
const require = createRequire(import.meta.resolve('@deepseek-ai/dsh-tools'));
const { Context } = await import(require.resolve('@deepseek-ai/cordis'));
const { createScope, scopeTarget } = await import(require.resolve('@deepseek-ai/dsh-scope'));
const TODO = '@deepseek-ai/dsh-tool-todo';
const PRESET = '@deepseek-ai/dsh-agent-preset';
const { defineTool, TOOL_RUNTIME_SCHEDULER } = toolsSdk;
// Older SDKs expose their real scheduler on ToolsService instead of a pipeline subpath.
const { ToolExecutionPipeline } = TOOL_RUNTIME_SCHEDULER === undefined
  ? await import('@deepseek-ai/dsh-tools/pipeline') : {};

function executionPipeline(root, tools) {
  if (ToolExecutionPipeline) return new ToolExecutionPipeline(root);
  const scheduler = tools[TOOL_RUNTIME_SCHEDULER];
  for (const method of ['prepare', 'dispatch', 'finalize', 'finish']) {
    assert.equal(typeof scheduler?.[method], 'function', `The real SDK scheduler must provide ${method}.`);
  }
  return {
    prepare: input => scheduler.prepare(input),
    dispatch: exec => scheduler.dispatch(exec),
    complete: (exec, outcome) => outcome.kind === 'post-result'
      ? scheduler.finalize(exec, outcome.result) : scheduler.finish(exec, outcome.result),
  };
}

function todoRows(plugins) {
  return plugins.flatMap(row => row.name === TODO ? [row]
    : row.group === true && Array.isArray(row.config) ? todoRows(row.config) : []);
}

async function fixture(t, { blocked = false, preDisabled = false } = {}) {
  const root = new Context();
  t.after(() => root.fiber.dispose());
  root.reflect.provide('systemPrompt', { tools: () => () => {} });
  await root.plugin(ToolsService);
  const tools = root.get('tools');
  assert.ok(tools, 'The real ToolsService must start.');
  const queue = new OperationQueue();
  const live = [];
  const writes = [];
  const changed = [];
  const calls = [];
  const conversation = { messages: [{ role: 'assistant', content: 'Earlier todos' }], todos: [{ text: 'Keep history', status: 'completed' }] };
  const values = {
    showVersion: true, blockOfficialAccount: true, blockOfficialTelemetry: true,
    blockTodo: blocked, personalizationEnabled: true, skillManagerEnabled: true,
    mcpManagerEnabled: true, disabledSkills: [{ name: 'review' }], globalPrompt: 'Keep instructions',
  };
  const modEntry = { options: { id: 'power-dsh', config: values } };
  const entries = [
    { options: { id: 'preset-standard', name: PRESET, config: {
      id: 'standard', title: 'Standard', other: { keep: ['native', 'configuration'] },
      plugins: [
        { name: TODO, id: 'todo-direct', disabled: preDisabled, config: { keep: 'todo config' } },
        { group: true, id: 'group', disabled: false, config: [
          { name: '@example/other', disabled: true, config: { keep: true } },
          { group: true, id: 'nested', config: [{ name: TODO, id: 'todo-nested', disabled: true, config: { nested: true } }] },
        ] },
        { name: '@deepseek-ai/dsh-client-ui-conversation', config: { keep: true } },
      ],
    } } },
    { options: { id: 'preset-without-todo', name: PRESET, config: { id: 'without-todo', title: 'No Todo', plugins: [{ name: '@example/other' }] } } },
    { options: { id: 'unrelated', name: '@example/plugin', config: { plugins: [{ name: TODO, disabled: false }] } } },
  ];
  const rows = [
    { entryId: 'global:todo', moduleName: TODO, enabled: !preDisabled, fiberPhase: preDisabled ? null : 'active' },
    { entryId: 'global:todo-disabled', moduleName: TODO, enabled: false, fiberPhase: null },
    { entryId: 'global:conversation', moduleName: '@deepseek-ai/dsh-client-ui-conversation', enabled: true, fiberPhase: 'active' },
    { entryId: 'global:other', moduleName: '@example/todo', enabled: false, fiberPhase: null },
  ];
  const configEditor = {
    entries: () => entries,
    async edit(entry, change) {
      const next = change(structuredClone(entry.options.config));
      writes.push(entry.options.id);
      if (entry === modEntry) {
        for (const key of Object.keys(values)) delete values[key];
        Object.assign(values, next);
      } else entry.options.config = next;
    },
  };
  const pluginManager = {
    async listPlugins() { return structuredClone(rows); },
    async setPluginEnabled(id, enabled) {
      changed.push([id, enabled]);
      const row = rows.find(row => row.entryId === id);
      row.enabled = enabled;
      row.fiberPhase = enabled ? 'active' : null;
      return { application: 'applied', warnings: [] };
    },
  };
  const agents = { list: () => live, get: id => live.find(agent => agent.id === id) };
  const agentPresets = {
    async compositionInventory() {
      return entries.filter(entry => entry.options.name === PRESET).map(entry => ({
        id: entry.options.config.id,
        rows: todoRows(entry.options.config.plugins).map(row => ({ moduleName: TODO, enabled: !row.disabled })),
      }));
    },
  };
  for (const [name, value] of Object.entries({ configEditor, pluginManager, agents, agentPresets })) root.reflect.provide(name, value);
  const definition = name => defineTool({
    name, description: `Fixture ${name}`, parameters: {},
    output: { schema: { type: 'boolean' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
    async execute() { calls.push(name); return true; },
  });
  tools.register(definition('unrelated_tool'));
  // This generation deliberately stays alive after native configuration edits,
  // just like an already-open session holding an older preset lease.
  function generation({ enabled = true } = {}) {
    const key = {};
    const scope = createScope(root, key);
    if (enabled) scope.ctx.get('tools').register(definition('todo_write'));
    return { key, ...scope };
  }
  const oldPreset = generation();
  function agent(id, preset = oldPreset, announce = true) {
    const agent = { id, conversation };
    const scope = createScope(root, agent, { parent: preset.key });
    agent.ctx = scope.ctx;
    agent.scope = scope;
    live.push(agent);
    if (announce) root.emit(scopeTarget(agent, agent), 'agent/created', { agent });
    return agent;
  }
  const existing = agent('existing', oldPreset, false);
  let policy;
  function install(ctx) {
    ctx.fiber.entry = modEntry;
    ctx.effect(() => () => queue.close());
    policy = new TodoPolicy(ctx, { blockTodo: { get: () => values.blockTodo } }, { ensureActive: () => queue.ensureActive() });
    policy.bind(ctx);
  }
  install.inject = ['tools', 'agents', 'agentPresets', 'configEditor', 'pluginManager'];
  const fiber = await root.plugin(install);
  assert.ok(policy?.context, 'The real Cordis policy context must bind.');
  const pipeline = executionPipeline(root, tools);
  async function prepare(name, ...scope) {
    const agent = scope.length ? scope[0] : existing;
    return pipeline.prepare({ name, agent, callId: 'fixture-call', arguments: {}, signal: new AbortController().signal });
  }
  return {
    root, fiber, policy, tools, queue, entries, modEntry, rows, values, writes, changed, calls,
    configEditor, pluginManager, agentPresets, live, existing, oldPreset, agent, generation, conversation, prepare,
    async invoke(name, agent = existing) {
      const prepared = await prepare(name, agent);
      const outcome = prepared.kind === 'dispatch' ? await pipeline.dispatch(prepared.exec) : prepared;
      return pipeline.complete(prepared.exec, outcome);
    },
    schemas(agent = existing) { return tools.schemas(agent).map(schema => schema.name).sort(); },
  };
}

test('native global and nested preset declarations toggle both ways, including originally disabled Todo instances', async t => {
  const app = await fixture(t, { preDisabled: true });
  const beforeValues = structuredClone(app.values);
  const beforeEntries = structuredClone(app.entries);
  const unrelatedRows = structuredClone(app.rows.slice(2));
  const beforeConversation = structuredClone(app.conversation);
  assert.deepEqual(await app.policy.setBlocked(true), { blocked: true });
  assert.ok(app.rows.slice(0, 2).every(row => !row.enabled && row.fiberPhase !== 'active'));
  assert.ok(todoRows(app.entries[0].options.config.plugins).every(row => row.disabled));
  assert.equal(app.values.blockTodo, true);
  assert.deepEqual(await app.policy.setBlocked(false), { blocked: false });
  assert.ok(app.rows.slice(0, 2).every(row => row.enabled));
  assert.ok(todoRows(app.entries[0].options.config.plugins).every(row => row.disabled === false));
  const expected = beforeEntries[0].options.config;
  for (const row of todoRows(expected.plugins)) row.disabled = false;
  assert.deepEqual(app.entries[0].options.config, expected);
  assert.deepEqual(app.entries.slice(1), beforeEntries.slice(1));
  assert.deepEqual(app.rows.slice(2), unrelatedRows);
  assert.deepEqual(app.values, beforeValues);
  assert.deepEqual(app.conversation, beforeConversation);
  assert.ok(app.changed.every(([id]) => id.startsWith('global:todo')));
  // Already-disabled declarations do not need another native preset generation.
  assert.deepEqual(app.writes, ['power-dsh', 'preset-standard', 'power-dsh']);
});

test('existing and newly-created Agents lose Todo schemas on old preset generations, while unrelated tools execute', async t => {
  const app = await fixture(t);
  assert.deepEqual(app.schemas(), ['todo_write', 'unrelated_tool']);
  assert.equal((await app.invoke('todo_write')).isError, false);
  // Exercise retained step admission where available; older SDKs read the same live scope directly.
  const admitted = typeof app.tools.resolve === 'function'
    ? await app.tools.resolve({ agent: app.existing, signal: new AbortController().signal }) : undefined;
  t.after(() => admitted?.dispose());
  assert.ok(app.tools.schemas(app.existing, admitted).some(schema => schema.name === 'todo_write'));
  await app.policy.setBlocked(true);
  assert.ok(app.tools.schemas(app.existing, admitted).every(schema => schema.name !== 'todo_write'));
  const later = app.agent('created-after-block');
  for (const agent of [app.existing, later]) {
    assert.deepEqual(app.schemas(agent), ['unrelated_tool']);
    assert.equal(agent.ctx.get('tools').get('todo_write', agent), undefined);
    const prepared = await app.prepare('todo_write', agent);
    assert.equal(prepared.kind, 'post-result');
    assert.equal(prepared.result.isError, true);
    assert.match(prepared.result.error.message, /Todo is disabled/);
    assert.equal((await app.invoke('unrelated_tool', agent)).isError, false);
  }
  assert.deepEqual(app.calls, ['todo_write', 'unrelated_tool', 'unrelated_tool']);
  assert.ok(app.tools.get('todo_write', app.oldPreset.key), 'The old generation is still registered; the policy must mask it for each Agent.');
  await app.policy.setBlocked(false);
  for (const agent of [app.existing, later]) {
    assert.deepEqual(app.schemas(agent), ['todo_write', 'unrelated_tool']);
    assert.equal((await app.prepare('todo_write', agent)).kind, 'dispatch');
  }
  assert.equal(app.policy.restrictions.size, 0);
});

test('the root guard rejects unscoped Todo dispatch and a permissive pre-execute middleware cannot override it', async t => {
  const app = await fixture(t);
  app.tools.register(app.tools.get('todo_write', app.oldPreset.key));
  assert.equal((await app.prepare('todo_write', undefined)).kind, 'dispatch');
  app.root.on('tools/pre-execute', () => ({ kind: 'allow' }));
  await app.policy.setBlocked(true);
  const result = await app.prepare('todo_write', undefined);
  assert.equal(result.kind, 'post-result');
  assert.match(result.result.error.message, /Todo is disabled/);
  assert.deepEqual(app.calls, []);
  assert.equal((await app.prepare('unrelated_tool')).kind, 'dispatch');
});

test('binding an already blocked flag masks existing Agents without rewriting native configuration', async t => {
  const app = await fixture(t, { blocked: true });
  assert.deepEqual(app.schemas(), ['unrelated_tool']);
  assert.equal((await app.prepare('todo_write')).result.isError, true);
  assert.deepEqual(app.writes, []);
  assert.deepEqual(app.changed, []);
});

test('preset selection replaces restrictions for a changed Agent context; pre-step catches late tool registration', async t => {
  const app = await fixture(t, { blocked: true });
  const previous = app.existing.scope;
  // Replace the context while retaining the Agent's registered scope identity.
  await previous.dispose();
  const replacement = createScope(app.root, app.existing);
  app.existing.ctx = replacement.ctx;
  app.existing.scope = replacement;
  app.root.emit('agent-preset/selected', app.existing.id);
  assert.equal(app.policy.restrictions.get(app.existing).context, replacement.ctx);
  assert.deepEqual(app.schemas(), ['unrelated_tool']);
  const empty = app.generation({ enabled: false });
  const late = app.agent('late', empty);
  assert.equal(app.policy.restrictions.has(late), false);
  empty.ctx.get('tools').register(app.tools.get('todo_write', app.oldPreset.key));
  let continued = false;
  await app.root.waterfall(scopeTarget(late, late), 'agent/pre-step', { agent: late }, () => {
    continued = true;
    assert.deepEqual(app.schemas(late), ['unrelated_tool'], 'The restriction must exist before downstream step preparation.');
  });
  assert.equal(continued, true);
  assert.deepEqual(app.schemas(late), ['unrelated_tool']);
});

test('settings document updates resync only this Mod namespace and disposal releases restrictions', async t => {
  const app = await fixture(t);
  app.values.blockTodo = true;
  app.root.emit('settings/document-updated', 'other-plugin');
  assert.ok(app.schemas().includes('todo_write'));
  app.root.emit('settings/document-updated', 'power-dsh');
  assert.deepEqual(app.schemas(), ['unrelated_tool']);
  const size = app.policy.restrictions.size;
  app.root.emit(scopeTarget(app.existing, app.existing), 'agent/disposed', { agent: app.existing });
  assert.equal(app.policy.restrictions.size, size - 1);
  assert.ok(app.schemas().includes('todo_write'));
  app.live.splice(app.live.indexOf(app.existing), 1);
  const other = app.agent('other');
  assert.deepEqual(app.schemas(other), ['unrelated_tool']);
  app.values.blockTodo = false;
  app.root.emit('settings/document-updated', 'power-dsh');
  assert.ok(app.schemas(other).includes('todo_write'));
  assert.equal(app.policy.restrictions.size, 0);
});

test('preset composition readback mismatch or broken composition does not save the flag or mutate globals', async t => {
  for (const composition of [
    [{ id: 'standard', rows: [{ moduleName: TODO, enabled: true }, { moduleName: TODO, enabled: false }] }],
    [{ id: 'standard', broken: true, rows: [{ moduleName: TODO, enabled: false }, { moduleName: TODO, enabled: false }] }],
  ]) {
    const app = await fixture(t);
    app.agentPresets.compositionInventory = async () => composition;
    await assert.rejects(app.policy.setBlocked(true), /not applied in mode/);
    assert.equal(app.values.blockTodo, false);
    assert.deepEqual(app.changed, []);
    assert.deepEqual(app.writes, ['preset-standard']);
  }
});

test('a preset removed while waiting for the native edit lock fails without committing the flag', async t => {
  const app = await fixture(t);
  app.configEditor.edit = async (entry, change) => {
    if (entry !== app.modEntry) change({ plugins: [] });
    else assert.fail('Mod flag must not be saved');
  };
  await assert.rejects(app.policy.setBlocked(true), /configuration changed/);
  assert.equal(app.values.blockTodo, false);
  assert.deepEqual(app.changed, []);
});

test('global readback mismatch, active disabled fiber, or missing target prevents saving blockTodo', async t => {
  for (const fault of ['stale', 'active', 'missing']) {
    const app = await fixture(t);
    let reads = 0;
    const list = app.pluginManager.listPlugins;
    app.pluginManager.listPlugins = async () => {
      const rows = await list();
      if (++reads > 1) {
        if (fault === 'stale') rows[0].enabled = true;
        if (fault === 'active') rows[0].fiberPhase = 'active';
        if (fault === 'missing') rows.shift();
      }
      return rows;
    };
    await assert.rejects(app.policy.setBlocked(true), /state did not match/);
    assert.equal(app.values.blockTodo, false);
    assert.deepEqual(app.writes, ['preset-standard']);
  }
});

test('native application failures and preference-save failures remain visible without pretending to commit', async t => {
  for (const failure of [
    { application: 'restart-required', restartReason: 'needs restart' },
    { application: 'failed', error: { diagnostic: 'native rejected' } },
    { application: 'applied', warnings: ['not fully applied'] },
  ]) {
    const app = await fixture(t);
    app.pluginManager.setPluginEnabled = async () => failure;
    await assert.rejects(app.policy.setBlocked(true), /Todo change was not applied/);
    assert.equal(app.values.blockTodo, false);
  }
  const app = await fixture(t);
  const edit = app.configEditor.edit;
  app.configEditor.edit = async (entry, change) => {
    if (entry === app.modEntry) throw new Error('Preference disk write failed');
    return edit(entry, change);
  };
  await assert.rejects(app.policy.setBlocked(true), /Preference disk write failed/);
  assert.equal(app.values.blockTodo, false);
  assert.ok(app.rows.slice(0, 2).every(row => !row.enabled), 'Native changes can persist even if the final preference save fails.');
});

test('unload removes guards, scoped restrictions and listeners without changing conversation or persisted plugin state', async t => {
  const app = await fixture(t);
  const conversation = structuredClone(app.conversation);
  await app.policy.setBlocked(true);
  const savedRows = structuredClone(app.rows);
  const savedEntries = structuredClone(app.entries);
  await app.fiber.dispose();
  assert.equal(app.policy.context, null);
  assert.equal(app.policy.restrictions.size, 0);
  assert.deepEqual(app.schemas(), ['todo_write', 'unrelated_tool']);
  assert.equal((await app.prepare('todo_write')).kind, 'dispatch');
  const after = app.agent('after-unload');
  app.root.emit('settings/document-updated', 'power-dsh');
  app.root.emit('agent-preset/selected', after.id);
  assert.deepEqual(app.schemas(after), ['todo_write', 'unrelated_tool']);
  assert.equal(app.policy.restrictions.size, 0);
  assert.deepEqual(app.rows, savedRows);
  assert.deepEqual(app.entries, savedEntries);
  assert.deepEqual(app.conversation, conversation);
  await assert.rejects(app.policy.setBlocked(false), /unloaded/);
});

test('unload cancels native preset and preference callbacks waiting on locks and queued requests', async t => {
  for (const waitingFor of ['preset-standard', 'power-dsh']) {
    const app = await fixture(t);
    const entered = Promise.withResolvers();
    const release = Promise.withResolvers();
    const edit = app.configEditor.edit;
    app.configEditor.edit = async (entry, change) => {
      if (entry.options.id === waitingFor) { entered.resolve(); await release.promise; }
      return edit(entry, change);
    };
    const first = app.queue.run(() => app.policy.setBlocked(true));
    const second = app.queue.run(() => assert.fail('Queued request ran after unload'));
    await entered.promise;
    await app.fiber.dispose();
    release.resolve();
    await assert.rejects(first, /unloaded/);
    await assert.rejects(second, /unloaded/);
    assert.equal(app.values.blockTodo, false);
    assert.equal(app.writes.includes(waitingFor), false);
  }
});

test('a missing preset composition or Todo row cannot count as successful readback', async t => {
  for (const composition of [[], [{ id: 'standard', rows: [] }]]) {
    const app = await fixture(t);
    app.agentPresets.compositionInventory = async () => composition;
    await assert.rejects(app.policy.setBlocked(true), /Todo.*(mode|configuration|readback|state|applied)/i);
    assert.equal(app.values.blockTodo, false);
    assert.deepEqual(app.changed, []);
    assert.deepEqual(app.writes, ['preset-standard']);
  }
});

test('unrelated broken compositions and other plugins restrictions survive a complete toggle', async t => {
  const app = await fixture(t);
  const inventory = app.agentPresets.compositionInventory;
  app.agentPresets.compositionInventory = async () => [
    ...await inventory(), { id: 'unrelated-broken', broken: true, rows: [{ moduleName: '@example/other', enabled: false }] },
  ];
  const releaseOther = app.existing.ctx.get('tools').restrict({ deny: ['unrelated_tool'] });
  assert.deepEqual(app.schemas(), ['todo_write']);
  await app.policy.setBlocked(true);
  assert.deepEqual(app.schemas(), []);
  await app.policy.setBlocked(false);
  assert.deepEqual(app.schemas(), ['todo_write']);
  releaseOther();
  assert.deepEqual(app.schemas(), ['todo_write', 'unrelated_tool']);
});

test('re-enabling releases restrictions but does not invent a tool in an already-open disabled generation', async t => {
  const app = await fixture(t);
  await app.policy.setBlocked(true);
  const disabledGeneration = app.generation({ enabled: false });
  const openedWhileDisabled = app.agent('opened-while-disabled', disabledGeneration);
  assert.deepEqual(app.schemas(openedWhileDisabled), ['unrelated_tool']);
  await app.policy.setBlocked(false);
  assert.equal(app.policy.restrictions.has(openedWhileDisabled), false);
  assert.deepEqual(app.schemas(openedWhileDisabled), ['unrelated_tool']);
  const refreshedGeneration = app.generation();
  assert.deepEqual(app.schemas(app.agent('new-generation', refreshedGeneration)), ['todo_write', 'unrelated_tool']);
});

test('preset-save failure and ignored preference writes report failure explicitly', async t => {
  const presetFailure = await fixture(t);
  presetFailure.configEditor.edit = async () => { throw new Error('Preset disk write failed'); };
  await assert.rejects(presetFailure.policy.setBlocked(true), /Preset disk write failed/);
  assert.deepEqual(presetFailure.changed, []);
  assert.equal(presetFailure.values.blockTodo, false);
  const ignoredFlag = await fixture(t);
  const edit = ignoredFlag.configEditor.edit;
  ignoredFlag.configEditor.edit = async (entry, change) => {
    if (entry !== ignoredFlag.modEntry) return edit(entry, change);
  };
  await assert.rejects(ignoredFlag.policy.setBlocked(true), /setting did not match/);
  assert.equal(ignoredFlag.values.blockTodo, false);
});

test('unload during an in-flight global update stops later native calls and the preference write', async t => {
  const app = await fixture(t);
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  const toggle = app.pluginManager.setPluginEnabled;
  app.pluginManager.setPluginEnabled = async (...args) => {
    entered.resolve();
    await release.promise;
    return toggle(...args);
  };
  const operation = app.policy.setBlocked(true);
  await entered.promise;
  await app.fiber.dispose();
  release.resolve();
  await assert.rejects(operation, /unloaded/);
  assert.equal(app.changed.length, 1);
  assert.equal(app.values.blockTodo, false);
  assert.deepEqual(app.writes, ['preset-standard']);
});

test('reapplying a block does not rewrite matching preset declarations or change native plugins again', async t => {
  const app = await fixture(t);
  await app.policy.setBlocked(true);
  const presetWrites = app.writes.filter(id => id === 'preset-standard').length;
  const nativeChanges = app.changed.length;
  await app.policy.setBlocked(true);
  assert.equal(app.writes.filter(id => id === 'preset-standard').length, presetWrites);
  assert.equal(app.changed.length, nativeChanges);
  assert.equal(app.values.blockTodo, true);
  assert.deepEqual(app.schemas(), ['unrelated_tool']);
});

test('invalid input and unavailable binding reject before native writes', async t => {
  const app = await fixture(t);
  await assert.rejects(app.policy.setBlocked('true'), /boolean/);
  const unbound = new TodoPolicy(app.policy.owner, { blockTodo: { get: () => false } });
  await assert.rejects(unbound.setBlocked(true), /unavailable/);
  assert.deepEqual(app.writes, []);
  assert.deepEqual(app.changed, []);
});
