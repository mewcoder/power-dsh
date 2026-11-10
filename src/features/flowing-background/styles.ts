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
.power-dsh-flowing-background img.power-dsh-wallpaper {
  display: block; width: 100%; height: 100%; object-fit: cover; pointer-events: none !important;
  background: var(--dsw-alias-bg-base);
}
`;

// The filled selector matches the reasoning-style selector; the icon uses a host Button.
export const settingsStyles = `
.power-dsh-page .power-dsh-background-controls { display:inline-flex; align-items:center; flex:none; gap:8px; }
.power-dsh-page .power-dsh-background-style-select { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; gap:12px; min-height:36px; max-width:100%; padding:0 14px; border:0; border-radius:var(--dsw-radius-md); background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-primary); font:inherit; font-size:14px; line-height:22px; cursor:pointer; }
.power-dsh-page .power-dsh-background-style-select:disabled { opacity:.5; cursor:default; }
.power-dsh-page .power-dsh-background-style-select:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
@media (hover:hover) { .power-dsh-page .power-dsh-background-style-select:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); } }
.power-dsh-page .power-dsh-background-tune-trigger { display:inline-flex; align-items:center; justify-content:center; flex:none; width:28px; height:28px; padding:0; }

.power-dsh-background-shortcut { display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border:0; border-radius:var(--dsw-radius-sm); padding:0; background:transparent; color:var(--dsw-alias-label-secondary); cursor:pointer; }
@media (hover:hover) { .power-dsh-background-shortcut:hover { background:var(--dsw-alias-interactive-bg-hover); } }
.power-dsh-background-shortcut:active { background:var(--dsw-alias-interactive-bg-active); }
.power-dsh-background-shortcut:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary)); outline-offset:2px; }
.power-dsh-page .power-dsh-slider-field { display:inline-flex; align-items:center; gap:10px; min-width:190px; justify-content:flex-end; }
.power-dsh-page .power-dsh-slider { box-sizing:border-box; width:150px; margin:0; accent-color:var(--dsw-alias-state-business-primary); cursor:pointer; }
.power-dsh-page .power-dsh-slider:disabled { opacity:.5; cursor:default; }
.power-dsh-page .power-dsh-slider-value { min-width:44px; text-align:right; font-variant-numeric:tabular-nums; color:var(--dsw-alias-label-secondary); font-size:13px; }
.power-dsh-wallpaper-row { display:flex; align-items:center; gap:10px; min-width:0; }
.power-dsh-wallpaper-details { display:flex; flex:1 1 auto; align-items:center; gap:10px; min-width:0; }
.power-dsh-wallpaper-thumb { flex:none; display:inline-flex; width:44px; height:30px; overflow:hidden; border-radius:var(--dsw-radius-sm); background:var(--dsw-alias-bg-layer-1); }
.power-dsh-wallpaper-preview { display:block; width:100%; height:100%; object-fit:cover; }
.power-dsh-wallpaper-copy { display:flex; flex-direction:column; gap:1px; min-width:0; }
.power-dsh-wallpaper-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-primary); font-size:13px; line-height:18px; }
.power-dsh-wallpaper-hint { color:var(--dsw-alias-label-tertiary); font-size:11px; line-height:16px; }
.power-dsh-wallpaper-actions { display:flex; flex:none; align-items:center; gap:2px; }
/* Mirrors the native modal close control: 28x28, transparent, hover fill only. */
.power-dsh-wallpaper-icon { flex:none; display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border:0; border-radius:var(--dsw-radius-sm); padding:0; background:transparent; color:var(--dsw-alias-label-secondary); cursor:pointer; }
@media (hover:hover) { .power-dsh-wallpaper-icon:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); } }
.power-dsh-wallpaper-icon:active:not(:disabled) { background:var(--dsw-alias-interactive-bg-active); }
.power-dsh-wallpaper-icon:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary)); outline-offset:2px; }
.power-dsh-wallpaper-icon:disabled { opacity:.4; cursor:not-allowed; }
.power-dsh-wallpaper-icon.is-danger:hover:not(:disabled) { color:var(--dsw-alias-state-error-primary); }
:is(.power-dsh-page, .power-dsh-background-panel) .power-dsh-wallpaper-input { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0; }
`;

// Modal geometry follows ui-primitives/Modal.module.css. The separate material
// follows MenuSurface so only its background is translucent and blurred.
export const panelStyles = `
.power-dsh-background-panel {
  position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 60;
  box-sizing: border-box; display: flex; flex-direction: column; isolation: isolate;
  width: min(380px, calc(100vw - 48px)); max-height: calc(100vh - 48px);
  padding: 0 0 24px; overflow: hidden; border: 0; border-radius: var(--dsw-radius-panel);
  background: transparent; color: var(--dsw-alias-label-primary);
  box-shadow: var(--dsw-elevation-prominent); pointer-events: auto; font: inherit;
}
.power-dsh-background-panel-material {
  position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 32%, transparent);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
.power-dsh-background-panel-head { display: flex; flex: none; align-items: center; justify-content: space-between; gap: 8px; padding: 22px 14px 12px 24px; }
.power-dsh-background-panel-title { margin: 0; font-size: 16px; line-height: 24px; font-weight: 500; }
.power-dsh-background-panel-close { flex: none; width: 28px; height: 28px; padding: 0; color: var(--dsw-alias-label-secondary); }
.power-dsh-background-panel-body { display: flex; flex-direction: column; gap: 20px; min-height: 0; padding: 8px 24px 0; overflow-y: auto; }
.power-dsh-background-panel-slider { display: flex; flex-direction: column; gap: 10px; }
.power-dsh-background-panel-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.power-dsh-background-panel-label { font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-primary); }
.power-dsh-background-panel-value { font-size: 12px; line-height: 18px; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary); }
.power-dsh-background-panel .power-dsh-slider { box-sizing: border-box; width: 100%; height: 20px; margin: 0; accent-color: var(--dsw-alias-brand-primary); cursor: pointer; }
.power-dsh-background-panel .power-dsh-slider:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset: 4px; border-radius: var(--dsw-radius-xs); }
.power-dsh-background-panel .power-dsh-slider:disabled { opacity: .4; cursor: not-allowed; }
/* Grouping: each block states what it changes, so the panel reads top-down. */
.power-dsh-background-panel-section { display: flex; flex-direction: column; gap: 12px; }
.power-dsh-background-panel-section + .power-dsh-background-panel-section { padding-top: 16px; border-top: .5px solid var(--dsw-alias-border-l2); }
.power-dsh-background-panel-section-title { font-size: 12px; line-height: 18px; font-weight: 500; color: var(--dsw-alias-label-secondary); }
.power-dsh-background-panel-hint { margin: -4px 0 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
/* Type choice as a plain radio group: two labelled options, no dropdown. */
.power-dsh-background-kind { margin: 0; border: 0; padding: 0; }
.power-dsh-background-kind > legend { padding: 0; }
/* The two options sit on one line, side by side. */
.power-dsh-background-options { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 18px; }
.power-dsh-background-radio { display: inline-flex; align-items: center; gap: 6px; min-height: 24px; color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 18px; cursor: pointer; }
.power-dsh-background-radio input { flex: none; width: 14px; height: 14px; margin: 0; accent-color: var(--dsw-alias-brand-primary); cursor: pointer; }
.power-dsh-background-radio input:disabled { cursor: default; }
.power-dsh-background-radio input:disabled + .power-dsh-background-radio-label { opacity: .5; }
.power-dsh-background-radio input:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset: 2px; }
.power-dsh-background-panel .power-dsh-setting-row { display: flex; flex-direction: column; align-items: stretch; gap: 12px; padding-top: 20px; border-top: .5px solid var(--dsw-alias-border-l2); }
.power-dsh-background-panel .power-dsh-setting-label { font-size: 14px; line-height: 22px; }
.power-dsh-background-panel .power-dsh-description { margin-top: 4px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
@media (max-width:360px) {
  .power-dsh-background-panel .power-dsh-wallpaper-hint { display: none; }
}
`;
