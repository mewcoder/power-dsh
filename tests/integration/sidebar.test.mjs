import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mount, button, headerTrigger, headerPosition, openHeaderMenu, descendants } from '../helpers/client-fixture.mjs';

test('the Windows shared menu stays immediately after the sidebar toggle regardless of native menu width', async () => {
  const app = await mount({ windows: true });
  app.set({ showRefreshButton: true, showRestartButton: true });
  assert.equal(headerPosition(app).left, 44, 'Show beside the toggle even before the native menu mounts.');
  app.setNativeMenu({ right: 174, width: 126 });
  assert.equal(headerPosition(app).left, 44);
  assert.deepEqual(Array.from(openHeaderMenu(app).props.items, item => item.id), ['refresh']);
  app.resize(400);
  assert.equal(headerPosition(app).left, 44);
  app.resizeNativeMenu({ right: 1200, width: 1152 });
  assert.equal(headerPosition(app).left, 44, 'A wide native menu must not push the trigger to the far right.');
  app.setNativeMenu(null);
  assert.equal(headerPosition(app).left, 44);
  app.setNativeMenu({ right: 160, width: 112 });
  assert.equal(headerPosition(app).left, 44);
  assert.equal(app.chromeGeometry().menuResizes, 0, 'Positioning no longer observes native menu geometry.');
  assert.equal(app.renderHeader(false), null);
  assert.deepEqual(app.chromeGeometry(), { mutations: 0, menuResizes: 0 });
  app.renderHeader(true);
  assert.equal(headerPosition(app).left, 44);
  app.set({ showRefreshButton: false, showRestartButton: false });
  assert.equal(app.renderHeader(), null);
  assert.deepEqual(app.chromeGeometry(), { mutations: 0, menuResizes: 0 });
  app.unmount();
  assert.deepEqual(app.chromeGeometry(), { mutations: 0, menuResizes: 0 });
});

test('the actual registered footer resolves its components and exposes one menu for every action preference combination', async () => {
  for (const [refresh, restart] of [[false, false], [true, false], [false, true], [true, true]]) {
    let reloads = 0;
    const app = await mount({ desktop: true, reload: () => { reloads++; } });
    app.set({ showVersion: true, showThemeSwitcher: true, showRefreshButton: refresh, showRestartButton: restart });
    app.renderFooter();
    await new Promise(resolve => setImmediate(resolve));
    const footer = app.renderFooter();
    assert.equal(footer.props.className, 'power-dsh-footer-seat');
    const triggers = descendants(footer).filter(node => node.props.className === 'power-dsh-header-button');
    assert.equal(triggers.length, refresh || restart ? 1 : 0);
    assert.ok(!descendants(footer).some(node => node.props.className === 'power-dsh-refresh-button' || node.props.className === 'power-dsh-restart-button'));
    if (triggers.length) {
      triggers[0].props.onClick({ stopPropagation() {} });
      const menu = descendants(app.renderFooter()).find(node => node.type === 'native-menu-fixture');
      assert.deepEqual(Array.from(menu.props.items, item => item.id), [...refresh ? ['refresh'] : [], ...restart ? ['restart'] : []]);
      assert.ok(menu.props.open);
      menu.props.onClose();
      assert.equal(headerTrigger(app).props['aria-expanded'], false);
    }
    assert.equal(reloads, 0, 'Rendering, opening and closing the shared menu must not reload.');
    assert.equal(app.restartCalls.length, 0, 'Rendering, opening and closing the shared menu must not restart.');
    assert.ok(!descendants(app.renderFooter(false)).some(node => node.props.className === 'power-dsh-header-button'));
    app.unmount();
    assert.equal(app.geometry().listeners, 0);
  }
});

test('shared menu selections reject dismissed requests, changed preferences, collapsed sidebar and unmounted controls', async () => {
  for (const invalidation of ['close', 'new-menu', 'disable', 'collapse', 'unload']) {
    let reloads = 0;
    const app = await mount({ reload: () => { reloads++; } });
    app.set({ showRefreshButton: true });
    const previous = openHeaderMenu(app);
    const select = previous.props.onSelect;
    if (invalidation === 'close' || invalidation === 'new-menu') previous.props.onClose();
    if (invalidation === 'new-menu') openHeaderMenu(app);
    if (invalidation === 'disable') app.set({ showRefreshButton: false });
    if (invalidation === 'collapse') app.renderHeader(false);
    if (invalidation === 'unload') app.unmount();
    select('refresh');
    assert.equal(reloads, 0, invalidation);
    if (invalidation !== 'unload') app.unmount();
  }
});
