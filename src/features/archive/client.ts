import { styles as catalogStyles } from '../../shared/client/catalog-styles.ts';
import { createCatalogUI } from '../../shared/client/catalog-ui.ts';
import { errorMessage } from '../../shared/client/runtime.ts';
import { styles as shellStyles } from '../../shared/client/shell-styles.ts';
import type { ClientEnvironment, ClientFeature, ClientRuntime, FeatureState, IconProps, PageSlotProps, SnapshotSource } from '../../shared/client/types.ts';
import type { ArchiveCatalog, ArchiveSessionRow } from './rpc.ts';
import { groupArchivedSessions, type ArchiveGroup, type ArchiveSort } from './archive-catalog.ts';
import { AUTO_ARCHIVE_DAYS, AUTO_ARCHIVE_NEVER, normalizeDays } from './auto-archive-policy.ts';
import { styles as featureStyles } from './styles.ts';

type ArchiveState = FeatureState<ArchiveCatalog> & { refreshing?: boolean };
type DeleteScope = { row: string } | { workspace: string } | 'all';
type Confirmation = { scope: DeleteScope; title: string; ids: string[] };

function targets(state: ArchiveState, scope: DeleteScope): string[] {
  if (state.status !== 'ready' || !state.value?.complete) return [];
  return [...new Set(state.value.sessions.filter(row => scope === 'all'
    || ('row' in scope ? row.sessionId === scope.row : row.workspaceId === scope.workspace)).map(row => row.sessionId))];
}

interface ArchivePageProps extends PageSlotProps {
  archiveSource: SnapshotSource<ArchiveState>;
  deleteArchivedSessions(ids: readonly string[], available: () => boolean): Promise<string>;
  settingsSource: SnapshotSource<import('../../shared/client/types.ts').FormSnapshot>;
  savePreference: import('../../shared/client/types.ts').SavePreference;
  loadArchivedSessions(): Promise<void>;
  restoreArchivedSession(sessionId: string): Promise<void>;
}

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, Menu, Modal, Button, NativeIcon, Tooltip, observable, useSnapshot, useMounted, loadingFeedback, errorFeedback } = runtime;
  const { ctx, t, savePreference, preferenceSlot, namespace } = env;
  const styles = shellStyles + catalogStyles + featureStyles;
  const { SkillSearchIcon, SkillChevron } = createCatalogUI(runtime);
  // Lucide Archive, ISC licensed; see docs/third-party-notices.md.
  function ArchiveIcon({ size = 16 }: IconProps) {
    return h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      'aria-hidden': true, focusable: false,
    }, h('rect', { x: 2, y: 3, width: 20, height: 5, rx: 1 }),
    h('path', { d: 'M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8' }),
    h('path', { d: 'M10 12h4' }));
  }
  // Lucide Folder, ISC licensed; see docs/third-party-notices.md.
  function FolderIcon({ size = 16 }: IconProps) {
    return h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      'aria-hidden': true, focusable: false,
    }, h('path', { d: 'M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2z' }));
  }
  const archiveErrorMessage = (message: string | undefined, fallback: 'archiveLoadFailed' | 'archiveRestoreFailed') =>
    t(message?.includes('archiveUnavailable') ? 'archiveUnavailable' : fallback);

  interface ArchiveSelectProps {
    label: string;
    value: string;
    options: { id: string; label: string }[];
    disabled?: boolean;
    onChange(value: string): void;
  }
  function ArchiveSelect({ label, value, options, disabled, onChange }: ArchiveSelectProps) {
    const [open, setOpen] = React.useState(false);
    const current = options.find(option => option.id === value) ?? options[0];
    return h(Menu, {
      open: open && !disabled, align: 'end', portal: true, autoFocus: true, minWidthFromAnchor: true,
      className: 'power-dsh-archive-menu',
      selectedId: value,
      items: options.map(option => ({ id: option.id, label: option.label })),
      onClose: () => setOpen(false),
      onSelect: id => { setOpen(false); if (id !== value) onChange(id); },
      anchor: h('button', {
        type: 'button', className: 'power-dsh-archive-select', disabled: Boolean(disabled),
        'aria-haspopup': 'menu', 'aria-expanded': open && !disabled, 'aria-label': label,
        onClick: () => setOpen(state => !state),
      }, h('span', { className: 'power-dsh-archive-select-label' }, current?.label ?? label),
      h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: 'm4 6 4 4 4-4' }))),
    });
  }

  function ArchivePage({ t, archiveSource, settingsSource, savePreference, loadArchivedSessions, restoreArchivedSession, deleteArchivedSessions }: ArchivePageProps) {
    const snapshot = useSnapshot(archiveSource);
    const settings = useSnapshot(settingsSource);
    const catalog = snapshot.value;
    const [query, setQuery] = React.useState('');
    const [sortBy, setSortBy] = React.useState<ArchiveSort>('updated');
    const [projectId, setProjectId] = React.useState('');
    const [restoring, setRestoring] = React.useState<string | null>(null);
    const [deleting, setDeleting] = React.useState(false);
    const [confirmation, setConfirmation] = React.useState<Confirmation | null>(null);
    const confirmationRef = React.useRef<Confirmation | null>(null);
    const [groupMenu, setGroupMenu] = React.useState<string | null>(null);
    // Groups start collapsed; only the ones the user opened are tracked here.
    const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({});
    const [error, setError] = React.useState<{ id: string; message: string } | null>(null);
    const [autoSaving, setAutoSaving] = React.useState<string | null>(null);
    const [autoError, setAutoError] = React.useState<string | null>(null);
    const [autoDaysOpen, setAutoDaysOpen] = React.useState(false);
    const autoPending = React.useRef(false);
    const id = React.useId();
    const mounted = useMounted();
    const pending = React.useRef(false);
    const pageAvailable = () => active && mounted.current
      && settingsSource.getSnapshot().value?.archiveManagerEnabled === true;
    const busy = snapshot.status === 'loading' || restoring !== null || deleting;
    React.useEffect(() => {
      void loadArchivedSessions();
      const refresh = () => { void loadArchivedSessions(); };
      const offConnection = ctx.connection.generation.subscribe(refresh);
      window.addEventListener('focus', refresh);
      return () => {
        offConnection();
        window.removeEventListener('focus', refresh);
      };
    }, []);
    const groups = catalog ? groupArchivedSessions(catalog, query, t('archiveUngrouped'), { sortBy, projectId }) : [];
    const sortOptions = [
      { id: 'updated', label: t('archiveSortUpdated') },
      { id: 'created', label: t('archiveSortCreated') },
    ];
    const projectOptions = [{ id: 'all', label: t('archiveAllProjects') },
      ...(catalog?.workspaces ?? []).map(workspace => ({ id: workspace.workspaceId, label: workspace.title }))];
    const projectValue = projectId || 'all';
    const disabled = busy || snapshot.status !== 'ready' || !catalog?.complete;
    const canConfirm = (state: ArchiveState, target: Confirmation) => {
      const current = new Set(targets(state, target.scope));
      return current.size === target.ids.length && target.ids.every(id => current.has(id));
    };
    const closeConfirmation = () => { confirmationRef.current = null; setConfirmation(null); };
    React.useEffect(() => {
      if (confirmation && !snapshot.refreshing && !canConfirm(snapshot, confirmation)) closeConfirmation();
    }, [confirmation, snapshot]);
    const openConfirmation = (scope: DeleteScope, title = '') => {
      const current = archiveSource.getSnapshot();
      if (!pageAvailable() || pending.current || current.refreshing) return;
      const ids = targets(current, scope);
      if (!ids.length) return;
      const target = { scope, title, ids };
      confirmationRef.current = target;
      setConfirmation(target);
    };
    async function confirmDelete(target: Confirmation) {
      if (!pageAvailable() || pending.current || confirmationRef.current !== target) return;
      const current = archiveSource.getSnapshot();
      if (current.refreshing) return;
      if (!canConfirm(current, target)) { closeConfirmation(); return; }
      pending.current = true;
      closeConfirmation();
      setDeleting(true);
      setError(null);
      try {
        const failure = await deleteArchivedSessions(target.ids, pageAvailable);
        if (failure && pageAvailable()) setError({ id: '', message: t(failure) });
      } finally {
        pending.current = false;
        if (mounted.current) setDeleting(false);
      }
    }
    async function restore(sessionId: string) {
      if (!pageAvailable() || disabled || pending.current) return;
      pending.current = true;
      setRestoring(sessionId);
      setError(null);
      try {
        await restoreArchivedSession(sessionId);
      } catch (failure) {
        if (mounted.current) setError({ id: sessionId, message: archiveErrorMessage(errorMessage(failure), 'archiveRestoreFailed') });
      } finally {
        pending.current = false;
        if (mounted.current) setRestoring(null);
      }
    }
    const settingsReady = settings.status === 'ready';
    const autoDays = normalizeDays(settings.value?.autoArchiveDays);
    const autoBusy = autoSaving === 'autoArchiveDays';
    const autoWritable = settingsReady && settings.writable && !autoBusy;
    React.useEffect(() => { if (!autoWritable) setAutoDaysOpen(false); }, [autoWritable]);
    const daysLabel = (days: number) => (days === AUTO_ARCHIVE_NEVER
      ? t('autoArchiveNever')
      : t('autoArchiveDaysValue').replace('{days}', () => String(days)));
    async function saveAuto(days: number) {
      const current = settingsSource.getSnapshot();
      if (!active || !mounted.current || autoPending.current || current.status !== 'ready' || !current.writable
        || !current.value?.archiveManagerEnabled || !AUTO_ARCHIVE_DAYS.includes(days)
        || normalizeDays(current.value.autoArchiveDays) === days) return;
      autoPending.current = true;
      setAutoSaving('autoArchiveDays');
      setAutoError(null);
      try {
        await savePreference('autoArchiveDays', days, undefined, 'number');
      } catch (failure) {
        if (mounted.current) setAutoError(errorMessage(failure) ?? t('saveFailed'));
      } finally {
        autoPending.current = false;
        if (mounted.current) setAutoSaving(null);
      }
    }
    const daysSelect = h(Menu, {
      open: autoDaysOpen && autoWritable, align: 'end', portal: true, autoFocus: true, minWidthFromAnchor: true,
      selectedId: String(autoDays),
      items: AUTO_ARCHIVE_DAYS.map(days => ({ id: String(days), label: daysLabel(days), disabled: !autoWritable })),
      onClose: () => setAutoDaysOpen(false),
      onSelect: next => { setAutoDaysOpen(false); return saveAuto(Number(next)); },
      anchor: h('button', {
        type: 'button', className: 'power-dsh-archive-auto-select',
        disabled: !autoWritable,
        'aria-label': t('autoArchiveDays'),
        'aria-describedby': `${id}-auto-days-description${autoError ? ` ${id}-auto-error` : ''}`,
        'aria-invalid': autoError ? true : undefined,
        'aria-haspopup': 'menu', 'aria-expanded': autoDaysOpen && autoWritable,
        'aria-busy': autoBusy,
        onClick: () => { if (autoWritable) setAutoDaysOpen(value => !value); },
      }, daysLabel(autoDays), h('svg', {
        width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false,
      }, h('path', { d: 'm4 6 4 4 4-4' }))),
    });
    // One row, one preference: "never" is the 0 option, so no second switch can
    // disagree with the threshold.
    const autoArchiveCard = h('section', { className: 'power-dsh-archive-auto', 'aria-label': t('autoArchiveEnabled') },
      h('div', { className: 'power-dsh-setting-row' },
        h('div', { className: 'power-dsh-setting-copy' },
          h('div', { id: `${id}-auto-days-label`, className: 'power-dsh-setting-label' }, t('autoArchiveDays')),
          h('div', { id: `${id}-auto-days-description`, className: 'power-dsh-description' }, t('autoArchiveDaysDescription')),
          autoError && errorFeedback({ t, id: `${id}-auto-error`, message: autoError,
            code: 'PD-AUTO-ARCHIVE-SAVE', operation: 'settings.autoArchiveDays' })),
        daysSelect));
    const renderRow = (row: ArchiveSessionRow) => {
      const rowBusy = restoring === row.sessionId;
      const time = row.updatedAt > 0 ? new Date(row.updatedAt).toLocaleString() : '';
      const name = row.title || t('archiveUntitled');
      return h('li', { key: row.sessionId, className: 'power-dsh-archive-row', 'data-archive': row.sessionId },
        h('div', { className: 'power-dsh-archive-row-main' },
          h(Tooltip, { label: row.title || row.sessionId, side: 'top', portal: true, delayMs: 0, maxWidth: 480 },
            h('span', { className: 'power-dsh-archive-row-title', tabIndex: 0 }, name)),
          time && h('span', { className: 'power-dsh-archive-row-time' }, time),
          error?.id === row.sessionId && errorFeedback({ t, id: `${row.sessionId}-error`, message: error.message,
            code: 'PD-ARCHIVE-ACTION', operation: 'archiveSession' })),
        h('div', { className: 'power-dsh-archive-row-actions' },
          h('button', {
            type: 'button', className: 'power-dsh-archive-action power-dsh-archive-action-danger',
            'data-delete': row.sessionId, 'aria-label': `${t('archiveDelete')} ${name}`,
            disabled: disabled || snapshot.refreshing, onClick: () => openConfirmation({ row: row.sessionId }, name),
          }, t('archiveDelete')),
          h('button', {
            type: 'button', className: 'power-dsh-archive-action',
            'data-restore': row.sessionId, 'aria-label': `${t('archiveRestore')} ${name}`,
            disabled: disabled || rowBusy, 'aria-busy': restoring === row.sessionId,
            onClick: () => restore(row.sessionId),
          }, t(restoring === row.sessionId ? 'archiveRestoring' : 'archiveRestore'))));
    };
    const renderGroup = (group: ArchiveGroup, index: number) => {
      const titleId = `${id}-archive-group-${index}`;
      // Collapsed by default: a search always reveals its matches, otherwise the
      // group opens only after the user toggles it in this visit.
      const open = Boolean(query.trim()) || Boolean(openGroups[group.key]);
      const path = group.path;
      const toggle = h('button', {
        id: titleId, type: 'button', className: 'power-dsh-archive-group-toggle',
        'aria-expanded': open, 'aria-controls': `${titleId}-body`,
        onClick: () => {
          if (query.trim()) return;
          if (mounted.current) setOpenGroups(current => ({ ...current, [group.key]: !current[group.key] }));
        },
      }, h('span', { className: 'power-dsh-archive-group-folder' }, h(FolderIcon)),
      h('span', { className: 'power-dsh-archive-group-title' }, group.title), h(SkillChevron));
      return h('section', { key: group.key, className: 'power-dsh-archive-group', 'aria-labelledby': titleId },
        h('div', { className: 'power-dsh-archive-group-header' },
          path ? h(Tooltip, { label: path, side: 'top', portal: true, delayMs: 0, maxWidth: 520 }, toggle) : toggle,
          h('span', { className: 'power-dsh-archive-count' }, t('archiveCount').replace('{count}', () => String(group.sessions.length))),
           h(Menu, {
             open: groupMenu === group.key && !disabled && !snapshot.refreshing, align: 'end', portal: true, autoFocus: true,
             items: [{ id: 'delete', label: t('archiveDeleteAll') }], onClose: () => setGroupMenu(null),
             onSelect: key => {
               if (key !== 'delete' || groupMenu !== group.key) return;
               setGroupMenu(null);
               openConfirmation({ workspace: group.sessions[0]!.workspaceId }, group.title);
             },
             anchor: h('button', { type: 'button', className: 'power-dsh-archive-action power-dsh-archive-group-menu',
               disabled: disabled || snapshot.refreshing, 'data-group-menu': group.key,
               'aria-label': `${t('archiveGroupActions')} ${group.title}`, 'aria-haspopup': 'menu',
               'aria-expanded': groupMenu === group.key && !disabled && !snapshot.refreshing,
               onClick: () => setGroupMenu(current => current === group.key ? null : group.key),
             }, h(NativeIcon, { glyph: 'ellipsis-outline', size: 16 })),
           })),
        open && h('ul', { id: `${titleId}-body`, className: 'power-dsh-archive-rows' }, group.sessions.map(renderRow)));
    };
    return h('section', { className: 'power-dsh-page power-dsh-skills-page power-dsh-archive-page', 'aria-label': t('archiveTab') },
      h('style', null, styles),
      h('header', null,
        h('h2', { className: 'power-dsh-title' }, t('archiveTab')),
         h('div', { className: 'power-dsh-archive-head' },
           h('p', { className: 'power-dsh-description' }, t('archiveDescription')),
           catalog && catalog.sessions.length > 0 && h('button', {
             type: 'button', className: 'power-dsh-archive-action power-dsh-archive-action-danger power-dsh-archive-delete-all',
             disabled: disabled || snapshot.refreshing, onClick: () => openConfirmation('all'),
           }, t('archiveDeleteAll')))),
      autoArchiveCard,
      (snapshot.status === 'loading' || snapshot.refreshing) && loadingFeedback({ label: t('loading'), compact: Boolean(catalog) }),
      catalog?.complete === false && snapshot.status === 'ready' && errorFeedback({ t, message: t('archiveRefreshRequired'),
        code: 'PD-ARCHIVE-REFRESH', operation: 'listArchivedSessions', placement: 'page', retry: loadArchivedSessions, disabled: busy }),
      snapshot.status === 'error' && errorFeedback({ t, message: snapshot.error || t('archiveLoadFailed'),
        code: 'PD-ARCHIVE-LOAD', operation: 'listArchivedSessions', placement: 'page', retry: loadArchivedSessions, disabled: busy }),
      h('div', { className: 'power-dsh-skill-panel' },
        catalog && h('div', { className: 'power-dsh-archive-toolbar' },
          h('label', { className: 'power-dsh-skill-search-field' }, h(SkillSearchIcon), h('input', {
            type: 'search', value: query, disabled: busy,
            placeholder: t('archiveSearch'), 'aria-label': t('archiveSearch'),
            onChange: (event: import('react').ChangeEvent<HTMLInputElement>) => { if (mounted.current) setQuery(event.target.value); },
          })),
          h(ArchiveSelect, { label: t('archiveSortLabel'), value: sortBy, options: sortOptions, disabled: busy,
            onChange: value => { if (mounted.current) setSortBy(value as ArchiveSort); } }),
          h(ArchiveSelect, { label: t('archiveProjectLabel'), value: projectValue, options: projectOptions, disabled: busy,
            onChange: value => { if (mounted.current) setProjectId(value === 'all' ? '' : value); } })),
        catalog && snapshot.status === 'ready' && groups.map(renderGroup),
        catalog && snapshot.status === 'ready' && groups.length === 0
          && h('p', { className: 'power-dsh-skill-empty' }, t(query || projectId ? 'archiveNoMatches' : 'archiveEmpty'))),
      error && !(catalog?.sessions ?? []).some(row => row.sessionId === error.id)
         && errorFeedback({ t, message: error.message, code: 'PD-ARCHIVE-ACTION', operation: error.id ? 'restoreArchivedSession' : 'deleteArchivedSession', placement: 'page' }),
       confirmation && h(Modal, {
         open: true, onClose: closeConfirmation, title: t('archiveDeleteTitle'), closeLabel: t('close'),
         description: confirmation.scope !== 'all' && 'row' in confirmation.scope
           ? t('archiveDeleteDescription').replace('{name}', () => confirmation.title)
           : t(confirmation.scope === 'all' ? 'archiveDeleteAllDescription' : 'archiveDeleteGroupDescription')
             .replace('{name}', () => confirmation.title).replace('{count}', () => String(confirmation.ids.length)),
         footer: h(React.Fragment, null,
           h(Button, { variant: 'outline', 'data-modal-autofocus': true, onClick: closeConfirmation }, t('cancel')),
           h(Button, { variant: 'outline', className: 'power-dsh-archive-confirm-delete',
             disabled: Boolean(snapshot.refreshing) || !canConfirm(snapshot, confirmation),
             onClick: () => confirmDelete(confirmation) }, t('archiveDelete'))),
       }));
  }

  let active = true;
  let archive: ArchiveState = { status: 'loading', value: null, error: '' };
  const archiveSource = observable(() => archive);
  let generation = 0;
  let archiveWritePending = false;
  ctx.effect(() => () => { active = false; generation++; });

  const loadArchivedSessions = async () => {
    if (!active || archiveWritePending) return;
    const current = ++generation;
    archive = { ...archive, status: archive.status === 'ready' ? 'ready' : 'loading', error: '', refreshing: true };
    archiveSource.notify();
    try {
      const result = await ctx.remote.powerDsh.listArchivedSessions();
      if (!active || current !== generation) return;
      if (!result.ok) throw new Error(result.error.message);
      archive = { status: 'ready', value: result.value, error: '' };
    } catch (failure) {
      if (!active || current !== generation) return;
      archive = { ...archive, refreshing: false, status: 'error', error: archiveErrorMessage(errorMessage(failure), 'archiveLoadFailed') };
    }
    archiveSource.notify();
  };
  const restoreArchivedSession = async (sessionId: string) => {
    if (!active || archiveWritePending || env.source.getSnapshot().value?.archiveManagerEnabled !== true) return;
    archiveWritePending = true;
    const current = ++generation;
    try {
      const result = await ctx.remote.powerDsh.restoreArchivedSession(sessionId);
      if (!active || current !== generation) return;
      if (!result.ok) throw new Error(result.error.message);
      archive = { status: 'ready', value: result.value, error: '' };
      archiveSource.notify();
    } catch (failure) {
      archiveWritePending = false;
      if (active && current === generation) await loadArchivedSessions();
      throw failure;
    } finally {
      archiveWritePending = false;
    }
  };
  const deleteArchivedSessions = async (ids: readonly string[], available: () => boolean) => {
    if (!active || archiveWritePending || !available()) return '';
    archiveWritePending = true;
    const current = ++generation;
    let failure = '';
    try {
      for (const id of ids) {
        if (!active || !available()) break;
        try {
          const result = await ctx.remote.powerDsh.deleteArchivedSession(id);
          if (!result.ok) {
            const safeKeys = ['archiveDeleteUnavailable', 'archiveDeleteBusy', 'archiveDeleteUnsupported', 'archiveNotArchived', 'archiveDeleteRecoveryRequired'];
            failure = ids.length === 1 ? safeKeys.find(key => result.error.message.includes(key)) ?? 'archiveDeleteFailed' : 'archiveDeleteFailed';
            continue;
          }
          if (active && current === generation) {
            archive = { status: 'ready', value: result.value, error: '' };
            archiveSource.notify();
          }
        } catch { failure = 'archiveDeleteFailed'; }
      }
    } finally {
      archiveWritePending = false;
      if (failure && active && current === generation && available()) await loadArchivedSessions();
    }
    return failure;
  };
  preferenceSlot('archiveManagerEnabled', 'settings.section', {
    id: 'power-dsh-archive', order: 54.5, locale: namespace, label: () => t('archiveTab'),
  }, (props: PageSlotProps) => h(ArchivePage, { ...props, archiveSource, settingsSource: env.source, savePreference,
    loadArchivedSessions, restoreArchivedSession, deleteArchivedSessions }));
  preferenceSlot('archiveManagerEnabled', 'settings.section.icon', { id: 'power-dsh-archive' }, ArchiveIcon);
  return {
    settings: [{ field: 'archiveManagerEnabled', description: 'archiveManagerDescription',
      save: next => savePreference('archiveManagerEnabled', next === true, 'archiveOutdated'), hideError: true }],
    api: { archiveSource, loadArchivedSessions, restoreArchivedSession },
  } satisfies ClientFeature;
}
