import { errorMessage } from '../../shared/client/runtime.ts';
import type { ClientEnvironment, ClientFeature, ClientRuntime, HeaderActionContext } from '../../shared/client/types.ts';
import type { RestartStatus } from './rpc.ts';
interface RestartState extends Omit<RestartStatus, 'error'> { error: string; }

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, Modal, Button, observable, useSnapshot } = runtime;
  const { ctx, form, source, t } = env;
  function isMacDesktop() {
    return window.dshDesktop?.protocolVersion === 1 && window.location.protocol === 'dsh-app:'
      && document.documentElement.getAttribute('data-platform') === 'darwin';
  }
  let active = true;
  ctx.effect(() => () => { active = false; restartGeneration++; });
  let restartState = { supported: false, running: false, error: '' };
  const restartSource = observable(() => restartState);
  let restartReadPending = false;
  let restartGeneration = 0;
  let restartWritePending = false;
  const publishRestart = (patch: Partial<RestartState>) => { restartState = { ...restartState, ...patch }; restartSource.notify(); };
  const loadRestartStatus = async () => {
    if (!active || !isMacDesktop() || restartReadPending || restartWritePending) return;
    restartReadPending = true;
    const generation = restartGeneration;
    try {
      const reply = await ctx.remote.powerDsh.restartStatus();
      if (!active || restartWritePending || generation !== restartGeneration) return;
      if (!reply.ok) throw new Error('restartUnavailable');
      publishRestart(reply.value);
    } catch (_failure) {
      if (active && generation === restartGeneration) publishRestart({ error: 'restartUnavailable' });
    } finally { restartReadPending = false; }
  };
  const restartApp = async () => {
    if (!active || !isMacDesktop() || restartWritePending || restartState.running
      || !restartState.supported || form.getSnapshot().value?.showRestartButton !== true) return;
    restartWritePending = true;
    restartGeneration++;
    publishRestart({ running: true, error: '' });
    try {
      const reply = await ctx.remote.powerDsh.restartApp();
      if (!reply.ok) throw new Error(reply.error.message);
    } catch (failure) {
      const message = errorMessage(failure);
      if (active) publishRestart({ running: false,
        error: message === 'restartBusy' || message === 'restartUnavailable' ? message : 'restartFailed' });
    } finally {
      restartWritePending = false;
      if (active && restartState.running) void loadRestartStatus();
    }
  };
  function useHeaderAction({ wide, latestWide, mounted }: HeaderActionContext) {
    const config = useSnapshot(source);
    const status = useSnapshot(restartSource);
    const requested = wide && config.status === 'ready' && config.value?.showRestartButton === true && isMacDesktop();
    const visible = requested && status.supported;
    React.useEffect(() => {
      if (!requested) return;
      void loadRestartStatus();
      const timer = window.setInterval(loadRestartStatus, 2000);
      return () => window.clearInterval(timer);
    }, [requested]);
    const [confirming, setConfirming] = React.useState(false);
    const confirmation = React.useRef<object | false>(false);
    const closeConfirmation = () => { confirmation.current = false; setConfirming(false); };
    React.useEffect(() => { if (!visible || status.running) closeConfirmation(); }, [visible, status.running]);
    const canUse = () => {
      const current = source.getSnapshot();
      const status = restartSource.getSnapshot();
      return mounted.current && latestWide.current && current.status === 'ready' && current.value?.showRestartButton === true
        && isMacDesktop() && status.supported && !status.running;
    };
    const request = confirmation.current;
    const confirmRestart = () => {
      if (!request || confirmation.current !== request || !canUse()) return;
      closeConfirmation();
      void restartApp();
    };
    return { id: 'restart', label: t('restart'), visible, disabled: status.running, error: status.error && t(status.error), canUse,
      isConfirming: () => Boolean(confirmation.current),
      select() { if (!confirmation.current) { confirmation.current = {}; setConfirming(true); } },
      dialog: h(Modal, { open: confirming && visible && !status.running, onClose: closeConfirmation,
        title: t('restart'), closeLabel: t('close'), description: t('restartConfirm'),
        footer: h(React.Fragment, null,
          h(Button, { variant: 'outline', 'data-modal-autofocus': true, onClick: closeConfirmation }, t('cancel')),
          h(Button, { variant: 'primary', disabled: status.running, onClick: confirmRestart }, t('restartAction'))),
      }),
    };
  }
  return { settings: [{ field: 'showRestartButton', description: 'restartDescription', hidden: !isMacDesktop() }], headerAction: useHeaderAction, api: { restartSource, loadRestartStatus, restartApp } } satisfies ClientFeature;
}
