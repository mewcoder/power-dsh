import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ToolsService, * as toolsSdk from '@deepseek-ai/dsh-tools';
import { TodoPolicy } from '../todo-policy.ts';
import { OperationQueue } from '../../../shared/host/operation-queue.ts';

// Resolve peer dependencies from the SDK so scopes use the registry's own symbols.
const require = createRequire(import.meta.resolve('@deepseek-ai/dsh-tools'));
const { Context } = await import(pathToFileURL(require.resolve('@deepseek-ai/cordis')).href);
const { createScope } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-scope')).href);
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
  const writes = [];
  const changed = [];
  const calls = [];
  const conversation = { messages: [{ role: 'assistant', content: 'Earlier todos' }], todos: [{ text: 'Keep history', status: 'completed' }] };
  const values = {
    showVersion: true, blockOfficialAccount: true, blockOfficialTelemetry: true,
    blockTodo: blocked, blockPlan: true, personalizationEnabled: true, skillManagerEnabled: true,
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
        { name: '@deepseek-ai/dsh-plan-mode', disabled: false, config: { section: 'Keep Plan guidance' } },
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
    { entryId: 'global:plan', moduleName: '@deepseek-ai/dsh-plan-mode', enabled: true, fiberPhase: 'active' },
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
  const agentPresets = {
    async compositionInventory() {
      return entries.filter(entry => entry.options.name === PRESET).map(entry => ({
        id: entry.options.config.id,
        rows: todoRows(entry.options.config.plugins).map(row => ({ moduleName: TODO, enabled: !row.disabled })),
      }));
    },
  };
  for (const [name, value] of Object.entries({ configEditor, pluginManager, agentPresets })) root.reflect.provide(name, value);
  const definition = name => defineTool({
    name, description: `Fixture ${name}`, parameters: {},
    output: { schema: { type: 'boolean' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
    async execute() { calls.push(name); return true; },
  });
  tools.register(definition('unrelated_tool'));
  tools.register(definition('exit_plan_mode'));
  // This generation deliberately stays alive after native configuration edits,
  // just like an already-open session holding an older preset lease.
  function generation({ enabled = todoRows(entries[0].options.config.plugins).some(row => !row.disabled) } = {}) {
    const key = {};
    const scope = createScope(root, key);
    if (enabled) scope.ctx.get('tools').register(definition('todo_write'));
    return { key, ...scope };
  }
  const oldPreset = generation({ enabled: true });
  function agent(id, preset = oldPreset) {
    const agent = { id, conversation };
    const scope = createScope(root, agent, { parent: preset.key });
    agent.ctx = scope.ctx;
    agent.scope = scope;
    return agent;
  }
  const existing = agent('existing', oldPreset);
  let policy;
  function install(ctx) {
    ctx.fiber.entry = modEntry;
    ctx.effect(() => () => queue.close());
    policy = new TodoPolicy(ctx, { blockTodo: { get: () => values.blockTodo } }, { ensureActive: () => queue.ensureActive() });
    policy.bind(ctx);
  }
  install.inject = ['agentPresets', 'configEditor', 'pluginManager'];
  const fiber = await root.plugin(install);
  assert.ok(policy?.context, 'The real Cordis policy context must bind.');
  const pipeline = executionPipeline(root, tools);
  async function prepare(name, ...scope) {
    const agent = scope.length ? scope[0] : existing;
    return pipeline.prepare({ name, agent, callId: 'fixture-call', arguments: {}, signal: new AbortController().signal });
  }
  return {
    root, fiber, policy, tools, queue, entries, modEntry, rows, values, writes, changed, calls,
    configEditor, pluginManager, agentPresets, existing, oldPreset, agent, generation, conversation, prepare,
    async invoke(name, ...scope) {
      const agent = scope.length ? scope[0] : existing;
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

test('old scoped Agents still execute Todo while new top-level conversations use the changed declarations', async t => {
  const app = await fixture(t);
  const withTodo = ['exit_plan_mode', 'todo_write', 'unrelated_tool'];
  const withoutTodo = ['exit_plan_mode', 'unrelated_tool'];
  assert.deepEqual(app.schemas(), withTodo);
  assert.equal((await app.invoke('todo_write')).isError, false);
  // Exercise retained step admission where available; older SDKs read the same live scope directly.
  const admitted = typeof app.tools.resolve === 'function'
    ? await app.tools.resolve({ agent: app.existing, signal: new AbortController().signal }) : undefined;
  t.after(() => admitted?.dispose());
  await app.policy.setBlocked(true);
  assert.ok(app.tools.schemas(app.existing, admitted).some(schema => schema.name === 'todo_write'));
  assert.deepEqual(app.schemas(), withTodo);
  assert.equal((await app.invoke('todo_write')).isError, false, 'Blocking cannot reject dispatch on the old generation.');
  const disabledGeneration = app.generation();
  const fresh = app.agent('new-top-level', disabledGeneration);
  assert.deepEqual(app.schemas(fresh), withoutTodo);
  assert.equal(fresh.ctx.get('tools').get('todo_write', fresh), undefined);
  assert.equal((await app.invoke('todo_write', fresh)).isError, true);
  // Children of an old Agent may inherit its retained generation through native composition.
  const oldChild = app.agent('child-of-old', app.oldPreset);
  assert.deepEqual(app.schemas(oldChild), withTodo);
  assert.equal((await app.invoke('todo_write', oldChild)).isError, false);
  assert.equal((await app.invoke('exit_plan_mode', fresh)).isError, false);
  assert.equal((await app.invoke('unrelated_tool', fresh)).isError, false);
  await app.policy.setBlocked(false);
  assert.deepEqual(app.schemas(fresh), withoutTodo, 'Re-enabling must not replace an already-open disabled generation.');
  assert.equal((await app.invoke('todo_write', fresh)).isError, true);
  const restored = app.agent('after-restore', app.generation());
  assert.deepEqual(app.schemas(restored), withTodo);
  assert.equal((await app.invoke('todo_write', restored)).isError, false);
  assert.deepEqual(app.calls, ['todo_write', 'todo_write', 'todo_write', 'exit_plan_mode', 'unrelated_tool', 'todo_write']);
});

test('blocking does not install a global execution guard over existing unscoped Todo registrations', async t => {
  const app = await fixture(t);
  app.tools.register(app.tools.get('todo_write', app.oldPreset.key));
  await app.policy.setBlocked(true);
  assert.equal((await app.prepare('todo_write', undefined)).kind, 'dispatch');
  assert.equal((await app.invoke('todo_write', undefined)).isError, false);
  assert.deepEqual(app.calls, ['todo_write']);
});

test('binding a saved block uses no Agents, tools, commands, or event listeners and does not rewrite configuration', async t => {
  const app = await fixture(t, { blocked: true });
  const releases = [];
  const passiveContext = new Proxy({ effect: effect => { releases.push(effect()); } }, {
    get(target, key) {
      assert.equal(key, 'effect', `Binding must not access ${String(key)}.`);
      return target.effect;
    },
  });
  const policy = new TodoPolicy(app.policy.owner, { blockTodo: { get: () => true } });
  policy.bind(passiveContext);
  assert.deepEqual(app.schemas(), ['exit_plan_mode', 'todo_write', 'unrelated_tool']);
  assert.equal((await app.invoke('todo_write')).isError, false);
  assert.deepEqual(app.writes, []);
  assert.deepEqual(app.changed, []);
  for (const release of releases) release();
  assert.equal(policy.context, null);
});

test('preset composition readback mismatch or broken composition does not save the flag or mutate globals', async t => {
  for (const composition of [
    [{ id: 'standard', rows: [{ moduleName: TODO, enabled: true }, { moduleName: TODO, enabled: false }] }],
    [{ id: 'standard', rows: [{ moduleName: TODO, enabled: 'conditional' }, { moduleName: TODO, enabled: false }] }],
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

test('unload preserves existing Todo execution, conversation history, and persisted native plugin state', async t => {
  const app = await fixture(t);
  const conversation = structuredClone(app.conversation);
  await app.policy.setBlocked(true);
  const savedRows = structuredClone(app.rows);
  const savedEntries = structuredClone(app.entries);
  await app.fiber.dispose();
  assert.equal(app.policy.context, null);
  assert.deepEqual(app.schemas(), ['exit_plan_mode', 'todo_write', 'unrelated_tool']);
  assert.equal((await app.invoke('todo_write')).isError, false);
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
  for (const composition of [[], [{ id: 'standard', rows: [] }],
    [{ id: 'standard', rows: [{ moduleName: TODO, enabled: false }] }]]) {
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
  assert.deepEqual(app.schemas(), ['exit_plan_mode', 'todo_write']);
  await app.policy.setBlocked(true);
  assert.deepEqual(app.schemas(), ['exit_plan_mode', 'todo_write']);
  assert.equal((await app.invoke('todo_write')).isError, false);
  assert.equal((await app.invoke('unrelated_tool')).isError, true);
  await app.policy.setBlocked(false);
  assert.deepEqual(app.schemas(), ['exit_plan_mode', 'todo_write']);
  releaseOther();
  assert.deepEqual(app.schemas(), ['exit_plan_mode', 'todo_write', 'unrelated_tool']);
});

test('restoring Todo affects later generations without injecting it into an already-open disabled conversation', async t => {
  const app = await fixture(t);
  await app.policy.setBlocked(true);
  const disabledGeneration = app.generation();
  const openedWhileDisabled = app.agent('opened-while-disabled', disabledGeneration);
  assert.deepEqual(app.schemas(openedWhileDisabled), ['exit_plan_mode', 'unrelated_tool']);
  await app.policy.setBlocked(false);
  assert.deepEqual(app.schemas(openedWhileDisabled), ['exit_plan_mode', 'unrelated_tool']);
  assert.equal((await app.invoke('todo_write', openedWhileDisabled)).isError, true);
  const refreshedGeneration = app.generation();
  const later = app.agent('new-generation', refreshedGeneration);
  assert.deepEqual(app.schemas(later), ['exit_plan_mode', 'todo_write', 'unrelated_tool']);
  assert.equal((await app.invoke('todo_write', later)).isError, false);
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
  assert.deepEqual(app.schemas(), ['exit_plan_mode', 'todo_write', 'unrelated_tool']);
  assert.equal((await app.invoke('todo_write')).isError, false);
});

test('unsupported profiles and read-only native targets reject without saving the Todo flag', async t => {
  for (const fault of ['missing', 'read-only']) {
    const app = await fixture(t);
    if (fault === 'missing') app.pluginManager.listPlugins = async () => [];
    else app.rows[0].readOnlyReason = 'native policy';
    await assert.rejects(app.policy.setBlocked(true), fault === 'missing' ? /No supported Todo/ : /cannot be changed/);
    assert.equal(app.values.blockTodo, false);
    assert.deepEqual(app.changed, []);
  }
});

test('invalid input and unavailable binding reject before native writes', async t => {
  const app = await fixture(t);
  await assert.rejects(app.policy.setBlocked('true'), /boolean/);
  const unbound = new TodoPolicy(app.policy.owner, { blockTodo: { get: () => false } });
  await assert.rejects(unbound.setBlocked(true), /unavailable/);
  assert.deepEqual(app.writes, []);
  assert.deepEqual(app.changed, []);
});
