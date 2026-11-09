import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import ToolsService from '@deepseek-ai/dsh-tools';
import { apply, inject } from '../../src/index.ts';
import { hostFeatures } from '../../src/app/host-features.ts';
import { composeConfig } from '../../src/app/config.ts';
import { composeDictionaries } from '../../src/app/locales.ts';
import { MOD_RPC, composeRpc } from '../../src/app/rpc.ts';

const require = createRequire(import.meta.resolve('@deepseek-ai/dsh-tools'));
const { Context } = await import(require.resolve('@deepseek-ai/cordis'));
const { default: SessionProjectionRegistry } = await import(require.resolve('@deepseek-ai/dsh-session-projection'));

test('a selected Host assembly excludes unrelated capabilities and preserves their saved preferences', async t => {
  const features = hostFeatures.filter(feature => ['version-display', 'refresh-button', 'account-blocking'].includes(feature.definition.id));
  const root = new Context();
  t.after(() => root.fiber.dispose());
  root.reflect.provide('systemPrompt', { tools: () => () => {} });
  await root.plugin(ToolsService);
  await root.plugin(SessionProjectionRegistry);
  const values = { showVersion: false, showRefreshButton: false, blockOfficialAccount: false,
    notificationsEnabled: true, notificationSound: 'mac:Glass.aiff', blockDoubleClickRename: true };
  const config = Object.fromEntries(Object.keys(composeConfig(features).dict).map(key => [key, { get: () => values[key] }]));
  const target = { entryId: 'include:account-ui', moduleName: '@deepseek-ai/dsh-client-ui-settings-account', enabled: true, fiberPhase: 'active' };
  let managedEntry;
  let wire;
  let released = false;
  const providers = {
    settings: {
      configure: () => () => {},
      async mutate(namespace, operations) {
        assert.equal(namespace, 'power-dsh');
        for (const operation of operations) values[operation.path[0]] = operation.value;
      },
    },
    clientModules: { graph: () => ({ release: { version: '0.2.2-rc.1' } }) },
    pluginManager: {
      async listPlugins() { return [{ ...target }]; },
      async setPluginEnabled(id, enabled) {
        assert.equal(id, target.entryId);
        target.enabled = enabled;
        target.fiberPhase = enabled ? 'active' : 'inactive';
        return { application: 'applied' };
      },
    },
    typert: { register(definition) { wire = definition; return () => { released = true; }; } },
    configEditor: {
      async edit(entry, change) {
        assert.equal(entry, managedEntry, 'Feature contexts must write the managed owner entry.');
        const next = change(structuredClone(values));
        for (const key of Object.keys(values)) delete values[key];
        Object.assign(values, next);
      },
    },
    profileContext: { home: '/memory-only/dsh-home' },
  };
  for (const [name, value] of Object.entries(providers)) root.reflect.provide(name, value);
  function selectedMod(ctx) {
    managedEntry = ctx.fiber.entry = { options: { id: 'power-dsh' } };
    apply(ctx, config, features);
  }
  selectedMod.inject = inject;
  const fiber = await root.plugin(selectedMod);
  const service = root.get('powerDsh');
  const tool = root.get('tools').get('power_dsh_settings');
  assert.deepEqual(wire.invocations.map(rpc => rpc.method), ['setAccountBlocked']);
  assert.equal(service.restartApp, undefined);
  assert.equal(service.playSystemSound, undefined);
  assert.equal(service.skills, undefined);
  assert.equal(tool.parameters.properties.showRestartButton, undefined);
  assert.equal(tool.parameters.properties.blockTodo, undefined);
  assert.equal(tool.parameters.properties.blockPlan, undefined);
  assert.equal(service.setPlanBlocked, undefined);
  assert.equal(tool.parameters.properties.blockGoal, undefined);
  assert.equal(service.setGoalBlocked, undefined);
  assert.deepEqual(Object.keys(tool.parameters.properties).sort(), ['blockOfficialAccount', 'showRefreshButton', 'showVersion']);
  await tool.execute({ showVersion: true, blockOfficialAccount: true }, { signal: new AbortController().signal });
  assert.deepEqual(values, { showVersion: true, showRefreshButton: false, blockOfficialAccount: true,
    notificationsEnabled: true, notificationSound: 'mac:Glass.aiff', blockDoubleClickRename: true });
  assert.equal(target.enabled, false);
  const session = { id: 'selected-fixture', header: {}, inheritedEventCount: 0, seq: 0, snapshotEvents: () => [], eventAt: () => undefined };
  assert.equal(root.get('sessionProjections').snapshot(session).values.powerDshNotifications, undefined);
  await fiber.dispose();
  assert.equal(released, true);
  await assert.rejects(service.setAccountBlocked(false), /unloaded/);
  assert.equal(target.enabled, false, 'Unloading a feature must not undo persistent target state.');
});

test('configuration and locale composition reject conflicting or incomplete feature ownership', () => {
  const feature = hostFeatures.find(feature => feature.definition.id === 'account-blocking');
  assert.throws(() => composeConfig([feature, feature]), /Duplicate Host feature/);
  assert.throws(() => composeConfig([feature, { ...feature, definition: { ...feature.definition, id: 'conflict' } }]), /Duplicate configuration key/);
  assert.throws(() => composeConfig([{ ...feature, definition: { ...feature.definition, keys: [] } }]), /Configuration keys do not match/);
  const locales = { en: { label: 'Feature' }, zh: { label: '功能' } };
  assert.throws(() => composeDictionaries([locales, locales]), /Duplicate locale key/);
  assert.throws(() => composeDictionaries([{ en: { label: 'Feature' }, zh: {} }]), /Locale key mismatch/);
});

test('every default RPC has exactly one feature owner and one assembly descriptor', () => {
  const owned = hostFeatures.flatMap(feature => feature.rpc ?? []);
  assert.equal(new Set(owned.map(rpc => rpc.id)).size, owned.length);
  assert.deepEqual(owned.map(rpc => rpc.id).sort(), MOD_RPC.map(rpc => rpc.id).sort());
  for (const descriptor of MOD_RPC) assert.ok(owned.includes(descriptor), 'Use the same strict descriptor in each face.');
  assert.throws(() => composeRpc([MOD_RPC[0], { ...MOD_RPC[0] }]), /Duplicate RPC/);
  assert.throws(() => composeRpc([MOD_RPC[0], { ...MOD_RPC[0], id: 'power-dsh#different' }]), /Duplicate RPC/);
});
