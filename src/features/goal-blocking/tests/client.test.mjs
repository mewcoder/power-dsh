import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mount, descendants } from '../../../../tests/helpers/client-fixture.mjs';

const control = app => descendants(app.renderSettings()).find(node => node.props.id === 'settings-test-blockGoal');

test('Goal switch has its own bilingual row and sends one immediate policy change without changing Plan or Todo', async () => {
  for (const initial of [false, true]) {
    const reply = Promise.withResolvers();
    const app = await mount({ rpcReply: reply.promise });
    try {
      app.selectSettingsTab('simplify');
      app.set({ blockGoal: initial, blockPlan: true, blockTodo: true });
      const view = descendants(app.renderSettings());
      assert.ok(view.some(node => node.props.children.includes('blockGoal')));
      assert.ok(view.some(node => node.props.children.includes('blockGoalDescription')));
      assert.equal(app.dictionaries.get('zh').blockGoal, '停用 Goal 模式');
      assert.equal(app.dictionaries.get('zh').blockGoalDescription, '停用新对话的内置目标模式');
      assert.equal(app.dictionaries.get('en').blockGoalDescription, 'Disable the built-in Goal mode for new conversations');
      const click = control(app).props.onClick;
      const action = click();
      assert.equal(control(app).props['aria-checked'], !initial);
      assert.equal(control(app).props['aria-busy'], true);
      assert.equal(control(app).props.disabled, true);
      await click();
      assert.deepEqual(app.rpcCalls, [{ method: 'setGoalBlocked', blocked: !initial }]);
      reply.resolve({ ok: true, value: { blocked: !initial } });
      await action;
      assert.equal(control(app).props['aria-checked'], !initial);
      assert.equal(control(app).props['aria-busy'], false);
      assert.equal(control(app).props.disabled, false);
      for (const field of ['blockPlan', 'blockTodo']) {
        const other = descendants(app.renderSettings()).find(node => node.props.id === `settings-test-${field}`);
        assert.equal(other.props['aria-checked'], true);
      }
    } finally { app.unmount(); }
  }
});

test('failed Goal writes restore the saved value and associate shared row feedback with the control', async () => {
  const reply = Promise.withResolvers();
  const app = await mount({ rpcReply: reply.promise });
  try {
    app.selectSettingsTab('simplify');
    const action = control(app).props.onClick();
    assert.equal(control(app).props['aria-checked'], true);
    reply.resolve({ ok: false, error: { message: 'Native Goal change failed' } });
    await action;
    assert.equal(control(app).props['aria-checked'], false);
    assert.equal(control(app).props['aria-busy'], false);
    assert.equal(control(app).props.disabled, false);
    assert.equal(control(app).props['aria-invalid'], true);
    const error = descendants(app.renderSettings()).find(node => node.props.role === 'alert');
    assert.ok(error.props.children.includes('Native Goal change failed'));
    assert.ok(control(app).props['aria-describedby'].split(' ').includes(error.props.id));
  } finally { app.unmount(); }
});
