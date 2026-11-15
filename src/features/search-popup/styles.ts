export const styles = `
/* Full search panel modeled on the official task search: a centered rounded
   surface over a scrim, an input row, a meta head row, a scrolling list and a
   foot bar with the result count. All colors come from the native theme aliases. */
.power-dsh-search-popup-overlay { position:fixed; inset:0; z-index:50; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(0,0,0,.32); -webkit-app-region:no-drag; }
.power-dsh-search-popup-panel { display:flex; flex-direction:column; box-sizing:border-box; width:min(640px,100%); height:min(520px,100%); border-radius:var(--dsw-radius-xl,var(--dsw-radius-lg,16px)); background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); box-shadow:var(--dsw-elevation-prominent,0 24px 64px rgba(0,0,0,.24)); overflow:hidden; }
.power-dsh-search-popup-top { display:flex; flex:none; box-sizing:border-box; align-items:center; height:52px; padding:8px 16px; }
.power-dsh-search-popup-field { display:flex; flex:1; box-sizing:border-box; align-items:center; gap:8px; min-width:0; height:36px; padding:0 10px; border:.5px solid var(--dsw-alias-border-l3); border-radius:12px; color:var(--dsw-alias-label-tertiary); transition:border-color .15s; }
@media (hover:hover) { .power-dsh-search-popup-field:hover { border-color:var(--dsw-alias-border-l2); } }
.power-dsh-search-popup-field:focus-within { border-color:var(--dsw-alias-state-business-primary); }
.power-dsh-search-popup-field > svg { flex:none; color:var(--dsw-alias-label-tertiary); }
.power-dsh-search-popup-input { flex:1 1 auto; min-width:0; border:0; padding:0; background:transparent; outline:none; color:var(--dsw-alias-label-primary); font:inherit; font-size:13px; line-height:20px; }
.power-dsh-search-popup-input::placeholder { color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary)); }
.power-dsh-search-popup-clear { display:flex; flex:none; align-items:center; justify-content:center; width:28px; height:28px; margin-right:-6px; padding:0; border:0; border-radius:var(--dsw-radius-sm); background:transparent; color:var(--dsw-alias-label-tertiary); font:inherit; cursor:pointer; }
.power-dsh-search-popup-clear:hover { color:var(--dsw-alias-label-primary); background:var(--dsw-alias-interactive-bg-hover); }
.power-dsh-search-popup-clear:focus-visible { outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:1px; }
.power-dsh-search-popup-head { display:flex; flex:none; align-items:center; justify-content:space-between; gap:12px; min-height:36px; padding:2px 16px; }
.power-dsh-search-popup-head-label { min-width:0; overflow:hidden; color:var(--dsw-alias-label-secondary); font-size:13px; line-height:20px; font-weight:500; white-space:nowrap; }
.power-dsh-search-popup-head-controls { display:flex; flex:none; align-items:center; gap:10px; }
.power-dsh-search-popup-workspace { display:inline-flex; align-items:center; gap:6px; max-width:220px; height:28px; padding:0 10px; border:0; border-radius:var(--dsw-radius-md); background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-primary); font:inherit; font-size:12px; line-height:18px; cursor:pointer; }
.power-dsh-search-popup-workspace:hover { background:var(--dsw-alias-interactive-bg-hover-solid); }
.power-dsh-search-popup-workspace-label { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.power-dsh-search-popup-workspace > svg { flex:none; color:var(--dsw-alias-label-secondary); }
.power-dsh-search-popup-count { flex:none; margin-left:auto; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; white-space:nowrap; }
.power-dsh-search-popup-limit { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.power-dsh-search-popup-list { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; padding:2px 10px 8px; overflow-y:auto; }
.power-dsh-search-popup-results { display:flex; flex-direction:column; gap:2px; margin:0; padding:0; list-style:none; }
.power-dsh-search-popup-row { display:flex; flex-direction:column; justify-content:center; gap:3px; box-sizing:border-box; width:100%; height:54px; padding:6px 12px; border:0; border-radius:var(--dsw-radius-md); background:transparent; color:var(--dsw-alias-label-primary); font:inherit; text-align:left; cursor:pointer; min-width:0; }
.power-dsh-search-popup-row[data-active="true"], .power-dsh-search-popup-row:active { background:var(--dsw-alias-interactive-bg-hover-solid); }
@media (hover:hover) { .power-dsh-search-popup-row:hover { background:var(--dsw-alias-interactive-bg-hover-solid); } }
.power-dsh-search-popup-row:focus-visible { outline:none; box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); }
.power-dsh-search-popup-row-main { display:flex; align-items:center; gap:10px; min-width:0; }
.power-dsh-search-popup-title { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; line-height:20px; font-weight:500; }
.power-dsh-search-popup-row-workspace { display:inline-flex; flex:none; align-items:center; gap:5px; max-width:30%; overflow:hidden; color:var(--dsw-alias-label-tertiary); font-family:inherit; font-size:12px; line-height:18px; white-space:nowrap; }
.power-dsh-search-popup-row-workspace > svg { flex:none; }
.power-dsh-search-popup-row-workspace > span { min-width:0; overflow:hidden; text-overflow:ellipsis; font-family:inherit; }
.power-dsh-search-popup-date { flex:none; margin-left:auto; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.power-dsh-search-popup-snippet { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-secondary); font-size:12px; line-height:18px; }
.power-dsh-search-popup-row-line { display:flex; align-items:center; gap:12px; min-width:0; }
.power-dsh-search-popup-row-line > .power-dsh-search-popup-snippet { flex:1 1 auto; }
.power-dsh-search-popup-hit { color:var(--dsw-alias-link); background:transparent; }
.power-dsh-search-popup-status { margin:0; padding:3px 6px 0; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
/* Pending content search: skeleton rows on the result-row metrics — a round
   leading glyph beside a title bar and a wider snippet bar — matching the
   native WorkspaceBrowser skeleton (same token, pulse and 2s cadence). */
.power-dsh-search-popup-skeleton { display:flex; flex-direction:column; }
.power-dsh-search-popup-skeleton-row { display:flex; flex:none; align-items:flex-start; gap:10px; box-sizing:border-box; min-height:54px; padding:8px 12px 9px; }
.power-dsh-search-popup-skeleton-dot { flex:none; width:16px; height:16px; border-radius:50%; corner-shape:round; }
.power-dsh-search-popup-skeleton-bars { display:flex; flex:1 1 auto; flex-direction:column; gap:6px; min-width:0; }
.power-dsh-search-popup-skeleton-bar { width:65%; height:16px; border-radius:var(--dsw-radius-xs); }
.power-dsh-search-popup-skeleton-bar-wide { width:90%; height:13px; }
.power-dsh-search-popup-skeleton-dot,
.power-dsh-search-popup-skeleton-bar { background:var(--dsw-alias-bg-skeleton,var(--dsw-alias-bg-module-platform)); animation:power-dsh-search-popup-skeleton 2s cubic-bezier(.36,0,.64,1) infinite; }
@keyframes power-dsh-search-popup-skeleton { 0% { opacity:1; } 40% { opacity:.6; } 80%,100% { opacity:1; } }
@media (prefers-reduced-motion:reduce) { .power-dsh-search-popup-skeleton-dot, .power-dsh-search-popup-skeleton-bar { animation:none; } }
.power-dsh-search-popup-status[data-state="error"] { color:var(--dsw-alias-state-error-primary); }
.power-dsh-search-popup-empty { display:flex; flex:1 1 auto; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:24px; text-align:center; }
.power-dsh-search-popup-empty-title { margin:0; color:var(--dsw-alias-label-primary); font-size:15px; line-height:22px; font-weight:500; }
.power-dsh-search-popup-empty-hint { margin:0; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.power-dsh-search-popup-foot { display:flex; flex:none; align-items:center; gap:8px; padding:8px 18px; border-top:.5px solid var(--dsw-alias-border-l2); }
`;
