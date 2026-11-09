import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mount, descendants } from '../helpers/client-fixture.mjs';

test('page feedback appears before settings controls and distinguishes failures from passive states', async t => {
  for (const state of [
    { status: 'unavailable', writable: true, message: 'unavailable', role: 'alert', tone: 'error' },
    { status: 'loading', writable: true, message: 'loading', role: 'status', tone: 'neutral' },
    { status: 'ready', writable: false, message: 'readOnly', role: 'status', tone: 'neutral' },
  ]) await t.test(state.message, async () => {
    const app = await mount({ writable: state.writable });
    try {
      app.setFormStatus(state.status);
      const view = descendants(app.renderSettings());
      const notices = view.filter(node => state.role === 'alert'
         ? node.props['data-error-code'] === 'PD-SETTINGS-LOAD' : node.props.className === 'power-dsh-notice');
      assert.equal(notices.length, 1);
      const [notice] = notices;
      assert.ok(notice.props.children.includes(state.message));
      assert.equal(notice.props.role, state.role);
      assert.equal(notice.props['data-tone'], state.tone);
      assert.ok(view.indexOf(view.find(node => node.type === 'header')) < view.indexOf(notice));
      assert.ok(view.indexOf(notice) < view.indexOf(view.find(node => node.props.role === 'tablist')));
      assert.ok(view.indexOf(notice) < view.indexOf(view.find(node => node.props.role === 'tabpanel')));
      assert.ok(view.filter(node => node.props.role === 'switch').every(node => node.props.disabled));
    } finally { app.unmount(); }
  });
});

test('failed settings saves keep feedback beside the control and associate it with that control', async () => {
  const app = await mount({ formReply: async () => false });
  try {
    app.set({ showVersion: false });
    app.selectSettingsTab('interface');
    const controlId = 'settings-test-showVersion';
    const control = () => descendants(app.renderSettings()).find(node => node.props.id === controlId);
    await control().props.onClick();
    const row = descendants(app.renderSettings()).find(node => node.props.className === 'power-dsh-setting-row'
      && descendants(node).some(child => child.props.id === controlId));
    const error = descendants(row).find(node => node.props.role === 'alert');
    assert.ok(error.props.children.includes('saveFailed'));
    assert.equal(control().props['aria-invalid'], true);
    assert.ok(control().props['aria-describedby'].split(' ').includes(error.props.id));
    assert.equal(control().props['aria-checked'], false);
    assert.ok(!descendants(app.renderSettings()).some(node => node.props.className === 'power-dsh-notice'));
  } finally { app.unmount(); }
});

test('settings route policy changes to their explicit injected Host methods', async () => {
  const app = await mount();
  await app.settingsProps().setTelemetryBlocked(true);
  await app.settingsProps().setAccountBlocked(false);
  await app.settingsProps().setTodoBlocked(true);
  await app.settingsProps().setPlanBlocked(true);
  await app.settingsProps().setGoalBlocked(true);
  await app.settingsProps().setSearchBlocked(true);
  assert.deepEqual(app.rpcCalls, [
    { method: 'setTelemetryBlocked', blocked: true },
    { method: 'setAccountBlocked', blocked: false },
    { method: 'setTodoBlocked', blocked: true },
    { method: 'setPlanBlocked', blocked: true },
    { method: 'setGoalBlocked', blocked: true },
    { method: 'setSearchBlocked', blocked: true },
  ]);
  app.unmount();
});

test('settings group eighteen switches under four panels and default to General', async () => {
  const app = await mount({ desktop: true });
  app.set({ notificationsEnabled: true });
  const groups = {
    general: ['notificationsEnabled', 'notificationSoundEnabled', 'showRefreshButton', 'showRestartButton'],
    interface: ['showThinkingEffortSwitcher', 'showThemeSwitcher', 'flowingBackgroundEnabled', 'showVersion'],
    enhancements: ['skillManagerEnabled', 'mcpManagerEnabled', 'personalizationEnabled'],
    simplify: ['blockOfficialAccount', 'blockOfficialSearch', 'blockOfficialTelemetry', 'blockTodo', 'blockPlan', 'blockGoal', 'blockDoubleClickRename'],
  };
  const fields = [];
  for (const [id, expected] of Object.entries(groups)) {
    if (id !== 'general') app.selectSettingsTab(id);
    const view = descendants(app.renderSettings());
    const tabs = view.filter(node => node.props.role === 'tab');
    assert.deepEqual(tabs.map(tab => tab.props.children[0]), ['generalTab', 'interfaceTab', 'enhancementsTab', 'simplifyTab']);
    assert.equal(tabs.filter(tab => tab.props['aria-selected']).length, 1);
    assert.equal(tabs.filter(tab => tab.props.tabIndex === 0).length, 1);
    for (const tab of tabs) {
      const selected = tab.props.id === `settings-test-tab-${id}`;
      assert.equal(tab.props['aria-selected'], selected);
      assert.equal(tab.props.tabIndex, selected ? 0 : -1);
      assert.equal(tab.props['aria-controls'], tab.props.id.replace('-tab-', '-panel-'));
    }
    const panels = view.filter(node => node.props.role === 'tabpanel');
    assert.equal(panels.length, 1);
    const panel = panels[0];
    assert.equal(panel.props.id, `settings-test-panel-${id}`);
    assert.equal(panel.props['aria-labelledby'], `settings-test-tab-${id}`);
    const actual = view.filter(node => node.props.role === 'switch').map(node => node.props.id.replace('settings-test-', ''));
    assert.deepEqual(actual, expected);
    fields.push(...actual);
    assert.ok(!view.some(node => node.type === 'textarea'));
  }
  assert.equal(new Set(fields).size, 18);
  app.unmount();
});

test('settings tabs support wrapping arrow keys, Home and End with selection and focus together', async () => {
  const app = await mount();
  const tabs = () => descendants(app.renderSettings()).filter(node => node.props.role === 'tab');
  for (const [key, expected] of [
    ['ArrowLeft', 'simplify'], ['ArrowRight', 'general'], ['ArrowRight', 'interface'],
    ['ArrowRight', 'enhancements'], ['ArrowRight', 'simplify'], ['ArrowRight', 'general'],
    ['End', 'simplify'], ['ArrowLeft', 'enhancements'], ['ArrowLeft', 'interface'],
    ['ArrowLeft', 'general'], ['Home', 'general'],
  ]) {
    let prevented = false;
    tabs().find(tab => tab.props['aria-selected']).props.onKeyDown({ key, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    const selected = tabs().find(tab => tab.props['aria-selected']);
    assert.equal(selected.props.id, `settings-test-tab-${expected}`);
    assert.equal(selected.props.tabIndex, 0);
    assert.equal(app.focusedElementId(), selected.props.id);
  }
  tabs()[0].props.onKeyDown({ key: 'Tab', preventDefault() { assert.fail('Tab must keep native focus navigation'); } });
  assert.equal(tabs()[0].props['aria-selected'], true);
  app.unmount();
});

test('pending saves reject tab clicks and keyboard changes and keep errors in the current panel', async () => {
  for (const [id, field, mechanism] of [
    ['interface', 'showVersion', 'form'], ['general', 'notificationsEnabled', 'form'],
    ['enhancements', 'skillManagerEnabled', 'form'], ['simplify', 'blockTodo', 'rpc'],
  ]) {
    const reply = Promise.withResolvers();
    const app = await mount(mechanism === 'form' ? { formReply: () => reply.promise } : { rpcReply: reply.promise });
    app.selectSettingsTab(id);
    const view = () => descendants(app.renderSettings());
    const tabs = () => view().filter(node => node.props.role === 'tab');
    const oldTabs = tabs();
    const control = view().find(node => node.props.id === `settings-test-${field}`);
    const action = control.props.onClick();
    // Stale callbacks must also reject changes before a render exposes disabled tabs.
    oldTabs.find(tab => !tab.props['aria-selected']).props.onClick();
    oldTabs.find(tab => tab.props['aria-selected']).props.onKeyDown({ key: 'ArrowRight', preventDefault() {} });
    assert.equal(tabs().find(tab => tab.props['aria-selected']).props.id, `settings-test-tab-${id}`);
    assert.ok(tabs().every(tab => tab.props.disabled));
    for (const tab of tabs()) {
      tab.props.onClick();
      tab.props.onKeyDown({ key: 'End', preventDefault() {} });
    }
    assert.equal(app.focusedElementId(), null);
    assert.equal(view().find(node => node.props.role === 'tabpanel').props.id, `settings-test-panel-${id}`);
    reply.resolve(mechanism === 'form' ? false : { ok: false, error: { message: 'Native change failed' } });
    await action;
    assert.equal(view().find(node => node.props.role === 'tabpanel').props.id, `settings-test-panel-${id}`);
    assert.ok(view().some(node => node.props.role === 'alert'));
    assert.equal(view().find(node => node.props.id === `settings-test-${field}`).props['aria-checked'], false);
    assert.ok(tabs().every(tab => !tab.props.disabled));
    app.selectSettingsTab(id === 'general' ? 'enhancements' : 'general');
    assert.equal(view().find(node => node.props.role === 'tabpanel').props.id, `settings-test-panel-${id === 'general' ? 'enhancements' : 'general'}`);
    app.unmount();
  }
});
