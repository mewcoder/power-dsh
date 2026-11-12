import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ToolsService, { defineTool } from '@deepseek-ai/dsh-tools';
import { PlanPolicy } from '../plan-policy.ts';
import { OperationQueue } from '../../../shared/host/operation-queue.ts';

// Resolve peers from Tools so real Cordis scopes share the SDK's registry symbols.
const require = createRequire(import.meta.resolve('@deepseek-ai/dsh-tools'));
const { Context } = await import(pathToFileURL(require.resolve('@deepseek-ai/cordis')).href);
const { createScope } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-scope')).href);
const PLAN = '@deepseek-ai/dsh-plan-mode';
const PRESET = '@deepseek-ai/dsh-agent-preset';
const TODO = '@deepseek-ai/dsh-tool-todo';

function planRows(rows) {
  return rows.flatMap(row => row.name === PLAN ? [row]
    : row.group === true && Array.isArray(row.config) ? planRows(row.config) : []);
}

async function fixture(t, { blocked = false, preDisabled = false } = {}) {
  const root = new Context();
  t.after(() => root.fiber.dispose());
  root.reflect.provide('systemPrompt', { tools: () => () => {} });
  await root.plugin(ToolsService);
  const tools = root.get('tools');
  assert.ok(tools, 'The installed Tools SDK must activate.');
  const queue = new OperationQueue();
  const writes = [];
  const changed = [];
  const history = [{ type: 'plan/mode', data: { active: true } }, {
    type: 'tool/call', data: { name: 'exit_plan_mode', arguments: { plan: '# Earlier plan\nKeep this card.' } },
  }, { type: 'todo/write', data: { todos: [{ text: 'Keep Todo history', status: 'completed' }] } }];
  const values = { blockPlan: blocked, blockTodo: true, showVersion: true, globalPrompt: 'Keep instructions',
    notificationSoundEnabled: false, disabledSkills: [{ name: 'review' }] };
  const modEntry = { options: { id: 'power-dsh', config: values } };
  const entries = [{ options: { id: 'preset-standard', name: PRESET, config: {
    id: 'standard', name: 'Custom standard', order: 5, metadata: { keep: ['native'] },
    plugins: [
      { id: 'direct-plan', name: PLAN, disabled: preDisabled, config: { section: 'Custom plan guidance' } },
      { id: 'planning', name: 'cordis:group', group: true, isolate: { planMode: true }, config: [
        { id: 'other', name: '@example/other', disabled: "!!js !ctx.get('optional')", config: { keep: true } },
        { id: 'nested', group: true, config: [
          { id: 'nested-plan', name: PLAN, disabled: true, config: { section: 'Nested guidance' } },
        ] },
      ] },
      { id: 'todo', name: TODO, disabled: false, config: { allowParallelInProgress: true } },
      { name: '@deepseek-ai/dsh-client-ui-plan', config: { keep: 'history renderer' } },
    ],
  } } }, { options: { id: 'preset-minimal', name: PRESET, config: {
    id: 'minimal', plugins: [{ name: TODO, disabled: true }],
  } } }, { options: { id: 'not-a-preset', name: '@example/plugin', config: {
    plugins: [{ name: PLAN, disabled: false }],
  } } }];
  const rows = [
    { entryId: 'global:plan', moduleName: PLAN, enabled: !preDisabled, fiberPhase: preDisabled ? null : 'active' },
    { entryId: 'global:default-disabled-plan', moduleName: PLAN, enabled: false, fiberPhase: null },
    { entryId: 'global:ui-plan', moduleName: '@deepseek-ai/dsh-client-ui-plan', enabled: true, fiberPhase: 'active' },
    { entryId: 'global:todo', moduleName: TODO, enabled: false, fiberPhase: null },
    { entryId: 'global:similar', moduleName: `${PLAN}/other`, enabled: true, fiberPhase: 'active' },
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
        rows: planRows(entry.options.config.plugins).map(row => ({ moduleName: PLAN, enabled: !row.disabled })),
      }));
    },
  };
  for (const [name, value] of Object.entries({ configEditor, pluginManager, agentPresets })) root.reflect.provide(name, value);
  const definition = name => defineTool({
    name, description: `Fixture ${name}`, parameters: {},
    output: { schema: { type: 'boolean' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
    async execute() { return true; },
  });
  tools.register(definition('todo_write'));
  function generation(enabled = planRows(entries[0].options.config.plugins).some(row => !row.disabled)) {
    const key = {};
    const scope = createScope(root, key);
    if (enabled) scope.ctx.get('tools').register(definition('exit_plan_mode'));
    return { key, ...scope };
  }
  function agent(id, preset) {
    const agent = { id, history };
    agent.ctx = createScope(root, agent, { parent: preset.key }).ctx;
    return agent;
  }
  const oldPreset = generation(true);
  const existing = agent('existing', oldPreset);
  let policy;
  function install(ctx) {
    ctx.fiber.entry = modEntry;
    ctx.effect(() => () => queue.close());
    policy = new PlanPolicy(ctx, { blockPlan: { get: () => values.blockPlan } }, { ensureActive: () => queue.ensureActive() });
    policy.bind(ctx);
  }
  install.inject = ['configEditor', 'pluginManager', 'agentPresets'];
  const fiber = await root.plugin(install);
  assert.ok(policy?.context);
  return { root, tools, policy, fiber, queue, entries, rows, values, history, writes, changed, modEntry,
    configEditor, pluginManager, agentPresets, existing, oldPreset, generation, agent,
    schemas: agent => tools.schemas(agent).map(row => row.name).sort() };
}

test('native global and nested Plan declarations toggle without changing Todo, UI history, or other configuration', async t => {
  const app = await fixture(t);
  const beforeEntries = structuredClone(app.entries);
  const beforeValues = structuredClone(app.values);
  const beforeRows = structuredClone(app.rows.slice(2));
  const beforeHistory = structuredClone(app.history);
  assert.deepEqual(await app.policy.setBlocked(true), { blocked: true });
  assert.ok(planRows(app.entries[0].options.config.plugins).every(row => row.disabled === true));
  assert.ok(app.rows.slice(0, 2).every(row => !row.enabled && row.fiberPhase !== 'active'));
  const expected = structuredClone(beforeEntries);
  for (const row of planRows(expected[0].options.config.plugins)) row.disabled = true;
  assert.deepEqual(app.entries, expected);
  assert.deepEqual(app.values, { ...beforeValues, blockPlan: true });
  assert.deepEqual(app.rows.slice(2), beforeRows);
  assert.deepEqual(app.history, beforeHistory);
  assert.deepEqual(await app.policy.setBlocked(false), { blocked: false });
  for (const row of planRows(expected[0].options.config.plugins)) row.disabled = false;
  assert.deepEqual(app.entries, expected);
  assert.ok(app.rows.slice(0, 2).every(row => row.enabled));
  assert.deepEqual(app.values, beforeValues);
  assert.deepEqual(app.history, beforeHistory);
  assert.ok(app.changed.every(([id]) => id === 'global:plan' || id === 'global:default-disabled-plan'));
});

test('existing scoped Agents retain Plan while new top-level conversations use the changed declarations', async t => {
  const app = await fixture(t);
  assert.deepEqual(app.schemas(app.existing), ['exit_plan_mode', 'todo_write']);
  await app.policy.setBlocked(true);
  const disabledPreset = app.generation();
  const fresh = app.agent('fresh', disabledPreset);
  assert.deepEqual(app.schemas(fresh), ['todo_write']);
  assert.deepEqual(app.schemas(app.existing), ['exit_plan_mode', 'todo_write']);
  // Native child composition inherits the parent's retained generation, not the latest declaration.
  assert.deepEqual(app.schemas(app.agent('child-of-existing', app.oldPreset)), ['exit_plan_mode', 'todo_write']);
  await app.policy.setBlocked(false);
  assert.deepEqual(app.schemas(fresh), ['todo_write'], 'Re-enabling does not replace an already-open generation.');
  assert.deepEqual(app.schemas(app.agent('after-restore', app.generation())), ['exit_plan_mode', 'todo_write']);
});

test('binding a saved block does not enumerate Agents or install guards, restrictions, commands, or listeners', async t => {
  const app = await fixture(t, { blocked: true });
  const releases = [];
  const passiveContext = new Proxy({ effect: effect => { releases.push(effect()); } }, {
    get(target, key) {
      assert.equal(key, 'effect', `Binding must not access ${String(key)}.`);
      return target.effect;
    },
  });
  const policy = new PlanPolicy(app.policy.owner, { blockPlan: { get: () => true } });
  policy.bind(passiveContext);
  assert.deepEqual(app.schemas(app.existing), ['exit_plan_mode', 'todo_write']);
  assert.deepEqual(app.writes, []);
  assert.deepEqual(app.changed, []);
  for (const release of releases) release();
  assert.equal(policy.context, null);
});

test('restoring Plan enables originally disabled global and preset declarations, without a restore snapshot', async t => {
  const app = await fixture(t, { preDisabled: true });
  await app.policy.setBlocked(true);
  assert.deepEqual(app.changed, []);
  assert.deepEqual(app.writes, ['power-dsh']);
  await app.policy.setBlocked(false);
  assert.deepEqual(app.changed, [['global:default-disabled-plan', true], ['global:plan', true]]);
  assert.ok(planRows(app.entries[0].options.config.plugins).every(row => row.disabled === false));
  assert.deepEqual(app.writes, ['power-dsh', 'preset-standard', 'power-dsh']);
});

test('reapplying a block leaves matching preset generations and native plugin state alone', async t => {
  const app = await fixture(t);
  await app.policy.setBlocked(true);
  const changes = structuredClone(app.changed);
  const presetWrites = app.writes.filter(id => id === 'preset-standard').length;
  await app.policy.setBlocked(true);
  assert.deepEqual(app.changed, changes);
  assert.equal(app.writes.filter(id => id === 'preset-standard').length, presetWrites);
  assert.equal(app.values.blockPlan, true);
});

test('missing or stale preset inventory rows cannot count as successful readback', async t => {
  for (const composition of [[], [{ id: 'standard', rows: [] }],
    [{ id: 'standard', rows: [{ moduleName: PLAN, enabled: false }] }]]) {
    const app = await fixture(t);
    app.agentPresets.compositionInventory = async () => composition;
    await assert.rejects(app.policy.setBlocked(true), /could not be read back/);
    assert.equal(app.values.blockPlan, false);
    assert.deepEqual(app.changed, []);
    assert.deepEqual(app.writes, ['preset-standard']);
  }
});

test('enabled, conditional, and broken Plan compositions reject while unrelated broken presets remain irrelevant', async t => {
  for (const fault of ['enabled', 'conditional', 'broken']) {
    const app = await fixture(t);
    app.agentPresets.compositionInventory = async () => [{ id: 'standard', broken: fault === 'broken', rows: [
      { moduleName: PLAN, enabled: fault === 'conditional' ? 'conditional' : fault === 'enabled' },
      { moduleName: PLAN, enabled: false },
    ] }];
    await assert.rejects(app.policy.setBlocked(true), /not applied in mode: standard/);
    assert.equal(app.values.blockPlan, false);
    assert.deepEqual(app.changed, []);
  }
  const app = await fixture(t);
  const inventory = app.agentPresets.compositionInventory;
  app.agentPresets.compositionInventory = async () => [...await inventory(), {
    id: 'unrelated-broken', broken: true, rows: [{ moduleName: TODO, enabled: true }],
  }];
  await app.policy.setBlocked(true);
  assert.equal(app.values.blockPlan, true);
});

test('a Plan declaration removed before the native edit callback rejects without saving the preference', async t => {
  const app = await fixture(t);
  app.configEditor.edit = async (_entry, change) => change({ plugins: [] });
  await assert.rejects(app.policy.setBlocked(true), /configuration changed/);
  assert.equal(app.values.blockPlan, false);
  assert.deepEqual(app.changed, []);
});

test('global readback rejects stale enabled state, a still-active disabled fiber, and vanished targets', async t => {
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
    assert.equal(app.values.blockPlan, false);
    assert.deepEqual(app.writes, ['preset-standard']);
  }
});

test('unsupported profiles and read-only global targets fail visibly instead of saving blockPlan', async t => {
  for (const fault of ['missing', 'read-only']) {
    const app = await fixture(t);
    if (fault === 'missing') app.pluginManager.listPlugins = async () => [];
    else app.rows[0].readOnlyReason = 'native policy';
    await assert.rejects(app.policy.setBlocked(true), fault === 'missing' ? /No supported Plan mode/ : /cannot be changed/);
    assert.equal(app.values.blockPlan, false);
    assert.deepEqual(app.changed, []);
  }
});

test('native restart requirements, failures, and warnings prevent the preference from reporting success', async t => {
  for (const result of [
    { application: 'restart-required', restartReason: 'needs restart' },
    { application: 'failed', error: { diagnostic: 'native rejected' } },
    { application: 'applied', warnings: ['not fully applied'] },
  ]) {
    const app = await fixture(t);
    app.pluginManager.setPluginEnabled = async () => result;
    await assert.rejects(app.policy.setBlocked(true), /Plan mode change was not applied/);
    assert.equal(app.values.blockPlan, false);
    assert.deepEqual(app.writes, ['preset-standard']);
  }
});

test('preset-save and final preference-save failures stay visible, retaining native changes already applied', async t => {
  const presetFailure = await fixture(t);
  presetFailure.configEditor.edit = async () => { throw new Error('Preset write failed'); };
  await assert.rejects(presetFailure.policy.setBlocked(true), /Preset write failed/);
  assert.deepEqual(presetFailure.changed, []);
  const app = await fixture(t);
  const edit = app.configEditor.edit;
  app.configEditor.edit = async (entry, change) => {
    if (entry === app.modEntry) throw new Error('Preference write failed');
    return edit(entry, change);
  };
  await assert.rejects(app.policy.setBlocked(true), /Preference write failed/);
  assert.equal(app.values.blockPlan, false);
  assert.ok(app.rows.slice(0, 2).every(row => !row.enabled));
  assert.ok(planRows(app.entries[0].options.config.plugins).every(row => row.disabled));
});

test('an ignored preference save fails readback instead of returning the requested setting', async t => {
  const app = await fixture(t);
  const edit = app.configEditor.edit;
  app.configEditor.edit = async (entry, change) => {
    if (entry !== app.modEntry) return edit(entry, change);
  };
  await assert.rejects(app.policy.setBlocked(true), /setting did not match/);
  assert.equal(app.values.blockPlan, false);
});

test('unload leaves saved declarations, history, and existing Agent tools intact', async t => {
  const app = await fixture(t);
  await app.policy.setBlocked(true);
  const saved = structuredClone({ rows: app.rows, entries: app.entries, values: app.values, history: app.history });
  await app.fiber.dispose();
  assert.equal(app.policy.context, null);
  assert.deepEqual({ rows: app.rows, entries: app.entries, values: app.values, history: app.history }, saved);
  assert.deepEqual(app.schemas(app.existing), ['exit_plan_mode', 'todo_write']);
  await assert.rejects(app.policy.setBlocked(false), /unloaded/);
});

test('unload invalidates preset and preference callbacks waiting on native write locks, and queued operations', async t => {
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
    assert.equal(app.values.blockPlan, false);
    assert.equal(app.writes.includes(waitingFor), false);
  }
});

test('invalid input and an unbound policy fail before native writes', async t => {
  const app = await fixture(t);
  await assert.rejects(app.policy.setBlocked('true'), /boolean/);
  const unbound = new PlanPolicy(app.policy.owner, { blockPlan: { get: () => false } });
  await assert.rejects(unbound.setBlocked(true), /unavailable/);
  assert.deepEqual(app.writes, []);
  assert.deepEqual(app.changed, []);
});
