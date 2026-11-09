import { diagnosticReport, sanitizeDiagnosticText } from '../types/diagnostics.ts';
import type { DiagnosticContext } from '../types/diagnostics.ts';
import type { PublicPrimitives, ReactModule, Translate } from './types.ts';
import type { CSSProperties, ReactElement } from 'react';

export const styles = `
.power-dsh-feedback { min-width:0; color:var(--dsw-alias-state-error-primary); font:inherit; font-size:12px; line-height:18px; overflow-wrap:anywhere; }
.power-dsh-feedback[data-placement="page"] { margin:12px 0 0; padding:12px 14px; border:.5px solid var(--dsw-alias-settings-card-stroke); border-radius:var(--dsw-radius-lg); background:var(--dsw-alias-settings-card-fill); font-size:13px; line-height:20px; }
.power-dsh-feedback[data-placement="inline"] { margin:4px 0 0; }
.power-dsh-feedback[data-placement="compact"] { box-sizing:border-box; max-width:min(280px,calc(100vw - 16px)); max-height:calc(100vh - 72px); overflow:auto; padding:10px 12px; border:.5px solid var(--dsw-alias-border-l2); border-radius:var(--dsw-radius-md); background:var(--dsw-alias-bg-layer-1); pointer-events:auto; -webkit-app-region:no-drag; }
.power-dsh-error-actions { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:start; gap:0 8px; margin-top:8px; color:var(--dsw-alias-label-secondary); }
.power-dsh-error-details { grid-area:1 / 1 / 2 / 3; min-width:0; }
.power-dsh-error-disclosure { max-width:100%; }
.power-dsh-error-actions[data-has-retry="true"] .power-dsh-error-disclosure { max-width:calc(100% - 80px); }
.power-dsh-error-chevron { flex:none; transition:transform 120ms ease; }
.power-dsh-error-disclosure[aria-expanded="true"] .power-dsh-error-chevron { transform:rotate(180deg); }
.power-dsh-error-retry { grid-area:1 / 2; position:relative; }
.power-dsh-error-panel { margin-top:10px; padding:10px 12px; border-radius:var(--dsw-radius-md); background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-secondary); }
.power-dsh-error-report { box-sizing:border-box; max-width:100%; max-height:200px; overflow:auto; margin:0; color:inherit; font-family:var(--ds-font-family-code,monospace); font-size:12px; line-height:18px; white-space:pre-wrap; overflow-wrap:anywhere; user-select:text; }
.power-dsh-error-panel-footer { display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:4px 8px; margin-top:8px; padding-top:8px; border-top:.5px solid var(--dsw-alias-border-l2); }
.power-dsh-error-disclosure:focus-visible,.power-dsh-error-retry:focus-visible,.power-dsh-error-copy:focus-visible,.power-dsh-error-report:focus-visible { outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary)); outline-offset:2px; }
.power-dsh-copy-status { flex:1 1 120px; color:var(--dsw-alias-label-secondary); font-size:12px; line-height:18px; }
@media (prefers-reduced-motion:reduce) { .power-dsh-error-chevron { transition:none; } }
`;

export interface ErrorFeedbackProps {
  t: Translate;
  message: string;
  code: string;
  operation: string;
  context?: DiagnosticContext;
  observedAt?: string;
  id?: string;
  placement?: 'page' | 'inline' | 'compact';
  className?: string;
  style?: CSSProperties;
  retry?: () => void | Promise<void>;
  disabled?: boolean;
}

/** One visual treatment for product errors, with optional recovery and copyable details. */
export function createErrorFeedback(React: ReactModule, Button: PublicPrimitives['Button']) {
  const h = React.createElement;
  function ErrorDetails({ t, message, code, operation, context, observedAt: suppliedObservedAt }: ErrorFeedbackProps) {
    const [expanded, setExpanded] = React.useState(false);
    const panelId = React.useId();
    const [copyState, setCopyState] = React.useState<'idle' | 'pending' | 'copied' | 'failed'>('idle');
    const [mountedAt] = React.useState(() => new Date().toISOString());
    const observedAt = suppliedObservedAt ?? mountedAt;
    const active = React.useRef(true);
    const generation = React.useRef(0);
    const pending = React.useRef(false);
    React.useEffect(() => {
      active.current = true;
      pending.current = false;
      setCopyState('idle');
      return () => {
        active.current = false;
        generation.current++;
        pending.current = false;
      };
    }, []);
    const rawVersion = window.__DSH_BOOT__?.release?.version;
    const marker = typeof document !== 'undefined' ? document.documentElement?.getAttribute('data-platform') : null;
    const platform = marker === 'win32' || marker === 'darwin' || marker === 'linux' ? marker : undefined;
    const report = diagnosticReport({ code, operation, message, observedAt, context, platform,
      version: typeof rawVersion === 'string' ? rawVersion : undefined });
    async function copy() {
      if (pending.current || !active.current) return;
      const startedIn = generation.current;
      pending.current = true;
      setCopyState('pending');
      try {
        if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(report);
        if (active.current && generation.current === startedIn) setCopyState('copied');
      } catch {
        if (active.current && generation.current === startedIn) setCopyState('failed');
      } finally {
        if (generation.current === startedIn) pending.current = false;
      }
    }
    return h('div', { className: 'power-dsh-error-details' },
      h(Button, { variant: 'ghost', size: 'sm', className: 'power-dsh-error-disclosure',
        'aria-expanded': expanded, 'aria-controls': panelId, onClick: () => setExpanded(!expanded) },
        t('errorDetails'), h('svg', { className: 'power-dsh-error-chevron', width: 14, height: 14, viewBox: '0 0 16 16',
          'aria-hidden': true, focusable: false }, h('use', { href: '#dsw-icon-chevron-down-outline-regular' }))),
      h('div', { id: panelId, className: 'power-dsh-error-panel', hidden: !expanded },
        h('pre', { className: 'power-dsh-error-report', tabIndex: 0 }, report),
        h('div', { className: 'power-dsh-error-panel-footer' },
          (copyState === 'copied' || copyState === 'failed') && h('span', {
            className: 'power-dsh-copy-status', role: 'status',
          }, t(copyState === 'copied' ? 'errorInfoCopied' : 'errorInfoCopyFailed')),
          h(Button, { variant: 'outline', size: 'sm', className: 'power-dsh-error-copy', onClick: copy,
            disabled: copyState === 'pending', 'aria-busy': copyState === 'pending' }, t('copyErrorInfo')))));
  }
  // Keep the outer rendering pure, so callers share markup without adding hooks to their view functions.
  return function errorFeedback(props: ErrorFeedbackProps): ReactElement {
    const { t, code, operation, id, placement = 'inline', className = '', style, retry, disabled } = props;
    const message = sanitizeDiagnosticText(props.message);
    const { context, observedAt } = props;
    const diagnosticKey = JSON.stringify([code, operation, message, observedAt,
      context?.stage, context?.check, context?.result, context?.expected, context?.actual, context?.state, context?.recovery]);
    return h('div', { id, role: 'alert', 'data-error-code': code,
      onClick: (event: import('react').MouseEvent<HTMLDivElement>) => event.stopPropagation(),
      className: `power-dsh-error power-dsh-feedback ${className}`.trim(), 'data-placement': placement, 'data-tone': 'error', style },
    message, h('style', null, styles),
    h('div', { className: 'power-dsh-error-actions', 'data-has-retry': Boolean(retry) },
      h(ErrorDetails, { key: diagnosticKey, t, message, code, operation, context, observedAt }),
      retry && h(Button, { variant: 'outline', size: 'sm', className: 'power-dsh-error-retry', disabled,
        onClick: retry }, t('retry'))));
  };
}
