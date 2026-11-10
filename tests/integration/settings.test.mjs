import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mount, descendants } from '../helpers/client-fixture.mjs';
import { createSettingsPage } from '../../src/shared/client/settings-shell.ts';

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

test('runtime diagnostics keep their cause and saved value while actual save failures take priority', async () => {
  let cursor = 0;
  const states = [];
  const React = {
    useId: () => 'runtime-settings',
    useEffect(fn) { fn(); },
    useRef(value) { const i = cursor++; return states[i] ||= { current: value }; },
    useState(value) { const i = cursor++; if (!(i in states)) states[i] = typeof value === 'function' ? value() : value;
      return [states[i], next => { states[i] = next; }]; },
  };
  const runtime = { React, h: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useSnapshot: source => source.getSnapshot(), useMounted: () => ({ current: true }),
    errorFeedback: props => ({ type: 'feedback', props: { ...props, role: 'alert' } }) };
  const snapshot = { status: 'ready', writable: true, value: { flowingBackgroundEnabled: true } };
  const issue = { message: 'Layout unavailable; the setting is unchanged.', code: 'PD-BACKGROUND-LAYOUT',
    operation: 'flowing-background.attach', observedAt: '2026-11-09T11:45:02.966Z',
    context: { stage: 'Style recognition', check: 'layout.frame', result: 'Not found' } };
  const Page = createSettingsPage(runtime);
  const props = { t: key => key, version: '0.2.2-rc.1', source: { getSnapshot: () => snapshot },
    form: { set: async () => false }, features: [{ settings: [], useSettings: () => [{
      field: 'flowingBackgroundEnabled', category: 'general', failure: issue,
    }] }] };
  const view = () => { cursor = 0; return descendants(Page(props)); };
  const fault = () => view().find(node => node.props.role === 'alert');
  assert.equal(fault().props.code, issue.code);
  assert.equal(fault().props.operation, issue.operation);
  assert.deepEqual(fault().props.context, issue.context);
  assert.equal(fault().props.observedAt, issue.observedAt);
  const control = view().find(node => node.props.role === 'switch');
  assert.equal(control.props['aria-checked'], true);
  assert.ok(control.props['aria-describedby'].includes(fault().props.id));
  await control.props.onClick();
  assert.equal(fault().props.code, 'PD-SETTINGS-SAVE');
  assert.equal(fault().props.operation, 'settings.flowingBackgroundEnabled');
  assert.equal(fault().props.context, undefined, 'The runtime cause must not be attributed to the failed save.');
  assert.equal(fault().props.observedAt, undefined);
  assert.equal(view().find(node => node.props.role === 'switch').props['aria-checked'], true);
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

test('settings group twenty switches under five panels and default to General', async () => {
  const app = await mount({ desktop: true });
  app.set({ notificationsEnabled: true });
  const groups = {
    general: ['notificationsEnabled', 'notificationSoundEnabled'],
    interface: ['showThinkingEffortSwitcher', 'showThemeSwitcher', 'flowingBackgroundEnabled', 'whaleMotionEnabled', 'showVersion'],
    enhancements: ['skillManagerEnabled', 'mcpManagerEnabled', 'personalizationEnabled', 'archiveManagerEnabled'],
    simplify: ['blockOfficialAccount', 'blockOfficialSearch', 'blockOfficialTelemetry', 'blockTodo', 'blockPlan', 'blockGoal'],
    other: ['showRefreshButton', 'showRestartButton', 'blockDoubleClickRename'],
  };
  const fields = [];
  for (const [id, expected] of Object.entries(groups)) {
    if (id !== 'general') app.selectSettingsTab(id);
    const view = descendants(app.renderSettings());
    const tabs = view.filter(node => node.props.role === 'tab');
    assert.deepEqual(tabs.map(tab => tab.props.children[0]), ['generalTab', 'interfaceTab', 'enhancementsTab', 'simplifyTab', 'otherTab']);
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
  assert.equal(new Set(fields).size, 20);
  app.unmount();
});

test('settings tabs support wrapping arrow keys, Home and End with selection and focus together', async () => {
  const app = await mount();
  const tabs = () => descendants(app.renderSettings()).filter(node => node.props.role === 'tab');
  for (const [key, expected] of [
    ['ArrowLeft', 'other'], ['ArrowRight', 'general'], ['ArrowRight', 'interface'],
    ['ArrowRight', 'enhancements'], ['ArrowRight', 'simplify'], ['ArrowRight', 'other'],
    ['ArrowRight', 'general'], ['End', 'other'], ['ArrowLeft', 'simplify'],
    ['ArrowLeft', 'enhancements'], ['ArrowLeft', 'interface'], ['ArrowLeft', 'general'],
    ['Home', 'general'],
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
