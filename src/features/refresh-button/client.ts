import type { ClientEnvironment, ClientFeature, ClientRuntime, HeaderActionContext } from '../../shared/client/types.ts';

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, useSnapshot } = runtime;
  const { source, t } = env;
  function useHeaderAction({ wide, latestWide, mounted }: HeaderActionContext) {
    const config = useSnapshot(source);
    const visible = wide && config.status === 'ready' && config.value?.showRefreshButton === true;
    const [error, setError] = React.useState('');
    const canUse = () => {
      const current = source.getSnapshot();
      return mounted.current && latestWide.current && current.status === 'ready' && current.value?.showRefreshButton === true;
    };
    return { id: 'refresh', label: t('refresh'), visible, error, canUse, select() {
      setError('');
      try { window.location.reload(); } catch (_failure) { setError(t('refreshFailed')); }
    } };
  }
  return { settings: [{ field: 'showRefreshButton', description: 'refreshDescription' }], headerAction: useHeaderAction } satisfies ClientFeature;
}
