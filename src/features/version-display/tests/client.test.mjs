import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mount, descendants } from '../../../../tests/helpers/client-fixture.mjs';

test('version badge works without theme and calls the native updater once per click operation', async () => {
  const opened = Promise.withResolvers();
  let calls = 0;
  const app = await mount({ themeAvailable: false, updates: { open() { calls++; return opened.promise; } } });
  app.set({ showVersion: true, showThemeSwitcher: true });
  assert.equal(app.render(), null);
  const badge = descendants(app.renderVersion()).find(node => node.props.className === 'power-dsh-version-badge');
  assert.ok(badge);
  assert.equal(badge.props.children[0], '0.2.2-rc.1');
  const first = badge.props.onClick();
  await badge.props.onClick();
  assert.equal(calls, 1);
  opened.resolve();
  await first;
  assert.equal(app.renderVersion(false), null);
  app.unmount();
});

test('browser version badge is visible with its updater action disabled', async () => {
  const app = await mount();
  app.set({ showVersion: true });
  const badge = descendants(app.renderVersion()).find(node => node.props.className === 'power-dsh-version-badge');
  assert.equal(badge.props.disabled, true);
  app.unmount();
});
