import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mount, notificationSession, notificationSwitch, loadedSoundSettings, soundControl, notificationSoundSwitch, button, descendants } from '../../../../tests/helpers/client-fixture.mjs';

test('task notification permission is requested from the switch before refreshing settings, then persists', async () => {
  const granted = Promise.withResolvers();
  let described = 0;
  const app = await mount({ notificationPermission: 'default', notificationRequest: () => granted.promise, formLoad: () => { described++; } });
  const action = notificationSwitch(app).props.onClick();
  assert.equal(app.permissionRequests(), 1);
  assert.equal(described, 0, 'Permission must be requested before an unrelated await loses user activation.');
  assert.equal(notificationSwitch(app).props['aria-busy'], true);
  await notificationSwitch(app).props.onClick();
  assert.equal(app.permissionRequests(), 1);
  granted.resolve('granted');
  await action;
  assert.equal(described, 1);
  assert.equal(notificationSwitch(app).props['aria-checked'], true);
  assert.equal(app.notifications.length, 0, 'Enabling must not send a test or history notification.');
  app.unmount();
});

test('permission denial, unsupported environments, missing services and rejected saves leave notifications off', async () => {
  for (const [options, expected] of [
    [{ notificationPermission: 'denied' }, 'notificationPermission'],
    [{ notificationPermission: 'default', notificationRequest: () => 'denied' }, 'notificationPermission'],
    [{ notificationsAvailable: false }, 'notificationUnsupported'],
    [{ notificationServices: false }, 'notificationUnavailable'],
    [{ formReply: () => false }, 'saveFailed'],
  ]) {
    const app = await mount(options);
    await notificationSwitch(app).props.onClick();
    assert.equal(notificationSwitch(app).props['aria-checked'], false);
    assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes(expected)));
    app.unmount();
  }
});

test('muted completion and error notifications are silent, deduplicated, and omit subagent or stopped turns', async () => {
  const app = await mount();
  app.setSessions([notificationSession()]);
  app.set({ notificationsEnabled: true, notificationSoundEnabled: false });
  app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false })]);
  assert.equal(app.notifications.length, 1);
  assert.equal(app.notifications[0].title, 'notificationComplete');
  assert.equal(app.notifications[0].options.silent, true);
  assert.equal(app.notifications[0].options.body, 'Build the project');
  assert.equal(Object.hasOwn(app.notifications[0].options, 'requireInteraction'), false);
  app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false })]);
  assert.equal(app.notifications.length, 1);
  app.setSessions([notificationSession({ seq: 12, reason: 'error', running: false })]);
  assert.equal(app.notifications.length, 2);
  assert.equal(app.notifications[1].title, 'notificationError');
  assert.equal(Object.hasOwn(app.notifications[1].options, 'requireInteraction'), false);
  assert.equal(app.notifications[0].closed, true);
  for (const reason of ['aborted', 'interrupted', 'max-tokens', 'forked', 'future-reason']) {
    app.setSessions([notificationSession({ seq: 20 + reason.length, reason, running: false })]);
  }
  app.setSessions([notificationSession({ id: 'child', origin: 'subagent' })]);
  app.setSessions([notificationSession({ id: 'child', seq: 90, reason: 'completed', origin: 'subagent', running: false })]);
  assert.equal(app.notifications.length, 2);
  app.unmount();
});

test('same-session replacements release old instances and preserve other sessions until cleanup', async () => {
  const app = await mount();
  const other = notificationSession({ id: 'other', seq: 10, reason: 'completed', running: false });
  app.setSessions([notificationSession(), notificationSession({ id: 'other' })]);
  app.set({ notificationsEnabled: true });
  app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false }), other]);
  assert.equal(app.notifications.length, 2);
  const previous = app.notifications[0];
  const lateClose = previous.onclose;
  app.setSessions([notificationSession({ seq: 20, reason: 'error', running: false }), other]);
  const replacement = app.notifications.at(-1);
  assert.equal(app.notifications.length, 3);
  assert.equal(previous.closed, true);
  assert.equal(Object.hasOwn(replacement.options, 'tag'), false);
  assert.equal(replacement.closed, false, 'The replacement remains open after the old instance closes.');
  assert.equal(app.notifications[1].closed, false, 'A separate session keeps its own banner.');
  lateClose();
  app.set({ notificationsEnabled: false });
  assert.equal(replacement.closed, true, 'A late close event from the old banner must not lose the replacement.');
  assert.equal(app.notifications[1].closed, true);
  app.unmount();
});

test('local Windows desktop uses the Host for every repeated trigger and preserves native sound routing', async () => {
  for (const preferences of [
    { notificationSoundEnabled: false, notificationSound: 'default' },
    { notificationSoundEnabled: true, notificationSound: 'win:SystemExclamation' },
  ]) {
    const app = await mount({ windows: true, desktop: true, notificationsAvailable: false });
    try {
      app.setSessions([notificationSession()]);
      app.set({ notificationsEnabled: true, ...preferences });
      for (let round = 1; round <= 2; round++) {
        app.setSessionStatus([['task', { running: true }]]);
        app.setSessions([notificationSession({ seq: round * 10, reason: 'completed', running: false })]);
        app.setSessions([notificationSession({ seq: round * 10 + 1, reason: 'error', running: false })]);
        app.setSessionStatus([['task', { running: true, pendingInteraction: { key: `question:${round}`, kind: 'question' } }]]);
        app.setSessionStatus([['task', { running: true, pendingInteraction: { key: `approval:${round}`, kind: 'approval' } }]]);
      }
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(app.notifications.length, 0, 'The affected renderer Notification API is never used.');
      assert.equal(app.nativeNotifications.length, 8);
      assert.deepEqual(app.nativeNotifications.map(notification => notification.title), [
        'notificationComplete', 'notificationError', 'notificationInput', 'notificationApproval',
        'notificationComplete', 'notificationError', 'notificationInput', 'notificationApproval',
      ]);
      assert.equal(new Set(app.nativeNotifications.map(notification => notification.tag)).size, 1);
      for (const notification of app.nativeNotifications) {
        assert.match(notification.group, /^[a-z0-9]{1,16}$/);
        assert.match(notification.tag, /^[a-z0-9]{1,16}$/);
        assert.equal(notification.preview, false);
        assert.equal(Object.hasOwn(notification, 'silent'), false, 'The Host reads the authoritative sound preference.');
      }
      assert.deepEqual(app.nativeNotifications.map(notification => notification.attention), [false, false, true, true, false, false, true, true]);
      assert.deepEqual(app.soundPlays, preferences.notificationSoundEnabled
        ? Array.from({ length: 8 }, () => ({ id: preferences.notificationSound, preview: false })) : []);
    } finally {
      app.unmount();
    }
  }
});

test('Windows Host delivery cannot fall back to renderer when desktop bridge and platform markers are absent', async () => {
  const app = await mount({ windows: true, desktop: false, platformMarker: false, notificationPermission: 'denied' });
  app.setSessions([notificationSession()]);
  await notificationSwitch(app).props.onClick();
  assert.equal(notificationSwitch(app).props['aria-checked'], true);
  app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false })]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.notifications.length, 0);
  assert.equal(app.nativeNotifications.length, 1);
  assert.equal(app.permissionRequests(), 0);
  const testButton = descendants(app.renderSettings()).find(node => node.type === 'button' && node.props.children.includes('notificationTest'));
  await testButton.props.onClick();
  assert.equal(app.nativeNotifications.length, 2);
  assert.equal(app.notifications.length, 0);
  assert.ok(descendants(app.renderSettings()).some(node => node.props.children.some(child => typeof child === 'string' && child.includes('notificationNative'))));
  app.set({ notificationMode: 'never' });
  await testButton.props.onClick();
  assert.equal(app.nativeNotifications.length, 2, 'A stale test button cannot bypass the current policy.');
  app.unmount();
});

test('unknown, unavailable or mismatched local Host transport never silently sends browser notifications', async () => {
  for (const reply of [
    { ok: false, error: { message: 'private detail' } },
    { ok: true, value: { platform: 'win32', nativeAvailable: false, version: '0.0.5' } },
    { ok: true, value: { platform: 'win32', nativeAvailable: true, version: '0.0.1' } },
  ]) {
    const app = await mount({ windows: true, notificationTransportReply: () => reply });
    app.setSessions([notificationSession()]);
    app.set({ notificationsEnabled: true });
    app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false })]);
    assert.equal(app.notifications.length, 0);
    assert.equal(app.nativeNotifications.length, 0);
    assert.ok(app.settingsProps().notificationsSource.getSnapshot().error);
    app.unmount();
  }
});

test('notification policy persists and switches focused completions between background, always and never', async () => {
  const app = await mount({ windows: true, platformMarker: false });
  const row = notificationSession({ retainedBy: { mainView: 1 } });
  app.setSessions([row]);
  app.set({ notificationsEnabled: true, notificationSoundEnabled: false });
  app.setDocument({ hidden: false, focused: true });
  app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false, retainedBy: { mainView: 1 } })]);
  assert.equal(app.nativeNotifications.length, 0);
  const menu = () => descendants(app.renderSettings()).find(node => node.type === 'native-menu-fixture' && node.props.items.some(item => item.id === 'always'));
  await menu().props.onSelect('always');
  assert.equal(app.settingsProps().source.getSnapshot().value.notificationMode, 'always');
  assert.equal(app.nativeNotifications.length, 0, 'Changing policy never replays an old completion.');
  app.setSessions([notificationSession({ seq: 20, reason: 'completed', running: false, retainedBy: { mainView: 1 } })]);
  assert.equal(app.nativeNotifications.length, 1);
  await menu().props.onSelect('never');
  app.setSessions([notificationSession({ seq: 30, reason: 'error', running: false })]);
  app.setSessionStatus([['task', { running: true, pendingInteraction: { key: 'blocked', kind: 'approval' } }]]);
  assert.equal(app.nativeNotifications.length, 1, 'Never applies to every task reminder.');
  assert.equal(app.nativeClears.length, 1);
  app.unmount();
});

test('failed notification policy saves preserve the old policy and show feedback at the menu', async () => {
  const app = await mount({ formReply: () => false });
  app.set({ notificationsEnabled: true });
  const menu = descendants(app.renderSettings()).find(node => node.type === 'native-menu-fixture' && node.props.items.some(item => item.id === 'always'));
  await menu.props.onSelect('always');
  assert.equal(app.settingsProps().source.getSnapshot().value.notificationMode, 'background');
  const view = descendants(app.renderSettings());
  const control = view.find(node => node.type === 'button' && node.props['aria-label'] === 'notificationMode');
  assert.equal(control.props['aria-invalid'], true);
  assert.ok(view.some(node => node.props.role === 'alert' && node.props.children.includes('saveFailed')));
  app.unmount();
});

test('transport handshake and reconnect seed history rather than deliver before the route is known', async () => {
  const delayed = Promise.withResolvers();
  const app = await mount({ windows: true, notificationTransportReply: () => delayed.promise });
  app.setSessions([notificationSession()]);
  app.set({ notificationsEnabled: true });
  app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false })]);
  assert.equal(app.notifications.length, 0);
  assert.equal(app.nativeNotifications.length, 0);
  const { version } = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../../../../package.json', import.meta.url), 'utf8'));
  delayed.resolve({ ok: true, value: { platform: 'win32', nativeAvailable: true, version } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.nativeNotifications.length, 0);
  app.setSessions([notificationSession({ seq: 20, reason: 'completed', running: false })]);
  assert.equal(app.nativeNotifications.length, 1);
  app.unmount();
});

test('Windows default-sound preview uses the native channel without renderer permission or saving again', async () => {
  let saves = 0;
  const app = await mount({ windows: true, desktop: true, notificationPermission: 'denied', notificationsAvailable: false,
    formLoad: () => { saves++; } });
  await notificationSwitch(app).props.onClick();
  assert.equal(notificationSwitch(app).props['aria-checked'], true);
  assert.equal(app.permissionRequests(), 0);
  const previousSaves = saves;
  await loadedSoundSettings(app);
  const menu = descendants(app.renderSettings()).find(node => node.type === 'native-menu-fixture' && node.props.items.some(item => item.id === 'default'));
  await menu.props.onSelect('default');
  await menu.props.onSelect('default');
  assert.equal(saves, previousSaves);
  assert.equal(app.notifications.length, 0);
  assert.equal(app.nativeNotifications.length, 2);
  assert.equal(app.nativeNotifications[0].group, app.nativeNotifications[1].group);
  assert.equal(app.nativeNotifications[0].tag, 'preview');
  assert.equal(app.nativeNotifications[0].preview, true);
  assert.equal(app.nativeNotifications[0].attention, false);
  assert.deepEqual(app.soundPlays, []);
  app.resetConnection();
  assert.deepEqual(app.nativeClears, [{ group: app.nativeNotifications[0].group, tag: '' }]);
  await loadedSoundSettings(app);
  await menu.props.onSelect('default');
  assert.notEqual(app.nativeNotifications[2].group, app.nativeNotifications[0].group);
  app.set({ notificationSoundEnabled: false });
  assert.deepEqual(app.nativeClears.at(-1), { group: app.nativeNotifications[2].group, tag: '' });
  app.unmount();
});

test('Windows native notification cleanup isolates sessions, rotates groups on reconnect, and does not replay history', async () => {
  const app = await mount({ windows: true, desktop: true });
  const other = notificationSession({ id: 'other' });
  app.setSessions([notificationSession(), other]);
  app.set({ notificationsEnabled: true, notificationSoundEnabled: false });
  app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false }),
    notificationSession({ id: 'other', seq: 10, reason: 'completed', running: false })]);
  assert.equal(app.nativeNotifications.length, 2);
  const first = app.nativeNotifications[0];
  const second = app.nativeNotifications[1];
  assert.equal(first.group, second.group);
  assert.notEqual(first.tag, second.tag);
  app.setSessions([notificationSession({ id: 'other', seq: 10, reason: 'completed', running: false })]);
  assert.deepEqual(app.nativeClears, [{ group: first.group, tag: first.tag }]);
  app.resetConnection();
  assert.deepEqual(app.nativeClears.at(-1), { group: first.group, tag: '' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.nativeNotifications.length, 2);
  app.setSessions([notificationSession({ id: 'other', seq: 20, reason: 'error', running: false })]);
  const third = app.nativeNotifications[2];
  assert.notEqual(third.group, first.group);
  app.set({ notificationsEnabled: false });
  assert.deepEqual(app.nativeClears.at(-1), { group: third.group, tag: '' });
  app.setSessions([notificationSession({ id: 'other', seq: 30, reason: 'completed', running: false })]);
  assert.equal(app.nativeNotifications.length, 3);
  app.unmount();
});

test('Windows native send failure reports the notification error and never plays a tone or silently falls back', async () => {
  const app = await mount({ windows: true, desktop: true,
    nativeNotificationReply: () => ({ ok: false, error: { message: 'private subprocess details' } }) });
  app.setSessions([notificationSession()]);
  app.set({ notificationsEnabled: true, notificationSoundEnabled: true, notificationSound: 'win:SystemExclamation' });
  app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false })]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.settingsProps().notificationsSource.getSnapshot().error, 'notificationFailed');
  assert.equal(app.notifications.length, 0);
  assert.deepEqual(app.soundPlays, []);
  app.unmount();
});

test('Windows native completion acknowledgements cannot play audio after disable, session removal, reconnect or unload', async () => {
  for (const dispose of [
    app => app.set({ notificationsEnabled: false }),
    app => app.setSessions([]),
    app => app.resetConnection(),
    app => app.unmount(),
  ]) {
    const delayed = Promise.withResolvers();
    const app = await mount({ windows: true, desktop: true, nativeNotificationReply: () => delayed.promise });
    app.setSessions([notificationSession()]);
    app.set({ notificationsEnabled: true, notificationSoundEnabled: true, notificationSound: 'win:SystemExclamation' });
    app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false })]);
    dispose(app);
    delayed.resolve({ ok: true, value: { shown: true } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.notifications.length, 0);
    assert.deepEqual(app.soundPlays, []);
    assert.equal(app.nativeClears.length, 1);
    app.unmount();
  }
});

test('remote Windows clients keep browser notifications and cannot route a desktop toast or sound to the server', async () => {
  const app = await mount({ windows: true, desktop: true, localConnection: false });
  app.setSessions([notificationSession()]);
  app.set({ notificationsEnabled: true, notificationSoundEnabled: true, notificationSound: 'win:SystemExclamation' });
  app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false })]);
  assert.equal(app.notifications.length, 1);
  assert.equal(Object.hasOwn(app.notifications[0].options, 'silent'), false);
  assert.equal(app.nativeNotifications.length, 0);
  assert.deepEqual(app.soundPlays, []);
  app.unmount();
});

test('system sound menu saves a native choice, previews it once, and sends one silent banner plus native playback', async () => {
  const app = await mount();
  app.set({ notificationsEnabled: true });
  await loadedSoundSettings(app);
  const settingRows = () => descendants(app.renderSettings()).filter(node => node.props.className === 'power-dsh-setting-row');
  assert.equal(settingRows().length, 5, 'General includes notification policy and the delivery test.');
  const menu = () => descendants(app.renderSettings()).find(node => node.type === 'native-menu-fixture' && node.props.items?.some(item => item.id === 'mac:Ping.aiff'));
  soundControl(app, 'select').props.onClick();
  assert.equal(menu().props.open, true);
  await menu().props.onSelect('mac:Ping.aiff');
  assert.equal(app.settingsProps().source.getSnapshot().value.notificationSound, 'mac:Ping.aiff');
  assert.deepEqual(app.soundPlays, [{ id: 'mac:Ping.aiff', preview: true }], 'Selecting saves and plays without an extra button.');
  assert.equal(soundControl(app, 'preview').props['aria-label'], 'notificationSoundPreview');
  app.setSessions([notificationSession()]);
  app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false })]);
  assert.equal(app.notifications.length, 1);
  assert.equal(app.notifications[0].options.silent, true);
  assert.deepEqual(app.soundPlays[1], { id: 'mac:Ping.aiff', preview: false });
  app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false })]);
  assert.equal(app.soundPlays.length, 2, 'Duplicate frames cannot replay a sound.');
  await soundControl(app, 'preview').props.onClick();
  assert.deepEqual(app.soundPlays[2], { id: 'mac:Ping.aiff', preview: true }, 'The compact icon can replay the selected sound.');
  app.set({ notificationSoundEnabled: false });
  app.setSessions([notificationSession({ seq: 20, reason: 'error', running: false })]);
  assert.equal(app.soundPlays.length, 3);
  assert.equal(soundControl(app, 'select'), undefined);
  assert.equal(soundControl(app, 'preview'), undefined);
  assert.equal(settingRows().length, 4, 'Sound disabled collapses only the tone-selection row.');
  assert.equal(app.notifications[1].options.silent, true);
  app.unmount();
});

test('selecting the current default sound previews without rewriting preferences and cleans up on unload', async () => {
  let saves = 0;
  const app = await mount({ formLoad: () => { saves++; } });
  app.set({ notificationsEnabled: true });
  await loadedSoundSettings(app);
  const menu = descendants(app.renderSettings()).find(node => node.type === 'native-menu-fixture' && node.props.items.some(item => item.id === 'default'));
  await menu.props.onSelect('default');
  assert.equal(saves, 0, 'Reselecting the current tone previews without rewriting it.');
  assert.equal(app.notifications[0].title, 'notificationSoundTestTitle');
  assert.equal(Object.hasOwn(app.notifications[0].options, 'requireInteraction'), false);
  assert.equal(Object.hasOwn(app.notifications[0].options, 'silent'), false);
  assert.equal(app.soundPlays.length, 0);
  await menu.props.onSelect('default');
  assert.equal(saves, 0);
  assert.equal(app.notifications.length, 2);
  assert.equal(app.notifications[0].closed, true);
  assert.equal(Object.hasOwn(app.notifications[1].options, 'tag'), false);
  assert.equal(app.notifications[1].popupSuppressed, false);
  app.unmount();
  assert.equal(app.notifications[1].closed, true);
});

test('a rejected sound selection does not autoplay and disabled sound ignores a stale menu', async () => {
  const app = await mount({ formReply: () => false });
  app.set({ notificationsEnabled: true });
  await loadedSoundSettings(app);
  const menu = descendants(app.renderSettings()).find(node => node.type === 'native-menu-fixture' && node.props.items.some(item => item.id === 'default'));
  await menu.props.onSelect('mac:Ping.aiff');
  assert.equal(app.settingsProps().source.getSnapshot().value.notificationSound, 'default');
  assert.equal(app.soundPlays.length, 0);
  assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes('saveFailed')));
  app.set({ notificationSoundEnabled: false });
  await menu.props.onSelect('mac:Glass.aiff');
  assert.equal(app.soundPlays.length, 0);
  assert.equal(app.settingsProps().source.getSnapshot().value.notificationSound, 'default');
  app.unmount();
});

test('local sound catalog loads without waiting for notification session services', async () => {
  const app = await mount({ notificationServices: false });
  app.set({ notificationsEnabled: true, notificationSound: 'mac:Ping.aiff' });
  await loadedSoundSettings(app);
  assert.equal(app.soundLists(), 1);
  assert.equal(soundControl(app, 'select').props.disabled, false);
  assert.ok(soundControl(app, 'select').props.children.includes('Ping'));
  assert.equal(app.settingsProps().soundsSource.getSnapshot().error, '');
  app.unmount();
});

test('remote connections keep native browser notification sound and never play sounds on the server', async () => {
  const app = await mount({ localConnection: false });
  app.set({ notificationsEnabled: true, notificationSound: 'mac:Ping.aiff' });
  await loadedSoundSettings(app);
  assert.equal(app.soundLists(), 0);
  assert.equal(soundControl(app, 'select').props.disabled, true);
  assert.equal(descendants(app.renderSettings()).some(node => node.props.role === 'alert'), false);
  assert.equal(descendants(app.renderSettings()).some(node => node.props.className === 'power-dsh-prompt-action'), false);
  assert.ok(soundControl(app, 'select').props.children.includes('notificationSoundDefault'));
  app.setSessions([notificationSession()]);
  app.setSessions([notificationSession({ seq: 10, reason: 'error', running: false })]);
  assert.equal(app.notifications.length, 1);
  assert.equal(Object.hasOwn(app.notifications[0].options, 'silent'), false);
  assert.equal(app.soundPlays.length, 0);
  await app.settingsProps().playSystemSound('mac:Ping.aiff', true);
  assert.equal(app.soundPlays.length, 0);
  app.unmount();
});

test('sound preview prevents overlaps, reports playback failure, and ignores stale callbacks after disabling', async () => {
  const deferred = Promise.withResolvers();
  const app = await mount({ soundReply: () => deferred.promise });
  app.set({ notificationsEnabled: true, notificationSound: 'mac:Ping.aiff' });
  await loadedSoundSettings(app);
  const play = app.settingsProps().playSystemSound;
  const first = play('mac:Ping.aiff', true);
  assert.equal(soundControl(app, 'preview').props['aria-busy'], true);
  await play('mac:Ping.aiff', true);
  assert.equal(app.soundPlays.length, 1);
  deferred.resolve({ ok: false, error: { message: 'native failure details' } });
  await first;
  assert.equal(soundControl(app, 'preview').props['aria-busy'], false);
  assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes('notificationSoundFailed')));
  app.set({ notificationSoundEnabled: false });
  await play('mac:Ping.aiff', true);
  assert.equal(app.soundPlays.length, 1);
  app.unmount();
});

test('missing sounds, catalog errors and read-only preferences cannot play or write a different tone', async () => {
  for (const options of [{ soundListError: 'native failure' }, { writable: false }, {}]) {
    const app = await mount(options);
    app.set({ notificationsEnabled: true, notificationSound: 'mac:Missing.aiff' });
    await loadedSoundSettings(app);
    assert.equal(soundControl(app, 'preview').props.disabled, true);
    await app.settingsProps().playSystemSound('mac:Missing.aiff', true);
    assert.equal(app.soundPlays.length, 0);
    if (options.soundListError) {
      assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes('notificationSoundUnavailable')));
    } else {
      assert.ok(soundControl(app, 'select').props.children.includes('notificationSoundMissing'));
    }
    app.unmount();
  }
});

test('Windows aliases are localized through the native menu without exposing script text', async () => {
  const app = await mount({ soundCatalog: { platform: 'win32', sounds: [
    { id: 'default', name: 'default' }, { id: 'win:SystemExclamation', name: 'SystemExclamation' },
  ] } });
  app.set({ notificationsEnabled: true });
  await loadedSoundSettings(app);
  const menu = descendants(app.renderSettings()).find(node => node.type === 'native-menu-fixture' && node.props.items.some(item => item.id === 'default'));
  assert.equal(menu.props.items[1].label, 'soundSystemExclamation');
  app.unmount();
});

test('notification sound follows system defaults, can mute every trigger, and updates without replaying notifications', async () => {
  const app = await mount();
  app.setSessions([notificationSession()]);
  await notificationSwitch(app).props.onClick();
  app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false })]);
  assert.equal(Object.hasOwn(app.notifications[0].options, 'silent'), false);
  assert.equal(Object.hasOwn(app.notifications[0].options, 'renotify'), false);
  await notificationSoundSwitch(app).props.onClick();
  assert.equal(notificationSoundSwitch(app).props['aria-checked'], false);
  assert.equal(app.notifications.length, 1, 'Changing sound cannot replay a completed turn.');
  app.setSessions([notificationSession({ seq: 20, reason: 'error' })]);
  app.setSessionStatus([['task', { running: true, pendingInteraction: { key: 'sound-question', kind: 'question' } }]]);
  app.setSessionStatus([['task', { running: true, pendingInteraction: { key: 'sound-approval', kind: 'approval' } }]]);
  for (const notice of app.notifications.slice(1)) {
    assert.equal(notice.options.silent, true);
    assert.equal(Object.hasOwn(notice.options, 'renotify'), false);
  }
  await notificationSoundSwitch(app).props.onClick();
  app.setSessionStatus([['task', { running: true, pendingInteraction: { key: 'sound-approval-next', kind: 'approval' } }]]);
  assert.equal(Object.hasOwn(app.notifications.at(-1).options, 'silent'), false);
  assert.equal(Object.hasOwn(app.notifications.at(-1).options, 'renotify'), false);
  assert.equal(app.permissionRequests(), 0, 'A sound preference does not require another permission request.');
  app.unmount();
});

test('sound settings appear only while notifications are on and preserve choices across hide and show', async () => {
  let saves = 0;
  const app = await mount({ formLoad: () => { saves++; } });
  app.set({ notificationSound: 'mac:Ping.aiff' });
  await loadedSoundSettings(app);
  const rows = () => descendants(app.renderSettings()).filter(node => node.props.className === 'power-dsh-setting-row');
  assert.equal(rows().length, 1);
  assert.equal(notificationSoundSwitch(app), undefined);
  assert.equal(soundControl(app, 'select'), undefined);
  assert.equal(soundControl(app, 'preview'), undefined);

  await notificationSwitch(app).props.onClick();
  assert.equal(rows().length, 5);
  assert.equal(notificationSoundSwitch(app).props['aria-checked'], true);
  assert.ok(soundControl(app, 'select').props.children.includes('Ping'));
  soundControl(app, 'select').props.onClick();
  const staleMenu = descendants(app.renderSettings()).find(node => node.type === 'native-menu-fixture' && node.props.items.some(item => item.id === 'default'));
  const staleSoundToggle = notificationSoundSwitch(app).props.onClick;
  assert.equal(staleMenu.props.open, true);

  await notificationSwitch(app).props.onClick();
  const savesBeforeStaleCallbacks = saves;
  await staleSoundToggle();
  await staleMenu.props.onSelect('mac:Glass.aiff');
  assert.equal(saves, savesBeforeStaleCallbacks, 'Hidden sound callbacks must not write preferences.');
  assert.equal(rows().length, 1);
  assert.equal(notificationSoundSwitch(app), undefined);
  assert.equal(soundControl(app, 'select'), undefined);
  assert.equal(soundControl(app, 'preview'), undefined);
  assert.equal(app.settingsProps().source.getSnapshot().value.notificationSoundEnabled, true);
  assert.equal(app.settingsProps().source.getSnapshot().value.notificationSound, 'mac:Ping.aiff');
  assert.equal(app.soundPlays.length, 0);

  await notificationSwitch(app).props.onClick();
  assert.equal(notificationSoundSwitch(app).props['aria-checked'], true);
  assert.ok(soundControl(app, 'select').props.children.includes('Ping'));
  assert.equal(descendants(app.renderSettings()).find(node => node.type === 'native-menu-fixture').props.open, false);
  await notificationSoundSwitch(app).props.onClick();
  await notificationSwitch(app).props.onClick();
  assert.equal(notificationSoundSwitch(app), undefined);
  await notificationSwitch(app).props.onClick();
  assert.equal(rows().length, 4);
  assert.equal(notificationSoundSwitch(app).props['aria-checked'], false);
  assert.equal(soundControl(app, 'select'), undefined);
  assert.equal(app.settingsProps().source.getSnapshot().value.notificationSound, 'mac:Ping.aiff');
  assert.equal(app.notifications.length, 0);
  app.unmount();
});

test('failed sound changes restore the saved value and report an inline error', async () => {
  for (const outdated of [false, true]) {
    const app = await mount({ formReply: () => false });
    app.set({ notificationsEnabled: true, ...(outdated ? { notificationSoundEnabled: undefined } : {}) });
    await notificationSoundSwitch(app).props.onClick();
    assert.equal(notificationSoundSwitch(app).props['aria-checked'], !outdated);
    const expected = outdated ? 'notificationUnavailable' : 'saveFailed';
    assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes(expected)));
    app.unmount();
  }
});

test('completion notifications distinguish the visible focused session, background tabs, and another session', async () => {
  const app = await mount();
  app.setSessions([notificationSession({ retainedBy: { mainView: 1 } })]);
  app.set({ notificationsEnabled: true });
  app.setDocument({ hidden: false, focused: true });
  app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false, retainedBy: { mainView: 1 } })]);
  assert.equal(app.notifications.length, 0);
  app.setDocument({ hidden: false, focused: false });
  app.setSessions([notificationSession({ seq: 20, reason: 'error', running: false, retainedBy: { mainView: 1 } })]);
  assert.equal(app.notifications.length, 1);
  app.setDocument({ hidden: false, focused: true });
  app.setSessions([notificationSession({ seq: 30, reason: 'completed', running: false })]);
  assert.equal(app.notifications.length, 2, 'Another session is out of sight even in a focused window.');
  app.notifications[1].onclick();
  assert.equal(app.windowFocusCount(), 1);
  assert.equal(app.notifications[1].closed, true);
  app.unmount();
});

test('input and approval arrivals notify even in front, deduplicate native keys, and never answer interactions', async () => {
  const app = await mount();
  const row = notificationSession({ retainedBy: { mainView: 1 } });
  app.setSessions([row]);
  app.set({ notificationsEnabled: true, notificationMode: 'always' });
  app.setDocument({ hidden: false, focused: true });
  const question = { key: 'question:1', kind: 'question', sessionId: 'task' };
  const approval = { key: 'approval:1', kind: 'approval', sessionId: 'task' };
  app.setSessionStatus([['task', { running: true, pendingInteraction: question }]]);
  assert.equal(app.notifications.at(-1).title, 'notificationInput');
  assert.equal(app.notifications.at(-1).options.requireInteraction, true);
  app.setSessionStatus([['task', { running: true }]]);
  app.setSessionStatus([['task', { running: true, pendingInteraction: question }]]);
  assert.equal(app.notifications.length, 1);
  app.setSessionStatus([['task', { running: true, pendingInteraction: approval }]]);
  assert.equal(app.notifications.at(-1).title, 'notificationApproval');
  assert.equal(app.notifications.at(-1).options.requireInteraction, true);
  app.setSessionStatus([['task', { running: true, pendingInteraction: { key: 'plan:1', kind: 'plan-review' } }]]);
  assert.equal(app.notifications.at(-1).title, 'notificationInput');
  assert.equal(app.notifications.at(-1).options.requireInteraction, true);
  app.setSessionStatus([['task', { running: true }]]);
  app.setSessions([notificationSession({ seq: 10, reason: 'blocked', running: false })]);
  assert.equal(app.notifications.length, 3, 'A blocked turn must not duplicate its input or approval notice.');
  assert.deepEqual(app.rpcCalls, []);
  app.unmount();
});

test('unexplained blocked turns request input while review cards and idle historical questions stay quiet', async () => {
  const app = await mount();
  app.setSessions([notificationSession()]);
  app.set({ notificationsEnabled: true });
  app.setSessions([notificationSession({ seq: 5, reason: 'blocked', running: false })]);
  assert.equal(app.notifications.at(-1).title, 'notificationInput');
  assert.equal(app.notifications.at(-1).options.requireInteraction, true);
  app.setSessionStatus([['task', { running: false, pendingInteraction: { key: 'old:1', kind: 'question' } }]]);
  app.setSessionStatus([['task', { running: true, pendingInteraction: { key: 'review:1', kind: 'question', review: { readOnly: true } } }]]);
  assert.equal(app.notifications.length, 1);
  app.unmount();
});

test('startup, reconnect and enabling only seed history; disable and unload release notices and listeners', async () => {
  const app = await mount();
  app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false })]);
  app.set({ notificationsEnabled: true });
  assert.equal(app.notifications.length, 0);
  app.resetConnection();
  app.setSessions([notificationSession({ seq: 20, reason: 'error', running: false })], 'pending');
  app.setSessions([notificationSession({ seq: 20, reason: 'error', running: false })]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.notifications.length, 0);
  app.setSessions([notificationSession({ seq: 30, reason: 'error', running: false })]);
  assert.equal(app.notifications.length, 1);
  app.set({ notificationsEnabled: false });
  assert.equal(app.notifications[0].closed, true);
  app.setSessions([notificationSession({ seq: 40, reason: 'error', running: false })]);
  app.set({ notificationsEnabled: true });
  assert.equal(app.notifications.length, 1);
  app.setSessions([notificationSession({ seq: 50, reason: 'completed', running: false })]);
  assert.equal(app.notifications.length, 2);
  assert.equal(app.notificationSubscriptions(), 4);
  app.unmount();
  assert.equal(app.notifications[1].closed, true);
  assert.equal(app.notificationSubscriptions(), 0);
  assert.equal(app.subscriptions(), 0);
  app.setSessions([notificationSession({ seq: 60, reason: 'error', running: false })]);
  assert.equal(app.notifications.length, 2);
});

test('late projection baselines and disconnected snapshots never replay a past completion', async () => {
  const app = await mount();
  app.setSessions([notificationSession({ projectionValues: undefined })]);
  app.set({ notificationsEnabled: true });
  app.setSessions([notificationSession({ seq: 10, reason: 'completed' })]);
  assert.equal(app.notifications.length, 0, 'A first projection is a baseline even while running.');
  app.setConnectionGeneration(undefined);
  app.setSessions([notificationSession({ seq: 20, reason: 'error', running: false })]);
  assert.equal(app.notifications.length, 0);
  app.setConnectionGeneration({ id: 2 });
  await new Promise(resolve => setImmediate(resolve));
  app.setSessions([notificationSession({ projectionValues: undefined })]);
  app.setSessions([notificationSession({ seq: 30, reason: 'error' })]);
  assert.equal(app.notifications.length, 0);
  app.setSessions([notificationSession({ seq: 40, reason: 'completed', running: false })]);
  assert.equal(app.notifications.length, 1);
  app.unmount();
});

test('delivery failure is contained and permission changes expose an actionable settings error', async () => {
  const app = await mount({ notificationFailure: true });
  app.selectSettingsTab('general');
  app.setSessions([notificationSession()]);
  app.set({ notificationsEnabled: true });
  app.setSessions([notificationSession({ seq: 10, reason: 'error', running: false })]);
  assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes('notificationFailed')));
  app.setNotificationPermission('denied');
  app.focus();
  assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes('notificationPermission')));
  await notificationSwitch(app).props.onClick();
  assert.equal(notificationSwitch(app).props['aria-checked'], false, 'Revoked permission must not prevent turning notifications off.');
  app.unmount();
});
