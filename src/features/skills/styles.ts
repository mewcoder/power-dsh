export const styles = `
.power-dsh-page .power-dsh-skill-navigation { display:flex; align-items:flex-end; flex-wrap:wrap; gap:12px; margin-top:14px; border-bottom:.5px solid var(--dsw-alias-border-l2); }
.power-dsh-page .power-dsh-skill-navigation > .power-dsh-tabs { margin-top:0; border-bottom:0; }
.power-dsh-skills-page .power-dsh-tab:focus-visible { color:var(--dsw-alias-label-primary); }
.power-dsh-skills-page .power-dsh-tab:focus-visible::after { position:absolute; right:0; bottom:-1px; left:0; height:2px; border-radius:2px 2px 0 0; background:var(--dsw-alias-label-primary); content:""; }
@media (hover:hover) { .power-dsh-skills-page .power-dsh-tab:hover:not(:disabled) { color:var(--dsw-alias-label-primary); } }
.power-dsh-skills-page .power-dsh-skill-card-meta { justify-content:flex-end; }
.power-dsh-skills-page .power-dsh-skill-group-toggle { flex:1; min-width:0; }
.power-dsh-skills-page .power-dsh-skill-group-title { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.power-dsh-skills-page .power-dsh-skill-group-count { flex:none; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; font-variant-numeric:tabular-nums; }
.power-dsh-skills-page .power-dsh-skill-card-origin { flex:1 1 auto; min-width:0; overflow:hidden; color:var(--dsw-alias-label-tertiary); font-family:var(--ds-font-family-code); font-size:11px; line-height:17px; text-overflow:ellipsis; white-space:nowrap; }
.power-dsh-skills-page .power-dsh-skill-card-detail:disabled { opacity:.5; cursor:default; }
.power-dsh-skills-page .power-dsh-skill-card-detail:disabled:hover { background:transparent; }
.power-dsh-skill-existing { flex:none; align-self:center; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.power-dsh-skill-detail .power-dsh-skill-delete { color:var(--dsw-alias-state-error-primary); }
@media (hover:hover) { .power-dsh-skill-delete:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover-danger); } }
.power-dsh-skills-page .power-dsh-skill-path-stack { position:relative; isolation:isolate; display:inline-block; max-width:calc(100% - 8px); padding:8px 8px 0 0; vertical-align:middle; }
.power-dsh-skills-page .power-dsh-skill-path-stack::before,.power-dsh-skills-page .power-dsh-skill-path-stack::after { position:absolute; z-index:-1; border:.5px solid var(--dsw-alias-border-l3); border-radius:var(--dsw-radius-xs); content:""; pointer-events:none; }
.power-dsh-skills-page .power-dsh-skill-path-stack::before { inset:4px; }
.power-dsh-skills-page .power-dsh-skill-path-stack::after { inset:0 0 8px 8px; opacity:.6; }
.power-dsh-skills-page .power-dsh-skill-path-label { display:block; overflow:hidden; border:.5px solid var(--dsw-alias-border-l3); border-radius:var(--dsw-radius-xs); background:var(--dsw-alias-settings-card-fill); padding:0 4px; text-overflow:ellipsis; }
.power-dsh-skills-page .power-dsh-skill-card-detail { box-sizing:border-box; display:inline-flex; flex:none; align-items:center; justify-content:center; height:28px; padding:0 10px; border:.5px solid var(--dsw-alias-border-l3); border-radius:var(--dsw-radius-sm); background:transparent; color:var(--dsw-alias-label-primary); font:inherit; font-size:12px; line-height:18px; cursor:pointer; }
.power-dsh-skills-page .power-dsh-skill-card-detail:active { background:var(--dsw-alias-interactive-bg-hover-solid); }
@media (hover:hover) { .power-dsh-skills-page .power-dsh-skill-card-detail:hover { background:var(--dsw-alias-interactive-bg-hover-solid); } }
.power-dsh-skills-page .power-dsh-skill-card-detail:focus-visible { outline:none; box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); }
/* One scrollable reading area keeps the full description and rendered body together. */
.power-dsh-skill-detail { width:min(560px,100%); }
.power-dsh-skill-detail .power-dsh-skill-detail-body { display:flex; flex-direction:column; gap:16px; min-width:0; max-height:min(60vh,560px); overflow:auto; padding-right:4px; }
.power-dsh-skill-detail .power-dsh-skill-detail-body > * { flex-shrink:0; }
.power-dsh-skill-detail .power-dsh-skill-detail-description { margin:0; font-size:13px; line-height:20px; white-space:pre-wrap; overflow-wrap:anywhere; }
.power-dsh-skill-detail .power-dsh-skill-detail-list { display:grid; grid-template-columns:auto minmax(0,1fr); align-items:baseline; gap:6px 16px; margin:0; }
.power-dsh-skill-detail .power-dsh-skill-detail-row { display:contents; }
.power-dsh-skill-detail .power-dsh-skill-detail-label { color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; white-space:nowrap; }
.power-dsh-skill-detail .power-dsh-skill-detail-value { min-width:0; margin:0; color:var(--dsw-alias-label-secondary); font-size:12px; line-height:18px; overflow-wrap:anywhere; }
.power-dsh-skill-detail .power-dsh-skill-detail-code { color:inherit; font-family:var(--ds-font-family-code); font-size:12px; line-height:18px; white-space:pre-wrap; overflow-wrap:anywhere; }
.power-dsh-skill-detail .power-dsh-skill-detail-markdown { min-width:0; padding-top:16px; border-top:.5px solid var(--dsw-alias-border-l2); user-select:text; }
.power-dsh-skill-detail .power-dsh-skill-detail-body:focus-visible { outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:-2px; }
.power-dsh-skill-detail .power-dsh-skill-detail-empty { margin:0; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.power-dsh-skill-detail .power-dsh-notice { margin:0; color:var(--dsw-alias-label-tertiary); font-size:13px; line-height:20px; }
.power-dsh-skills-page .power-dsh-skill-import-button { flex:none; }
.power-dsh-skill-import-empty-title { margin:0; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.power-dsh-skill-import-notice { display:flex; flex-wrap:wrap; align-items:center; gap:8px; color:var(--dsw-alias-label-secondary); font-size:12px; }
.power-dsh-skill-detail .power-dsh-skill-path-select { display:flex; align-items:baseline; justify-content:space-between; gap:8px; width:100%; min-width:0; border:0; border-radius:var(--dsw-radius-xs); padding:0; background:transparent; color:inherit; font:inherit; text-align:left; cursor:pointer; }
.power-dsh-skill-detail .power-dsh-skill-path-select > code { min-width:0; }
.power-dsh-skill-detail .power-dsh-skill-path-select > svg { flex:none; }
.power-dsh-skill-detail .power-dsh-skill-path-select:focus-visible { outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:3px; }
.power-dsh-skill-detail .power-dsh-skill-path-select:disabled { cursor:default; opacity:.5; }
.power-dsh-skill-import-confirmation { width:min(440px,100%); }
.power-dsh-skill-detail .power-dsh-skill-target-select { display:flex; align-items:center; justify-content:space-between; gap:8px; width:100%; min-width:0; padding:6px 10px; border:.5px solid var(--dsw-alias-border-l3); border-radius:var(--dsw-radius-sm); background:transparent; color:var(--dsw-alias-label-primary); font:inherit; text-align:left; cursor:pointer; }
.power-dsh-skill-detail .power-dsh-skill-target-select:focus-visible { outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); }
.power-dsh-skill-detail .power-dsh-skill-target-select:disabled { opacity:.5; cursor:default; }
`;
