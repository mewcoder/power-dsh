export const styles = `
.power-dsh-archive-page .power-dsh-skill-panel { gap:18px; }
.power-dsh-archive-page .power-dsh-archive-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:10px; }
.power-dsh-archive-page .power-dsh-archive-toolbar .power-dsh-skill-search-field { flex:1 1 220px; width:auto; }
.power-dsh-archive-page .power-dsh-archive-select { box-sizing:border-box; display:inline-flex; align-items:center; gap:8px; height:36px; max-width:220px; border:.5px solid var(--dsw-alias-border-l4); border-radius:var(--dsw-radius-md); padding:0 10px 0 12px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; font-size:13px; cursor:pointer; }
.power-dsh-archive-page .power-dsh-archive-select:disabled { opacity:.5; cursor:default; }
.power-dsh-archive-page .power-dsh-archive-select:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-archive-page .power-dsh-archive-select-label { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.power-dsh-archive-page .power-dsh-archive-select > svg { flex:none; color:var(--dsw-alias-label-tertiary); }
.power-dsh-archive-page .power-dsh-archive-menu { min-width:0; max-width:100%; }
.power-dsh-archive-page .power-dsh-archive-group { display:flex; flex-direction:column; gap:8px; }
.power-dsh-archive-page .power-dsh-archive-group + .power-dsh-archive-group { border-top:.5px solid var(--dsw-alias-border-l2); padding-top:14px; }
.power-dsh-archive-page .power-dsh-archive-group-header { display:flex; align-items:center; gap:8px; min-height:28px; }
.power-dsh-archive-page .power-dsh-archive-group-toggle { display:flex; flex:1 1 auto; align-items:center; gap:8px; min-width:0; border:0; border-radius:var(--dsw-radius-sm); padding:0; background:transparent; color:inherit; font:inherit; text-align:left; cursor:pointer; }
.power-dsh-archive-page .power-dsh-archive-group-toggle:hover { color:var(--dsw-alias-label-primary); }
.power-dsh-archive-page .power-dsh-archive-group-toggle:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-archive-page .power-dsh-archive-group-toggle > .power-dsh-skill-chevron { flex:none; color:var(--dsw-alias-label-tertiary); transform:rotate(-90deg); }
.power-dsh-archive-page .power-dsh-archive-group-toggle[aria-expanded="true"] > .power-dsh-skill-chevron { transform:none; }
.power-dsh-archive-page .power-dsh-archive-group-folder { display:inline-flex; flex:none; color:var(--dsw-alias-label-tertiary); }
.power-dsh-archive-page .power-dsh-archive-group-title { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-primary); font-size:14px; line-height:22px; font-weight:500; }
.power-dsh-archive-page .power-dsh-archive-count { flex:none; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.power-dsh-archive-page .power-dsh-archive-rows { margin:0; padding:0; list-style:none; overflow:hidden; border:.5px solid var(--dsw-alias-settings-card-stroke); border-radius:var(--dsw-radius-xl); background:var(--dsw-alias-settings-card-fill); }
.power-dsh-archive-page .power-dsh-archive-row { display:flex; align-items:center; gap:12px; padding:12px 14px; }
.power-dsh-archive-page .power-dsh-archive-row + .power-dsh-archive-row { border-top:.5px solid var(--dsw-alias-border-l2); }
.power-dsh-archive-page .power-dsh-archive-row-main { display:flex; flex:1 1 auto; flex-direction:column; gap:2px; min-width:0; }
.power-dsh-archive-page .power-dsh-archive-row-title { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-primary); font-size:14px; line-height:20px; }
.power-dsh-archive-page .power-dsh-archive-row-time { color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.power-dsh-archive-page .power-dsh-archive-row-actions { display:flex; flex:none; align-items:center; gap:4px; }
/* Row and dialog buttons follow the native Models settings buttons; see docs/third-party-notices.md. */
.power-dsh-archive-page .power-dsh-archive-action { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; height:28px; border:.5px solid var(--dsw-alias-border-l3); border-radius:var(--dsw-radius-sm); padding:0 10px; background:transparent; color:var(--dsw-alias-label-primary); font:inherit; font-size:12px; line-height:18px; cursor:pointer; }
.power-dsh-archive-page .power-dsh-archive-action-danger { border-color:transparent; color:var(--dsw-alias-state-error-primary); }
@media (hover:hover) {
  .power-dsh-archive-page .power-dsh-archive-action:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover-solid); }
  .power-dsh-archive-page .power-dsh-archive-action-danger:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover-danger); }
}
.power-dsh-archive-page .power-dsh-archive-action:disabled { opacity:.4; cursor:default; }
.power-dsh-archive-page .power-dsh-archive-action:focus-visible { outline:none; box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); }
.power-dsh-archive-confirm-delete:not(:disabled) { --dsh-button-outline-color:var(--dsw-alias-state-error-primary); color:var(--dsw-alias-state-error-primary); }
@media (hover:hover) { .power-dsh-archive-confirm-delete:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover-danger); } }
@media (prefers-reduced-motion:no-preference) { .power-dsh-archive-page .power-dsh-archive-group-toggle > .power-dsh-skill-chevron { transition:transform 140ms var(--ds-ease-in-out); } }
`;
