import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mount, descendants } from '../../../../tests/helpers/client-fixture.mjs';

test('slow policy toggles respond immediately, prevent duplicate actions, and settle on the accepted value', async () => {
  for (const field of ['blockTodo']) {
    for (const initial of [false, true]) {
      const reply = Promise.withResolvers();
      const app = await mount({ rpcReply: reply.promise });
      assert.equal(app.dictionaries.get('zh').blockTodoDescription, '新对话中不再生成待办列表');
      assert.equal(app.dictionaries.get('en').blockTodoDescription, 'Stop generating to-do lists in new conversations');
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
  for (const field of ['blockTodo']) {
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
