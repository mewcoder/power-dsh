import { styles as catalogStyles } from '../../shared/client/catalog-styles.ts';
import { createCatalogUI } from '../../shared/client/catalog-ui.ts';
import { errorMessage } from '../../shared/client/runtime.ts';
import { styles as shellStyles } from '../../shared/client/shell-styles.ts';
import type { ClientEnvironment, ClientFeature, ClientRuntime, FeatureState, IconProps, PageSlotProps, SnapshotSource } from '../../shared/client/types.ts';
import type { ArchiveCatalog, ArchiveSessionRow } from './rpc.ts';
import { groupArchivedSessions, type ArchiveGroup, type ArchiveSort } from './archive-catalog.ts';
import { styles as featureStyles } from './styles.ts';

interface ArchivePageProps extends PageSlotProps {
  archiveSource: SnapshotSource<FeatureState<ArchiveCatalog>>;
  loadArchivedSessions(): Promise<void>;
  restoreArchivedSession(sessionId: string): Promise<void>;
  deleteArchivedSession(sessionId: string): Promise<void>;
}

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, Menu, Modal, Button, Tooltip, observable, useSnapshot, useMounted, errorFeedback } = runtime;
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
  const deleteErrorKeys = [
    'archiveDeleteUnavailable', 'archiveDeleteLive', 'archiveDeleteUnsupported', 'archiveDeleteUnsafe',
    'archiveNotArchived', 'archiveInvalidSession', 'archiveDeleteIncomplete', 'archiveDeleteCheckFailed',
    'archiveDeleteStatFailed', 'archiveDeleteUnarchiveFailed', 'archiveDeleteRemoveFailed',
  ];
  const archiveErrorMessage = (message: string | undefined, fallback: 'archiveLoadFailed' | 'archiveRestoreFailed' | 'archiveDeleteFailed') => {
    if (message?.includes('archiveUnavailable')) return t('archiveUnavailable');
    const key = message ? deleteErrorKeys.find(candidate => message.includes(candidate)) : undefined;
    return t(key ?? fallback);
  };

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

  function ArchivePage({ t, archiveSource, loadArchivedSessions, restoreArchivedSession, deleteArchivedSession }: ArchivePageProps) {
    const snapshot = useSnapshot(archiveSource);
    const catalog = snapshot.value;
    const [query, setQuery] = React.useState('');
    const [sortBy, setSortBy] = React.useState<ArchiveSort>('updated');
    const [projectId, setProjectId] = React.useState('');
    const [restoring, setRestoring] = React.useState<string | null>(null);
    const [deleting, setDeleting] = React.useState<string | null>(null);
    const [confirming, setConfirming] = React.useState<ArchiveSessionRow | null>(null);
    const [closedGroups, setClosedGroups] = React.useState<Record<string, boolean>>({});
    const [error, setError] = React.useState<{ id: string; message: string } | null>(null);
    const id = React.useId();
    const mounted = useMounted();
    const pending = React.useRef(false);
    const busy = snapshot.status === 'loading' || restoring !== null || deleting !== null;
    React.useEffect(() => {
      void loadArchivedSessions();
      const refresh = () => { void loadArchivedSessions(); };
      window.addEventListener('focus', refresh);
      return () => window.removeEventListener('focus', refresh);
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
    async function restore(sessionId: string) {
      if (disabled || pending.current) return;
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
    async function confirmDelete(sessionId: string) {
      if (pending.current) return;
      pending.current = true;
      setDeleting(sessionId);
      setError(null);
      try {
        await deleteArchivedSession(sessionId);
        if (mounted.current) setConfirming(null);
      } catch (failure) {
        if (mounted.current) {
          setConfirming(null);
          setError({ id: sessionId, message: archiveErrorMessage(errorMessage(failure), 'archiveDeleteFailed') });
        }
      } finally {
        pending.current = false;
        if (mounted.current) setDeleting(null);
      }
    }
    const renderRow = (row: ArchiveSessionRow) => {
      const rowBusy = restoring === row.sessionId || deleting === row.sessionId;
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
            disabled: disabled || rowBusy, 'aria-busy': deleting === row.sessionId,
            onClick: () => { if (mounted.current) setConfirming(row); },
          }, t(deleting === row.sessionId ? 'archiveDeleting' : 'archiveDelete')),
          h('button', {
            type: 'button', className: 'power-dsh-archive-action',
            'data-restore': row.sessionId, 'aria-label': `${t('archiveRestore')} ${name}`,
            disabled: disabled || rowBusy, 'aria-busy': restoring === row.sessionId,
            onClick: () => restore(row.sessionId),
          }, t(restoring === row.sessionId ? 'archiveRestoring' : 'archiveRestore'))));
    };
    const renderGroup = (group: ArchiveGroup, index: number) => {
      const titleId = `${id}-archive-group-${index}`;
      const open = Boolean(query.trim()) || !closedGroups[group.key];
      return h('section', { key: group.key, className: 'power-dsh-archive-group', 'aria-labelledby': titleId },
        h('div', { className: 'power-dsh-archive-group-header' },
          h('button', {
            id: titleId, type: 'button', className: 'power-dsh-archive-group-toggle',
            'aria-expanded': open, 'aria-controls': `${titleId}-body`,
            onClick: () => {
              if (query.trim()) return;
              if (mounted.current) setClosedGroups(current => ({ ...current, [group.key]: !current[group.key] }));
            },
          }, h(SkillChevron), h('span', { className: 'power-dsh-archive-group-folder' }, h(FolderIcon)),
          h('span', { className: 'power-dsh-archive-group-title' }, group.title)),
          h('span', { className: 'power-dsh-archive-count' }, t('archiveCount').replace('{count}', () => String(group.sessions.length)))),
        open && h('ul', { id: `${titleId}-body`, className: 'power-dsh-archive-rows' }, group.sessions.map(renderRow)));
    };
    return h('section', { className: 'power-dsh-page power-dsh-skills-page power-dsh-archive-page', 'aria-label': t('archiveTab') },
      h('style', null, styles),
      h('header', null,
        h('h2', { className: 'power-dsh-title' }, t('archiveTab')),
        h('p', { className: 'power-dsh-description' }, t('archiveDescription'))),
      snapshot.status === 'loading' && h('p', { className: 'power-dsh-notice', role: 'status' }, t('loading')),
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
        && errorFeedback({ t, message: error.message, code: 'PD-ARCHIVE-ACTION', operation: 'archiveSession', placement: 'page' }),
      confirming && h(Modal, {
        open: true, onClose: () => { if (deleting === null) setConfirming(null); },
        title: t('archiveDeleteTitle'), closeLabel: t('close'),
        description: t('archiveDeleteDescription').replace('{name}', () => confirming.title || t('archiveUntitled')),
        footer: h(React.Fragment, null,
          h(Button, { variant: 'outline', 'data-modal-autofocus': true, disabled: deleting !== null,
            onClick: () => { if (deleting === null) setConfirming(null); } }, t('cancel')),
          h(Button, { variant: 'outline', className: 'power-dsh-archive-confirm-delete', disabled: deleting !== null,
            onClick: () => { void confirmDelete(confirming.sessionId); } }, t(deleting !== null ? 'archiveDeleting' : 'archiveDeleteConfirm'))),
      }));
  }

  let active = true;
  let archive: FeatureState<ArchiveCatalog> = { status: 'loading', value: null, error: '' };
  const archiveSource = observable(() => archive);
  let generation = 0;
  ctx.effect(() => () => { active = false; generation++; });

  const loadArchivedSessions = async () => {
    const current = ++generation;
    if (archive.status !== 'ready') { archive = { ...archive, status: 'loading', error: '' }; archiveSource.notify(); }
    try {
      const result = await ctx.remote.powerDsh.listArchivedSessions();
      if (!active || current !== generation) return;
      if (!result.ok) throw new Error(result.error.message);
      archive = { status: 'ready', value: result.value, error: '' };
    } catch (failure) {
      if (!active || current !== generation) return;
      archive = { ...archive, status: 'error', error: archiveErrorMessage(errorMessage(failure), 'archiveLoadFailed') };
    }
    archiveSource.notify();
  };
  const restoreArchivedSession = async (sessionId: string) => {
    const current = ++generation;
    const result = await ctx.remote.powerDsh.restoreArchivedSession(sessionId);
    if (!active || current !== generation) return;
    if (!result.ok) {
      await loadArchivedSessions();
      throw new Error(result.error.message);
    }
    archive = { status: 'ready', value: result.value, error: '' };
    archiveSource.notify();
  };
  const deleteArchivedSession = async (sessionId: string) => {
    const current = ++generation;
    const result = await ctx.remote.powerDsh.deleteArchivedSession(sessionId);
    if (!active || current !== generation) return;
    if (!result.ok) {
      await loadArchivedSessions();
      throw new Error(result.error.message);
    }
    archive = { status: 'ready', value: result.value, error: '' };
    archiveSource.notify();
  };

  preferenceSlot('archiveManagerEnabled', 'settings.section', {
    id: 'power-dsh-archive', order: 54, locale: namespace, label: () => t('archiveTab'),
  }, (props: PageSlotProps) => h(ArchivePage, { ...props, archiveSource, loadArchivedSessions, restoreArchivedSession, deleteArchivedSession }));
  preferenceSlot('archiveManagerEnabled', 'settings.section.icon', { id: 'power-dsh-archive' }, ArchiveIcon);
  return {
    settings: [{ field: 'archiveManagerEnabled', description: 'archiveManagerDescription',
      save: next => savePreference('archiveManagerEnabled', next === true, 'archiveOutdated'), hideError: true }],
    api: { archiveSource, loadArchivedSessions, restoreArchivedSession, deleteArchivedSession },
  } satisfies ClientFeature;
}
