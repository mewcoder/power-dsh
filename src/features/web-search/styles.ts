/**
 * Web search settings page, following the shipped Models settings page
 * (`ui-settings-models`): a provider list of compact row cards — dot, name, tag
 * and row actions — where editing opens a gray panel inside the card. The add
 * entry is that page's full-width dashed last slot.
 *
 * Deliberately absent: always-visible key inputs and a small floating add
 * button. Both are shapes the Models page does not use.
 */
export const styles = `
.power-dsh-page.power-dsh-web-page { display:flex; flex-direction:column; gap:12px; max-width:720px; }
.power-dsh-web-chains { display:flex; flex-direction:column; gap:32px; margin-top:12px; }
.power-dsh-web-section { display:flex; flex-direction:column; }
.power-dsh-web-section-title { margin:0; color:var(--dsw-alias-label-primary); font-size:14px; font-weight:500; line-height:20px; }

/* Provider rows: the settings card material, 8px apart. */
.power-dsh-web-rows { display:flex; flex-direction:column; gap:8px; margin:12px 0 0; padding:0; list-style:none; }
.power-dsh-web-row { display:flex; flex-direction:column; gap:12px; padding:12px 14px; border:.5px solid var(--dsw-alias-settings-card-stroke); border-radius:var(--dsw-radius-xl); background:var(--dsw-alias-settings-card-fill); }
.power-dsh-web-row-head { display:flex; align-items:center; gap:10px; min-height:28px; }
.power-dsh-web-row-identity { display:inline-flex; align-items:center; gap:6px; min-width:0; }
.power-dsh-web-dot { box-sizing:border-box; display:inline-block; flex:none; width:8px; height:8px; border-radius:50%; corner-shape:round; background:var(--dsw-alias-border-l3); }
.power-dsh-web-dot[data-state="configured"] { background:var(--dsw-alias-state-success-primary); }
.power-dsh-web-dot[data-state="missing"] { background:var(--dsw-alias-border-l3); }
.power-dsh-web-name { min-width:0; overflow:hidden; color:var(--dsw-alias-label-primary); font-size:14px; font-weight:500; line-height:22px; text-overflow:ellipsis; white-space:nowrap; }
.power-dsh-web-tag { flex:none; padding:1px 6px; border:.5px solid var(--dsw-alias-border-l3); border-radius:var(--dsw-radius-xs); color:var(--dsw-alias-label-secondary); font-size:11px; line-height:16px; }
.power-dsh-web-row-actions { display:inline-flex; flex:none; align-items:center; gap:4px; margin-left:auto; }

/* The Models page's button family: 36px base, 28px inside a row's action group. */
.power-dsh-web-primary,.power-dsh-web-secondary,.power-dsh-web-danger { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; gap:4px; height:36px; padding:0 14px; border:none; border-radius:var(--dsw-radius-md); font:inherit; font-size:14px; line-height:22px; cursor:pointer; }
.power-dsh-web-primary { background:var(--dsw-alias-button-primary-fill); color:var(--dsw-alias-label-primary-foreground); }
@media (hover:hover) { .power-dsh-web-primary:hover:not(:disabled) { background:var(--dsw-alias-button-primary-hover); } }
.power-dsh-web-secondary { border:.5px solid var(--dsw-alias-border-l3); background:transparent; color:var(--dsw-alias-label-primary); }
@media (hover:hover) { .power-dsh-web-secondary:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover-solid); } }
.power-dsh-web-danger { background:transparent; color:var(--dsw-alias-state-error-primary); }
@media (hover:hover) { .power-dsh-web-danger:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover-danger); } }
.power-dsh-web-primary:disabled,.power-dsh-web-secondary:disabled,.power-dsh-web-danger:disabled { opacity:.4; cursor:default; }
.power-dsh-web-primary:focus-visible,.power-dsh-web-secondary:focus-visible,.power-dsh-web-danger:focus-visible { outline:none; box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); }
.power-dsh-web-row-actions .power-dsh-web-secondary,.power-dsh-web-row-actions .power-dsh-web-danger { height:28px; padding:0 10px; border-radius:var(--dsw-radius-sm); font-size:12px; line-height:18px; }

/* The row's editor, matching the Models page's inset gray panel. */
.power-dsh-web-editor { display:flex; flex-direction:column; gap:14px; padding:14px 16px; border-radius:var(--dsw-radius-lg); background:var(--dsw-alias-bg-module-platform); }
.power-dsh-web-field { display:flex; flex-direction:column; gap:6px; min-width:0; }
.power-dsh-web-label { display:inline-flex; align-items:center; gap:10px; color:var(--dsw-alias-label-secondary); font-size:12px; font-weight:500; line-height:18px; }
.power-dsh-web-hint { margin:0; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:1.5; }
.power-dsh-web-hint[data-ok] { color:var(--dsw-alias-state-success-primary); }
.power-dsh-web-input { box-sizing:border-box; width:100%; height:32px; padding:0 10px; border:.5px solid var(--dsw-alias-border-l4); border-radius:var(--dsw-radius-md); background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; font-size:14px; line-height:22px; }
.power-dsh-web-input::placeholder { color:var(--dsw-alias-label-dimmed); }
.power-dsh-web-input:focus { outline:none; border-color:var(--dsw-alias-state-business-primary); }
.power-dsh-web-input:disabled { opacity:.6; cursor:default; }
.power-dsh-web-editor-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; align-items:center; gap:8px; }
.power-dsh-web-probe { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; flex:none; width:28px; height:28px; padding:0; border:none; border-radius:var(--dsw-radius-sm); background:transparent; color:var(--dsw-alias-label-tertiary); cursor:pointer; }
.power-dsh-web-probe:disabled { opacity:.4; cursor:default; }
.power-dsh-web-probe:focus-visible { outline:none; box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); }
@media (hover:hover) { .power-dsh-web-probe:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); } }
.power-dsh-web-commit { display:flex; gap:8px; margin-left:auto; }

/* The "get a key" link, in the shipped settings pages' link treatment. */
.power-dsh-web-field-head { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.power-dsh-web-key-link { color:var(--dsw-alias-label-secondary); font-size:12px; line-height:18px; text-decoration:none; }
.power-dsh-web-key-link:hover { color:var(--dsw-alias-label-primary); text-decoration:underline; }

/* The add entry: the Models page's full-width dashed last slot. */
.power-dsh-web-add { display:flex; margin-top:12px; }
.power-dsh-web-add-menu { display:inline-flex; width:100%; min-width:0; }
.power-dsh-web-add-button { box-sizing:border-box; display:inline-flex; flex:1 1 0; align-items:center; justify-content:center; gap:6px; min-width:0; height:44px; padding:0 14px; border:1px dashed var(--dsw-alias-border-l3); border-radius:var(--dsw-radius-lg); background:transparent; color:var(--dsw-alias-label-primary); font:inherit; font-size:14px; line-height:22px; cursor:pointer; }
.power-dsh-web-add-button > svg { flex:none; }
.power-dsh-web-add-button:disabled { opacity:.4; cursor:default; }
@media (hover:hover) { .power-dsh-web-add-button:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); } }
.power-dsh-web-add-button:focus-visible { outline:none; box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); }

/* Instructions for keyboard reordering, read but not shown. */
.power-dsh-web-sr { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }

/* The dragged row recedes; the row under the pointer shows which side it lands on. */
@media (hover:hover) { .power-dsh-web-row[draggable="true"] { cursor:grab; } .power-dsh-web-row[draggable="true"]:active { cursor:grabbing; } }
.power-dsh-web-row[data-dragging] { opacity:.5; }
.power-dsh-web-row[data-drop="before"] { box-shadow:inset 0 2px 0 0 var(--dsw-alias-state-business-primary); }
.power-dsh-web-row[data-drop="after"] { box-shadow:inset 0 -2px 0 0 var(--dsw-alias-state-business-primary); }
.power-dsh-web-row:focus-visible { outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
@media (max-width:420px) { .power-dsh-web-row-head { flex-wrap:wrap; } .power-dsh-web-row-identity { flex-wrap:wrap; } .power-dsh-web-editor { padding:12px; } }
`;
