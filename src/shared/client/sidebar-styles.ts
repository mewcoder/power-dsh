export const styles = `
.power-dsh-header-seat { display:block; width:100%; height:0; }
.power-dsh-header-seat .power-dsh-header-menu { position:fixed; top:12px; z-index:5; width:28px; height:28px; pointer-events:auto; -webkit-app-region:no-drag; }
html[data-platform="darwin"] .power-dsh-header-seat .power-dsh-header-menu { top:11px; }
html[data-windows-titlebar]:has(.power-dsh-header-menu) { --dsh-windows-menu-start:80px; }
html[data-windows-titlebar] .power-dsh-header-seat .power-dsh-header-menu { top:calc((var(--dsh-windows-titlebar-height,32px) - 28px) / 2); z-index:1101; }
.power-dsh-header-seat .power-dsh-header-button { display:flex; align-items:center; justify-content:center; width:28px; height:28px; padding:0; border:0; border-radius:var(--dsw-radius-md); background:transparent; color:var(--dsw-alias-label-secondary); cursor:pointer; -webkit-app-region:no-drag; }
.power-dsh-header-seat .power-dsh-header-button:is(:hover,[aria-expanded="true"]) { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); }
.power-dsh-header-seat .power-dsh-header-button:focus-visible { outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-header-seat .power-dsh-header-error { position:fixed; top:48px; z-index:6; }
html[data-windows-titlebar] .power-dsh-header-seat .power-dsh-header-error { top:calc(var(--dsh-windows-titlebar-height,32px) + 4px); z-index:1101; }
`;
