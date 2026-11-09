import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mount, descendants } from '../../../../tests/helpers/client-fixture.mjs';

test('blocking settings omit background status and display native action errors', async () => {
  const app = await mount({ rpcError: 'Plugin change failed' });
  app.selectSettingsTab('simplify');
  app.set({ blockOfficialTelemetry: true });
  let view = descendants(app.renderSettings());
  const controls = view.filter(node => node.props.role === 'switch');
  assert.equal(controls.filter(node => node.props.id === 'settings-test-blockOfficialTelemetry').length, 1);
  assert.ok(!view.some(node => node.props.role === 'status' || node.props.role === 'alert'));
  await controls.find(node => node.props.id === 'settings-test-blockOfficialTelemetry').props.onClick();
  assert.deepEqual(app.rpcCalls, [{ method: 'setTelemetryBlocked', blocked: false }]);
  view = descendants(app.renderSettings());
  assert.ok(view.some(node => node.props.role === 'alert' && node.props.children.includes('Plugin change failed')));
  app.unmount();
});

test('slow policy toggles respond immediately, prevent duplicate actions, and settle on the accepted value', async () => {
  for (const field of ['blockOfficialTelemetry']) {
    for (const initial of [false, true]) {
      const reply = Promise.withResolvers();
      const app = await mount({ rpcReply: reply.promise });
      app.selectSettingsTab('simplify');
      app.set({ [field]: initial });
      const find = () => descendants(app.renderSettings()).find(node => node.props.id === `settings-test-${field}`);
      const click = find().props.onClick;
      const action = click();
      const waiting = find();
      assert.equal(waiting.props['aria-checked'], !initial);
      assert.equal(waiting.props['aria-busy'], true);
      assert.equal(waiting.props.disabled, true);
      await click();
      assert.equal(app.rpcCalls.length, 1);
      reply.resolve({ ok: true, value: { blocked: !initial } });
      await action;
      const settled = find();
      assert.equal(settled.props['aria-checked'], !initial);
      assert.equal(settled.props['aria-busy'], false);
      assert.equal(settled.props.disabled, false);
      app.unmount();
    }
  }
});

test('a failed policy action ends the busy feedback and returns the switch to its saved value', async () => {
  for (const field of ['blockOfficialTelemetry']) {
    const reply = Promise.withResolvers();
    const app = await mount({ rpcReply: reply.promise });
    app.selectSettingsTab('simplify');
    const find = () => descendants(app.renderSettings()).find(node => node.props.id === `settings-test-${field}`);
    const action = find().props.onClick();
    assert.equal(find().props['aria-checked'], true);
    reply.resolve({ ok: false, error: { message: 'Native change failed' } });
    await action;
    assert.equal(find().props['aria-checked'], false);
    assert.equal(find().props['aria-busy'], false);
    assert.equal(find().props.disabled, false);
    assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes('Native change failed')));
    app.unmount();
  }
});
