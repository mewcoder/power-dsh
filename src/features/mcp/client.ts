import { styles as catalogStyles } from '../../shared/client/catalog-styles.ts';
import { createCatalogUI } from '../../shared/client/catalog-ui.ts';
import { errorMessage } from '../../shared/client/runtime.ts';
import { styles as shellStyles } from '../../shared/client/shell-styles.ts';
import type { ClientEnvironment, ClientFeature, ClientRuntime, FeatureState, FormSnapshot, IconProps, PageSlotProps, SnapshotSource, StateDotState } from '../../shared/client/types.ts';
import { parseMcpServerDetail, type McpCatalog, type McpRuntimeState, type McpServer, type McpServerDetail } from './rpc.ts';
import { styles as featureStyles } from './styles.ts';
interface McpState extends FeatureState<McpCatalog> { saving: { id: string } | null; }
interface McpDetailState { id: string; status: 'loading' | 'ready' | 'error'; value: McpServerDetail | null; error: string }
interface McpPageProps extends PageSlotProps { source: SnapshotSource<FormSnapshot>; mcpSource: SnapshotSource<McpState>; loadMcpServers(background?: boolean): Promise<void>; setMcpServerEnabled(id: string, enabled: boolean): Promise<void>; readMcpServer(id: string): Promise<McpServerDetail | null>; }
const runtimeDots = { pending: 'ongoing', loading: 'ongoing', unloading: 'ongoing', active: 'done', failed: 'error', inactive: 'idle', disabled: 'idle', unknown: 'idle' } satisfies Record<McpRuntimeState, StateDotState>;
const milliseconds = (value: number) => `${String(value)} ms`;

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, Tooltip, StateDot, Modal, Button, observable, useSnapshot, useMounted, errorFeedback } = runtime;
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

  function McpPage({ t, source, mcpSource, loadMcpServers, setMcpServerEnabled, readMcpServer }: McpPageProps) {
    const config = useSnapshot(source);
    const snapshot = useSnapshot(mcpSource);
    const catalog = snapshot.value;
    const [query, setQuery] = React.useState('');
    const [groupsOpen, setGroupsOpen] = React.useState({ user: true, builtin: false });
    const [error, setError] = React.useState<{ id: string; message: string } | null>(null);
    const [detail, setDetail] = React.useState<McpDetailState | null>(null);
    const mounted = useMounted();
    const pending = React.useRef(false);
    const detailGeneration = React.useRef(0);
    const detailTrigger = React.useRef<HTMLButtonElement | null>(null);
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
    // A mode row's source is `preset:<id>`; the raw id is not user-facing text.
    const safeSourceLabel = (value: string) => value.startsWith('preset:') ? t('mcpPresetSource')
      : ({ profile: t('mcpProfileSource'), plugin: t('mcpPluginSource'), manager: t('mcpManagerSource') } as Record<string, string>)[value] || value;
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
    // Opening reads the declared configuration once; a stale answer never replaces a newer dialog.
    async function openDetail(server: McpServer, trigger: HTMLButtonElement | null) {
      if (!mounted.current) return;
      detailTrigger.current = trigger;
      const generation = ++detailGeneration.current;
      setDetail({ id: server.id, status: 'loading', value: null, error: '' });
      try {
        const value = await readMcpServer(server.id);
        if (!mounted.current || generation !== detailGeneration.current) return;
        setDetail({ id: server.id, status: 'ready', value, error: '' });
      } catch (failure) {
        if (!mounted.current || generation !== detailGeneration.current) return;
        setDetail({ id: server.id, status: 'error', value: null, error: mcpErrorMessage(errorMessage(failure), 'mcpDetailFailed') });
      }
    }
    function closeDetail() {
      if (!mounted.current) return;
      detailGeneration.current++;
      setDetail(null);
      detailTrigger.current?.focus?.();
    }
    const renderCard = (server: McpServer) => {
      const transportLabel = typeLabel(server.transport);
      const off = server.stateKnown && !server.enabled;
      const displayState = off ? 'disabled' : server.runtimeState;
      const runtimeLabel = ({ pending: 'mcpRuntimePending', loading: 'mcpRuntimeLoading', active: 'mcpRuntimeActive',
        failed: 'mcpRuntimeFailed', unloading: 'mcpRuntimeUnloading', inactive: 'mcpRuntimeInactive', disabled: 'mcpDisabled' } as Partial<Record<string, string>>)[displayState];
      const transitioning = ['pending', 'loading', 'unloading'].includes(displayState);
      // Tools are read in the detail dialog, so the card keeps no disclosure of its own.
      // A closed server shows no count even while its tools are still cached.
      const summary = off || server.tools.length === 0 ? '' : server.tools.length === 1 ? t('mcpSingleTool')
        : t('mcpToolCount').replace('{count}', () => String(server.tools.length));
      const control = `${id}-mcp-${catalog!.servers.indexOf(server)}`;
      const reasonKey = ({ 'preset-managed': 'mcpPresetManaged', 'plugin-managed': 'mcpPluginManaged', 'manager-managed': 'mcpManagerManaged', conditional: 'mcpConditional', unaddressable: 'mcpUnaddressable', 'management-required': 'mcpManagementRequired' } as Record<string, string>)[server.reason];
      const reason = !server.stateKnown ? t('mcpStateUnknown') : reasonKey ? t(reasonKey)
        : !canChangeMcp(server) ? t('mcpReadOnly') : '';
      const describedBy = [reason && `${control}-reason`, error?.id === server.id && `${control}-error`].filter(Boolean).join(' ') || undefined;
      return h('li', { key: server.id, className: 'power-dsh-skill-card', 'data-mcp': server.id, 'aria-labelledby': `${control}-name`, 'aria-describedby': describedBy },
        h('div', { className: 'power-dsh-skill-card-content' },
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
          reason && h('p', { id: `${control}-reason`, className: 'power-dsh-skill-reason' }, reason),
          error?.id === server.id && errorFeedback({ t, id: `${control}-error`, message: error.message,
             code: 'PD-MCP-CHANGE', operation: 'setMcpServerEnabled' }),
          // Count and detail share the last row: the count is text, not a disclosure.
          h('div', { className: 'power-dsh-mcp-card-actions' },
            summary && h('span', { id: `${control}-summary`, className: 'power-dsh-mcp-tools-summary' }, summary),
            h('button', {
              type: 'button', className: 'power-dsh-mcp-card-detail', 'data-detail': server.id,
              'aria-haspopup': 'dialog', 'aria-label': `${t('mcpDetail')}: ${server.name}`,
              'aria-describedby': describedBy,
              onClick: () => { void openDetail(server, detailTrigger.current); },
            }, t('mcpDetail')))));
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
    const renderDetail = () => {
      const current = detail!;
      const label = (key: string, value: import('react').ReactNode) => h('div', { key, className: 'power-dsh-mcp-detail-row' },
        h('dt', { className: 'power-dsh-mcp-detail-label' }, t(key)), h('dd', { className: 'power-dsh-mcp-detail-value' }, value));
      const config = current.value?.config ?? null;
      const catalogServer = catalog?.servers.find(row => row.id === current.id) ?? null;
      const server = current.status === 'ready' ? current.value?.server ?? null : catalogServer;
      // Transport and runtime state stay in the dialog: the card's compact second row
      // is easy to miss, and this is where the full picture belongs.
      const off = server?.stateKnown === true && server.enabled === false;
      const transport: McpServer['transport'] = server && server.transport !== 'unknown'
        ? server.transport : config?.transport ?? 'unknown';
      const transportLabel = typeLabel(transport) || t('mcpDetailUnknown');
      // One field set for every server: a closed one reads "Disabled" here rather than
      // dropping the row, so opening a server never changes which fields are shown.
      const runtimeKey = off ? 'mcpDisabled'
        : ({ pending: 'mcpRuntimePending', loading: 'mcpRuntimeLoading', active: 'mcpRuntimeActive',
          failed: 'mcpRuntimeFailed', unloading: 'mcpRuntimeUnloading', inactive: 'mcpRuntimeInactive',
          disabled: 'mcpDisabled' } as Record<string, string>)[server?.runtimeState ?? ''];
      const runtimeLabel = t(runtimeKey ?? 'mcpDetailUnknown');

      const reconnect = config?.reconnect;
      const reconnectParts: string[] = [];
      if (typeof reconnect?.enabled === 'boolean') reconnectParts.push(t(reconnect.enabled ? 'mcpDetailOn' : 'mcpDetailReconnectOff'));
      for (const [key, label] of [['initialDelayMs', 'mcpDetailReconnectInitial'], ['maxDelayMs', 'mcpDetailReconnectMax'], ['maxAttempts', 'mcpDetailReconnectAttempts']] as const) {
        const value = reconnect?.[key];
        if (value !== undefined) reconnectParts.push(`${t(label)}: ${key === 'maxAttempts' ? String(value) : milliseconds(value)}`);
      }
      return h(Modal, {
        open: true, onClose: closeDetail, title: t('mcpDetailTitle'), closeLabel: t('close'),
        className: 'power-dsh-mcp-detail', description: server?.name ?? catalogServer?.name ?? current.id,
        footer: h(Button, { variant: 'outline', 'data-modal-autofocus': true, onClick: closeDetail }, t('close')),
      },
      current.status === 'loading' && h('p', { className: 'power-dsh-notice', role: 'status' }, t('mcpDetailLoading')),
      current.status === 'error' && errorFeedback({ t, message: current.error, code: 'PD-MCP-DETAIL',
        operation: 'readMcpServer', retry: () => { if (server) void openDetail(server, detailTrigger.current); } }),
      current.status === 'ready' && current.value === null
        && h('p', { className: 'power-dsh-notice', role: 'status' }, t('mcpDetailMissing')),
      // One flat list: only what this entry actually declares, then the tools it exposes.
      server && current.status === 'ready' && h('dl', { className: 'power-dsh-mcp-detail-list' },
        label('mcpDetailTransport', transportLabel),
        label('mcpDetailRuntime', runtimeLabel),
        config?.command && label('mcpDetailCommand', h('code', { className: 'power-dsh-mcp-detail-code' }, config.command)),
        label('mcpDetailArgs', config?.args?.length
          ? h('code', { className: 'power-dsh-mcp-detail-code' },
            config.args.map(arg => /[\s"'\\]/.test(arg) || arg === '' ? JSON.stringify(arg) : arg).join(' '))
          : t('mcpDetailNone')),
        config?.cwd && label('mcpDetailCwd', h('code', { className: 'power-dsh-mcp-detail-code' }, config.cwd)),
        config?.url && label('mcpDetailUrl', h('code', { className: 'power-dsh-mcp-detail-code' }, config.url)),
        config?.urlQueryHidden === true && label('mcpDetailUrlHidden', t('mcpDetailUrlHiddenHint')),
        (config?.envKeys.length ?? 0) > 0 && label('mcpDetailEnv', h('span', { className: 'power-dsh-mcp-detail-keys' },
          config!.envKeys.map(key => h('code', { key, className: 'power-dsh-mcp-detail-key' }, key)))),
        (config?.headerKeys.length ?? 0) > 0 && label('mcpDetailHeaders', h('span', { className: 'power-dsh-mcp-detail-keys' },
          config!.headerKeys.map(key => h('code', { key, className: 'power-dsh-mcp-detail-key' }, key)))),
        reconnectParts.length > 0 && label('mcpDetailReconnect', reconnectParts.join(' · ')),
        (config?.expressions.length ?? 0) > 0 && label('mcpDetailExpressions', h('span', { className: 'power-dsh-mcp-detail-keys' },
          config!.expressions.map(key => h('code', { key, className: 'power-dsh-mcp-detail-key' }, key))))),
      // The tool section is always present too. A closed server has no available tools,
      // so it keeps the heading and shows that state instead of hiding the section.
      current.status === 'ready' && server && h('div', { className: 'power-dsh-mcp-detail-tools' },
        h('h3', { className: 'power-dsh-mcp-detail-heading' }, t('mcpTools')),
        !off && server.tools.length
          ? h('ul', { className: 'power-dsh-mcp-detail-tool-list', 'aria-label': t('mcpTools') },
            server.tools.map(tool => h('li', { key: tool, className: 'power-dsh-mcp-tool-name' }, tool)))
          // A closed server has no available tools; an open one simply has none loaded yet.
          : h('p', { className: 'power-dsh-mcp-detail-empty' }, t(off ? 'mcpNoAvailableTools' : 'mcpNoTools'))));
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
        && h('p', { className: 'power-dsh-skill-empty' }, t(query ? 'mcpNoMatches' : 'mcpEmpty')),
      detail && renderDetail()));
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
    'mcpDetailFailed',
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
  // The dialog reads one entry on demand; a read never touches the catalog or a server.
  const readMcpServer = async (id: string): Promise<McpServerDetail | null> => {
    if (!active || typeof id !== 'string' || id === '') throw new Error(t('mcpUnavailable'));
    const result = await ctx.remote.powerDsh.readMcpServer(id);
    // The dialog maps the Host's stable key; this function never localizes it twice.
    if (!result.ok) throw new Error(result.error.message);
    return parseMcpServerDetail(result.value);
  };
  preferenceSlot('mcpManagerEnabled', 'settings.section', {
    id: 'power-dsh-mcp', order: 53, locale: namespace, label: () => t('mcpTab'),
  }, (props: PageSlotProps) => h(McpPage, { ...props, source, mcpSource, loadMcpServers, setMcpServerEnabled, readMcpServer }));
  preferenceSlot('mcpManagerEnabled', 'settings.section.icon', { id: 'power-dsh-mcp' }, McpIcon);
  return { settings: [{ field: 'mcpManagerEnabled', description: 'mcpManagerDescription', save: next => savePreference('mcpManagerEnabled', next === true, 'mcpManagerOutdated') }], api: { mcpSource, loadMcpServers, setMcpServerEnabled, readMcpServer } } satisfies ClientFeature;
}
