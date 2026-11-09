export const styles = `
.power-dsh-effort-button { display:inline-flex; align-items:center; justify-content:center; box-sizing:border-box; width:28px; height:28px; min-width:28px; order:1; margin-left:-8px; margin-right:-8px; padding:0; border:none; border-radius:var(--dsw-radius-sm); outline:none; box-shadow:none; background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; cursor:pointer; }
.power-dsh-effort-button:focus-visible { outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-effort-button:disabled { cursor:default; }
.power-dsh-effort-bars { display:block; flex:none; }
.power-dsh-effort-bar-on { fill:var(--dsw-alias-state-business-primary); }
.power-dsh-effort-bar-off { fill:currentColor; }
.power-dsh-effort-arc-track { stroke:currentColor; stroke-width:1.2; opacity:.35; }
.power-dsh-effort-arc-tick { stroke:currentColor; stroke-width:1; opacity:.3; }
.power-dsh-effort-arc-needle, .power-dsh-effort-arc-hub { color:var(--dsw-alias-state-business-primary); }
.power-dsh-effort-arc-needle { stroke:currentColor; stroke-width:1.2; transform-box:view-box; transform-origin:8px 8.5px; transition:transform 180ms cubic-bezier(.2,.7,.3,1); }
.power-dsh-effort-arc-hub { fill:currentColor; stroke:none; }
.power-dsh-effort-arc-auto { color:var(--dsw-alias-label-tertiary); }
@media (prefers-reduced-motion:reduce) { .power-dsh-effort-arc-needle { transition:none; } }
`;

export const settingsStyles = `
.power-dsh-page .power-dsh-effort-style-select { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; gap:12px; min-height:36px; max-width:100%; padding:0 14px; border:0; border-radius:var(--dsw-radius-md); background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-primary); font:inherit; font-size:14px; line-height:22px; cursor:pointer; }
.power-dsh-page .power-dsh-effort-style-select:disabled { opacity:.5; cursor:default; }
.power-dsh-page .power-dsh-effort-style-select:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
@media (hover:hover) { .power-dsh-page .power-dsh-effort-style-select:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); } }
`;
