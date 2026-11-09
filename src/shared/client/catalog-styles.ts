export const styles = `
/* Reserve the host scroll gutter only for the options column containing this page. */
[data-shortcut-modal="settings"] > div:has(:is(.power-dsh-skills-page,.power-dsh-mcp-page)) { scrollbar-gutter:stable; }
/* Adapted from DSH PluginInventorySettingsTab (MIT); see docs/third-party-notices.md. */
.power-dsh-page:is(.power-dsh-skills-page,.power-dsh-mcp-page) { container:power-dsh-skills / inline-size; max-width:760px; display:flex; flex-direction:column; gap:12px; }
.power-dsh-page:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-navigation { margin-top:2px; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) > header .power-dsh-title { font-size:18px; font-weight:600; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) > header .power-dsh-description { font-size:13px; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-panel { display:flex; flex-direction:column; gap:12px; padding-top:2px; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-search-field { position:relative; display:flex; align-items:center; width:100%; color:var(--dsw-alias-label-tertiary); }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-search-field > svg { position:absolute; left:12px; pointer-events:none; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-search-field input { box-sizing:border-box; width:100%; height:36px; border:.5px solid var(--dsw-alias-border-l4); border-radius:var(--dsw-radius-md); padding:0 34px 0 36px; outline:none; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; font-size:13px; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-search-field input::placeholder { color:var(--dsw-alias-label-tertiary); }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-search-field input:focus-visible { border-color:var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)) 18%,transparent); }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-cards { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin:0; padding:0; list-style:none; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-card { display:flex; flex-direction:column; min-width:0; overflow:hidden; border:.5px solid var(--dsw-alias-settings-card-stroke); border-radius:var(--dsw-radius-xl); background:var(--dsw-alias-settings-card-fill); }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-card-content { box-sizing:border-box; display:flex; flex:1 1 auto; flex-direction:column; align-items:stretch; gap:2px; width:100%; min-height:52px; padding:12px 14px; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-card-main { display:flex; align-items:center; justify-content:space-between; gap:12px; min-width:0; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-card .power-dsh-switch { width:28px; height:16px; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-card .power-dsh-switch::before { content:""; position:absolute; inset:-4px; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-card .power-dsh-switch-thumb { width:12px; height:12px; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-card .power-dsh-switch[aria-checked="true"] .power-dsh-switch-thumb { transform:translateX(12px); }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-card-title { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:14px; line-height:20px; font-weight:500; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-card-description { display:-webkit-box; overflow:hidden; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; text-wrap:pretty; -webkit-box-orient:vertical; -webkit-line-clamp:2; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-card-meta { display:flex; align-items:center; gap:6px; min-width:0; margin-top:auto; padding-top:6px; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-origin { display:block; box-sizing:border-box; flex:0 1 auto; min-width:0; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; border-radius:var(--dsw-radius-xs); padding:1px 6px; background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-secondary); font-family:var(--ds-font-family-code); font-size:12px; line-height:18px; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-group { display:flex; flex-direction:column; gap:10px; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-group + .power-dsh-skill-group { border-top:.5px solid var(--dsw-alias-border-l2); padding-top:14px; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-group-header { display:flex; align-items:center; gap:8px; min-height:36px; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-group-toggle { display:flex; flex:none; align-items:center; gap:8px; border:0; padding:0; background:transparent; color:inherit; font:inherit; text-align:left; cursor:pointer; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-group-toggle:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-group-title { color:var(--dsw-alias-label-primary); font-size:14px; line-height:22px; font-weight:400; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-group-body { display:flex; flex-direction:column; gap:10px; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-group-description { margin:-6px 0 0 20px; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-chevron { flex:none; color:var(--dsw-alias-label-tertiary); }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-group-toggle > .power-dsh-skill-chevron { transform:rotate(-90deg); }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-group-toggle[aria-expanded="true"] > .power-dsh-skill-chevron { transform:none; }
@container power-dsh-skills (max-width:520px) { :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-cards { grid-template-columns:minmax(0,1fr); } }
@media (pointer:coarse) { :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-search-field input { font-size:16px; } }
@media (prefers-reduced-motion:no-preference) { :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-chevron { transition:transform 140ms var(--ds-ease-in-out); } }
:is(.power-dsh-skills-page,.power-dsh-mcp-page) > header .power-dsh-description { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.power-dsh-page .power-dsh-skill-reason { margin:4px 0 0; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.power-dsh-page .power-dsh-skill-empty { padding:48px 0; text-align:center; color:var(--dsw-alias-label-tertiary); }
.power-dsh-page .power-dsh-skill-notice { margin:12px 0; }
`;
