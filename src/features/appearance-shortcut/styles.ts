export const styles = `
.power-dsh-appearance-seat { display:block; width:100%; height:0; }
.power-dsh-appearance-seat .power-dsh-appearance-button { position:fixed; bottom:16px; z-index:5; display:flex; align-items:center; justify-content:center; box-sizing:border-box; width:32px; height:32px; padding:0; border:0; border-radius:var(--dsw-radius-md); background:transparent; color:var(--dsw-alias-label-primary); font:inherit; cursor:pointer; pointer-events:auto; -webkit-app-region:no-drag; }
.power-dsh-appearance-seat .power-dsh-appearance-button:hover { background-color:var(--dsw-alias-interactive-bg-hover); }
.power-dsh-appearance-seat .power-dsh-appearance-button:focus-visible { outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
.power-dsh-appearance-seat .power-dsh-appearance-button:disabled { opacity:.5; cursor:default; }
.power-dsh-appearance-seat .power-dsh-theme-error { position:fixed; bottom:56px; z-index:6; }
`;
