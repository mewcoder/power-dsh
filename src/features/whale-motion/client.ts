import type { ClientEnvironment, ClientFeature, ClientRuntime, IconProps, SettingContribution } from '../../shared/client/types.ts';
import { FISH_PATH, TAIL_SHAPES } from './geometry.ts';
import { attachLoopPlayback } from './playback.ts';
const SHAPES = TAIL_SHAPES.join(';');
// Selected study 12: two tail waves, a short rest, then repeat.
const TAIL_TIMES = '0;.076923;.144231;.215385;.288462;.365385;.442308;.548077;1';
const TAIL_SPLINES = Array(8).fill('.333333 0 .666667 1').join(';');
const STYLES = `
.power-dsh-whale-motion { display:inline-block; position:relative; flex-shrink:0; vertical-align:middle; pointer-events:none; }
.power-dsh-whale-motion .power-dsh-whale-clip { position:absolute; overflow:hidden; pointer-events:none; }
.power-dsh-whale-motion svg { display:block; position:absolute; overflow:visible; }
.power-dsh-whale-motion .power-dsh-whale-still { display:none; }
@media (prefers-reduced-motion:reduce) {
  .power-dsh-whale-motion .power-dsh-whale-animated { display:none; }
  .power-dsh-whale-motion .power-dsh-whale-still { display:inline; }
}
`;

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, observable, useSnapshot } = runtime;
  const { ctx, source, t } = env;
  let fault: { observedAt: string } | null = null;
  const status = observable(() => fault);
  const setting: SettingContribution = { field: 'whaleMotionEnabled', description: 'whaleMotionDescription' };
  function setFault(failed: boolean) {
    if (Boolean(fault) === failed) return;
    fault = failed ? { observedAt: new Date().toISOString() } : null;
    status.notify();
  }

  function AnimatedWhale({ size = 24 }: IconProps) {
    const box = React.useRef<HTMLSpanElement | null>(null);
    React.useEffect(() => {
      // This ref and query belong exclusively to this component, never the host.
      const svg = box.current?.querySelector?.('svg');
      if (!svg || typeof svg.pauseAnimations !== 'function') return;
      const motion = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
      return attachLoopPlayback(svg, document, motion);
    }, []);
    const height = size * 17.04 / 23.16;
    const pad = size / 6;
    return h('span', {
      className: 'power-dsh-whale-motion', ref: box, 'aria-hidden': true,
      style: { width: size, height },
    }, h('style', null, STYLES),
    h('span', { className: 'power-dsh-whale-clip', style: { inset: -pad } },
      h('svg', {
        width: size, height, viewBox: '0 0 23.16 17.04', fill: 'none', focusable: false,
        style: { left: pad, top: pad },
      },
      h('path', { className: 'power-dsh-whale-still', fill: 'currentColor', d: FISH_PATH }),
      h('path', { className: 'power-dsh-whale-animated', fill: 'currentColor', fillRule: 'evenodd', d: TAIL_SHAPES[0] },
        h('animate', { attributeName: 'd', values: SHAPES, keyTimes: TAIL_TIMES,
          calcMode: 'spline', keySplines: TAIL_SPLINES, dur: '5.2s', repeatCount: 'indefinite' })))));
  }

  // The public single slot shadows the official mark only; releasing it restores
  // the native contribution. Names, badges and the hero logo are independent.
  ctx.slots.inject('sidebar.brand.mark', () => {
    let release: (() => void) | null = null;
    let attempted = false;
    const sync = () => {
      const snapshot = source.getSnapshot();
      const enabled = snapshot.status === 'ready' && snapshot.value?.whaleMotionEnabled === true;
      if (!enabled) {
        release?.(); release = null; attempted = false; setFault(false);
      } else if (!release && !attempted) {
        attempted = true;
        try {
          release = ctx.slots.register({ name: 'sidebar.brand.mark', priority: -1 }, AnimatedWhale);
          setFault(false);
        } catch {
          // Preserve the native/conflicting mark and report through settings.
          setFault(true);
        }
      }
    };
    sync();
    const unsubscribe = source.subscribe(sync);
    return () => { unsubscribe(); release?.(); setFault(false); };
  });
  return {
    settings: [setting],
    useSettings() {
      const failure = useSnapshot(status);
      return [!failure ? setting : { ...setting, failure: {
        message: t('whaleMotionUnavailable'), code: 'PD-WHALE-SLOT', operation: 'whale-motion.register', observedAt: failure.observedAt,
      } }];
    },
  } satisfies ClientFeature;
}
