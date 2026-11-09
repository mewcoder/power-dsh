import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TelemetryPolicy } from '../src/telemetry-policy.js';

function setup({ preDisabled = [] } = {}) {
  const definitions = [
    ['session-log-deepseek', '@deepseek-ai/dsh-session-log-deepseek'],
    ['plugin-package-inventory-deepseek', '@deepseek-ai/dsh-plugin-package-inventory-deepseek'],
    ['session-telemetry-otel', '@deepseek-ai/dsh-session-telemetry-otel'],
    ['desktop-product-telemetry', '@deepseek-ai/dsh-host-product-telemetry-otel'],
    ['product-analytics', '@deepseek-ai/dsh-client-product-analytics'],
    ['ui-message-feedback', '@deepseek-ai/dsh-client-ui-message-feedback'],
    ['own-feedback', '@deepseek-ai/dsh-client-ui-message-feedback'],
    ['command-feedback', '@deepseek-ai/dsh-command-feedback'],
    ['own-command-feedback', '@deepseek-ai/dsh-command-feedback'],
    ['otel', '@deepseek-ai/dsh-otel'],
    ['custom-reporter', '@example/reporter'],
    ['own-log', '@deepseek-ai/dsh-session-log-deepseek'],
  ];
  const rows = definitions.map(([id, moduleName]) => ({
    entryId: `include:${id}`, patchId: id, moduleName, enabled: !preDisabled.includes(id),
    fiberPhase: preDisabled.includes(id) ? null : 'active',
  }));
  const values = { blockOfficialTelemetry: false };
  const changes = [];
  const ctx = {
    fiber: { entry: { options: { id: 'mod', config: values } } },
    pluginManager: {
      async listPlugins() { return structuredClone(rows); },
      async setPluginEnabled(id, enabled) {
        changes.push([id, enabled]);
        const row = rows.find(item => item.entryId === id);
        row.enabled = enabled;
        row.fiberPhase = enabled ? 'active' : null;
        return { application: 'applied', warnings: [] };
      },
    },
    configEditor: {
      async edit(_entry, change) {
        const next = change(structuredClone(values));
        for (const key of Object.keys(values)) delete values[key];
        Object.assign(values, next);
      },
    },
  };
  return { ctx, values, rows, changes, policy: new TelemetryPolicy(ctx) };
}

const builtIns = rows => rows.filter(row => !['otel', 'custom-reporter', 'own-log', 'own-feedback', 'own-command-feedback'].includes(row.patchId));

test('disables built-in senders, preserving shared transport and user-added instances', async () => {
  const app = setup();
  await app.policy.setBlocked(true);
  assert.ok(builtIns(app.rows).every(row => !row.enabled && row.fiberPhase === null));
  assert.ok(app.rows.filter(row => ['otel', 'custom-reporter', 'own-log', 'own-feedback', 'own-command-feedback'].includes(row.patchId)).every(row => row.enabled));
  assert.equal(app.changes[0][0], 'include:product-analytics');
  assert.equal(app.changes.at(-1)[0], 'include:desktop-product-telemetry');
  assert.equal(await app.policy.protected(), true);
  const status = await app.policy.status();
  assert.equal(status.senders.length, 7);
  assert.equal(status.senders.find(item => item.id === 'ui-message-feedback').enabled, false);
  assert.deepEqual(status.senders.find(item => item.id === 'command-feedback'), {
    id: 'command-feedback', available: true, enabled: false, active: false,
  });
  assert.ok(app.changes.findIndex(([id]) => id === 'include:ui-message-feedback')
    < app.changes.findIndex(([id]) => id === 'include:command-feedback'));
  assert.deepEqual(Object.keys(status).sort(), ['protected', 'senders']);
});

test('unblock enables every target, including pre-disabled ones, with exporter before intake', async () => {
  const app = setup({ preDisabled: ['session-telemetry-otel', 'command-feedback'] });
  await app.policy.setBlocked(true);
  const reloaded = new TelemetryPolicy(app.ctx);
  assert.equal(await reloaded.protected(), true);
  app.changes.length = 0;
  await reloaded.setBlocked(false);
  assert.equal(app.changes[0][0], 'include:desktop-product-telemetry');
  assert.equal(app.changes.at(-1)[0], 'include:product-analytics');
  assert.ok(app.changes.findIndex(([id]) => id === 'include:command-feedback')
    < app.changes.findIndex(([id]) => id === 'include:ui-message-feedback'));
  assert.ok(builtIns(app.rows).every(row => row.enabled));
  assert.deepEqual(app.values, { blockOfficialTelemetry: false });
});

test('telemetry toggles preserve notification, gesture and unrelated feature preferences', async () => {
  const app = setup();
  const preserved = { notificationsEnabled: true, notificationSoundEnabled: false, notificationSound: 'mac:Ping.aiff',
    blockDoubleClickRename: true, disabledSkills: [{ name: 'review' }], futureFeature: { enabled: true } };
  Object.assign(app.values, preserved);
  await app.policy.setBlocked(true);
  assert.deepEqual(app.values, { blockOfficialTelemetry: true, ...preserved });
  await app.policy.setBlocked(false);
  assert.deepEqual(app.values, { blockOfficialTelemetry: false, ...preserved });
});

test('a failed preference write can be retried without any recovery record', async () => {
  const app = setup();
  await app.policy.setBlocked(true);
  const edit = app.ctx.configEditor.edit;
  app.ctx.configEditor.edit = async () => { throw new Error('save failed'); };
  await assert.rejects(app.policy.setBlocked(false), /save failed/);
  assert.ok(builtIns(app.rows).every(row => row.enabled));
  assert.equal(app.values.blockOfficialTelemetry, true);
  assert.equal(await app.policy.protected(), false);
  app.ctx.configEditor.edit = edit;
  await app.policy.setBlocked(false);
  assert.deepEqual(app.values, { blockOfficialTelemetry: false });
});

test('status detects externally enabled modules and reapplying disables them', async () => {
  const app = setup();
  await app.policy.setBlocked(true);
  await app.ctx.pluginManager.setPluginEnabled('include:command-feedback', true);
  assert.equal(app.values.blockOfficialTelemetry, true);
  assert.equal(await app.policy.protected(), false);
  await app.policy.setBlocked(true);
  assert.equal(await app.policy.protected(), true);
});
