import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mount, descendants } from '../../../../tests/helpers/client-fixture.mjs';

test('double-click blocking persists through the switch and only intercepts session row gestures', async () => {
  const app = await mount();
  const element = (tagName, attributes = {}, extra = {}) => ({ tagName, getAttribute: name => attributes[name] ?? null, ...extra });
  const title = element('SPAN');
  const row = element('DIV', { role: 'treeitem', 'data-row-key': 'session:one' });
  const control = () => descendants(app.selectSettingsTab('other')).find(node => node.props.id === 'settings-test-blockDoubleClickRename');
  assert.equal(control().props['aria-checked'], false);
  assert.equal(app.doubleClickListeners.size, 0);
  assert.equal(app.doubleClick([title, row]), false);
  await control().props.onClick();
  assert.equal(control().props['aria-checked'], true);
  assert.equal(app.doubleClickListeners.size, 1);
  app.set({ blockDoubleClickRename: true });
  assert.equal(app.doubleClickListeners.size, 1, 'Repeated config notifications must not duplicate the capture listener.');
  assert.equal(app.doubleClick([title, row]), true);
  assert.equal(app.doubleClick([title, row], 1), false);
  assert.equal(app.doubleClick([title, element('DIV', { role: 'treeitem', 'data-row-key': 'workspace:one' })]), false);
  assert.equal(app.doubleClick([title, element('DIV', { role: 'treeitem' })]), false);
  assert.equal(app.doubleClick([title]), false);
  for (const target of [element('BUTTON'), element('INPUT'), element('TEXTAREA'), element('SELECT'), element('A'),
    element('SPAN', {}, { isContentEditable: true }), element('SPAN', { role: 'switch' }), element('SPAN', { role: 'menuitem' })]) {
    assert.equal(app.doubleClick([title, target, row]), false, 'Interactive controls retain their own gestures.');
  }
  app.setFormStatus('loading');
  assert.equal(app.doubleClickListeners.size, 0);
  app.setFormStatus('ready');
  assert.equal(app.doubleClickListeners.size, 1);
  await control().props.onClick();
  assert.equal(app.doubleClickListeners.size, 0);
  assert.equal(app.doubleClick([title, row]), false);
  app.set({ blockDoubleClickRename: true });
  app.unmount();
  assert.equal(app.doubleClickListeners.size, 0);
  assert.equal(app.subscriptions(), 0);
});

test('failed double-click preference saves leave the gesture enabled', async () => {
  const app = await mount({ formReply: () => false });
  const control = () => descendants(app.selectSettingsTab('other')).find(node => node.props.id === 'settings-test-blockDoubleClickRename');
  await control().props.onClick();
  assert.equal(control().props['aria-checked'], false);
  assert.equal(app.doubleClickListeners.size, 0);
  assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes('saveFailed')));
  app.unmount();
});
