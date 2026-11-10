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
.power-dsh-archive-page .power-dsh-archive-group-header { display:flex; align-items:center; gap:8px; min-height:28px; }
.power-dsh-archive-page .power-dsh-archive-group-folder { display:inline-flex; flex:none; color:var(--dsw-alias-label-tertiary); }
.power-dsh-archive-page .power-dsh-archive-group-title { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-primary); font-size:14px; line-height:22px; font-weight:500; }
.power-dsh-archive-page .power-dsh-archive-count { flex:none; margin-left:auto; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.power-dsh-archive-page .power-dsh-archive-rows { margin:0; padding:0; list-style:none; overflow:hidden; border:.5px solid var(--dsw-alias-settings-card-stroke); border-radius:var(--dsw-radius-xl); background:var(--dsw-alias-settings-card-fill); }
.power-dsh-archive-page .power-dsh-archive-row { display:flex; align-items:center; gap:12px; padding:12px 14px; }
.power-dsh-archive-page .power-dsh-archive-row + .power-dsh-archive-row { border-top:.5px solid var(--dsw-alias-border-l2); }
.power-dsh-archive-page .power-dsh-archive-row-main { display:flex; flex:1 1 auto; flex-direction:column; gap:2px; min-width:0; }
.power-dsh-archive-page .power-dsh-archive-row-title { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-primary); font-size:14px; line-height:20px; }
.power-dsh-archive-page .power-dsh-archive-row-time { color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.power-dsh-archive-page .power-dsh-archive-restore { flex:none; height:28px; padding:0 12px; font-size:12px; line-height:18px; }
.power-dsh-archive-page .power-dsh-archive-row-actions { display:flex; flex:none; align-items:center; gap:8px; }
.power-dsh-archive-page .power-dsh-archive-icon { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border:0; border-radius:var(--dsw-radius-md); padding:0; background:transparent; color:var(--dsw-alias-label-tertiary); cursor:pointer; }
.power-dsh-archive-page .power-dsh-archive-icon:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); }
.power-dsh-archive-page .power-dsh-archive-icon[data-danger="true"]:hover:not(:disabled) { color:var(--dsw-alias-state-error-primary); }
.power-dsh-archive-page .power-dsh-archive-icon:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-archive-page .power-dsh-archive-icon:disabled { opacity:.4; cursor:default; }
`;
