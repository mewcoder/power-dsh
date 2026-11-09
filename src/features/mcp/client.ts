import { styles as catalogStyles } from '../../shared/client/catalog-styles.ts';
import { createCatalogUI } from '../../shared/client/catalog-ui.ts';
import { errorMessage } from '../../shared/client/runtime.ts';
import { styles as shellStyles } from '../../shared/client/shell-styles.ts';
import type { ClientEnvironment, ClientFeature, ClientRuntime, FeatureState, FormSnapshot, IconProps, PageSlotProps, SnapshotSource, StateDotState } from '../../shared/client/types.ts';
import type { McpCatalog, McpRuntimeState, McpServer } from './rpc.ts';
import { styles as featureStyles } from './styles.ts';
function hasClosest(target: unknown): target is { closest(selectors: string): Element | null } {
  return typeof target === 'object' && target !== null && 'closest' in target && typeof target.closest === 'function';
}

interface McpState extends FeatureState<McpCatalog> { saving: { id: string } | null; }
interface McpPageProps extends PageSlotProps { source: SnapshotSource<FormSnapshot>; mcpSource: SnapshotSource<McpState>; loadMcpServers(background?: boolean): Promise<void>; setMcpServerEnabled(id: string, enabled: boolean): Promise<void>; }
const runtimeDots = { pending: 'ongoing', loading: 'ongoing', unloading: 'ongoing', active: 'done', failed: 'error', inactive: 'idle', disabled: 'idle', unknown: 'idle' } satisfies Record<McpRuntimeState, StateDotState>;

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, Tooltip, StateDot, observable, useSnapshot, useMounted, errorFeedback } = runtime;
  const { ctx, form, source, t, savePreference, preferenceSlot, namespace } = env;
  const styles = shellStyles + catalogStyles + featureStyles;
  const { SkillSearchIcon, SkillChevron } = createCatalogUI(runtime);
  // Lucide Cable, ISC licensed; see docs/third-party-notices.md.
  function McpIcon({ size = 16 }: IconProps) {
    return h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      'aria-hidden': true, focusable: false,
    }, h('path', { d: 'M17 19a1 1 0 0 1-1-1v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1z' }),
    h('path', { d: 'M17 21v-2' }),
    h('path', { d: 'M19 14V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V10' }),
    h('path', { d: 'M21 21v-2' }),
    h('path', { d: 'M3 5V3' }),
    h('path', { d: 'M4 10a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2z' }),
    h('path', { d: 'M7 5V3' }));
  }
  function canChangeMcp(server: McpServer | undefined): server is McpServer {
    return Boolean(server && server.stateKnown && server.canToggle
      && ['profile', 'manager'].includes(server.source) && !server.reason);
  }

  function McpPage({ t, source, mcpSource, loadMcpServers, setMcpServerEnabled }: McpPageProps) {
    const config = useSnapshot(source);
    const snapshot = useSnapshot(mcpSource);
    const catalog = snapshot.value;
    const [query, setQuery] = React.useState('');
    const [groupsOpen, setGroupsOpen] = React.useState({ user: true, builtin: false });
    const [expandedServers, setExpandedServers] = React.useState(() => new Set<string>());
    const [error, setError] = React.useState<{ id: string; message: string } | null>(null);
    const mounted = useMounted();
    const pending = React.useRef(false);
    const id = React.useId();
    const busy = snapshot.status === 'loading' || Boolean(snapshot.saving);
    const writable = config.status === 'ready' && config.writable && config.value?.mcpManagerEnabled === true;
    const disabled = busy || !writable || snapshot.status !== 'ready' || !catalog?.complete;
    React.useEffect(() => {
      void loadMcpServers();
      const refresh = () => { void loadMcpServers(); };
      const timer = window.setInterval(() => {
        const latest = mcpSource.getSnapshot();
        if (!document.hidden && latest.status === 'ready' && !latest.saving) return loadMcpServers(true);
      }, 2000);
      window.addEventListener('focus', refresh);
      return () => {
        window.clearInterval(timer);
        window.removeEventListener('focus', refresh);
      };
    }, []);
    const safeSourceLabel = (value: string) => ({ profile: t('mcpProfileSource'), plugin: t('mcpPluginSource'), manager: t('mcpManagerSource') } as Record<string, string>)[value] || value;
    const typeLabel = (transport: McpServer['transport']) => ({ stdio: t('mcpLocalType'), 'streamable-http': t('mcpHttpType') } as Partial<Record<McpServer['transport'], string>>)[transport] || '';
    const groupLabel = (group: McpServer['group']) => t(group === 'builtin' ? 'skillPreinstalledGroup' : 'skillPersonalGroup');
    const needle = query.trim().toLocaleLowerCase();
    const rows = (catalog?.servers ?? []).filter(server =>
      `${server.name} ${server.tools.join(' ')} ${server.origin} ${server.source} ${safeSourceLabel(server.source)} ${groupLabel(server.group)} ${typeLabel(server.transport)}`.toLocaleLowerCase().includes(needle));
    function contextAvailable() {
      const latest = mcpSource.getSnapshot();
      const config = source.getSnapshot();
      return mounted.current && !pending.current && latest.status !== 'loading' && !latest.saving
        && latest.value === catalog
        && config.status === 'ready' && config.value?.mcpManagerEnabled === true;
    }
    async function toggle(server: McpServer) {
      if (disabled || !contextAvailable() || !canChangeMcp(server)) return;
      pending.current = true;
      setError(null);
      try {
        await setMcpServerEnabled(server.id, !server.enabled);
      } catch (failure) {
        if (mounted.current) setError({ id: server.id, message: errorMessage(failure) || t('mcpChangeFailed') });
      } finally {
        pending.current = false;
      }
    }
    const renderCard = (server: McpServer) => {
      const transportLabel = typeLabel(server.transport);
      const off = server.stateKnown && !server.enabled;
      const displayState = off ? 'disabled' : server.runtimeState;
      const runtimeLabel = ({ pending: 'mcpRuntimePending', loading: 'mcpRuntimeLoading', active: 'mcpRuntimeActive',
        failed: 'mcpRuntimeFailed', unloading: 'mcpRuntimeUnloading', inactive: 'mcpRuntimeInactive', disabled: 'mcpDisabled' } as Partial<Record<string, string>>)[displayState];
      const transitioning = ['pending', 'loading', 'unloading'].includes(displayState);
      const expandable = !off && server.tools.length > 0;
      const expanded = expandable && expandedServers.has(server.id);
      const summary = server.tools.length === 1 ? t('mcpSingleTool')
        : server.tools.length ? t('mcpToolCount').replace('{count}', () => String(server.tools.length)) : t('mcpNoTools');
      const control = `${id}-mcp-${catalog!.servers.indexOf(server)}`;
      const reasonKey = ({ 'preset-managed': 'mcpPresetManaged', 'plugin-managed': 'mcpPluginManaged', 'manager-managed': 'mcpManagerManaged', conditional: 'mcpConditional', unaddressable: 'mcpUnaddressable', 'management-required': 'mcpManagementRequired' } as Record<string, string>)[server.reason];
      const reason = !server.stateKnown ? t('mcpStateUnknown') : reasonKey ? t(reasonKey)
        : !canChangeMcp(server) ? t('mcpReadOnly') : '';
      const describedBy = [reason && `${control}-reason`, error?.id === server.id && `${control}-error`].filter(Boolean).join(' ') || undefined;
      const toggleExpanded = () => {
        const latest = mcpSource.getSnapshot().value?.servers.find(item => item.id === server.id);
        if (!mounted.current || !latest || (latest.stateKnown && !latest.enabled) || latest.tools.length === 0) return;
        setExpandedServers(current => {
          const next = new Set(current);
          if (next.has(server.id)) next.delete(server.id); else next.add(server.id);
          return next;
        });
      };
      return h('li', { key: server.id, className: 'power-dsh-skill-card', 'data-mcp': server.id, 'data-open': expanded, 'aria-labelledby': `${control}-name`, 'aria-describedby': describedBy },
        h('div', { className: 'power-dsh-skill-card-content', 'data-expandable': expandable, onClick: expandable ? (event: import('react').MouseEvent<HTMLDivElement>) => {
          if (event.defaultPrevented || (hasClosest(event.target) && event.target.closest('button, a, input, select, textarea, [role="switch"]'))) return;
          toggleExpanded();
        } : undefined },
          h('div', { className: 'power-dsh-skill-card-main' },
            h(Tooltip, { label: server.name, side: 'top', portal: true, delayMs: 0, maxWidth: 400 },
              h('span', { id: `${control}-name`, className: 'power-dsh-skill-card-title', tabIndex: 0, 'aria-describedby': describedBy }, server.name)),
            server.stateKnown ? h('button', {
              id: control, type: 'button', role: 'switch', className: 'power-dsh-switch',
              'aria-checked': server.enabled, 'aria-labelledby': `${control}-name`,
              'aria-describedby': describedBy, 'aria-busy': snapshot.saving?.id === server.id,
              disabled: Boolean(disabled || !canChangeMcp(server)),
              onClick: () => toggle(server),
            }, h('span', { className: 'power-dsh-switch-thumb', 'aria-hidden': true }))
              : h('span', { className: 'power-dsh-description', 'aria-hidden': true }, '—')),
          (transportLabel || runtimeLabel) && h('div', { className: 'power-dsh-mcp-card-meta' },
            transportLabel && h('span', { id: `${control}-transport`, className: 'power-dsh-mcp-transport', 'data-transport': server.transport }, transportLabel),
            runtimeLabel && h('span', { className: 'power-dsh-mcp-runtime', 'data-state': displayState, role: 'status',
              'aria-label': transitioning ? t(runtimeLabel) : undefined },
              h(StateDot, { state: runtimeDots[displayState] }),
              !transitioning && t(runtimeLabel))),
          expandable ? h('button', {
            type: 'button', className: 'power-dsh-mcp-card-toggle',
            'aria-expanded': expanded, 'aria-controls': `${control}-tools`,
            'aria-labelledby': `${control}-name ${control}-summary`, 'aria-describedby': describedBy,
            onClick: toggleExpanded,
          }, h('span', { id: `${control}-summary`, className: 'power-dsh-mcp-tools-summary' }, summary), h(SkillChevron))
            : h('div', { className: 'power-dsh-mcp-card-placeholder', 'data-state': off ? 'disabled' : 'empty' }, t(off ? 'mcpNoAvailableTools' : 'mcpNoTools')),
          reason && h('p', { id: `${control}-reason`, className: 'power-dsh-skill-reason' }, reason),
          error?.id === server.id && errorFeedback({ t, id: `${control}-error`, message: error.message,
             code: 'PD-MCP-CHANGE', operation: 'setMcpServerEnabled' })),
        expandable && h('div', { id: `${control}-tools`, className: 'power-dsh-mcp-tools', hidden: !expanded, role: 'region', 'aria-labelledby': `${control}-name` },
          expanded && (server.tools.length
            ? h('ul', { 'aria-label': t('mcpTools') }, server.tools.map(tool => h('li', { key: tool, className: 'power-dsh-mcp-tool-name' }, tool)))
            : h('p', null, t('mcpNoTools')))));

    };
    const renderGroup = (group: McpServer['group']) => {
      const selectedRows = rows.filter(server => server.group === group);
      if (selectedRows.length === 0) return null;
      const open = Boolean(needle) || groupsOpen[group];
      const titleId = `${id}-mcp-group-${group}`;
      return h('section', { key: group, className: 'power-dsh-skill-group', 'aria-labelledby': titleId },
        h('div', { className: 'power-dsh-skill-group-header' },
          h('button', {
            id: titleId, type: 'button', className: 'power-dsh-skill-group-toggle',
            'aria-expanded': open, 'aria-controls': `${titleId}-body`,
            onClick: () => { if (!needle) setGroupsOpen(current => ({ ...current, [group]: !current[group] })); },
          }, h(SkillChevron), h('span', { className: 'power-dsh-skill-group-title' }, groupLabel(group)))),
        h('p', { className: 'power-dsh-skill-group-description' }, t(group === 'builtin' ? 'mcpPreinstalledDescription' : 'mcpPersonalDescription')),
        open && h('div', { id: `${titleId}-body`, className: 'power-dsh-skill-group-body' },
          h('ul', { className: 'power-dsh-skill-cards' }, selectedRows.map(renderCard))));
    };
    return h('section', { className: 'power-dsh-page power-dsh-mcp-page', 'aria-label': t('mcpTab') },
      h('style', null, styles),
      h('header', null,
        h('h2', { className: 'power-dsh-title' }, t('mcpTab')),
        h('p', { className: 'power-dsh-description' }, t('mcpDescription'))),
      snapshot.status === 'loading' && h('p', { className: 'power-dsh-notice', role: 'status' }, t('loading')),
      snapshot.error && errorFeedback({ t, message: snapshot.error, code: 'PD-MCP-LOAD',
        operation: 'listMcpServers', placement: 'page', retry: () => loadMcpServers(), disabled: busy }),
      h('div', { className: 'power-dsh-skill-panel' },
      h('div', { className: 'power-dsh-global-search-row' },
      catalog && h('label', { className: 'power-dsh-skill-search-field' }, h(SkillSearchIcon), h('input', {
        type: 'search', value: query, disabled: busy,
        placeholder: t('mcpSearch'), 'aria-label': t('mcpSearch'),
        onChange: (event: import('react').ChangeEvent<HTMLInputElement>) => { if (contextAvailable()) setQuery(event.target.value); },
      }))),

      catalog && !catalog.complete && h('p', { className: 'power-dsh-description power-dsh-skill-notice', role: 'status' }, t('mcpIncomplete')),
      config.status === 'ready' && !config.writable && h('p', { className: 'power-dsh-description power-dsh-skill-notice' }, t('readOnly')),
      error && !catalog?.servers.some(server => server.id === error.id)
        && errorFeedback({ t, message: error.message, code: 'PD-MCP-CHANGE',
          operation: 'setMcpServerEnabled', placement: 'page' }),
      catalog && (['user', 'builtin'] as const).map(renderGroup),
      catalog && snapshot.status === 'ready' && catalog.complete && rows.length === 0
        && h('p', { className: 'power-dsh-skill-empty' }, t(query ? 'mcpNoMatches' : 'mcpEmpty'))));
  }
  let active = true;
  ctx.effect(() => () => { active = false; });
  let mcpCatalog: McpState = { status: 'loading', value: null, error: '', saving: null };
  const mcpSource = observable(() => mcpCatalog);
  let mcpGeneration = 0;
  let mcpWritePending = false;
  let mcpBackgroundPending = false;
  ctx.effect(() => () => { mcpGeneration++; });
  const mcpErrorMessage = (message: string | undefined, fallback: string) => t([
    'mcpLoadFailed', 'mcpProviderInitFailed', 'mcpPluginsLoadFailed', 'mcpBundlesLoadFailed',
    'mcpPresetsLoadFailed', 'mcpProvidersLoadFailed', 'mcpMetadataLoadFailed',
    'mcpChangeFailed', 'mcpRestartRequired', 'mcpChangeOverridden', 'mcpChangeUncertain', 'mcpUnavailable',
  ].includes(message ?? '') ? message! : fallback);
  const mirrorMcpCatalog = (value: McpCatalog) => {
    mcpCatalog = { status: 'ready', value, error: '', saving: null };
  };
  const loadMcpServers = async (background = false) => {
    if (!active || mcpWritePending || background && (mcpBackgroundPending || mcpCatalog.status !== 'ready')) return;
    const generation = ++mcpGeneration;
    if (background) mcpBackgroundPending = true;
    else {
      mcpCatalog = { ...mcpCatalog, status: 'loading', error: '' };
      mcpSource.notify();
    }
    try {
      const result = await ctx.remote.powerDsh.listMcpServers();
      if (!active || generation !== mcpGeneration) return;
      if (!result.ok) throw new Error(result.error.message);
      mirrorMcpCatalog(result.value);
    } catch (failure) {
      if (!active || generation !== mcpGeneration) return;
      mcpCatalog = { ...mcpCatalog, status: 'error', error: mcpErrorMessage(errorMessage(failure), 'mcpLoadFailed') };
    } finally {
      if (background) mcpBackgroundPending = false;
    }
    mcpSource.notify();
  };
  const setMcpServerEnabled = async (id: string, enabled: boolean) => {
    const config = form.getSnapshot();
    if (!active || mcpWritePending || mcpCatalog.status !== 'ready' || !mcpCatalog.value?.complete
      || config.status !== 'ready' || !config.writable || config.value?.mcpManagerEnabled !== true) return;
    const server = mcpCatalog.value.servers.find(candidate => candidate.id === id);
    if (!canChangeMcp(server) || typeof enabled !== 'boolean' || server.enabled === enabled) return;
    const generation = ++mcpGeneration;
    mcpWritePending = true;
    mcpCatalog = { ...mcpCatalog, saving: { id }, error: '' };
    mcpSource.notify();
    try {
      const result = await ctx.remote.powerDsh.setMcpServerEnabled(id, enabled);
      if (!result.ok) throw new Error(result.error.message);
      if (!active || generation !== mcpGeneration) return;
      mirrorMcpCatalog(result.value);
      mcpSource.notify();
    } catch (failure) {
      mcpWritePending = false;
      if (active && generation === mcpGeneration) {
        mcpCatalog = { ...mcpCatalog, saving: null };
        await loadMcpServers();
      }
      throw new Error(mcpErrorMessage(errorMessage(failure), 'mcpChangeFailed'));
    } finally {
      mcpWritePending = false;
    }
  };
  preferenceSlot('mcpManagerEnabled', 'settings.section', {
    id: 'power-dsh-mcp', order: 53, locale: namespace, label: () => t('mcpTab'),
  }, (props: PageSlotProps) => h(McpPage, { ...props, source, mcpSource, loadMcpServers, setMcpServerEnabled }));
  preferenceSlot('mcpManagerEnabled', 'settings.section.icon', { id: 'power-dsh-mcp' }, McpIcon);
  return { settings: [{ field: 'mcpManagerEnabled', description: 'mcpManagerDescription', save: next => savePreference('mcpManagerEnabled', next === true, 'mcpManagerOutdated') }], api: { mcpSource, loadMcpServers, setMcpServerEnabled } } satisfies ClientFeature;
}
