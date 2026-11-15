export const styles = `
.power-dsh-memory-choice { display:flex; align-items:center; justify-content:space-between; gap:16px; font-size:14px; }
.power-dsh-memory-choice > * { min-width:0; overflow-wrap:anywhere; }
.power-dsh-memory-choice button { max-width:80%; height:auto; min-height:32px; white-space:normal; text-align:left; }
.power-dsh-memory-cleanup-change { display:flex; flex-direction:column; gap:12px; }
.power-dsh-memory-cleanup-change + .power-dsh-memory-cleanup-change { border-top:.5px solid var(--dsw-alias-border-l2); padding-top:16px; }
.power-dsh-memory-cleanup-change h3 { font-size:12px; font-weight:500; margin:0 0 6px; color:var(--dsw-alias-label-secondary); }
.power-dsh-memory-cleanup-change .power-dsh-memory-cleanup-remove { color:var(--dsw-alias-state-error-primary); }
.power-dsh-memory-cleanup-text { white-space:pre-wrap; overflow-wrap:anywhere; font:inherit; font-size:13px; line-height:20px; margin:0; padding:12px; border-radius:var(--dsw-radius-sm); background:var(--dsw-alias-bg-layer-1); user-select:text; }
.power-dsh-memory-help { display:inline-flex; align-items:center; height:18px; margin-left:4px; vertical-align:-3px; color:var(--dsw-alias-label-tertiary); }
.power-dsh-memory-help:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color); outline-offset:2px; border-radius:var(--dsw-radius-xs); }
.power-dsh-memory-library { margin-top:20px; }
.power-dsh-memory-count { flex:none; color:var(--dsw-alias-label-tertiary); font-size:12px; font-variant-numeric:tabular-nums; }
.power-dsh-memory-scope-item { display:flex; flex-direction:column; gap:10px; }
.power-dsh-memory-scope-item + .power-dsh-memory-scope-item { margin-top:12px; padding-top:14px; border-top:.5px solid var(--dsw-alias-border-l2); }
.power-dsh-memory-scope-row { display:flex; align-items:center; gap:8px; min-width:0; min-height:36px; }
.power-dsh-memory-scope-open { display:flex; flex:1; align-items:center; gap:8px; min-width:0; padding:0; border:0; background:transparent; color:var(--dsw-alias-label-primary); font:inherit; text-align:left; cursor:pointer; }
.power-dsh-memory-scope-open:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color); outline-offset:2px; border-radius:var(--dsw-radius-xs); }
.power-dsh-memory-scope-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:14px; line-height:22px; font-weight:400; }
.power-dsh-memory-chevron { display:inline-flex; flex:none; color:var(--dsw-alias-label-tertiary); transform:rotate(-90deg); transition:transform 140ms var(--ds-ease-in-out,ease-in-out); }
.power-dsh-memory-scope-open[aria-expanded="true"] .power-dsh-memory-chevron { transform:rotate(0deg); }
.power-dsh-memory .power-dsh-memory-folder, .power-dsh-memory .power-dsh-memory-scope-action { flex:none; width:28px; height:28px; padding:0; color:var(--dsw-alias-label-tertiary); }
.power-dsh-memory-scope-item > .power-dsh-error { margin-bottom:12px; }
.power-dsh-memory-group { padding:0 0 8px; }
.power-dsh-memory-row { display:flex; align-items:center; gap:12px; padding:12px 0; min-width:0; }
.power-dsh-memory-row + .power-dsh-memory-row { border-top:.5px solid var(--dsw-alias-border-l2); }
.power-dsh-memory-open { flex:1; min-width:0; padding:0; border:0; background:transparent; color:var(--dsw-alias-label-primary); text-align:left; font:inherit; cursor:pointer; }
.power-dsh-memory-open:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color); outline-offset:4px; }
.power-dsh-memory-name { display:block; font-size:14px; overflow-wrap:anywhere; }
.power-dsh-memory-meta { display:block; margin-top:4px; font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); overflow-wrap:anywhere; }
.power-dsh-memory-actions { display:flex; gap:4px; flex-shrink:0; }
.power-dsh-memory .power-dsh-memory-delete { color:var(--dsw-alias-state-error-primary); }
@media (hover:hover) { .power-dsh-memory .power-dsh-memory-delete:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover-danger); } }
.power-dsh-memory-confirm-delete:not(:disabled) { --dsh-button-outline-color:var(--dsw-alias-state-error-primary); color:var(--dsw-alias-state-error-primary); }
@media (hover:hover) { .power-dsh-memory-confirm-delete:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover-danger); } }
.power-dsh-memory-source { overflow-wrap:anywhere; white-space:pre-wrap; }
.power-dsh-memory-detail { width:min(640px,100%); max-height:100%; }
.power-dsh-memory-detail-body { display:flex; flex-direction:column; gap:16px; min-width:0; max-height:min(560px,60vh); overflow:auto; overscroll-behavior:contain; scrollbar-gutter:stable; overflow-wrap:anywhere; }
.power-dsh-memory-detail-body > * { flex-shrink:0; }
.power-dsh-memory-detail-body > .power-dsh-memory-meta { margin:0; user-select:text; }
.power-dsh-memory-detail-body:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color); outline-offset:-2px; }
.power-dsh-memory-empty { display:flex; flex-direction:column; align-items:center; gap:8px; padding:32px 16px 40px; text-align:center; color:var(--dsw-alias-label-tertiary); }
.power-dsh-memory-empty > svg { margin-bottom:4px; }
.power-dsh-memory-empty p { margin:0; font-size:13px; line-height:20px; }
.power-dsh-memory-empty .power-dsh-memory-empty-title { color:var(--dsw-alias-label-primary); font-size:14px; }
@media (max-width:520px) { .power-dsh-memory-row { flex-wrap:wrap; } .power-dsh-memory-actions { margin-left:auto; } }
@media (prefers-reduced-motion:reduce) { .power-dsh-memory-chevron { transition:none; } }
`;
