import type { ClientEnvironment, ClientFeature, ClientRuntime, SettingsViewContext, Connection } from '../../shared/client/types.ts';
import type { RestartStatus } from '../../shared/types/wire.ts';
import { PluginUpdateClient, type UpdateTarget } from './update-client.ts';
import { updateDiagnosticContext } from './diagnostics.ts';

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, Button, Modal, observable, useSnapshot, errorFeedback } = runtime;
  const { ctx, source, t, pluginVersion } = env;
  let active = true;
  let settingsVisible = false;
  const canUse = () => {
    const snapshot = source.getSnapshot();
    return active && settingsVisible && snapshot.status === 'ready' && snapshot.writable;
  };
  let storage: Storage | undefined;
  let completionStorage: Storage | undefined;
  try { storage = window.sessionStorage; } catch (_error) {}
  try { completionStorage = window.localStorage; } catch (_error) {}
  let connection: Connection | null = null;
  let generation = 0;
  const connectionSource = observable(() => generation);
  ctx.inject(['connection'], child => child.effect(() => {
    connection = child.connection;
    const changed = () => { generation++; connectionSource.notify(); };
    changed();
    return () => { connection = null; changed(); };
  }));
  const localDesktop = () => window.dshDesktop?.protocolVersion === 1 && window.location.protocol === 'dsh-app:'
    && ['darwin', 'win32'].includes(document.documentElement.getAttribute('data-platform') || '')
    && connection?.isLoopback === true && connection.generation.getSnapshot() !== undefined;
  const updates = new PluginUpdateClient({
    version: pluginVersion, baseURI: document.baseURI, canUse, storage, completionStorage,
    runtimeVersion: async () => {
      const reply = await ctx.remote.powerDsh.pluginRuntimeVersion();
      if (!reply.ok) throw new Error('pluginUpdateUnknown');
      return reply.value;
    },
    fetch: (...args) => fetch(...args), notify: () => updateSource.notify(),
    release: async signal => {
      const reply = await ctx.remote.powerDsh.readPluginRelease();
      signal.throwIfAborted();
      if (!reply.ok) throw new Error('pluginUpdateCheckFailed');
      return reply.value;
    },
    schedule: (callback, milliseconds) => window.setTimeout(callback, milliseconds), cancel: timer => window.clearTimeout(timer),
  });
  const updateSource = observable(() => updates.state);
  ctx.effect(() => () => { active = false; settingsVisible = false; updates.close(); });
  function useSettingsFooter({ snapshot, activeTab, id }: SettingsViewContext) {
    const state = useSnapshot(updateSource);
    const connectionGeneration = useSnapshot(connectionSource);
    const [confirming, setConfirming] = React.useState<'update' | 'restart' | null>(null);
    const confirmation = React.useRef<{ target: UpdateTarget; kind: 'update' | 'restart'; generation: number } | null>(null);
    const [restart, setRestart] = React.useState<RestartStatus>({ supported: false, running: false, error: '' });
    const [restartError, setRestartError] = React.useState('');
    const restarting = React.useRef(false);
    const restartSubmitting = React.useRef(false);
    const visible = activeTab === 'general' && snapshot.status === 'ready';
    settingsVisible = visible;
    const writable = visible && snapshot.writable;
    const close = () => { confirmation.current = null; setConfirming(null); };
    React.useEffect(() => {
      if (!writable || state.phase !== 'done' || !connection) return;
      return connection.generation.subscribe(() => { generation++; connectionSource.notify(); });
    }, [writable, state.phase, connectionGeneration]);
    React.useEffect(() => {
      if (writable) void updates.resume();
      return () => { updates.pause(); confirmation.current = null; };
    }, [writable, connectionGeneration]);
    React.useEffect(() => { close(); }, [writable, state.target, connectionGeneration]);
    React.useEffect(() => {
      if (confirmation.current?.kind === 'restart' && (!restart.supported || restart.running)) close();
    }, [restart.supported, restart.running]);
    const needsRestart = state.phase === 'done' && state.restartRequired;
    React.useEffect(() => {
      setRestart({ supported: false, running: false, error: '' });
      setRestartError('');
      restarting.current = false;
      if (!writable || !needsRestart || !localDesktop()) return;
      let active = true;
      let reading = false;
      const read = async () => {
        if (!active || reading || restartSubmitting.current) return;
        reading = true;
        try {
          const reply = await ctx.remote.powerDsh.restartStatus();
          if (!active) return;
          if (!reply.ok) throw new Error('pluginUpdateRestartUnavailable');
          setRestart(reply.value);
          if (restarting.current && !reply.value.running) {
            restarting.current = false;
            setRestartError('pluginUpdateRestartFailed');
          } else if (reply.value.error) setRestartError('pluginUpdateRestartFailed');
        } catch (_error) {
          if (active) { restarting.current = false; setRestart({ supported: false, running: false, error: '' }); setRestartError('pluginUpdateRestartUnavailable'); }
        } finally { reading = false; }
      };
      void read();
      const timer = window.setInterval(read, 2000);
      return () => { active = false; window.clearInterval(timer); };
    }, [writable, needsRestart, connectionGeneration]);
    if (!visible) return null;
    const busy = state.phase === 'checking' || state.phase === 'updating';
    const available = state.phase === 'available' && Boolean(state.target);
    const request = confirmation.current;
    const confirm = async () => {
      const expected = request?.target;
      if (!expected || !request || confirmation.current !== request || !canUse() || updates.state.target !== expected || updates.busy
        || request.generation !== generation) return;
      close();
      if (request.kind === 'update') { await updates.update(expected); return; }
      if (!localDesktop() || !restart.supported || updates.state.phase !== 'done' || !updates.state.restartRequired || restarting.current || restart.running) return;
      restarting.current = true;
      restartSubmitting.current = true;
      setRestartError('');
      setRestart(previous => ({ ...previous, running: true }));
      try {
        const reply = await ctx.remote.powerDsh.restartAfterUpdate();
        if (!reply.ok) throw new Error('pluginUpdateRestartFailed');
      } catch (_error) {
        restarting.current = false;
        if (canUse() && request.generation === generation) { setRestart(previous => ({ ...previous, running: false })); setRestartError('pluginUpdateRestartFailed'); }
      } finally { restartSubmitting.current = false; }
    };
    const done = state.phase === 'done';
    const canRestart = needsRestart && localDesktop() && restart.supported;
    const openConfirmation = (kind: 'update' | 'restart') => {
      if (!canUse() || !updates.state.target || restarting.current || restart.running) return;
      confirmation.current = { target: updates.state.target, kind, generation };
      setConfirming(kind);
    };
    return h('div', { className: 'power-dsh-setting-row power-dsh-plugin-update', key: 'plugin-updates', role: 'group', 'aria-label': t('pluginUpdateVersion') },
      h('div', { className: 'power-dsh-setting-copy' },
        h('div', { className: 'power-dsh-setting-label' }, t('pluginUpdateVersion')),
        h('div', { className: 'power-dsh-description power-dsh-plugin-version' },
          h('span', null, done && state.target ? `${pluginVersion} → ${state.target.version}` : pluginVersion),
          state.phase === 'current' && h('span', { className: 'power-dsh-plugin-status', role: 'status' }, t('pluginUpdateCurrent')),
          state.target && h('a', { href: state.target.url, target: '_blank', rel: 'noopener noreferrer' }, t('pluginUpdateReleaseNotes')),
          !state.target && ['pluginUpdateRateLimited', 'pluginUpdateGitUnavailable'].includes(state.error)
            && h('a', { href: 'https://github.com/mewcoder/power-dsh/releases', target: '_blank', rel: 'noopener noreferrer' }, t('pluginUpdateReleaseNotes'))),
      (state.phase === 'unconfirmed' || done) && h('p', { className: `power-dsh-description${done ? ' power-dsh-plugin-status' : ''}`, role: 'status' },
        t(done ? needsRestart ? canRestart ? 'pluginUpdateInstalledRestart' : 'pluginUpdateRestart'
          : 'pluginUpdateInstalledRefresh' : 'pluginUpdateUnconfirmed')),
      state.notice && h('p', { className: 'power-dsh-description' }, t(state.notice)),
      state.phase === 'updating' && h('div', { className: 'power-dsh-plugin-progress', role: 'progressbar', 'aria-label': t('pluginUpdateUpdating') }, h('span')),
      restartError && errorFeedback({ t, id: `${id}-plugin-restart-error`, message: t(restartError), code: 'PD-PLUGIN-RESTART', operation: 'pluginUpdate.restart' }),
      state.error && errorFeedback({ t, id: `${id}-plugin-update-error`, message: t(state.error), code: 'PD-PLUGIN-UPDATE',
        operation: state.pending ? 'pluginUpdate.observe' : 'pluginUpdate.check',
        observedAt: state.diagnostic?.observedAt, context: updateDiagnosticContext(state.diagnostic, pluginVersion, state.phase, t),
        })),
      h('div', { className: 'power-dsh-plugin-update-actions' },
        !available && !done && h(Button, { size: 'md', variant: 'outline', disabled: !writable || busy,
          'aria-busy': busy,
          onClick: () => state.pending ? updates.resume() : updates.check() },
          t(state.phase === 'updating' ? 'pluginUpdateUpdating' : state.phase === 'checking' ? 'pluginUpdateChecking'
            : state.pending ? 'pluginUpdateResume' : 'pluginUpdateCheck')),
        available && state.target && h(Button, { size: 'md', variant: 'primary', disabled: !writable || busy,
          onClick: () => openConfirmation('update'),
        }, `${t('pluginUpdateAction')} ${state.target.version}`),
        canRestart && h(Button, { size: 'md', variant: 'primary', disabled: !writable || restart.running,
          'aria-busy': restart.running, onClick: () => openConfirmation('restart') }, t(restart.running ? 'pluginUpdateRestarting' : 'pluginUpdateRestartAction')),
        done && !needsRestart && h(Button, { size: 'md', variant: 'primary', disabled: !writable,
          onClick: () => { if (canUse() && updates.state.phase === 'done' && updates.state.target === state.target && !updates.state.restartRequired) window.location.reload(); } }, t('pluginUpdateRefresh'))),
      h(Modal, { open: Boolean(confirming) && writable && state.target === confirmation.current?.target && (!needsRestart || !restart.running), onClose: close,
        title: t(confirming === 'restart' ? 'pluginUpdateRestartAction' : 'pluginUpdateConfirm'), closeLabel: t('close'),
        description: t(confirming === 'restart' ? document.documentElement.getAttribute('data-platform') === 'win32'
          ? 'pluginUpdateRestartWindowsConfirm' : 'pluginUpdateRestartConfirm' : 'pluginUpdateConfirmDescription'),
        footer: h(React.Fragment, null,
          h(Button, { variant: 'outline', 'data-modal-autofocus': true, onClick: close }, t('cancel')),
          h(Button, { variant: 'primary', disabled: !writable || busy || (confirming === 'restart' && restart.running), onClick: confirm },
            t(confirming === 'restart' ? 'pluginUpdateRestartAction' : 'pluginUpdateAction'))),
      }, confirming === 'update' && h('p', null, `${pluginVersion} → ${state.target?.version || ''}`)));
  }
  return {
    settings: [], useSettingsFooter,
    styles: `.power-dsh-plugin-update-actions { display:flex; align-items:center; align-self:flex-start; margin-top:3px; justify-content:flex-end; flex-wrap:wrap; flex:none; max-width:50%; gap:8px; }
.power-dsh-plugin-version { display:flex; align-items:baseline; flex-wrap:wrap; gap:4px 8px; }
.power-dsh-page .power-dsh-plugin-update .power-dsh-plugin-status { color:var(--dsw-alias-state-success-primary); }
.power-dsh-plugin-progress { height:3px; margin-top:12px; overflow:hidden; background:var(--dsw-alias-border-l2); border-radius:3px; }
.power-dsh-plugin-progress > span { display:block; height:100%; width:35%; background:var(--dsw-alias-label-tertiary); animation:power-dsh-plugin-progress 1.4s ease-in-out infinite alternate; }
@keyframes power-dsh-plugin-progress { to { transform:translateX(185%); } }
@media(prefers-reduced-motion:reduce) { .power-dsh-plugin-progress > span { animation:none; width:100%; } }
.power-dsh-plugin-update a { color:var(--dsw-alias-state-business-primary); }`,
    api: { pluginUpdateSource: updateSource, pluginUpdates: updates },
  } satisfies ClientFeature;
}
