export const styles = `
.power-dsh-page { min-width:0; width:100%; color:var(--dsw-alias-label-primary); font:inherit; line-height:22px; overflow-wrap:anywhere; }
.power-dsh-page > header { display:flex; flex-direction:column; gap:12px; }
.power-dsh-page .power-dsh-title { margin:0; color:var(--dsw-alias-label-primary); font-size:16px; font-weight:500; line-height:24px; }
.power-dsh-page > header .power-dsh-description { margin:0; color:var(--dsw-alias-label-tertiary); font-size:14px; font-weight:400; line-height:22px; }
.power-dsh-page .power-dsh-description { margin:0; color:var(--dsw-alias-label-secondary); font-size:13px; line-height:20px; }
.power-dsh-page .power-dsh-tabs { display:flex; align-items:flex-end; gap:22px; margin-top:14px; border-bottom:.5px solid var(--dsw-alias-border-l2); }
.power-dsh-page .power-dsh-tab { position:relative; border:0; padding:7px 1px 9px; background:transparent; color:var(--dsw-alias-label-tertiary); font:inherit; font-size:13px; line-height:20px; cursor:pointer; }
.power-dsh-page .power-dsh-tab[aria-selected="true"] { color:var(--dsw-alias-label-primary); }
.power-dsh-page .power-dsh-tab[aria-selected="true"]::after { position:absolute; right:0; bottom:-1px; left:0; height:2px; border-radius:2px 2px 0 0; background:var(--dsw-alias-label-primary); content:""; }
.power-dsh-page .power-dsh-tab:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; border-radius:2px; }
.power-dsh-page .power-dsh-fields { display:flex; flex-direction:column; width:100%; margin-top:14px; }
.power-dsh-page .power-dsh-setting-row { display:flex; align-items:center; justify-content:space-between; gap:24px; padding:16px 0; border-bottom:.5px solid var(--dsw-alias-border-l2); }
.power-dsh-page .power-dsh-fields > .power-dsh-setting-row:last-of-type { border-bottom:none; }
.power-dsh-page .power-dsh-setting-copy { min-width:0; }
.power-dsh-page .power-dsh-setting-label { color:var(--dsw-alias-label-primary); font-size:14px; font-weight:400; line-height:20px; }
.power-dsh-page .power-dsh-setting-copy .power-dsh-description { margin-top:4px; color:var(--dsw-alias-label-secondary); font-size:12px; font-weight:400; line-height:18px; }
.power-dsh-page .power-dsh-switch { box-sizing:border-box; position:relative; flex:0 0 auto; width:36px; height:20px; padding:2px; border:0; border-radius:999px; corner-shape:round; background:var(--dsw-alias-border-l3); cursor:pointer; transition:background-color 120ms ease,opacity 120ms ease; }
.power-dsh-page .power-dsh-switch[aria-checked="true"] { background:var(--dsw-alias-brand-primary); }
.power-dsh-page .power-dsh-switch:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-page .power-dsh-switch:disabled { cursor:default; opacity:0.5; }
.power-dsh-page .power-dsh-switch[aria-busy="true"] { opacity:.8; }
.power-dsh-page .power-dsh-switch-thumb { display:block; width:16px; height:16px; border-radius:50%; corner-shape:round; background:var(--dsw-alias-label-primary-foreground); transition:transform 120ms ease; }
.power-dsh-page .power-dsh-switch[aria-checked="false"] .power-dsh-switch-thumb { background:var(--dsw-alias-switch-thumb); }
.power-dsh-page .power-dsh-switch[aria-checked="true"] .power-dsh-switch-thumb { transform:translateX(16px); }
.power-dsh-page .power-dsh-notice { margin:12px 0 0; color:var(--dsw-alias-label-tertiary); font-size:13px; font-weight:400; line-height:20px; }
.power-dsh-loading { box-sizing:border-box; display:flex; align-items:center; justify-content:center; gap:8px; min-width:0; min-height:96px; padding:24px 0; color:var(--dsw-alias-label-tertiary); font:inherit; font-size:13px; line-height:20px; }
.power-dsh-loading > :first-child { flex:none; }
.power-dsh-loading[data-compact] { justify-content:flex-start; min-height:0; padding:8px 0; font-size:12px; line-height:18px; }
@media (prefers-reduced-motion:reduce) { .power-dsh-page .power-dsh-switch, .power-dsh-page .power-dsh-switch-thumb, .power-dsh-page .power-dsh-prompt-input { transition:none; } }
.power-dsh-page .power-dsh-prompt-action:focus-visible { outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-page .power-dsh-prompt-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:8px; }
.power-dsh-page .power-dsh-prompt-action { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; gap:4px; height:36px; border:.5px solid transparent; border-radius:var(--dsw-radius-md); padding:0 14px; background:transparent; color:var(--dsw-alias-label-primary); font:inherit; font-size:14px; line-height:22px; box-shadow:inset 0 0 0 var(--dsh-hairline-width,.5px) var(--dsh-button-outline-color,var(--dsw-alias-border-l3)); cursor:pointer; }
.power-dsh-page .power-dsh-prompt-action[data-primary] { border:none; box-shadow:none; background:var(--dsw-alias-button-primary-fill); color:var(--dsw-alias-label-primary-foreground); }
@media (hover:hover) { .power-dsh-page .power-dsh-prompt-action:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); } .power-dsh-page .power-dsh-prompt-action[data-primary]:hover:not(:disabled) { background:var(--dsw-alias-button-primary-hover); } }
.power-dsh-page .power-dsh-prompt-action:disabled { opacity:.4; cursor:not-allowed; }
`;
