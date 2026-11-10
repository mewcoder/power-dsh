import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mount, headerTrigger, headerMenu, headerPosition, openHeaderMenu, headerAction, descendants, restartControl, restartDialog, restartConfirmButton, enableRestart } from '../../../../tests/helpers/client-fixture.mjs';

test('restart opens shared Modal and Buttons, and sends only one request after explicit confirmation', async () => {
  const app = await mount({ desktop: true });
  assert.equal(app.renderHeader(), null);
  const toggle = descendants(app.selectSettingsTab('other')).find(node => node.props.id === 'settings-test-showRestartButton');
  await toggle.props.onClick();
  assert.equal(app.restartCalls.length, 0);
  app.renderHeader();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(headerPosition(app).left, 220);
  assert.deepEqual(Array.from(openHeaderMenu(app).props.items, item => item.id), ['restart']);
  app.set({ showRefreshButton: true });
  assert.equal(headerPosition(app).left, 220, 'A second action belongs in the same menu, without shifting the trigger.');
  assert.deepEqual(Array.from(openHeaderMenu(app).props.items, item => item.id), ['refresh', 'restart']);
  const control = restartControl(app);
  const previousTrigger = headerTrigger(app).props.onClick;
  control.props.onClick();
  previousTrigger({ stopPropagation() {} });
  assert.equal(headerMenu(app).props.open, false, 'An older menu trigger must read the live confirmation guard.');
  control.props.onClick();
  assert.equal(app.restartCalls.length, 0, 'Opening the modal must never restart the application.');
  const dialog = restartDialog(app);
  assert.equal(dialog.props.title, 'restart');
  assert.equal(dialog.props.description, 'restartConfirm');
  assert.equal(dialog.props.closeLabel, 'close');
  const actions = descendants(dialog).filter(node => node.props['data-native-button']);
  assert.deepEqual(actions.map(node => node.props.variant), ['outline', 'primary']);
  assert.equal(actions[0].props['data-modal-autofocus'], true, 'The shared modal should initially focus Cancel.');
  actions[1].props.onClick();
  actions[1].props.onClick();
  assert.equal(app.restartCalls.length, 1, 'Duplicate confirmation callbacks must not send a second request.');
  assert.equal(restartDialog(app), undefined);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.renderHeader(false), null);
  assert.deepEqual(app.intervals(), []);
  app.unmount();
  assert.equal(app.geometry().listeners, 0);
});

test('Cancel and the shared close callback never restart; callbacks from a dismissed dialog cannot confirm a new one', async () => {
  const app = await mount({ desktop: true });
  await enableRestart(app);
  restartControl(app).props.onClick({ stopPropagation() {} });
  const staleConfirm = restartConfirmButton(app).props.onClick;
  const cancel = descendants(restartDialog(app)).find(node => node.props.children?.includes('cancel'));
  cancel.props.onClick();
  assert.equal(restartDialog(app), undefined);
  staleConfirm();
  restartControl(app).props.onClick({ stopPropagation() {} });
  staleConfirm();
  assert.ok(restartDialog(app));
  // Native Modal routes Escape, mask clicks and the close icon through onClose.
  restartDialog(app).props.onClose();
  assert.equal(restartDialog(app), undefined);
  assert.equal(app.restartCalls.length, 0);
  app.unmount();
});

test('hidden or disabled restart controls dismiss confirmation and reject captured confirm callbacks', async () => {
  for (const hide of ['collapse', 'disable']) {
    const app = await mount({ desktop: true });
    await enableRestart(app);
    restartControl(app).props.onClick({ stopPropagation() {} });
    const staleConfirm = restartConfirmButton(app).props.onClick;
    if (hide === 'disable') app.set({ showRestartButton: false });
    assert.equal(app.renderHeader(hide !== 'collapse'), null);
    staleConfirm();
    assert.equal(app.restartCalls.length, 0);
    app.set({ showRestartButton: true });
    app.renderHeader();
    assert.equal(restartDialog(app), undefined, 'A dismissed confirmation must not reopen when the button returns.');
    app.unmount();
  }
});

test('Web and Windows hide the restart setting while preserving its preference and the refresh action', async () => {
  for (const options of [{ desktop: false }, { desktop: true, windows: true }]) {
    const app = await mount(options);
    try {
      app.set({ showRestartButton: true, showRefreshButton: true });
      const fields = descendants(app.selectSettingsTab('other')).filter(node => node.props.role === 'switch').map(node => node.props.id);
      assert.equal(fields.includes('settings-test-showRestartButton'), false, 'Unsupported platforms do not offer the restart switch.');
      assert.equal(fields.includes('settings-test-showRefreshButton'), true);
      assert.deepEqual(Array.from(openHeaderMenu(app).props.items, item => item.id), ['refresh']);
      assert.equal(app.settingsProps().source.getSnapshot().value.showRestartButton, true, 'Hiding an unavailable option must preserve its saved value.');
      assert.equal(restartDialog(app), undefined);
      assert.equal(app.restartCalls.length, 0);
      assert.deepEqual(app.intervals(), [], 'Unsupported platforms must not poll restart status.');
    } finally { app.unmount(); }
  }
});

test('Web and unsupported Hosts show neither restart button nor confirmation', async () => {
  for (const options of [{ desktop: false }, { desktop: true, restartStatus: { supported: false, running: false, error: '' } }]) {
    const app = await mount(options);
    await enableRestart(app);
    assert.equal(restartControl(app), undefined);
    assert.equal(restartDialog(app), undefined);
    assert.equal(app.restartCalls.length, 0);
    app.unmount();
  }
});

test('running restart disables only its menu item while refresh remains usable, and live preferences reject stale confirmation', async () => {
  let reloads = 0;
  const status = { supported: true, running: false, error: '' };
  const app = await mount({ desktop: true, restartStatus: status, reload: () => { reloads++; } });
  await enableRestart(app);
  app.set({ showRefreshButton: true });
  const staleMenu = openHeaderMenu(app);
  status.running = true;
  await app.tickIntervals();
  staleMenu.props.onSelect('restart');
  assert.equal(restartDialog(app), undefined);
  const menu = openHeaderMenu(app);
  assert.equal(menu.props.items.find(item => item.id === 'restart').disabled, true);
  assert.ok(!menu.props.items.find(item => item.id === 'refresh').disabled);
  headerAction(app, 'restart').props.onClick();
  assert.equal(restartDialog(app), undefined, 'A captured disabled row must not start confirmation.');
  headerAction(app, 'refresh').props.onClick();
  assert.equal(reloads, 1);
  assert.equal(app.restartCalls.length, 0);
  status.running = false;
  await app.tickIntervals();
  restartControl(app).props.onClick();
  const confirm = restartConfirmButton(app).props.onClick;
  app.set({ showRestartButton: false });
  confirm();
  assert.equal(app.restartCalls.length, 0, 'Confirmation reads the latest saved preference even before rendering.');
  assert.equal(restartDialog(app), undefined);
  assert.deepEqual(Array.from(openHeaderMenu(app).props.items, item => item.id), ['refresh']);
  app.unmount();
});

test('restart failures allow reopening confirmation and running helpers disable repeated requests', async () => {
  const status = { supported: true, running: false, error: '' };
  const app = await mount({ desktop: true, restartStatus: status,
    restartReply: async () => ({ ok: false, error: { message: 'restartFailed' } }) });
  await enableRestart(app);
  restartControl(app).props.onClick({ stopPropagation() {} });
  restartConfirmButton(app).props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  const tree = app.renderHeader();
  assert.ok(descendants(tree).some(node => node.props.role === 'alert' && node.props.children.includes('restartFailed')));
  assert.equal(restartControl(app).props.disabled, false);
  restartControl(app).props.onClick({ stopPropagation() {} });
  assert.ok(restartDialog(app));
  const staleConfirm = restartConfirmButton(app).props.onClick;
  status.running = true;
  await app.tickIntervals();
  assert.equal(restartControl(app).props.disabled, true);
  assert.equal(restartDialog(app), undefined);
  staleConfirm();
  assert.equal(app.restartCalls.length, 1);
  app.unmount();
});
