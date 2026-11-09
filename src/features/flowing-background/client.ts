import type { ClientEnvironment, ClientFeature, ClientRuntime } from '../../shared/client/types.ts';
import { watchBackground } from './attachment.ts';
import type { AttachmentFailure } from './attachment.ts';
import { presentFailure, sameFailure } from './diagnostics.ts';

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, observable, useSnapshot } = runtime;
  let fault: { issue: AttachmentFailure; observedAt: string } | null = null;
  const attachment = observable(() => fault);
  function BackgroundController() {
    React.useLayoutEffect(() => {
      let firstReport = true;
      return watchBackground(status => {
        if (status.state === 'attached') {
          if (fault) { fault = null; attachment.notify(); }
        } else if (firstReport || !fault || !sameFailure(fault.issue, status)) {
          fault = { issue: status, observedAt: new Date().toISOString() };
          attachment.notify();
        }
        firstReport = false;
      });
    }, []);
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
      if (!failed || snapshot.value?.flowingBackgroundEnabled !== true) return [setting];
      return [{ ...setting, failure: presentFailure(failed.issue, failed.observedAt, env.t) }];
    },
  } satisfies ClientFeature;
}
