import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { notificationProjection } from '../notifications.ts';

const require = createRequire(import.meta.resolve('@deepseek-ai/dsh-tools'));
const { Context } = await import(require.resolve('@deepseek-ai/cordis'));
const { default: SessionProjectionRegistry } = await import(require.resolve('@deepseek-ai/dsh-session-projection'));

function turnEnd(seq, turn, kind, detail = {}) {
  return { type: 'turn/end', seq, time: seq, data: { turn, reason: { kind, ...detail } } };
}

test('the completion summary records the committed outcome without retaining errors or earlier turns', () => {
  const projection = notificationProjection();
  let state = projection.init();
  assert.deepEqual(state, { seq: -1, turn: 0, reason: '' });
  for (const [turn, reason] of ['completed', 'error', 'blocked', 'aborted', 'max-tokens', 'interrupted', 'forked', 'future-outcome'].entries()) {
    const event = turnEnd(turn * 2 + 1, turn + 1, reason, {
      error: { message: 'Sensitive provider detail '.repeat(1000) },
      reason: { kind: 'user' },
    });
    state = projection.apply(state, event);
    assert.deepEqual(state, { seq: event.seq, turn: turn + 1, reason });
    assert.deepEqual(projection.wire.viewSchema.parse(projection.wire.view(state)), state);
    assert.deepEqual(Object.keys(state).sort(), ['reason', 'seq', 'turn']);
    assert.ok(JSON.stringify(state).length < 100);
  }
});

test('messages and step boundaries leave the last completion unchanged', () => {
  const projection = notificationProjection();
  const state = projection.apply(projection.init(), turnEnd(8, 2, 'error'));
  for (const type of ['turn/start', 'step/start', 'step/end', 'assistant/message', 'tool/result', 'approval/asked']) {
    assert.equal(projection.apply(state, { type, seq: 9, time: 9, data: {} }), state);
  }
});

test('summary validation rejects malformed cursors, turns and reasons and strips unrelated payloads', () => {
  const projection = notificationProjection();
  for (const schema of [projection.stateSchema, projection.wire.viewSchema]) {
    for (const value of [null, undefined, {},
      { seq: -2, turn: 1, reason: 'completed' },
      { seq: 0.5, turn: 1, reason: 'completed' },
      { seq: Infinity, turn: 1, reason: 'completed' },
      { seq: Number.MAX_SAFE_INTEGER + 1, turn: 1, reason: 'completed' },
      { seq: 1, turn: -1, reason: 'completed' },
      { seq: 1, turn: 0.5, reason: 'completed' },
      { seq: 1, turn: 1, reason: null },
      { seq: 1, turn: 1, reason: { kind: 'completed' } },
    ]) assert.throws(() => schema.parse(value), /Invalid power-dsh notification summary/);
    assert.deepEqual(schema.parse({ seq: 3, turn: 1, reason: 'future-outcome', body: 'discard' }), {
      seq: 3, turn: 1, reason: 'future-outcome',
    });
  }
});

test('the real registry publishes unopened-session completions and releases the summary on plugin unload', async t => {
  const root = new Context();
  t.after(() => root.fiber.dispose());
  await root.plugin(SessionProjectionRegistry);
  const registry = root.get('sessionProjections');
  const events = [];
  const session = {
    id: 'unopened-session', header: {}, inheritedEventCount: 0,
    get seq() { return events.length; },
    snapshotEvents(start = 0, end = events.length) { return events.slice(start, end); },
    eventAt(seq) { return events[seq]; },
  };
  const changes = [];
  registry.onChanged((changedSession, key, val, seq) => changes.push({ id: changedSession.id, values: [{ key, val }], seq }));
  async function owner(ctx) {
    await ctx.sessionProjections.register(notificationProjection());
  }
  owner.inject = ['sessionProjections'];
  const first = root.plugin(owner);
  await first;
  assert.deepEqual(registry.snapshot(session).values.powerDshNotifications, { seq: -1, turn: 0, reason: '' });

  function append(event) {
    assert.equal(event.seq, events.length);
    events.push(event);
    root.emit('session/event', session, event);
  }
  append({ type: 'turn/start', seq: 0, time: 0, data: { turn: 1 } });
  assert.equal(changes.length, 0);
  append(turnEnd(1, 1, 'error', { error: { message: 'not sent to the client' } }));
  assert.deepEqual(changes, [{
    id: session.id, seq: 1,
    values: [{ key: 'powerDshNotifications', val: { seq: 1, turn: 1, reason: 'error' } }],
  }]);
  assert.deepEqual(registry.snapshot(session).values.powerDshNotifications, { seq: 1, turn: 1, reason: 'error' });

  await first.dispose();
  assert.equal(Object.hasOwn(registry.snapshot(session).values, 'powerDshNotifications'), false);
  append(turnEnd(2, 2, 'completed'));
  assert.equal(changes.length, 1);

  const second = root.plugin(owner);
  await second;
  assert.deepEqual(registry.snapshot(session).values.powerDshNotifications, { seq: 2, turn: 2, reason: 'completed' });
  append(turnEnd(3, 3, 'blocked'));
  assert.equal(changes.length, 2, 'Reload must install one notification projection, without duplicate publication.');
  assert.deepEqual(changes[1].values, [{ key: 'powerDshNotifications', val: { seq: 3, turn: 3, reason: 'blocked' } }]);
  await second.dispose();
});
