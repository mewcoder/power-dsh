import { styles as catalogStyles } from '../../shared/client/catalog-styles.ts';
import { createCatalogUI } from '../../shared/client/catalog-ui.ts';
import { errorMessage } from '../../shared/client/runtime.ts';
import { styles as shellStyles } from '../../shared/client/shell-styles.ts';
import type { ClientEnvironment, ClientFeature, ClientRuntime, FeatureState, IconProps, PageSlotProps, SnapshotSource } from '../../shared/client/types.ts';
import type { ProjectCatalog, ProjectRow } from './rpc.ts';
import { arrangeProjects, relativeTime, type ProjectSort, type RelativeTimeUnit } from './projects-catalog.ts';
import { styles as featureStyles } from './styles.ts';

/** Translation keys for the compact activity buckets, in the native session-row wording. */
const timeKeys = {
  now: 'projectsTimeNow', minutes: 'projectsTimeMinutes', hours: 'projectsTimeHours',
  days: 'projectsTimeDays', months: 'projectsTimeMonths', years: 'projectsTimeYears',
} as const satisfies Record<RelativeTimeUnit, string>;

interface ProjectsPageProps extends PageSlotProps {
  projectsSource: SnapshotSource<FeatureState<ProjectCatalog>>;
  loadProjects(): Promise<void>;
  removeProject(workspaceId: string): Promise<void>;
}

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, Menu, Modal, Button, Tooltip, observable, useSnapshot, useMounted, loadingFeedback, errorFeedback } = runtime;
  const { ctx, t, savePreference, preferenceSlot, namespace } = env;
  const styles = shellStyles + catalogStyles + featureStyles;
  const { SkillSearchIcon } = createCatalogUI(runtime);
  // Lucide Folder, ISC licensed; see docs/third-party-notices.md.
  function FolderIcon({ size = 16 }: IconProps) {
    return h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      'aria-hidden': true, focusable: false,
    }, h('path', { d: 'M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2z' }));
  }
  // Lucide Folders, ISC licensed; see docs/third-party-notices.md.
  function ProjectsIcon({ size = 16 }: IconProps) {
    return h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      'aria-hidden': true, focusable: false,
    }, h('path', { d: 'M20 5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2.5a1.5 1.5 0 0 1 1.2.6l.6.8a1.5 1.5 0 0 0 1.2.6z' }),
    h('path', { d: 'M3 8.268a2 2 0 0 0-1 1.738V19a2 2 0 0 0 2 2h11a2 2 0 0 0 1.732-1' }));
  }
  const projectErrorKeys = ['projectsInvalidWorkspace', 'projectsNotFound'];
  const projectErrorMessage = (message: string | undefined, fallback: 'projectsLoadFailed' | 'projectsRemoveFailed') => {
    if (message?.includes('projectsUnavailable')) return t('projectsUnavailable');
    const key = message ? projectErrorKeys.find(candidate => message.includes(candidate)) : undefined;
    return t(key ?? fallback);
  };

  function ProjectsPage({ t, projectsSource, loadProjects, removeProject }: ProjectsPageProps) {
    const snapshot = useSnapshot(projectsSource);
    const catalog = snapshot.value;
    const [query, setQuery] = React.useState('');
    const [sortBy, setSortBy] = React.useState<ProjectSort>('recent');
    const [removing, setRemoving] = React.useState<string | null>(null);
    const [confirming, setConfirming] = React.useState<ProjectRow | null>(null);
    const [error, setError] = React.useState<{ id: string; message: string } | null>(null);
    const [now, setNow] = React.useState(() => Date.now());
    const [openSelect, setOpenSelect] = React.useState<string | null>(null);
    const id = React.useId();
    const mounted = useMounted();
    const pending = React.useRef(false);
    const busy = snapshot.status === 'loading' || removing !== null;
    React.useEffect(() => {
      void loadProjects();
      const refresh = () => { setNow(Date.now()); void loadProjects(); };
      window.addEventListener('focus', refresh);
      return () => window.removeEventListener('focus', refresh);
    }, []);
    const rows = catalog ? arrangeProjects(catalog, query, sortBy) : [];
    const sortOptions = [
      { id: 'recent', label: t('projectsSortRecent') },
      { id: 'manual', label: t('projectsSortManual') },
    ];
    // One shared native Menu per select; both stay in this view so the tree has no extra layers.
    const select = (key: string, label: string, value: string, options: { id: string; label: string }[], onChange: (next: string) => void) => {
      const current = options.find(option => option.id === value) ?? options[0];
      const open = openSelect === key && !busy;
      return h(Menu, {
        open, align: 'end', portal: true, autoFocus: true, minWidthFromAnchor: true,
        className: 'power-dsh-projects-menu',
        selectedId: value,
        items: options.map(option => ({ id: option.id, label: option.label })),
        onClose: () => setOpenSelect(null),
        onSelect: id => { setOpenSelect(null); if (id !== value) onChange(id); },
        anchor: h('button', {
          type: 'button', className: 'power-dsh-projects-select', disabled: busy,
          'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-label': label,
          onClick: () => setOpenSelect(state => state === key ? null : key),
        }, h('span', { className: 'power-dsh-projects-select-label' }, current?.label ?? label),
        h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: 'm4 6 4 4 4-4' }))),
      });
    };
    const disabled = busy || snapshot.status !== 'ready' || !catalog?.complete;
    const activityLabel = (row: ProjectRow) => {
      if (row.lastActiveAt <= 0) return t('projectsNeverUsed');
      const { unit, n } = relativeTime(row.lastActiveAt, now);
      return t(timeKeys[unit]).replace('{n}', () => String(n));
    };
    async function confirmRemove(workspaceId: string) {
      if (pending.current) return;
      pending.current = true;
      setRemoving(workspaceId);
      setError(null);
      try {
        await removeProject(workspaceId);
        if (mounted.current) setConfirming(null);
      } catch (failure) {
        if (mounted.current) {
          setConfirming(null);
          setError({ id: workspaceId, message: projectErrorMessage(errorMessage(failure), 'projectsRemoveFailed') });
        }
      } finally {
        pending.current = false;
        if (mounted.current) setRemoving(null);
      }
    }
    const renderRow = (row: ProjectRow) => {
      const rowBusy = removing === row.workspaceId;
      const name = row.title || row.path || row.workspaceId;
      return h('li', { key: row.workspaceId, className: 'power-dsh-projects-row', role: 'row', 'data-project': row.workspaceId },
        h('div', { className: 'power-dsh-projects-cell power-dsh-projects-main', role: 'cell' },
          h('span', { className: 'power-dsh-projects-folder' }, h(FolderIcon)),
          h('div', { className: 'power-dsh-projects-copy' },
            h(Tooltip, { label: name, side: 'top', portal: true, delayMs: 0, maxWidth: 480 },
              h('span', { className: 'power-dsh-projects-name', tabIndex: 0 }, name)),
            row.path && h(Tooltip, { label: row.path, side: 'top', portal: true, delayMs: 0, maxWidth: 480 },
              h('span', { className: 'power-dsh-projects-path', tabIndex: 0 }, row.path)),
            error?.id === row.workspaceId && errorFeedback({ t, id: `${row.workspaceId}-error`, message: error.message,
              code: 'PD-PROJECTS-ACTION', operation: 'removeProject' }))),
        h('span', { className: 'power-dsh-projects-cell power-dsh-projects-sessions', role: 'cell' },
          t('projectsSessions').replace('{count}', () => String(row.sessionCount))),
        h('span', { className: 'power-dsh-projects-cell power-dsh-projects-activity', role: 'cell' }, activityLabel(row)),
        h('div', { className: 'power-dsh-projects-cell power-dsh-projects-actions', role: 'cell' },
          h('button', {
            type: 'button', className: 'power-dsh-projects-action power-dsh-projects-action-danger',
            'data-remove': row.workspaceId, 'aria-label': `${t('projectsRemove')} ${name}`,
            disabled: disabled || rowBusy, 'aria-busy': rowBusy,
            onClick: () => { if (mounted.current) setConfirming(row); },
          }, t(rowBusy ? 'projectsRemoving' : 'projectsRemove'))));
    };
    return h('section', { className: 'power-dsh-page power-dsh-skills-page power-dsh-projects-page', 'aria-label': t('projectsTab') },
      h('style', null, styles),
      h('header', null,
        h('h2', { className: 'power-dsh-title' }, t('projectsTab')),
        h('p', { className: 'power-dsh-description' }, t('projectsDescription'))),
      snapshot.status === 'loading' && loadingFeedback({ label: t('loading'), compact: Boolean(catalog) }),
      snapshot.status === 'error' && errorFeedback({ t, message: snapshot.error || t('projectsLoadFailed'),
        code: 'PD-PROJECTS-LOAD', operation: 'listProjects', placement: 'page', retry: loadProjects, disabled: busy }),
      h('div', { className: 'power-dsh-skill-panel' },
        catalog && h('div', { className: 'power-dsh-projects-toolbar' },
          h('label', { className: 'power-dsh-skill-search-field' }, h(SkillSearchIcon), h('input', {
            type: 'search', value: query, disabled: busy,
            placeholder: t('projectsSearch'), 'aria-label': t('projectsSearch'),
            onChange: (event: import('react').ChangeEvent<HTMLInputElement>) => { if (mounted.current) setQuery(event.target.value); },
          })),
          select('sort', t('projectsSortLabel'), sortBy, sortOptions,
            value => { if (mounted.current) setSortBy(value as ProjectSort); })),
        catalog && (snapshot.status === 'ready' || snapshot.status === 'loading') && rows.length > 0 && h('div', { className: 'power-dsh-projects-table', role: 'table', 'aria-label': t('projectsTab') },
          h('div', { className: 'power-dsh-projects-head', role: 'row' },
            h('span', { className: 'power-dsh-projects-cell power-dsh-projects-main', role: 'columnheader' }, t('projectsColumnProject')),
            h('span', { className: 'power-dsh-projects-cell power-dsh-projects-sessions', role: 'columnheader' }, t('projectsColumnSessions')),
            h('span', { className: 'power-dsh-projects-cell power-dsh-projects-activity', role: 'columnheader' }, t('projectsColumnActivity')),
            h('span', { className: 'power-dsh-projects-cell power-dsh-projects-actions', role: 'columnheader' }, h('span', { className: 'power-dsh-projects-sr-only' }, t('projectsRemove')))),
          h('ul', { className: 'power-dsh-projects-rows', role: 'rowgroup' }, rows.map(renderRow))),
        catalog && (snapshot.status === 'ready' || snapshot.status === 'loading') && rows.length === 0
          && h('p', { className: 'power-dsh-skill-empty' }, t(query ? 'projectsNoMatches' : 'projectsEmpty'))),
      error && !(catalog?.projects ?? []).some(row => row.workspaceId === error.id)
        && errorFeedback({ t, message: error.message, code: 'PD-PROJECTS-ACTION', operation: 'removeProject', placement: 'page' }),
      confirming && h(Modal, {
        open: true, onClose: () => { if (removing === null) setConfirming(null); },
        title: t('projectsRemoveTitle'), closeLabel: t('close'),
        description: t('projectsRemoveDescription').replace('{name}', () => confirming.title || confirming.path || confirming.workspaceId),
        footer: h(React.Fragment, null,
          h(Button, { variant: 'outline', 'data-modal-autofocus': true, disabled: removing !== null,
            onClick: () => { if (removing === null) setConfirming(null); } }, t('cancel')),
          h(Button, { variant: 'outline', className: 'power-dsh-projects-confirm-remove', disabled: removing !== null,
            onClick: () => { void confirmRemove(confirming.workspaceId); } }, t(removing !== null ? 'projectsRemoving' : 'projectsRemoveConfirm'))),
      }));
  }

  let active = true;
  let projects: FeatureState<ProjectCatalog> = { status: 'loading', value: null, error: '' };
  const projectsSource = observable(() => projects);
  let generation = 0;
  ctx.effect(() => () => { active = false; generation++; });

  const loadProjects = async () => {
    const current = ++generation;
    projects = { ...projects, status: 'loading', error: '' };
    projectsSource.notify();
    try {
      const result = await ctx.remote.powerDsh.listProjects();
      if (!active || current !== generation) return;
      if (!result.ok) throw new Error(result.error.message);
      projects = { status: 'ready', value: result.value, error: '' };
    } catch (failure) {
      if (!active || current !== generation) return;
      projects = { ...projects, status: 'error', error: projectErrorMessage(errorMessage(failure), 'projectsLoadFailed') };
    }
    projectsSource.notify();
  };
  const removeProject = async (workspaceId: string) => {
    const current = ++generation;
    const result = await ctx.remote.powerDsh.removeProject(workspaceId);
    if (!active || current !== generation) return;
    if (!result.ok) {
      await loadProjects();
      throw new Error(result.error.message);
    }
    projects = { status: 'ready', value: result.value, error: '' };
    projectsSource.notify();
  };

  preferenceSlot('projectManagerEnabled', 'settings.section', {
    id: 'power-dsh-projects', order: 54, locale: namespace, label: () => t('projectsTab'),
  }, (props: PageSlotProps) => h(ProjectsPage, { ...props, projectsSource, loadProjects, removeProject }));
  preferenceSlot('projectManagerEnabled', 'settings.section.icon', { id: 'power-dsh-projects' }, ProjectsIcon);
  return {
    settings: [{ field: 'projectManagerEnabled', description: 'projectManagerDescription',
      save: next => savePreference('projectManagerEnabled', next === true, 'projectsOutdated'), hideError: true }],
    api: { projectsSource, loadProjects, removeProject },
  } satisfies ClientFeature;
}
