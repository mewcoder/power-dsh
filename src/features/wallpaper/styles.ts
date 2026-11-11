export const styles = `
.power-dsh-wallpaper-page > .power-dsh-wallpaper-settings { margin-top:20px; }
.power-dsh-wallpaper-settings { display:flex; flex-direction:column; gap:20px; min-width:0; padding:0 0 16px; width:100%; }
.power-dsh-wallpaper-presets { display:grid; grid-template-columns:repeat(auto-fill,minmax(128px,1fr)); gap:8px; }
.power-dsh-wallpaper-tile { position:relative; min-width:0; border-radius:var(--dsw-radius-md); }
.power-dsh-wallpaper-tile[data-selected] { outline:1.5px solid var(--dsw-alias-label-tertiary); outline-offset:0; }
.power-dsh-wallpaper-preset { appearance:none; -webkit-appearance:none; box-shadow:none; box-sizing:border-box; display:flex; flex-direction:column; gap:6px; width:100%; min-width:0; padding:4px; border:1px solid transparent; border-radius:var(--dsw-radius-md); background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; cursor:pointer; text-align:left; }
.power-dsh-wallpaper-preset[aria-checked="true"] { color:var(--dsw-alias-label-primary); }
.power-dsh-wallpaper-preset-preview { display:flex; align-items:center; justify-content:center; width:100%; aspect-ratio:8/5; border-radius:var(--dsw-radius-sm); background-color:var(--dsw-alias-bg-layer-1); background-size:cover; background-position:center; overflow:hidden; color:var(--dsw-alias-label-tertiary); font-size:24px; }
.power-dsh-wallpaper-preset-preview[data-empty] { background-color:var(--dsw-alias-bg-module-platform); box-shadow:inset 0 0 0 0.5px var(--dsw-alias-border-l2); }
.power-dsh-wallpaper-preset-label { display:block; width:100%; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:12px; line-height:28px; }
.power-dsh-wallpaper-tile[data-has-actions] .power-dsh-wallpaper-preset-label { box-sizing:border-box; padding-right:60px; }
.power-dsh-wallpaper-preset:focus-visible { outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary)); outline-offset:2px; }
.power-dsh-wallpaper-preset:disabled { opacity:.4; cursor:default; }
.power-dsh-wallpaper-tile-actions { position:absolute; right:5px; bottom:5px; display:flex; align-items:center; gap:2px; color:var(--dsw-alias-label-secondary); }
.power-dsh-wallpaper-tile-actions .power-dsh-wallpaper-tile-action { display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; padding:0; color:var(--dsw-alias-label-tertiary); }
.power-dsh-wallpaper-tile-actions .power-dsh-wallpaper-tile-action:is(:hover,:focus-visible):not(:disabled) { color:var(--dsw-alias-label-secondary); }
@media(hover:hover) {
  .power-dsh-wallpaper-preset:hover:not(:disabled):not([aria-checked="true"]) { background:var(--dsw-alias-interactive-bg-hover); }
}
.power-dsh-wallpaper-file { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0; }
.power-dsh-wallpaper-slider { display:flex; align-items:center; gap:12px; min-width:0; }
.power-dsh-wallpaper-slider[data-wallpaper-previewing] { position:relative; isolation:isolate; }
.power-dsh-wallpaper-slider[data-wallpaper-previewing]::before { content:''; position:absolute; inset:-8px -12px; z-index:-1; pointer-events:none; border:0.5px solid var(--dsw-alias-border-l2); border-radius:var(--dsw-radius-md); background:var(--dsw-alias-bg-overlay); }
.power-dsh-wallpaper-slider label { font-size:12px; color:var(--dsw-alias-label-secondary); flex:none; }
.power-dsh-wallpaper-slider input {
  appearance:none; -webkit-appearance:none; flex:1; width:100%; min-width:0; height:36px; padding:0; margin:0;
  border:0; background:transparent; color:var(--dsw-alias-label-primary); cursor:ew-resize; touch-action:none;
}
.power-dsh-wallpaper-slider input::-webkit-slider-runnable-track {
  height:6px; border-radius:999px;
  background:linear-gradient(to right,var(--dsw-alias-label-primary) var(--power-dsh-slider-position),var(--dsw-alias-border-l2) var(--power-dsh-slider-position));
}
.power-dsh-wallpaper-slider input::-moz-range-track { height:6px; border-radius:999px; background:var(--dsw-alias-border-l2); }
.power-dsh-wallpaper-slider input::-moz-range-progress { height:6px; border-radius:999px; background:var(--dsw-alias-label-primary); }
.power-dsh-wallpaper-slider input::-webkit-slider-thumb {
  appearance:none; -webkit-appearance:none; box-sizing:border-box; width:16px; height:16px; margin-top:-5px;
  border:0; border-radius:999px; background:var(--dsw-alias-label-primary); transition:width 150ms ease-out,height 150ms ease-out,margin-top 150ms ease-out;
}
.power-dsh-wallpaper-slider input::-moz-range-thumb { box-sizing:border-box; width:16px; height:16px; border:0; border-radius:999px; background:var(--dsw-alias-label-primary); transition:width 150ms ease-out,height 150ms ease-out; }
.power-dsh-wallpaper-slider input:focus-visible { outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary)); outline-offset:2px; border-radius:var(--dsw-radius-sm); }
@media(hover:hover) {
  .power-dsh-wallpaper-slider input:hover:not(:disabled)::-webkit-slider-thumb { width:18px; height:18px; margin-top:-6px; }
  .power-dsh-wallpaper-slider input:hover:not(:disabled)::-moz-range-thumb { width:18px; height:18px; }
}
.power-dsh-wallpaper-slider input[data-pressed]:not(:disabled)::-webkit-slider-thumb { width:22px; height:16px; margin-top:-5px; }
.power-dsh-wallpaper-slider input[data-pressed]:not(:disabled)::-moz-range-thumb { width:22px; height:16px; }
.power-dsh-wallpaper-slider input:disabled { opacity:.5; cursor:not-allowed; }
.power-dsh-wallpaper-value { width:44px; flex:none; text-align:right; font-size:12px; font-variant-numeric:tabular-nums; color:var(--dsw-alias-label-secondary); }
.power-dsh-wallpaper-field { display:flex; flex-direction:column; gap:4px; }
.power-dsh-wallpaper-caption { font-size:12px; color:var(--dsw-alias-label-tertiary); margin:0; line-height:18px; }
@media(prefers-reduced-motion:reduce) {
  .power-dsh-wallpaper-slider input::-webkit-slider-thumb { width:16px !important; height:16px !important; margin-top:-5px !important; transition:none; }
  .power-dsh-wallpaper-slider input::-moz-range-thumb { width:16px !important; height:16px !important; transition:none; }
}
`;
