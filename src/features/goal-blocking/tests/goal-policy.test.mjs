import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import ToolsService, { defineTool } from '@deepseek-ai/dsh-tools';
import { GoalPolicy } from '../goal-policy.ts';
import { OperationQueue } from '../../../shared/host/operation-queue.ts';

const require = createRequire(import.meta.resolve('@deepseek-ai/dsh-tools'));
const { Context } = await import(require.resolve('@deepseek-ai/cordis'));
const { createScope } = await import(require.resolve('@deepseek-ai/dsh-scope'));
const COMMAND = '@deepseek-ai/dsh-command-goal';
const TOOL = '@deepseek-ai/dsh-tool-goal';
const PRESET = '@deepseek-ai/dsh-agent-preset';
const TOOLS = ['create_goal', 'get_goal', 'update_goal'];
const targets = rows => rows.flatMap(row => [COMMAND, TOOL].includes(row.name) ? [row]
  : row.group === true && Array.isArray(row.config) ? targets(row.config) : []);

async function fixture(t, { blocked = false, preDisabled = false } = {}) {
  const root = new Context();
  t.after(() => root.fiber.dispose());
  root.reflect.provide('systemPrompt', { tools: () => () => {} });
  await root.plugin(ToolsService);
  const tools = root.get('tools');
  const queue = new OperationQueue();
  const writes = [];
  const changed = [];
  const goal = { id: 'existing-goal', revision: 4, phase: 'active', activation: 'armed', roundsStarted: 2 };
  const history = [{ type: 'goal/change', data: structuredClone(goal) }, { type: 'plan/mode', data: { active: true } }];
  const values = { blockGoal: blocked, blockPlan: true, blockTodo: true, showVersion: true,
    notificationSound: 'default', disabledSkills: [{ name: 'review' }] };
  const modEntry = { options: { id: 'power-dsh', config: values } };
  const entries = [{ options: { id: 'preset-standard', name: PRESET, config: {
    id: 'standard', metadata: { keep: true }, plugins: [
      { id: 'command-goal', name: COMMAND, disabled: preDisabled },
      { id: 'goal-group', group: true, isolate: { other: true }, config: [
        { id: 'tool-goal', name: TOOL, disabled: preDisabled, config: { blockedAfterConsecutiveRounds: 5 } },
        { group: true, config: [{ id: 'nested-tool-goal', name: TOOL, disabled: true }] },
        { name: '@example/conditional', disabled: '!!js customCondition', config: { keep: true } },
      ] },
      ...['@deepseek-ai/dsh-goal', '@deepseek-ai/dsh-goal-round-driver', '@deepseek-ai/dsh-client-ui-goal',
        '@deepseek-ai/dsh-plan-mode', '@deepseek-ai/dsh-tool-todo'].map(name => ({ name, disabled: false })),
    ],
  } } }, { options: { id: 'preset-minimal', name: PRESET, config: { id: 'minimal', plugins: [{ name: '@example/other' }] } } },
  { options: { id: 'not-a-preset', name: '@example/plugin', config: { plugins: [{ name: TOOL }] } } }];
  const rows = [
    { entryId: 'global:command', moduleName: COMMAND, enabled: !preDisabled, fiberPhase: preDisabled ? null : 'active' },
    { entryId: 'global:tool', moduleName: TOOL, enabled: false, fiberPhase: null },
    ...['@deepseek-ai/dsh-goal', '@deepseek-ai/dsh-goal-round-driver', '@deepseek-ai/dsh-client-ui-goal',
      '@deepseek-ai/dsh-plan-mode', '@deepseek-ai/dsh-tool-todo', `${TOOL}/other`].map((moduleName, i) => ({
      entryId: `protected:${i}`, moduleName, enabled: true, fiberPhase: 'active',
    })),
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
      assert.ok(row && !id.startsWith('protected:'), 'Goal storage, driver, UI, Plan, and Todo must not reload.');
      row.enabled = enabled;
      row.fiberPhase = enabled ? 'active' : null;
      return { application: 'applied', warnings: [] };
    },
  };
  const agentPresets = {
    async compositionInventory() {
      return entries.filter(entry => entry.options.name === PRESET).map(entry => ({
        id: entry.options.config.id,
        rows: targets(entry.options.config.plugins).map(row => ({ moduleName: row.name, enabled: !row.disabled })),
      }));
    },
  };
  for (const [name, service] of Object.entries({ configEditor, pluginManager, agentPresets })) root.reflect.provide(name, service);
  const definition = name => defineTool({ name, description: `Fixture ${name}`, parameters: {},
    output: { schema: { type: 'boolean' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
    async execute() { return true; },
  });
  for (const name of ['todo_write', 'exit_plan_mode']) tools.register(definition(name));
  function generation(enabled = targets(entries[0].options.config.plugins).some(row => row.name === TOOL && !row.disabled)) {
    const key = {};
    const scope = createScope(root, key);
    if (enabled) for (const name of TOOLS) scope.ctx.get('tools').register(definition(name));
    return { key, ...scope };
  }
  function agent(id, preset) {
    const value = { id, goal, history };
    value.ctx = createScope(root, value, { parent: preset.key }).ctx;
    return value;
  }
  const oldPreset = generation(true);
  const existing = agent('existing', oldPreset);
  let policy;
  function install(ctx) {
    ctx.fiber.entry = modEntry;
    ctx.effect(() => () => queue.close());
    policy = new GoalPolicy(ctx, { blockGoal: { get: () => values.blockGoal } }, { ensureActive: () => queue.ensureActive() });
    policy.bind(ctx);
  }
  install.inject = ['configEditor', 'pluginManager', 'agentPresets'];
  const fiber = await root.plugin(install);
  assert.ok(policy?.context);
  return { root, policy, queue, fiber, entries, rows, values, goal, history, writes, changed, modEntry,
    configEditor, pluginManager, agentPresets, generation, agent, existing, oldPreset,
    schemas: agent => tools.schemas(agent).map(row => row.name).sort() };
}

const inventoryRows = (commandEnabled = false, toolEnabled = false) => [
  { moduleName: COMMAND, enabled: commandEnabled },
  { moduleName: TOOL, enabled: toolEnabled },
  { moduleName: TOOL, enabled: toolEnabled },
];

test('only exact Goal command and tool declarations toggle, preserving continuation, UI, history, Plan, Todo, and preferences', async t => {
  const app = await fixture(t);
  const before = structuredClone({ entries: app.entries, values: app.values, protectedRows: app.rows.slice(2), goal: app.goal, history: app.history });
  await app.policy.setBlocked(true);
  const expected = structuredClone(before.entries);
  for (const row of targets(expected[0].options.config.plugins)) row.disabled = true;
  assert.deepEqual(app.entries, expected);
  assert.ok(app.rows.slice(0, 2).every(row => !row.enabled));
  assert.deepEqual(app.rows.slice(2), before.protectedRows);
  assert.deepEqual(app.values, { ...before.values, blockGoal: true });
  assert.deepEqual(app.goal, before.goal);
  assert.deepEqual(app.history, before.history);
  await app.policy.setBlocked(false);
  for (const row of targets(expected[0].options.config.plugins)) row.disabled = false;
  assert.deepEqual(app.entries, expected);
  assert.ok(app.rows.slice(0, 2).every(row => row.enabled));
  assert.deepEqual(app.rows.slice(2), before.protectedRows);
  assert.deepEqual(app.values, before.values);
  assert.deepEqual(app.goal, before.goal);
});

test('new SDK scopes lose all three Goal tools while live old scopes and their children retain them', async t => {
  const app = await fixture(t);
  const retained = [...TOOLS, 'todo_write', 'exit_plan_mode'].sort();
  assert.deepEqual(app.schemas(app.existing), retained);
  await app.policy.setBlocked(true);
  const fresh = app.agent('fresh', app.generation());
  assert.deepEqual(app.schemas(fresh), ['exit_plan_mode', 'todo_write']);
  assert.deepEqual(app.schemas(app.existing), retained);
  assert.deepEqual(app.schemas(app.agent('old-child', app.oldPreset)), retained);
  assert.equal(app.goal.activation, 'armed');
  await app.policy.setBlocked(false);
  assert.deepEqual(app.schemas(fresh), ['exit_plan_mode', 'todo_write']);
  assert.deepEqual(app.schemas(app.agent('restored', app.generation())), retained);
});

test('binding a saved block installs no Agent, goal mutation, tool, or command listeners and performs no native writes', async t => {
  const app = await fixture(t, { blocked: true });
  const releases = [];
  const passive = new Proxy({ effect: effect => { releases.push(effect()); } }, {
    get(target, key) { assert.equal(key, 'effect'); return target.effect; },
  });
  const policy = new GoalPolicy(app.policy.owner, { blockGoal: { get: () => true } });
  policy.bind(passive);
  assert.deepEqual(app.writes, []);
  assert.deepEqual(app.changed, []);
  assert.equal(app.goal.activation, 'armed');
  for (const release of releases) release();
  assert.equal(policy.context, null);
});

test('unblock enables pre-disabled declarations and reapplying a block preserves the current generation', async t => {
  const app = await fixture(t, { preDisabled: true });
  await app.policy.setBlocked(true);
  assert.deepEqual(app.writes, ['power-dsh']);
  assert.deepEqual(app.changed, []);
  await app.policy.setBlocked(false);
  assert.deepEqual(app.changed, [['global:tool', true], ['global:command', true]]);
  assert.ok(targets(app.entries[0].options.config.plugins).every(row => row.disabled === false));
  await app.policy.setBlocked(true);
  const writes = app.writes.filter(id => id === 'preset-standard').length;
  const changes = app.changed.length;
  await app.policy.setBlocked(true);
  assert.equal(app.writes.filter(id => id === 'preset-standard').length, writes);
  assert.equal(app.changed.length, changes);
});

test('readback counts each module separately and rejects swapped command/tool rows even with unchanged total', async t => {
  for (const rows of [[], inventoryRows().slice(1),
    [{ moduleName: COMMAND, enabled: false }, { moduleName: COMMAND, enabled: false }, { moduleName: TOOL, enabled: false }]]) {
    const app = await fixture(t);
    app.agentPresets.compositionInventory = async () => [{ id: 'standard', rows }];
    await assert.rejects(app.policy.setBlocked(true), /could not be read back/);
    assert.equal(app.values.blockGoal, false);
    assert.deepEqual(app.changed, []);
  }
  const app = await fixture(t);
  app.agentPresets.compositionInventory = async () => [];
  await assert.rejects(app.policy.setBlocked(true), /could not be read back/);
});

test('enabled, conditional, or broken Goal compositions fail but unrelated broken compositions remain irrelevant', async t => {
  for (const fault of ['enabled-command', 'enabled-tool', 'conditional', 'broken']) {
    const app = await fixture(t);
    const rows = inventoryRows(fault === 'enabled-command', fault === 'enabled-tool');
    if (fault === 'conditional') rows[1].enabled = 'conditional';
    app.agentPresets.compositionInventory = async () => [{ id: 'standard', broken: fault === 'broken', rows }];
    await assert.rejects(app.policy.setBlocked(true), /not applied in mode/);
    assert.equal(app.values.blockGoal, false);
    assert.deepEqual(app.changed, []);
  }
  const app = await fixture(t);
  const inventory = app.agentPresets.compositionInventory;
  app.agentPresets.compositionInventory = async () => [...await inventory(), { id: 'other', broken: true, rows: [{ moduleName: '@example/other', enabled: true }] }];
  await app.policy.setBlocked(true);
});

test('a declaration removed while waiting for its edit lock fails before global changes or preference save', async t => {
  const app = await fixture(t);
  app.configEditor.edit = async (_entry, change) => change({ plugins: [] });
  await assert.rejects(app.policy.setBlocked(true), /configuration changed/);
  assert.deepEqual(app.changed, []);
  assert.equal(app.values.blockGoal, false);
});

test('global readback rejects stale state, vanished targets, and active disabled fibers', async t => {
  for (const fault of ['stale', 'missing', 'active']) {
    const app = await fixture(t);
    let reads = 0;
    const list = app.pluginManager.listPlugins;
    app.pluginManager.listPlugins = async () => {
      const rows = await list();
      if (++reads > 1) {
        if (fault === 'stale') rows[0].enabled = true;
        if (fault === 'missing') rows.shift();
        if (fault === 'active') rows[0].fiberPhase = 'active';
      }
      return rows;
    };
    await assert.rejects(app.policy.setBlocked(true), /state did not match/);
    assert.equal(app.values.blockGoal, false);
  }
});

test('unsupported or read-only targets and unsuccessful native application never commit the preference', async t => {
  for (const fault of ['unsupported', 'read-only', 'restart', 'failed', 'warnings']) {
    const app = await fixture(t);
    if (fault === 'unsupported') app.pluginManager.listPlugins = async () => app.rows.slice(2);
    if (fault === 'read-only') app.rows[0].readOnlyReason = 'native policy';
    if (fault === 'restart') app.pluginManager.setPluginEnabled = async () => ({ application: 'restart-required', restartReason: 'restart' });
    if (fault === 'failed') app.pluginManager.setPluginEnabled = async () => ({ application: 'failed' });
    if (fault === 'warnings') app.pluginManager.setPluginEnabled = async () => ({ application: 'applied', warnings: ['partial'] });
    await assert.rejects(app.policy.setBlocked(true), /No supported|cannot be changed|not applied/);
    assert.equal(app.values.blockGoal, false);
  }
});

test('preset and final preference failures stay visible and ignored preference writes fail readback', async t => {
  for (const fault of ['preset', 'preference', 'ignored']) {
    const app = await fixture(t);
    const edit = app.configEditor.edit;
    app.configEditor.edit = async (entry, change) => {
      if (fault === 'preset' || entry === app.modEntry) {
        if (fault === 'ignored') return;
        throw new Error('Write failed');
      }
      return edit(entry, change);
    };
    await assert.rejects(app.policy.setBlocked(true), /Write failed|setting did not match/);
    assert.equal(app.values.blockGoal, false);
    if (fault !== 'preset') assert.ok(app.rows.slice(0, 2).every(row => !row.enabled));
  }
});

test('unload preserves saved declarations, armed existing goals, historical data, and old Agent tools', async t => {
  const app = await fixture(t);
  await app.policy.setBlocked(true);
  const saved = structuredClone({ entries: app.entries, rows: app.rows, values: app.values, goal: app.goal, history: app.history });
  await app.fiber.dispose();
  assert.equal(app.policy.context, null);
  assert.deepEqual({ entries: app.entries, rows: app.rows, values: app.values, goal: app.goal, history: app.history }, saved);
  assert.ok(TOOLS.every(name => app.schemas(app.existing).includes(name)));
  await assert.rejects(app.policy.setBlocked(false), /unloaded/);
});

test('unload fences native callbacks waiting on mode or preference locks and rejects queued writes', async t => {
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
    const second = app.queue.run(() => assert.fail('Queued write ran after unload'));
    await entered.promise;
    await app.fiber.dispose();
    release.resolve();
    await assert.rejects(first, /unloaded/);
    await assert.rejects(second, /unloaded/);
    assert.equal(app.writes.includes(waitingFor), false);
    assert.equal(app.values.blockGoal, false);
  }
});

test('invalid input and unavailable binding fail before native writes', async t => {
  const app = await fixture(t);
  await assert.rejects(app.policy.setBlocked('true'), /boolean/);
  const unbound = new GoalPolicy(app.policy.owner, { blockGoal: { get: () => false } });
  await assert.rejects(unbound.setBlocked(true), /unavailable/);
  assert.deepEqual(app.writes, []);
  assert.deepEqual(app.changed, []);
});
