export const styles = `
.power-dsh-mcp-page .power-dsh-mcp-runtime { display:inline-flex; flex:none; align-items:center; gap:6px; min-height:18px; white-space:nowrap; color:var(--dsw-alias-label-secondary); font-size:12px; line-height:18px; }
.power-dsh-mcp-page .power-dsh-mcp-runtime[data-state="failed"] { color:var(--dsw-alias-state-error-primary); }
.power-dsh-mcp-page .power-dsh-mcp-card-meta { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:4px; }
.power-dsh-mcp-page .power-dsh-mcp-transport { display:inline-flex; flex:none; align-items:center; justify-content:center; border:.5px solid var(--dsw-alias-border-l4); border-radius:999px; corner-shape:round; padding:1px 8px; background:transparent; color:var(--dsw-alias-label-tertiary); font-size:11px; line-height:17px; font-weight:500; white-space:nowrap; }
.power-dsh-mcp-page .power-dsh-mcp-tool-name { min-width:0; overflow-wrap:anywhere; }
/* Row-level secondary action, matching the native settings-model button geometry.
   Pinned to the card bottom so it lines up across a row of equal-height cards,
   and always flush right: with no count the row holds only the button, and
   space-between would park that single child at the row start. */
.power-dsh-mcp-page .power-dsh-mcp-card-actions { display:flex; align-items:center; justify-content:flex-end; gap:8px; margin-top:auto; padding-top:6px; }
.power-dsh-mcp-page .power-dsh-mcp-tools-summary { min-width:0; margin-right:auto; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.power-dsh-mcp-page .power-dsh-mcp-card-detail, .power-dsh-mcp-page .power-dsh-mcp-card-probe { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; height:28px; padding:0 10px; border:.5px solid var(--dsw-alias-border-l3); border-radius:var(--dsw-radius-sm); background:transparent; color:var(--dsw-alias-label-primary); font:inherit; font-size:12px; line-height:18px; cursor:pointer; }
.power-dsh-mcp-page .power-dsh-mcp-card-detail:active, .power-dsh-mcp-page .power-dsh-mcp-card-probe:active { background:var(--dsw-alias-interactive-bg-hover-solid); }
@media (hover:hover) { .power-dsh-mcp-page .power-dsh-mcp-card-detail:hover, .power-dsh-mcp-page .power-dsh-mcp-card-probe:hover { background:var(--dsw-alias-interactive-bg-hover-solid); } }
.power-dsh-mcp-page .power-dsh-mcp-card-detail:focus-visible, .power-dsh-mcp-page .power-dsh-mcp-card-probe:focus-visible { outline:none; box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); }
/* Read-only detail dialog: native Modal geometry with a wide, scrolling body. */
.power-dsh-mcp-detail { width:min(420px,100%); }
.power-dsh-mcp-detail .power-dsh-mcp-detail-list { display:grid; grid-template-columns:auto minmax(0,1fr); align-items:baseline; gap:6px 16px; margin:0; }
.power-dsh-mcp-detail .power-dsh-mcp-detail-row { display:contents; }
.power-dsh-mcp-detail .power-dsh-mcp-detail-label { color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; white-space:nowrap; }
.power-dsh-mcp-detail .power-dsh-mcp-detail-value { min-width:0; margin:0; color:var(--dsw-alias-label-primary); font-size:12px; line-height:18px; overflow-wrap:anywhere; }
.power-dsh-mcp-detail .power-dsh-mcp-detail-code { font-family:var(--ds-font-family-code); font-size:12px; line-height:18px; white-space:pre-wrap; overflow-wrap:anywhere; }
.power-dsh-mcp-detail .power-dsh-mcp-detail-keys { display:flex; flex-wrap:wrap; gap:4px; }
.power-dsh-mcp-detail .power-dsh-mcp-detail-key { border-radius:var(--dsw-radius-xs); padding:1px 6px; background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-secondary); font-family:var(--ds-font-family-code); font-size:12px; line-height:18px; }
.power-dsh-mcp-detail .power-dsh-mcp-detail-tools { margin-top:16px; padding-top:12px; border-top:.5px solid var(--dsw-alias-border-l2); }
.power-dsh-mcp-detail .power-dsh-mcp-detail-heading { margin:0 0 6px; color:var(--dsw-alias-label-secondary); font-size:12px; line-height:18px; font-weight:500; }
.power-dsh-mcp-detail .power-dsh-mcp-detail-tool-list { display:flex; flex-direction:column; gap:6px; margin:0; padding:0; list-style:none; color:var(--dsw-alias-label-secondary); font-size:12px; line-height:18px; }
.power-dsh-mcp-detail .power-dsh-mcp-detail-empty { margin:0; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
/* The dialog is portaled out of the page, so it carries its own notice spacing. */
.power-dsh-mcp-detail .power-dsh-notice { margin:0; color:var(--dsw-alias-label-tertiary); font-size:13px; line-height:20px; }
.power-dsh-mcp-page .power-dsh-mcp-card-probe[aria-busy="true"] { opacity:.6; cursor:default; }
.power-dsh-mcp-page .power-dsh-mcp-probe-result { display:flex; align-items:center; gap:6px; margin:6px 0 0; min-width:0; color:var(--dsw-alias-label-secondary); font-size:12px; line-height:18px; overflow-wrap:anywhere; }
.power-dsh-mcp-page .power-dsh-mcp-probe-result > span { min-width:0; }
`;
