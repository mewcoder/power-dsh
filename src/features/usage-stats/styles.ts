export const styles = `
/* Usage page mirrors the native settings density: quiet cards, no nested chrome. */
.power-dsh-usage-page .power-dsh-usage-body { display:flex; flex-direction:column; gap:24px; margin-top:10px; }
.power-dsh-usage-page .power-dsh-usage-group { display:flex; flex-direction:column; gap:10px; }
.power-dsh-usage-page .power-dsh-usage-summary { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
.power-dsh-usage-page .power-dsh-usage-metric { display:flex; flex-direction:column; min-width:0; gap:6px; padding:12px; border:.5px solid var(--dsw-alias-settings-card-stroke); border-radius:var(--dsw-radius-xl); background:var(--dsw-alias-settings-card-fill); }
.power-dsh-usage-page .power-dsh-usage-metric-label { align-self:flex-start; color:var(--dsw-alias-label-secondary); font-size:11px; line-height:18px; }
.power-dsh-usage-page .power-dsh-usage-metric-label:focus-visible { outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; border-radius:2px; }
.power-dsh-usage-page .power-dsh-usage-metric-value { color:var(--dsw-alias-label-primary); font-size:18px; font-weight:500; line-height:26px; font-variant-numeric:tabular-nums; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.power-dsh-usage-page .power-dsh-usage-metric-detail { display:flex; flex-wrap:wrap; gap:2px 10px; margin-top:auto; color:var(--dsw-alias-label-tertiary); font-size:11px; line-height:18px; font-variant-numeric:tabular-nums; }
.power-dsh-usage-page .power-dsh-usage-metric-detail > span { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.power-dsh-usage-page .power-dsh-usage-card { display:flex; flex-direction:column; gap:14px; padding:14px 16px; border:.5px solid var(--dsw-alias-settings-card-stroke); border-radius:var(--dsw-radius-xl); background:var(--dsw-alias-settings-card-fill); }
.power-dsh-usage-page .power-dsh-usage-card-head { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px; }
.power-dsh-usage-page .power-dsh-usage-trend-head { display:grid; grid-template-columns:minmax(0,1fr) auto; }
.power-dsh-usage-page .power-dsh-usage-trend-head > .power-dsh-usage-tabs { justify-self:end; white-space:nowrap; }
.power-dsh-usage-page .power-dsh-usage-trend-head > .power-dsh-usage-legend { grid-column:1 / -1; }
.power-dsh-usage-page .power-dsh-usage-trend-head > .power-dsh-usage-legend:empty { display:none; }
.power-dsh-usage-page .power-dsh-usage-card-note { color:var(--dsw-alias-label-tertiary); font-size:11px; line-height:18px; }
.power-dsh-usage-page .power-dsh-usage-card-title { margin:0; color:var(--dsw-alias-label-primary); font-size:13px; font-weight:500; line-height:20px; }
.power-dsh-usage-page .power-dsh-usage-section-title { margin:0; color:var(--dsw-alias-label-primary); font-size:13px; font-weight:500; line-height:20px; }
.power-dsh-usage-page .power-dsh-usage-range { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px; }
/* Segmented control: the selected pill is the only raised surface. */
.power-dsh-usage-page .power-dsh-usage-tabs { display:inline-flex; align-items:center; gap:2px; padding:2px; border-radius:999px; background:var(--dsw-alias-bg-module-platform); }
.power-dsh-usage-page .power-dsh-usage-tab { border:0; border-radius:999px; padding:2px 10px; background:transparent; color:var(--dsw-alias-label-tertiary); font:inherit; font-size:12px; line-height:18px; cursor:pointer; }
.power-dsh-usage-page .power-dsh-usage-tab[aria-selected="true"] { background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); box-shadow:0 0 0 .5px var(--dsw-alias-border-l2); }
.power-dsh-usage-page .power-dsh-usage-tab[aria-disabled="true"] { cursor:default; opacity:.6; }
.power-dsh-usage-page .power-dsh-usage-tab:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-usage-page .power-dsh-usage-heatmap { display:grid; gap:2px; min-width:0; }
.power-dsh-usage-page .power-dsh-usage-heatmap-cell { display:block; box-sizing:border-box; width:100%; height:0; padding-bottom:100%; min-width:0; border-radius:2px; background:color-mix(in srgb,var(--dsw-alias-label-tertiary) 16%,transparent); }
.power-dsh-usage-page .power-dsh-usage-heatmap-cell[data-level="1"] { background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 34%,transparent); }
.power-dsh-usage-page .power-dsh-usage-heatmap-cell[data-level="2"] { background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 56%,transparent); }
.power-dsh-usage-page .power-dsh-usage-heatmap-cell[data-level="3"] { background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 80%,transparent); }
.power-dsh-usage-page .power-dsh-usage-heatmap-cell[data-level="4"] { background:var(--dsw-alias-state-business-primary); }
.power-dsh-usage-page .power-dsh-usage-heatmap-cell[data-today] { box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-label-secondary) 42%,transparent); }
.power-dsh-usage-page .power-dsh-usage-heatmap-cell:focus-visible { outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:1px; }
@media (hover:hover) { .power-dsh-usage-page .power-dsh-usage-heatmap-cell[data-has-usage="true"]:hover { box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary) 75%,transparent); } }
.power-dsh-usage-page .power-dsh-usage-heatmap-months { display:grid; gap:2px; min-width:0; margin-top:8px; }
.power-dsh-usage-page .power-dsh-usage-heatmap-month { min-width:0; overflow:hidden; color:var(--dsw-alias-label-tertiary); font-size:10px; line-height:14px; white-space:nowrap; }
.power-dsh-usage-page .power-dsh-usage-legend { display:flex; flex-wrap:wrap; align-items:center; gap:12px; min-width:0; }
.power-dsh-usage-page .power-dsh-usage-legend-item { display:inline-flex; align-items:center; gap:6px; padding:0; border:0; background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; font-size:12px; line-height:18px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; }
.power-dsh-usage-page .power-dsh-usage-legend-item[aria-pressed="false"] { color:var(--dsw-alias-label-tertiary); }
.power-dsh-usage-page .power-dsh-usage-legend-item[aria-pressed="false"] .power-dsh-usage-legend-dot { background:var(--dsw-alias-label-tertiary); }
.power-dsh-usage-page .power-dsh-usage-legend-item:focus-visible { outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:3px; border-radius:2px; }
.power-dsh-usage-page .power-dsh-usage-legend-dot { display:inline-block; flex:none; width:8px; height:8px; border-radius:50%; corner-shape:round; background:var(--dsw-alias-label-tertiary); }
.power-dsh-usage-page .power-dsh-usage-legend-dot[data-model="0"], .power-dsh-usage-page .power-dsh-usage-model-bar-fill[data-model="0"], .power-dsh-usage-page .power-dsh-usage-chart-line[data-model="0"], .power-dsh-usage-page .power-dsh-usage-chart-point[data-model="0"] { --power-dsh-model-color:#3b82f6; }
.power-dsh-usage-page .power-dsh-usage-legend-dot[data-model="1"], .power-dsh-usage-page .power-dsh-usage-model-bar-fill[data-model="1"], .power-dsh-usage-page .power-dsh-usage-chart-line[data-model="1"], .power-dsh-usage-page .power-dsh-usage-chart-point[data-model="1"] { --power-dsh-model-color:#8b5cf6; }
.power-dsh-usage-page .power-dsh-usage-legend-dot[data-model="2"], .power-dsh-usage-page .power-dsh-usage-model-bar-fill[data-model="2"], .power-dsh-usage-page .power-dsh-usage-chart-line[data-model="2"], .power-dsh-usage-page .power-dsh-usage-chart-point[data-model="2"] { --power-dsh-model-color:#14b8a6; }
.power-dsh-usage-page .power-dsh-usage-legend-dot[data-model="3"], .power-dsh-usage-page .power-dsh-usage-model-bar-fill[data-model="3"], .power-dsh-usage-page .power-dsh-usage-chart-line[data-model="3"], .power-dsh-usage-page .power-dsh-usage-chart-point[data-model="3"] { --power-dsh-model-color:#f59e0b; }
.power-dsh-usage-page .power-dsh-usage-legend-dot[data-model="4"], .power-dsh-usage-page .power-dsh-usage-model-bar-fill[data-model="4"], .power-dsh-usage-page .power-dsh-usage-chart-line[data-model="4"], .power-dsh-usage-page .power-dsh-usage-chart-point[data-model="4"] { --power-dsh-model-color:#ec4899; }
.power-dsh-usage-page .power-dsh-usage-legend-dot[data-model="5"], .power-dsh-usage-page .power-dsh-usage-model-bar-fill[data-model="5"], .power-dsh-usage-page .power-dsh-usage-chart-line[data-model="5"], .power-dsh-usage-page .power-dsh-usage-chart-point[data-model="5"] { --power-dsh-model-color:#64748b; }
.power-dsh-usage-page .power-dsh-usage-legend-dot[data-model], .power-dsh-usage-page .power-dsh-usage-model-bar-fill[data-model] { background:var(--power-dsh-model-color); }
.power-dsh-usage-page .power-dsh-usage-chart-line { stroke:var(--power-dsh-model-color); stroke-width:1.5; stroke-linejoin:round; stroke-linecap:round; fill:none; }
.power-dsh-usage-page .power-dsh-usage-chart { display:flex; flex-direction:column; gap:6px; min-width:0; }
.power-dsh-usage-page .power-dsh-usage-chart-svg { display:block; width:100%; height:180px; overflow:hidden; }
.power-dsh-usage-page .power-dsh-usage-chart-plot { position:relative; min-width:0; }
.power-dsh-usage-page .power-dsh-usage-chart-point { position:absolute; display:flex; align-items:center; justify-content:center; width:12px; height:12px; transform:translate(-50%,-50%); border-radius:50%; cursor:default; }
.power-dsh-usage-page .power-dsh-usage-chart-point-dot { width:6px; height:6px; border-radius:50%; background:var(--power-dsh-model-color); opacity:0; pointer-events:none; }
.power-dsh-usage-page .power-dsh-usage-chart-point:hover,
.power-dsh-usage-page .power-dsh-usage-chart-point:focus-visible { z-index:1; }
.power-dsh-usage-page .power-dsh-usage-chart-point:hover .power-dsh-usage-chart-point-dot,
.power-dsh-usage-page .power-dsh-usage-chart-point:focus-visible .power-dsh-usage-chart-point-dot { opacity:1; }
.power-dsh-usage-page .power-dsh-usage-chart-point:focus-visible { outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:1px; }
.power-dsh-usage-page .power-dsh-usage-chart-axis-labels { display:flex; justify-content:space-between; gap:4px; min-width:0; }
.power-dsh-usage-page .power-dsh-usage-chart-axis-label { min-width:0; overflow:hidden; color:var(--dsw-alias-label-tertiary); font-size:10px; line-height:14px; white-space:nowrap; }
.power-dsh-usage-page .power-dsh-usage-models { display:flex; flex-direction:column; margin:0; padding:0; list-style:none; }
.power-dsh-usage-page .power-dsh-usage-model {
  display:grid; align-items:center; gap:4px 10px; padding:8px 0;
  grid-template-columns:8px minmax(0,1fr) minmax(52px,auto) 40px;
  grid-template-areas:"dot name value share" ". bar bar bar";
}
.power-dsh-usage-page .power-dsh-usage-model + .power-dsh-usage-model { border-top:.5px solid var(--dsw-alias-border-l2); }
.power-dsh-usage-page .power-dsh-usage-model > .power-dsh-usage-legend-dot { grid-area:dot; align-self:center; }
.power-dsh-usage-page .power-dsh-usage-model-name { grid-area:name; min-width:0; overflow:hidden; color:var(--dsw-alias-label-primary); font-size:12px; line-height:18px; text-overflow:ellipsis; white-space:nowrap; }
.power-dsh-usage-page .power-dsh-usage-model-value { grid-area:value; justify-self:end; color:var(--dsw-alias-label-secondary); font-size:11px; line-height:18px; font-variant-numeric:tabular-nums; white-space:nowrap; }
.power-dsh-usage-page .power-dsh-usage-model-share { grid-area:share; justify-self:end; min-width:40px; color:var(--dsw-alias-label-tertiary); font-size:11px; line-height:18px; font-variant-numeric:tabular-nums; text-align:right; white-space:nowrap; }
.power-dsh-usage-page .power-dsh-usage-model-bar { grid-area:bar; display:block; height:3px; border-radius:999px; background:color-mix(in srgb,var(--dsw-alias-label-tertiary) 14%,transparent); overflow:hidden; }
.power-dsh-usage-page .power-dsh-usage-model-bar-fill { display:block; height:100%; border-radius:999px; }
.power-dsh-usage-page .power-dsh-usage-empty { margin:0; padding:24px 0; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; text-align:center; }
.power-dsh-usage-page .power-dsh-usage-description-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.power-dsh-usage-page .power-dsh-usage-description-row > .power-dsh-description { min-width:0; }
.power-dsh-usage-page .power-dsh-usage-refresh { flex:none; width:24px; height:24px; padding:0; }
@media (prefers-reduced-motion:no-preference) {
  .power-dsh-usage-page .power-dsh-usage-tab { transition:background-color 120ms ease,color 120ms ease; }
}
/* Custom ranges open in an anchored native popover with the shared menu material. */
.power-dsh-usage-page .power-dsh-usage-period { display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-start; gap:8px; margin-top:12px; }
.power-dsh-usage-page .power-dsh-usage-period-presets { display:inline-flex; flex-wrap:wrap; align-items:center; gap:2px; max-width:100%; box-sizing:border-box; padding:2px; border-radius:var(--dsw-radius-md); background:var(--dsw-alias-bg-module-platform); }
.power-dsh-usage-page .power-dsh-usage-period-option { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; min-height:24px; padding:3px 8px; border:0; border-radius:var(--dsw-radius-sm); background:transparent; color:var(--dsw-alias-label-tertiary); font:inherit; font-size:12px; line-height:18px; white-space:nowrap; cursor:pointer; }
.power-dsh-usage-page .power-dsh-usage-period-option[aria-pressed="true"] { background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); box-shadow:0 0 0 .5px var(--dsw-alias-border-l2); }
.power-dsh-usage-page .power-dsh-usage-period-option { gap:5px; }
.power-dsh-usage-page .power-dsh-usage-period-option > svg { flex:none; }
.power-dsh-usage-page .power-dsh-usage-period-dates-label { min-width:0; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); font-variant-numeric:tabular-nums; }
.power-dsh-usage-page .power-dsh-usage-period button:disabled { opacity:.5; cursor:default; }
@media (hover:hover) {
  .power-dsh-usage-page .power-dsh-usage-period-option:hover:not(:disabled):not([aria-pressed="true"]),
  .power-dsh-usage-custom-shortcut:hover { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); }
}
.power-dsh-usage-page .power-dsh-usage-period button:focus-visible { outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-usage-custom[popover] { box-sizing:border-box; position:fixed; inset:auto; top:anchor(bottom); left:clamp(12px,calc(anchor(right) - min(280px,100vw - 24px)),calc(100vw - min(280px,100vw - 24px) - 12px)); position-try-fallbacks:flip-block; position-visibility:anchors-visible; width:min(280px,calc(100vw - 24px)); max-height:calc(100dvh - 24px); margin:6px 0 0; padding:12px; border:0; background:transparent; outline:none; --dsw-elevation-stroke-color:var(--dsw-alias-border-l1); box-shadow:var(--dsw-elevation-prominent); overflow:auto; color:var(--dsw-alias-label-primary); font:inherit; }
.power-dsh-usage-custom-footer { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; margin-top:8px; padding-top:8px; border-top:.5px solid var(--dsw-alias-border-l2); }
.power-dsh-usage-custom-actions { display:flex; justify-content:flex-end; gap:4px; margin-left:auto; }
.power-dsh-usage-custom-shortcuts { display:flex; align-items:center; flex-wrap:wrap; gap:6px; }
.power-dsh-usage-custom-shortcut { box-sizing:border-box; min-height:28px; border:0; border-radius:var(--dsw-radius-sm); padding:2px; background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; font-size:12px; line-height:20px; white-space:nowrap; cursor:pointer; }
.power-dsh-usage-custom-shortcut:focus-visible { outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-usage-custom-shortcut[aria-pressed="true"] { background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-primary); }
.power-dsh-usage-calendar-selection { display:grid; grid-template-columns:minmax(0,1fr) auto minmax(0,1fr); align-items:center; gap:8px; padding-bottom:8px; border-bottom:.5px solid var(--dsw-alias-border-l2); }
.power-dsh-usage-calendar-selection > div { display:flex; flex-direction:column; min-width:0; gap:4px; font-size:13px; line-height:20px; font-variant-numeric:tabular-nums; }
.power-dsh-usage-calendar-field-label { color:var(--dsw-alias-label-tertiary); font-size:11px; line-height:18px; }
.power-dsh-usage-calendar-selection-arrow { color:var(--dsw-alias-label-tertiary); }
.power-dsh-usage-calendar-header { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 0 6px; color:var(--dsw-alias-label-primary); font-size:13px; font-weight:500; line-height:20px; }
.power-dsh-usage-calendar-nav { display:inline-flex; align-items:center; justify-content:center; flex:none; width:28px; height:28px; padding:0; border:0; border-radius:var(--dsw-radius-sm); color:var(--dsw-alias-label-secondary); background:transparent; cursor:pointer; }
.power-dsh-usage-calendar-week { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); }
.power-dsh-usage-calendar-weekday { padding:3px 0; text-align:center; color:var(--dsw-alias-label-tertiary); font-size:11px; line-height:18px; }
.power-dsh-usage-calendar-cell { min-width:0; margin:1px 0; }
.power-dsh-usage-calendar-cell[data-in-range="true"] { background:var(--dsw-alias-bg-module-platform); }
.power-dsh-usage-calendar-cell[data-edge="start"] { border-radius:var(--dsw-radius-sm) 0 0 var(--dsw-radius-sm); }
.power-dsh-usage-calendar-cell[data-edge="end"] { border-radius:0 var(--dsw-radius-sm) var(--dsw-radius-sm) 0; }
.power-dsh-usage-calendar-cell[data-edge="single"] { border-radius:var(--dsw-radius-sm); }
.power-dsh-usage-calendar-day { position:relative; box-sizing:border-box; width:100%; height:28px; padding:0; border:0; border-radius:var(--dsw-radius-sm); background:transparent; color:var(--dsw-alias-label-primary); font:inherit; font-size:13px; font-variant-numeric:tabular-nums; line-height:20px; cursor:pointer; }
.power-dsh-usage-calendar-day[data-outside="true"] { color:var(--dsw-alias-label-tertiary); }
.power-dsh-usage-calendar-day[data-endpoint="true"] { background:var(--dsw-alias-state-business-primary); color:var(--dsw-alias-label-primary-foreground); }
.power-dsh-usage-calendar-day[aria-current="date"]::after { content:""; position:absolute; bottom:4px; left:calc(50% - 1.5px); width:3px; height:3px; border-radius:50%; background:currentColor; }
.power-dsh-usage-calendar-day:focus-visible, .power-dsh-usage-calendar-nav:focus-visible { z-index:1; outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:1px; }
.power-dsh-usage-calendar-hint { min-height:18px; margin:10px 0 0; color:var(--dsw-alias-label-tertiary); font-size:11px; line-height:18px; }
@media (hover:hover) {
  .power-dsh-usage-calendar-nav:hover, .power-dsh-usage-calendar-day:hover:not([data-endpoint="true"]) { background:var(--dsw-alias-interactive-bg-hover); }
}
`;
