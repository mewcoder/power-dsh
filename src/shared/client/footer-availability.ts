import type { ClientContext, ClientRuntime, UpdatePresentation } from './types.ts';

/** Keep optional footer shortcuts clear of the native connection and update indicators. */
export function createFooterBusySource(ctx: ClientContext, observable: ClientRuntime['observable']) {
  let connectionBusy = true;
  let updateBusy = false;
  const source = observable(() => connectionBusy || updateBusy);
  // The native connecting/recovery indicators can remain visible after reconnect.
  ctx.inject(['connection'], child => child.effect(() => {
    let timer: number | undefined;
    const state = child.connection.state;
    let previous = state?.getSnapshot();
    connectionBusy = previous !== 'connected';
    const sync = () => {
      const next = state.getSnapshot();
      if (next === previous) return;
      window.clearTimeout(timer);
      if (next !== 'connected') connectionBusy = true;
      else if (previous !== 'connected') {
        connectionBusy = true;
        timer = window.setTimeout(() => { connectionBusy = false; source.notify(); }, 3000);
      }
      previous = next;
      source.notify();
    };
    const unsubscribe = state?.subscribe(sync);
    source.notify();
    return () => { unsubscribe?.(); window.clearTimeout(timer); };
  }));
  ctx.effect(() => {
    const bridge = window.dshDesktop?.protocolVersion === 1 ? window.dshDesktop.updates : undefined;
    if (typeof bridge?.status !== 'function' || typeof bridge?.subscribe !== 'function') return;
    let active = true;
    let received = false;
    updateBusy = true;
    source.notify();
    const publish = (presentation: UpdatePresentation) => {
      if (!active) return;
      updateBusy = presentation?.phase !== 'idle';
      source.notify();
    };
    const unsubscribe = bridge.subscribe(presentation => { received = true; publish(presentation); });
    bridge.status().then(presentation => { if (!received) publish(presentation); }, () => {
      if (active && !received) { updateBusy = true; source.notify(); }
    });
    return () => { active = false; unsubscribe(); };
  });
  return source;
}
