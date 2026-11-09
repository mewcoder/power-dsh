export const styles = `
.power-dsh-version-seat { display:block; flex:1 1 100%; min-width:0; width:100%; height:0; }
.power-dsh-version-seat .power-dsh-version-badge { position:fixed; left:207px; top:30px; z-index:5; box-sizing:border-box; margin:0; padding:0; border:0; border-radius:2px; background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; font-size:12px; font-weight:400; line-height:16px; letter-spacing:0; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; pointer-events:auto; cursor:pointer; -webkit-app-region:no-drag; }
html[data-platform="darwin"] .power-dsh-version-seat .power-dsh-version-badge { top:64px; }
html[data-windows-titlebar] .power-dsh-version-seat .power-dsh-version-badge { top:calc(var(--dsh-windows-titlebar-height,32px) + 20px); }
.power-dsh-version-seat .power-dsh-version-badge:disabled { cursor:default; }
.power-dsh-version-seat .power-dsh-version-badge:not(:disabled):hover { color:var(--dsw-alias-label-primary); text-decoration:none; }
.power-dsh-version-seat .power-dsh-version-badge:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:2px; }
.power-dsh-version-seat .power-dsh-version-error { position:fixed; left:16px; top:92px; z-index:6; }
`;
