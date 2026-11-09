import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mount, button } from '../../../../tests/helpers/client-fixture.mjs';

test('appearance visibility is independent of account blocking and never replaces the native launcher', async () => {
  const app = await mount();
  assert.equal(app.render(), null);
  for (const blocked of [false, true]) {
    app.set({ showThemeSwitcher: true, blockOfficialAccount: blocked });
    assert.ok(button(app.render()));
    assert.equal(app.entries.get('settings.launcher:single'), app.nativeLauncher);
    assert.equal(app.render(false), null);
    app.set({ showThemeSwitcher: false });
    assert.equal(app.render(), null);
  }
  app.unmount();
  assert.equal(app.entries.has('sidebar.footer.action:power-dsh-footer'), false);
  assert.equal(app.entries.get('settings.launcher:single'), app.nativeLauncher);
});

test('appearance button follows native preference, reuses its icon, and stops click propagation', async () => {
  const app = await mount();
  app.set({ showThemeSwitcher: true });
  let stopped = 0;
  for (const [next, glyph] of [['light', 'followsystem-outline'], ['dark', 'light-outline'], ['system', 'dark-outline']]) {
    const control = button(app.render());
    assert.equal(control.props.disabled, false);
    assert.equal(control.props.children[0].props.glyph, glyph);
    control.props.onClick({ stopPropagation() { stopped++; } });
    assert.equal(app.calls.at(-1), next);
  }
  assert.equal(stopped, 3);
  app.unmount();
});

test('appearance shares the settings row and releases geometry observers on collapse', async () => {
  const app = await mount();
  app.set({ showThemeSwitcher: true });
  assert.equal(button(app.render()).props.style.left, 240);
  app.resize(360);
  assert.equal(button(app.render()).props.style.left, 320);
  assert.equal(app.render(false), null);
  assert.equal(app.geometry().listeners, 0);
  assert.equal(app.geometry().observeCount, app.geometry().disconnectCount);
  app.unmount();
});

test('appearance yields to reconnect and recovery, cancels pending recovery on another outage, and cleans up', async () => {
  const app = await mount();
  app.set({ showThemeSwitcher: true });
  assert.ok(button(app.render()));
  app.setConnectionState('connecting');
  assert.equal(app.render(), null);
  app.setConnectionState('connected');
  assert.equal(app.render(), null);
  assert.equal([...app.timers.values()][0].ms, 3000);
  app.setConnectionState('disconnected');
  assert.equal(app.timers.size, 0);
  assert.equal(app.render(), null);
  app.setConnectionState('connected');
  const timer = [...app.timers.values()][0];
  timer.fn();
  assert.ok(button(app.render()));
  app.unmount();
  assert.equal(app.connectionStateListeners.size, 0);
  assert.equal(app.timers.size, 0);
});

test('appearance yields to native update phases and ignores a stale initial status response', async () => {
  let listener;
  let removed = 0;
  const status = Promise.withResolvers();
  const app = await mount({ updates: {
    status: () => status.promise,
    subscribe(fn) { listener = fn; return () => { removed++; }; },
  } });
  app.set({ showThemeSwitcher: true });
  assert.equal(app.render(), null);
  listener({ phase: 'downloading' });
  status.resolve({ phase: 'idle' });
  await status.promise;
  assert.equal(app.render(), null);
  listener({ phase: 'idle' });
  assert.ok(button(app.render()));
  listener({ phase: 'error' });
  assert.equal(app.render(), null);
  app.unmount();
  assert.equal(removed, 1);
});
