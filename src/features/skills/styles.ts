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
`;
