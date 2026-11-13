import { styles as catalogStyles } from '../../shared/client/catalog-styles.ts';
import { createCatalogUI } from '../../shared/client/catalog-ui.ts';
import { errorMessage } from '../../shared/client/runtime.ts';
import { styles as shellStyles } from '../../shared/client/shell-styles.ts';
import type { ClientEnvironment, ClientFeature, ClientRuntime, FeatureState, FormSnapshot, IconProps, PageSlotProps, SnapshotSource } from '../../shared/client/types.ts';
import type { SkillCatalog, SkillDetail, SkillEntry, SkillScope, SkillWorkspace, ExternalSkillCatalog, ExternalSkillEntry, ExternalSkillDetail, SkillImportResult, SkillVariant, SkillImportMode, SkillImportDestination } from './rpc.ts';
import { styles as featureStyles } from './styles.ts';
interface SkillsState extends FeatureState<SkillCatalog> { cwd: string; scope: SkillScope; workspaces: SkillWorkspace[]; saving: { name: string } | null; }
interface DetailState {
  cwd: string;
  name: string;
  status: 'loading' | 'ready' | 'error';
  value: SkillDetail | null;
  error: string;
}
type SkillTab = SkillScope | 'sources';
interface ExternalDetailState {
  id: string;
  cwd: string;
  status: 'loading' | 'ready' | 'error';
  value: ExternalSkillDetail | null;
  error: string;
  entry: ExternalSkillEntry;
}
interface ImportGroup {
  status: 'idle' | 'loading' | 'ready' | 'error';
  catalog: ExternalSkillCatalog | null;
  error: string;
}
interface ImportState {
  groups: Record<string, ImportGroup>;
}
interface WorkspaceGroupState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  catalog: SkillCatalog | null;
  error: string;
}
interface ImportConfirmation {
  entry: ExternalSkillEntry;
  variant: SkillVariant;
  cwd: string;
  targetCwd: string;
  status: 'loading' | 'ready' | 'error';
  destination: SkillImportDestination | null;
  error: string;
}
interface SkillsPageProps extends PageSlotProps { source: SnapshotSource<FormSnapshot>; skillsSource: SnapshotSource<SkillsState>; loadSkills(cwd?: string, scope?: SkillScope): Promise<void>; setSkillEnabled(cwd: string, name: string, enabled: boolean): Promise<SkillCatalog | null>; readSkill(cwd: string, name: string): Promise<SkillDetail | null>; deleteSkill(cwd: string, name: string, revision: string): Promise<SkillCatalog>; listWorkspaceSkills(path: string): Promise<SkillCatalog>; discoverSkills(cwd: string, scope: SkillScope): Promise<ExternalSkillCatalog>; readExternalSkill(cwd: string, id: string): Promise<ExternalSkillDetail | null>; readImportDestination(cwd: string, name: string, flat: boolean): Promise<SkillImportDestination>; importSkills(cwd: string, ids: string[], mode?: SkillImportMode, revision?: string, targetCwd?: string): Promise<SkillImportResult>; }

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, Menu, Modal, Button, Tooltip, MarkdownText, observable, useSnapshot, useMounted, errorFeedback, loadingFeedback } = runtime;
  const { ctx, form, source, t, savePreference, preferenceSlot, namespace } = env;
  const styles = shellStyles + catalogStyles + featureStyles;
  const { SkillSearchIcon, SkillChevron } = createCatalogUI(runtime);
  // Lucide Sparkles, ISC licensed; see docs/third-party-notices.md.
  function SkillsIcon({ size = 16 }: IconProps) {
    return h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      'aria-hidden': true, focusable: false,
    }, h('path', { d: 'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z' }),
    h('path', { d: 'M20 2v4' }),
    h('path', { d: 'M22 4h-4' }),
    h('circle', { cx: 4, cy: 20, r: 2 }));
  }
  function skillSource(source: string) {
    if (source === 'user' || source.startsWith('user-')) return 'skillPersonalSource';
    if (source === 'project' || source.startsWith('project-')) return 'skillProjectSource';
    if (source === 'runtime' || source === 'plugin') return 'skillPluginSource';
    if (source === 'custom') return 'skillCustomSource';
    if (source === 'bundled' || source.startsWith('bundled-')) return 'skillBundledSource';
    return source;
  }


  function SkillsPage({ t, source, skillsSource, loadSkills, setSkillEnabled, readSkill, deleteSkill, listWorkspaceSkills, discoverSkills, readExternalSkill, readImportDestination, importSkills }: SkillsPageProps) {
    const config = useSnapshot(source);
    const snapshot = useSnapshot(skillsSource);
    const catalog = snapshot.value;
    const scope = snapshot.scope || 'user';
    const scopeTabs = React.useRef<Partial<Record<SkillTab, HTMLButtonElement | null>>>({});
    const activeTab = React.useRef<SkillTab>('user');
    const [projectView, setProjectView] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const [error, setError] = React.useState<{ cwd: string; name: string; message: string } | null>(null);
    const [groupsOpen, setGroupsOpen] = React.useState<Partial<Record<'preinstalled' | 'personal', boolean>>>({});
    const [detail, setDetail] = React.useState<DetailState | null>(null);
    const [deleteConfirm, setDeleteConfirm] = React.useState(false);
    const deleteConfirmationRef = React.useRef<DetailState | null>(null);
    const [deleteError, setDeleteError] = React.useState('');
    const [deleting, setDeleting] = React.useState(false);
    const [importView, setImportView] = React.useState(false);
    const [importing, setImporting] = React.useState('');
    const [importNotice, setImportNotice] = React.useState('');
    const [importState, setImportState] = React.useState<ImportState>({ groups: {} });
    const [importGroupsOpen, setImportGroupsOpen] = React.useState<Partial<Record<string, boolean>>>({});
    const [externalDetail, setExternalDetail] = React.useState<ExternalDetailState | null>(null);
    const [pathMenuOpen, setPathMenuOpen] = React.useState(false);
    const [confirmation, setConfirmation] = React.useState<ImportConfirmation | null>(null);
    const confirmationRef = React.useRef<ImportConfirmation | null>(null);
    const [targetMenuOpen, setTargetMenuOpen] = React.useState(false);
    const [workspaceState, setWorkspaceState] = React.useState<Record<string, WorkspaceGroupState>>({});
    const [workspaceOpen, setWorkspaceOpen] = React.useState<Partial<Record<string, boolean>>>({});
    const [workspaceSaving, setWorkspaceSaving] = React.useState<{ cwd: string; name: string } | null>(null);
    const workspaceGeneration = React.useRef<Record<string, number>>({});
    const workspaceOpenRef = React.useRef<Partial<Record<string, boolean>>>({});
    const importGeneration = React.useRef<Record<string, number>>({});
    const mounted = useMounted();
    const pending = React.useRef(false);
    const detailGeneration = React.useRef(0);
    const detailTrigger = React.useRef<HTMLButtonElement | null>(null);
    const id = React.useId();
    const busy = snapshot.status === 'loading' || Boolean(snapshot.saving) || Boolean(workspaceSaving) || importing !== '' || deleting;
    // Workspace and import views are held locally: the workspace tab shows
    // every imported workspace at once, so the catalog scope stays user.
    const tab: SkillTab = importView ? 'sources' : projectView ? 'project' : 'user';
    const writable = config.status === 'ready' && config.writable && config.value?.skillManagerEnabled === true;
    const disabled = busy || !writable || snapshot.status !== 'ready' || !catalog?.complete;
    const workspaces = snapshot.workspaces ?? [];
    React.useEffect(() => {
      if (!importNotice) return;
      const timer = window.setTimeout(() => setImportNotice(''), 3000);
      return () => window.clearTimeout(timer);
    }, [importNotice]);
    React.useEffect(() => {
      workspaceOpenRef.current = Object.fromEntries(workspaces.map(workspace => [workspace.path, workspaceOpen[workspace.path] ?? true]));
    }, [workspaces, workspaceOpen]);
    React.useEffect(() => {
      if (projectView) queueWorkspaceLoads();
    }, [projectView, workspaces]);
    React.useEffect(() => {
      void loadSkills();
      const refresh = () => {
        void loadSkills();
        // Expanded workspace groups re-read their own catalogs on focus.
        if (!pending.current) for (const [path, open] of Object.entries(workspaceOpenRef.current)) {
          if (open && workspaceGeneration.current[path]) void loadWorkspace(path);
        }
      };
      window.addEventListener('focus', refresh);
      return () => window.removeEventListener('focus', refresh);
    }, []);
    const sourceLabel = (value: string) => ['skillPersonalSource', 'skillProjectSource', 'skillPluginSource', 'skillCustomSource', 'skillBundledSource'].includes(value) ? t(value) : value;
    const displaySource = (skill: SkillEntry) => scope === 'user'
      ? ['runtime', 'plugin', 'bundled'].includes(skill.source) || skill.source.startsWith('bundled-') ? 'skillBundledSource' : 'skillPersonalSource'
      : skillSource(skill.source);
    const hasPersonalSkills = (catalog?.skills ?? []).some(skill => displaySource(skill) !== 'skillBundledSource');
    const needle = query.trim().toLocaleLowerCase();
    const rows = (catalog?.skills ?? []).filter(skill =>
      `${skill.name} ${skill.description} ${skill.origin} ${sourceLabel(displaySource(skill))}`.toLocaleLowerCase().includes(needle));
    const TABS: readonly SkillTab[] = ['user', 'project', 'sources'];
    function selectTab(next: SkillTab) {
      if (busy || pending.current || tab === next) return;
      setError(null);
      closeConfirmation();
      closeExternalDetail();
      activeTab.current = next;
      setImportNotice('');
      setImportView(next === 'sources');
      setProjectView(next === 'project');
      if (next === 'sources') void loadImport();
      return undefined;
    }
    function tabButton(value: SkillTab, label: string) {
      return h('button', {
        id: `${id}-scope-${value}`, type: 'button', role: 'tab', className: 'power-dsh-tab',
        ref: (element: HTMLButtonElement | null) => { scopeTabs.current[value] = element; },
        'aria-selected': tab === value, 'aria-controls': `${id}-skill-panel`,
        tabIndex: tab === value ? 0 : -1, disabled: busy,
        onClick: () => selectTab(value),
        onKeyDown: (event: import('react').KeyboardEvent<HTMLButtonElement>) => {
          const index = TABS.indexOf(value);
          const next = event.key === 'Home' ? TABS[0]
            : event.key === 'End' ? TABS[TABS.length - 1]
              : event.key === 'ArrowLeft' ? TABS[(index + TABS.length - 1) % TABS.length]
                : event.key === 'ArrowRight' ? TABS[(index + 1) % TABS.length] : null;
          if (!next || busy || pending.current) return;
          event.preventDefault();
          selectTab(next);
          scopeTabs.current[next]?.focus();
        },
      }, t(label));
    }
    async function toggle(skill: SkillEntry) {
      const latest = skillsSource.getSnapshot();
      if (activeTab.current !== 'user' || disabled || pending.current || !skill.canToggle || skill.reason || latest.scope !== scope || latest.cwd !== catalog?.cwd) return;
      pending.current = true;
      setError(null);
      try {
        await setSkillEnabled('', skill.name, !skill.enabled);
      } catch (failure) {
        if (mounted.current) setError({ cwd: '', name: skill.name, message: errorMessage(failure) || t('skillSaveFailed') });
      } finally {
        pending.current = false;
      }
    }
    // A workspace toggle writes through the group's own catalog and updates it
    // from the read-back result; a failure re-reads the workspace's facts.
    async function toggleWorkspace(cwd: string, skill: SkillEntry) {
      const state = workspaceState[cwd];
      if (activeTab.current !== 'project' || busy || !writable || pending.current || snapshot.status !== 'ready'
        || !skill.canToggle || skill.reason || state?.status !== 'ready' || !state.catalog?.complete) return;
      pending.current = true;
      setError(null);
      setWorkspaceSaving({ cwd, name: skill.name });
      try {
        const catalog = await setSkillEnabled(cwd, skill.name, !skill.enabled);
        if (mounted.current && catalog) setWorkspaceState(current => ({ ...current, [cwd]: { status: 'ready', catalog, error: '' } }));
      } catch (failure) {
        if (mounted.current) {
          setError({ cwd, name: skill.name, message: errorMessage(failure) || t('skillSaveFailed') });
          void loadWorkspace(cwd);
        }
      } finally {
        pending.current = false;
        if (mounted.current) setWorkspaceSaving(null);
      }
    }
    // Adapted from DSH PluginCard (MIT); see docs/third-party-notices.md.
    // `cwd` names the workspace the row belongs to ('' = user scope), so one
    // card shape serves the global tab and every workspace group.
    const renderCard = (skill: SkillEntry, cwd = '', rows: readonly SkillEntry[] = catalog?.skills ?? []) => {
      const group = cwd ? workspaceState[cwd] : null;
      const groupReady = cwd ? group?.status === 'ready' && Boolean(group.catalog?.complete) : Boolean(catalog?.complete);
      const index = rows.indexOf(skill);
      const workspaceIndex = cwd ? Math.max(workspaces.findIndex(row => row.path === cwd), 0) : -1;
      const control = `${id}-skill-${cwd ? `w${workspaceIndex}-${index}` : index}`;
      const identity = JSON.stringify([cwd, skill.name]);
      const reasonKey = ({ 'source-disabled': 'skillSourceDisabled', incomplete: 'skillIncomplete', unsupported: 'skillUnsupported', 'legacy-scope': 'skillLegacyScope', 'link-broken': 'skillLinkBroken', 'managed-unavailable': 'skillManagedUnavailable' } as Record<string, string>)[skill.reason];
      const reason = reasonKey ? t(reasonKey) : skill.reason || !skill.canToggle ? t('skillUnavailable') : '';
      const rowError = error?.cwd === cwd && error?.name === skill.name ? error : null;
      return h('li', { key: identity, className: 'power-dsh-skill-card', 'data-skill': skill.name },
        h('div', { className: 'power-dsh-skill-card-content' },
          h('div', { className: 'power-dsh-skill-card-main' },
            h('span', { id: `${control}-name`, className: 'power-dsh-skill-card-title', title: skill.path || skill.name }, skill.name),
            h('button', {
              id: control, type: 'button', role: 'switch', className: 'power-dsh-switch',
              'aria-checked': skill.enabled, 'aria-labelledby': `${control}-name`,
              'aria-describedby': [skill.description && `${control}-description`, reason && `${control}-reason`, rowError && `${control}-error`].filter(Boolean).join(' ') || undefined,
              'aria-busy': cwd ? workspaceSaving?.cwd === cwd && workspaceSaving.name === skill.name : snapshot.saving?.name === skill.name,
              disabled: Boolean(busy || !writable || snapshot.status !== 'ready' || !groupReady || !skill.canToggle || skill.reason),
              onClick: () => cwd ? toggleWorkspace(cwd, skill) : toggle(skill),
            }, h('span', { className: 'power-dsh-switch-thumb', 'aria-hidden': true }))),
          skill.description && h(Tooltip, { label: skill.description, side: 'top', portal: true, delayMs: 0, maxWidth: 400 },
            h('span', { id: `${control}-description`, className: 'power-dsh-skill-card-description', tabIndex: 0 }, skill.description)),
          reason && h('p', { id: `${control}-reason`, className: 'power-dsh-skill-reason' }, reason),
          rowError && errorFeedback({ t, id: `${control}-error`, message: rowError.message,
             code: 'PD-SKILLS-CHANGE', operation: 'setSkillEnabled' }),
          // The footer pairs where the skill came from with the detail action, so
          // `.dsh` and `.agents` copies are told apart without opening the dialog.
          h('div', { className: 'power-dsh-skill-card-meta' },
            renderOrigin([skill.path], skill.origin),
            h('button', {
              type: 'button', className: 'power-dsh-skill-card-detail', 'data-detail': skill.name,
              'aria-haspopup': 'dialog', 'aria-label': `${t('skillDetail')}: ${skill.name}`,
              'aria-describedby': reason ? `${control}-reason` : undefined,
              onClick: (event: import('react').MouseEvent<HTMLButtonElement>) => {
                detailTrigger.current = event.currentTarget;
                if (mounted.current) void openDetail(skill, cwd);
              },
            }, t('skillDetail')))));
    };
    // Opening loads the skill body once; a stale answer never replaces a newer dialog.
    async function openDetail(skill: Pick<SkillEntry, 'name'>, cwd = '') {
      if (!mounted.current || pending.current) return;
      detailGeneration.current++;
      const generation = detailGeneration.current;
      deleteConfirmationRef.current = null;
      setDeleteConfirm(false);
      setDeleteError('');
      setDetail({ cwd, name: skill.name, status: 'loading', value: null, error: '' });
      try {
        const value = await readSkill(cwd, skill.name);
        if (!mounted.current || generation !== detailGeneration.current) return;
        setDetail({ cwd, name: skill.name, status: 'ready', value, error: '' });
      } catch (failure) {
        if (!mounted.current || generation !== detailGeneration.current) return;
        setDetail({ cwd, name: skill.name, status: 'error', value: null, error: t('skillDetailFailed') });
      }
    }
    // The dialog shows the source file in place: nothing is imported until the
    // user asks for it, so reading here never writes into the DSH directory.
    function variantsOf(entry: ExternalSkillEntry): SkillVariant[] {
      return entry.variants?.length ? entry.variants : [{ id: entry.id, description: entry.description, path: entry.path, flat: entry.flat,
        revision: '', sources: [{ agent: entry.source, path: entry.path, realPath: entry.path, linked: false }] }];
    }
    function pathsOf(entry: ExternalSkillEntry) {
      const sources = entry.sources?.length ? entry.sources : variantsOf(entry).flatMap(variant => variant.sources);
      const paths = [...new Set(sources.map(source => source.path).filter(Boolean))];
      return paths.length ? paths : entry.path ? [entry.path] : [];
    }
    function directoryLabel(path: string) {
      const parts = path.replaceAll('\\', '/').split('/').filter(Boolean);
      const index = parts.lastIndexOf('skills');
      return parts[index > 0 ? index - 1 : parts.length - 2] ?? parts[0] ?? '';
    }
    function renderOrigin(paths: string[], origin = '') {
      const locations = [...new Set(paths.filter(Boolean))];
      const label = origin || directoryLabel(locations[0] ?? '');
      if (!label) return h('span', { className: 'power-dsh-skill-card-origin', 'aria-hidden': true });
      const stacked = locations.length > 1;
      return h(Tooltip, { label: locations.join('\n') || label, side: 'top', portal: true, delayMs: 0, maxWidth: 400 },
        h('span', { className: 'power-dsh-skill-card-origin', tabIndex: 0, 'data-source-count': locations.length,
          'aria-label': stacked ? locations.join('\n') : undefined },
          stacked ? h('span', { className: 'power-dsh-skill-path-stack' }, h('span', { className: 'power-dsh-skill-path-label' }, label)) : label));
    }
    async function openExternalDetail(entry: ExternalSkillEntry, cwd: string, selectedId = '') {
      if (!mounted.current || pending.current) return;
      closeConfirmation();
      const variants = variantsOf(entry);
      const choose = entry.comparison === 'different' && variants.length > 1;
      const selected = selectedId || (choose ? '' : variants[0]!.id);
      const generation = ++detailGeneration.current;
      setPathMenuOpen(false);
      setExternalDetail({ id: selected, entry, cwd,
        status: selected ? 'loading' : 'ready', value: null, error: '' });
      try {
        const value = selected ? await readExternalSkill(cwd, selected) : null;
        if (!mounted.current || generation !== detailGeneration.current) return;
        setExternalDetail({ id: selected, entry, cwd, status: 'ready', value, error: '' });
      } catch (failure) {
        if (!mounted.current || generation !== detailGeneration.current) return;
        setExternalDetail({ id: selected, entry, cwd, status: 'error', value: null,
          error: t('skillDetailFailed') });
      }
    }
    function closeExternalDetail(force = false) {
      if (!mounted.current || pending.current && !force) return;
      detailGeneration.current++;
      setPathMenuOpen(false);
      setExternalDetail(null);
    }
    function closeDetail() {
      if (!mounted.current || pending.current) return;
      detailGeneration.current++;
      deleteConfirmationRef.current = null;
      setDetail(null);
      detailTrigger.current?.focus?.();
    }
    async function confirmDelete(current: DetailState) {
      const deletion = current.value?.deletion;
      if (!mounted.current || pending.current || !writable || busy || !deleteConfirm || !deletion || deleteConfirmationRef.current !== current) return;
      pending.current = true;
      setDeleting(true);
      setDeleteError('');
      try {
        const result = await deleteSkill(current.cwd, current.name, deletion.revision);
        if (!mounted.current) return;
        detailGeneration.current++;
        deleteConfirmationRef.current = null;
        setDetail(null);
        setDeleteConfirm(false);
        if (current.cwd) setWorkspaceState(state => ({ ...state, [current.cwd]: { status: 'ready', catalog: result, error: '' } }));
        await loadSkills();
        await Promise.all(Object.keys(importState.groups).map(path => loadImportGroup(path, true)));
      } catch (failure) {
        if (!mounted.current) return;
        const message = errorMessage(failure) || '';
        deleteConfirmationRef.current = null;
        setDeleteError(t(message.includes('skill-delete-changed') ? 'skillDeleteChanged'
          : message.includes('skill-delete-readback-failed') || message.includes('skill-delete-preferences-failed') ? 'skillDeleteReadbackFailed' : 'skillDeleteFailed'));
        if (current.cwd) void loadWorkspace(current.cwd);
        else void loadSkills();
      } finally {
        pending.current = false;
        if (mounted.current) setDeleting(false);
      }
    }
    function importFailure(value: unknown) {
      const message = typeof value === 'string' ? value : errorMessage(value);
      if (message?.includes('skill-source-changed')) return t('skillStaleSource');
      if (message?.includes('skill-name-conflict')) return t('skillNameConflict');
      if (message?.includes('skill-readback-failed')) return t('skillReadbackFailed');
      return t('skillImportFailed');
    }
    async function loadImportGroup(cwd: string, afterWrite = false) {
      if (!writable || pending.current && !afterWrite) return;
      const generation = (importGeneration.current[cwd] ?? 0) + 1;
      importGeneration.current[cwd] = generation;
      setImportState(current => ({ ...current, groups: { ...current.groups,
        [cwd]: { status: 'loading', catalog: current.groups[cwd]?.catalog ?? null, error: '' } } }));
      try {
        const catalog = await discoverSkills(cwd, cwd ? 'project' : 'user');
        if (!mounted.current || importGeneration.current[cwd] !== generation) return;
        setImportState(current => Object.hasOwn(current.groups, cwd) ? { ...current, groups: { ...current.groups,
          [cwd]: { status: 'ready', catalog, error: '' } } } : current);
      } catch (failure) {
        if (!mounted.current || importGeneration.current[cwd] !== generation) return;
        setImportState(current => Object.hasOwn(current.groups, cwd) ? { ...current, groups: { ...current.groups,
          [cwd]: { status: 'error', catalog: current.groups[cwd]?.catalog ?? null, error: errorMessage(failure) || t('skillImportFailed') } } } : current);
      }
    }
    async function loadImport() {
      if (!writable || pending.current) return;
      const latest = skillsSource.getSnapshot();
      const paths = ['', ...latest.workspaces.map(workspace => workspace.path)];
      setImportState(current => ({ groups: Object.fromEntries(paths.map(path => [path,
        current.groups[path] ?? { status: 'idle', catalog: null, error: '' }])) }));
      await Promise.all(paths.map(path => loadImportGroup(path)));
    }
    function updateConfirmation(value: ImportConfirmation | null) {
      confirmationRef.current = value;
      setConfirmation(value);
    }
    function closeConfirmation() {
      if (pending.current) return;
      updateConfirmation(null);
      setTargetMenuOpen(false);
    }
    async function loadDestination(selection: ImportConfirmation, error = '') {
      const request: ImportConfirmation = { ...selection, status: 'loading', destination: null, error };
      updateConfirmation(request);
      try {
        const destination = await readImportDestination(request.targetCwd, request.entry.name, request.variant.flat);
        if (!mounted.current || confirmationRef.current !== request) return;
        updateConfirmation({ ...request, status: 'ready', destination });
      } catch {
        if (!mounted.current || confirmationRef.current !== request) return;
        updateConfirmation({ ...request, status: 'error', error: error || t('skillImportTargetFailed') });
      }
    }
    function importOne(entry: ExternalSkillEntry, cwd: string, selectedId = '') {
      const group = importState.groups[cwd];
      if (!mounted.current || activeTab.current !== 'sources' || !writable || pending.current || group?.status !== 'ready' || !group.catalog?.complete) return;
      if (entry.available) return;
      if (entry.conflict || entry.comparison === 'unknown') { void openExternalDetail(entry, cwd); return; }
      const variant = selectedId ? variantsOf(entry).find(item => item.id === selectedId) : variantsOf(entry)[0];
      if (!variant) return;
      if (!selectedId && entry.comparison === 'different') { void openExternalDetail(entry, cwd); return; }
      closeExternalDetail();
      setTargetMenuOpen(false);
      void loadDestination({ entry, variant, cwd, targetCwd: cwd, status: 'loading', destination: null, error: '' });
    }
    async function confirmImport(current: ImportConfirmation) {
      if (!mounted.current || confirmationRef.current !== current || pending.current || !writable || activeTab.current !== 'sources'
        || current.status !== 'ready' || !current.destination?.complete || current.destination.available
        || current.targetCwd && !skillsSource.getSnapshot().workspaces.some(workspace => workspace.path === current.targetCwd)) return;
      const { entry, variant, cwd, targetCwd } = current;
      const latest = skillsSource.getSnapshot();
      pending.current = true;
      for (const path of Object.keys(importGeneration.current)) importGeneration.current[path] = (importGeneration.current[path] ?? 0) + 1;
      setImporting(JSON.stringify([cwd, entry.id]));
      setImportNotice('');
      updateConfirmation({ ...current, error: '' });
      try {
        const result = await importSkills(cwd, [variant.id], 'copy', variant.revision, targetCwd);
        if (!mounted.current) return;
        const imported = result.imported.length > 0;
        const reason = result.skipped[0]?.reason;
        if (!imported) throw new Error(reason || 'skill-copy-failed');
        updateConfirmation(null);
        setImportNotice(t('skillImportDone'));
        setImportState(current => {
          const group = current.groups[targetCwd];
          if (!group?.catalog) return current;
          return { ...current, groups: { ...current.groups, [targetCwd]: { ...group,
            catalog: { ...group.catalog, entries: group.catalog.entries.map(item => item.name === entry.name ? { ...item, available: true } : item) } } } };
        });
        await Promise.all(Object.keys(importState.groups).map(path => loadImportGroup(path, true)));
        if (targetCwd && workspaceGeneration.current[targetCwd]) await loadWorkspace(targetCwd);
        await loadSkills(latest.cwd, latest.scope);
      } catch (failure) {
        if (mounted.current) await loadDestination(current, importFailure(failure));
      } finally {
        pending.current = false;
        if (mounted.current) setImporting('');
      }
    }
    async function loadWorkspace(path: string) {
      const generation = (workspaceGeneration.current[path] ?? 0) + 1;
      workspaceGeneration.current[path] = generation;
      setWorkspaceState(current => ({ ...current,
        [path]: { status: 'loading', catalog: current[path]?.catalog ?? null, error: '' } }));
      try {
        const catalog = await listWorkspaceSkills(path);
        if (!mounted.current || workspaceGeneration.current[path] !== generation) return;
        setWorkspaceState(current => ({ ...current, [path]: { status: 'ready', catalog, error: '' } }));
      } catch (failure) {
        if (!mounted.current || workspaceGeneration.current[path] !== generation) return;
        setWorkspaceState(current => ({ ...current,
          [path]: { status: 'error', catalog: current[path]?.catalog ?? null, error: errorMessage(failure) || t('skillLoadFailed') } }));
      }
    }
    function queueWorkspaceLoads() {
      for (const workspace of workspaces) {
        if (!workspaceGeneration.current[workspace.path]) void loadWorkspace(workspace.path);
      }
    }
    const renderImport = () => {
      const current = importState;
      const entryCard = (entry: ExternalSkillEntry, cwd: string) => {
        const busyRow = importing === JSON.stringify([cwd, entry.id]);
        const reason = entry.conflict ? t('skillNameConflict') : entry.available ? t('skillAlreadyExistsHint')
          : entry.comparison === 'unknown' ? t('skillComparisonUnknown') : '';
        return h('li', { key: entry.id, className: 'power-dsh-skill-card', 'data-import': entry.name, 'data-existing': Boolean(entry.available) },
          h('div', { className: 'power-dsh-skill-card-content' },
            h('div', { className: 'power-dsh-skill-card-main' },
              h('span', { className: 'power-dsh-skill-card-title', title: entry.path }, entry.name),
              entry.available && h('span', { className: 'power-dsh-skill-existing', title: reason }, t('skillAlreadyExists'))),
            entry.description && h(Tooltip, { label: entry.description, side: 'top', portal: true, delayMs: 0, maxWidth: 400 },
              h('span', { className: 'power-dsh-skill-card-description', tabIndex: 0 }, entry.description)),
            h('div', { className: 'power-dsh-skill-card-meta' },
              renderOrigin(pathsOf(entry)),
              h('button', {
                type: 'button', className: 'power-dsh-skill-card-detail', 'data-import-detail': entry.name,
                'aria-haspopup': 'dialog', 'aria-label': `${t('skillDetail')}: ${entry.name}`,
                onClick: () => { void openExternalDetail(entry, cwd); },
              }, t('skillDetail')),
              !entry.available && h('button', {
                type: 'button', className: 'power-dsh-skill-card-detail', 'data-import-action': entry.name,
                title: reason || (cwd ? t('skillImportProjectTarget').replace('{path}', cwd) : t('skillImportUserTarget')),
                disabled: importing !== '' || !writable || Boolean(reason) || current.groups[cwd]?.status !== 'ready' || !current.groups[cwd]?.catalog?.complete,
                onClick: () => { void importOne(entry, cwd); },
              }, t(busyRow ? 'skillImporting' : 'skillImportOne')))));
      };
      const group = (cwd: string, title: string, index: number) => {
        const state = current.groups[cwd] ?? { status: 'idle', catalog: null, error: '' };
        const entries = (state.catalog?.entries ?? []).filter(entry =>
          [entry.name, entry.description, entry.source, ...pathsOf(entry), ...variantsOf(entry).map(variant => variant.description)]
            .join(' ').toLocaleLowerCase().includes(needle));
        if (state.status === 'ready' && state.catalog?.complete && entries.length === 0 && !state.error) return null;
        const titleId = `${id}-import-group-${index}`;
        const open = Boolean(needle) || (importGroupsOpen[cwd] ?? true);
        const toggle = () => { if (!needle) setImportGroupsOpen(value => ({ ...value, [cwd]: !(value[cwd] ?? true) })); };
        return h('section', { key: cwd, className: 'power-dsh-skill-group', 'aria-labelledby': titleId, 'data-import-group': cwd ? 'project' : 'user', 'data-import-cwd': cwd },
          h('div', { className: 'power-dsh-skill-group-header' },
            h('button', {
              id: titleId, type: 'button', className: 'power-dsh-skill-group-toggle',
              'aria-expanded': open, 'aria-controls': `${titleId}-body`, onClick: toggle,
            }, h(SkillChevron), h('span', { className: 'power-dsh-skill-group-title', title: cwd || undefined }, title),
            state.catalog?.complete && h('span', { className: 'power-dsh-skill-group-count' }, entries.length))),
          open && h('div', { id: `${titleId}-body`, className: 'power-dsh-skill-group-body' },
            state.status === 'loading' && loadingFeedback({ label: t('loading'), compact: true }),
            state.status === 'error' && errorFeedback({ t, message: state.error, code: 'PD-SKILLS-IMPORT',
              operation: 'discoverExternalSkills', disabled: pending.current, retry: () => { void loadImportGroup(cwd); } }),
            state.catalog && !state.catalog.complete && h('p', { className: 'power-dsh-skill-import-empty-title' }, t('skillIncomplete')),
            entries.length > 0
              && h('ul', { className: 'power-dsh-skill-cards' }, entries.map(entry => entryCard(entry, cwd))),
            state.status !== 'error' && state.error && errorFeedback({ t, message: state.error, code: 'PD-SKILLS-IMPORT',
              operation: 'importExternalSkills' })));
      };
      const groups = [
        group('', t('skillImportUserScope'), 0),
        ...workspaces.map((workspace, index) => group(workspace.path, workspace.title, index + 1)),
      ].filter(Boolean);
      return h(React.Fragment, null,
        groups.length ? groups : h('p', { className: 'power-dsh-skill-empty' }, t(needle ? 'skillNoMatches' : 'skillImportEmptyGroup')));
    };

    const renderWorkspaceGroup = (workspace: SkillWorkspace, index: number) => {
      const state = workspaceState[workspace.path] ?? { status: 'idle', catalog: null, error: '' } as WorkspaceGroupState;
      const titleId = `${id}-workspace-${index}`;
      const open = Boolean(needle) || (workspaceOpen[workspace.path] ?? true);
      const hasFeedback = state.status === 'loading' || state.status === 'error' || Boolean(state.catalog && !state.catalog.complete);
      const groupRows = (state.catalog?.skills ?? []).filter(skill =>
        `${skill.name} ${skill.description} ${skill.origin} ${sourceLabel(skillSource(skill.source))}`.toLocaleLowerCase().includes(needle));
      if (state.status === 'ready' && state.catalog?.complete && groupRows.length === 0) return null;
      return h('section', { key: workspace.path, className: 'power-dsh-skill-group', 'aria-labelledby': titleId, 'data-workspace': workspace.path },
        h('div', { className: 'power-dsh-skill-group-header' },
          h('button', {
            id: titleId, type: 'button', className: 'power-dsh-skill-group-toggle',
            'aria-expanded': open, 'aria-controls': `${titleId}-body`,
            onClick: () => {
              if (needle) return;
              const next = !(workspaceOpen[workspace.path] ?? true);
              setWorkspaceOpen(current => ({ ...current, [workspace.path]: next }));
              if (next && (workspaceState[workspace.path]?.status ?? 'idle') === 'idle') void loadWorkspace(workspace.path);
            },
          }, h(SkillChevron), h('span', { className: 'power-dsh-skill-group-title', title: workspace.path }, workspace.title),
          state.catalog?.complete && h('span', { className: 'power-dsh-skill-group-count' }, groupRows.length))),
        (open || hasFeedback) && h('div', { id: `${titleId}-body`, className: 'power-dsh-skill-group-body' },
          state.status === 'loading' && loadingFeedback({ label: t('loading'), ...(state.catalog ? { compact: true } : {}) }),
          state.status === 'error' && errorFeedback({ t, message: state.error, code: 'PD-SKILLS-LOAD',
            operation: 'listSkills', retry: () => { void loadWorkspace(workspace.path); } }),
          state.catalog && !state.catalog.complete && h('p', { className: 'power-dsh-skill-import-empty-title' }, t('skillIncomplete')),
          open && state.catalog && groupRows.length > 0
            && h('ul', { className: 'power-dsh-skill-cards' }, groupRows.map(skill => renderCard(skill, workspace.path, state.catalog!.skills)))));
    };
    const renderWorkspaces = () => {
      if (workspaces.length === 0) return h('p', { className: 'power-dsh-skill-empty' }, t('skillNoProjects'));
      const groups = workspaces.map(renderWorkspaceGroup).filter(Boolean);
      return groups.length ? groups : h('p', { className: 'power-dsh-skill-empty' }, t(needle ? 'skillNoMatches' : 'skillEmpty'));
    };

    const detailField = (key: string, value: import('react').ReactNode) => h('div', { key, className: 'power-dsh-skill-detail-row' },
      h('dt', { className: 'power-dsh-skill-detail-label' }, t(key)), h('dd', { className: 'power-dsh-skill-detail-value' }, value));
    const renderMetadata = (description: string, path: import('react').ReactNode) => (description || path)
      ? h('dl', { className: 'power-dsh-skill-detail-list' },
        path && detailField('skillDetailPath', path),
        description && detailField('skillDetailDescription', h('p', { className: 'power-dsh-skill-detail-description' }, description))) : null;
    const renderMarkdown = (content: string) => content
      ? h('div', { className: 'power-dsh-skill-detail-markdown' }, h(MarkdownText, {
        text: content, variant: 'compact', omitHtml: true,
        labels: { code: { copyLabel: t('skillCopyCode'), copiedLabel: t('skillCopiedCode') }, footnotes: t('skillFootnotes') },
      }))
      : h('p', { className: 'power-dsh-skill-detail-empty' }, t('skillDetailNoContent'));
    const renderConfirmation = () => {
      const current = confirmation!;
      const targets = [{ path: '', title: t('skillUserScope') }, ...workspaces];
      const target = targets.find(target => target.path === current.targetCwd);
      const canImport = current.status === 'ready' && Boolean(current.destination?.complete) && !current.destination?.available
        && Boolean(target) && !busy && writable;
      return h(Modal, {
        open: true, onClose: closeConfirmation, title: t('skillImportTitle'), closeLabel: t('cancel'),
        className: 'power-dsh-skill-detail power-dsh-skill-import-confirmation', description: current.entry.name,
        footer: h(React.Fragment, null,
          h(Button, { variant: 'outline', 'data-modal-autofocus': true, disabled: importing !== '', onClick: closeConfirmation }, t('cancel')),
          !current.destination?.available && h(Button, { variant: 'outline', className: 'power-dsh-confirm-import', disabled: !canImport,
            onClick: () => { if (canImport) void confirmImport(current); } },
          t(importing ? 'skillImporting' : 'skillImportOne'))),
      }, h('div', { className: 'power-dsh-skill-detail-body' },
        h('dl', { className: 'power-dsh-skill-detail-list' }, detailField('skillImportTo', h(Menu, {
          open: targetMenuOpen, align: 'end', portal: true, autoFocus: true, minWidthFromAnchor: true,
          items: targets.map(target => ({ id: target.path || 'user', label: target.title
            + (targets.filter(other => other.title === target.title).length > 1 ? ` · ${target.path || t('skillUserScope')}` : '') })),
          selectedId: current.targetCwd || 'user', onClose: () => setTargetMenuOpen(false),
          onSelect: (id: string) => {
            if (pending.current || confirmationRef.current !== current) return;
            const targetCwd = id === 'user' ? '' : id;
            if (!targets.some(target => target.path === targetCwd)) return;
            setTargetMenuOpen(false);
            if (targetCwd !== current.targetCwd) void loadDestination({ ...current, targetCwd });
          },
          anchor: h('button', { type: 'button', className: 'power-dsh-skill-target-select', disabled: importing !== '',
            'aria-haspopup': 'menu', 'aria-expanded': targetMenuOpen, 'aria-label': t('skillImportTo'),
            onClick: () => { if (!pending.current) setTargetMenuOpen(open => !open); } },
          target?.title ?? t('skillNoProjects'), h(SkillChevron)),
        }))),
        current.destination && h('code', { className: 'power-dsh-skill-detail-code', 'data-import-destination': true }, current.destination.path),
        current.status === 'loading' && loadingFeedback({ label: t('loading') }),
        current.error && errorFeedback({ t, message: current.error, code: 'PD-SKILLS-IMPORT', placement: 'modal',
          operation: current.status === 'error' ? 'readSkillImportDestination' : 'importSkillTo',
          disabled: pending.current, retry: current.status === 'error' ? () => { void loadDestination(current); } : undefined }),
        current.destination && !current.destination.complete && h('p', { className: 'power-dsh-notice' }, t('skillIncomplete')),
        current.destination?.available && h('p', { className: 'power-dsh-notice' }, t('skillChooseOtherTarget')),
        current.destination?.inherited && !current.destination.available && h('p', { className: 'power-dsh-notice' }, t('skillInheritedHint'))));
    };
    const renderExternalDetail = () => {
      const current = externalDetail!;
      const skill = current.value;
      const variants = variantsOf(current.entry);
      const selected = variants.find(variant => variant.id === current.id);
      const choose = current.entry.comparison === 'different' && variants.length > 1;
      const canAdd = !current.entry.available && !current.entry.conflict && current.entry.comparison !== 'unknown' && current.status === 'ready' && Boolean(skill)
        && (current.entry.variants === undefined || Boolean(selected?.revision)) && !busy && writable;
      const path = choose ? h(Menu, {
        open: pathMenuOpen, align: 'end', portal: true, autoFocus: true, minWidthFromAnchor: true,
        items: variants.map(variant => ({ id: variant.id, label: variant.path })),
        selectedId: current.id,
        onClose: () => setPathMenuOpen(false),
        onSelect: (pathId: string) => {
          setPathMenuOpen(false);
          if (!pending.current && pathId !== current.id && variants.some(variant => variant.id === pathId)) void openExternalDetail(current.entry, current.cwd, pathId);
        },
        anchor: h('button', { type: 'button', className: 'power-dsh-skill-path-select', disabled: importing !== '',
          'aria-haspopup': 'menu', 'aria-expanded': pathMenuOpen, 'aria-label': t('skillChoosePath'),
          onClick: () => { if (!pending.current) setPathMenuOpen(open => !open); } },
          h('code', { className: 'power-dsh-skill-detail-code' }, selected?.path ?? t('skillChoosePath')),
          h(SkillChevron)),
      }) : h('code', { className: 'power-dsh-skill-detail-code' }, pathsOf(current.entry).join('\n'));
      return h(Modal, {
        open: true, onClose: () => closeExternalDetail(), title: t('skillDetailTitle'), closeLabel: t('close'),
        className: 'power-dsh-skill-detail', description: current.entry.name,
        footer: h(React.Fragment, null,
          h(Button, { variant: 'outline', 'data-modal-autofocus': true, disabled: importing !== '', onClick: () => closeExternalDetail() }, t('close')),
          !current.entry.available && h(Button, { variant: 'outline', disabled: !canAdd,
              onClick: () => { if (canAdd) void importOne(current.entry, current.cwd, current.id); } }, t(importing ? 'skillImporting' : 'skillImportOne'))),
      },
      h('div', { className: 'power-dsh-skill-detail-body', tabIndex: 0 },
        importState.groups[current.cwd]?.error && errorFeedback({ t, message: importState.groups[current.cwd]!.error, code: 'PD-SKILLS-IMPORT', placement: 'modal', operation: 'addSkill' }),
        current.entry.conflict && h('p', { className: 'power-dsh-notice' }, t('skillNameConflict')),
        current.entry.comparison === 'unknown' && h('p', { className: 'power-dsh-notice' }, t('skillComparisonUnknown')),
        current.entry.inherited && h('p', { className: 'power-dsh-notice' }, t('skillInheritedHint')),
        renderMetadata(skill?.description ?? (choose ? '' : current.entry.description), path),
        current.status === 'loading' && loadingFeedback({ label: t('skillDetailLoading') }),
        current.status === 'error' && errorFeedback({ t, message: current.error, code: 'PD-SKILLS-DETAIL', placement: 'modal',
          operation: 'readExternalSkill', retry: () => { void openExternalDetail(current.entry, current.cwd, current.id); } }),
        current.status === 'ready' && current.id && skill === null && h('p', { className: 'power-dsh-notice', role: 'status' }, t('skillDetailMissing')),
        current.status === 'ready' && skill && renderMarkdown(skill.content)));
    };
    const renderDetail = () => {
      const current = detail!;
      const skill = current.value;
      const deletion = skill?.deletion;
      const canDelete = Boolean(deletion) && current.status === 'ready' && writable && !busy;
      const deleteLabel = t(deletion?.linked ? 'skillRemoveLink' : 'skillDelete');
      if (deleteConfirm && deletion) return h(Modal, {
        open: true, onClose: () => { if (!pending.current) { deleteConfirmationRef.current = null; setDeleteConfirm(false); } },
        title: deleteLabel, closeLabel: t('cancel'), className: 'power-dsh-skill-detail', description: current.name,
        footer: h(React.Fragment, null,
          h(Button, { variant: 'outline', 'data-modal-autofocus': true, disabled: deleting,
            onClick: () => { if (!pending.current) { deleteConfirmationRef.current = null; setDeleteConfirm(false); } } }, t('cancel')),
          h(Button, { variant: 'outline', className: 'power-dsh-skill-delete', disabled: !canDelete || Boolean(deleteError),
            onClick: () => { if (canDelete) void confirmDelete(current); } }, t(deleting ? 'skillDeleting' : deletion.linked ? 'skillRemoveLink' : 'skillDelete'))),
      }, h('div', { className: 'power-dsh-skill-detail-body' },
        h('p', { className: 'power-dsh-notice' }, t(deletion.linked ? 'skillRemoveLinkHint' : 'skillDeleteHint')),
        h('code', { className: 'power-dsh-skill-detail-code' }, deletion.path),
        deleteError && errorFeedback({ t, message: deleteError, code: 'PD-SKILLS-DELETE', placement: 'modal', operation: 'deleteSkill',
          disabled: deleting, retry: () => { void openDetail({ name: current.name }, current.cwd); } })));
      return h(Modal, {
        open: true, onClose: closeDetail, title: t('skillDetailTitle'), closeLabel: t('close'),
        className: 'power-dsh-skill-detail', description: skill?.name ?? current.name,
        footer: h(React.Fragment, null,
          deletion && h(Button, { variant: 'outline', className: 'power-dsh-skill-delete', disabled: !canDelete,
            onClick: () => { if (canDelete && !pending.current) { deleteConfirmationRef.current = current; setDeleteError(''); setDeleteConfirm(true); } } }, deleteLabel),
          h(Button, { variant: 'outline', 'data-modal-autofocus': true, onClick: closeDetail }, t('close'))),
      },
      current.status === 'loading' && loadingFeedback({ label: t('skillDetailLoading') }),
      current.status === 'error' && errorFeedback({ t, message: current.error, code: 'PD-SKILLS-DETAIL', placement: 'modal',
        operation: 'readSkill', retry: () => { const row = (current.cwd ? workspaceState[current.cwd]?.catalog?.skills : catalog?.skills)?.find(candidate => candidate.name === current.name); if (row) void openDetail(row, current.cwd); } }),
      current.status === 'ready' && skill === null && h('p', { className: 'power-dsh-notice', role: 'status' }, t('skillDetailMissing')),
      current.status === 'ready' && skill && h('div', { className: 'power-dsh-skill-detail-body', tabIndex: 0 },
        renderMetadata(skill.description, skill.path ? h('code', { className: 'power-dsh-skill-detail-code' }, skill.path) : null),
        renderMarkdown(skill.content)));
    };
    const renderGroup = (group: 'preinstalled' | 'personal', label: string, selectedRows: SkillEntry[]) => {
      if (selectedRows.length === 0) return null;
      const defaultOpen = group === 'personal' || !hasPersonalSkills;
      const open = Boolean(needle) || (groupsOpen[group] ?? defaultOpen);
      const titleId = `${id}-group-${group}`;
      return h('section', { key: group, className: 'power-dsh-skill-group', 'aria-labelledby': titleId },
        h('div', { className: 'power-dsh-skill-group-header' },
          h('button', {
            id: titleId, type: 'button', className: 'power-dsh-skill-group-toggle',
            'aria-expanded': open, 'aria-controls': `${titleId}-body`,
            onClick: () => { if (!needle) setGroupsOpen(current => ({ ...current, [group]: !(current[group] ?? defaultOpen) })); },
          }, h(SkillChevron), h('span', { className: 'power-dsh-skill-group-title' }, t(label)),
          catalog?.complete && h('span', { className: 'power-dsh-skill-group-count' }, selectedRows.length))),
        open && h('div', { id: `${titleId}-body`, className: 'power-dsh-skill-group-body' },
          h('ul', { className: 'power-dsh-skill-cards' }, selectedRows.map(skill => renderCard(skill)))));
    };
    return h('section', { className: 'power-dsh-page power-dsh-skills-page', 'aria-label': t('skillsTab') },
      h('style', null, styles),
      h('header', null,
        h('h2', { className: 'power-dsh-title' }, t('skillsTab')),
        h('p', { className: 'power-dsh-description' }, t(tab === 'sources' ? 'skillDiscoverDescription' : 'skillsDescription'))),
      snapshot.status === 'loading' && loadingFeedback({ label: t('loading'), ...(catalog ? { compact: true } : {}) }),
      snapshot.error && errorFeedback({ t, message: snapshot.error, code: 'PD-SKILLS-LOAD',
        operation: 'listSkills', placement: 'page', retry: () => loadSkills(), disabled: busy }),
      h('div', { className: 'power-dsh-skill-navigation' },
        h('div', { className: 'power-dsh-tabs', role: 'tablist', 'aria-label': t('skillScope') },
          tabButton('user', 'skillUserScope'), tabButton('project', 'skillProjectScope'), tabButton('sources', 'skillImport'))),
      h('div', { id: `${id}-skill-panel`, className: 'power-dsh-skill-panel', role: 'tabpanel', 'aria-labelledby': `${id}-scope-${tab}` },
        importNotice && h('div', { className: 'power-dsh-skill-import-notice', role: 'status' },
          importNotice),
        (tab === 'sources' || (tab === 'project' ? workspaces.length > 0 : Boolean(catalog)))
          && h('label', { className: 'power-dsh-skill-search-field' }, h(SkillSearchIcon), h('input', {
            type: 'search', value: query, placeholder: t('skillSearch'), 'aria-label': t('skillSearch'),
            onChange: (event: import('react').ChangeEvent<HTMLInputElement>) => {
              setQuery(event.target.value);
              if (tab === 'project' && event.target.value.trim()) queueWorkspaceLoads();
            },
          })),
        tab === 'user' && catalog && !catalog.complete && h('p', { className: 'power-dsh-description power-dsh-skill-notice', role: 'status' }, t('skillIncomplete')),
        config.status === 'ready' && !config.writable && h('p', { className: 'power-dsh-description power-dsh-skill-notice' }, t('readOnly')),
        tab === 'sources' ? renderImport()
          : tab === 'project' ? renderWorkspaces()
            : catalog && [renderGroup('personal', 'skillPersonalGroup', rows.filter(skill => displaySource(skill) !== 'skillBundledSource')),
              renderGroup('preinstalled', 'skillPreinstalledGroup', rows.filter(skill => displaySource(skill) === 'skillBundledSource'))],
        tab === 'user' && catalog && snapshot.status === 'ready' && catalog.complete && rows.length === 0
          && h('p', { className: 'power-dsh-skill-empty' }, t(query ? 'skillNoMatches' : 'skillEmpty')),
        detail && renderDetail(),
        externalDetail && renderExternalDetail(),
        confirmation && renderConfirmation()));
  }
  let active = true;
  ctx.effect(() => () => { active = false; });
  let skillCatalog: SkillsState = { status: 'loading', value: null, cwd: '', scope: 'user', workspaces: [], error: '', saving: null };
  const skillsSource = observable(() => skillCatalog);
  let skillGeneration = 0;
  let skillWritePending = false;
  let selectedProjectCwd = '';
  ctx.effect(() => () => { skillGeneration++; });
  const loadSkills = async (cwd = '', scope: SkillScope = skillCatalog.scope) => {
    if (!active || skillWritePending) return;
    scope = scope || 'user';
    cwd = scope === 'project' ? cwd || selectedProjectCwd || skillCatalog.cwd : '';
    if (scope === 'project') selectedProjectCwd = cwd;
    const generation = ++skillGeneration;
    const sameContext = scope === skillCatalog.scope && (scope === 'user' || cwd === skillCatalog.cwd);
    skillCatalog = { ...skillCatalog, cwd, scope, value: sameContext ? skillCatalog.value : null, status: 'loading', error: '' };
    skillsSource.notify();
    try {
      const result = await ctx.remote.powerDsh.listSkills(cwd, scope);
      if (!active || generation !== skillGeneration) return;
      if (!result.ok) throw new Error(result.error.message);
      skillCatalog = { status: 'ready', value: result.value, cwd: result.value.cwd, scope: result.value.scope, workspaces: result.value.workspaces, error: '', saving: null };
      if (result.value.scope === 'project') selectedProjectCwd = result.value.cwd;
    } catch (failure) {
      if (!active || generation !== skillGeneration) return;
      skillCatalog = { ...skillCatalog, status: 'error', error: errorMessage(failure) || t('skillLoadFailed') };
    }
    skillsSource.notify();
  };
  // The body is read on demand only; nothing is cached after the dialog closes.
  // An empty cwd reads the user scope; a workspace path reads that project.
  const readSkill = async (cwd: string, name: string): Promise<SkillDetail | null> => {
    if (!active || typeof name !== 'string' || name === '') throw new Error(t('skillUnavailable'));
    const result = await ctx.remote.powerDsh.readSkill(cwd, cwd ? 'project' : 'user', name);
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  };
  const deleteSkill = async (cwd: string, name: string, revision: string): Promise<SkillCatalog> => {
    const config = form.getSnapshot();
    if (!active || skillWritePending || config.status !== 'ready' || !config.writable || config.value?.skillManagerEnabled !== true) throw new Error(t('skillUnavailable'));
    skillWritePending = true;
    try {
      const result = await ctx.remote.powerDsh.deleteSkill(cwd, cwd ? 'project' : 'user', name, revision);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    } finally { skillWritePending = false; }
  };
  // Workspace groups load their own catalogs straight from the same RPC the
  // snapshot uses, so one expanded group never depends on the page's scope.
  const listWorkspaceSkills = async (path: string): Promise<SkillCatalog> => {
    if (!active || typeof path !== 'string' || path === '') throw new Error(t('skillUnavailable'));
    const result = await ctx.remote.powerDsh.listSkills(path, 'project');
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  };
  const discoverSkills = async (cwd: string, scope: SkillScope): Promise<ExternalSkillCatalog> => {
    if (!active || (scope === 'project' && typeof cwd !== 'string')) throw new Error(t('skillUnavailable'));
    const result = await ctx.remote.powerDsh.discoverExternalSkills(scope === 'project' ? cwd : '', scope);
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  };
  const readExternalSkill = async (cwd: string, id: string): Promise<ExternalSkillDetail | null> => {
    if (!active || typeof id !== 'string' || id === '') throw new Error(t('skillUnavailable'));
    const result = await ctx.remote.powerDsh.readExternalSkill(
      cwd, cwd ? 'project' : 'user', id);
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  };
  const readImportDestination = async (cwd: string, name: string, flat: boolean): Promise<SkillImportDestination> => {
    if (!active) throw new Error(t('skillUnavailable'));
    const result = await ctx.remote.powerDsh.readSkillImportDestination(cwd, cwd ? 'project' : 'user', name, flat);
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  };
  const importSkills = async (cwd: string, ids: string[], mode: SkillImportMode = 'copy', revision = '', targetCwd?: string): Promise<SkillImportResult> => {
    const config = form.getSnapshot();
    if (!active || skillWritePending || typeof cwd !== 'string' || config.status !== 'ready' || !config.writable || config.value?.skillManagerEnabled !== true) throw new Error(t('skillUnavailable'));
    if (mode === 'link' && !revision) throw new Error(t('skillLinkFailed'));
    skillWritePending = true;
    try {
      const result = targetCwd !== undefined ? await ctx.remote.powerDsh.importSkillTo(cwd, cwd ? 'project' : 'user', ids[0]!, revision, targetCwd)
        : revision ? await ctx.remote.powerDsh.addSkill(cwd, cwd ? 'project' : 'user', ids[0]!, mode, revision)
        : await ctx.remote.powerDsh.importExternalSkills(cwd, cwd ? 'project' : 'user', ids);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    } finally { skillWritePending = false; }
  };
  const setSkillEnabled = async (cwd: string, name: string, enabled: boolean): Promise<SkillCatalog | null> => {
    const config = form.getSnapshot();
    if (!active || skillWritePending || config.status !== 'ready' || !config.writable || config.value?.skillManagerEnabled !== true) return null;
    // A workspace write belongs to the group's own catalog: the row was
    // validated there, and the read-back result updates that group instead of
    // the user-scope snapshot.
    if (cwd) {
      skillWritePending = true;
      try {
        const result = await ctx.remote.powerDsh.setSkillEnabled(cwd, 'project', name, enabled);
        if (!result.ok) throw new Error(result.error.message);
        return result.value;
      } finally {
        skillWritePending = false;
      }
    }
    if (skillCatalog.status !== 'ready' || !skillCatalog.value?.complete) return null;
    const skill = skillCatalog.value.skills.find(candidate => candidate.name === name);
    if (!skill?.canToggle || skill.reason) return null;
    const { scope } = skillCatalog;
    const context = scope === 'project' ? skillCatalog.cwd : '';
    const generation = ++skillGeneration;
    skillWritePending = true;
    skillCatalog = { ...skillCatalog, saving: { name }, error: '' };
    skillsSource.notify();
    try {
      const result = await ctx.remote.powerDsh.setSkillEnabled(context, scope, name, enabled);
      if (!result.ok) throw new Error(result.error.message);
      if (!active || generation !== skillGeneration) return null;
      skillCatalog = { status: 'ready', value: result.value, cwd: result.value.cwd, scope: result.value.scope, workspaces: result.value.workspaces, error: '', saving: null };
      skillsSource.notify();
    } catch (failure) {
      skillWritePending = false;
      if (active && generation === skillGeneration) {
        skillCatalog = { ...skillCatalog, saving: null };
        await loadSkills(context, scope);
      }
      throw failure;
    } finally {
      skillWritePending = false;
    }
    return null;
  };
  preferenceSlot('skillManagerEnabled', 'settings.section', {
    id: 'power-dsh-skills', order: 52, locale: namespace, label: () => t('skillsTab'),
  }, (props: PageSlotProps) => h(SkillsPage, { ...props, source, skillsSource, loadSkills, setSkillEnabled, readSkill, deleteSkill, listWorkspaceSkills, discoverSkills, readExternalSkill, readImportDestination, importSkills }));
  preferenceSlot('skillManagerEnabled', 'settings.section.icon', { id: 'power-dsh-skills' }, SkillsIcon);
  return { settings: [{ field: 'skillManagerEnabled', description: 'skillManagerDescription', save: next => savePreference('skillManagerEnabled', next === true, 'skillManagerOutdated') }], api: { skillsSource, loadSkills, setSkillEnabled, readSkill, listWorkspaceSkills, discoverSkills, readExternalSkill, importSkills } } satisfies ClientFeature;
}
