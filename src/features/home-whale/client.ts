import type { ReactNode, MouseEvent, FocusEvent } from 'react';
import type { ClientRuntime, ClientEnvironment, ClientFeature } from '../../shared/client/types.ts';
import { attachWhale, type WhaleHandle } from './renderer.ts';
import { createWhaleTrigger } from './trigger.ts';
import atlas from '../../../assets/animations/home-whale.json' with { type: 'json' };

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment): ClientFeature {
  const { React, h, observable, useSnapshot } = runtime;
  let error = false;
  const status = observable(() => error);
  function Frame({ hero, children }: { hero?: boolean; children?: ReactNode }) {
    const whale = React.useRef<WhaleHandle | null>(null);
    const trigger = React.useRef<ReturnType<typeof createWhaleTrigger> | null>(null);
    const canvasRef = React.useCallback((canvas: HTMLCanvasElement | null) => {
      whale.current?.dispose(); trigger.current?.dispose();
      whale.current = null; trigger.current = null;
      if (canvas) {
        whale.current = attachWhale(canvas, atlas.dataUrl, () => { error = true; status.notify(); });
        trigger.current = createWhaleTrigger(() => whale.current?.play());
      }
    }, []);
    React.useEffect(() => {
      if (!hero) return;
      const key = (event: KeyboardEvent) => trigger.current?.key(event);
      document.addEventListener('keydown', key, true);
      return () => document.removeEventListener('keydown', key, true);
    }, [hero]);
    const activate = (event: MouseEvent<HTMLDivElement> | FocusEvent<HTMLDivElement>) => {
      const target = event.target;
      if (!(target instanceof Element) || !event.currentTarget.contains(target)) return;
      const input = target.closest('[data-composer-input][contenteditable="true"]');
      trigger.current?.activate({ isTrusted: event.nativeEvent.isTrusted, type: event.type,
        button: 'button' in event ? event.button : undefined }, input !== null);
    };
    return h('div', { style: { display: 'contents' }, onClickCapture: activate, onFocusCapture: activate },
      hero && h('canvas', { ref: canvasRef, 'aria-hidden': true, 'data-power-dsh-whale': '', style: {
        position: 'absolute', inset: 0, zIndex: -1, width: '100%', height: '100%', display: 'block',
        pointerEvents: 'none', opacity: 0.18, color: 'var(--dsw-alias-label-secondary)', filter: 'grayscale(1)',
      } }), children);
  }
  env.preferenceSlot('homeWhaleFocusEnabled', 'conversation.hero.frame', { id: 'pixel-whale', priority: -1 }, Frame);
  const setting = { field: 'homeWhaleFocusEnabled', description: 'homeWhaleFocusDescription',
    save: (next: unknown) => env.savePreference('homeWhaleFocusEnabled', next === true) } as const;
  return { settings: [setting], useSettings: () => {
    const failed = useSnapshot(status);
    return [{ ...setting, ...(failed ? { failure: { message: env.t('homeWhaleFailed'), code: 'PD-HOME-WHALE', operation: 'homeWhale.render' } } : {}) }];
  } };
}
