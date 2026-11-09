
import { errorMessage } from '../../shared/client/runtime.ts';
import type { ClientEnvironment, ClientFeature, ClientRuntime, FormSnapshot, SlotProps, SnapshotSource } from '../../shared/client/types.ts';
import { styles } from './styles.ts';

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, useSnapshot, useMounted, errorFeedback } = runtime;
  const { source, t, version } = env;
  function VersionBadge({ wide, t, source, version }: SlotProps & { source: SnapshotSource<FormSnapshot>; version: string | null }) {
    const snapshot = useSnapshot(source);
    const visible = wide && snapshot.status === 'ready' && snapshot.value?.showVersion === true && Boolean(version);
    const seat = React.useRef<HTMLSpanElement | null>(null);
    const [available, setAvailable] = React.useState(64);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');
    const pending = React.useRef(false);
    const mounted = useMounted();
    React.useEffect(() => {
      if (!visible || !seat.current) return;
      const element = seat.current;
      const measure = () => setAvailable(Math.max(0, element.getBoundingClientRect().right - 209));
      measure();
      if (typeof ResizeObserver !== 'function') return;
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      return () => observer.disconnect();
    }, [visible]);
    if (!visible) return null;
    const updates = window.dshDesktop?.protocolVersion === 1 ? window.dshDesktop.updates : undefined;
    const canUpdate = typeof updates?.open === 'function';
    const title = error || t(busy ? 'updating' : canUpdate ? 'openUpdate' : 'desktopOnly');
    async function openUpdate() {
      if (!canUpdate || pending.current) return;
      pending.current = true;
      setBusy(true);
      setError('');
      try {
        // User approved this native flow, including downloads and native install confirmation.
        await updates!.open();
      } catch (failure) {
        if (mounted.current) setError(errorMessage(failure) || t('updateFailed'));
      } finally {
        pending.current = false;
        if (mounted.current) setBusy(false);
      }
    }
    return h('span', { className: 'power-dsh-version-seat', ref: seat },
      h('style', null, styles),
      h('button', {
        type: 'button', className: 'power-dsh-version-badge',
        style: { maxWidth: `${available}px` }, title,
        'aria-label': `DSH ${version} · ${title}`, 'aria-busy': busy,
        disabled: !canUpdate || busy, onClick: openUpdate,
      }, version!.replace(/^v/, '')),
      error && errorFeedback({ t, message: error, code: 'PD-UPDATE-OPEN', operation: 'desktop.updates.open',
        placement: 'compact', className: 'power-dsh-version-error' }));
  }
  return { settings: [{ field: 'showVersion', description: 'versionDescription' }], sidebar: props => h(VersionBadge, { ...props, source, version }) } satisfies ClientFeature;
}
