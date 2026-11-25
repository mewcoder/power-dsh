import { styles as shellStyles } from '../../shared/client/shell-styles.ts';
import { standalonePageActive } from '../../shared/client/settings-form.ts';
import type { ClientEnvironment, ClientFeature, ClientRuntime, FeatureState, IconProps, PageSlotProps } from '../../shared/client/types.ts';
import { MEMORY_ERRORS, type MemoryCatalog, type MemoryFileDetail, type MemoryEntry, type MemoryScope,
  type MemorySource, type MemorySourceResult } from './types.ts';
import { styles as featureStyles } from './styles.ts';
import { createCleanupDialog } from './cleanup-client.ts';

const SUB_SWITCHES = ['memoryAutoCapture', 'memoryGlobalEnabled', 'memoryWorkspaceEnabled'] as const;
const DESCRIPTION_KEYS = ['memoryAutoDescription', 'memoryGlobalDescription', 'memoryWorkspaceDescription'];
type Confirmation = { scope: MemoryScope; entry?: MemoryEntry };

function formatMemoryDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, Button, Modal, MarkdownText, NativeIcon, Tooltip, observable, useSnapshot, useMounted, errorFeedback, loadingFeedback } = runtime;
  const { ctx, source, t, savePreference, preferenceSlot, namespace } = env;
  const CleanupDialog = createCleanupDialog(runtime, env);
  let active = true;
  let generation = 0;
  let connectionVersion = 0;
  let consumers = 0;
  let connection: import('../../shared/client/types.ts').Connection | null = null;
  let stopConnection: (() => void) | null = null;
  let state: FeatureState<MemoryCatalog> = { status: 'idle', value: null, error: '' };
  const memorySource = observable(() => state);
  const enabled = () => active && source.getSnapshot().status === 'ready' && source.getSnapshot().value?.memoryEnabled === true;
  const writable = () => enabled() && source.getSnapshot().writable && state.status === 'ready';
  const message = (error: unknown, fallback = 'memoryWriteFailed') => {
    const text = error instanceof Error ? error.message : '';
    return t(MEMORY_ERRORS.find(key => text.includes(key)) ?? fallback);
  };
  const loadEntries = async () => {
    if (!enabled()) return;
    const current = ++generation;
    state = { ...state, status: 'loading', error: '' };
    memorySource.notify();
    try {
      const result = await ctx.remote.powerDsh.listMemoryEntries();
      if (!enabled() || current !== generation) return;
      if (!result.ok) throw new Error(result.error.message);
      if (!result.value.available) throw new Error('memoryUnavailable');
      state = { status: 'ready', value: result.value, error: '' };
    } catch (error) {
      if (!enabled() || current !== generation) return;
      state = { ...state, status: 'error', error: message(error, 'memoryLoadFailed') };
    }
    memorySource.notify();
  };
  const unwatchConnection = () => { stopConnection?.(); stopConnection = null; };
  const watchConnection = () => {
    if (!connection || stopConnection || consumers === 0) return;
    const currentConnection = connection;
    let previous = currentConnection.generation.getSnapshot();
    stopConnection = currentConnection.generation.subscribe(() => {
      const next = currentConnection.generation.getSnapshot();
      if (next === previous) return;
      previous = next;
      connectionVersion++;
      generation++;
      state = { ...state, status: 'idle', error: '' };
      memorySource.notify();
      if (consumers > 0) void loadEntries();
    });
  };
  ctx.inject(['connection'], child => {
    connection = child.connection;
    watchConnection();
    if (consumers > 0) void loadEntries();
    child.effect(() => () => {
      unwatchConnection();
      connection = null;
      connectionVersion++;
      generation++;
      state = { ...state, status: 'idle', error: '' };
      memorySource.notify();
    });
  });
  ctx.effect(() => source.subscribe(() => {
    if (enabled()) return;
    unwatchConnection();
    generation++;
    connectionVersion++;
    state = { status: 'idle', value: null, error: '' };
    memorySource.notify();
  }));
  ctx.effect(() => () => { active = false; unwatchConnection(); generation++; connectionVersion++; });

  function MemoryIcon({ size = 16 }: IconProps) {
    return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      'aria-hidden': true, focusable: false },
    h('path', { d: 'M12 18V5' }),
    h('path', { d: 'M15 13a4.17 4.17 0 01-3-4 4.17 4.17 0 01-3 4' }),
    h('path', { d: 'M17.707 6.294A3 3 0 1012 5a3 3 0 10-5.707 1.294' }),
    h('path', { d: 'M17.996 5.125a4 4 0 012.526 5.77' }),
    h('path', { d: 'M18 18a4 4 0 002-7.465' }),
    h('path', { d: 'M19.967 17.482a4 4 0 11-7.967.517 4 4 0 11-7.967-.517' }),
    h('path', { d: 'M6 18a4 4 0 01-2-7.465' }),
    h('path', { d: 'M6.004 5.125a4 4 0 00-2.526 5.77' }));
  }

  function MemoryPage({ t }: PageSlotProps) {
    const snapshot = useSnapshot(memorySource);
    const settings = useSnapshot(source);
    const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
    const [busy, setBusy] = React.useState<string | null>(null);
    const [error, setError] = React.useState<{ operation: string; message: string } | null>(null);
    const [confirmation, setConfirmation] = React.useState<Confirmation | null>(null);
    const [detail, setDetail] = React.useState<MemoryFileDetail | null>(null);
    const [detailScope, setDetailScope] = React.useState('');
    const [detailOpen, setDetailOpen] = React.useState(false);
    const [cleanupScope, setCleanupScope] = React.useState<string | null>(null);
    const [detailError, setDetailError] = React.useState('');
    const [detailLoading, setDetailLoading] = React.useState(false);
    const [copied, setCopied] = React.useState(false);
    const [sourceView, setSourceView] = React.useState<MemorySourceResult | null>(null);
    const [sourceLoading, setSourceLoading] = React.useState(false);
    const [sourceError, setSourceError] = React.useState('');
    const pending = React.useRef(false);
    const operationSequence = React.useRef(0);
    const detailSequence = React.useRef(0);
    const sourceSequence = React.useRef(0);
    const mounted = useMounted();
    const controlId = React.useId();
    const canWrite = writable() && busy === null;
    const canSaveSettings = enabled() && settings.writable && settings.status === 'ready';
    const catalog = snapshot.value;
    const currentConnection = connectionVersion;
    React.useEffect(() => {
      consumers++;
      watchConnection();
      void loadEntries();
      const refresh = () => { void loadEntries(); };
      window.addEventListener('focus', refresh);
      return () => {
        consumers--;
        if (consumers === 0) unwatchConnection();
        detailSequence.current++;
        sourceSequence.current++;
        window.removeEventListener('focus', refresh);
      };
    }, []);
    React.useEffect(() => {
      operationSequence.current++;
      pending.current = false;
      setBusy(null);
      setError(null);
      detailSequence.current++;
      setConfirmation(null);
      setDetailOpen(false);
      setDetail(null);
      sourceSequence.current++;
      setSourceView(null);
      setSourceLoading(false);
      setSourceError('');
      setCleanupScope(null);
    }, [currentConnection]);

    const live = () => mounted.current && enabled() && currentConnection === connectionVersion;
    async function saveSwitch(field: typeof SUB_SWITCHES[number], value: boolean) {
      if (!canSaveSettings || pending.current) return;
      pending.current = true;
      const sequence = ++operationSequence.current;
      setBusy(field);
      setError(null);
      try { await savePreference(field, value); } catch (failure) {
        if (live()) setError({ operation: field, message: message(failure, 'saveFailed') });
      } finally {
        if (sequence === operationSequence.current) {
          pending.current = false;
          if (live()) setBusy(null);
        }
      }
    }
    async function viewEntry(scope: string, entry: MemoryEntry) {
      if (!enabled()) return;
      const sequence = ++detailSequence.current;
      setDetail(null);
      setDetailScope(scope);
      sourceSequence.current++;
      setSourceView(null);
      setSourceLoading(false);
      setSourceError('');
      setDetailError('');
      setCopied(false);
      setDetailLoading(true);
      setDetailOpen(true);
      try {
        const result = await ctx.remote.powerDsh.readMemoryEntry(scope, entry.id);
        if (!live() || sequence !== detailSequence.current) return;
        if (!result.ok) throw new Error(result.error.message);
        setDetail(result.value);
      } catch (failure) {
        if (live() && sequence === detailSequence.current) setDetailError(message(failure, 'memoryLoadFailed'));
      } finally {
        if (live() && sequence === detailSequence.current) setDetailLoading(false);
      }
    }
    async function action(target: Confirmation) {
      if (!writable() || pending.current) return;
      pending.current = true;
      const sequence = ++operationSequence.current;
      const operation = target.entry ? 'deleteMemoryEntry' : 'clearMemoryScope';
      setBusy(operation);
      setError(null);
      try {
        const result = target.entry
          ? await ctx.remote.powerDsh.deleteMemoryEntry(target.scope.id, target.entry.id, target.entry.revision)
          : await ctx.remote.powerDsh.clearMemoryScope(target.scope.id, target.scope.revision);
        if (!live()) return;
        if (!result.ok) throw new Error(result.error.message);
        setConfirmation(null);
        if (!result.value.indexUpdated) setError({ operation, message: t('memoryIndexStale') });
        await loadEntries();
      } catch (failure) {
        if (live()) {
          setError({ operation, message: message(failure) });
          await loadEntries();
        }
      } finally {
        if (sequence === operationSequence.current) {
          pending.current = false;
          if (live()) setBusy(null);
        }
      }
    }
    async function openFolder(scope: MemoryScope) {
      if (!writable() || pending.current) return;
      pending.current = true;
      const sequence = ++operationSequence.current;
      setBusy('openMemoryFolder');
      setError(null);
      try {
        const result = await ctx.remote.powerDsh.openMemoryFolder(scope.id);
        if (!live()) return;
        if (!result.ok) throw new Error(result.error.message);
        if (!result.value) throw new Error('memoryOpenFolderFailed');
      } catch (failure) {
        if (live()) setError({ operation: 'openMemoryFolder', message: message(failure, 'memoryOpenFolderFailed') });
      } finally {
        if (sequence === operationSequence.current) {
          pending.current = false;
          if (live()) setBusy(null);
        }
      }
    }
    async function viewSource(offset = 0) {
      if (!detail || !live() || sourceLoading) return;
      const currentDetail = detailSequence.current;
      const sequence = ++sourceSequence.current;
      setSourceLoading(true);
      setSourceError('');
      setSourceView(null);
      try {
        const result = await ctx.remote.powerDsh.readMemorySource(detailScope, detail.id, detail.revision, String(offset));
        if (!live() || currentDetail !== detailSequence.current || sequence !== sourceSequence.current) return;
        if (!result.ok) throw new Error(result.error.message);
        setSourceView(result.value);
      } catch (failure) {
        if (live() && currentDetail === detailSequence.current && sequence === sourceSequence.current) {
          setSourceError(message(failure, 'memorySourceUnavailable'));
        }
      } finally {
        if (live() && currentDetail === detailSequence.current && sequence === sourceSequence.current) setSourceLoading(false);
      }
    }
    function closeDetail() {
      detailSequence.current++;
      sourceSequence.current++;
      setDetailOpen(false);
      setDetail(null);
      setDetailError('');
      setSourceView(null);
      setSourceLoading(false);
      setSourceError('');
    }
    function sourceLabel(source: MemorySource) {
      return `${source.sessionId} · ${t('memoryMessage')} ${source.seq} · ${formatMemoryDate(new Date(source.time).toISOString())}`;
    }
    function sourceControl(source: MemorySource | null | undefined, origin: string) {
      return h('div', { className: 'power-dsh-memory-source' },
        h('p', { className: 'power-dsh-memory-meta' }, source
          ? `${t('memorySource')}: ${sourceLabel(source)}`
          : `${origin ? `${t('memorySource')}: ${origin} · ` : ''}${t('memorySourceNotRecorded')}`),
        source && h(Button, { variant: 'ghost', size: 'sm', disabled: sourceLoading,
          'aria-busy': sourceLoading, onClick: () => viewSource() }, t('memoryViewSource')));
    }
    const scopeName = (scope: MemoryScope) => scope.id === 'global' ? t('memoryGlobalEnabled')
      : scope.cwd.split(/[\\/]/).filter(Boolean).at(-1) || scope.cwd;
    const scopes = catalog?.scopes.filter(scope => scope.entries.length > 0 || !scope.complete) ?? [];
    const selectedCleanupScope = catalog?.scopes.find(scope => scope.id === cleanupScope);
    const complete = catalog?.scopes.every(scope => scope.complete) ?? false;
    const empty = snapshot.status === 'ready' && complete && scopes.length === 0;
    const storageSummary = catalog
      ? t('memoryStorageSummary').replace('{path}', () => catalog.path)
      : t('memoryStorageLocal');
    const automatic = settings.value?.memoryAutoCapture !== false;
    const memoryHelp = [t(automatic ? 'memoryMechanism' : 'memoryManualMechanism'), storageSummary].join('\n');
    function folderButton(scope: MemoryScope) {
      const label = t('memoryOpenScopeFolder').replace('{name}', () => scopeName(scope));
      const button = h(Button, { variant: 'ghost', size: 'sm', className: 'power-dsh-memory-folder',
        'aria-label': label, 'aria-busy': busy === 'openMemoryFolder', disabled: !canWrite,
        onClick: () => openFolder(scope) },
      h(NativeIcon, { glyph: 'folder-open-outline', size: 16 }));
      return h(Tooltip, { label, portal: true, side: 'top', delayMs: 0 }, button);
    }
    function scopeAction(scope: MemoryScope, kind: 'cleanup' | 'delete') {
      const label = t(kind === 'cleanup' ? 'memoryCleanupScopeLabel' : 'memoryDeleteScopeLabel').replace('{name}', () => scopeName(scope));
      const available = scope.complete && scope.entries.length > 0 && (kind === 'delete' || scope.entries.every(entry => !entry.invalid));
      const button = h(Button, { variant: 'ghost', size: 'sm',
        className: 'power-dsh-memory-scope-action',
        'aria-label': label, disabled: !canWrite || !available,
        onClick: () => {
          if (!writable() || pending.current || !available) return;
          setError(null);
          if (kind === 'cleanup') setCleanupScope(scope.id);
          else setConfirmation({ scope });
        } }, kind === 'cleanup'
          ? h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
            strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false },
          h('ellipse', { cx: 12, cy: 5, rx: 9, ry: 3 }),
          h('path', { d: 'M3 5V19A9 3 0 0 0 15 21.84' }),
          h('path', { d: 'M21 5V8' }),
          h('path', { d: 'M21 12L18 17H22L19 22' }),
          h('path', { d: 'M3 12A9 3 0 0 0 14.59 14.87' }))
          : h(NativeIcon, { glyph: 'trash-outline', size: 16 }));
      return h(Tooltip, { label, portal: true, side: 'top', delayMs: 0 }, button);
    }
    return h('section', { className: 'power-dsh-page power-dsh-memory', 'aria-label': t('memoryTab') },
      h('style', null, shellStyles + featureStyles),
      h('header', null, h('h2', { className: 'power-dsh-title' }, t('memoryTab')),
        h('p', { className: 'power-dsh-description' }, t('memoryPageDescription'),
          h(Tooltip, { label: memoryHelp, portal: true, side: 'bottom', delayMs: 0, maxWidth: 520 },
            h('span', { className: 'power-dsh-memory-help', tabIndex: 0, 'aria-label': memoryHelp },
              h(NativeIcon, { glyph: 'question-outline', size: 14 }))))),
      snapshot.error && errorFeedback({ t, message: snapshot.error, code: 'PD-MEMORY-LOAD', operation: 'listMemoryEntries', placement: 'page', retry: loadEntries }),
      settings.status === 'ready' && !settings.writable && h('p', { className: 'power-dsh-notice' }, t('readOnly')),
      h('div', { className: 'power-dsh-fields' }, ...SUB_SWITCHES.map((field, index) => {
        const checked = settings.value?.[field] ?? true;
        const rowError = error?.operation === field;
        return h('div', { className: 'power-dsh-setting-row', key: field },
          h('div', { className: 'power-dsh-setting-copy' },
            h('div', { id: `${controlId}-${field}-label`, className: 'power-dsh-setting-label' }, t(field)),
            h('p', { id: `${controlId}-${field}-description`, className: 'power-dsh-description' }, t(DESCRIPTION_KEYS[index]!)),
            rowError && errorFeedback({ t, id: `${controlId}-${field}-error`, message: error.message, code: 'PD-MEMORY-SETTING', operation: field })),
          h('button', { type: 'button', role: 'switch', className: 'power-dsh-switch',
            'aria-checked': checked, 'aria-labelledby': `${controlId}-${field}-label`,
            'aria-describedby': `${controlId}-${field}-description${rowError ? ` ${controlId}-${field}-error` : ''}`,
            'aria-invalid': rowError, 'aria-busy': busy === field, disabled: !canSaveSettings || busy === field,
            onClick: () => saveSwitch(field, !checked) },
          h('span', { className: 'power-dsh-switch-thumb', 'aria-hidden': true })));
      })),
      h('div', { className: 'power-dsh-memory-library' },
      error && !confirmation && !SUB_SWITCHES.includes(error.operation as typeof SUB_SWITCHES[number]) && errorFeedback({
        t, message: error.message, code: 'PD-MEMORY-ACTION', operation: error.operation, placement: 'page',
      }),
      snapshot.status === 'loading' && loadingFeedback({ label: t('loading'), compact: Boolean(catalog) }),
      ...scopes.map(scope => {
        const open = expanded[scope.id] === true;
        const titleId = `${controlId}-scope-${scope.id}`;
        const trigger = h('button', { type: 'button', id: titleId, className: 'power-dsh-memory-scope-open',
          'data-memory-scope': scope.id, 'aria-expanded': open, 'aria-controls': `${titleId}-body`,
          onClick: () => setExpanded(value => ({ ...value, [scope.id]: !value[scope.id] })) },
        h('svg', { className: 'power-dsh-memory-chevron', width: 12, height: 12, 'aria-hidden': true, focusable: false },
          h('use', { href: '#dsw-icon-chevron-down-outline-regular' })),
        h('span', { className: 'power-dsh-memory-scope-name' }, scopeName(scope)),
        h('span', { className: 'power-dsh-memory-count' }, scope.entries.length));
        return h('section', { className: 'power-dsh-memory-scope-item', key: scope.id, 'aria-labelledby': titleId },
          h('div', { className: 'power-dsh-memory-scope-row' },
            scope.id === 'global' ? trigger : h(Tooltip, { label: scope.cwd, portal: true, side: 'top', delayMs: 0, maxWidth: 520 }, trigger),
            h('div', { className: 'power-dsh-memory-actions' }, scopeAction(scope, 'cleanup'), folderButton(scope), scopeAction(scope, 'delete'))),
          !scope.complete && errorFeedback({ t, message: t('memoryIncomplete'), code: 'PD-MEMORY-LIMIT', operation: 'listMemoryEntries' }),
          h('div', { id: `${titleId}-body`, className: 'power-dsh-memory-group', hidden: !open },
          open && scope.entries.map(entry => h('div', { className: 'power-dsh-memory-row', key: entry.id },
            h('button', { type: 'button', className: 'power-dsh-memory-open', onClick: () => viewEntry(scope.id, entry) },
              h('span', { className: 'power-dsh-memory-name' }, entry.description || entry.name),
              h('span', { className: 'power-dsh-memory-meta' }, [
                entry.invalid ? t('memoryInvalidLabel') : '', formatMemoryDate(entry.updated),
              ].filter(Boolean).join(' · '))),
            h('div', { className: 'power-dsh-memory-actions' },
              h(Button, { variant: 'ghost', size: 'sm', className: 'power-dsh-memory-delete', disabled: !canWrite,
                onClick: () => { setError(null); setConfirmation({ scope, entry }); } }, t('memoryDelete')))))));
      }),
      empty && h('div', { className: 'power-dsh-memory-empty', role: 'status' },
        h(MemoryIcon, { size: 32 }),
        h('p', { className: 'power-dsh-memory-empty-title' }, t('memoryEmpty')),
        h('p', { className: 'power-dsh-memory-empty-hint' }, t(automatic ? 'memoryEmptyHint' : 'memoryManualHint')))),
      selectedCleanupScope && h(CleanupDialog, { key: selectedCleanupScope.id, scope: selectedCleanupScope, t, onClose: () => setCleanupScope(null), onApplied: loadEntries }),
      confirmation && h(Modal, { open: true, title: t('memoryDeleteTitle'),
        closeLabel: t('close'), onClose: () => { if (!pending.current) setConfirmation(null); },
        description: t(confirmation.entry ? 'memoryDeleteDescription' : 'memoryDeleteScopeDescription')
          .replace('{name}', () => confirmation.entry ? confirmation.entry.description || confirmation.entry.name : scopeName(confirmation.scope)),
        footer: h(React.Fragment, null,
          h(Button, { variant: 'outline', 'data-modal-autofocus': true, disabled: busy !== null, onClick: () => setConfirmation(null) }, t('cancel')),
          h(Button, { variant: 'outline', className: 'power-dsh-memory-confirm-delete', disabled: !canWrite, onClick: () => action(confirmation) }, t('memoryConfirm'))),
      }, error && errorFeedback({ t, message: error.message, code: 'PD-MEMORY-ACTION',
        operation: error.operation, placement: 'modal' })),
      detailOpen && h(Modal, { open: true, className: 'power-dsh-memory-detail',
        title: detail ? detail.description || detail.name : t('memoryTab'), closeLabel: t('close'), onClose: closeDetail },
        h('div', { className: 'power-dsh-memory-detail-body', tabIndex: 0 },
        detailLoading && loadingFeedback({ label: t('loading') }),
        detailError && errorFeedback({ t, message: detailError, code: 'PD-MEMORY-DETAIL', operation: 'readMemoryEntry', placement: 'modal' }),
        detail && h(React.Fragment, null,
          h('p', { className: 'power-dsh-memory-meta' }, `${t('memoryFile')}: ${detail.name}.md`),
          detail.invalid ? h('p', { className: 'power-dsh-notice' }, t('memoryInvalidLabel')) : h(MarkdownText, {
            text: detail.content, variant: 'body', omitHtml: true,
            labels: { code: { copyLabel: t('memoryCopyCode'), copiedLabel: t('memoryCopied') }, footnotes: t('memoryFootnotes') },
          }),
          sourceControl(detail.source, detail.originSessionId),
          detail.originSessionId && h('div', { className: 'power-dsh-memory-source' },
            h(Button, { variant: 'ghost', size: 'sm', onClick: async () => {
              const sequence = detailSequence.current;
              try {
                await navigator.clipboard.writeText(detail.source?.sessionId ?? detail.originSessionId);
                if (live() && sequence === detailSequence.current) setCopied(true);
              } catch { if (live() && sequence === detailSequence.current) setDetailError(t('memoryCopyFailed')); }
            } }, t(copied ? 'memoryCopied' : 'memoryCopySource'))),
          sourceLoading && loadingFeedback({ label: t('loading') }),
          sourceError && errorFeedback({ t, message: sourceError, code: 'PD-MEMORY-SOURCE',
            operation: 'readMemorySource', placement: 'modal' }),
          sourceView && h('section', { className: 'power-dsh-memory-original', 'aria-label': t('memoryOriginal') },
            h('h3', null, t('memoryOriginal')),
            sourceView.historical && h('p', { className: 'power-dsh-notice' }, t('memorySourceHistorical')),
            !sourceView.available ? h('p', { className: 'power-dsh-notice' }, t({
              'not-recorded': 'memorySourceNotRecorded', unavailable: 'memorySourceUnavailable',
              'not-found': 'memorySourceMissing', changed: 'memorySourceChanged', workspace: 'memorySourceWorkspace', '': 'memorySourceUnavailable',
            }[sourceView.reason])) : h(React.Fragment, null,
              ...sourceView.messages.map(part => h('div', { key: part.seq, className: 'power-dsh-memory-message' },
                h('p', { className: 'power-dsh-memory-meta' }, `${t(part.role === 'user' ? 'memorySourceUser' : 'memorySourceAssistant')} · ${t('memoryMessage')} ${part.seq} · ${formatMemoryDate(new Date(part.time).toISOString())}`),
                h(MarkdownText, { text: part.text, variant: 'body', omitHtml: true,
                  labels: { code: { copyLabel: t('memoryCopyCode'), copiedLabel: t('memoryCopied') }, footnotes: t('memoryFootnotes') } }),
                part.target && part.nextOffset !== null && h(Button, { variant: 'ghost', size: 'sm',
                  disabled: sourceLoading, onClick: () => viewSource(part.nextOffset!) }, t('memoryReadMore'))))))))));
  }

  const renderPage = (props: PageSlotProps) => h(MemoryPage, props);
  preferenceSlot('memoryEnabled', 'settings.section', {
    id: 'power-dsh-memory', order: 51.5, locale: namespace, label: () => t('memoryTab'),
  }, renderPage, () => !standalonePageActive(source));
  preferenceSlot('memoryEnabled', 'settings.section.icon', { id: 'power-dsh-memory' }, MemoryIcon, () => !standalonePageActive(source));
  return {
    settings: [{ field: 'memoryEnabled', description: 'memoryDescription', save: next => savePreference('memoryEnabled', next === true) }],
    pages: [{
      id: 'memory', label: 'memoryTab', icon: MemoryIcon, order: 20,
      available: snapshot => snapshot.status === 'ready' && snapshot.value?.memoryEnabled === true,
      render: renderPage,
    }],
    api: { memorySource, loadEntries },
  } satisfies ClientFeature;
}
