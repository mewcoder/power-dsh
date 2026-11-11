import { styles as catalogStyles } from '../../shared/client/catalog-styles.ts';
import { createCatalogUI } from '../../shared/client/catalog-ui.ts';
import { errorMessage } from '../../shared/client/runtime.ts';
import { styles as shellStyles } from '../../shared/client/shell-styles.ts';
import type { ClientEnvironment, ClientFeature, ClientRuntime, FeatureState, FormSnapshot, IconProps, PageSlotProps, SnapshotSource } from '../../shared/client/types.ts';
import type { SkillCatalog, SkillDetail, SkillEntry, SkillScope, SkillWorkspace } from './rpc.ts';
import { styles as featureStyles } from './styles.ts';
interface SkillsState extends FeatureState<SkillCatalog> { cwd: string; scope: SkillScope; workspaces: SkillWorkspace[]; saving: { name: string } | null; }
interface SkillsPageProps extends PageSlotProps { source: SnapshotSource<FormSnapshot>; skillsSource: SnapshotSource<SkillsState>; loadSkills(cwd?: string, scope?: SkillScope): Promise<void>; setSkillEnabled(name: string, enabled: boolean): Promise<void>; readSkill(name: string): Promise<SkillDetail | null>; }

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


  function SkillsPage({ t, source, skillsSource, loadSkills, setSkillEnabled, readSkill }: SkillsPageProps) {
    const config = useSnapshot(source);
    const snapshot = useSnapshot(skillsSource);
    const catalog = snapshot.value;
    const scope = snapshot.scope || 'user';
    const scopeTabs = React.useRef<Partial<Record<SkillScope, HTMLButtonElement | null>>>({});
    const [projectMenuOpen, setProjectMenuOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const [error, setError] = React.useState<{ name: string; message: string } | null>(null);
    const [groupsOpen, setGroupsOpen] = React.useState<Partial<Record<'preinstalled' | 'personal', boolean>>>({});
    const [detail, setDetail] = React.useState<{ name: string; status: 'loading' | 'ready' | 'error'; value: SkillDetail | null; error: string } | null>(null);
    const mounted = useMounted();
    const pending = React.useRef(false);
    const detailGeneration = React.useRef(0);
    const detailTrigger = React.useRef<HTMLButtonElement | null>(null);
    const id = React.useId();
    const busy = snapshot.status === 'loading' || Boolean(snapshot.saving);
    React.useEffect(() => { setProjectMenuOpen(false); }, [scope, busy]);
    const writable = config.status === 'ready' && config.writable && config.value?.skillManagerEnabled === true;
    const disabled = busy || !writable || snapshot.status !== 'ready' || !catalog?.complete;
    React.useEffect(() => {
      void loadSkills();
      const refresh = () => { void loadSkills(); };
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
    function changeScope(next: SkillScope) {
      if (busy || pending.current || scope === next) return;
      setError(null);
      return loadSkills('', next);
    }
    function scopeTab(value: SkillScope, label: string) {
      return h('button', {
        id: `${id}-scope-${value}`, type: 'button', role: 'tab', className: 'power-dsh-tab',
        ref: (element: HTMLButtonElement | null) => { scopeTabs.current[value] = element; },
        'aria-selected': scope === value, 'aria-controls': `${id}-skill-panel`,
        tabIndex: scope === value ? 0 : -1, disabled: busy,
        onClick: () => changeScope(value),
        onKeyDown: (event: import('react').KeyboardEvent<HTMLButtonElement>) => {
          const next = event.key === 'Home' ? 'user' : event.key === 'End' ? 'project'
            : event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? value === 'user' ? 'project' : 'user' : null;
          if (!next || busy || pending.current) return;
          event.preventDefault();
          changeScope(next);
          scopeTabs.current[next]?.focus();
        },
      }, t(label));
    }
    const projectWorkspaces = catalog?.workspaces ?? snapshot.workspaces;
    const projectContext = () => {
      if (scope !== 'project') return null;
      const cwd = catalog?.cwd || snapshot.cwd;
      const values = projectWorkspaces ?? [];
      const selected = values.some(project => project.path === cwd) ? cwd : '';
      const current = values.find(project => project.path === selected);
      return h(Menu, {
        open: projectMenuOpen && !busy && values.length > 0,
        align: 'end', portal: true, autoFocus: true, minWidthFromAnchor: true, className: 'power-dsh-project-menu',
        selectedId: selected || undefined,
        items: values.map(project => ({
          id: project.path,
          label: h('span', { title: project.path }, values.some(other => other.path !== project.path && other.title === project.title)
            ? `${project.title} (${project.path})` : project.title),
        })),
        onClose: () => setProjectMenuOpen(false),
        onSelect: path => {
          setProjectMenuOpen(false);
          const latest = skillsSource.getSnapshot();
          const projects = latest.value?.workspaces ?? latest.workspaces ?? [];
          if (latest.scope !== 'project' || latest.status === 'loading' || latest.saving || pending.current
            || !projects.some(project => project.path === path) || path === latest.cwd) return;
          setError(null);
          return loadSkills(path, 'project');
        },
        anchor: h('button', {
          type: 'button', className: 'power-dsh-project-trigger', disabled: busy || values.length === 0,
          title: current?.path, 'aria-label': t('skillWorkspace'), 'aria-haspopup': 'menu',
          'aria-expanded': projectMenuOpen && !busy && values.length > 0,
          onClick: () => {
            const latest = skillsSource.getSnapshot();
            if (latest.scope !== 'project' || latest.status === 'loading' || latest.saving || pending.current
              || !(latest.value?.workspaces ?? latest.workspaces ?? []).length) return;
            setProjectMenuOpen(open => !open);
          },
        }, h('span', { className: 'power-dsh-project-trigger-label' }, current?.title || t(values.length ? 'skillWorkspace' : 'skillNoProjects')),
        h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: 'm4 6 4 4 4-4' }))),
      });
    };
    async function toggle(skill: SkillEntry) {
      const latest = skillsSource.getSnapshot();
      if (disabled || pending.current || !skill.canToggle || skill.reason || latest.scope !== scope || latest.cwd !== catalog?.cwd) return;
      pending.current = true;
      setError(null);
      try {
        await setSkillEnabled(skill.name, !skill.enabled);
      } catch (failure) {
        if (mounted.current) setError({ name: skill.name, message: errorMessage(failure) || t('skillSaveFailed') });
      } finally {
        pending.current = false;
      }
    }
    // Adapted from DSH PluginCard (MIT); see docs/third-party-notices.md.
    const renderCard = (skill: SkillEntry) => {
      const index = catalog!.skills.indexOf(skill);
      const control = `${id}-skill-${index}`;
      const identity = JSON.stringify([scope, catalog!.cwd, skill.name]);
      const reasonKey = ({ 'source-disabled': 'skillSourceDisabled', incomplete: 'skillIncomplete', unsupported: 'skillUnsupported', 'legacy-scope': 'skillLegacyScope' } as Record<string, string>)[skill.reason];
      const reason = reasonKey ? t(reasonKey) : skill.reason || !skill.canToggle ? t('skillUnavailable') : '';
      return h('li', { key: identity, className: 'power-dsh-skill-card', 'data-skill': skill.name },
        h('div', { className: 'power-dsh-skill-card-content' },
          h('div', { className: 'power-dsh-skill-card-main' },
            h('span', { id: `${control}-name`, className: 'power-dsh-skill-card-title', title: skill.path || skill.name }, skill.name),
            h('button', {
              id: control, type: 'button', role: 'switch', className: 'power-dsh-switch',
              'aria-checked': skill.enabled, 'aria-labelledby': `${control}-name`,
              'aria-describedby': [skill.description && `${control}-description`, reason && `${control}-reason`, error?.name === skill.name && `${control}-error`].filter(Boolean).join(' ') || undefined,
              'aria-busy': snapshot.saving?.name === skill.name,
              disabled: Boolean(disabled || !skill.canToggle || skill.reason), onClick: () => toggle(skill),
            }, h('span', { className: 'power-dsh-switch-thumb', 'aria-hidden': true }))),
          skill.description && h(Tooltip, { label: skill.description, side: 'top', portal: true, delayMs: 0, maxWidth: 400 },
            h('span', { id: `${control}-description`, className: 'power-dsh-skill-card-description', tabIndex: 0 }, skill.description)),
          reason && h('p', { id: `${control}-reason`, className: 'power-dsh-skill-reason' }, reason),
          error?.name === skill.name && errorFeedback({ t, id: `${control}-error`, message: error.message,
             code: 'PD-SKILLS-CHANGE', operation: 'setSkillEnabled' }),
          // The footer holds only the detail action; source and path moved into the dialog.
          h('div', { className: 'power-dsh-skill-card-meta' },
            h('button', {
              type: 'button', className: 'power-dsh-skill-card-detail', 'data-detail': skill.name,
              'aria-haspopup': 'dialog', 'aria-label': `${t('skillDetail')}: ${skill.name}`,
              'aria-describedby': reason ? `${control}-reason` : undefined,
              onClick: (event: import('react').MouseEvent<HTMLButtonElement>) => {
                detailTrigger.current = event.currentTarget;
                if (mounted.current) void openDetail(skill);
              },
            }, t('skillDetail')))));
    };
    // Opening loads the skill body once; a stale answer never replaces a newer dialog.
    async function openDetail(skill: SkillEntry) {
      if (!mounted.current) return;
      detailGeneration.current++;
      const generation = detailGeneration.current;
      setDetail({ name: skill.name, status: 'loading', value: null, error: '' });
      try {
        const value = await readSkill(skill.name);
        if (!mounted.current || generation !== detailGeneration.current) return;
        setDetail({ name: skill.name, status: 'ready', value, error: '' });
      } catch (failure) {
        if (!mounted.current || generation !== detailGeneration.current) return;
        setDetail({ name: skill.name, status: 'error', value: null, error: errorMessage(failure) || t('skillDetailFailed') });
      }
    }
    function closeDetail() {
      if (!mounted.current) return;
      detailGeneration.current++;
      setDetail(null);
      detailTrigger.current?.focus?.();
    }
    // Read-only reader: description and the SKILL.md body, with a short metadata list.
    const renderDetail = () => {
      const current = detail!;
      const skill = current.value;
      const label = (key: string, value: import('react').ReactNode) => h('div', { key, className: 'power-dsh-skill-detail-row' },
        h('dt', { className: 'power-dsh-skill-detail-label' }, t(key)), h('dd', { className: 'power-dsh-skill-detail-value' }, value));
      return h(Modal, {
        open: true, onClose: closeDetail, title: t('skillDetailTitle'), closeLabel: t('close'),
        className: 'power-dsh-skill-detail', description: skill?.name ?? current.name,
        footer: h(Button, { variant: 'outline', 'data-modal-autofocus': true, onClick: closeDetail }, t('close')),
      },
      current.status === 'loading' && loadingFeedback({ label: t('skillDetailLoading') }),
      current.status === 'error' && errorFeedback({ t, message: current.error, code: 'PD-SKILLS-DETAIL',
        operation: 'readSkill', retry: () => { const row = (catalog?.skills ?? []).find(candidate => candidate.name === current.name); if (row) void openDetail(row); } }),
      current.status === 'ready' && skill === null && h('p', { className: 'power-dsh-notice', role: 'status' }, t('skillDetailMissing')),
      current.status === 'ready' && skill && h('div', { className: 'power-dsh-skill-detail-body', tabIndex: 0 },
        (skill.description || skill.path) && h('dl', { className: 'power-dsh-skill-detail-list' },
          skill.path && label('skillDetailPath', h('code', { className: 'power-dsh-skill-detail-code' }, skill.path)),
          skill.description && label('skillDetailDescription', h('p', { className: 'power-dsh-skill-detail-description' }, skill.description))),
        skill.content
          ? h('div', { className: 'power-dsh-skill-detail-markdown' }, h(MarkdownText, {
            text: skill.content, variant: 'compact', omitHtml: true,
            labels: { code: { copyLabel: t('skillCopyCode'), copiedLabel: t('skillCopiedCode') }, footnotes: t('skillFootnotes') },
          }))
          : h('p', { className: 'power-dsh-skill-detail-empty' }, t('skillDetailNoContent'))));
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
          }, h(SkillChevron), h('span', { className: 'power-dsh-skill-group-title' }, t(label)))),
        h('p', { className: 'power-dsh-skill-group-description' }, t(group === 'preinstalled' ? 'skillPreinstalledDescription' : 'skillPersonalDescription')),
        open && h('div', { id: `${titleId}-body`, className: 'power-dsh-skill-group-body' },
          h('ul', { className: 'power-dsh-skill-cards' }, selectedRows.map(renderCard))));
    };
    return h('section', { className: 'power-dsh-page power-dsh-skills-page', 'aria-label': t('skillsTab') },
      h('style', null, styles),
      h('header', null,
        h('h2', { className: 'power-dsh-title' }, t('skillsTab')),
        h('p', { className: 'power-dsh-description' }, t('skillsDescription'))),
      snapshot.status === 'loading' && loadingFeedback({ label: t('loading'), ...(catalog ? { compact: true } : {}) }),
      snapshot.error && errorFeedback({ t, message: snapshot.error, code: 'PD-SKILLS-LOAD',
        operation: 'listSkills', placement: 'page', retry: () => loadSkills(), disabled: busy }),
      h('div', { className: 'power-dsh-skill-navigation' },
        h('div', { className: 'power-dsh-tabs', role: 'tablist', 'aria-label': t('skillScope') },
          scopeTab('user', 'skillUserScope'), scopeTab('project', 'skillProjectScope'))),
      h('div', { id: `${id}-skill-panel`, className: 'power-dsh-skill-panel', role: 'tabpanel', 'aria-labelledby': `${id}-scope-${scope}` },
      h('div', { className: scope === 'project' ? 'power-dsh-project-search-row' : 'power-dsh-global-search-row' },
        scope === 'project' && projectContext(),
        catalog && h('label', { className: 'power-dsh-skill-search-field' }, h(SkillSearchIcon), h('input', {
          type: 'search', value: query, placeholder: t('skillSearch'), 'aria-label': t('skillSearch'),
          onChange: (event: import('react').ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
        }))),

      catalog && !catalog.complete && h('p', { className: 'power-dsh-description power-dsh-skill-notice', role: 'status' }, t('skillIncomplete')),
      config.status === 'ready' && !config.writable && h('p', { className: 'power-dsh-description power-dsh-skill-notice' }, t('readOnly')),
      catalog && (scope === 'project' ? h('ul', { className: 'power-dsh-skill-cards' }, rows.map(renderCard))
        : [renderGroup('personal', 'skillPersonalGroup', rows.filter(skill => displaySource(skill) !== 'skillBundledSource')),
          renderGroup('preinstalled', 'skillPreinstalledGroup', rows.filter(skill => displaySource(skill) === 'skillBundledSource'))]),
      catalog && snapshot.status === 'ready' && catalog.complete && rows.length === 0
        && h('p', { className: 'power-dsh-skill-empty' }, t(scope === 'project' && projectWorkspaces?.length === 0 ? 'skillNoProjects' : query ? 'skillNoMatches' : 'skillEmpty')),
      detail && renderDetail()));
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
  const readSkill = async (name: string): Promise<SkillDetail | null> => {
    if (!active || typeof name !== 'string' || name === '') throw new Error(t('skillUnavailable'));
    const result = await ctx.remote.powerDsh.readSkill(
      skillCatalog.scope === 'project' ? skillCatalog.cwd : '', skillCatalog.scope, name);
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  };
  const setSkillEnabled = async (name: string, enabled: boolean) => {
    const config = form.getSnapshot();
    if (!active || skillWritePending || skillCatalog.status !== 'ready' || !skillCatalog.value?.complete
      || config.status !== 'ready' || !config.writable || config.value?.skillManagerEnabled !== true) return;
    const skill = skillCatalog.value.skills.find(candidate => candidate.name === name);
    if (!skill?.canToggle || skill.reason) return;
    const { scope } = skillCatalog;
    const cwd = scope === 'project' ? skillCatalog.cwd : '';
    const generation = ++skillGeneration;
    skillWritePending = true;
    skillCatalog = { ...skillCatalog, saving: { name }, error: '' };
    skillsSource.notify();
    try {
      const result = await ctx.remote.powerDsh.setSkillEnabled(cwd, scope, name, enabled);
      if (!result.ok) throw new Error(result.error.message);
      if (!active || generation !== skillGeneration) return;
      skillCatalog = { status: 'ready', value: result.value, cwd: result.value.cwd, scope: result.value.scope, workspaces: result.value.workspaces, error: '', saving: null };
      skillsSource.notify();
    } catch (failure) {
      skillWritePending = false;
      if (active && generation === skillGeneration) {
        skillCatalog = { ...skillCatalog, saving: null };
        await loadSkills(cwd, scope);
      }
      throw failure;
    } finally {
      skillWritePending = false;
    }
  };
  preferenceSlot('skillManagerEnabled', 'settings.section', {
    id: 'power-dsh-skills', order: 52, locale: namespace, label: () => t('skillsTab'),
  }, (props: PageSlotProps) => h(SkillsPage, { ...props, source, skillsSource, loadSkills, setSkillEnabled, readSkill }));
  preferenceSlot('skillManagerEnabled', 'settings.section.icon', { id: 'power-dsh-skills' }, SkillsIcon);
  return { settings: [{ field: 'skillManagerEnabled', description: 'skillManagerDescription', save: next => savePreference('skillManagerEnabled', next === true, 'skillManagerOutdated') }], api: { skillsSource, loadSkills, setSkillEnabled, readSkill } } satisfies ClientFeature;
}
