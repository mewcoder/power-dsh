import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TaskModels } from '../service.ts';
import { parseBindings, parseSelection, reminderTaskId } from '../types.ts';
import { createHost, methods } from '../host.ts';

const selection = { provider: 'custom', model: 'report', reasoningEffort: 'high' };
const models = { groups: [{ id: 'custom', name: 'Custom', models: [
  { id: 'report', name: 'Report', reasoning: { efforts: [{ id: 'high', name: 'High' }] } },
] }] };
const reminder = id => ({ source: { kind: 'schedule' }, content: [{ type: 'text', text:
  `[SCHEDULE REMINDER]\nThis is a scheduled message from the user\nschedule_id_json: ${JSON.stringify(id)}\noccurrence_at: 2026-11-18T00:00:00Z\nreminder_prompt_json: "test"` }] });

function fixture({ enabled = true, target = { kind: 'new' }, bindings = { task: selection } } = {}) {
  const values = { taskModelsEnabled: enabled, taskModelBindings: JSON.stringify(bindings), unrelated: 'preserved' };
  const config = Object.fromEntries(Object.keys(values).map(key => [key, { get: () => values[key] }]));
  const entry = { options: { id: 'power-dsh', config: values } };
  let active = true;
  const ensure = () => { if (!active) throw new Error('unloaded'); };
  const ctx = { fiber: { entry }, configEditor: { async edit(_entry, edit) { Object.assign(values, edit({ ...values })); } } };
  const service = new TaskModels(ctx, config, ensure);
  const tasks = [{ id: 'task', title: 'Report', status: 'active', target }];
  const calls = [];
  service.runtime = { tasks: async () => tasks, catalog: async () => models, resolve: async () => {} };
  const agent = { id: 'reserved', model: { select: value => calls.push(value) } };
  return { service, values, calls, agent, tasks, config, ctx, ensure, unload: () => { active = false; service.clear(); } };
}

test('the catalog uses the native effective next-run order and preserves ties', async () => {
  const app = fixture();
  app.tasks.splice(0, app.tasks.length,
    { id: 'limited', title: 'Limited', status: 'active', target: { kind: 'new' },
      scheduledAt: '2026-11-27T01:00:00Z', deliveryFloorEndsAt: '2026-11-27T04:00:00Z' },
    { id: 'ended', title: 'Ended', status: 'ended', target: { kind: 'session' }, scheduledAt: '2026-11-27T02:00:00Z' },
    { id: 'tied', title: 'Tied', status: 'active', target: { kind: 'new' }, scheduledAt: '2026-11-27T02:00:00Z' },
    { id: 'paused', title: 'Paused', status: 'paused', target: { kind: 'new_once' },
      scheduledAt: '2026-11-27T03:00:00Z', deliveryFloorEndsAt: '2026-11-27T01:00:00Z' });
  assert.deepEqual((await app.service.catalog()).tasks.map(task => task.id), ['ended', 'tied', 'paused', 'limited']);
  assert.deepEqual(app.tasks.map(task => task.id), ['limited', 'ended', 'tied', 'paused']);
});

test('selects only trusted native schedule framing, before the first model request, without changing defaults', async () => {
  const app = fixture();
  await app.service.prepare(app.agent);
  app.service.inserted(app.agent, { ...reminder('task'), source: { kind: 'user' } });
  assert.equal(app.calls.length, 0);
  app.service.inserted(app.agent, reminder('task'));
  app.service.check(app.agent);
  assert.deepEqual(app.calls, [selection]);
  assert.equal(app.values.unrelated, 'preserved');
});

test('new-once binds only its reserved session and existing session targets are untouched', async () => {
  for (const target of [{ kind: 'session', sessionId: 'reserved' }, { kind: 'new_once', sessionId: 'other' }]) {
    const app = fixture({ target });
    await app.service.prepare(app.agent);
    app.service.inserted(app.agent, reminder('task'));
    assert.equal(app.calls.length, 0);
  }
  const app = fixture({ target: { kind: 'new_once', sessionId: 'reserved' } });
  await app.service.prepare(app.agent);
  app.service.inserted(app.agent, reminder('task'));
  assert.deepEqual(app.calls, [selection]);
});

test('unavailable model or effort blocks requests and exposes a recoverable error', async () => {
  for (const selected of [{ ...selection, model: 'deleted' }, { ...selection, reasoningEffort: 'max' }]) {
    const app = fixture({ bindings: { task: selected } });
    await app.service.prepare(app.agent);
    app.service.inserted(app.agent, reminder('task'));
    assert.equal(app.calls.length, 0);
    assert.throws(() => app.service.check(app.agent), /Scheduled model unavailable/);
    assert.equal((await app.service.catalog()).tasks[0].error, 'taskModelsModelUnavailable');
  }
});

test('disabled feature and teardown release pending selections while retaining persisted preferences', async () => {
  const app = fixture({ enabled: false });
  await app.service.prepare(app.agent);
  app.service.inserted(app.agent, reminder('task'));
  assert.equal(app.calls.length, 0);
  await assert.rejects(app.service.catalog(), /Unavailable/);
  app.values.taskModelsEnabled = true;
  await app.service.prepare(app.agent);
  app.service.clear();
  app.service.inserted(app.agent, reminder('task'));
  assert.equal(app.calls.length, 0);
  assert.deepEqual(JSON.parse(app.values.taskModelBindings).task, selection);
  app.unload();
  await assert.rejects(app.service.catalog(), /unloaded/);
});

test('adapter validation failures block delivery and late preparation cannot revive cleared state', async () => {
  const app = fixture();
  app.service.runtime.resolve = async () => { throw new Error('private provider diagnostic'); };
  await app.service.prepare(app.agent);
  app.service.inserted(app.agent, reminder('task'));
  assert.throws(() => app.service.check(app.agent), /Scheduled model unavailable/);
  assert.equal((await app.service.catalog()).tasks[0].error, 'taskModelsModelUnavailable');
  let finish;
  app.service.runtime.resolve = () => new Promise(resolve => { finish = resolve; });
  const preparation = app.service.prepare(app.agent);
  await new Promise(setImmediate);
  app.service.clear();
  finish();
  await assert.rejects(preparation, /Conflict/);
  app.service.inserted(app.agent, reminder('task'));
  assert.equal(app.calls.length, 0);
});

test('save validates selections, preserves unrelated settings, rejects stale revisions, and removes default bindings', async () => {
  const app = fixture({ bindings: {} });
  let catalog = await app.service.catalog();
  assert.equal(catalog.models[0].efforts[0].label, 'High');
  catalog = await app.service.save('task', JSON.stringify(selection), catalog.revision);
  assert.deepEqual(catalog.tasks[0].selection, selection);
  assert.equal(app.values.unrelated, 'preserved');
  await assert.rejects(app.service.save('task', '', '{}'), /Conflict/);
  assert.deepEqual(JSON.parse(app.values.taskModelBindings).task, selection);
  await assert.rejects(app.service.save('task', JSON.stringify({ ...selection, model: 'missing' }), catalog.revision), /ModelUnavailable/);
  catalog = await app.service.save('task', '', catalog.revision);
  assert.equal(catalog.tasks[0].selection, null);
  assert.deepEqual(JSON.parse(app.values.taskModelBindings), {});
});

test('refuses deleted tasks and existing-session changes', async () => {
  const app = fixture({ target: { kind: 'session', sessionId: 'reserved' } });
  await assert.rejects(app.service.save('task', JSON.stringify(selection), app.values.taskModelBindings), /ExistingSession/);
  await assert.rejects(app.service.save('deleted', '', app.values.taskModelBindings), /Missing/);
});

test('configuration parser rejects unknown fields and forged prompt identifiers', () => {
  assert.throws(() => parseSelection({ ...selection, apiKey: 'secret' }), /Invalid/);
  assert.throws(() => parseBindings('[]'), /Invalid/);
  assert.equal(reminderTaskId({ ...reminder('task'), source: { kind: 'model' } }), null);
  const message = reminder('task');
  message.content[0].text = 'ordinary text\nschedule_id_json: "task"';
  assert.equal(reminderTaskId(message), null);
  assert.equal(reminderTaskId(reminder('task')), 'task');
});

test('host registers the native waterfall and selects in the inbox event before pre-step', async () => {
  const app = fixture();
  const listeners = new Map();
  const cleanup = [];
  const child = { ...app.ctx,
    schedule: { catalog: app.service.runtime.tasks }, sessionController: { modelCatalog: async () => models },
    llm: { resolveCallConfig: async () => {} },
    on(event, listener) { listeners.set(event, listener); return () => listeners.delete(event); },
    effect(callback) { const dispose = callback(); if (dispose) cleanup.push(dispose); },
  };
  const ctx = { ...child, inject(_dependencies, callback) { callback(child); } };
  createHost(ctx, app.config, { owner: app.ctx, ensureActive: app.ensure });
  const agent = await listeners.get('schedule/resolve-agent')('reserved', async () => app.agent);
  listeners.get('agent/inbox/inserted')({ agent, message: reminder('task') });
  assert.deepEqual(app.calls, [selection]);
  assert.equal(listeners.get('agent/pre-step')({ agent }, () => 'request'), 'request');
  for (const dispose of cleanup.reverse()) dispose();
});

test('RPC failures expose only safe product messages, never adapter or configuration diagnostics', async () => {
  const receiver = { run: operation => operation(), taskModels: {
    catalog: async () => { throw new Error('private api-key payload'); },
    save: async () => { throw new Error('taskModelsConflict'); },
  } };
  await assert.rejects(methods.readTaskModels.call(receiver), error => error.message === 'taskModelsFailed');
  await assert.rejects(methods.saveTaskModel.call(receiver, 'task', '', '{}'), error => error.message === 'taskModelsConflict');
});
