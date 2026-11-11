// Only self-owned artwork receives color. The fallback stays behind the
// transparent GPU layer and is removed while the measured pattern is active.
export const styles = `
.power-dsh-flowing-background {
  position: absolute; inset: 0; z-index: -1; overflow: hidden; pointer-events: none !important;
  user-select: none; contain: strict;
}
.power-dsh-flowing-background canvas {
  display: block; width: 100%; height: 100%; pointer-events: none !important;
  background: linear-gradient(180deg, rgba(156, 193, 231, .4) 0%, transparent 100%);
}
.power-dsh-flowing-background[data-kind="wallpaper"] {
  background: var(--dsw-alias-bg-base);
}
.power-dsh-flowing-background img.power-dsh-wallpaper {
  display: block; width: 100%; height: 100%; max-width: none; object-fit: cover; pointer-events: none !important;
  background: var(--dsw-alias-bg-base);
}
.power-dsh-flowing-background .power-dsh-wallpaper-veil {
  position: absolute; inset: 0; pointer-events: none !important; background: var(--dsw-alias-bg-base);
}
`;
