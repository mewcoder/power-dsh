import { errorMessage } from '../../shared/client/runtime.ts';
import type { ClientContext, ClientEnvironment, ClientFeature, ClientRuntime, Connection, SessionRow, SettingContribution, SettingsForm, SettingsViewContext, Translate } from '../../shared/client/types.ts';
import type { SoundEntry, SystemSounds } from './rpc.ts';
import { styles as featureStyles } from './styles.ts';
import type { NotificationTransport } from '../../shared/types/wire.ts';
interface SoundState { status: 'idle' | 'waiting' | 'remote' | 'loading' | 'ready' | 'error'; value: SystemSounds | null; error: string; playing: boolean; }
interface NotificationRecord { seq: number | undefined; running: boolean; attention: boolean; seen: Set<string>; }

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, Menu, observable, useSnapshot, errorFeedback } = runtime;
  const { ctx, form, source, t, savePreference } = env;
  const styles = featureStyles;
  let active = true;
  let notificationSequence = 0;
  const newNativeGroup = () => `pd${Math.random().toString(36).slice(2, 14)}`;
  let transport: { status: 'loading' | 'ready' | 'error'; value: NotificationTransport | null; local: boolean; testing: boolean; tested: boolean } = {
    status: 'loading', value: null, local: false, testing: false, tested: false,
  };
  let transportGeneration = 0;
  const transportSource = observable(() => transport);
  const publishTransport = (patch: Partial<typeof transport>) => { transport = { ...transport, ...patch }; transportSource.notify(); };
  const transportReady = () => transport.status === 'ready' && (!transport.local
    || (transport.value?.version === env.pluginVersion && (transport.value.platform !== 'win32' || transport.value.nativeAvailable)));
  const usesNativeNotifications = () => transport.local && transport.value?.platform === 'win32';
  let testSender: (() => Promise<void>) | null = null;
  const loadTransport = async () => {
    if (!active || !soundConnection) return;
    const generation = ++transportGeneration;
    publishTransport({ status: 'loading', value: null, local: soundConnection.isLoopback });
    if (!soundConnection.isLoopback) { publishTransport({ status: 'ready' }); return; }
    try {
      const reply = await ctx.remote.powerDsh.notificationTransport();
      if (!active || generation !== transportGeneration) return;
      if (!reply.ok) throw new Error('notificationUnavailable');
      publishTransport({ status: 'ready', value: reply.value });
    } catch (_error) {
      if (active && generation === transportGeneration) publishTransport({ status: 'error' });
    }
    checkNotificationPermission();
  };
  const clearNativeNotifications = async (group: string, tag = '') => {
    const reply = await ctx.remote.powerDsh.clearWindowsNotifications(group, tag);
    if (!reply.ok) throw new Error('notificationFailed');
  };
  ctx.effect(() => () => { active = false; });
  // Read native sources in the plugin context; components only receive snapshots and callbacks.
  function notificationRunner(ctx: ClientContext, form: SettingsForm, t: Translate, reportError: (error: string) => void, playSound: (id: string, preview: boolean) => Promise<void>) {
    const records = new Map<string, NotificationRecord>();
    const visible = new Map<string, Notification>();
    const pendingTests = new Map<Notification, () => void>();
    const nativeTags = new Map<string, string>();
    let nativeGroup = newNativeGroup();
    let active = true;
    let enabled = false;
    let generation = ctx.connection.generation.getSnapshot();
    function closeAll() {
      for (const notification of visible.values()) {
        pendingTests.get(notification)?.();
        notification.onclick = notification.onerror = notification.onclose = notification.onshow = null;
        notification.close();
      }
      visible.clear();
      if (nativeTags.size) {
        void clearNativeNotifications(nativeGroup).catch(() => { if (active) reportError('notificationFailed'); });
        nativeTags.clear();
        nativeGroup = newNativeGroup();
      }
    }
    function send(id: string, row: SessionRow, kind: 'Approval' | 'Input' | 'Error' | 'Complete', manual = false) {
      if (!active || !transportReady()) return;
      if (!usesNativeNotifications() && window.Notification?.permission !== 'granted') {
        if (manual) reportError(window.Notification ? 'notificationPermission' : 'notificationUnsupported');
        return;
      }
      try {
        const preferences = form.getSnapshot().value;
        const inFront = !document.hidden && document.hasFocus() && (row.retainedBy?.mainView ?? 0) > 0;
        if (!manual && (preferences?.notificationMode === 'never' || (preferences?.notificationMode !== 'always' && inFront))) return;
        const sound = preferences?.notificationSound || 'default';
        const localTone = preferences?.notificationSoundEnabled === true && sound !== 'default' && ctx.connection.isLoopback;
        if (usesNativeNotifications()) {
          const tag = nativeTags.get(id) ?? (++notificationSequence).toString(36);
          nativeTags.set(id, tag);
          const sentGroup = nativeGroup;
          const sentGeneration = generation;
          return (async () => {
            const reply = await ctx.remote.powerDsh.showWindowsNotification({
              group: sentGroup, tag, title: t(`notification${kind}`).slice(0, 80),
              body: (row.displayTitle || row.title || t('notificationBody')).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, 160),
              attention: kind === 'Approval' || kind === 'Input', preview: false, dismiss: t('notificationDismiss'),
            });
            if (!active || !enabled || sentGroup !== nativeGroup || sentGeneration !== generation || nativeTags.get(id) !== tag) return;
            if (!reply.ok) throw new Error('notificationFailed');
            if (reply.value.reason) {
              reportError(reply.value.reason === 'identity' ? 'notificationIdentity' : 'notificationNativePermission');
              return;
            }
            if (reply.value.shown) reportError('');
            if (manual && reply.value.shown) publishTransport({ tested: true });
            if (reply.value.shown && localTone) {
              try { await playSound(sound, false); }
              catch (_error) { if (active) reportError('notificationSoundFailed'); }
            }
          })().catch(() => {
            if (active && enabled && sentGroup === nativeGroup && sentGeneration === generation) reportError('notificationFailed');
          });
        }
        visible.get(id)?.close();
        visible.delete(id);
        const notification = new window.Notification(t(`notification${kind}`), {
          body: (row.displayTitle || row.title || t('notificationBody')).slice(0, 160),
          ...(kind === 'Approval' || kind === 'Input' ? { requireInteraction: true } : {}),
          // Omit silent to respect system defaults; a replacement is still a new reminder.
          ...(preferences?.notificationSoundEnabled === true && !localTone ? {} : { silent: true }),
        });
        visible.set(id, notification);
        if (localTone) void playSound(sound, false).catch(() => { if (active) reportError('notificationSoundFailed'); });
        notification.onclick = () => { window.focus(); notification.close(); };
        notification.onclose = () => { pendingTests.get(notification)?.(); if (visible.get(id) === notification) visible.delete(id); };
        notification.onerror = () => {
          if (active) reportError('notificationFailed');
          pendingTests.get(notification)?.();
          notification.close();
        };
        if (manual) return new Promise<void>(resolve => {
          const timer = window.setTimeout(() => {
            if (active) reportError('notificationTestUnconfirmed');
            pendingTests.get(notification)?.();
          }, 5000);
          pendingTests.set(notification, () => { window.clearTimeout(timer); pendingTests.delete(notification); resolve(); });
          notification.onshow = () => {
            if (active) { reportError(''); publishTransport({ tested: true }); }
            pendingTests.get(notification)?.();
          };
        });
      } catch (_error) {
        reportError('notificationFailed');
      }
    }
    function run(seed = false) {
      if (!active) return;
      const currentGeneration = ctx.connection.generation.getSnapshot();
      if (generation !== currentGeneration) { generation = currentGeneration; records.clear(); closeAll(); seed = true; }
      if (generation === undefined) { records.clear(); return; }
      if (!transportReady()) { records.clear(); closeAll(); return; }
      const settings = form.getSnapshot();
      const nextEnabled = settings.status === 'ready' && settings.value?.notificationsEnabled === true && settings.value.notificationMode !== 'never';
      if (nextEnabled !== enabled) { seed = true; enabled = nextEnabled; if (!enabled) closeAll(); }
      const list = ctx.sessions.list.getSnapshot();
      if (list.phase !== 'ready') { records.clear(); return; }
      const statuses = ctx.uiSession.sessionStatus.getSnapshot();
      for (const id of list.ids) {
        const row = list.byId[id];
        if (row.origin === 'subagent') continue;
        const status = statuses.get(id);
        const pending = status?.pendingInteraction;
        const running = status?.running ?? row.running;
        const outcome = row.projectionValues?.powerDshNotifications;
        const previous = records.get(id);
        const current = previous && !seed ? previous : {
          seq: outcome?.seq, running, attention: false, seen: new Set(pending ? [pending.key] : []),
        };
        if (running && !current.running) current.attention = false;
        const fresh = previous !== undefined && !seed;
        const pendingFresh = pending && !current.seen.has(pending.key);
        if (pending) current.seen.add(pending.key);
        if (fresh && pendingFresh && pending.review === undefined && pending.answerable !== false && running
          && (pending.kind === 'approval' || pending.kind === 'question' || pending.kind === 'plan-review')) {
          current.attention = true;
          if (enabled) send(id, row, pending.kind === 'approval' ? 'Approval' : 'Input');
        }
        const advanced = outcome && current.seq !== undefined && outcome.seq > current.seq;
        if (fresh && advanced && enabled) {
          // A pending question/approval owns the reminder while it awaits an answer.
          if (outcome.reason === 'blocked') {
            if (!pending && !current.attention) send(id, row, 'Input');
          } else if (!pending && (outcome.reason === 'completed' || outcome.reason === 'error')) {
            send(id, row, outcome.reason === 'error' ? 'Error' : 'Complete');
          }
        }
        if (advanced) current.seen = new Set(pending ? [pending.key] : []);
        current.seq = outcome?.seq;
        current.running = running;
        records.set(id, current);
      }
      const live = new Set(list.ids);
      for (const id of records.keys()) if (!live.has(id)) {
        records.delete(id);
        visible.get(id)?.close();
        visible.delete(id);
        const tag = nativeTags.get(id);
        if (tag) {
          nativeTags.delete(id);
          void clearNativeNotifications(nativeGroup, tag).catch(() => { if (active) reportError('notificationFailed'); });
        }
      }
    }
    run(true);
    const offList = ctx.sessions.list.subscribe(() => run());
    const offStatus = ctx.uiSession.sessionStatus.subscribe(() => run());
    const offForm = form.subscribe(() => run());
    const offConnection = ctx.connection.generation.subscribe(() => run(true));
    let lastTransport = transport;
    const offTransport = transportSource.subscribe(() => {
      const previous = lastTransport;
      lastTransport = transport;
      if (previous.status !== transport.status || previous.value !== transport.value || previous.local !== transport.local) run(true);
    });
    testSender = () => Promise.resolve(send('power-dsh-test', { running: false, title: t('notificationTestBody') }, 'Complete', true));
    return () => { active = false; testSender = null; offTransport(); offList(); offStatus(); offForm(); offConnection(); closeAll(); records.clear(); };
  }
  let soundState: SoundState = { status: 'idle', value: null, error: '', playing: false };
  const soundsSource = observable(() => soundState);
  let soundConnection: Connection | null = null;
  let soundGeneration = 0;
  let soundPreview: Notification | null = null;
  let nativePreviewGroup = newNativeGroup();
  let nativePreviewVisible = false;
  const closeSoundPreview = () => {
    soundPreview?.close();
    if (nativePreviewVisible) {
      void clearNativeNotifications(nativePreviewGroup).catch(() => {
        if (active) publishSound({ error: 'notificationSoundFailed' });
      });
      nativePreviewVisible = false;
      nativePreviewGroup = newNativeGroup();
    }
  };
  const publishSound = (patch: Partial<SoundState>) => { soundState = { ...soundState, ...patch }; soundsSource.notify(); };
  ctx.effect(() => () => { soundGeneration++; closeSoundPreview(); });
  const loadSystemSounds = async () => {
    if (!active || soundState.status === 'loading') return;
    if (!soundConnection) { publishSound({ status: 'waiting', error: '' }); return; }
    if (!soundConnection.isLoopback) { publishSound({ status: 'remote', value: null, error: '' }); return; }
    const generation = ++soundGeneration;
    publishSound({ status: 'loading', error: '' });
    try {
      const reply = await ctx.remote.powerDsh.listSystemSounds();
      if (!active || generation !== soundGeneration) return;
      if (!reply.ok) throw new Error('notificationSoundUnavailable');
      publishSound({ status: 'ready', value: reply.value, error: '' });
    } catch (_failure) {
      if (active && generation === soundGeneration) publishSound({ status: 'error', error: 'notificationSoundUnavailable' });
    }
  };
  const playSystemSound = async (id: string, preview: boolean) => {
    const preferences = form.getSnapshot();
    if (!active || !transportReady() || !soundConnection?.isLoopback || preferences.status !== 'ready'
      || !preferences.value?.notificationsEnabled || preferences.value.notificationMode === 'never' || !preferences.value?.notificationSoundEnabled) return;
    if (preview && (!preferences.writable || soundState.playing || soundState.status !== 'ready'
      || (preferences.value?.notificationSound || 'default') !== id
      || !soundState.value?.sounds.some(sound => sound.id === id))) return;
    if (preview) publishSound({ playing: true, error: '' });
    const generation = soundGeneration;
    try {
      if (preview && id === 'default') {
        if (usesNativeNotifications()) {
          nativePreviewVisible = true;
          const reply = await ctx.remote.powerDsh.showWindowsNotification({
            group: nativePreviewGroup, tag: 'preview', title: t('notificationSoundTestTitle'), body: t('notificationSoundTestBody'),
            attention: false, preview: true, dismiss: t('notificationDismiss'),
          });
          if (!reply.ok) throw new Error('notificationSoundFailed');
          if (reply.value.reason) throw new Error(reply.value.reason === 'identity' ? 'notificationIdentity' : 'notificationNativePermission');
          return;
        }
        if (window.Notification?.permission !== 'granted') throw new Error('notificationPermission');
        soundPreview?.close();
        soundPreview = new window.Notification(t('notificationSoundTestTitle'), {
          body: t('notificationSoundTestBody'),
        });
        soundPreview.onerror = () => { if (active) publishSound({ error: 'notificationSoundFailed' }); };
      } else {
        const reply = await ctx.remote.powerDsh.playSystemSound(id, preview);
        if (!reply.ok) throw new Error('notificationSoundFailed');
      }
    } catch (failure) {
      const message = errorMessage(failure) || '';
      if (active && generation === soundGeneration) publishSound({ error: ['notificationPermission', 'notificationIdentity', 'notificationNativePermission'].includes(message)
        ? message : 'notificationSoundFailed' });
      if (!preview) throw failure;
    } finally {
      if (active && preview && generation === soundGeneration) publishSound({ playing: false });
    }
  };
  let notificationError = '';
  let notificationReady = false;
  const notificationsSource = observable(() => notificationSnapshot);
  let notificationSnapshot = { error: '' };
  const reportNotificationError = (error: string) => {
    if (!active || notificationError === error) return;
    notificationError = error;
    notificationSnapshot = { error };
    notificationsSource.notify();
  };
  const checkNotificationPermission = () => {
    if (form.getSnapshot().value?.notificationsEnabled !== true || form.getSnapshot().value?.notificationMode === 'never') { closeSoundPreview(); reportNotificationError(''); return; }
    if (form.getSnapshot().value?.notificationSoundEnabled !== true) closeSoundPreview();
    reportNotificationError(transport.local && transport.value && transport.value.version !== env.pluginVersion ? 'notificationVersionMismatch'
      : !transportReady() ? 'notificationUnavailable'
      : usesNativeNotifications() ? (!notificationReady ? 'notificationUnavailable'
        : ['notificationIdentity', 'notificationNativePermission', 'notificationFailed'].includes(notificationError) ? notificationError : '')
      : !window.Notification ? 'notificationUnsupported'
      : window.Notification.permission !== 'granted' ? 'notificationPermission'
        : !notificationReady ? 'notificationUnavailable' : '');
  };
  ctx.inject(['connection'], child => {
    child.effect(() => child.connection.generation.subscribe(() => {
      transportGeneration++;
      publishTransport({ status: 'loading', value: null });
      if (child.connection.generation.getSnapshot() !== undefined) void loadTransport();
      soundGeneration++;
      closeSoundPreview();
      const requested = soundState.status !== 'idle';
      publishSound({ status: requested ? 'waiting' : 'idle', value: null, error: '', playing: false });
      if (requested && child.connection.generation.getSnapshot() !== undefined) void loadSystemSounds();
    }));
    child.effect(() => {
      soundConnection = child.connection;
      void loadTransport();
      if (soundState.status !== 'idle') void loadSystemSounds();
      return () => {
        closeSoundPreview();
        soundConnection = null;
        transportGeneration++;
        publishTransport({ status: 'loading', value: null });
        soundGeneration++;
        publishSound({ status: 'waiting', value: null, error: '', playing: false });
      };
    });
  });
  ctx.inject(['sessions', 'uiSession', 'connection'], child => {
    child.effect(() => {
      notificationReady = true;
      const dispose = notificationRunner(child, form, t, reportNotificationError, playSystemSound);
      checkNotificationPermission();
      return () => { dispose(); notificationReady = false; checkNotificationPermission(); };
    });
  });
  ctx.effect(() => form.subscribe(checkNotificationPermission));
  ctx.effect(() => {
    window.addEventListener('focus', checkNotificationPermission);
    checkNotificationPermission();
    return () => window.removeEventListener('focus', checkNotificationPermission);
  });
  const ensurePermission = async () => {
      if (!notificationReady || !transportReady()) throw new Error(t('notificationUnavailable'));
      if (!usesNativeNotifications()) {
        if (!window.Notification) throw new Error(t('notificationUnsupported'));
        const permission = window.Notification.permission === 'default'
          ? await window.Notification.requestPermission() : window.Notification.permission;
        if (!active) return false;
        if (permission !== 'granted') throw new Error(t('notificationPermission'));
      }
      return active;
  };
  const setNotificationsEnabled = async (enabled: boolean) => {
    if (enabled && !await ensurePermission()) return;
    await savePreference('notificationsEnabled', enabled, 'notificationUnavailable');
    reportNotificationError('');
  };
  const mainSetting: SettingContribution = { field: 'notificationsEnabled', hidden: true, save: next => setNotificationsEnabled(next === true) };
  const soundSetting: SettingContribution = { field: 'notificationSoundEnabled', save: next => savePreference('notificationSoundEnabled', next === true, 'notificationUnavailable'),
    canSave: () => source.getSnapshot().value?.notificationsEnabled === true && source.getSnapshot().value?.notificationMode !== 'never' };
  const toneSetting: SettingContribution = { field: 'notificationSound', hidden: true, canSave: next => {
    const sounds = soundsSource.getSnapshot();
    const config = source.getSnapshot();
    return config.value?.notificationsEnabled === true && config.value.notificationMode !== 'never' && config.value?.notificationSoundEnabled === true
      && sounds.status === 'ready' && !sounds.playing && !!sounds.value?.sounds.some(sound => sound.id === next);
  }, save: async (next, { mounted }) => {
    if (typeof next === 'string' && source.getSnapshot().value?.notificationSound !== next) await savePreference('notificationSound', next, 'notificationUnavailable', 'string');
    if (mounted.current && typeof next === 'string') await playSystemSound(next, true);
  } };
  const modeSetting: SettingContribution = { field: 'notificationMode', hidden: true,
    canSave: next => ['never', 'background', 'always'].includes(String(next)),
    save: async next => {
      if (next === 'never') return setNotificationsEnabled(false);
      if (!await ensurePermission()) return;
      await savePreference('notificationMode', String(next), 'notificationUnavailable', 'string');
      if (source.getSnapshot().value?.notificationsEnabled !== true) await setNotificationsEnabled(true);
    } };
  function useSettings({ snapshot, disabled, saving, error, save, id }: SettingsViewContext): SettingContribution[] {
    const sounds = useSnapshot(soundsSource);
    const notifications = useSnapshot(notificationsSource);
    const channel = useSnapshot(transportSource);
    const [modeMenuOpen, setModeMenuOpen] = React.useState(false);
    const [soundMenuOpen, setSoundMenuOpen] = React.useState(false);
    React.useEffect(() => { void loadSystemSounds(); }, []);
    React.useEffect(() => {
      if (snapshot.value?.notificationsEnabled !== true || snapshot.value.notificationMode === 'never') setSoundMenuOpen(false);
    }, [snapshot.value?.notificationsEnabled, snapshot.value?.notificationMode]);
    const soundName = (sound: SoundEntry) => sound.id === 'default' ? t('notificationSoundDefault')
      : sound.id.startsWith('win:') ? t(`sound${sound.id.slice(4)}`) : sound.name;
    const mode = snapshot.value?.notificationsEnabled === true ? snapshot.value.notificationMode || 'background' : 'never';
    function modeRow() {
      const busy = saving?.field === 'notificationMode';
      const modeLabel = (value: string) => t(value === 'always' ? 'notificationAlways' : value === 'never' ? 'notificationNever' : 'notificationBackground');
      const failed = error?.field === 'notificationMode';
      return h('div', { className: 'power-dsh-setting-row', key: 'notificationMode' },
        h('div', { className: 'power-dsh-setting-copy' },
          h('div', { id: `${id}-notificationMode-label`, className: 'power-dsh-setting-label' }, t('notificationsEnabled')),
          h('div', { id: `${id}-notificationMode-description`, className: 'power-dsh-description' }, t('notificationsDescription')),
          failed ? errorFeedback({ t, id: `${id}-notificationMode-error`, message: error.message, code: 'PD-NOTIFICATION-MODE', operation: 'settings.notificationMode' })
            : notifications.error && errorFeedback({ t, id: `${id}-notificationMode-error`, message: t(notifications.error), code: 'PD-NOTIFICATION-DELIVERY',
              operation: 'notifications.deliver', context: { stage: 'transport',
                actual: `${channel.status}:${channel.value?.platform || 'browser'}:${channel.value?.version || 'unknown'}`,
                expected: `${usesNativeNotifications() ? 'winrt' : 'browser'}:${env.pluginVersion}` } })),
        h('div', { className: 'power-dsh-notification-controls' },
          h('button', { type: 'button', className: 'power-dsh-notification-test',
            disabled: disabled || busy || !notificationReady || !transportReady() || channel.testing || mode === 'never',
            title: t(channel.tested ? 'notificationTestSent' : 'notificationTest'),
            'aria-label': t('notificationTest'), 'aria-busy': channel.testing, onClick: testNotification },
            h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
              strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false },
              channel.tested ? h('path', { d: 'm5 12 4 4L19 6' }) : h(React.Fragment, null,
                h('path', { d: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4' })))),
          h(Menu, { open: modeMenuOpen && !disabled && !busy, onClose: () => setModeMenuOpen(false), selectedId: mode,
          portal: true, align: 'end', autoFocus: true, minWidthFromAnchor: true,
          items: ['never', 'background', 'always'].map(value => ({ id: value, label: modeLabel(value) })),
          onSelect: value => { setModeMenuOpen(false); return save('notificationMode', value); },
          anchor: h('button', { type: 'button', className: 'power-dsh-mode-select', disabled: disabled || busy,
            'aria-label': t('notificationsEnabled'), 'aria-haspopup': 'menu', 'aria-expanded': modeMenuOpen && !disabled && !busy,
            'aria-describedby': `${id}-notificationMode-description${failed || notifications.error ? ` ${id}-notificationMode-error` : ''}`,
            'aria-invalid': Boolean(failed || notifications.error),
            'aria-busy': busy, onClick: () => { if (!disabled && !busy) setModeMenuOpen(true); },
          }, modeLabel(mode)) })));
    }
    const testNotification = async () => {
      const current = source.getSnapshot();
      if (!active || current.status !== 'ready' || !current.writable || current.value?.notificationsEnabled !== true
        || current.value.notificationMode === 'never' || !transportReady() || transport.testing || !testSender) return;
      publishTransport({ testing: true, tested: false });
      try { await testSender(); }
      finally { if (active) publishTransport({ testing: false }); }
    };
    function soundRow() {
      if (mode === 'never') return null;
      const field = 'notificationSoundEnabled';
      const control = `${id}-${field}`;
      const busy = saving?.field === field;
      const checked = busy ? saving.value === true : snapshot.value?.[field] === true;
      const soundId = snapshot.value?.notificationSound || 'default';
      const choices = sounds.value?.sounds || [{ id: 'default', name: 'default' }];
      const current = choices.find(sound => sound.id === soundId);
      const soundDisabled = disabled || !snapshot.value?.notificationsEnabled || !snapshot.value?.notificationSoundEnabled
        || sounds.status !== 'ready' || sounds.playing;
      const soundError = error?.field === 'notificationSound' || error?.field === field ? error.message : sounds.error ? t(sounds.error) : '';
      return h(React.Fragment, { key: field },
        h('div', { className: 'power-dsh-setting-row' },
          h('div', { className: 'power-dsh-setting-copy' },
            h('div', { id: `${control}-label`, className: 'power-dsh-setting-label' }, t(field)),
            h('div', { id: `${control}-description`, className: 'power-dsh-description' }, t('notificationSoundDescription')),
            error?.field === field && errorFeedback({ t, id: `${control}-error`, message: error.message,
               code: 'PD-NOTIFICATION-SOUND-SAVE', operation: 'settings.notificationSoundEnabled' })),
          h('button', {
            id: control, type: 'button', role: 'switch', className: 'power-dsh-switch',
            'aria-checked': checked, 'aria-labelledby': `${control}-label`,
            'aria-describedby': `${control}-description${error?.field === field ? ` ${control}-error` : ''}`,
            'aria-invalid': error?.field === field,
            'aria-busy': busy, disabled: disabled || busy || !snapshot.value?.notificationsEnabled,
            onClick: () => { setSoundMenuOpen(false); return save(field, !checked); },
          }, h('span', { className: 'power-dsh-switch-thumb', 'aria-hidden': true }))),
        checked && h('div', { className: 'power-dsh-setting-row' },
          h('div', { className: 'power-dsh-setting-copy' },
            h('div', { id: `${control}-sound-label`, className: 'power-dsh-setting-label' }, t('notificationSound')),
            h('div', { id: `${control}-sound-description`, className: 'power-dsh-description' }, t('notificationToneDescription')),
            soundError && error?.field !== field && errorFeedback({ t, id: `${control}-sound-error`, message: soundError,
               code: 'PD-NOTIFICATION-SOUND', operation: sounds.status === 'error' ? 'listSystemSounds' : 'playSystemSound',
               retry: sounds.status === 'error' ? loadSystemSounds : undefined })),
        h('div', { className: 'power-dsh-sound-controls' },
          h(Menu, {
            open: soundMenuOpen && !soundDisabled, onClose: () => setSoundMenuOpen(false), selectedId: soundId,
            align: 'end', portal: true, autoFocus: true, minWidthFromAnchor: true,
            items: choices.map(sound => ({ id: sound.id, label: soundName(sound) })),
            onSelect: next => { setSoundMenuOpen(false); return save('notificationSound', next); },
            anchor: h('button', {
              type: 'button', className: 'power-dsh-sound-select', disabled: soundDisabled,
              'aria-label': t('notificationSound'), 'aria-describedby': `${control}-sound-description${soundError && error?.field !== field ? ` ${control}-sound-error` : ''}`,
              'aria-invalid': Boolean(soundError && error?.field !== field),
              'aria-haspopup': 'menu', 'aria-expanded': soundMenuOpen && !soundDisabled,
              'aria-busy': sounds.playing || saving?.field === 'notificationSound',
              onClick: () => { if (!soundDisabled) setSoundMenuOpen(value => !value); },
            }, sounds.status === 'remote' ? t('notificationSoundDefault') : current ? soundName(current) : t(sounds.status === 'ready' ? 'notificationSoundMissing' : 'notificationSoundDefault'), h('svg', {
              width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4,
              strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false,
            }, h('path', { d: 'm4 6 4 4 4-4' }))),
          }),
          h('button', {
            type: 'button', className: 'power-dsh-sound-preview', disabled: soundDisabled || !current,
            title: t('notificationSoundPreview'), 'aria-label': t('notificationSoundPreview'), 'aria-busy': sounds.playing,
            onClick: () => { if (!soundDisabled && current) return playSystemSound(soundId, true); },
          }, h('svg', { width: 20, height: 20, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: false },
            h('circle', { cx: 8, cy: 8, r: 6, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }),
            h('path', { d: 'm6.5 5 4 3-4 3z', fill: 'currentColor' }))))));
    }
    return [
      mainSetting,
      { ...modeSetting, hidden: false, render: modeRow },
      { ...soundSetting, render: soundRow },
      toneSetting,
    ];
  }
  return { settings: [mainSetting, modeSetting, soundSetting, toneSetting], useSettings, styles,
    api: { notificationsSource, setNotificationsEnabled, soundsSource, loadSystemSounds, playSystemSound, transportSource, loadTransport } } satisfies ClientFeature;
}
