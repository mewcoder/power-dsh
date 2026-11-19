export interface WhaleHandle { play(): void; dispose(): void }

export function attachWhale(canvas: HTMLCanvasElement, atlasUrl: string, failed: () => void): WhaleHandle {
  const context = canvas.getContext('2d');
  if (!context) { failed(); return { play() {}, dispose() {} }; }
  const image = new Image();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false;
  let pixels: Uint8ClampedArray | null = null;
  let started: number | null = null;
  let requested = false;
  let lastStarted = -Infinity;
  let visible = true;
  let frame = 0;
  let previous = -Infinity;
  let width = 0;
  let height = 0;
  const clear = () => context.clearRect(0, 0, width, height);
  const stop = () => { cancelAnimationFrame(frame); frame = 0; started = null; clear(); };
  const eligible = () => !disposed && !document.hidden && !motion.matches && visible && width > 0 && height > 0;
  const fail = () => { if (!disposed) { requested = false; stop(); failed(); } };
  const paint = (now: number) => {
    frame = 0;
    if (!eligible() || started === null || !pixels) { stop(); return; }
    if (previous === -Infinity) { started = now; lastStarted = now; }
    const progress = (now - started) / 5700;
    if (progress >= 1) { stop(); return; }
    if (now - previous >= 1000 / 24) {
      previous = now;
      clear();
      const index = Math.floor(progress * 137);
      const offsetX = index % 12 * 192;
      const offsetY = Math.floor(index / 12) * 108;
      const sceneWidth = Math.min(Math.max(width * 0.94, 720), height * 1.6, 1120) * 1.12;
      const cell = sceneWidth / 192;
      const left = (width - sceneWidth) / 2;
      const top = height * 0.43 - cell * 108 / 2;
      const fade = Math.min(1, progress * 15, (1 - progress) * 10);
      context.fillStyle = getComputedStyle(canvas).color;
      for (let row = 0; row < 108; row++) for (let column = 0; column < 192; column++) {
        const offset = ((offsetY + row) * 2304 + offsetX + column) * 4;
        const opacity = pixels[offset + 1] / 255;
        if (opacity < 0.015) continue;
        context.globalAlpha = opacity * 0.52 * fade;
        context.beginPath();
        context.arc(left + (column + 0.5) * cell, top + (row + 0.5) * cell, pixels[offset] / 255 * cell, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    }
    frame = requestAnimationFrame(paint);
  };
  const begin = () => {
    if (!eligible() || !pixels || started !== null || performance.now() - lastStarted < 10_000) return;
    started = performance.now(); previous = -Infinity; frame = requestAnimationFrame(paint);
  };
  const resize = () => {
    width = canvas.clientWidth; height = canvas.clientHeight;
    const scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
  };
  image.onload = () => {
    if (disposed) return;
    requested = false;
    const source = document.createElement('canvas');
    try {
      if (image.naturalWidth !== 2304 || image.naturalHeight !== 1296) throw new Error('atlas');
      source.width = 2304; source.height = 1296;
      const reader = source.getContext('2d');
      if (!reader) throw new Error('canvas');
      reader.drawImage(image, 0, 0);
      pixels = reader.getImageData(0, 0, 2304, 1296).data;
      begin();
    } catch { fail(); }
    finally { source.width = source.height = 0; image.removeAttribute('src'); }
  };
  image.onerror = fail;
  const visibility = () => { if (!eligible()) stop(); };
  const sizing = new ResizeObserver(resize);
  const intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; visibility(); });
  sizing.observe(canvas); intersection.observe(canvas);
  document.addEventListener('visibilitychange', visibility);
  motion.addEventListener('change', visibility);
  resize();
  return {
    play() {
      if (!eligible() || requested || started !== null || performance.now() - lastStarted < 10_000) return;
      if (pixels) { begin(); return; }
      requested = true;
      image.src = atlasUrl;
    },
    dispose() {
      disposed = true; stop(); pixels = null;
      image.onload = image.onerror = null; image.removeAttribute('src');
      sizing.disconnect(); intersection.disconnect();
      document.removeEventListener('visibilitychange', visibility); motion.removeEventListener('change', visibility);
      canvas.width = canvas.height = 0;
    },
  };
}
