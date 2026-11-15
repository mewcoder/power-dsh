export const styles = `
.power-dsh-standalone { --power-dsh-content-width:800px; --power-dsh-page-inset:clamp(16px,2.5cqw,32px); --power-dsh-side-inset:max(var(--power-dsh-page-inset),calc((100cqw - var(--power-dsh-content-width) - 152px) / 2)); box-sizing:border-box; container-type:inline-size; display:flex; flex:1 1 auto; flex-direction:column; width:100%; min-width:0; min-height:0; padding-top:var(--dsh-frame-top-clearance,0px); overflow:hidden; background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); font:inherit; line-height:22px; }
.power-dsh-standalone-layout { box-sizing:border-box; display:grid; flex:1 1 auto; grid-template-columns:minmax(0,1fr); grid-template-rows:auto minmax(0,1fr); width:100%; min-height:0; }
.power-dsh-standalone-inner { box-sizing:border-box; width:100%; min-width:0; }
.power-dsh-standalone-topbar { min-width:0; min-height:0; overflow:hidden; scrollbar-gutter:stable both-edges; --dsh-scrollbar-width:5px; --dsh-scrollbar-thumb-border:1px; --dsh-scrollbar-track-margin:12px; }
.power-dsh-standalone-navigation { max-width:calc(var(--power-dsh-content-width) + 2 * var(--power-dsh-page-inset)); margin-inline:auto; padding:12px var(--power-dsh-page-inset) 8px; }
.power-dsh-standalone-tab-strip { width:max-content; max-width:100%; overflow-x:auto; scrollbar-width:none; }
.power-dsh-standalone-tab-strip::-webkit-scrollbar { display:none; }
.power-dsh-standalone[data-navigation="top"] .power-dsh-standalone-tab-strip { border-radius:var(--dsw-radius-lg,12px); }
.power-dsh-standalone-native-tabs { width:max-content; }
.power-dsh-standalone-tab-label { display:inline-flex; align-items:center; gap:8px; min-width:0; max-width:100%; vertical-align:middle; }
.power-dsh-standalone-tab-label > svg { flex:none; }
.power-dsh-standalone-tab-text { min-width:0; }
.power-dsh-standalone-tabs { display:grid; width:max-content; min-width:0; gap:0; padding:4px; border-radius:var(--dsw-radius-lg,12px); background:var(--dsw-alias-bg-module-platform); }
.power-dsh-standalone-tab { height:34px; border:.5px solid transparent; border-radius:var(--dsw-radius-md); padding:0 12px; background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; font-size:14px; line-height:20px; white-space:nowrap; cursor:pointer; }
.power-dsh-standalone-tab[aria-selected="true"] { border-color:var(--dsw-alias-border-l3); background:var(--dsw-alias-bg-layer-3); color:var(--dsw-alias-label-primary); font-weight:600; }
@media (hover:hover) { .power-dsh-standalone-tab:hover { color:var(--dsw-alias-label-primary); } }
.power-dsh-standalone-tab:focus-visible { outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:-2px; }
.power-dsh-standalone-scroll { min-width:0; min-height:0; overflow-y:auto; scrollbar-gutter:stable both-edges; --dsh-scrollbar-width:5px; --dsh-scrollbar-thumb-border:1px; --dsh-scrollbar-track-margin:12px; }
.power-dsh-standalone-panel { max-width:calc(var(--power-dsh-content-width) + 2 * var(--power-dsh-page-inset)); margin-inline:auto; padding:16px var(--power-dsh-page-inset) 40px; }
.power-dsh-standalone-panel > .power-dsh-page { margin-inline:0; }
.power-dsh-standalone[data-navigation="side"] .power-dsh-standalone-layout { grid-template-columns:calc(var(--power-dsh-side-inset) + 152px) minmax(0,1fr); grid-template-rows:minmax(0,1fr); }
.power-dsh-standalone[data-navigation="side"] .power-dsh-standalone-topbar { overflow-y:auto; scrollbar-gutter:auto; }
.power-dsh-standalone[data-navigation="side"] .power-dsh-standalone-navigation { width:128px; max-width:none; margin-left:var(--power-dsh-side-inset); margin-right:0; padding:16px 0; }
.power-dsh-standalone[data-navigation="side"] .power-dsh-standalone-panel { max-width:none; margin:0; padding-inline:0 var(--power-dsh-side-inset); }
.power-dsh-standalone :is(.power-dsh-skills-page,.power-dsh-mcp-page) > header { gap:4px; }
.power-dsh-standalone :is(.power-dsh-skills-page,.power-dsh-mcp-page) .power-dsh-skill-group-header { min-height:28px; }
.power-dsh-standalone[data-navigation="side"] .power-dsh-standalone-tab-strip,
.power-dsh-standalone[data-navigation="side"] .power-dsh-standalone-tabs { width:100%; }
.power-dsh-standalone[data-navigation="side"] .power-dsh-standalone-tabs { gap:4px; padding:0; background:transparent; }
.power-dsh-standalone[data-navigation="side"] .power-dsh-standalone-tab { height:auto; min-height:36px; padding:8px 12px; font-size:13px; text-align:left; white-space:normal; overflow-wrap:anywhere; }
.power-dsh-standalone[data-navigation="side"] .power-dsh-standalone-tab[aria-selected="true"] { border-color:transparent; background:var(--dsw-alias-bg-module-platform); font-weight:500; }
.power-dsh-standalone-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; min-height:240px; padding:32px 16px; color:var(--dsw-alias-label-tertiary); font-size:13px; text-align:center; }
.power-dsh-standalone-empty > p { margin:0; }
@container (max-width:420px) {
  .power-dsh-standalone-panel { padding-block:16px 32px; }
}
`;
