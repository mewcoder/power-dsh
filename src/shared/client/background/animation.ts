import { createPatternRenderer } from './pattern.ts';
export type AnimationWindow = Pick<Window, 'innerWidth' | 'innerHeight' | 'devicePixelRatio' | 'matchMedia' | 'requestAnimationFrame' | 'cancelAnimationFrame' | 'addEventListener' | 'removeEventListener'>;
type AnimationDocument = Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>;

/** Bound backing-store size even on very large windows and high-DPI screens. */
export function canvasSize(width: number, height: number, ratio: number) {
  const w = Math.max(1, width || 1);
  const h = Math.max(1, height || 1);
  const scale = Math.min(Math.max(1, ratio || 1), 1.5, Math.sqrt(2_000_000 / (w * h)));
  return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)) };
}

/** Own the pattern's frame chain, visibility, motion preference and GPU lifetime. */
export function startAnimation(canvas: HTMLCanvasElement, win: AnimationWindow = window, doc: AnimationDocument = document, region?: HTMLElement) {
  let renderer = createPatternRenderer(canvas);
  if (!renderer) return () => {};
  canvas.style.background = 'none';
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  let frame: number | null = null;
  let disposed = false;
  let previous: number | null = null;
  let elapsed = 0;
  let lastPaint = -Infinity;
  let cssWidth = 1;
  let cssHeight = 1;
  const paint = () => renderer?.draw(elapsed / 1000, cssWidth, cssHeight);
  const cancel = () => {
    if (frame !== null) win.cancelAnimationFrame(frame);
    frame = null;
    previous = null;
  };
  const tick = (time: number) => {
    frame = null;
    if (disposed || !renderer || doc.hidden || motion.matches) return;
    if (previous !== null) elapsed += Math.min(100, Math.max(0, time - previous));
    previous = time;
    if (time - lastPaint >= 1000 / 24) { paint(); lastPaint = time; }
    frame = win.requestAnimationFrame(tick);
  };
  const sync = () => {
    cancel();
    if (disposed || !renderer || doc.hidden) return;
    paint();
    lastPaint = -Infinity;
    if (!motion.matches) frame = win.requestAnimationFrame(tick);
  };
  const resize = () => {
    cssWidth = Math.max(1, region?.clientWidth ?? win.innerWidth);
    cssHeight = Math.max(1, region?.clientHeight ?? win.innerHeight);
    const size = canvasSize(cssWidth, cssHeight, win.devicePixelRatio);
    canvas.width = size.width;
    canvas.height = size.height;
    sync();
  };
  const lost = (event: Event) => {
    event.preventDefault();
    cancel();
    renderer?.dispose();
    renderer = null;
    canvas.style.background = '';
  };
  const restored = () => {
    if (disposed) return;
    renderer = createPatternRenderer(canvas);
    canvas.style.background = renderer ? 'none' : '';
    resize();
  };
  const observer = region && typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  if (region) observer?.observe(region);
  win.addEventListener('resize', resize);
  doc.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  resize();
  return () => {
    if (disposed) return;
    disposed = true;
    cancel();
    observer?.disconnect();
    win.removeEventListener('resize', resize);
    doc.removeEventListener('visibilitychange', sync);
    motion.removeEventListener('change', sync);
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', restored);
    renderer?.dispose();
    renderer = null;
    canvas.style.background = '';
  };
}
