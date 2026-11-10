export const styles = `
.power-dsh-projects-page .power-dsh-skill-panel { gap:18px; }
.power-dsh-projects-page .power-dsh-projects-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:10px; }
.power-dsh-projects-page .power-dsh-projects-toolbar .power-dsh-skill-search-field { flex:1 1 220px; width:auto; }
.power-dsh-projects-page .power-dsh-projects-select { box-sizing:border-box; display:inline-flex; align-items:center; gap:8px; height:36px; max-width:220px; border:.5px solid var(--dsw-alias-border-l4); border-radius:var(--dsw-radius-md); padding:0 10px 0 12px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; font-size:13px; cursor:pointer; }
.power-dsh-projects-page .power-dsh-projects-select:disabled { opacity:.5; cursor:default; }
.power-dsh-projects-page .power-dsh-projects-select:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-projects-page .power-dsh-projects-select-label { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.power-dsh-projects-page .power-dsh-projects-select > svg { flex:none; color:var(--dsw-alias-label-tertiary); }
.power-dsh-projects-page .power-dsh-projects-menu { min-width:0; max-width:100%; }
.power-dsh-projects-page .power-dsh-projects-table { display:flex; flex-direction:column; overflow:hidden; border:.5px solid var(--dsw-alias-settings-card-stroke); border-radius:var(--dsw-radius-xl); background:var(--dsw-alias-settings-card-fill); }
.power-dsh-projects-page .power-dsh-projects-head { display:grid; grid-template-columns:minmax(0,1fr) 88px 112px 76px; align-items:center; gap:12px; padding:10px 14px; background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.power-dsh-projects-page .power-dsh-projects-rows { margin:0; padding:0; list-style:none; }
.power-dsh-projects-page .power-dsh-projects-row { display:grid; grid-template-columns:minmax(0,1fr) 88px 112px 76px; align-items:center; gap:12px; padding:12px 14px; }
.power-dsh-projects-page .power-dsh-projects-row + .power-dsh-projects-row { border-top:.5px solid var(--dsw-alias-border-l2); }
.power-dsh-projects-page .power-dsh-projects-cell { min-width:0; }
.power-dsh-projects-page .power-dsh-projects-main { display:flex; align-items:center; gap:10px; }
.power-dsh-projects-page .power-dsh-projects-folder { display:inline-flex; flex:none; color:var(--dsw-alias-label-tertiary); }
.power-dsh-projects-page .power-dsh-projects-copy { display:flex; flex-direction:column; gap:2px; min-width:0; }
.power-dsh-projects-page .power-dsh-projects-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-primary); font-size:14px; line-height:20px; }
.power-dsh-projects-page .power-dsh-projects-path { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.power-dsh-projects-page .power-dsh-projects-sessions,.power-dsh-projects-page .power-dsh-projects-activity { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-secondary); font-size:12px; line-height:18px; }
.power-dsh-projects-page .power-dsh-projects-head .power-dsh-projects-main { display:block; }
.power-dsh-projects-page .power-dsh-projects-actions { display:flex; justify-content:flex-end; }
.power-dsh-projects-page .power-dsh-projects-sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
/* Row buttons follow the native Models settings danger button; see docs/third-party-notices.md. */
.power-dsh-projects-page .power-dsh-projects-action { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; height:28px; border:.5px solid transparent; border-radius:var(--dsw-radius-sm); padding:0 10px; background:transparent; color:var(--dsw-alias-state-error-primary); font:inherit; font-size:12px; line-height:18px; cursor:pointer; }
@media (hover:hover) { .power-dsh-projects-page .power-dsh-projects-action:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover-danger); } }
.power-dsh-projects-page .power-dsh-projects-action:disabled { opacity:.4; cursor:default; }
.power-dsh-projects-page .power-dsh-projects-action:focus-visible { outline:none; box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); }
.power-dsh-projects-confirm-remove:not(:disabled) { --dsh-button-outline-color:var(--dsw-alias-state-error-primary); color:var(--dsw-alias-state-error-primary); }
@media (hover:hover) { .power-dsh-projects-confirm-remove:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover-danger); } }
@container power-dsh-skills (max-width:520px) {
  .power-dsh-projects-page .power-dsh-projects-head,
  .power-dsh-projects-page .power-dsh-projects-row { grid-template-columns:minmax(0,1fr) 92px 76px; }
  .power-dsh-projects-page .power-dsh-projects-sessions { display:none; }
}
`;
