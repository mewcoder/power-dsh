import type { ClientRuntime, Listener, PublicPrimitives, ReactModule, SnapshotSource } from './types.ts';
import { createErrorFeedback } from './error-feedback.ts';
export function createRuntime(React: ReactModule, primitives: PublicPrimitives): ClientRuntime {
  const h = React.createElement;
  function observable<T>(getSnapshot: () => T) {
    const listeners = new Set<Listener>();
    return {
      getSnapshot,
      subscribe(listener: Listener) { listeners.add(listener); return () => listeners.delete(listener); },
      notify() { for (const listener of listeners) listener(); },
    };
  }
  function useSnapshot<T>(source: SnapshotSource<T>): T {
    return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  }
  function useMounted() {
    const mounted = React.useRef(true);
    React.useEffect(() => {
      mounted.current = true;
      return () => { mounted.current = false; };
    }, []);
    return mounted;
  }
  function loadingFeedback({ label, compact = false }: { label: string; compact?: boolean }) {
    return h('div', { className: 'power-dsh-loading', role: 'status', 'data-compact': compact || undefined },
      h(primitives.StateDot, { state: 'ongoing' }), h('span', null, label));
  }
  // Reuse the very same sprite symbols as the native Appearance controls.
  function NativeIcon({ glyph, size = 16 }: { glyph: string; size?: number }) {
    const id = `dsw-icon-${glyph}-medium`;
    return h('svg', { width: size, height: size, 'data-icon': id, 'aria-hidden': true, focusable: false },
      h('use', { href: `#${id}` }));
  }
  return { React, h, ...primitives, observable, useSnapshot, useMounted, NativeIcon, loadingFeedback, errorFeedback: createErrorFeedback(React, primitives.Button) };
}

export function errorMessage(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : undefined;
}
