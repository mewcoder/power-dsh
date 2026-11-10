/** Pause the component's looping SVG without resetting its timeline. */
export function attachLoopPlayback(svg: SVGSVGElement, doc: Document, motion: MediaQueryList | null) {
  const sync = () => {
    if (doc.hidden || motion?.matches) svg.pauseAnimations();
    else svg.unpauseAnimations();
  };
  doc.addEventListener('visibilitychange', sync);
  motion?.addEventListener('change', sync);
  sync();
  return () => {
    doc.removeEventListener('visibilitychange', sync);
    motion?.removeEventListener('change', sync);
    svg.pauseAnimations();
  };
}
