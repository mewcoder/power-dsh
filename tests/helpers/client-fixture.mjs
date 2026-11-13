import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const clientBundleUrl = new URL('../../dist/client.js', import.meta.url);
const pluginVersion = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')).version;

let compositionBundle;
async function getCompositionBundle() {
  compositionBundle ||= (async () => {
    const { build } = await import('tsdown');
    const handle = await build({
      config: false, entry: [fileURLToPath(new URL('./client-composition-entry.mjs', import.meta.url))],
      write: false, clean: false, exports: false, report: false, dts: false, minify: false,
      platform: 'browser', format: 'iife', target: 'es2022', globalName: 'PowerDshComposition', logLevel: 'silent',
      define: { __POWER_DSH_VERSION__: JSON.stringify(pluginVersion) },
    });
    try {
      const chunks = handle.bundles.flatMap(bundle => bundle.chunks);
      assert.equal(chunks.length, 1, 'Build the selected Client fixture as one in-memory bundle.');
      assert.equal(chunks[0].type, 'chunk');
      return chunks[0].code;
    } finally {
      for (const bundle of handle.bundles) await bundle[Symbol.asyncDispose]();
    }
  })();
  return compositionBundle;
}

export function skillFixture(overrides = {}) {
  return {
    name: 'code-review', description: 'Review code and boundary cases', source: 'user-dsh', origin: '.dsh', path: '/skills/code-review/SKILL.md',
    enabled: true, modelInvocable: true, userInvocable: true, canToggle: true, reason: '', ...overrides,
  };
}

export function catalogFixture(overrides = {}) {
  return {
    cwd: '', scope: 'user', workspaces: [{ path: '/work/a', title: 'Project Alpha' }, { path: '/work/b', title: 'Project Beta' }], complete: true,
    skills: [skillFixture()], ...overrides,
  };
}

export function mcpFixture(overrides = {}) {
  return { id: 'include:browser', name: 'browser', tools: ['navigate'], source: 'profile', origin: '', group: 'user', enabled: true, stateKnown: true, runtimeState: 'active', transport: 'unknown', canToggle: true, reason: '', ...overrides };
}

export function mcpCatalogFixture(overrides = {}) {
  return { complete: true, servers: [mcpFixture()], ...overrides };
}

export function archiveSessionFixture(overrides = {}) {
  return { sessionId: 's1', title: 'Archived session', workspaceId: 'w1', workspaceTitle: 'Project Alpha', workspacePath: '/work/alpha', updatedAt: 20, createdAt: 100, ...overrides };
}

export function projectRowFixture(overrides = {}) {
  return { workspaceId: 'w1', title: 'Project Alpha', path: '/work/alpha', sessionCount: 3, lastActiveAt: 20, ...overrides };
}

export function projectCatalogFixture(overrides = {}) {
  return { complete: true, projects: [projectRowFixture()], ...overrides };
}

export function archiveCatalogFixture(overrides = {}) {
  return {
    complete: true,
    workspaces: [{ workspaceId: 'w1', title: 'Project Alpha', path: '/work/alpha' }, { workspaceId: 'w2', title: 'Project Beta', path: '/work/beta' }],
    sessions: [archiveSessionFixture()], ...overrides,
  };
}

export function usageSnapshotFixture(overrides = {}) {
  const day = (date, totalTokens, turnCount, toolCallCount, inputTokens, outputTokens, cacheReadTokens, requestCount, activeMs = 0) => ({
    date, totalTokens, turnCount, toolCallCount, inputTokens, outputTokens,
    cacheReadTokens, cacheWriteTokens: 0, requestCount, activeMs,
  });
  const days = (overrides.days ?? [
    day('2026-03-01', 100, 2, 1, 80, 20, 0, 2, 1_800_000),
    day('2026-03-02', 0, 0, 0, 0, 0, 0, 0, 0),
    day('2026-03-03', 400, 3, 5, 300, 60, 40, 3, 3_600_000),
  ]).map(row => ({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, requestCount: 0, activeMs: 0, ...row }));
  const sessionDays = overrides.sessionDays ?? (days.some(row => row.totalTokens || row.turnCount || row.toolCallCount)
    ? [days.filter(row => row.totalTokens || row.turnCount || row.toolCallCount).map(row => row.date)] : []);
  const sum = (rows, field) => rows.reduce((total, row) => total + row[field], 0);
  return {
    complete: overrides.complete ?? true,
    generatedAt: Date.parse('2026-03-03T12:00:00.000Z'),
    timeZone: 'UTC',
    firstDate: days[0]?.date ?? '',
    lastDate: days.at(-1)?.date ?? '',
    summary: {
      totalTokens: sum(days, 'totalTokens'), inputTokens: sum(days, 'inputTokens'), outputTokens: sum(days, 'outputTokens'),
      cacheReadTokens: sum(days, 'cacheReadTokens'), cacheWriteTokens: sum(days, 'cacheWriteTokens'),
      peakDayTokens: 400, longestSessionMs: 3_720_000, currentStreakDays: 1, longestStreakDays: 2,
      activeDays: 2, sessionCount: 1, turnCount: 5, ...overrides.summary,
    },
    days,
    sessionDays,
    dailyModels: overrides.dailyModels ?? [
      { date: '2026-03-01', modelId: 'group/flash', provider: 'magpie', totalTokens: 100, requestCount: 1 },
      { date: '2026-03-03', modelId: 'group/flash', provider: 'magpie', totalTokens: 300, requestCount: 2 },
      { date: '2026-03-03', modelId: 'group/sol', provider: 'magpie', totalTokens: 100, requestCount: 1 },
    ],
    models: overrides.models ?? [
      { modelId: 'group/flash', provider: 'magpie', totalTokens: 400, requestCount: 3 },
      { modelId: 'group/sol', provider: 'magpie', totalTokens: 100, requestCount: 1 },
    ],
  };
}

export async function mount({ featureIds, localeLanguage, restartStatus = { supported: true, running: false, error: '' }, restartReply, desktop = false, themeAvailable = true, updates, rpcError, rpcReply, formReply, formLoad, fileText = '', fileReply, fileReadError, wallpaper, wallpaperReply, wallpaperReadError, wallpaperClearError, skillCatalog, skillList, skillReply, skillReadError, skillDetail, skillDetailReply, skillDetailError, externalSkillCatalog, externalSkillList, externalSkillReply, externalDetailReply, importDestinationReply, mcpCatalog, mcpList, mcpReply, mcpReadError, mcpDetail, mcpDetailReply, mcpDetailError, mcpProbe, mcpProbeReply, mcpProbeError, archiveCatalog, archiveList, archiveReply, archiveReadError, usageSnapshot, usageList, usageReply, usageReadError, projectCatalog, projectList, projectReply, projectReadError, writable = true, reload = () => {}, windows = false, notificationPermission = 'granted', notificationRequest, notificationFailure = false, notificationServices = true, notificationsAvailable = true, nativeNotificationReply, nativeClearReply, notificationTransportReply, platformMarker = true, localConnection = true, soundCatalog, soundReply, soundListError, updateFetch, updateStorage, modelDirectory, modelSelectReply, modelDirectoriesAvailable = true } = {}) {
  let plugin;
  const nativeLauncher = { native: true };
  const entries = new Map([['settings.launcher:single', nativeLauncher]]);
  const dictionaries = new Map();
  const listeners = new Set();
  const effects = [];
  const themeListeners = new Set();
  const connectionListeners = new Set();
  const connectionStateListeners = new Set();
  let connectionState = 'connected';
  const timers = new Map();
  let timerId = 0;
  let connectionGeneration = { id: 1 };
  const sessionListeners = new Set();
  const statusListeners = new Set();
  let sessionList = { ids: [], byId: {}, phase: 'ready', projectionsBySession: {} };
  let sessionStatus = new Map();
  let documentHidden = true;
  let documentFocused = false;
  let windowFocusCount = 0;
  const notifications = [];
  const nativeNotifications = [];
  const nativeClears = [];
  const soundPlays = [];
  const restartCalls = [];
  let soundLists = 0;
  let permissionRequests = 0;
  class FakeNotification {
    static permission = notificationPermission;
    static async requestPermission() {
      permissionRequests++;
      this.permission = notificationRequest ? await notificationRequest() : 'granted';
      return this.permission;
    }
    constructor(title, options) {
      if (notificationFailure) throw new Error('Delivery unavailable');
      this.title = title;
      this.options = options;
      this.closed = false;
      this.popupSuppressed = windows && Boolean(options.tag)
        && notifications.some(notification => notification.options.tag === options.tag);
      notifications.push(this);
      queueMicrotask(() => { if (!this.closed) this.onshow?.(); });
    }
    close() { this.closed = true; this.onclose?.(); }
  }
  const resizeListeners = new Set();
  const focusListeners = new Set();
  const blurListeners = new Set();
  const doubleClickListeners = new Set();
  const intervals = new Map();
  let intervalId = 0;
  const chromeListeners = new Set();
  // Modal layers a test declares as open; the real host marks every dialog with
  // aria-modal="true", which the background panel watches to step aside.
  let modalLayers = 0;
  const bodyObservers = new Set();
  const menuResizeListeners = new Set();
  let menuRect = null;
  const menuElement = { getBoundingClientRect: () => menuRect };
  const hookScopes = new Map();
  let hookStates;
  let hookEffects;
  function renderComponent(wrapped) {
    if (!hookScopes.has(wrapped.type)) hookScopes.set(wrapped.type, { states: [], effects: [] });
    const scope = hookScopes.get(wrapped.type);
    hookStates = scope.states;
    hookEffects = scope.effects;
    cursor = 0;
    return wrapped.type(wrapped.props);
  }
  let settingsOpen = true;
  let settingsCloses = 0;
  let settingsOpens = 0;
  function disposeComponent(type) {
    hookScopes.get(type)?.effects.forEach(effect => effect?.dispose?.());
    hookScopes.delete(type);
  }
  function closeSettings() {
    settingsOpen = false;
    settingsCloses++;
    const page = entries.get('settings.section:power-dsh')?.component({ t: key => key });
    if (page) disposeComponent(page.type);
  }
  let cursor = 0;
  let observeCount = 0;
  let disconnectCount = 0;
  let edge = 280;
  let settings = { status: 'ready', writable, value: { notificationMode: 'background', blockDoubleClickRename: false, notificationsEnabled: false, notificationSoundEnabled: true, notificationSound: 'default', blockTodo: false, blockPlan: false, blockGoal: false, showThemeSwitcher: false, personalizationEnabled: false, skillManagerEnabled: false, mcpManagerEnabled: false, globalPrompt: '', thinkingEffortGlyph: 'arc', flowingBackgroundKind: 'pattern', flowingBackgroundOpacity: 100, flowingBackgroundBlur: 0, autoArchiveDays: 0 } };
  let theme = { preference: 'system' };
  const calls = [];
  const rpcCalls = [];
  const fileWrites = [];
  const skillReads = [];
  const skillDetailReads = [];
  const skillWrites = [];
  const skillDeletes = [];
  let skillValue = skillCatalog ?? catalogFixture();
  const externalReads = [];
  const externalImports = [];
  const externalDetailReads = [];
  const importDestinationReads = [];
  let externalValue = externalSkillCatalog ?? { complete: true, entries: [] };
  const externalAvailability = new Set();
  const skillView = (cwd, scope = 'user') => ({
    ...skillValue, cwd: scope === 'project' ? cwd || skillValue.cwd || skillValue.workspaces[0]?.path || '' : '', scope: scope || 'user',
    skills: skillValue.skills.filter(skill => {
      const project = skill.source === 'project' || skill.source.startsWith('project-');
      return (scope === 'project' ? project : !project) && (skill.targetCwd === undefined || skill.targetCwd === cwd);
    }),
  });
  const mcpReads = [];
  const mcpDetailReads = [];
  const mcpWrites = [];
  const mcpProbes = [];
  let mcpValue = mcpCatalog ?? mcpCatalogFixture();
  const mcpView = () => ({ ...mcpValue });
  const archiveReads = [];
  const archiveWrites = [];
  let archiveValue = archiveCatalog ?? archiveCatalogFixture();
  const archiveView = () => ({ ...archiveValue, sessions: [...archiveValue.sessions], workspaces: [...archiveValue.workspaces] });
  const projectReads = [];
  const projectWrites = [];
  let projectValue = projectCatalog ?? projectCatalogFixture();
  const projectView = () => ({ ...projectValue, projects: [...projectValue.projects] });
  const usageReads = [];
  let usageValue = usageSnapshot ?? usageSnapshotFixture();
  const usageView = () => structuredClone(usageValue);
  const effortSelects = [];
  const effortSessions = [];
  const effortListeners = new Set();
  let effortState = modelDirectory ?? {
    current: { provider: 'deepseek-official', model: 'deepseek-v4-pro' },
    groups: [{ id: 'deepseek-official', models: [{ id: 'deepseek-v4-pro', reasoning: {
      efforts: [{ id: 'off', name: 'Off' }, { id: 'low', name: 'Low' }, { id: 'high', name: 'High' }, { id: 'max', name: 'Max' }],
    } }] }],
    status: 'ready', error: null,
  };
  const effortDirectory = {
    store: {
      getSnapshot: () => effortState,
      subscribe(listener) { effortListeners.add(listener); return () => effortListeners.delete(listener); },
    },
    async load() { return effortState; },
    async select(selection) {
      effortSelects.push(selection);
      const reply = modelSelectReply ? await modelSelectReply(selection) : { ok: true };
      if (!reply.ok) return reply;
      effortState = {
        ...effortState, status: 'ready',
        current: {
          provider: selection.provider, model: selection.model,
          ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort }),
        },
      };
      effortListeners.forEach(listener => listener());
      return reply;
    },
  };
  let fileVersion = 1;
  const fileValue = () => ({ path: '/test-dsh-home/AGENTS.md', text: fileText, revision: fileVersion.toString(16).padStart(64, '0') });
  let wallpaperValue = wallpaper ?? null;
  const wallpaperWrites = [];
  let rpcDescriptors = [];
  function FakeMenu(props) {
    return { type: 'native-menu-fixture', props: { ...props, children: [props.anchor,
      props.open ? { type: 'div', props: { role: 'menu', children: props.items.map(item => ({ type: 'button', props: {
        role: 'menuitem', 'data-id': item.id, disabled: Boolean(item.disabled),
        'aria-current': props.selectedId === item.id, onClick: () => props.onSelect(item.id), children: [item.label],
      } })) } } : null,
    ] } };
  }
  function FakeTooltip(props) {
    return { type: 'native-tooltip-fixture', props };
  }
  function FakeMarkdownText(props) {
    return { type: 'native-markdown-fixture', props: { ...props, children: [props.text] } };
  }
  function FakeStateDot(props) {
    return { type: 'native-state-dot-fixture', props };
  }
  function FakeModal(props) {
    return props.open ? { type: 'native-modal-fixture', props: { ...props, role: 'dialog', 'aria-modal': true,
      children: [props.description, props.children, props.footer] } } : null;
  }
  function FakeMenuSurface(props) {
    let open = false;
    props.ref?.({ matches: () => open, showPopover() { open = true; } });
    return { type: 'native-menu-surface-fixture', props };
  }
  function FakeButton(props) {
    return { type: 'button', props: { ...props, 'data-native-button': true } };
  }
  let focusedElementId = null;
  let filePickerOpens = 0;
  const React = {
    Fragment: 'fragment',
    createElement(type, props, ...children) {
      if (type === FakeModal) return FakeModal({ ...props, children });
      if (type === FakeMenuSurface) return FakeMenuSurface({ ...props, children });
      if (type === FakeButton) return FakeButton({ ...props, children });
      if (type === FakeMenu) return FakeMenu(props);
      if (type === FakeStateDot) return FakeStateDot({ ...props, children });
      if (type === FakeTooltip) return FakeTooltip({ ...props, children });
      if (type === FakeMarkdownText) return FakeMarkdownText(props);
      if (typeof props?.ref === 'function') props.ref({ focus() { focusedElementId = props.id; } });
      if (type === 'input' && props?.type === 'file' && props.ref && typeof props.ref === 'object') {
        props.ref.current = { click() { filePickerOpens++; } };
      }
      return { type, props: { ...props, children } };
    },
    useId: () => 'settings-test',
    useEffect(fn, deps) { return this.useLayoutEffect(fn, deps); },
    // React compares snapshots by identity and re-renders forever on a fresh object;
    // mirror that contract so an unstable getSnapshot fails here instead of in the GUI.
    useSyncExternalStore: (_subscribe, get) => {
      const first = get();
      const second = get();
      if (first !== null && typeof first === 'object' && first !== second) {
        throw new Error('The result of getSnapshot should be cached');
      }
      return first;
    },
    useMemo(factory, deps) {
      const id = cursor++;
      const previous = hookStates[id];
      if (previous && deps.every((value, index) => value === previous.deps[index])) return previous.value;
      const value = factory();
      hookStates[id] = { deps, value };
      return value;
    },
    useState(init) {
      const id = cursor++;
      if (!(id in hookStates)) hookStates[id] = typeof init === 'function' ? init() : init;
      const states = hookStates;
      return [states[id], value => { states[id] = typeof value === 'function' ? value(states[id]) : value; }];
    },
    useRef(initial) {
      const id = cursor++;
      return hookStates[id] ||= { current: initial ?? {
        getBoundingClientRect: () => ({ right: edge }),
        // Mirrors the real footer seat: the appearance entry is a sibling seat
        // that only exists while its preference is on.
        parentElement: {
          querySelector: selector => selector === '.power-dsh-appearance-button'
            && settings.value?.showThemeSwitcher === true ? { getBoundingClientRect: () => ({}) } : null,
        },
      } };
    },
    useLayoutEffect(fn, deps) {
      const id = cursor++;
      const previous = hookEffects[id];
      if (previous && deps.every((value, index) => value === previous.deps[index])) return;
      previous?.dispose?.();
      hookEffects[id] = { deps, dispose: fn() };
    },
  };
  // The host marks dialogs with aria-modal="true"; the fixture exposes that
  // contract so the background panel can observe it going from closed to open.
  const documentStub = {
    baseURI: 'https://dsh.example/app/',
    get hidden() { return documentHidden; },
    hasFocus: () => documentFocused,
    body: {},
    documentElement: { hasAttribute: name => platformMarker && windows && name === 'data-windows-titlebar', getAttribute: () => !platformMarker ? null : windows ? 'win32' : desktop ? 'darwin' : null },
    querySelector(selector) {
      if (selector === '[aria-modal="true"]') return modalLayers > 0 ? menuElement : null;
      assert.equal(selector, '[data-windows-menu]');
      return menuRect ? menuElement : null;
    },
    querySelectorAll(selector) {
      if (selector === '[aria-modal="true"]') return modalLayers > 0 ? [menuElement] : [];
      return [];
    },
  };
  const context = vm.createContext({
    URL,
    AbortController, AbortSignal,
    fetch: updateFetch || (() => assert.fail('Updates must not request the network without a user action.')),
    // Minimal reader so the wallpaper picker can be exercised without a real File API.
    FileReader: class {
      constructor() { this.result = null; this.onerror = null; this.onload = null; }
      readAsDataURL(file) {
        this.result = file.dataUrl;
        if (file.dataUrl) this.onload?.();
        else this.onerror?.(new Error('read failed'));
      }
    },
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; }
      observe(element) { observeCount++; if (element === menuElement) menuResizeListeners.add(this.callback); }
      unobserve(element) { if (element === menuElement) menuResizeListeners.delete(this.callback); }
      disconnect() { disconnectCount++; menuResizeListeners.delete(this.callback); }
    },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      // Only observers watching the document root count as chrome geometry; the
      // background panel watches the body for modal layers and must not register.
      observe(target) {
        if (target === documentStub.documentElement) chromeListeners.add(this.callback);
        else if (target === documentStub.body) bodyObservers.add(this.callback);
      }
      disconnect() { chromeListeners.delete(this.callback); bodyObservers.delete(this.callback); }
    },
    document: documentStub,
    window: {
      sessionStorage: updateStorage,
      setTimeout(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId; },
      clearTimeout(id) { timers.delete(id); },
      Notification: notificationsAvailable ? FakeNotification : undefined,
      focus() { windowFocusCount++; },
      __DSH_BOOT__: { release: { version: '0.2.2-rc.1' } },
      dshDesktop: updates || desktop ? { protocolVersion: 1, updates } : undefined,
      location: { reload, protocol: desktop ? 'dsh-app:' : 'http:' },
      confirm() { assert.fail('Restart confirmation must use the shared DSH modal.'); },
      setInterval(fn, ms) { const id = ++intervalId; intervals.set(id, { fn, ms }); return id; },
      clearInterval(id) { intervals.delete(id); },
      addEventListener(name, fn, capture) {
        if (name === 'dblclick') assert.equal(capture, true, 'Block before the native React title handler.');
        (name === 'focus' ? focusListeners : name === 'blur' ? blurListeners : name === 'dblclick' ? doubleClickListeners : resizeListeners).add(fn);
      },
      removeEventListener(name, fn, capture) {
        if (name === 'dblclick') assert.equal(capture, true);
        (name === 'focus' ? focusListeners : name === 'blur' ? blurListeners : name === 'dblclick' ? doubleClickListeners : resizeListeners).delete(fn);
      },
      __ModuleLoader__: { load(value) { plugin = value.factory(specifier => {
        if (specifier === 'react') return React;
        assert.equal(specifier, '@deepseek-ai/dsh-client-ui-primitives');
        return { Menu: FakeMenu, MenuSurface: FakeMenuSurface, Tooltip: FakeTooltip, StateDot: FakeStateDot, Modal: FakeModal, Button: FakeButton, MarkdownText: FakeMarkdownText };
      }); } },
    },
  });
  vm.runInContext(await readFile(clientBundleUrl, 'utf8'), context);
  if (featureIds) {
    vm.runInContext(await getCompositionBundle(), context);
    const { createClient, clientFeatures } = context.PowerDshComposition;
    plugin = createClient(React, { Menu: FakeMenu, MenuSurface: FakeMenuSurface, Tooltip: FakeTooltip, StateDot: FakeStateDot, Modal: FakeModal, Button: FakeButton, MarkdownText: FakeMarkdownText },
      clientFeatures.filter(feature => featureIds.includes(feature.definition.id)));
  }
  const form = {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => settings,
    async set(field, value) {
      if (formReply && !await formReply(field, value)) return false;
      settings = { ...settings, value: { ...settings.value, [field]: value } };
      listeners.forEach(listener => listener());
      return true;
    },
  };
  const connection = { isLoopback: localConnection, state: {
    getSnapshot: () => connectionState,
    subscribe(fn) { connectionStateListeners.add(fn); return () => connectionStateListeners.delete(fn); },
  }, generation: {
    getSnapshot: () => connectionGeneration,
    subscribe(fn) { connectionListeners.add(fn); return () => connectionListeners.delete(fn); },
  } };
  const ctx = {
    remote: {
      async $mount(contribution) { rpcDescriptors = contribution.descriptors; },
    },
    modelDirectories: modelDirectoriesAvailable ? {
      directoryFor(sessionId) { effortSessions.push(sessionId); return effortDirectory; },
    } : undefined,
    get connection() { throw new Error('cannot get property "connection" without inject'); },
    sessions: { list: {
      getSnapshot: () => sessionList,
      subscribe(fn) { sessionListeners.add(fn); return () => sessionListeners.delete(fn); },
    } },
    uiSession: { sessionStatus: {
      getSnapshot: () => sessionStatus,
      subscribe(fn) { statusListeners.add(fn); return () => statusListeners.delete(fn); },
    } },
    inject(dependencies, fn) {
      if (dependencies.includes('sessions') && !notificationServices) return;
      if (dependencies.includes('theme') && !themeAvailable) return;
      if (dependencies.includes('remote.powerDsh')) {
        ctx.remote.powerDsh = Object.fromEntries(rpcDescriptors.map(descriptor => [descriptor.method, async (...rpcArgs) => {
          const [blocked, revision, name, enabled] = rpcArgs;
          const third = rpcArgs[2];
          if (descriptor.method === 'readPluginRelease') return { ok: true, value: { status: 'ready', version: '0.0.999', commit: 'a'.repeat(40) } };
          if (descriptor.method === 'pluginRuntimeVersion') return { ok: true, value: pluginVersion };
          if (descriptor.method === 'notificationTransport') return notificationTransportReply ? await notificationTransportReply() : {
            ok: true, value: { platform: windows ? 'win32' : 'darwin', nativeAvailable: windows, version: pluginVersion },
          };
          if (descriptor.method === 'restartStatus') return { ok: true, value: restartStatus };
          if (descriptor.method === 'restartApp' || descriptor.method === 'restartAfterUpdate') {
            restartCalls.push(descriptor.method === 'restartAfterUpdate' ? ['after-update'] : []);
            return restartReply ? await restartReply() : { ok: true, value: { accepted: true } };
          }
          if (descriptor.method === 'showWindowsNotification') {
            nativeNotifications.push(blocked);
            return nativeNotificationReply ? await nativeNotificationReply(blocked) : { ok: true, value: { shown: true } };
          }
          if (descriptor.method === 'clearWindowsNotifications') {
            nativeClears.push({ group: blocked, tag: revision });
            return nativeClearReply ? await nativeClearReply(blocked, revision) : { ok: true, value: { cleared: true } };
          }
          if (descriptor.method === 'listSystemSounds') {
            soundLists++;
            if (soundListError) return { ok: false, error: { message: soundListError } };
            return { ok: true, value: soundCatalog || { platform: 'darwin', sounds: [{ id: 'default', name: 'default' }, { id: 'mac:Ping.aiff', name: 'Ping' }, { id: 'mac:Glass.aiff', name: 'Glass' }] } };
          }
          if (descriptor.method === 'playSystemSound') {
            soundPlays.push({ id: blocked, preview: revision });
            return soundReply ? await soundReply(blocked, revision) : { ok: true, value: { played: true } };
          }
          if (descriptor.method === 'listMcpServers') {
            mcpReads.push(rpcArgs);
            if (mcpList) return mcpList();
            if (mcpReadError) return { ok: false, error: { message: mcpReadError } };
            return { ok: true, value: mcpView() };
          }
          if (descriptor.method === 'readMcpServer') {
            const [serverId] = rpcArgs;
            mcpDetailReads.push({ id: serverId });
            if (mcpDetailReply) return mcpDetailReply(serverId);
            if (mcpDetailError) return { ok: false, error: { message: mcpDetailError } };
            const server = mcpView().servers.find(row => row.id === serverId);
            return { ok: true, value: server ? { server, config: mcpDetail ?? null } : null };
          }
          if (descriptor.method === 'setMcpServerEnabled') {
            const [id, targetEnabled] = rpcArgs;
            mcpWrites.push({ id, enabled: targetEnabled });
            if (mcpReply) {
              const result = await mcpReply(id, targetEnabled);
              if (result.ok) mcpValue = result.value;
              return result;
            }
            mcpValue = { ...mcpValue, servers: mcpValue.servers.map(server => server.id === id ? { ...server, enabled: targetEnabled } : server) };
            return { ok: true, value: mcpView() };
          }
          if (descriptor.method === 'probeMcpServer') {
            const [serverId] = rpcArgs;
            mcpProbes.push({ id: serverId });
            if (mcpProbeReply) return mcpProbeReply(serverId);
            if (mcpProbeError) return { ok: false, error: { message: mcpProbeError } };
            return { ok: true, value: mcpProbe || { ok: true, toolNames: ['navigate'], truncated: false, durationMs: 5, cleanupFailed: false } };
          }
          if (descriptor.method === 'listSkills') {
            skillReads.push({ cwd: blocked, scope: revision });
            if (skillList) return skillList(blocked, revision);
            if (skillReadError) return { ok: false, error: { message: skillReadError } };
            return { ok: true, value: skillView(blocked, revision) };
          }
          if (descriptor.method === 'readSkill') {
            const [, , skillName] = rpcArgs;
            skillDetailReads.push({ name: skillName });
            if (skillDetailReply) return skillDetailReply(skillName);
            if (skillDetailError) return { ok: false, error: { message: skillDetailError } };
            const row = skillView(blocked, revision).skills.find(skill => skill.name === skillName);
            return { ok: true, value: row ? {
              name: row.name, description: row.description, content: skillDetail?.content ?? 'Body of ' + row.name,
              source: row.source, path: row.path, origin: row.origin, enabled: row.enabled,
              modelInvocable: row.modelInvocable, userInvocable: row.userInvocable,
              ...(row.deletion ? { deletion: row.deletion } : {}),
            } : null };
          }
          if (descriptor.method === 'setSkillEnabled') {
            skillWrites.push({ cwd: blocked, scope: revision, name, enabled });
            if (skillReply) {
              const result = await skillReply(blocked, revision, name, enabled);
              if (result.ok) skillValue = result.value;
              return result;
            }
            skillValue = { ...skillValue, skills: skillValue.skills.map(skill => skill.name === name ? { ...skill, enabled, modelInvocable: enabled, userInvocable: enabled } : skill) };
            return { ok: true, value: skillView(blocked, revision) };
          }
          if (descriptor.method === 'deleteSkill') {
            const [cwd, scope, name, revision] = rpcArgs;
            skillDeletes.push({ cwd, scope, name, revision });
            if (skillReply) {
              const result = await skillReply(cwd, scope, name, revision);
              if (!result.ok) return result;
            }
            skillValue = { ...skillValue, skills: skillValue.skills.filter(skill => skill.name !== name || (skill.source.startsWith('project') ? 'project' : 'user') !== scope || skill.targetCwd !== undefined && skill.targetCwd !== cwd) };
            externalAvailability.delete(JSON.stringify([cwd, scope, name]));
            return { ok: true, value: skillView(cwd, scope) };
          }
          if (descriptor.method === 'discoverExternalSkills') {
            externalReads.push({ cwd: blocked, scope: revision });
            const result = externalSkillList ? await externalSkillList(blocked, revision) : { ok: true, value: externalValue };
            return result.ok ? { ...result, value: { ...result.value, entries: result.value.entries.map(entry => ({
              ...entry, available: Boolean(entry.available || externalAvailability.has(JSON.stringify([blocked, revision, entry.name]))
                || externalAvailability.has(JSON.stringify([blocked, revision, entry.id]))),
            })) } } : result;
          }
          if (descriptor.method === 'readExternalSkill') {
            const id = third;
            const entry = externalValue.entries.find(item => item.id === id || item.variants?.some(variant => variant.id === id));
            const selected = entry?.variants?.find(variant => variant.id === id);
            externalDetailReads.push({ cwd: blocked, scope: revision, id });
            if (externalDetailReply) return externalDetailReply(id);
            return { ok: true, value: entry === undefined ? null : {
              name: entry.name, description: selected?.description ?? entry.description,
              content: '# ' + entry.name + '\n\nBody of ' + (selected?.id ?? entry.name), source: selected?.sources?.[0]?.agent ?? entry.source, path: selected?.path ?? entry.path,
            } };
          }
          if (descriptor.method === 'importExternalSkills') {
            const ids = third;
            externalImports.push({ cwd: blocked, scope: revision, ids });
            const imported = ids.filter(id => externalValue.entries.some(entry => entry.id === id));
            const result = externalSkillReply ? await externalSkillReply(blocked, revision, ids) : { ok: true, value: { imported, skipped: [] } };
            if (result.ok) for (const name of result.value.imported) externalAvailability.add(JSON.stringify([blocked, revision, name]));
            return result;
          }
          if (descriptor.method === 'addSkill') {
            const [cwd, scope, id, mode, revision] = rpcArgs;
            externalImports.push({ cwd, scope, ids: [id], mode, revision });
            const entry = externalValue.entries.find(item => item.variants?.some(variant => variant.id === id));
            const result = externalSkillReply ? await externalSkillReply(cwd, scope, [id], mode, revision)
              : { ok: true, value: { imported: entry ? [entry.name] : [], skipped: [] } };
            if (result.ok) {
              for (const name of result.value.imported) externalAvailability.add(JSON.stringify([cwd, scope, name]));
              if (entry && result.value.imported.includes(entry.name)) skillValue = { ...skillValue, skills: [...skillValue.skills, skillFixture({ name: entry.name, source: scope === 'project' ? 'project-dsh' : 'user-dsh' })] };
            }
            return result;
          }
          if (descriptor.method === 'readSkillImportDestination') {
            const [cwd, scope, name, flat] = rpcArgs;
            importDestinationReads.push({ cwd, scope, name, flat });
            if (importDestinationReply) return importDestinationReply(cwd, scope, name, flat);
            return { ok: true, value: {
              path: `${cwd ? cwd + '/.dsh' : '/profile'}/skills/${name}${flat ? '.md' : ''}`,
              complete: true, inherited: false,
              available: externalAvailability.has(JSON.stringify([cwd, scope, name])),
            } };
          }
          if (descriptor.method === 'importSkillTo') {
            const [cwd, scope, id, revision, targetCwd] = rpcArgs;
            externalImports.push({ cwd, scope, ids: [id], mode: 'copy', revision, targetCwd });
            const entry = externalValue.entries.find(item => item.id === id || item.variants?.some(variant => variant.id === id));
            const targetScope = targetCwd ? 'project' : 'user';
            const result = externalSkillReply ? await externalSkillReply(targetCwd, targetScope, [id], 'copy', revision)
              : { ok: true, value: { imported: entry ? [entry.name] : [], skipped: [] } };
            if (result.ok) for (const name of result.value.imported) {
              externalAvailability.add(JSON.stringify([targetCwd, targetScope, name]));
              skillValue = { ...skillValue, skills: [...skillValue.skills, skillFixture({
                name, targetCwd, source: targetCwd ? 'project-dsh' : 'user-dsh',
                path: `${targetCwd ? targetCwd + '/.dsh' : '/profile'}/skills/${name}/SKILL.md`,
              })] };
            }
            return result;
          }
          if (descriptor.method === 'listArchivedSessions') {
            archiveReads.push({});
            if (archiveList) return archiveList();
            if (archiveReadError) return { ok: false, error: { message: archiveReadError } };
            return { ok: true, value: archiveView() };
          }
          if (descriptor.method === 'restoreArchivedSession' || descriptor.method === 'deleteArchivedSession') {
            archiveWrites.push({ method: descriptor.method, sessionId: blocked });
            if (archiveReply) {
              const result = await archiveReply(descriptor.method, blocked);
              if (result.ok) archiveValue = result.value;
              return result;
            }
            archiveValue = { ...archiveValue, sessions: archiveValue.sessions.filter(session => session.sessionId !== blocked) };
            return { ok: true, value: archiveView() };
          }
          if (descriptor.method === 'readUsageStats') {
            usageReads.push({ timeZone: blocked });
            if (usageList) return usageList(blocked);
            if (usageReadError) return { ok: false, error: { message: usageReadError } };
            if (usageReply) {
              const result = await usageReply(blocked);
              if (result.ok) usageValue = result.value;
              return result;
            }
            return { ok: true, value: usageView() };
          }
          if (descriptor.method === 'listProjects') {
            projectReads.push({});
            if (projectList) return projectList();
            if (projectReadError) return { ok: false, error: { message: projectReadError } };
            return { ok: true, value: projectView() };
          }
          if (descriptor.method === 'removeProject') {
            projectWrites.push({ method: descriptor.method, workspaceId: blocked });
            if (projectReply) {
              const result = await projectReply(descriptor.method, blocked);
              if (result.ok) projectValue = result.value;
              return result;
            }
            projectValue = { ...projectValue, projects: projectValue.projects.filter(project => project.workspaceId !== blocked) };
            return { ok: true, value: projectView() };
          }
          if (descriptor.method === 'readWallpaper') return wallpaperReadError
            ? { ok: false, error: { message: wallpaperReadError } } : { ok: true, value: wallpaperValue };
          if (descriptor.method === 'saveWallpaper') {
            wallpaperWrites.push({ dataUrl: blocked, name: revision });
            if (wallpaperReply) {
              const result = await wallpaperReply(blocked, revision);
              if (result.ok) wallpaperValue = result.value;
              return result;
            }
            wallpaperValue = { path: '/test/profile/power-dsh/wallpaper.bin', name: revision, mime: 'image/png', bytes: 4, dataUrl: blocked };
            return { ok: true, value: wallpaperValue };
          }
          if (descriptor.method === 'clearWallpaper') {
            wallpaperWrites.push({ cleared: true });
            if (wallpaperClearError) return { ok: false, error: { message: wallpaperClearError } };
            wallpaperValue = null;
            return { ok: true, value: { cleared: true } };
          }
          if (descriptor.method === 'readPersonalization') return fileReadError
            ? { ok: false, error: { message: fileReadError } } : { ok: true, value: fileValue() };
          if (descriptor.method === 'savePersonalization') {
            fileWrites.push({ text: blocked, revision });
            if (fileReply && !await fileReply(blocked, revision)) return { ok: false, error: { message: 'saveFailed' } };
            if (revision !== fileValue().revision) return { ok: false, error: { message: 'promptConflict' } };
            fileText = blocked;
            fileVersion++;
            return { ok: true, value: fileValue() };
          }
          rpcCalls.push({ method: descriptor.method, blocked });
          const result = rpcReply ? await rpcReply : rpcError ? { ok: false, error: { message: rpcError } } : { ok: true, value: { blocked } };
          if (result.ok) {
            const field = {
              setAccountBlocked: 'blockOfficialAccount',
              setTelemetryBlocked: 'blockOfficialTelemetry',
              setTodoBlocked: 'blockTodo',
              setPlanBlocked: 'blockPlan',
              setGoalBlocked: 'blockGoal',
              setSearchBlocked: 'blockOfficialSearch',
            }[descriptor.method];
            assert.ok(field, `Unexpected policy method: ${descriptor.method}`);
            settings = { ...settings, value: { ...settings.value, [field]: blocked } };
          }
          return result;
        }]));
      }
      fn(dependencies.includes('connection') ? Object.create(ctx, { connection: { value: connection } }) : ctx);
    },
    configForms: { get: () => form, describe: () => ({ async load() {
      const patch = await formLoad?.();
      if (patch) {
        settings = { ...settings, value: { ...settings.value, ...patch } };
        listeners.forEach(listener => listener());
      }
    } }) },
    theme: {
      getTheme: () => theme,
      setTheme(id) { calls.push(id); theme = { preference: id }; themeListeners.forEach(fn => fn()); },
    },
    on(event, listener) {
      const listeners = event === 'connection/reset' ? connectionListeners : themeListeners;
      listeners.add(listener);
      const dispose = () => listeners.delete(listener);
      effects.push(dispose);
      return dispose;
    },
    locale: { register: (_namespace, language, dictionary) => { dictionaries.set(language, dictionary); return () => dictionaries.delete(language); }, bind: () => key => dictionaries.get(localeLanguage)?.[key] ?? key },
    effect(fn) { const dispose = fn(); if (typeof dispose === 'function') effects.push(dispose); },
    slots: {
      inject(_name, fn) { const dispose = fn(); effects.push(dispose); return dispose; },
      register(options, component) {
        const entry = { options, component };
        const key = options.name + ':' + (options.id || 'single');
        entries.set(key, entry);
        return () => {
          if (entries.get(key) === entry) entries.delete(key);
        };
      },
    },
  };
  await plugin.apply(ctx);
  const app = {
    setConnectionState(state) { connectionState = state; connectionStateListeners.forEach(fn => fn()); },
    timers,
    connectionStateListeners,
    entries, calls, dictionaries, nativeLauncher, rpcCalls, rpcDescriptors, fileWrites, skillReads, skillDetailReads, skillWrites, mcpReads, mcpDetailReads, mcpWrites, mcpProbes, archiveReads, archiveWrites, projectReads, projectWrites, usageReads,
    soundPlays, soundLists: () => soundLists,
    notifications, nativeNotifications, nativeClears,
    permissionRequests: () => permissionRequests,
    notificationSubscriptions: () => sessionListeners.size + statusListeners.size + connectionListeners.size,
    windowFocusCount: () => windowFocusCount,
    setNotificationPermission(value) { FakeNotification.permission = value; },
    setDocument({ hidden = documentHidden, focused = documentFocused }) { documentHidden = hidden; documentFocused = focused; },
    setSessions(rows, phase = 'ready') {
      sessionList = { ids: rows.map(row => row.id), byId: Object.fromEntries(rows.map(row => [row.id, row])), phase, projectionsBySession: {} };
      sessionListeners.forEach(fn => fn());
    },
    setSessionStatus(entries) { sessionStatus = new Map(entries); statusListeners.forEach(fn => fn()); },
    setConnectionGeneration(value) { connectionGeneration = value; connectionListeners.forEach(fn => fn()); },
    resetConnection() { app.setConnectionGeneration(undefined); app.setConnectionGeneration({ id: 2 }); },
    setMcpServers(value) { mcpValue = value; },
    mcpProps() {
      return entries.get('settings.section:power-dsh-mcp').component({ t: key => key }).props;
    },
    renderMcp(language) {
      return renderComponent(entries.get('settings.section:power-dsh-mcp').component({ t: key => dictionaries.get(language)?.[key] ?? key }));
    },
    reloadMcp() { return app.mcpProps().loadMcpServers(); },
    setSkills(value) { skillValue = value; },
    skillsProps() {
      return entries.get('settings.section:power-dsh-skills').component({ t: key => key }).props;
    },
    renderSkills() {
      return renderComponent(entries.get('settings.section:power-dsh-skills').component({ t: key => key }));
    },
    reloadSkills(cwd, scope) {
      return app.skillsProps().loadSkills(cwd, scope);
    },
    setArchive(value) { archiveValue = value; },
    archiveProps() {
      return entries.get('settings.section:power-dsh-archive').component({ t: key => key }).props;
    },
    renderArchive(language) {
      return renderComponent(entries.get('settings.section:power-dsh-archive').component({ t: key => dictionaries.get(language)?.[key] ?? key }));
    },
    reloadArchive() {
      return app.archiveProps().loadArchivedSessions();
    },
    setProjects(value) { projectValue = value; },
    projectsProps() {
      return entries.get('settings.section:power-dsh-projects').component({ t: key => key }).props;
    },
    renderProjects(language) {
      return renderComponent(entries.get('settings.section:power-dsh-projects').component({ t: key => dictionaries.get(language)?.[key] ?? key }));
    },
    reloadProjects() {
      return app.projectsProps().loadProjects();
    },
    setUsage(value) { usageValue = value; },
    usageProps() {
      return entries.get('settings.section:power-dsh-usage').component({ t: key => key }).props;
    },
    renderUsage(language) {
      return renderComponent(entries.get('settings.section:power-dsh-usage').component({ t: key => dictionaries.get(language)?.[key] ?? key }));
    },
    reloadUsage() {
      return app.usageProps().loadUsageStats();
    },
    renderComponent, disposeComponent,
    blur() { blurListeners.forEach(fn => fn()); },
    blurSubscriptions: () => blurListeners.size,
    focus() { focusListeners.forEach(fn => fn()); },
    focusSubscriptions: () => focusListeners.size,
    doubleClickListeners,
    doubleClick(path, button = 0) {
      let stopped = false;
      const event = { button, composedPath: () => path, stopPropagation() { stopped = true; },
        preventDefault() { assert.fail('Double-click blocking must preserve browser text selection.'); } };
      doubleClickListeners.forEach(fn => fn(event));
      return stopped;
    },
    setFormStatus(status) { settings = { ...settings, status }; listeners.forEach(fn => fn()); },
    intervals: () => [...intervals.values()].map(timer => timer.ms),
    tickIntervals: () => Promise.all([...intervals.values()].map(timer => timer.fn())),
    setFile(text) { fileText = text; fileVersion++; },
    wallpaperWrites,
    filePickerOpens: () => filePickerOpens,
    settingsVisibility: () => ({ open: settingsOpen, closes: settingsCloses, opens: settingsOpens }),
    renderTunePanel() {
      const entry = entries.get('shell.overlay:power-dsh-background-tune');
      if (!entry) return null;
      return renderComponent(React.createElement(entry.component, { t: key => key }));
    },
    setWallpaper(value) { wallpaperValue = value; },
    reloadInstructions() {
      return entries.get('settings.section:power-dsh-personalization').component({ t: key => key }).props.loadInstructions();
    },
    settingsProps() {
      return entries.get('settings.section:power-dsh').component({ t: key => key }).props;
    },
    renderSettings() {
      if (!settingsOpen) return null;
      const wrapped = entries.get('settings.section:power-dsh').component({ t: key => key, close: closeSettings });
      return renderComponent(wrapped);
    },
    selectSettingsTab(id) {
      const tab = descendants(app.renderSettings()).find(node => node.props.role === 'tab' && node.props.id === `settings-test-tab-${id}`);
      assert.ok(tab, `Expected settings tab ${id}`);
      tab.props.onClick();
      return app.renderSettings();
    },
    effortSelects,
    externalReads, externalImports, externalDetailReads, importDestinationReads, skillDeletes,
    setExternalSkills(value) { externalValue = value; externalAvailability.clear(); },
    effortSessions,
    effortListeners: () => effortListeners.size,
    setModelDirectory(value) { effortState = value; effortListeners.forEach(listener => listener()); },
    renderEffort(sessionId = 'session:one') {
      const entry = entries.get('conversation.input.right:power-dsh-thinking-effort');
      if (!entry) return null;
      return renderComponent(React.createElement(entry.component, { t: key => key, sessionId }));
    },
    focusedElementId: () => focusedElementId,
    renderPersonalization() {
      const wrapped = entries.get('settings.section:power-dsh-personalization').component({ t: key => key === 'settingsLocation' ? '{path}' : key });
      return renderComponent(wrapped);
    },
    subscriptions: () => listeners.size,
    set(patch) {
      settings = { ...settings, value: { ...settings.value, ...patch } };
      listeners.forEach(fn => fn());
    },
    settingsValue: () => settings.value,
    render(wide = true) {
      const entry = entries.get('sidebar.footer.action:power-dsh-footer');
      assert.ok(entry);
      const footer = entry.component({ wide, t: key => key });
      const wrapped = footer.props.children.find(node => node.type.name === 'AppearanceButton');
      renderComponent(wrapped);
      return renderComponent(wrapped);
    },
    renderVersion(wide = true) {
      const footer = entries.get('sidebar.footer.action:power-dsh-footer').component({ wide, t: key => key });
      const wrapped = footer.props.children.find(node => node.type.name === 'VersionBadge');
      renderComponent(wrapped);
      return renderComponent(wrapped);
    },
    restartCalls,
    renderFooter(wide = true) {
      const footer = entries.get('sidebar.footer.action:power-dsh-footer').component({ wide, t: key => key });
      return { ...footer, props: { ...footer.props, children: footer.props.children.map(wrapped => {
        assert.equal(typeof wrapped.type, 'function', 'Every registered footer component must resolve at render time.');
        renderComponent(wrapped);
        return renderComponent(wrapped);
      }) } };
    },
    renderHeader(wide = true) {
      const footer = entries.get('sidebar.footer.action:power-dsh-footer').component({ wide, t: key => key });
      const wrapped = footer.props.children.find(node => node.type.name === 'HeaderActions');
      assert.ok(wrapped, 'The actual footer must render the shared HeaderActions component.');
      renderComponent(wrapped);
      return renderComponent(wrapped);
    },
    setModalLayer(open) {
      modalLayers = open ? 1 : 0;
      // The background panel observes the body for modal layers.
      bodyObservers.forEach(fn => fn());
    },
    setNativeMenu(rect) {
      menuRect = rect;
      chromeListeners.forEach(fn => fn());
    },
    resizeNativeMenu(rect) {
      menuRect = rect;
      menuResizeListeners.forEach(fn => fn());
    },
    chromeGeometry: () => ({ mutations: chromeListeners.size, menuResizes: menuResizeListeners.size }),
    resize(right) { edge = right; resizeListeners.forEach(fn => fn()); },
    geometry: () => ({ observeCount, disconnectCount, listeners: resizeListeners.size }),
    unmount() {
      for (const scope of hookScopes.values()) scope.effects.forEach(effect => effect?.dispose?.());
      effects.reverse().forEach(dispose => dispose?.());
    },
  };
  return app;
}

export function notificationSession({ id = 'task', seq = -1, reason = '', running = true, ...rest } = {}) {
  return { id, displayTitle: 'Build the project', running, retainedBy: {},
    projectionValues: { powerDshNotifications: { seq, turn: 1, reason } }, ...rest };
}

export function notificationMenu(app) {
  return descendants(app.selectSettingsTab('general')).find(node => node.type === 'native-menu-fixture' && node.props.items?.some(item => item.id === 'always'));
}

export async function loadedSoundSettings(app) {
  app.selectSettingsTab('general');
  await new Promise(resolve => setImmediate(resolve));
  return descendants(app.renderSettings());
}
export function soundControl(app, name) {
  return descendants(app.renderSettings()).find(node => node.props.className === `power-dsh-sound-${name}`);
}

export function notificationSoundSwitch(app) {
  return descendants(app.selectSettingsTab('general')).find(node => node.props.id === 'settings-test-notificationSoundEnabled');
}

export function button(view) {
  return view.props.children.find(node => node?.props?.className === 'power-dsh-appearance-button');
}

export function headerTrigger(app) {
  return descendants(app.renderHeader()).find(node => node.props['aria-label'] === 'moreActions');
}
export function headerMenu(app) {
  return descendants(app.renderHeader()).find(node => node.type === 'native-menu-fixture');
}
export function headerPosition(app) {
  return descendants(app.renderHeader()).find(node => node.props.className === 'power-dsh-header-menu').props.style;
}
export function openHeaderMenu(app) {
  if (!headerMenu(app)?.props.open) headerTrigger(app)?.props.onClick({ stopPropagation() {} });
  return headerMenu(app);
}
export function headerAction(app, id) {
  return descendants(openHeaderMenu(app)).find(node => node.props.role === 'menuitem' && node.props['data-id'] === id);
}

export function descendants(node) {
  if (!node || typeof node !== 'object' || node.props?.hidden) return [];
  return [node, ...(node.props?.children || []).flat().flatMap(descendants)];
}

export async function personalization(app) {
  app.renderPersonalization();
  await app.reloadInstructions();
  const render = () => descendants(app.renderPersonalization());
  const editor = () => render().find(node => node.type === 'textarea');
  const action = key => render().find(node => node.type === 'button' && node.props.children.includes(key));
  return { render, editor, action };
}

export async function skillsPage(app, scope = 'user') {
  app.set({ skillManagerEnabled: true });
  app.renderSkills();
  await app.reloadSkills('', 'user');
  const render = () => descendants(app.renderSkills());
  for (const group of render().filter(node => node.type === 'button' && node.props.id?.startsWith('settings-test-group-') && !node.props['aria-expanded'])) group.props.onClick();
  const workspace = path => render().find(node => node.type === 'section' && node.props['data-workspace'] === path);
  const workspaceToggle = path => descendants(workspace(path)).find(node => node.type === 'button' && node.props['aria-controls']);
  const row = (name, path) => (path ? descendants(workspace(path)) : render()).find(node => node.type === 'li' && node.props['data-skill'] === name);
  const control = (name, path) => descendants(row(name, path)).find(node => node.props.role === 'switch');
  const search = () => render().find(node => node.type === 'input' && node.props.type === 'search');
  const select = label => render().find(node => node.type === 'select' && node.props['aria-label'] === label);
  const tab = scope => render().find(node => node.props.role === 'tab' && node.props.id === `settings-test-scope-${scope}`);
  const projectTrigger = () => render().find(node => node.type === 'button' && node.props['aria-label'] === 'skillWorkspace');
  const projectMenu = () => render().find(node => node.type === 'native-menu-fixture');
  const detail = name => descendants(row(name)).find(node => node.props['data-detail'] === name);
  const dialog = () => render().find(node => node.type === 'native-modal-fixture');
  if (scope === 'project') {
    tab('project').props.onClick();
    render();
    await new Promise(resolve => setImmediate(resolve));
  }
  return { render, row, control, search, select, tab, projectTrigger, projectMenu, workspace, workspaceToggle, detail, dialog };
}

export async function mcpPage(app, language) {
  app.set({ mcpManagerEnabled: true });
  app.renderMcp(language);
  await app.reloadMcp();
  const render = () => descendants(app.renderMcp(language));
  const row = name => render().find(node => node.type === 'li' && descendants(node).some(child => child.type === 'span' && child.props.children.includes(name)));
  const control = name => descendants(row(name)).find(node => node.props.role === 'switch');
  const search = () => render().find(node => node.type === 'input' && node.props.type === 'search');
  const group = name => render().find(node => node.type === 'button' && node.props.id === `settings-test-mcp-group-${name}`);
  const toggle = name => descendants(row(name)).find(node => node.props.className === 'power-dsh-mcp-card-toggle');
  const includingHidden = node => !node || typeof node !== 'object' ? []
    : [node, ...(node.props?.children || []).flat().flatMap(includingHidden)];
  const tools = name => includingHidden(row(name)).find(node => node.props.className === 'power-dsh-mcp-tools');
  const summary = name => descendants(row(name)).find(node => node.props.className === 'power-dsh-mcp-tools-summary');
  const detail = name => descendants(row(name)).find(node => node.props.className === 'power-dsh-mcp-card-detail');
  const dialog = () => render().find(node => node.type === 'native-modal-fixture');
  return { render, row, control, search, group, toggle, tools, summary, detail, dialog };
}

export async function archivePage(app, language) {
  app.set({ archiveManagerEnabled: true });
  app.renderArchive(language);
  await app.reloadArchive();
  const render = () => descendants(app.renderArchive(language));
  const group = title => render().find(node => node.type === 'button' && node.props.className === 'power-dsh-archive-group-toggle'
    && descendants(node).some(child => [child.props.children].flat(Infinity).includes(title)));
  const row = sessionId => render().find(node => node.type === 'li' && node.props['data-archive'] === sessionId);
  const search = () => render().find(node => node.type === 'input' && node.props.type === 'search');
  const action = (sessionId, name) => descendants(row(sessionId)).find(node => node.type === 'button' && node.props[`data-${name}`] === sessionId);
  const expand = title => group(title).props.onClick();
  return { render, group, row, search, action, expand };
}

export async function projectsPage(app, language) {
  app.set({ projectManagerEnabled: true });
  app.renderProjects(language);
  await app.reloadProjects();
  const render = () => descendants(app.renderProjects(language));
  const row = workspaceId => render().find(node => node.type === 'li' && node.props['data-project'] === workspaceId);
  const search = () => render().find(node => node.type === 'input' && node.props.type === 'search');
  const action = workspaceId => descendants(row(workspaceId)).find(node => node.type === 'button' && node.props['data-remove'] === workspaceId);
  return { render, row, search, action };
}

export function restartControl(app) {
  return headerAction(app, 'restart');
}
export function restartDialog(app) {
  return descendants(app.renderHeader()).find(node => node.type === 'native-modal-fixture');
}
export function restartConfirmButton(app) {
  return descendants(restartDialog(app)).find(node => node.props['data-native-button'] && node.props.children.includes('restartAction'));
}
export async function enableRestart(app) {
  app.set({ showRestartButton: true });
  app.renderHeader();
  await new Promise(resolve => setImmediate(resolve));
}
