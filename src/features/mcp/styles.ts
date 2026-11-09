export const styles = `
.power-dsh-mcp-page .power-dsh-skill-cards { align-items:start; }
.power-dsh-mcp-page .power-dsh-skill-card-content[data-expandable="true"] { cursor:pointer; }
.power-dsh-mcp-page .power-dsh-mcp-runtime { display:inline-flex; flex:none; align-items:center; gap:6px; min-height:18px; white-space:nowrap; color:var(--dsw-alias-label-secondary); font-size:12px; line-height:18px; }
.power-dsh-mcp-page .power-dsh-mcp-runtime[data-state="failed"] { color:var(--dsw-alias-state-error-primary); }
.power-dsh-mcp-page .power-dsh-skill-card[data-open="true"] { border-color:var(--dsw-alias-border-l3); }
.power-dsh-mcp-page .power-dsh-skill-card[data-open="true"] > .power-dsh-skill-card-content { background:var(--dsw-alias-interactive-bg-hover); }
.power-dsh-mcp-page .power-dsh-skill-card-content:has(> .power-dsh-mcp-card-toggle:focus-visible) { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:-2px; }
.power-dsh-mcp-page .power-dsh-mcp-card-toggle { display:flex; flex:none; align-items:center; justify-content:space-between; gap:12px; width:100%; min-width:0; min-height:24px; margin-top:4px; border:0; border-radius:var(--dsw-radius-xs); padding:0; background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; font-size:12px; line-height:18px; text-align:left; cursor:pointer; }
.power-dsh-mcp-page .power-dsh-mcp-card-toggle > .power-dsh-skill-chevron { transform:none; }
.power-dsh-mcp-page .power-dsh-mcp-card-toggle[aria-expanded="true"] > .power-dsh-skill-chevron { transform:rotate(180deg); }
.power-dsh-mcp-page .power-dsh-mcp-card-toggle:focus-visible { outline:none; }
.power-dsh-mcp-page .power-dsh-skill-card > .power-dsh-skill-card-content[data-expandable="true"]:active { background:var(--dsw-alias-interactive-bg-active); }
@media (hover:hover) { .power-dsh-mcp-page .power-dsh-skill-card-content[data-expandable="true"]:hover { background:var(--dsw-alias-interactive-bg-hover); } }
.power-dsh-mcp-page .power-dsh-mcp-card-meta { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:4px; }
.power-dsh-mcp-page .power-dsh-mcp-transport { display:inline-flex; flex:none; align-items:center; justify-content:center; border:.5px solid var(--dsw-alias-border-l4); border-radius:999px; corner-shape:round; padding:1px 8px; background:transparent; color:var(--dsw-alias-label-tertiary); font-size:11px; line-height:17px; font-weight:500; white-space:nowrap; }
.power-dsh-mcp-page .power-dsh-mcp-card-placeholder { display:flex; align-items:center; min-height:24px; margin-top:4px; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.power-dsh-mcp-page .power-dsh-mcp-tools-summary { flex:1; min-width:0; }
.power-dsh-mcp-page .power-dsh-mcp-tools { border-top:.5px solid var(--dsw-alias-border-l2); padding:10px 14px 12px; background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-secondary); font-size:12px; line-height:18px; }
.power-dsh-mcp-page .power-dsh-mcp-tools ul { display:flex; flex-direction:column; gap:8px; margin:0; padding:0; list-style:none; }
.power-dsh-mcp-page .power-dsh-mcp-tool-name { min-width:0; overflow-wrap:anywhere; }
.power-dsh-mcp-page .power-dsh-mcp-tools p { margin:0; }
`;
