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

.power-dsh-page .power-dsh-slider-field { display:inline-flex; align-items:center; gap:10px; min-width:190px; justify-content:flex-end; }
.power-dsh-page .power-dsh-slider { box-sizing:border-box; width:150px; margin:0; accent-color:var(--dsw-alias-state-business-primary); cursor:pointer; }
.power-dsh-page .power-dsh-slider:disabled { opacity:.5; cursor:default; }
.power-dsh-page .power-dsh-slider-value { min-width:44px; text-align:right; font-variant-numeric:tabular-nums; color:var(--dsw-alias-label-secondary); font-size:13px; }
:is(.power-dsh-page, .power-dsh-background-panel) .power-dsh-wallpaper-field { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:12px; }
:is(.power-dsh-page, .power-dsh-background-panel) .power-dsh-wallpaper-details { display:flex; align-items:center; gap:12px; min-width:0; }
:is(.power-dsh-page, .power-dsh-background-panel) .power-dsh-wallpaper-actions { display:flex; align-items:center; justify-content:flex-end; gap:8px; }
:is(.power-dsh-page, .power-dsh-background-panel) .power-dsh-wallpaper-action { flex:none; white-space:nowrap; }
:is(.power-dsh-page, .power-dsh-background-panel) .power-dsh-wallpaper-preview { display:block; width:56px; height:36px; border-radius:var(--dsw-radius-sm); object-fit:cover; border:.5px solid var(--dsw-alias-border-l4); }
:is(.power-dsh-page, .power-dsh-background-panel) .power-dsh-wallpaper-name { max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-secondary); font-size:13px; }
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
/* Type choice as a segmented control: two options, one selected. */
.power-dsh-background-kind { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 3px; border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); }
.power-dsh-background-kind-option { box-sizing: border-box; min-height: 30px; border: 0; border-radius: var(--dsw-radius-sm); padding: 0 10px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 13px; cursor: pointer; }
.power-dsh-background-kind-option[aria-checked="true"] { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-weight: 500; box-shadow: var(--dsw-elevation-raise); }
.power-dsh-background-kind-option:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset: 2px; }
.power-dsh-background-kind-option:disabled { opacity: .5; cursor: default; }
.power-dsh-background-panel .power-dsh-setting-row { display: flex; flex-direction: column; align-items: stretch; gap: 12px; padding-top: 20px; border-top: .5px solid var(--dsw-alias-border-l2); }
.power-dsh-background-panel .power-dsh-setting-label { font-size: 14px; line-height: 22px; }
.power-dsh-background-panel .power-dsh-description { margin-top: 4px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.power-dsh-background-panel .power-dsh-wallpaper-name { flex: 1; min-width: 0; max-width: none; }
.power-dsh-background-panel .power-dsh-wallpaper-preview { flex: none; width: 64px; height: 42px; }
@media (max-width:360px) {
  .power-dsh-background-panel .power-dsh-wallpaper-field { grid-template-columns:minmax(0,1fr); }
}
`;
