import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AccountPolicy } from '../account-policy.js';
import { ACCOUNT_RPC } from '../rpc.js';
import { OperationQueue } from '../operation-queue.js';

function setup({ preDisabled = false } = {}) {
  const rows = [
    { entryId: 'include:account-ui', moduleName: '@deepseek-ai/dsh-client-ui-settings-account', enabled: !preDisabled },
    { entryId: 'include:account-models', moduleName: '@deepseek-ai/dsh-llm-deepseek-account', enabled: true },
    { entryId: 'include:llm-deepseek', patchId: 'llm-deepseek', moduleName: '@deepseek-ai/dsh-llm-deepseek-api-key', enabled: true },
    { entryId: 'include:own-key', patchId: 'own-key', moduleName: '@deepseek-ai/dsh-llm-deepseek-api-key', enabled: true },
    { entryId: 'include:third-party', moduleName: '@example/provider', enabled: true },
  ];
  const values = { showVersion: true, blockOfficialAccount: false };
  const queue = new OperationQueue();
  const changed = [];
  const ctx = {
    fiber: { entry: { options: { id: 'mod', config: values } } },
    configEditor: {
      async edit(_entry, change) {
        const next = change(structuredClone(values));
        for (const key of Object.keys(values)) delete values[key];
        Object.assign(values, next);
      },
    },
    pluginManager: {
      async listPlugins() { return structuredClone(rows); },
      async setPluginEnabled(id, enabled) {
        changed.push([id, enabled]);
        const row = rows.find(entry => entry.entryId === id);
        row.enabled = enabled;
        row.fiberPhase = enabled ? 'active' : null;
        return { application: 'applied', warnings: [] };
      },
    },
  };
  return { rows, values, ctx, queue, changed, policy: new AccountPolicy(ctx, { ensureActive: () => queue.ensureActive() }) };
}

test('block disables account targets and unblock enables them, including previously disabled ones', async () => {
  const app = setup({ preDisabled: true });
  await app.policy.setBlocked(true);
  assert.ok(app.rows.slice(0, 3).every(row => !row.enabled));
  assert.ok(app.rows.slice(3).every(row => row.enabled));
  await app.policy.setBlocked(false);
  assert.ok(app.rows.every(row => row.enabled));
  assert.deepEqual(app.values, { showVersion: true, blockOfficialAccount: false });
  assert.ok(app.changed.every(([id]) => !['include:own-key', 'include:third-party'].includes(id)));
});

test('one queue serializes opposite requests and reapplying a block is idempotent', async () => {
  const app = setup();
  await Promise.all([
    app.queue.run(() => app.policy.setBlocked(true)),
    app.queue.run(() => app.policy.setBlocked(false)),
  ]);
  assert.ok(app.rows.every(row => row.enabled));
  await app.policy.setBlocked(true);
  app.changed.length = 0;
  await app.policy.setBlocked(true);
  assert.deepEqual(app.changed, []);
});

test('native errors identify the failed target and a retry finishes the requested operation', async () => {
  const app = setup();
  const toggle = app.ctx.pluginManager.setPluginEnabled;
  app.ctx.pluginManager.setPluginEnabled = async (id, enabled) => id === 'include:account-models'
    ? { application: 'failed', error: { diagnostic: 'profile rejects the change' } }
    : toggle(id, enabled);
  await assert.rejects(app.policy.setBlocked(true), /include:account-models.*profile rejects the change/);
  assert.equal(app.values.blockOfficialAccount, false);
  app.ctx.pluginManager.setPluginEnabled = toggle;
  await app.policy.setBlocked(true);
  assert.ok(app.rows.slice(0, 3).every(row => !row.enabled));
  assert.equal(app.values.blockOfficialAccount, true);
});

test('restart-required does not commit the requested flag', async () => {
  const app = setup();
  app.ctx.pluginManager.setPluginEnabled = async () => ({ application: 'restart-required' });
  await assert.rejects(app.policy.setBlocked(true), /restart-required/);
  assert.equal(app.values.blockOfficialAccount, false);
});

test('unload stops subsequent native calls', async () => {
  const app = setup();
  const toggle = app.ctx.pluginManager.setPluginEnabled;
  app.ctx.pluginManager.setPluginEnabled = async (...args) => {
    const result = await toggle(...args);
    app.queue.close();
    return result;
  };
  await assert.rejects(app.policy.setBlocked(true), /unloaded/);
  assert.equal(app.changed.length, 1);
  assert.equal(app.values.blockOfficialAccount, false);
});

test('a write waiting for the native lock cannot commit after unload', async () => {
  const app = setup();
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  app.ctx.configEditor.edit = async (_entry, change) => {
    entered.resolve();
    await release.promise;
    Object.assign(app.values, change(structuredClone(app.values)));
  };
  const task = app.policy.setBlocked(true);
  await entered.promise;
  app.queue.close();
  release.resolve();
  await assert.rejects(task, /unloaded/);
  assert.equal(app.values.blockOfficialAccount, false);
});

test('saving current preferences drops obsolete data without storing previous plugin states', async () => {
  const app = setup();
  const disabledSkills = [{ name: 'review', description: 'Review', source: 'user-dsh', provider: 'filesystem', path: '/test/skills/review/SKILL.md' }];
  Object.assign(app.values, { blockOfficialSearch: true, blockTodo: true, showRefreshButton: true, showRestartButton: true, personalizationEnabled: true, skillManagerEnabled: true, mcpManagerEnabled: true, disabledSkills, globalPrompt: '始终用中文回复 {{literal}}', accountRestore: { old: true }, telemetryRestore: {}, telemetryPluginRestore: {}, settingsFullscreen: false });
  await app.policy.setBlocked(true);
  assert.deepEqual(app.values, { blockOfficialSearch: true, blockTodo: true, showVersion: true, showRefreshButton: true, showRestartButton: true, blockOfficialAccount: true, personalizationEnabled: true, skillManagerEnabled: true, mcpManagerEnabled: true, disabledSkills, globalPrompt: '始终用中文回复 {{literal}}' });
});

test('unsupported profiles and invalid booleans fail before native mutation', async () => {
  const app = setup();
  await assert.rejects(app.policy.setBlocked('true'), /boolean/);
  assert.throws(() => ACCOUNT_RPC.parameters[0].codec.create().parse('true'), /boolean/);
  app.rows.length = 0;
  await assert.rejects(app.policy.setBlocked(true), /No supported/);
  await assert.rejects(app.policy.setBlocked(false), /No supported/);
  assert.deepEqual(app.changed, []);
});
