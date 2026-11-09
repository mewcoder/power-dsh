export const styles = `
.power-dsh-page .power-dsh-prompt-editor { display:flex; flex-direction:column; gap:8px; padding:16px 0; }
.power-dsh-page .power-dsh-prompt-input { box-sizing:border-box; display:block; width:100%; max-width:100%; min-height:260px; margin:0; padding:12px 14px; resize:vertical; border:.5px solid var(--dsw-alias-border-l4); border-radius:var(--dsw-radius-lg); background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; font-size:14px; line-height:22px; transition:border-color 120ms ease,box-shadow 120ms ease; }
.power-dsh-page .power-dsh-prompt-input::placeholder { color:var(--dsw-alias-label-caption); }
.power-dsh-page .power-dsh-prompt-input:focus { outline:none; border-color:var(--dsw-alias-border-l3); box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary); }
.power-dsh-page .power-dsh-prompt-input[aria-invalid="true"] { border-color:var(--dsw-alias-state-error-primary); }
.power-dsh-page .power-dsh-prompt-input:disabled { opacity:.5; cursor:default; }
`;
