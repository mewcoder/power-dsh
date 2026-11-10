export const styles = `
/* Usage page mirrors the native settings density: quiet cards, no nested chrome. */
.power-dsh-usage-page .power-dsh-usage-body { display:flex; flex-direction:column; gap:20px; margin-top:16px; }
.power-dsh-usage-page .power-dsh-usage-summary { display:flex; flex-wrap:wrap; border:.5px solid var(--dsw-alias-settings-card-stroke); border-radius:var(--dsw-radius-xl); background:var(--dsw-alias-settings-card-fill); overflow:hidden; }
.power-dsh-usage-page .power-dsh-usage-metric { flex:1 1 0; min-width:120px; padding:14px 16px; text-align:center; }
.power-dsh-usage-page .power-dsh-usage-metric + .power-dsh-usage-metric { border-left:.5px solid var(--dsw-alias-border-l2); }
.power-dsh-usage-page .power-dsh-usage-metric-value { color:var(--dsw-alias-label-primary); font-size:16px; font-weight:500; line-height:24px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.power-dsh-usage-page .power-dsh-usage-metric-label { margin-top:2px; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.power-dsh-usage-page .power-dsh-usage-card { display:flex; flex-direction:column; gap:14px; padding:14px 16px; border:.5px solid var(--dsw-alias-settings-card-stroke); border-radius:var(--dsw-radius-xl); background:var(--dsw-alias-settings-card-fill); }
.power-dsh-usage-page .power-dsh-usage-card-head { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px; }
.power-dsh-usage-page .power-dsh-usage-card-title { margin:0; color:var(--dsw-alias-label-primary); font-size:13px; font-weight:500; line-height:20px; }
.power-dsh-usage-page .power-dsh-usage-section-title { margin:0; color:var(--dsw-alias-label-primary); font-size:13px; font-weight:500; line-height:20px; }
.power-dsh-usage-page .power-dsh-usage-range { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px; }
/* Segmented control: the selected pill is the only raised surface. */
.power-dsh-usage-page .power-dsh-usage-tabs { display:inline-flex; align-items:center; gap:2px; padding:2px; border-radius:999px; background:var(--dsw-alias-bg-module-platform); }
.power-dsh-usage-page .power-dsh-usage-tab { border:0; border-radius:999px; padding:2px 10px; background:transparent; color:var(--dsw-alias-label-tertiary); font:inherit; font-size:12px; line-height:18px; cursor:pointer; }
.power-dsh-usage-page .power-dsh-usage-tab[aria-selected="true"] { background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); box-shadow:0 0 0 .5px var(--dsw-alias-border-l2); }
.power-dsh-usage-page .power-dsh-usage-tab[aria-disabled="true"] { cursor:default; opacity:.6; }
.power-dsh-usage-page .power-dsh-usage-tab:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-usage-page .power-dsh-usage-heatmap { display:flex; flex-direction:column; gap:6px; min-width:0; }
.power-dsh-usage-page .power-dsh-usage-heatmap-grid { display:grid; gap:3px; min-width:0; }
.power-dsh-usage-page .power-dsh-usage-heatmap-column { display:flex; flex-direction:column; gap:3px; min-width:0; }
.power-dsh-usage-page .power-dsh-usage-heatmap-cell { display:block; aspect-ratio:1; width:100%; min-width:0; border-radius:3px; corner-shape:round; background:var(--dsw-alias-bg-module-platform); }
.power-dsh-usage-page .power-dsh-usage-heatmap-cell[data-has-usage="true"] { box-shadow:inset 0 0 0 .5px color-mix(in srgb,var(--dsw-alias-state-business-primary) 30%,transparent); }
.power-dsh-usage-page .power-dsh-usage-heatmap-cell[data-level="1"] { background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 22%,var(--dsw-alias-bg-module-platform)); }
.power-dsh-usage-page .power-dsh-usage-heatmap-cell[data-level="2"] { background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 42%,var(--dsw-alias-bg-module-platform)); }
.power-dsh-usage-page .power-dsh-usage-heatmap-cell[data-level="3"] { background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 68%,var(--dsw-alias-bg-module-platform)); }
.power-dsh-usage-page .power-dsh-usage-heatmap-cell[data-level="4"] { background:var(--dsw-alias-state-business-primary); }
.power-dsh-usage-page .power-dsh-usage-heatmap-months { display:grid; gap:3px; min-width:0; }
.power-dsh-usage-page .power-dsh-usage-heatmap-month { min-width:0; overflow:hidden; color:var(--dsw-alias-label-tertiary); font-size:10px; line-height:14px; white-space:nowrap; }
.power-dsh-usage-page .power-dsh-usage-legend { display:flex; flex-wrap:wrap; align-items:center; gap:12px; min-width:0; }
.power-dsh-usage-page .power-dsh-usage-legend-item { display:inline-flex; align-items:center; gap:6px; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.power-dsh-usage-page .power-dsh-usage-legend-dot { display:inline-block; flex:none; width:8px; height:8px; border-radius:50%; corner-shape:round; background:var(--dsw-alias-label-tertiary); }
.power-dsh-usage-page .power-dsh-usage-legend-dot[data-model="0"], .power-dsh-usage-page .power-dsh-usage-model-bar-fill[data-model="0"], .power-dsh-usage-page .power-dsh-usage-chart-line[data-model="0"] { --power-dsh-model-color:#3b82f6; }
.power-dsh-usage-page .power-dsh-usage-legend-dot[data-model="1"], .power-dsh-usage-page .power-dsh-usage-model-bar-fill[data-model="1"], .power-dsh-usage-page .power-dsh-usage-chart-line[data-model="1"] { --power-dsh-model-color:#8b5cf6; }
.power-dsh-usage-page .power-dsh-usage-legend-dot[data-model="2"], .power-dsh-usage-page .power-dsh-usage-model-bar-fill[data-model="2"], .power-dsh-usage-page .power-dsh-usage-chart-line[data-model="2"] { --power-dsh-model-color:#14b8a6; }
.power-dsh-usage-page .power-dsh-usage-legend-dot[data-model="3"], .power-dsh-usage-page .power-dsh-usage-model-bar-fill[data-model="3"], .power-dsh-usage-page .power-dsh-usage-chart-line[data-model="3"] { --power-dsh-model-color:#f59e0b; }
.power-dsh-usage-page .power-dsh-usage-legend-dot[data-model="4"], .power-dsh-usage-page .power-dsh-usage-model-bar-fill[data-model="4"], .power-dsh-usage-page .power-dsh-usage-chart-line[data-model="4"] { --power-dsh-model-color:#ec4899; }
.power-dsh-usage-page .power-dsh-usage-legend-dot[data-model="5"], .power-dsh-usage-page .power-dsh-usage-model-bar-fill[data-model="5"], .power-dsh-usage-page .power-dsh-usage-chart-line[data-model="5"] { --power-dsh-model-color:#64748b; }
.power-dsh-usage-page .power-dsh-usage-legend-dot[data-model], .power-dsh-usage-page .power-dsh-usage-model-bar-fill[data-model] { background:var(--power-dsh-model-color); }
.power-dsh-usage-page .power-dsh-usage-chart-line { stroke:var(--power-dsh-model-color); stroke-width:1.5; stroke-linejoin:round; stroke-linecap:round; }
.power-dsh-usage-page .power-dsh-usage-chart { display:flex; flex-direction:column; gap:6px; min-width:0; }
.power-dsh-usage-page .power-dsh-usage-chart-svg { display:block; width:100%; height:180px; overflow:visible; }
.power-dsh-usage-page .power-dsh-usage-chart-axis { stroke:var(--dsw-alias-border-l2); stroke-width:1; vector-effect:non-scaling-stroke; }
.power-dsh-usage-page .power-dsh-usage-chart-axis-labels { display:flex; justify-content:space-between; gap:4px; min-width:0; }
.power-dsh-usage-page .power-dsh-usage-chart-axis-label { min-width:0; overflow:hidden; color:var(--dsw-alias-label-tertiary); font-size:10px; line-height:14px; white-space:nowrap; }
.power-dsh-usage-page .power-dsh-usage-models { display:flex; flex-direction:column; gap:2px; margin:0; padding:0; list-style:none; }
.power-dsh-usage-page .power-dsh-usage-model { display:grid; grid-template-columns:8px minmax(0,1fr) minmax(60px,2fr) auto auto; align-items:center; gap:10px; padding:6px 0; }
.power-dsh-usage-page .power-dsh-usage-model + .power-dsh-usage-model { border-top:.5px solid var(--dsw-alias-border-l2); }
.power-dsh-usage-page .power-dsh-usage-model-name { min-width:0; overflow:hidden; color:var(--dsw-alias-label-primary); font-size:12px; line-height:18px; text-overflow:ellipsis; white-space:nowrap; }
.power-dsh-usage-page .power-dsh-usage-model-bar { display:block; height:6px; border-radius:999px; background:var(--dsw-alias-bg-module-platform); overflow:hidden; }
.power-dsh-usage-page .power-dsh-usage-model-bar-fill { display:block; height:100%; border-radius:999px; }
.power-dsh-usage-page .power-dsh-usage-model-value { color:var(--dsw-alias-label-primary); font-family:var(--ds-font-family-code); font-size:12px; line-height:18px; font-variant-numeric:tabular-nums; }
.power-dsh-usage-page .power-dsh-usage-model-requests { color:var(--dsw-alias-label-tertiary); font-size:11px; line-height:16px; white-space:nowrap; }
.power-dsh-usage-page .power-dsh-usage-empty { margin:0; padding:24px 0; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; text-align:center; }
.power-dsh-usage-page .power-dsh-usage-actions { display:flex; justify-content:flex-end; }
@media (max-width:520px) {
  .power-dsh-usage-page .power-dsh-usage-metric { flex:1 1 45%; }
  .power-dsh-usage-page .power-dsh-usage-model { grid-template-columns:8px minmax(0,1fr) auto auto; }
  .power-dsh-usage-page .power-dsh-usage-model-bar { display:none; }
}
@media (prefers-reduced-motion:no-preference) {
  .power-dsh-usage-page .power-dsh-usage-tab { transition:background-color 120ms ease,color 120ms ease; }
}
`;
