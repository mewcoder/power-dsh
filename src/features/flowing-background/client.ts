import type { ClientEnvironment, ClientFeature, ClientRuntime } from '../../shared/client/types.ts';
import { watchBackground } from './attachment.ts';

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, observable, useSnapshot } = runtime;
  let unavailable = false;
  const attachment = observable(() => unavailable);
  function BackgroundController() {
    React.useLayoutEffect(() => watchBackground(status => {
      const next = status === 'unavailable';
      if (unavailable !== next) { unavailable = next; attachment.notify(); }
    }), []);
    return null;
  }
  function Background() {
    return h(BackgroundController);
  }
  env.preferenceSlot('flowingBackgroundEnabled', 'shell.overlay', {
    id: 'power-dsh-flowing-background', order: -100, locale: env.namespace,
  }, Background);
  const setting = { field: 'flowingBackgroundEnabled', description: 'flowingBackgroundDescription' } as const;
  return {
    settings: [setting],
    useSettings({ snapshot }) {
      const failed = useSnapshot(attachment);
      return [{ ...setting, error: failed && snapshot.value?.flowingBackgroundEnabled === true
        ? env.t('flowingBackgroundLayoutUnavailable') : undefined }];
    },
  } satisfies ClientFeature;
}
