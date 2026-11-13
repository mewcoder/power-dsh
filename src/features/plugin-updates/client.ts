import type { ClientEnvironment, ClientFeature, ClientRuntime, SettingsViewContext } from '../../shared/client/types.ts';
import { PluginUpdateClient, type UpdateTarget } from './update-client.ts';
import { updateDiagnosticContext } from './diagnostics.ts';

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, Button, Modal, observable, useSnapshot, errorFeedback } = runtime;
  const { ctx, source, t, pluginVersion } = env;
  let settingsVisible = false;
  const canUse = () => {
    const snapshot = source.getSnapshot();
    return settingsVisible && snapshot.status === 'ready' && snapshot.writable;
  };
  let storage: Storage | undefined;
  try { storage = window.sessionStorage; } catch (_error) {}
  const updates = new PluginUpdateClient({
    version: pluginVersion, baseURI: document.baseURI, canUse, storage,
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
  ctx.effect(() => () => updates.close());
  function useSettingsFooter({ snapshot, activeTab, id }: SettingsViewContext) {
    const state = useSnapshot(updateSource);
    const [confirming, setConfirming] = React.useState<UpdateTarget | null>(null);
    const confirmation = React.useRef<{ target: UpdateTarget } | null>(null);
    const visible = activeTab === 'general' && snapshot.status === 'ready';
    settingsVisible = visible;
    const writable = visible && snapshot.writable;
    const close = () => { confirmation.current = null; setConfirming(null); };
    React.useEffect(() => {
      if (writable) void updates.resume();
      return () => { updates.pause(); confirmation.current = null; };
    }, [writable]);
    React.useEffect(() => { close(); }, [writable, state.target]);
    if (!visible) return null;
    const busy = state.phase === 'checking' || state.phase === 'updating';
    const request = confirmation.current;
    const confirm = () => {
      const expected = request?.target;
      if (!expected || confirmation.current !== request || !canUse() || state.target !== expected || updates.busy) return;
      close();
      void updates.update(expected);
    };
    return h('div', { className: 'power-dsh-setting-row power-dsh-plugin-update', key: 'plugin-updates', role: 'group', 'aria-label': t('pluginUpdateVersion') },
      h('div', { className: 'power-dsh-setting-copy' },
        h('div', { className: 'power-dsh-setting-label' }, t('pluginUpdateVersion')),
        h('div', { className: 'power-dsh-description power-dsh-plugin-version' },
          h('span', null, pluginVersion),
          state.phase === 'current' && h('span', { className: 'power-dsh-plugin-status', role: 'status' }, t('pluginUpdateCurrent'))),
      state.target && h('a', { href: state.target.url, target: '_blank', rel: 'noopener noreferrer' }, t('pluginUpdateReleaseNotes')),
      !state.target && ['pluginUpdateRateLimited', 'pluginUpdateGitUnavailable'].includes(state.error)
        && h('a', { href: 'https://github.com/mewcoder/power-dsh/releases', target: '_blank', rel: 'noopener noreferrer' }, t('pluginUpdateReleaseNotes')),
      ['unconfirmed', 'updating', 'done'].includes(state.phase) && h('p', { className: 'power-dsh-description', role: 'status' },
        state.phase === 'done' ? `${t('pluginUpdateDone')} ${state.target?.version || ''}`
          : t(state.phase === 'unconfirmed' ? 'pluginUpdateUnconfirmed' : 'pluginUpdateRunning')),
      state.notice && h('p', { className: 'power-dsh-description' }, t(state.notice)),
      state.phase === 'done' && state.restartRequired && h('p', { className: 'power-dsh-description' }, t('pluginUpdateRestart')),
      state.phase === 'done' && state.refreshRequired && h(Button, { size: 'sm', variant: 'outline', onClick: () => window.location.reload() }, t('pluginUpdateRefresh')),
      state.error && errorFeedback({ t, id: `${id}-plugin-update-error`, message: t(state.error), code: 'PD-PLUGIN-UPDATE',
        operation: state.pending ? 'pluginUpdate.observe' : 'pluginUpdate.check',
        observedAt: state.diagnostic?.observedAt, context: updateDiagnosticContext(state.diagnostic, pluginVersion, state.phase, t),
        retry: state.pending ? () => updates.resume() : undefined })),
      h('div', { className: 'power-dsh-plugin-update-actions' },
        h(Button, { size: 'md', variant: 'outline', disabled: !writable || busy || Boolean(state.pending)
          || state.error === 'pluginUpdateUnknown', 'aria-busy': state.phase === 'checking',
          onClick: () => updates.check() }, t(state.phase === 'checking' ? 'pluginUpdateChecking' : 'pluginUpdateCheck')),
        state.phase === 'available' && state.target && h(Button, { size: 'md', variant: 'primary', disabled: !writable || busy,
          onClick: () => { if (canUse() && updates.state.target) { confirmation.current = { target: updates.state.target }; setConfirming(updates.state.target); } },
        }, `${t('pluginUpdateAction')} ${state.target.version}`)),
      h(Modal, { open: Boolean(confirming) && writable && state.target === confirming, onClose: close,
        title: t('pluginUpdateConfirm'), closeLabel: t('close'), description: t('pluginUpdateConfirmDescription'),
        footer: h(React.Fragment, null,
          h(Button, { variant: 'outline', 'data-modal-autofocus': true, onClick: close }, t('cancel')),
          h(Button, { variant: 'primary', disabled: !writable || busy, onClick: confirm }, t('pluginUpdateAction'))),
      }, h('p', null, `${pluginVersion} → ${confirming?.version || ''}`)));
  }
  return {
    settings: [], useSettingsFooter,
    styles: `.power-dsh-plugin-update-actions { display:flex; align-items:center; align-self:flex-start; margin-top:3px; justify-content:flex-end; flex-wrap:wrap; flex:none; max-width:50%; gap:8px; }
.power-dsh-plugin-version { display:flex; align-items:baseline; flex-wrap:wrap; gap:4px 8px; }
.power-dsh-plugin-status { color:#4ade80; background:rgba(74,222,128,.14); border-radius:999px; padding:1px 8px; font-weight:600; }
.power-dsh-plugin-update a { display:inline-block; margin-top:8px; color:var(--dsw-alias-state-business-primary); }`,
    api: { pluginUpdateSource: updateSource, pluginUpdates: updates },
  } satisfies ClientFeature;
}
