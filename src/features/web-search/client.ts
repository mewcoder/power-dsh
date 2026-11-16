/**
 * Client half: the settings row that turns the feature on, and the page that
 * manages backends. The page never reads a stored key — it shows configured or
 * not, and writes a new value blind, which is what lets keys live in the
 * credentials center instead of the settings document.
 *
 * @module power-dsh/web-search/client
 */

import { errorMessage } from '../../shared/client/runtime.ts';
import { styles as shellStyles } from '../../shared/client/shell-styles.ts';
import type { ClientEnvironment, ClientFeature, ClientRuntime, FeatureState, FormSnapshot, IconProps, PageSlotProps, SnapshotSource } from '../../shared/client/types.ts';
import type { WebSearchCatalog, WebSearchProbe } from './rpc.ts';
import { styles as featureStyles } from './styles.ts';
import { probeDiagnostic, probeDiagnosticContext, probeFailureMessage } from './probe-diagnostics.ts';

/** One capability's probe of one backend; `capability` keeps the two buttons apart. */
interface ProbeState {
  capability: 'search' | 'fetch';
  id: string;
  status: 'running' | 'ready';
  value: WebSearchProbe | null;
}

type Capability = 'search' | 'fetch';

interface WebSearchPageProps extends PageSlotProps {
  source: SnapshotSource<FormSnapshot>;
  catalogSource: SnapshotSource<FeatureState<WebSearchCatalog>>;
  loadCatalog(background?: boolean): Promise<void>;
  addSlot(capability: Capability, provider: string): Promise<string | undefined>;
  removeSlot(capability: Capability, id: string): Promise<void>;
  reorderChain(capability: Capability, ids: readonly string[]): Promise<void>;
  saveKey(id: string, value: string): Promise<void>;
  probeBackend(capability: Capability, id: string): Promise<void>;
}

/** Vendor display names; a vendor the build no longer ships renders its id. */
const NAMES: Record<string, string> = {
  tavily: 'Tavily',
  firecrawl: 'Firecrawl',
  tinyfish: 'TinyFish',
};

/** Vendors the add menu offers, in display order. */
const VENDORS = Object.keys(NAMES);

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, Menu, Tooltip, NativeIcon, StateDot, observable, useSnapshot, useMounted, errorFeedback, loadingFeedback } = runtime;
  const { ctx, source, t, savePreference, preferenceSlot, namespace } = env;
  const styles = shellStyles + featureStyles;

  // Lucide Globe, ISC licensed; see docs/third-party-notices.md.
  function WebSearchIcon({ size = 16 }: IconProps) {
    return h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      'aria-hidden': true, focusable: false,
    }, h('circle', { cx: 12, cy: 12, r: 10 }),
    h('path', { d: 'M2 12h20' }),
    h('path', { d: 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' }));
  }

  let active = true;
  let catalog: FeatureState<WebSearchCatalog> = { status: 'idle', value: null, error: '' };
  let pending = false;
  let generation = 0;
  let probe: ProbeState | null = null;
  const catalogSource = observable(() => catalog);
  const probeSource = observable(() => probe);
  ctx.effect(() => () => { active = false; generation++; });

  /**
   * Map a Host failure onto page copy. A key this page knows becomes its
   * localized sentence; anything else keeps the Host's own message so a real
   * failure (an unloaded plugin, a rejected RPC) stays diagnosable instead of
   * collapsing into one generic sentence.
   */
  const messageOf = (message: string | undefined, fallback: string) => {
    if (message?.includes('webSearchUnavailable')) return t('webSearchUnavailable');
    if (message?.includes('webSearchCredentialsUnavailable')) return t('webSearchCredentialsUnavailable');
    if (message?.includes('webSearchUnknownBackend')) return t('webSearchUnknownBackend');
    return message?.trim() ? message : t(fallback);
  };

  const loadCatalog = async (background?: boolean) => {
    if (!active || pending) return;
    const current = ++generation;
    if (!background) { catalog = { ...catalog, status: catalog.value ? 'ready' : 'loading', error: '' }; catalogSource.notify(); }
    try {
      const result = await ctx.remote.powerDsh.readWebSearch();
      if (!active || current !== generation) return;
      if (!result.ok) throw new Error(result.error.message);
      catalog = { status: 'ready', value: result.value, error: '' };
    } catch (failure) {
      if (!active || current !== generation) return;
      catalog = { ...catalog, status: 'error', error: messageOf(errorMessage(failure), 'webSearchLoadFailed') };
    }
    catalogSource.notify();
  };

  /** One write against the Host, then mirror the catalog it returns. */
  const write = async (operation: () => Promise<{ ok: true; value: WebSearchCatalog } | { ok: false; error: { message: string } }>, fallback: string) => {
    if (!active || pending) return;
    pending = true;
    const current = ++generation;
    try {
      const result = await operation();
      if (!result.ok) throw new Error(result.error.message);
      if (!active || current !== generation) return;
      catalog = { status: 'ready', value: result.value, error: '' };
      catalogSource.notify();
    } catch (failure) {
      if (active && current === generation) throw new Error(messageOf(errorMessage(failure), fallback));
    } finally {
      pending = false;
    }
  };

  const addSlot = async (capability: Capability, provider: string) => {
    const known = new Set(catalog.value?.slots.map(slot => slot.id));
    await write(() => ctx.remote.powerDsh.addWebSearchSlot(capability, provider), 'webSearchSaveFailed');
    return active ? catalog.value?.slots.find(slot => !known.has(slot.id))?.id : undefined;
  };
  const removeSlot = (capability: Capability, id: string) =>
    write(() => ctx.remote.powerDsh.removeWebSearchSlot(capability, id), 'webSearchSaveFailed');
  const reorderChain = (capability: Capability, ids: readonly string[]) =>
    write(() => ctx.remote.powerDsh.reorderWebSearchChain(capability, ids), 'webSearchSaveFailed');
  const saveKey = (id: string, value: string) =>
    write(() => ctx.remote.powerDsh.saveWebSearchKey(id, value), 'webSearchKeyFailed');

  const probeBackend = async (capability: Capability, id: string) => {
    if (!active || probe?.status === 'running') return;
    probe = { capability, id, status: 'running', value: null };
    probeSource.notify();
    const startedAt = Date.now();
    const failedRpc = (failure: unknown): WebSearchProbe => ({ ok: false, resultCount: 0, durationMs: Date.now() - startedAt,
      message: 'webSearchProbeReason_rpc', diagnostic: probeDiagnostic(failure,
        catalog.value?.slots.find(slot => slot.id === id)?.provider ?? 'unknown', 'unknown', 'rpc') });
    try {
      const call = capability === 'search'
        ? ctx.remote.powerDsh.probeWebSearchSearch(id)
        : ctx.remote.powerDsh.probeWebSearchFetch(id);
      const result = await call;
      if (!active) return;
      probe = { capability, id, status: 'ready', value: result.ok ? result.value : failedRpc(result.error) };
    } catch (failure) {
      if (!active) return;
      probe = { capability, id, status: 'ready', value: failedRpc(failure) };
    }
    probeSource.notify();
  };

  function WebSearchPage({ t, source, catalogSource: catalogView, loadCatalog, addSlot, removeSlot, reorderChain, saveKey, probeBackend }: WebSearchPageProps) {
    const config = useSnapshot(source);
    const snapshot = useSnapshot(catalogView);
    const probeState = useSnapshot(probeSource);
    const [drafts, setDrafts] = React.useState<Record<string, string>>({});
    const [savingKey, setSavingKey] = React.useState<string | null>(null);
    /** The row whose key editor is open; one at a time, as on the Models page. */
    const [editing, setEditing] = React.useState<string | null>(null);
    const [rowError, setRowError] = React.useState<{ id: string; message: string } | null>(null);
    const [busy, setBusy] = React.useState(false);
    // The row being dragged, and the row whose edge it is currently over. Only
    // one chain drags at a time, so one pair of fields covers both sections.
    const [dragging, setDragging] = React.useState<{ capability: Capability; id: string } | null>(null);
    const [over, setOver] = React.useState<{ id: string; half: 'before' | 'after' } | null>(null);
    const mounted = useMounted();
    const id = React.useId();
    const value = snapshot.value;
    const enabled = config.status === 'ready' && config.value?.webSearchEnabled === true;
    const writable = config.status === 'ready' && config.writable && enabled;
    const loading = snapshot.status === 'loading' || snapshot.status === 'idle';

    React.useEffect(() => {
      void loadCatalog();
      const refresh = () => { void loadCatalog(true); };
      window.addEventListener('focus', refresh);
      return () => window.removeEventListener('focus', refresh);
    }, []);

    const run = async (operation: () => Promise<void>, rowId?: string) => {
      if (busy) return;
      setBusy(true);
      setRowError(null);
      try { await operation(); }
      catch (failure) { if (mounted.current && rowId) setRowError({ id: rowId, message: errorMessage(failure) ?? t('webSearchSaveFailed') }); }
      finally { if (mounted.current) setBusy(false); }
    };

    /** Every configured instance, keyed by its id. */
    const byId = new Map((value?.slots ?? []).map(row => [row.id, row]));

    /**
     * Move `source` to the hovered edge of `target`. Dropping on a row's top
     * half inserts before it, on the bottom half after it — the same rule the
     * sidebar uses, so reordering never depends on which side of a gap the
     * pointer happens to sit on.
     */
    const droppedIds = (chain: readonly string[], source: string, target: string, half: 'before' | 'after'): string[] => {
      const without = chain.filter(id => id !== source);
      const index = without.indexOf(target);
      if (index < 0) return [...chain];
      const next = [...without];
      next.splice(half === 'before' ? index : index + 1, 0, source);
      return next;
    };

    /** The single "add" control: one button, then a menu of vendors. */
    const [addOpen, setAddOpen] = React.useState<Capability | null>(null);

    /**
     * One chain as a list of provider instances, following the Models settings
     * page: each row is a card whose head carries the instance's vendor name and
     * its own actions, with the key field underneath. Two rows may name the same
     * vendor — they are separate instances with separate keys.
     */
    const chainSection = (capability: Capability, headingId: string) => {
      const chain = capability === 'search' ? value?.search.ids ?? [] : value?.fetch.ids ?? [];
      const disabled = !writable || !value?.available || snapshot.status === 'error' || busy;
      const members = chain.filter(slotId => byId.has(slotId));
      const search = capability === 'search';

      const rowOf = (slotId: string, index: number) => {
        const row = byId.get(slotId);
        if (!row) return null;
        const control = `${id}-${capability}-${slotId}`;
        const position = search ? index + 1 : index + 2;
        const draft = drafts[slotId] ?? '';
        const currentProbe = probeState?.capability === capability && probeState.id === slotId ? probeState : null;
        const running = currentProbe?.status === 'running';
        const result = currentProbe?.status === 'ready' ? currentProbe.value : null;
        const name = NAMES[row.provider] ?? row.provider;
        const probeLabel = `${t(search ? 'webSearchProbeSearch' : 'webSearchProbeFetch')}: ${name} #${String(position)}`;
        // The dot states the one fact a glance needs: can this instance run now?
        const dot = row.hasKey ? 'configured' : 'missing';
        const open = editing === slotId;
        const isDragging = dragging !== null && dragging.capability === capability && dragging.id === slotId;
        const dropHalf = over !== null && dragging !== null && dragging.capability === capability
          && over.id === slotId && dragging.id !== slotId ? over.half : null;
        return h('li', {
          key: slotId, className: 'power-dsh-web-row', 'data-slot': slotId, 'data-provider': row.provider,
          'data-capability': capability,
          'data-dragging': isDragging || undefined,
          'data-drop': dropHalf ?? undefined,
          'aria-describedby': `${id}-${capability}-reorder-hint`,
          // Drag is the reorder gesture. A drag is pointer-only, so the row is
          // also focusable and Alt+Arrow reorders it — no visible buttons.
          draggable: !disabled && !open,
          tabIndex: disabled ? undefined : 0,
          onKeyDown: event => {
            if (disabled || open || !event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
            const delta = event.key === 'ArrowUp' ? -1 : 1;
            const target = index + delta;
            if (target < 0 || target >= members.length) return;
            event.preventDefault();
            const next = [...chain];
            [next[index], next[target]] = [next[target]!, next[index]!];
            void run(() => reorderChain(capability, next), slotId);
          },
          onDragStart: event => {
            if (disabled || open) { event.preventDefault(); return; }
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', slotId);
            setDragging({ capability, id: slotId });
            setOver(null);
          },
          onDragOver: event => {
            if (!dragging || dragging.capability !== capability || dragging.id === slotId) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            const rect = event.currentTarget.getBoundingClientRect();
            setOver({ id: slotId, half: event.clientY < rect.top + rect.height / 2 ? 'before' : 'after' });
          },
          onDragLeave: event => {
            // Ignore the leave events fired while moving across a row's own
            // children; only a leave to outside this row clears its marker.
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setOver(current => current?.id === slotId ? null : current);
          },
          onDrop: event => {
            if (!dragging || dragging.capability !== capability || dragging.id === slotId) return;
            event.preventDefault();
            const half = dropHalf ?? 'after';
            const source = dragging.id;
            setDragging(null);
            setOver(null);
            if (!mounted.current) return;
            const next = droppedIds(chain, source, slotId, half);
            if (next.every((candidate, position) => candidate === chain[position])) return;
            void run(() => reorderChain(capability, next), slotId);
          },
          onDragEnd: () => { setDragging(null); setOver(null); },
        },
          h('div', { className: 'power-dsh-web-row-head' },
            h('div', { className: 'power-dsh-web-row-identity' },
              h('span', { id: `${control}-name`, className: 'power-dsh-web-name' }, name),
              h('span', { className: 'power-dsh-web-tag' }, `#${String(position)}`),
              h('span', { className: 'power-dsh-web-dot', 'data-state': dot, role: 'img',
                'aria-label': t(row.hasKey ? 'webSearchKeyConfigured' : 'webSearchKeyMissing'),
                title: t(row.hasKey ? 'webSearchKeyConfigured' : 'webSearchKeyMissing') })),
            h('div', { className: 'power-dsh-web-row-actions' },
              h(Tooltip, { label: probeLabel, portal: true, side: 'top', delayMs: 0 }, h('button', {
                type: 'button', className: 'power-dsh-web-probe',
                'aria-label': probeLabel, 'aria-busy': running || undefined,
                'aria-describedby': result ? `${control}-probe-result` : undefined,
                disabled: disabled || probeState?.status === 'running' || !row.hasKey,
                onClick: () => { void probeBackend(capability, slotId); },
              }, running ? h(StateDot, { state: 'ongoing' }) : h('svg', {
                width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
                strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false,
              }, h('path', { d: 'm14 3 7 7M15 4 4.5 14.5a3.54 3.54 0 0 0 5 5L20 9M8.5 10.5l5 5' })))),
              h('button', {
                type: 'button', className: 'power-dsh-web-secondary', disabled,
                'aria-expanded': open, 'aria-controls': `${control}-editor`, 'aria-label': `${t('webSearchEdit')}: ${name} #${String(position)}`,
                onClick: () => { setEditing(current => current === slotId ? null : slotId); setRowError(null); },
              }, t('webSearchEdit')),
              h('button', {
                type: 'button', className: 'power-dsh-web-danger', disabled,
                'aria-label': `${t('webSearchRemove')}: ${name} #${String(position)}`,
                onClick: () => { void run(() => removeSlot(capability, slotId), slotId); },
              }, t('webSearchRemove')))),
          result && (result.ok
            ? h('p', { id: `${control}-probe-result`, className: 'power-dsh-web-hint', 'data-ok': true, role: 'status' },
              t(search ? 'webSearchProbeOk' : 'webSearchProbeFetchOk')
                .replace('{count}', String(result.resultCount)).replace('{ms}', String(result.durationMs)))
            : errorFeedback({ t, id: `${control}-probe-result`, message: probeFailureMessage(result, t),
              context: probeDiagnosticContext(result, capability, t), observedAt: result.diagnostic?.observedAt,
              code: 'PD-WEBSEARCH-PROBE', operation: search ? 'probeWebSearchSearch' : 'probeWebSearchFetch' })),
          rowError?.id === slotId && !open && errorFeedback({ t, id: `${control}-error`, message: rowError.message,
            code: 'PD-WEBSEARCH-SAVE', operation: 'webSearch' }),
          open && h('div', { id: `${control}-editor`, className: 'power-dsh-web-editor' },
            h('div', { className: 'power-dsh-web-field' },
              h('div', { className: 'power-dsh-web-field-head' },
                h('label', { className: 'power-dsh-web-label', htmlFor: `${control}-key` }, t('webSearchKeyLabel')),
                row.keyUrl && h('a', {
                  className: 'power-dsh-web-key-link', href: row.keyUrl,
                  target: '_blank', rel: 'noopener noreferrer',
                  'aria-label': `${t('webSearchGetKey')}: ${name} #${String(position)}`,
                }, t('webSearchGetKey'))),
              h('input', {
                id: `${control}-key`, className: 'power-dsh-web-input', type: 'password',
                autoComplete: 'new-password', spellCheck: false, value: draft,
                placeholder: row.hasKey ? t('webSearchKeyReplace') : t('webSearchKeyPlaceholder'),
                disabled: disabled || !row.writable,
                'aria-describedby': `${control}-hint${rowError?.id === slotId ? ` ${control}-error` : ''}`,
                'aria-invalid': rowError?.id === slotId || undefined,
                onChange: event => setDrafts(current => ({ ...current, [slotId]: event.target.value })),
              }),
              h('p', { id: `${control}-hint`, className: 'power-dsh-web-hint', 'data-ok': row.hasKey || undefined },
                t(row.hasKey ? 'webSearchKeyConfigured' : 'webSearchKeyMissing'),
                !row.writable ? ` ${t('webSearchCredentialsUnavailable')}` : null)),
            rowError?.id === slotId && errorFeedback({ t, id: `${control}-error`, message: rowError.message,
              code: 'PD-WEBSEARCH-SAVE', operation: 'webSearch' }),
            h('div', { className: 'power-dsh-web-editor-actions' },
              h('div', { className: 'power-dsh-web-commit' }, h('button', {
                type: 'button', className: 'power-dsh-web-secondary',
                disabled: busy,
                onClick: () => { setEditing(null); setDrafts(current => ({ ...current, [slotId]: '' })); setRowError(null); },
              }, t('webSearchCancel')),
              h('button', {
                type: 'button', className: 'power-dsh-web-primary',
                disabled: disabled || !row.writable || savingKey !== null || (draft === '' && !row.hasKey),
                'aria-busy': savingKey === slotId || undefined,
                onClick: () => {
                  const next = draft;
                  setSavingKey(slotId);
                  void run(async () => {
                    await saveKey(slotId, next);
                    if (mounted.current) { setDrafts(current => ({ ...current, [slotId]: '' })); setEditing(null); }
                  }, slotId).finally(() => { if (mounted.current) setSavingKey(null); });
                },
              }, t(draft === '' && row.hasKey ? 'webSearchKeyClear' : 'save'))))));
      };

      return h('section', { key: capability, className: 'power-dsh-web-section', 'aria-labelledby': headingId },
        h('h3', { id: headingId, className: 'power-dsh-web-section-title' },
          search ? t('webSearchChainSearch') : t('webSearchChainFetch')),
        h('p', { id: `${id}-${capability}-reorder-hint`, className: 'power-dsh-web-sr' }, t('webSearchReorderHint')),
        (!search || members.length > 0) && h('ul', { className: 'power-dsh-web-rows' },
          // The fetch section always leads with the machine itself. It is the
          // first step of every fetch and cannot be removed or reordered, so the
          // user sees the real order instead of having to infer it from copy.
          !search && h('li', { className: 'power-dsh-web-row', 'data-local': true, 'aria-labelledby': `${id}-local-name` },
            h('div', { className: 'power-dsh-web-row-head' },
              h('div', { className: 'power-dsh-web-row-identity' },
                h('span', { id: `${id}-local-name`, className: 'power-dsh-web-name' }, t('webSearchLocalName')),
                h('span', { className: 'power-dsh-web-tag' }, t('webSearchLocalTag')),
                h('span', { className: 'power-dsh-web-dot', 'data-state': 'configured', 'aria-hidden': true })))),
          ...members.map((slotId, index) => rowOf(slotId, index))),
        rowError?.id === capability && errorFeedback({ t, message: rowError.message,
          code: 'PD-WEBSEARCH-SAVE', operation: 'addWebSearchSlot' }),
        // One button, then a menu — not a row of vendor buttons.
        h('div', { className: 'power-dsh-web-add' }, h(Menu, {
          className: 'power-dsh-web-add-menu',
          open: addOpen === capability && !disabled,
          align: 'start', portal: true, autoFocus: true, minWidthFromAnchor: true,
          items: VENDORS.map(vendor => ({ id: vendor, label: NAMES[vendor] ?? vendor })),
          onClose: () => setAddOpen(null),
          onSelect: provider => {
            setAddOpen(null);
            void run(async () => {
              const slotId = await addSlot(capability, provider);
              if (mounted.current && slotId) setEditing(slotId);
            }, capability);
          },
          anchor: h('button', {
            type: 'button', className: 'power-dsh-web-add-button', disabled,
            'aria-haspopup': 'menu', 'aria-expanded': addOpen === capability,
            onClick: () => setAddOpen(current => current === capability ? null : capability),
          },
          // Lucide Plus, ISC licensed; see docs/third-party-notices.md.
          h('svg', {
            width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
            strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false,
          }, h('path', { d: 'M5 12h14' }), h('path', { d: 'M12 5v14' })),
          t('webSearchAdd')) })));
    };

    const notice = snapshot.status === 'error' ? snapshot.error
      : value && !value.available ? t('webSearchUnavailable')
        : !enabled ? t('webSearchDisabled') : null;

    return h('section', { className: 'power-dsh-page power-dsh-web-page', 'aria-label': t('webSearchTab') },
      h('style', null, styles),
      h('header', null,
        h('h2', { className: 'power-dsh-title' }, t('webSearchTab')),
        h('p', { className: 'power-dsh-description' }, t('webSearchPageDescription'))),
      snapshot.status === 'error'
        ? errorFeedback({ t, message: snapshot.error, code: 'PD-WEBSEARCH-LOAD', operation: 'readWebSearch',
          placement: 'page', retry: () => { void loadCatalog(); } })
        : notice ? h('p', { className: 'power-dsh-notice', role: 'status', 'data-tone': 'neutral' }, notice) : null,
      loading && !value ? loadingFeedback({ label: t('loading') })
        : value ? h('div', { className: 'power-dsh-web-chains' },
          chainSection('search', `${id}-chain-search`),
          chainSection('fetch', `${id}-chain-fetch`)) : null);
  }

  const renderPage = (props: PageSlotProps) => h(WebSearchPage, {
    ...props, source, catalogSource, loadCatalog,
    addSlot, removeSlot, reorderChain, saveKey, probeBackend,
  });

  // The settings sidebar is this feature's only seat: it contributes no
  // standalone-page entry, so it stays put when that page is enabled.
  preferenceSlot('webSearchEnabled', 'settings.section', {
    id: 'power-dsh-web-search', order: 53.5, locale: namespace, label: () => t('webSearchTab'),
  }, renderPage);
  preferenceSlot('webSearchEnabled', 'settings.section.icon', { id: 'power-dsh-web-search' }, WebSearchIcon);

  return {
    settings: [{
      field: 'webSearchEnabled', description: 'webSearchDescription',
      save: async next => {
        await savePreference('webSearchEnabled', next === true, 'webSearchOutdated');
        await loadCatalog();
      },
    }],
    api: { catalogSource, loadCatalog, addSlot, removeSlot, reorderChain, saveKey, probeBackend },
  } satisfies ClientFeature;
}
