import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mount, descendants } from '../../../../tests/helpers/client-fixture.mjs';

const control = app => descendants(app.renderSettings()).find(node => node.props.id === 'settings-test-blockPlan');

test('Plan switch sends its own policy RPC once, responds immediately, and settles on the saved value', async () => {
  for (const initial of [false, true]) {
    const reply = Promise.withResolvers();
    const app = await mount({ rpcReply: reply.promise });
    try {
      app.selectSettingsTab('simplify');
      app.set({ blockPlan: initial, blockTodo: true });
      const view = descendants(app.renderSettings());
      assert.ok(view.some(node => node.props.children.includes('blockPlan')));
      assert.ok(view.some(node => node.props.children.includes('blockPlanDescription')));
      assert.equal(app.dictionaries.get('zh').blockPlan, '停用 Plan 模式');
      assert.equal(app.dictionaries.get('zh').blockPlanDescription, '停用新对话的内置计划模式');
      assert.equal(app.dictionaries.get('en').blockPlanDescription, 'Disable the built-in Plan mode for new conversations');
      const click = control(app).props.onClick;
      const action = click();
      assert.equal(control(app).props['aria-checked'], !initial);
      assert.equal(control(app).props['aria-busy'], true);
      assert.equal(control(app).props.disabled, true);
      await click();
      assert.deepEqual(app.rpcCalls, [{ method: 'setPlanBlocked', blocked: !initial }]);
      reply.resolve({ ok: true, value: { blocked: !initial } });
      await action;
      assert.equal(control(app).props['aria-checked'], !initial);
      assert.equal(control(app).props['aria-busy'], false);
      assert.equal(control(app).props.disabled, false);
      const todo = descendants(app.renderSettings()).find(node => node.props.id === 'settings-test-blockTodo');
      assert.equal(todo.props['aria-checked'], true);
    } finally { app.unmount(); }
  }
});

test('Plan policy failure restores its saved value and associates shared error feedback with its switch', async () => {
  const reply = Promise.withResolvers();
  const app = await mount({ rpcReply: reply.promise });
  try {
    app.selectSettingsTab('simplify');
    const action = control(app).props.onClick();
    assert.equal(control(app).props['aria-checked'], true);
    reply.resolve({ ok: false, error: { message: 'Native Plan change failed' } });
    await action;
    assert.equal(control(app).props['aria-checked'], false);
    assert.equal(control(app).props['aria-busy'], false);
    assert.equal(control(app).props.disabled, false);
    assert.equal(control(app).props['aria-invalid'], true);
    const error = descendants(app.renderSettings()).find(node => node.props.role === 'alert');
    assert.ok(error.props.children.includes('Native Plan change failed'));
    assert.ok(control(app).props['aria-describedby'].split(' ').includes(error.props.id));
  } finally { app.unmount(); }
});
