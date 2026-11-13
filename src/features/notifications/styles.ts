export const styles = `
.power-dsh-page .power-dsh-notification-controls { display:flex; align-items:center; gap:8px; flex:none; }
.power-dsh-notification-test { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; padding:4px; border:0; border-radius:var(--dsw-radius-sm); background:transparent; color:var(--dsw-alias-label-secondary); cursor:pointer; }
.power-dsh-notification-test:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover-solid); color:var(--dsw-alias-label-primary); }
.power-dsh-notification-test:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:2px; }
.power-dsh-notification-test:disabled { opacity:.45; cursor:default; }
.power-dsh-page .power-dsh-sound-controls { display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:8px; flex:none; max-width:50%; }
.power-dsh-page .power-dsh-mode-select, .power-dsh-page .power-dsh-sound-select { box-sizing:border-box; display:inline-flex; align-items:center; gap:12px; height:36px; max-width:100%; padding:0 14px; border:0; border-radius:var(--dsw-radius-md); background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-primary); font:inherit; font-size:14px; line-height:22px; cursor:pointer; }
.power-dsh-page .power-dsh-notification-select-label { min-width:0; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.power-dsh-page .power-dsh-notification-select-icon { flex:none; }
.power-dsh-page .power-dsh-mode-select:disabled, .power-dsh-page .power-dsh-sound-select:disabled { opacity:.5; cursor:default; }
.power-dsh-page .power-dsh-mode-select:focus-visible, .power-dsh-page .power-dsh-sound-select:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-page .power-dsh-mode-select:active:not(:disabled), .power-dsh-page .power-dsh-sound-select:active:not(:disabled) { background:var(--dsw-alias-interactive-bg-active); }
@media (hover:hover) { .power-dsh-page .power-dsh-mode-select:hover:not(:disabled), .power-dsh-page .power-dsh-sound-select:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); } }
.power-dsh-page .power-dsh-sound-preview { display:inline-flex; align-items:center; justify-content:center; flex:none; width:36px; height:36px; padding:0; border:0; border-radius:var(--dsw-radius-md); background:transparent; color:var(--dsw-alias-label-secondary); cursor:pointer; }
.power-dsh-page .power-dsh-sound-preview:disabled { opacity:.5; cursor:default; }
.power-dsh-page .power-dsh-sound-preview:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
@media (hover:hover) { .power-dsh-page .power-dsh-sound-preview:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); } }
`;
