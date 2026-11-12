import { errorMessage } from '../../shared/client/runtime.ts';
import type { ClientContext, ClientEnvironment, ClientFeature, ClientRuntime, Connection, SessionRow, SettingContribution, SettingsForm, SettingsViewContext, Translate } from '../../shared/client/types.ts';
import type { SoundEntry, SystemSounds } from './rpc.ts';
import { styles as featureStyles } from './styles.ts';
interface SoundState { status: 'idle' | 'waiting' | 'remote' | 'loading' | 'ready' | 'error'; value: SystemSounds | null; error: string; playing: boolean; }
interface NotificationRecord { seq: number | undefined; running: boolean; attention: boolean; seen: Set<string>; }

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, Menu, observable, useSnapshot, errorFeedback } = runtime;
  const { ctx, form, source, t, savePreference } = env;
  const styles = featureStyles;
  let active = true;
  const notificationTagPrefix = `power-dsh:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
  let notificationSequence = 0;
  const nextNotificationTag = () => `${notificationTagPrefix}:${(++notificationSequence).toString(36)}`;
  ctx.effect(() => () => { active = false; });
  // Read native sources in the plugin context; components only receive snapshots and callbacks.
  function notificationRunner(ctx: ClientContext, form: SettingsForm, t: Translate, reportError: (error: string) => void, playSound: (id: string, preview: boolean) => Promise<void>) {
    const records = new Map<string, NotificationRecord>();
    const visible = new Map<string, Notification>();
    let active = true;
    let enabled = false;
    let generation = ctx.connection.generation.getSnapshot();
    function closeAll() {
      for (const notification of visible.values()) {
        notification.onclick = notification.onerror = notification.onclose = null;
        notification.close();
      }
      visible.clear();
    }
    function send(id: string, row: SessionRow, kind: 'Approval' | 'Input' | 'Error' | 'Complete') {
      if (!active || window.Notification?.permission !== 'granted') return;
      try {
        const preferences = form.getSnapshot().value;
        const sound = preferences?.notificationSound || 'default';
        const localTone = preferences?.notificationSoundEnabled === true && sound !== 'default' && ctx.connection.isLoopback;
        visible.get(id)?.close();
        visible.delete(id);
        const notification = new window.Notification(t(`notification${kind}`), {
          body: (row.displayTitle || row.title || t('notificationBody')).slice(0, 160),
          tag: nextNotificationTag(),
          renotify: true,
          ...(kind === 'Approval' || kind === 'Input' ? { requireInteraction: true } : {}),
          // Omit silent to respect system defaults; a replacement is still a new reminder.
          ...(preferences?.notificationSoundEnabled === true && !localTone ? {} : { silent: true }),
        });
        visible.set(id, notification);
        if (localTone) void playSound(sound, false).catch(() => { if (active) reportError('notificationSoundFailed'); });
        notification.onclick = () => { window.focus(); notification.close(); };
        notification.onclose = () => { if (visible.get(id) === notification) visible.delete(id); };
        notification.onerror = () => {
          if (active) reportError('notificationFailed');
          notification.close();
        };
      } catch (_error) {
        reportError('notificationFailed');
      }
    }
    function run(seed = false) {
      if (!active) return;
      const currentGeneration = ctx.connection.generation.getSnapshot();
      if (generation !== currentGeneration) { generation = currentGeneration; records.clear(); closeAll(); seed = true; }
      if (generation === undefined) { records.clear(); return; }
      const settings = form.getSnapshot();
      const nextEnabled = settings.status === 'ready' && settings.value?.notificationsEnabled === true;
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
            const inFront = !document.hidden && document.hasFocus() && (row.retainedBy?.mainView ?? 0) > 0;
            if (!inFront) send(id, row, outcome.reason === 'error' ? 'Error' : 'Complete');
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
      }
    }
    run(true);
    const offList = ctx.sessions.list.subscribe(() => run());
    const offStatus = ctx.uiSession.sessionStatus.subscribe(() => run());
    const offForm = form.subscribe(() => run());
    const offConnection = ctx.connection.generation.subscribe(() => run(true));
    return () => { active = false; offList(); offStatus(); offForm(); offConnection(); closeAll(); records.clear(); };
  }
  let soundState: SoundState = { status: 'idle', value: null, error: '', playing: false };
  const soundsSource = observable(() => soundState);
  let soundConnection: Connection | null = null;
  let soundGeneration = 0;
  let soundPreview: Notification | null = null;
  const publishSound = (patch: Partial<SoundState>) => { soundState = { ...soundState, ...patch }; soundsSource.notify(); };
  ctx.effect(() => () => { soundGeneration++; soundPreview?.close(); });
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
    if (!active || !soundConnection?.isLoopback || preferences.status !== 'ready'
      || !preferences.value?.notificationsEnabled || !preferences.value?.notificationSoundEnabled) return;
    if (preview && (!preferences.writable || soundState.playing || soundState.status !== 'ready'
      || (preferences.value?.notificationSound || 'default') !== id
      || !soundState.value?.sounds.some(sound => sound.id === id))) return;
    if (preview) publishSound({ playing: true, error: '' });
    try {
      if (preview && id === 'default') {
        if (window.Notification?.permission !== 'granted') throw new Error('notificationPermission');
        soundPreview?.close();
        soundPreview = new window.Notification(t('notificationSoundTestTitle'), {
          body: t('notificationSoundTestBody'), tag: nextNotificationTag(), renotify: true,
        });
        soundPreview.onerror = () => { if (active) publishSound({ error: 'notificationSoundFailed' }); };
      } else {
        const reply = await ctx.remote.powerDsh.playSystemSound(id, preview);
        if (!reply.ok) throw new Error('notificationSoundFailed');
      }
    } catch (failure) {
      if (active) publishSound({ error: errorMessage(failure) === 'notificationPermission' ? 'notificationPermission' : 'notificationSoundFailed' });
      if (!preview) throw failure;
    } finally {
      if (active && preview) publishSound({ playing: false });
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
    if (form.getSnapshot().value?.notificationsEnabled !== true) { soundPreview?.close(); reportNotificationError(''); return; }
    reportNotificationError(!window.Notification ? 'notificationUnsupported'
      : window.Notification.permission !== 'granted' ? 'notificationPermission'
        : !notificationReady ? 'notificationUnavailable' : '');
  };
  ctx.inject(['connection'], child => {
    child.effect(() => {
      soundConnection = child.connection;
      if (soundState.status !== 'idle') void loadSystemSounds();
      return () => {
        soundConnection = null;
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
  const setNotificationsEnabled = async (enabled: boolean) => {
    if (enabled) {
      if (!notificationReady) throw new Error(t('notificationUnavailable'));
      if (!window.Notification) throw new Error(t('notificationUnsupported'));
      // Request before any other await so the browser keeps this click's user activation.
      const permission = window.Notification.permission === 'default'
        ? await window.Notification.requestPermission() : window.Notification.permission;
      if (!active) return;
      if (permission !== 'granted') throw new Error(t('notificationPermission'));
    }
    await savePreference('notificationsEnabled', enabled, 'notificationUnavailable');
    reportNotificationError('');
  };
  const mainSetting: SettingContribution = { field: 'notificationsEnabled', description: 'notificationsDescription', save: next => setNotificationsEnabled(next === true) };
  const soundSetting: SettingContribution = { field: 'notificationSoundEnabled', save: next => savePreference('notificationSoundEnabled', next === true, 'notificationUnavailable'), canSave: () => source.getSnapshot().value?.notificationsEnabled === true };
  const toneSetting: SettingContribution = { field: 'notificationSound', hidden: true, canSave: next => {
    const sounds = soundsSource.getSnapshot();
    const config = source.getSnapshot();
    return config.value?.notificationsEnabled === true && config.value?.notificationSoundEnabled === true
      && sounds.status === 'ready' && !sounds.playing && !!sounds.value?.sounds.some(sound => sound.id === next);
  }, save: async (next, { mounted }) => {
    if (typeof next === 'string' && source.getSnapshot().value?.notificationSound !== next) await savePreference('notificationSound', next, 'notificationUnavailable', 'string');
    if (mounted.current && typeof next === 'string') await playSystemSound(next, true);
  } };
  function useSettings({ snapshot, disabled, saving, error, save, id }: SettingsViewContext): SettingContribution[] {
    const sounds = useSnapshot(soundsSource);
    const notifications = useSnapshot(notificationsSource);
    const [soundMenuOpen, setSoundMenuOpen] = React.useState(false);
    React.useEffect(() => { void loadSystemSounds(); }, []);
    React.useEffect(() => {
      if (snapshot.value?.notificationsEnabled !== true) setSoundMenuOpen(false);
    }, [snapshot.value?.notificationsEnabled]);
    const soundName = (sound: SoundEntry) => sound.id === 'default' ? t('notificationSoundDefault')
      : sound.id.startsWith('win:') ? t(`sound${sound.id.slice(4)}`) : sound.name;
    function soundRow() {
      if (snapshot.value?.notificationsEnabled !== true) return null;
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
            'aria-busy': busy, disabled: disabled || !snapshot.value?.notificationsEnabled,
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
      { ...mainSetting, error: notifications.error && t(notifications.error) },
      { ...soundSetting, render: soundRow },
    ];
  }
  return { settings: [mainSetting, soundSetting, toneSetting], useSettings, styles, api: { notificationsSource, setNotificationsEnabled, soundsSource, loadSystemSounds, playSystemSound } } satisfies ClientFeature;
}
