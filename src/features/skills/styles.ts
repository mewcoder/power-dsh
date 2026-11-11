export const styles = `
.power-dsh-page .power-dsh-skill-navigation { display:flex; align-items:flex-end; flex-wrap:wrap; gap:12px; margin-top:14px; border-bottom:.5px solid var(--dsw-alias-border-l2); }
.power-dsh-page .power-dsh-skill-navigation > .power-dsh-tabs { margin-top:0; border-bottom:0; }
.power-dsh-skills-page .power-dsh-tab:focus-visible { color:var(--dsw-alias-label-primary); }
.power-dsh-skills-page .power-dsh-tab:focus-visible::after { position:absolute; right:0; bottom:-1px; left:0; height:2px; border-radius:2px 2px 0 0; background:var(--dsw-alias-label-primary); content:""; }
@media (hover:hover) { .power-dsh-skills-page .power-dsh-tab:hover:not(:disabled) { color:var(--dsw-alias-label-primary); } }
.power-dsh-skills-page .power-dsh-project-trigger { box-sizing:border-box; display:inline-flex; flex:none; align-items:center; gap:12px; width:200px; min-width:0; height:36px; max-width:100%; white-space:nowrap; border:0; border-radius:var(--dsw-radius-md); padding:0 14px; background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-primary); font:inherit; font-size:14px; line-height:22px; cursor:pointer; }
.power-dsh-skills-page .power-dsh-project-search-row { display:flex; align-items:center; flex-wrap:wrap; gap:12px; min-width:0; }
.power-dsh-skills-page .power-dsh-project-search-row > .power-dsh-skill-search-field { flex:1 1 180px; min-width:0; width:auto; }
.power-dsh-skills-page .power-dsh-project-menu { min-width:0; max-width:100%; }
.power-dsh-skills-page .power-dsh-project-trigger-label { flex:1; min-width:0; overflow:hidden; text-align:left; text-overflow:ellipsis; }
.power-dsh-skills-page .power-dsh-project-trigger > svg { flex:none; color:var(--dsw-alias-label-tertiary); }
.power-dsh-skills-page .power-dsh-project-trigger:active:not(:disabled) { background:var(--dsw-alias-interactive-bg-active); }
@media (hover:hover) { .power-dsh-skills-page .power-dsh-project-trigger:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); } }
.power-dsh-skills-page .power-dsh-project-trigger:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-skills-page .power-dsh-project-trigger:disabled { opacity:.5; cursor:default; }
.power-dsh-skills-page .power-dsh-skill-card-meta { justify-content:flex-end; }
.power-dsh-skills-page .power-dsh-skill-card-detail { box-sizing:border-box; display:inline-flex; flex:none; align-items:center; justify-content:center; height:28px; padding:0 10px; border:.5px solid var(--dsw-alias-border-l3); border-radius:var(--dsw-radius-sm); background:transparent; color:var(--dsw-alias-label-primary); font:inherit; font-size:12px; line-height:18px; cursor:pointer; }
.power-dsh-skills-page .power-dsh-skill-card-detail:active { background:var(--dsw-alias-interactive-bg-hover-solid); }
@media (hover:hover) { .power-dsh-skills-page .power-dsh-skill-card-detail:hover { background:var(--dsw-alias-interactive-bg-hover-solid); } }
.power-dsh-skills-page .power-dsh-skill-card-detail:focus-visible { outline:none; box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); }
/* One scrollable reading area keeps the full description and rendered body together. */
.power-dsh-skill-detail { width:min(560px,100%); }
.power-dsh-skill-detail .power-dsh-skill-detail-body { display:flex; flex-direction:column; gap:16px; min-width:0; max-height:min(60vh,560px); overflow:auto; padding-right:4px; }
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
`;
