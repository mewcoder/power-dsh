import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { MOD_RPC } from '../rpc.js';

function skillFixture(overrides = {}) {
  return {
    name: 'code-review', description: 'Review code and boundary cases', source: 'user-dsh', origin: '.dsh', path: '/skills/code-review/SKILL.md',
    enabled: true, modelInvocable: true, userInvocable: true, canToggle: true, reason: '', ...overrides,
  };
}

function catalogFixture(overrides = {}) {
  return {
    cwd: '', scope: 'user', workspaces: [{ path: '/work/a', title: 'Project Alpha' }, { path: '/work/b', title: 'Project Beta' }], complete: true,
    skills: [skillFixture()], ...overrides,
  };
}

function mcpFixture(overrides = {}) {
  return { id: 'include:browser', name: 'browser', tools: ['navigate'], source: 'profile', origin: '', group: 'user', enabled: true, stateKnown: true, runtimeState: 'active', transport: 'unknown', canToggle: true, reason: '', ...overrides };
}

function mcpCatalogFixture(overrides = {}) {
  return { complete: true, servers: [mcpFixture()], ...overrides };
}

async function mount({ restartStatus = { supported: true, running: false, error: '' }, restartReply, desktop = false, themeAvailable = true, updates, rpcError, rpcReply, formReply, formLoad, fileText = '', fileReply, fileReadError, skillCatalog, skillList, skillReply, skillReadError, mcpCatalog, mcpList, mcpReply, mcpReadError, writable = true, reload = () => {}, windows = false, notificationPermission = 'granted', notificationRequest, notificationFailure = false, notificationServices = true, notificationsAvailable = true, localConnection = true, soundCatalog, soundReply, soundListError } = {}) {
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
      notifications.push(this);
    }
    close() { this.closed = true; this.onclose?.(); }
  }
  const resizeListeners = new Set();
  const focusListeners = new Set();
  const intervals = new Map();
  let intervalId = 0;
  const chromeListeners = new Set();
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
  let cursor = 0;
  let observeCount = 0;
  let disconnectCount = 0;
  let edge = 280;
  let settings = { status: 'ready', writable, value: { notificationsEnabled: false, notificationSoundEnabled: true, notificationSound: 'default', blockTodo: false, showThemeSwitcher: false, personalizationEnabled: false, skillManagerEnabled: false, mcpManagerEnabled: false, globalPrompt: '' } };
  let theme = { preference: 'system' };
  const calls = [];
  const rpcCalls = [];
  const fileWrites = [];
  const skillReads = [];
  const skillWrites = [];
  let skillValue = skillCatalog ?? catalogFixture();
  const skillView = (cwd, scope = 'user') => ({
    ...skillValue, cwd: scope === 'project' ? cwd || skillValue.cwd || skillValue.workspaces[0]?.path || '' : '', scope: scope || 'user',
    skills: skillValue.skills.filter(skill => {
      const project = skill.source === 'project' || skill.source.startsWith('project-');
      return scope === 'project' ? project : !project;
    }),
  });
  const mcpReads = [];
  const mcpWrites = [];
  let mcpValue = mcpCatalog ?? mcpCatalogFixture();
  const mcpView = () => ({ ...mcpValue });
  let fileVersion = 1;
  const fileValue = () => ({ path: '/test-dsh-home/AGENTS.md', text: fileText, revision: fileVersion.toString(16).padStart(64, '0') });
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
  function FakeStateDot(props) {
    return { type: 'native-state-dot-fixture', props };
  }
  function FakeModal(props) {
    return props.open ? { type: 'native-modal-fixture', props: { ...props, role: 'dialog', 'aria-modal': true,
      children: [props.description, props.footer] } } : null;
  }
  function FakeButton(props) {
    return { type: 'button', props: { ...props, 'data-native-button': true } };
  }
  let focusedElementId = null;
  const React = {
    Fragment: 'fragment',
    createElement(type, props, ...children) {
      if (type === FakeModal) return FakeModal(props);
      if (type === FakeButton) return FakeButton({ ...props, children });
      if (type === FakeMenu) return FakeMenu(props);
      if (type === FakeStateDot) return FakeStateDot({ ...props, children });
      if (type === FakeTooltip) return FakeTooltip({ ...props, children });
      if (typeof props?.ref === 'function') props.ref({ focus() { focusedElementId = props.id; } });
      return { type, props: { ...props, children } };
    },
    useId: () => 'settings-test',
    useEffect(fn, deps) { return this.useLayoutEffect(fn, deps); },
    useSyncExternalStore: (_subscribe, get) => get(),
    useState(init) {
      const id = cursor++;
      if (!(id in hookStates)) hookStates[id] = typeof init === 'function' ? init() : init;
      const states = hookStates;
      return [states[id], value => { states[id] = typeof value === 'function' ? value(states[id]) : value; }];
    },
    useRef(initial) {
      const id = cursor++;
      return hookStates[id] ||= { current: initial ?? { getBoundingClientRect: () => ({ right: edge }) } };
    },
    useLayoutEffect(fn, deps) {
      const id = cursor++;
      const previous = hookEffects[id];
      if (previous && deps.every((value, index) => value === previous.deps[index])) return;
      previous?.dispose?.();
      hookEffects[id] = { deps, dispose: fn() };
    },
  };
  const context = vm.createContext({
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; }
      observe(element) { observeCount++; if (element === menuElement) menuResizeListeners.add(this.callback); }
      unobserve(element) { if (element === menuElement) menuResizeListeners.delete(this.callback); }
      disconnect() { disconnectCount++; menuResizeListeners.delete(this.callback); }
    },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe() { chromeListeners.add(this.callback); }
      disconnect() { chromeListeners.delete(this.callback); }
    },
    document: {
      get hidden() { return documentHidden; },
      hasFocus: () => documentFocused,
      body: {},
      documentElement: { hasAttribute: name => windows && name === 'data-windows-titlebar', getAttribute: () => desktop ? 'darwin' : null },
      querySelector(selector) {
        assert.equal(selector, '[data-windows-menu]');
        return menuRect ? menuElement : null;
      },
    },
    window: {
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
      addEventListener(name, fn) { (name === 'focus' ? focusListeners : resizeListeners).add(fn); },
      removeEventListener(name, fn) { (name === 'focus' ? focusListeners : resizeListeners).delete(fn); },
      __ModuleLoader__: { load(value) { plugin = value.factory(specifier => {
        if (specifier === 'react') return React;
        assert.equal(specifier, '@deepseek-ai/dsh-client-ui-primitives');
        return { Menu: FakeMenu, Tooltip: FakeTooltip, StateDot: FakeStateDot, Modal: FakeModal, Button: FakeButton };
      }); } },
    },
  });
  vm.runInContext(await readFile(new URL('../client.js', import.meta.url), 'utf8'), context);
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
  const ctx = {
    remote: {
      async $mount(contribution) { rpcDescriptors = contribution.descriptors; },
    },
    connection: { isLoopback: localConnection, state: {
      getSnapshot: () => connectionState,
      subscribe(fn) { connectionStateListeners.add(fn); return () => connectionStateListeners.delete(fn); },
    }, generation: {
      getSnapshot: () => connectionGeneration,
      subscribe(fn) { connectionListeners.add(fn); return () => connectionListeners.delete(fn); },
    } },
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
          if (descriptor.method === 'restartStatus') return { ok: true, value: restartStatus };
          if (descriptor.method === 'restartApp') {
            restartCalls.push([]);
            return restartReply ? await restartReply() : { ok: true, value: { accepted: true } };
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
          if (descriptor.method === 'listSkills') {
            skillReads.push({ cwd: blocked, scope: revision });
            if (skillList) return skillList(blocked, revision);
            if (skillReadError) return { ok: false, error: { message: skillReadError } };
            return { ok: true, value: skillView(blocked, revision) };
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
              setSearchBlocked: 'blockOfficialSearch',
            }[descriptor.method];
            assert.ok(field, `Unexpected policy method: ${descriptor.method}`);
            settings = { ...settings, value: { ...settings.value, [field]: blocked } };
          }
          return result;
        }]));
      }
      fn(ctx);
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
    locale: { register: (_namespace, language, dictionary) => { dictionaries.set(language, dictionary); return () => dictionaries.delete(language); }, bind: () => key => key },
    effect(fn) { const dispose = fn(); if (typeof dispose === 'function') effects.push(dispose); },
    slots: {
      inject(_name, fn) { const dispose = fn(); effects.push(dispose); return dispose; },
      register(options, component) {
        const entry = { options, component };
        const key = options.name + ':' + (options.id || 'single');
        entries.set(key, entry);
        return () => { if (entries.get(key) === entry) entries.delete(key); };
      },
    },
  };
  await plugin.apply(ctx);
  const app = {
    setConnectionState(state) { connectionState = state; connectionStateListeners.forEach(fn => fn()); },
    timers,
    connectionStateListeners,
    entries, calls, nativeLauncher, rpcCalls, rpcDescriptors, fileWrites, skillReads, skillWrites, mcpReads, mcpWrites,
    soundPlays, soundLists: () => soundLists,
    notifications,
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
    focus() { focusListeners.forEach(fn => fn()); },
    focusSubscriptions: () => focusListeners.size,
    intervals: () => [...intervals.values()].map(timer => timer.ms),
    tickIntervals: () => Promise.all([...intervals.values()].map(timer => timer.fn())),
    setFile(text) { fileText = text; fileVersion++; },
    reloadInstructions() {
      return entries.get('settings.section:power-dsh-personalization').component({ t: key => key }).props.loadInstructions();
    },
    settingsProps() {
      return entries.get('settings.section:power-dsh').component({ t: key => key }).props;
    },
    renderSettings() {
      const wrapped = entries.get('settings.section:power-dsh').component({ t: key => key });
      return renderComponent(wrapped);
    },
    selectSettingsTab(id) {
      const tab = descendants(app.renderSettings()).find(node => node.props.role === 'tab' && node.props.id === `settings-test-tab-${id}`);
      assert.ok(tab, `Expected settings tab ${id}`);
      tab.props.onClick();
      return app.renderSettings();
    },
    focusedElementId: () => focusedElementId,
    renderPersonalization() {
      const wrapped = entries.get('settings.section:power-dsh-personalization').component({ t: key => key === 'settingsLocation' ? '全局指令（{path}）' : key });
      return renderComponent(wrapped);
    },
    subscriptions: () => listeners.size,
    set(patch) {
      settings = { ...settings, value: { ...settings.value, ...patch } };
      listeners.forEach(fn => fn());
    },
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

function notificationSession({ id = 'task', seq = -1, reason = '', running = true, ...rest } = {}) {
  return { id, displayTitle: 'Build the project', running, retainedBy: {},
    projectionValues: { powerDshNotifications: { seq, turn: 1, reason } }, ...rest };
}

function notificationSwitch(app) {
  return descendants(app.selectSettingsTab('general')).find(node => node.props.id === 'settings-test-notificationsEnabled');
}

test('task notification permission is requested from the switch before refreshing settings, then persists', async () => {
  const granted = Promise.withResolvers();
  let described = 0;
  const app = await mount({ notificationPermission: 'default', notificationRequest: () => granted.promise, formLoad: () => { described++; } });
  const action = notificationSwitch(app).props.onClick();
  assert.equal(app.permissionRequests(), 1);
  assert.equal(described, 0, 'Permission must be requested before an unrelated await loses user activation.');
  assert.equal(notificationSwitch(app).props['aria-busy'], true);
  await notificationSwitch(app).props.onClick();
  assert.equal(app.permissionRequests(), 1);
  granted.resolve('granted');
  await action;
  assert.equal(described, 1);
  assert.equal(notificationSwitch(app).props['aria-checked'], true);
  assert.equal(app.notifications.length, 0, 'Enabling must not send a test or history notification.');
  app.unmount();
});

test('permission denial, unsupported environments, missing services and rejected saves leave notifications off', async () => {
  for (const [options, expected] of [
    [{ notificationPermission: 'denied' }, 'notificationPermission'],
    [{ notificationPermission: 'default', notificationRequest: () => 'denied' }, 'notificationPermission'],
    [{ notificationsAvailable: false }, 'notificationUnsupported'],
    [{ notificationServices: false }, 'notificationUnavailable'],
    [{ formReply: () => false }, 'saveFailed'],
  ]) {
    const app = await mount(options);
    await notificationSwitch(app).props.onClick();
    assert.equal(notificationSwitch(app).props['aria-checked'], false);
    assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes(expected)));
    app.unmount();
  }
});

test('muted completion and error notifications are silent, deduplicated, and omit subagent or stopped turns', async () => {
  const app = await mount();
  app.setSessions([notificationSession()]);
  app.set({ notificationsEnabled: true, notificationSoundEnabled: false });
  app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false })]);
  assert.equal(app.notifications.length, 1);
  assert.equal(app.notifications[0].title, 'notificationComplete');
  assert.equal(app.notifications[0].options.silent, true);
  assert.equal(app.notifications[0].options.body, 'Build the project');
  app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false })]);
  assert.equal(app.notifications.length, 1);
  app.setSessions([notificationSession({ seq: 12, reason: 'error', running: false })]);
  assert.equal(app.notifications.length, 2);
  assert.equal(app.notifications[1].title, 'notificationError');
  assert.equal(app.notifications[0].closed, true);
  for (const reason of ['aborted', 'interrupted', 'max-tokens', 'forked', 'future-reason']) {
    app.setSessions([notificationSession({ seq: 20 + reason.length, reason, running: false })]);
  }
  app.setSessions([notificationSession({ id: 'child', origin: 'subagent' })]);
  app.setSessions([notificationSession({ id: 'child', seq: 90, reason: 'completed', origin: 'subagent', running: false })]);
  assert.equal(app.notifications.length, 2);
  app.unmount();
});

async function loadedSoundSettings(app) {
  app.selectSettingsTab('general');
  await new Promise(resolve => setImmediate(resolve));
  return descendants(app.renderSettings());
}
function soundControl(app, name) {
  return descendants(app.renderSettings()).find(node => node.props.className === `power-dsh-sound-${name}`);
}

test('system sound menu saves a native choice, previews it once, and sends one silent banner plus native playback', async () => {
  const app = await mount();
  app.set({ notificationsEnabled: true });
  await loadedSoundSettings(app);
  const settingRows = () => descendants(app.renderSettings()).filter(node => node.props.className === 'power-dsh-setting-row');
  assert.equal(settingRows().length, 7, 'Enabled notifications reveal the sound switch and tone row below the five main interface settings.');
  const menu = () => descendants(app.renderSettings()).find(node => node.type === 'native-menu-fixture' && node.props.items?.some(item => item.id === 'mac:Ping.aiff'));
  soundControl(app, 'select').props.onClick();
  assert.equal(menu().props.open, true);
  await menu().props.onSelect('mac:Ping.aiff');
  assert.equal(app.settingsProps().source.getSnapshot().value.notificationSound, 'mac:Ping.aiff');
  assert.deepEqual(app.soundPlays, [{ id: 'mac:Ping.aiff', preview: true }], 'Selecting saves and plays without an extra button.');
  assert.equal(soundControl(app, 'preview').props['aria-label'], 'notificationSoundPreview');
  app.setSessions([notificationSession()]);
  app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false })]);
  assert.equal(app.notifications.length, 1);
  assert.equal(app.notifications[0].options.silent, true);
  assert.deepEqual(app.soundPlays[1], { id: 'mac:Ping.aiff', preview: false });
  app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false })]);
  assert.equal(app.soundPlays.length, 2, 'Duplicate frames cannot replay a sound.');
  await soundControl(app, 'preview').props.onClick();
  assert.deepEqual(app.soundPlays[2], { id: 'mac:Ping.aiff', preview: true }, 'The compact icon can replay the selected sound.');
  app.set({ notificationSoundEnabled: false });
  app.setSessions([notificationSession({ seq: 20, reason: 'error', running: false })]);
  assert.equal(app.soundPlays.length, 3);
  assert.equal(soundControl(app, 'select'), undefined);
  assert.equal(soundControl(app, 'preview'), undefined);
  assert.equal(settingRows().length, 6, 'Sound disabled collapses only the tone-selection row.');
  assert.equal(app.notifications[1].options.silent, true);
  app.unmount();
});

test('selecting the current default sound previews without rewriting preferences and cleans up on unload', async () => {
  let saves = 0;
  const app = await mount({ formLoad: () => { saves++; } });
  app.set({ notificationsEnabled: true });
  await loadedSoundSettings(app);
  const menu = descendants(app.renderSettings()).find(node => node.type === 'native-menu-fixture');
  await menu.props.onSelect('default');
  assert.equal(saves, 0, 'Reselecting the current tone previews without rewriting it.');
  assert.equal(app.notifications[0].title, 'notificationSoundTestTitle');
  assert.equal(Object.hasOwn(app.notifications[0].options, 'silent'), false);
  assert.equal(app.soundPlays.length, 0);
  app.unmount();
  assert.equal(app.notifications[0].closed, true);
});

test('a rejected sound selection does not autoplay and disabled sound ignores a stale menu', async () => {
  const app = await mount({ formReply: () => false });
  app.set({ notificationsEnabled: true });
  await loadedSoundSettings(app);
  const menu = descendants(app.renderSettings()).find(node => node.type === 'native-menu-fixture');
  await menu.props.onSelect('mac:Ping.aiff');
  assert.equal(app.settingsProps().source.getSnapshot().value.notificationSound, 'default');
  assert.equal(app.soundPlays.length, 0);
  assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes('saveFailed')));
  app.set({ notificationSoundEnabled: false });
  await menu.props.onSelect('mac:Glass.aiff');
  assert.equal(app.soundPlays.length, 0);
  assert.equal(app.settingsProps().source.getSnapshot().value.notificationSound, 'default');
  app.unmount();
});

test('local sound catalog loads without waiting for notification session services', async () => {
  const app = await mount({ notificationServices: false });
  app.set({ notificationsEnabled: true, notificationSound: 'mac:Ping.aiff' });
  await loadedSoundSettings(app);
  assert.equal(app.soundLists(), 1);
  assert.equal(soundControl(app, 'select').props.disabled, false);
  assert.ok(soundControl(app, 'select').props.children.includes('Ping'));
  assert.equal(app.settingsProps().soundsSource.getSnapshot().error, '');
  app.unmount();
});

test('remote connections keep native browser notification sound and never play sounds on the server', async () => {
  const app = await mount({ localConnection: false });
  app.set({ notificationsEnabled: true, notificationSound: 'mac:Ping.aiff' });
  await loadedSoundSettings(app);
  assert.equal(app.soundLists(), 0);
  assert.equal(soundControl(app, 'select').props.disabled, true);
  assert.equal(descendants(app.renderSettings()).some(node => node.props.role === 'alert'), false);
  assert.equal(descendants(app.renderSettings()).some(node => node.props.className === 'power-dsh-prompt-action'), false);
  assert.ok(soundControl(app, 'select').props.children.includes('notificationSoundDefault'));
  app.setSessions([notificationSession()]);
  app.setSessions([notificationSession({ seq: 10, reason: 'error', running: false })]);
  assert.equal(app.notifications.length, 1);
  assert.equal(Object.hasOwn(app.notifications[0].options, 'silent'), false);
  assert.equal(app.soundPlays.length, 0);
  await app.settingsProps().playSystemSound('mac:Ping.aiff', true);
  assert.equal(app.soundPlays.length, 0);
  app.unmount();
});

test('sound preview prevents overlaps, reports playback failure, and ignores stale callbacks after disabling', async () => {
  const deferred = Promise.withResolvers();
  const app = await mount({ soundReply: () => deferred.promise });
  app.set({ notificationsEnabled: true, notificationSound: 'mac:Ping.aiff' });
  await loadedSoundSettings(app);
  const play = app.settingsProps().playSystemSound;
  const first = play('mac:Ping.aiff', true);
  assert.equal(soundControl(app, 'preview').props['aria-busy'], true);
  await play('mac:Ping.aiff', true);
  assert.equal(app.soundPlays.length, 1);
  deferred.resolve({ ok: false, error: { message: 'native failure details' } });
  await first;
  assert.equal(soundControl(app, 'preview').props['aria-busy'], false);
  assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes('notificationSoundFailed')));
  app.set({ notificationSoundEnabled: false });
  await play('mac:Ping.aiff', true);
  assert.equal(app.soundPlays.length, 1);
  app.unmount();
});

test('missing sounds, catalog errors and read-only preferences cannot play or write a different tone', async () => {
  for (const options of [{ soundListError: 'native failure' }, { writable: false }, {}]) {
    const app = await mount(options);
    app.set({ notificationsEnabled: true, notificationSound: 'mac:Missing.aiff' });
    await loadedSoundSettings(app);
    assert.equal(soundControl(app, 'preview').props.disabled, true);
    await app.settingsProps().playSystemSound('mac:Missing.aiff', true);
    assert.equal(app.soundPlays.length, 0);
    if (options.soundListError) {
      assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes('notificationSoundUnavailable')));
    } else {
      assert.ok(soundControl(app, 'select').props.children.includes('notificationSoundMissing'));
    }
    app.unmount();
  }
});

test('Windows aliases are localized through the native menu without exposing script text', async () => {
  const app = await mount({ soundCatalog: { platform: 'win32', sounds: [
    { id: 'default', name: 'default' }, { id: 'win:SystemExclamation', name: 'SystemExclamation' },
  ] } });
  app.set({ notificationsEnabled: true });
  await loadedSoundSettings(app);
  const menu = descendants(app.renderSettings()).find(node => node.type === 'native-menu-fixture');
  assert.equal(menu.props.items[1].label, 'soundSystemExclamation');
  app.unmount();
});

function notificationSoundSwitch(app) {
  return descendants(app.selectSettingsTab('general')).find(node => node.props.id === 'settings-test-notificationSoundEnabled');
}

test('notification sound follows system defaults, can mute every trigger, and updates without replaying notifications', async () => {
  const app = await mount();
  app.setSessions([notificationSession()]);
  await notificationSwitch(app).props.onClick();
  app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false })]);
  assert.equal(Object.hasOwn(app.notifications[0].options, 'silent'), false);
  assert.equal(app.notifications[0].options.renotify, true, 'Replacing a notification must still allow the system reminder.');
  await notificationSoundSwitch(app).props.onClick();
  assert.equal(notificationSoundSwitch(app).props['aria-checked'], false);
  assert.equal(app.notifications.length, 1, 'Changing sound cannot replay a completed turn.');
  app.setSessions([notificationSession({ seq: 20, reason: 'error' })]);
  app.setSessionStatus([['task', { running: true, pendingInteraction: { key: 'sound-question', kind: 'question' } }]]);
  app.setSessionStatus([['task', { running: true, pendingInteraction: { key: 'sound-approval', kind: 'approval' } }]]);
  for (const notice of app.notifications.slice(1)) {
    assert.equal(notice.options.silent, true);
    assert.equal(Object.hasOwn(notice.options, 'renotify'), false);
  }
  await notificationSoundSwitch(app).props.onClick();
  app.setSessionStatus([['task', { running: true, pendingInteraction: { key: 'sound-approval-next', kind: 'approval' } }]]);
  assert.equal(Object.hasOwn(app.notifications.at(-1).options, 'silent'), false);
  assert.equal(app.notifications.at(-1).options.renotify, true);
  assert.equal(app.permissionRequests(), 0, 'A sound preference does not require another permission request.');
  app.unmount();
});

test('sound settings appear only while notifications are on and preserve choices across hide and show', async () => {
  let saves = 0;
  const app = await mount({ formLoad: () => { saves++; } });
  app.set({ notificationSound: 'mac:Ping.aiff' });
  await loadedSoundSettings(app);
  const rows = () => descendants(app.renderSettings()).filter(node => node.props.className === 'power-dsh-setting-row');
  assert.equal(rows().length, 5);
  assert.equal(notificationSoundSwitch(app), undefined);
  assert.equal(soundControl(app, 'select'), undefined);
  assert.equal(soundControl(app, 'preview'), undefined);

  await notificationSwitch(app).props.onClick();
  assert.equal(rows().length, 7);
  assert.equal(notificationSoundSwitch(app).props['aria-checked'], true);
  assert.ok(soundControl(app, 'select').props.children.includes('Ping'));
  soundControl(app, 'select').props.onClick();
  const staleMenu = descendants(app.renderSettings()).find(node => node.type === 'native-menu-fixture');
  const staleSoundToggle = notificationSoundSwitch(app).props.onClick;
  assert.equal(staleMenu.props.open, true);

  await notificationSwitch(app).props.onClick();
  const savesBeforeStaleCallbacks = saves;
  await staleSoundToggle();
  await staleMenu.props.onSelect('mac:Glass.aiff');
  assert.equal(saves, savesBeforeStaleCallbacks, 'Hidden sound callbacks must not write preferences.');
  assert.equal(rows().length, 5);
  assert.equal(notificationSoundSwitch(app), undefined);
  assert.equal(soundControl(app, 'select'), undefined);
  assert.equal(soundControl(app, 'preview'), undefined);
  assert.equal(app.settingsProps().source.getSnapshot().value.notificationSoundEnabled, true);
  assert.equal(app.settingsProps().source.getSnapshot().value.notificationSound, 'mac:Ping.aiff');
  assert.equal(app.soundPlays.length, 0);

  await notificationSwitch(app).props.onClick();
  assert.equal(notificationSoundSwitch(app).props['aria-checked'], true);
  assert.ok(soundControl(app, 'select').props.children.includes('Ping'));
  assert.equal(descendants(app.renderSettings()).find(node => node.type === 'native-menu-fixture').props.open, false);
  await notificationSoundSwitch(app).props.onClick();
  await notificationSwitch(app).props.onClick();
  assert.equal(notificationSoundSwitch(app), undefined);
  await notificationSwitch(app).props.onClick();
  assert.equal(rows().length, 6);
  assert.equal(notificationSoundSwitch(app).props['aria-checked'], false);
  assert.equal(soundControl(app, 'select'), undefined);
  assert.equal(app.settingsProps().source.getSnapshot().value.notificationSound, 'mac:Ping.aiff');
  assert.equal(app.notifications.length, 0);
  app.unmount();
});

test('failed sound changes restore the saved value and report an inline error', async () => {
  for (const outdated of [false, true]) {
    const app = await mount({ formReply: () => false });
    app.set({ notificationsEnabled: true, ...(outdated ? { notificationSoundEnabled: undefined } : {}) });
    await notificationSoundSwitch(app).props.onClick();
    assert.equal(notificationSoundSwitch(app).props['aria-checked'], !outdated);
    const expected = outdated ? 'notificationUnavailable' : 'saveFailed';
    assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes(expected)));
    app.unmount();
  }
});

test('completion notifications distinguish the visible focused session, background tabs, and another session', async () => {
  const app = await mount();
  app.setSessions([notificationSession({ retainedBy: { mainView: 1 } })]);
  app.set({ notificationsEnabled: true });
  app.setDocument({ hidden: false, focused: true });
  app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false, retainedBy: { mainView: 1 } })]);
  assert.equal(app.notifications.length, 0);
  app.setDocument({ hidden: false, focused: false });
  app.setSessions([notificationSession({ seq: 20, reason: 'error', running: false, retainedBy: { mainView: 1 } })]);
  assert.equal(app.notifications.length, 1);
  app.setDocument({ hidden: false, focused: true });
  app.setSessions([notificationSession({ seq: 30, reason: 'completed', running: false })]);
  assert.equal(app.notifications.length, 2, 'Another session is out of sight even in a focused window.');
  app.notifications[1].onclick();
  assert.equal(app.windowFocusCount(), 1);
  assert.equal(app.notifications[1].closed, true);
  app.unmount();
});

test('input and approval arrivals notify even in front, deduplicate native keys, and never answer interactions', async () => {
  const app = await mount();
  const row = notificationSession({ retainedBy: { mainView: 1 } });
  app.setSessions([row]);
  app.set({ notificationsEnabled: true });
  app.setDocument({ hidden: false, focused: true });
  const question = { key: 'question:1', kind: 'question', sessionId: 'task' };
  const approval = { key: 'approval:1', kind: 'approval', sessionId: 'task' };
  app.setSessionStatus([['task', { running: true, pendingInteraction: question }]]);
  assert.equal(app.notifications.at(-1).title, 'notificationInput');
  app.setSessionStatus([['task', { running: true }]]);
  app.setSessionStatus([['task', { running: true, pendingInteraction: question }]]);
  assert.equal(app.notifications.length, 1);
  app.setSessionStatus([['task', { running: true, pendingInteraction: approval }]]);
  assert.equal(app.notifications.at(-1).title, 'notificationApproval');
  app.setSessionStatus([['task', { running: true, pendingInteraction: { key: 'plan:1', kind: 'plan-review' } }]]);
  assert.equal(app.notifications.at(-1).title, 'notificationInput');
  app.setSessionStatus([['task', { running: true }]]);
  app.setSessions([notificationSession({ seq: 10, reason: 'blocked', running: false })]);
  assert.equal(app.notifications.length, 3, 'A blocked turn must not duplicate its input or approval notice.');
  assert.deepEqual(app.rpcCalls, []);
  app.unmount();
});

test('unexplained blocked turns request input while review cards and idle historical questions stay quiet', async () => {
  const app = await mount();
  app.setSessions([notificationSession()]);
  app.set({ notificationsEnabled: true });
  app.setSessions([notificationSession({ seq: 5, reason: 'blocked', running: false })]);
  assert.equal(app.notifications.at(-1).title, 'notificationInput');
  app.setSessionStatus([['task', { running: false, pendingInteraction: { key: 'old:1', kind: 'question' } }]]);
  app.setSessionStatus([['task', { running: true, pendingInteraction: { key: 'review:1', kind: 'question', review: { readOnly: true } } }]]);
  assert.equal(app.notifications.length, 1);
  app.unmount();
});

test('startup, reconnect and enabling only seed history; disable and unload release notices and listeners', async () => {
  const app = await mount();
  app.setSessions([notificationSession({ seq: 10, reason: 'completed', running: false })]);
  app.set({ notificationsEnabled: true });
  assert.equal(app.notifications.length, 0);
  app.resetConnection();
  app.setSessions([notificationSession({ seq: 20, reason: 'error', running: false })], 'pending');
  app.setSessions([notificationSession({ seq: 20, reason: 'error', running: false })]);
  assert.equal(app.notifications.length, 0);
  app.setSessions([notificationSession({ seq: 30, reason: 'error', running: false })]);
  assert.equal(app.notifications.length, 1);
  app.set({ notificationsEnabled: false });
  assert.equal(app.notifications[0].closed, true);
  app.setSessions([notificationSession({ seq: 40, reason: 'error', running: false })]);
  app.set({ notificationsEnabled: true });
  assert.equal(app.notifications.length, 1);
  app.setSessions([notificationSession({ seq: 50, reason: 'completed', running: false })]);
  assert.equal(app.notifications.length, 2);
  assert.equal(app.notificationSubscriptions(), 3);
  app.unmount();
  assert.equal(app.notifications[1].closed, true);
  assert.equal(app.notificationSubscriptions(), 0);
  assert.equal(app.subscriptions(), 0);
  app.setSessions([notificationSession({ seq: 60, reason: 'error', running: false })]);
  assert.equal(app.notifications.length, 2);
});

test('late projection baselines and disconnected snapshots never replay a past completion', async () => {
  const app = await mount();
  app.setSessions([notificationSession({ projectionValues: undefined })]);
  app.set({ notificationsEnabled: true });
  app.setSessions([notificationSession({ seq: 10, reason: 'completed' })]);
  assert.equal(app.notifications.length, 0, 'A first projection is a baseline even while running.');
  app.setConnectionGeneration(undefined);
  app.setSessions([notificationSession({ seq: 20, reason: 'error', running: false })]);
  assert.equal(app.notifications.length, 0);
  app.setConnectionGeneration({ id: 2 });
  app.setSessions([notificationSession({ projectionValues: undefined })]);
  app.setSessions([notificationSession({ seq: 30, reason: 'error' })]);
  assert.equal(app.notifications.length, 0);
  app.setSessions([notificationSession({ seq: 40, reason: 'completed', running: false })]);
  assert.equal(app.notifications.length, 1);
  app.unmount();
});

test('delivery failure is contained and permission changes expose an actionable settings error', async () => {
  const app = await mount({ notificationFailure: true });
  app.selectSettingsTab('general');
  app.setSessions([notificationSession()]);
  app.set({ notificationsEnabled: true });
  app.setSessions([notificationSession({ seq: 10, reason: 'error', running: false })]);
  assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes('notificationFailed')));
  app.setNotificationPermission('denied');
  app.focus();
  assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes('notificationPermission')));
  await notificationSwitch(app).props.onClick();
  assert.equal(notificationSwitch(app).props['aria-checked'], false, 'Revoked permission must not prevent turning notifications off.');
  app.unmount();
});

function button(view) {
  return view.props.children.find(node => node?.props?.className === 'power-dsh-appearance-button');
}

test('Client descriptors match the Host methods, modes and strict wire codecs', async () => {
  const app = await mount();
  const wire = descriptor => JSON.parse(JSON.stringify(descriptor));
  assert.deepEqual(wire(app.rpcDescriptors), wire(MOD_RPC));
  for (const descriptor of app.rpcDescriptors) {
    const codec = descriptor.parameters[0]?.codec;
    if (codec?.typeSymbol === 'boolean') assert.throws(() => codec.create().parse('true'), /boolean/);
    if (codec?.typeSymbol === 'string') assert.throws(() => codec.create().parse(true), /string/);
  }
  app.unmount();
});

test('version badge works without theme and calls the native updater once per click operation', async () => {
  const opened = Promise.withResolvers();
  let calls = 0;
  const app = await mount({ themeAvailable: false, updates: { open() { calls++; return opened.promise; } } });
  app.set({ showVersion: true, showThemeSwitcher: true });
  assert.equal(app.render(), null);
  const badge = descendants(app.renderVersion()).find(node => node.props.className === 'power-dsh-version-badge');
  assert.ok(badge);
  assert.equal(badge.props.children[0], '0.2.2-rc.1');
  const first = badge.props.onClick();
  await badge.props.onClick();
  assert.equal(calls, 1);
  opened.resolve();
  await first;
  assert.equal(app.renderVersion(false), null);
  app.unmount();
});

test('browser version badge is visible with its updater action disabled', async () => {
  const app = await mount();
  app.set({ showVersion: true });
  const badge = descendants(app.renderVersion()).find(node => node.props.className === 'power-dsh-version-badge');
  assert.equal(badge.props.disabled, true);
  app.unmount();
});

function headerTrigger(app) {
  return descendants(app.renderHeader()).find(node => node.props['aria-label'] === 'moreActions');
}
function headerMenu(app) {
  return descendants(app.renderHeader()).find(node => node.type === 'native-menu-fixture');
}
function headerPosition(app) {
  return descendants(app.renderHeader()).find(node => node.props.className === 'power-dsh-header-menu').props.style;
}
function openHeaderMenu(app) {
  if (!headerMenu(app)?.props.open) headerTrigger(app)?.props.onClick({ stopPropagation() {} });
  return headerMenu(app);
}
function headerAction(app, id) {
  return descendants(openHeaderMenu(app)).find(node => node.props.role === 'menuitem' && node.props['data-id'] === id);
}

test('refresh preference reveals the shared horizontal menu and only selecting Refresh reloads the page', async () => {
  let reloads = 0;
  let stopped = 0;
  const app = await mount({ themeAvailable: false, reload: () => { reloads++; } });
  assert.equal(app.renderHeader(), null);
  const toggle = descendants(app.renderSettings()).find(node => node.props.id === 'settings-test-showRefreshButton');
  await toggle.props.onClick();
  assert.equal(reloads, 0);
  assert.deepEqual(app.rpcCalls, []);
  assert.equal(headerPosition(app).left, 220);
  const control = headerTrigger(app);
  assert.equal(control.props.className, 'power-dsh-header-button');
  assert.equal(control.props['aria-haspopup'], 'menu');
  assert.equal(control.props['aria-expanded'], false);
  const glyphs = descendants(control).filter(node => node.props.glyph);
  assert.deepEqual(glyphs.map(node => node.props.glyph), ['ellipsis-outline'], 'Use the installed native horizontal three-dot glyph.');
  control.props.onClick({ stopPropagation() { stopped++; } });
  assert.equal(reloads, 0, 'Opening a menu is not a refresh action.');
  assert.equal(headerTrigger(app).props['aria-expanded'], true);
  const menu = headerMenu(app);
  assert.equal(menu.props.portal, true);
  assert.equal(menu.props.autoFocus, true);
  assert.deepEqual(Array.from(menu.props.items, item => item.id), ['refresh']);
  menu.props.onClose();
  assert.equal(reloads, 0);
  assert.equal(headerTrigger(app).props['aria-expanded'], false);
  headerAction(app, 'refresh').props.onClick();
  assert.equal(reloads, 1);
  assert.equal(stopped, 1);
  assert.equal(headerTrigger(app).props['aria-expanded'], false);
  app.resize(360);
  assert.equal(headerPosition(app).left, 300);
  assert.equal(app.renderHeader(false), null);
  assert.equal(app.geometry().listeners, 0);
  assert.equal(app.geometry().observeCount, app.geometry().disconnectCount);
  app.unmount();
});

test('the shared menu follows Windows native caption chrome through mount, resize, removal and collapse', async () => {
  const app = await mount({ windows: true });
  app.set({ showRefreshButton: true, showRestartButton: true });
  assert.equal(headerPosition(app).visibility, 'hidden');
  app.setNativeMenu({ right: 174, width: 126 });
  assert.equal(headerPosition(app).left, 178);
  assert.deepEqual(Array.from(openHeaderMenu(app).props.items, item => item.id), ['refresh']);
  app.resize(400);
  assert.equal(headerPosition(app).left, 178);
  app.resizeNativeMenu({ right: 210, width: 162 });
  assert.equal(headerPosition(app).left, 214);
  app.setNativeMenu(null);
  assert.equal(headerPosition(app).visibility, 'hidden');
  app.setNativeMenu({ right: 160, width: 112 });
  assert.equal(headerPosition(app).left, 164);
  assert.equal(app.renderHeader(false), null);
  assert.deepEqual(app.chromeGeometry(), { mutations: 0, menuResizes: 0 });
  app.renderHeader(true);
  app.unmount();
  assert.deepEqual(app.chromeGeometry(), { mutations: 0, menuResizes: 0 });
});

test('the actual registered footer resolves its components and exposes one menu for every action preference combination', async () => {
  for (const [refresh, restart] of [[false, false], [true, false], [false, true], [true, true]]) {
    let reloads = 0;
    const app = await mount({ desktop: true, reload: () => { reloads++; } });
    app.set({ showVersion: true, showThemeSwitcher: true, showRefreshButton: refresh, showRestartButton: restart });
    app.renderFooter();
    await new Promise(resolve => setImmediate(resolve));
    const footer = app.renderFooter();
    assert.equal(footer.props.className, 'power-dsh-footer-seat');
    const triggers = descendants(footer).filter(node => node.props.className === 'power-dsh-header-button');
    assert.equal(triggers.length, refresh || restart ? 1 : 0);
    assert.ok(!descendants(footer).some(node => node.props.className === 'power-dsh-refresh-button' || node.props.className === 'power-dsh-restart-button'));
    if (triggers.length) {
      triggers[0].props.onClick({ stopPropagation() {} });
      const menu = descendants(app.renderFooter()).find(node => node.type === 'native-menu-fixture');
      assert.deepEqual(Array.from(menu.props.items, item => item.id), [...refresh ? ['refresh'] : [], ...restart ? ['restart'] : []]);
      assert.ok(menu.props.open);
      menu.props.onClose();
      assert.equal(headerTrigger(app).props['aria-expanded'], false);
    }
    assert.equal(reloads, 0, 'Rendering, opening and closing the shared menu must not reload.');
    assert.equal(app.restartCalls.length, 0, 'Rendering, opening and closing the shared menu must not restart.');
    assert.ok(!descendants(app.renderFooter(false)).some(node => node.props.className === 'power-dsh-header-button'));
    app.unmount();
    assert.equal(app.geometry().listeners, 0);
  }
});

test('shared menu selections reject dismissed requests, changed preferences, collapsed sidebar and unmounted controls', async () => {
  for (const invalidation of ['close', 'new-menu', 'disable', 'collapse', 'unload']) {
    let reloads = 0;
    const app = await mount({ reload: () => { reloads++; } });
    app.set({ showRefreshButton: true });
    const previous = openHeaderMenu(app);
    const select = previous.props.onSelect;
    if (invalidation === 'close' || invalidation === 'new-menu') previous.props.onClose();
    if (invalidation === 'new-menu') openHeaderMenu(app);
    if (invalidation === 'disable') app.set({ showRefreshButton: false });
    if (invalidation === 'collapse') app.renderHeader(false);
    if (invalidation === 'unload') app.unmount();
    select('refresh');
    assert.equal(reloads, 0, invalidation);
    if (invalidation !== 'unload') app.unmount();
  }
});

test('a failed menu refresh reports the error and selecting it again can retry', async () => {
  let attempts = 0;
  const app = await mount({ reload: () => { if (++attempts === 1) throw new Error('reload failed'); } });
  app.set({ showRefreshButton: true });
  headerAction(app, 'refresh').props.onClick();
  assert.ok(descendants(app.renderHeader()).some(node => node.props.role === 'alert' && node.props.children.includes('refreshFailed')));
  headerAction(app, 'refresh').props.onClick();
  assert.equal(attempts, 2);
  assert.ok(!descendants(app.renderHeader()).some(node => node.props.role === 'alert'));
  app.unmount();
});

test('appearance visibility is independent of account blocking and never replaces the native launcher', async () => {
  const app = await mount();
  assert.equal(app.render(), null);
  for (const blocked of [false, true]) {
    app.set({ showThemeSwitcher: true, blockOfficialAccount: blocked });
    assert.ok(button(app.render()));
    assert.equal(app.entries.get('settings.launcher:single'), app.nativeLauncher);
    assert.equal(app.render(false), null);
    app.set({ showThemeSwitcher: false });
    assert.equal(app.render(), null);
  }
  app.unmount();
  assert.equal(app.entries.has('sidebar.footer.action:power-dsh-footer'), false);
  assert.equal(app.entries.get('settings.launcher:single'), app.nativeLauncher);
});

test('appearance button follows native preference, reuses its icon, and stops click propagation', async () => {
  const app = await mount();
  app.set({ showThemeSwitcher: true });
  let stopped = 0;
  for (const [next, glyph] of [['light', 'followsystem-outline'], ['dark', 'light-outline'], ['system', 'dark-outline']]) {
    const control = button(app.render());
    assert.equal(control.props.disabled, false);
    assert.equal(control.props.children[0].props.glyph, glyph);
    control.props.onClick({ stopPropagation() { stopped++; } });
    assert.equal(app.calls.at(-1), next);
  }
  assert.equal(stopped, 3);
  app.unmount();
});

test('settings route policy changes to their explicit injected Host methods', async () => {
  const app = await mount();
  await app.settingsProps().setTelemetryBlocked(true);
  await app.settingsProps().setAccountBlocked(false);
  await app.settingsProps().setTodoBlocked(true);
  await app.settingsProps().setSearchBlocked(true);
  assert.deepEqual(app.rpcCalls, [
    { method: 'setTelemetryBlocked', blocked: true },
    { method: 'setAccountBlocked', blocked: false },
    { method: 'setTodoBlocked', blocked: true },
    { method: 'setSearchBlocked', blocked: true },
  ]);
  app.unmount();
});

function descendants(node) {
  if (!node || typeof node !== 'object' || node.props?.hidden) return [];
  return [node, ...(node.props?.children || []).flat().flatMap(descendants)];
}

test('settings group thirteen switches under three panels and default to General', async () => {
  const app = await mount();
  app.set({ notificationsEnabled: true });
  const groups = {
    general: ['showVersion', 'showThemeSwitcher', 'showRefreshButton', 'showRestartButton', 'notificationsEnabled', 'notificationSoundEnabled'],
    enhancements: ['personalizationEnabled', 'skillManagerEnabled', 'mcpManagerEnabled'],
    simplify: ['blockOfficialAccount', 'blockOfficialSearch', 'blockOfficialTelemetry', 'blockTodo'],
  };
  const fields = [];
  for (const [id, expected] of Object.entries(groups)) {
    if (id !== 'general') app.selectSettingsTab(id);
    const view = descendants(app.renderSettings());
    const tabs = view.filter(node => node.props.role === 'tab');
    assert.deepEqual(tabs.map(tab => tab.props.children[0]), ['generalTab', 'enhancementsTab', 'simplifyTab']);
    assert.equal(tabs.filter(tab => tab.props['aria-selected']).length, 1);
    assert.equal(tabs.filter(tab => tab.props.tabIndex === 0).length, 1);
    for (const tab of tabs) {
      const selected = tab.props.id === `settings-test-tab-${id}`;
      assert.equal(tab.props['aria-selected'], selected);
      assert.equal(tab.props.tabIndex, selected ? 0 : -1);
      assert.equal(tab.props['aria-controls'], tab.props.id.replace('-tab-', '-panel-'));
    }
    const panels = view.filter(node => node.props.role === 'tabpanel');
    assert.equal(panels.length, 1);
    const panel = panels[0];
    assert.equal(panel.props.id, `settings-test-panel-${id}`);
    assert.equal(panel.props['aria-labelledby'], `settings-test-tab-${id}`);
    const actual = view.filter(node => node.props.role === 'switch').map(node => node.props.id.replace('settings-test-', ''));
    assert.deepEqual(actual, expected);
    fields.push(...actual);
    assert.ok(!view.some(node => node.type === 'textarea'));
  }
  assert.equal(new Set(fields).size, 13);
  app.unmount();
});

test('settings tabs support wrapping arrow keys, Home and End with selection and focus together', async () => {
  const app = await mount();
  const tabs = () => descendants(app.renderSettings()).filter(node => node.props.role === 'tab');
  for (const [key, expected] of [
    ['ArrowLeft', 'simplify'], ['ArrowRight', 'general'], ['ArrowRight', 'enhancements'],
    ['ArrowRight', 'simplify'], ['ArrowRight', 'general'], ['End', 'simplify'],
    ['ArrowLeft', 'enhancements'], ['ArrowLeft', 'general'], ['Home', 'general'],
  ]) {
    let prevented = false;
    tabs().find(tab => tab.props['aria-selected']).props.onKeyDown({ key, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    const selected = tabs().find(tab => tab.props['aria-selected']);
    assert.equal(selected.props.id, `settings-test-tab-${expected}`);
    assert.equal(selected.props.tabIndex, 0);
    assert.equal(app.focusedElementId(), selected.props.id);
  }
  tabs()[0].props.onKeyDown({ key: 'Tab', preventDefault() { assert.fail('Tab must keep native focus navigation'); } });
  assert.equal(tabs()[0].props['aria-selected'], true);
  app.unmount();
});

test('pending saves reject tab clicks and keyboard changes and keep errors in the current panel', async () => {
  for (const [id, field, mechanism] of [
    ['general', 'showVersion', 'form'], ['general', 'notificationsEnabled', 'form'],
    ['enhancements', 'skillManagerEnabled', 'form'], ['simplify', 'blockTodo', 'rpc'],
  ]) {
    const reply = Promise.withResolvers();
    const app = await mount(mechanism === 'form' ? { formReply: () => reply.promise } : { rpcReply: reply.promise });
    app.selectSettingsTab(id);
    const view = () => descendants(app.renderSettings());
    const tabs = () => view().filter(node => node.props.role === 'tab');
    const oldTabs = tabs();
    const control = view().find(node => node.props.id === `settings-test-${field}`);
    const action = control.props.onClick();
    // Stale callbacks must also reject changes before a render exposes disabled tabs.
    oldTabs.find(tab => !tab.props['aria-selected']).props.onClick();
    oldTabs.find(tab => tab.props['aria-selected']).props.onKeyDown({ key: 'ArrowRight', preventDefault() {} });
    assert.equal(tabs().find(tab => tab.props['aria-selected']).props.id, `settings-test-tab-${id}`);
    assert.ok(tabs().every(tab => tab.props.disabled));
    for (const tab of tabs()) {
      tab.props.onClick();
      tab.props.onKeyDown({ key: 'End', preventDefault() {} });
    }
    assert.equal(app.focusedElementId(), null);
    assert.equal(view().find(node => node.props.role === 'tabpanel').props.id, `settings-test-panel-${id}`);
    reply.resolve(mechanism === 'form' ? false : { ok: false, error: { message: 'Native change failed' } });
    await action;
    assert.equal(view().find(node => node.props.role === 'tabpanel').props.id, `settings-test-panel-${id}`);
    assert.ok(view().some(node => node.props.role === 'alert'));
    assert.equal(view().find(node => node.props.id === `settings-test-${field}`).props['aria-checked'], false);
    assert.ok(tabs().every(tab => !tab.props.disabled));
    app.selectSettingsTab(id === 'general' ? 'enhancements' : 'general');
    assert.equal(view().find(node => node.props.role === 'tabpanel').props.id, `settings-test-panel-${id === 'general' ? 'enhancements' : 'general'}`);
    app.unmount();
  }
});

test('blocking settings omit background status and display native action errors', async () => {
  const app = await mount({ rpcError: 'Plugin change failed' });
  app.selectSettingsTab('simplify');
  app.set({ blockOfficialTelemetry: true });
  let view = descendants(app.renderSettings());
  const controls = view.filter(node => node.props.role === 'switch');
  assert.equal(controls.length, 4);
  assert.ok(!view.some(node => node.props.role === 'status' || node.props.role === 'alert'));
  await controls.find(node => node.props.id === 'settings-test-blockOfficialTelemetry').props.onClick();
  assert.deepEqual(app.rpcCalls, [{ method: 'setTelemetryBlocked', blocked: false }]);
  view = descendants(app.renderSettings());
  assert.ok(view.some(node => node.props.role === 'alert' && node.props.children.includes('Plugin change failed')));
  app.unmount();
});

test('slow policy toggles respond immediately, prevent duplicate actions, and settle on the accepted value', async () => {
  for (const field of ['blockOfficialAccount', 'blockOfficialSearch', 'blockOfficialTelemetry', 'blockTodo']) {
    for (const initial of [false, true]) {
      const reply = Promise.withResolvers();
      const app = await mount({ rpcReply: reply.promise });
      app.selectSettingsTab('simplify');
      app.set({ [field]: initial });
      const find = () => descendants(app.renderSettings()).find(node => node.props.id === `settings-test-${field}`);
      const click = find().props.onClick;
      const action = click();
      const waiting = find();
      assert.equal(waiting.props['aria-checked'], !initial);
      assert.equal(waiting.props['aria-busy'], true);
      assert.equal(waiting.props.disabled, true);
      await click();
      assert.equal(app.rpcCalls.length, 1);
      reply.resolve({ ok: true, value: { blocked: !initial } });
      await action;
      const settled = find();
      assert.equal(settled.props['aria-checked'], !initial);
      assert.equal(settled.props['aria-busy'], false);
      assert.equal(settled.props.disabled, false);
      app.unmount();
    }
  }
});

test('a failed policy action ends the busy feedback and returns the switch to its saved value', async () => {
  for (const field of ['blockOfficialAccount', 'blockOfficialSearch', 'blockOfficialTelemetry', 'blockTodo']) {
    const reply = Promise.withResolvers();
    const app = await mount({ rpcReply: reply.promise });
    app.selectSettingsTab('simplify');
    const find = () => descendants(app.renderSettings()).find(node => node.props.id === `settings-test-${field}`);
    const action = find().props.onClick();
    assert.equal(find().props['aria-checked'], true);
    reply.resolve({ ok: false, error: { message: 'Native change failed' } });
    await action;
    assert.equal(find().props['aria-checked'], false);
    assert.equal(find().props['aria-busy'], false);
    assert.equal(find().props.disabled, false);
    assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes('Native change failed')));
    app.unmount();
  }
});

async function personalization(app) {
  app.renderPersonalization();
  await app.reloadInstructions();
  const render = () => descendants(app.renderPersonalization());
  const editor = () => render().find(node => node.type === 'textarea');
  const action = key => render().find(node => node.type === 'button' && node.props.children.includes(key));
  return { render, editor, action };
}

test('personalization saves explicitly, cancels edits and preserves saved text when disabled', async () => {
  const writes = [];
  const app = await mount({ fileText: '已保存', formReply: async (field, value) => { writes.push({ field, value }); return true; } });
  app.set({ personalizationEnabled: true });
  const page = await personalization(app);
  assert.equal(page.editor().props.value, '已保存');
  const header = page.render().find(node => node.type === 'header');
  assert.equal(header.props.children.length, 2);
  assert.ok(header.props.children[0].props.children.includes('personalizationTab'));
  assert.ok(header.props.children[1].props.children.includes('全局指令（/test-dsh-home/AGENTS.md）'));
  assert.ok(!page.render().some(node => node.props.id?.endsWith('-prompt-count')));
  const actions = page.render().find(node => node.props.className === 'power-dsh-prompt-actions');
  assert.deepEqual(actions.props.children.map(node => node.props.children[0]), ['cancel', 'save']);
  assert.ok(!page.render().some(node => node.type === 'label'));
  assert.equal(page.editor().props.placeholder, 'globalPromptPlaceholder');
  page.editor().props.onChange({ target: { value: '中文草稿 {{literal}}' } });
  assert.equal(writes.length, 0);
  assert.equal(page.editor().props.value, '中文草稿 {{literal}}');
  page.action('cancel').props.onClick();
  assert.equal(page.editor().props.value, '已保存');
  page.editor().props.onChange({ target: { value: '中文保存 {{literal}}' } });
  await page.action('save').props.onClick();
  assert.equal(writes.length, 0);
  assert.deepEqual(app.fileWrites, [{ text: '中文保存 {{literal}}', revision: '1'.padStart(64, '0') }]);
  assert.equal(page.action('save').props.disabled, true);
  app.selectSettingsTab('enhancements');
  const toggle = () => descendants(app.renderSettings()).find(node => node.props.id === 'settings-test-personalizationEnabled');
  await toggle().props.onClick();
  assert.deepEqual(writes.at(-1), { field: 'personalizationEnabled', value: false });
  assert.ok(!app.entries.has('settings.section:power-dsh-personalization'));
  await toggle().props.onClick();
  assert.equal(page.editor().props.value, '中文保存 {{literal}}');
  // Empty text is a real save, allowing users to clear their instructions.
  page.editor().props.onChange({ target: { value: '' } });
  await page.action('save').props.onClick();
  assert.equal(app.fileWrites.at(-1).text, '');
  app.unmount();
});

test('failed saves retain drafts and slow saves prevent duplicate submissions', async () => {
  const response = Promise.withResolvers();
  let writes = 0;
  const app = await mount({ fileText: '原内容', fileReply: async () => { writes++; return response.promise; } });
  app.set({ personalizationEnabled: true });
  const page = await personalization(app);
  page.editor().props.onChange({ target: { value: '未丢失的草稿' } });
  const save = page.action('save').props.onClick;
  const pendingSave = save();
  assert.equal(page.editor().props.disabled, true);
  assert.equal(page.action('saving').props['aria-busy'], true);
  await save();
  assert.equal(writes, 1);
  response.resolve(false);
  await pendingSave;
  assert.equal(page.editor().props.value, '未丢失的草稿');
  assert.ok(page.render().some(node => node.props.role === 'alert' && node.props.children.includes('saveFailed')));
  page.action('cancel').props.onClick();
  assert.equal(page.editor().props.value, '原内容');
  app.unmount();
});

test('personalization detects remote changes and length limits, and respects read-only settings', async () => {
  const app = await mount();
  app.set({ personalizationEnabled: true });
  const page = await personalization(app);
  page.editor().props.onChange({ target: { value: '本地草稿' } });
  app.setFile('其他窗口保存');
  await app.reloadInstructions();
  assert.equal(page.editor().props.value, '本地草稿');
  assert.equal(page.action('save').props.disabled, true);
  assert.ok(page.render().some(node => node.props.children.includes('promptConflict')));
  page.action('cancel').props.onClick();
  assert.equal(page.editor().props.value, '其他窗口保存');
  page.editor().props.onChange({ target: { value: '字'.repeat(20001) } });
  assert.equal(page.action('save').props.disabled, true);
  assert.equal(page.editor().props['aria-invalid'], true);
  assert.ok(page.render().some(node => node.props.children.includes('promptTooLong')));
  app.unmount();
  const readOnly = await mount({ writable: false });
  readOnly.set({ personalizationEnabled: true });
  const locked = await personalization(readOnly);
  assert.equal(locked.editor().props.disabled, true);
  assert.equal(locked.action('save').props.disabled, true);
  assert.ok(!locked.render().some(node => node.props.role === 'switch'));
  readOnly.selectSettingsTab('enhancements');
  assert.equal(descendants(readOnly.renderSettings()).find(node => node.props.id === 'settings-test-personalizationEnabled').props.disabled, true);
  readOnly.unmount();
});

test('the Mod switch adds a separate native personalization tab and icon, without duplicate registrations or subscriptions', async () => {
  const app = await mount();
  const section = 'settings.section:power-dsh-personalization';
  const icon = 'settings.section.icon:power-dsh-personalization';
  const count = app.entries.size;
  const subscriptions = app.subscriptions();
  assert.ok(!app.entries.has(section));
  assert.ok(!app.entries.has(icon));
  for (let index = 0; index < 3; index++) {
    app.set({ personalizationEnabled: true });
    const entry = app.entries.get(section);
    assert.equal(entry.options.label(), 'personalizationTab');
    assert.ok(app.entries.has(icon));
    assert.ok(descendants(app.renderPersonalization()).some(node => node.type === 'textarea'));
    assert.ok(!descendants(app.renderPersonalization()).some(node => node.props.role === 'switch'));
    app.set({ globalPrompt: '保存内容' });
    assert.equal(app.entries.get(section), entry);
    assert.equal(app.entries.size, count + 2);
    app.set({ personalizationEnabled: false });
    assert.ok(!app.entries.has(section));
    assert.ok(!app.entries.has(icon));
    assert.equal(app.entries.size, count);
    assert.equal(app.subscriptions(), subscriptions);
  }
  app.set({ personalizationEnabled: true });
  app.unmount();
  assert.ok(!app.entries.has(section));
  assert.ok(!app.entries.has(icon));
  assert.equal(app.subscriptions(), 0);
});

test('personalization refreshes Host settings and leaves a rejected switch off without inline hints', async () => {
  const writes = [];
  let upgraded = false;
  const app = await mount({
    formReply: async (field, value) => { writes.push({ field, value }); return true; },
    formLoad: async () => upgraded ? { personalizationEnabled: false, globalPrompt: '' } : undefined,
  });
  app.set({ personalizationEnabled: undefined, globalPrompt: undefined });
  app.selectSettingsTab('enhancements');
  const toggle = () => descendants(app.renderSettings()).find(node => node.props.id === 'settings-test-personalizationEnabled');
  await toggle().props.onClick();
  assert.equal(writes.length, 0);
  assert.equal(toggle().props['aria-checked'], false);
  assert.ok(!descendants(app.renderSettings()).some(node => node.props.role === 'alert'));
  upgraded = true;
  await toggle().props.onClick();
  assert.deepEqual(writes, [{ field: 'personalizationEnabled', value: true }]);
  assert.ok(app.entries.has('settings.section:power-dsh-personalization'));
  assert.ok(!descendants(app.renderSettings()).some(node => node.props.role === 'alert'));
  app.unmount();
});

test('a disk revision conflict preserves the draft and cancel loads the current file', async () => {
  const app = await mount({ fileText: '旧内容' });
  app.set({ personalizationEnabled: true });
  const page = await personalization(app);
  page.editor().props.onChange({ target: { value: '本地草稿' } });
  app.setFile('另一个窗口的新内容');
  await page.action('save').props.onClick();
  assert.equal(app.fileWrites.length, 1);
  assert.equal(page.editor().props.value, '本地草稿');
  assert.ok(page.render().some(node => node.props.role === 'alert' && node.props.children.includes('promptConflict')));
  page.action('cancel').props.onClick();
  await app.reloadInstructions();
  assert.equal(page.editor().props.value, '另一个窗口的新内容');
  app.unmount();
});

test('an unreadable global file cannot be overwritten with a default empty draft', async () => {
  const app = await mount({ fileReadError: 'Cannot read global AGENTS.md' });
  app.set({ personalizationEnabled: true });
  const page = await personalization(app);
  assert.equal(page.editor().props.disabled, true);
  assert.equal(page.action('save').props.disabled, true);
  assert.equal(app.fileWrites.length, 0);
  assert.ok(page.render().some(node => node.props.children.includes('Cannot read global AGENTS.md')));
  app.unmount();
});

async function skillsPage(app, scope = 'user') {
  app.set({ skillManagerEnabled: true });
  app.renderSkills();
  await app.reloadSkills('', scope);
  const render = () => descendants(app.renderSkills());
  for (const group of render().filter(node => node.type === 'button' && node.props.id?.startsWith('settings-test-group-') && !node.props['aria-expanded'])) group.props.onClick();
  const row = name => render().find(node => node.type === 'li' && node.props['data-skill'] === name);
  const control = name => descendants(row(name)).find(node => node.props.role === 'switch');
  const search = () => render().find(node => node.type === 'input' && node.props.type === 'search');
  const select = label => render().find(node => node.type === 'select' && node.props['aria-label'] === label);
  const tab = scope => render().find(node => node.props.role === 'tab' && node.props.id === `settings-test-scope-${scope}`);
  const projectTrigger = () => render().find(node => node.type === 'button' && node.props['aria-label'] === 'skillWorkspace');
  const projectMenu = () => render().find(node => node.type === 'native-menu-fixture');
  const chooseProject = async path => {
    if (!projectMenu()?.props.open) projectTrigger()?.props.onClick();
    const item = render().find(node => node.props.role === 'menuitem' && node.props['data-id'] === path);
    assert.ok(item, `Expected an open project menu item for ${path}`);
    return item.props.onClick();
  };
  return { render, row, control, search, select, tab, projectTrigger, projectMenu, chooseProject };
}

test('the skill management switch controls only its own native page and icon and cleans subscriptions', async () => {
  const app = await mount();
  const section = 'settings.section:power-dsh-skills';
  const icon = 'settings.section.icon:power-dsh-skills';
  const baseline = app.entries.size;
  const subscriptions = app.subscriptions();
  assert.ok(!app.entries.has(section));
  assert.ok(!app.entries.has(icon));
  for (let index = 0; index < 3; index++) {
    app.set({ skillManagerEnabled: true });
    const entry = app.entries.get(section);
    assert.equal(entry.options.label(), 'skillsTab');
    assert.ok(app.entries.has(icon));
    app.set({ showVersion: true });
    assert.equal(app.entries.get(section), entry);
    assert.equal(app.entries.size, baseline + 2);
    app.set({ skillManagerEnabled: false });
    assert.ok(!app.entries.has(section));
    assert.ok(!app.entries.has(icon));
    assert.equal(app.entries.size, baseline);
    assert.equal(app.subscriptions(), subscriptions);
  }
  app.set({ skillManagerEnabled: true, personalizationEnabled: true });
  app.renderSkills();
  assert.equal(app.focusSubscriptions(), 2);
  app.unmount();
  assert.equal(app.subscriptions(), 0);
  assert.equal(app.focusSubscriptions(), 0);
  assert.ok(!app.entries.has(section));
  assert.ok(!app.entries.has(icon));
  assert.deepEqual(app.skillWrites, []);
});

test('skill management requests real scopes, keeps full hover text and searches without source selectors', async () => {
  const app = await mount({ skillCatalog: catalogFixture({ skills: [
    skillFixture(),
    skillFixture({ name: 'project-style', description: '项目文案规范', source: 'project-agents', enabled: false, modelInvocable: false, userInvocable: false }),
    skillFixture({ name: 'source-disabled', source: 'runtime', enabled: false, modelInvocable: false, userInvocable: false, canToggle: false, reason: 'source-disabled' }),
    skillFixture({ name: 'remote-style', source: 'remote-provider', description: 'Remote instructions' }),
    skillFixture({ name: 'custom-style', source: 'custom', origin: '.agents', path: '/user/.agents/skills/custom-style/SKILL.md' }),
    skillFixture({ name: 'bundled-style', source: 'bundled', origin: '@deepseek-ai/dsh-skill-office' }),
  ] }) });
  const page = await skillsPage(app);
  assert.equal(page.render().filter(node => node.type === 'li').length, 5);
  assert.ok(page.render().some(node => node.type === 'h2' && node.props.children.includes('skillsTab')));
  assert.ok(page.render().some(node => node.type === 'p' && node.props.children.includes('skillsDescription')));
  assert.ok(!page.render().some(node => node.props['aria-label'] === 'skillDirectoryHelp' || node.props.label === 'skillDirectoryHint'));
  assert.equal(page.tab('user').props['aria-selected'], true);
  assert.equal(page.projectTrigger(), undefined);
  assert.equal(page.select('skillPreset'), undefined);
  assert.equal(page.control('code-review').props['aria-checked'], true);
  const reviewDescription = descendants(page.row('code-review')).find(node => node.props.id?.endsWith('-description'));
  assert.equal(reviewDescription.props.title, undefined);
  assert.equal(reviewDescription.props.tabIndex, 0);
  const reviewTooltip = descendants(page.row('code-review')).find(node => node.type === 'native-tooltip-fixture' && node.props.label === 'Review code and boundary cases');
  assert.ok(reviewTooltip);
  assert.equal(reviewTooltip.props.portal, true);
  assert.equal(reviewTooltip.props.delayMs, 0);
  assert.equal(page.row('project-style'), undefined);
  assert.equal(page.control('source-disabled').props.disabled, true);
  assert.ok(descendants(page.row('source-disabled')).some(node => node.props.children.includes('skillSourceDisabled')));
  for (const [name, label, text] of [
    ['code-review', '/skills/code-review/SKILL.md', '.dsh'],
    ['custom-style', '/user/.agents/skills/custom-style/SKILL.md', '.agents'],
    ['bundled-style', '@deepseek-ai/dsh-skill-office', '@deepseek-ai/dsh-skill-office'],
  ]) {
    const tip = descendants(page.row(name)).find(node => node.type === 'native-tooltip-fixture' && node.props.label === label);
    assert.ok(tip);
    assert.equal(tip.props.portal, true);
    assert.equal(tip.props.delayMs, 0);
    const anchor = tip.props.children[0];
    assert.ok(anchor.props.children.includes(text));
    assert.equal(anchor.props.title, undefined);
    assert.equal(anchor.props.tabIndex, 0);
  }
  assert.equal(page.select('skillSources'), undefined);
  for (const name of ['code-review', 'custom-style', 'remote-style', 'source-disabled', 'bundled-style']) {
    assert.ok(!descendants(page.row(name)).some(node => node.props.children.includes('skillPersonalSource') || node.props.children.includes('skillBundledSource')));
    assert.equal(descendants(page.row(name)).filter(node => node.type === 'button').length, 1);
  }
  page.search().props.onChange({ target: { value: 'Remote instructions' } });
  assert.ok(page.row('remote-style'));
  assert.equal(page.row('code-review'), undefined);
  page.search().props.onChange({ target: { value: '' } });
  page.search().props.onChange({ target: { value: 'skillBundledSource' } });
  assert.equal(page.render().filter(node => node.type === 'li').length, 2);
  assert.ok(page.row('source-disabled'));
  assert.ok(page.row('bundled-style'));
  page.search().props.onChange({ target: { value: '' } });
  const reads = app.skillReads.length;
  await page.tab('project').props.onClick();
  assert.equal(app.skillReads.length, reads + 1);
  assert.equal(app.skillReads.at(-1).scope, 'project');
  assert.equal(page.tab('project').props['aria-selected'], true);
  assert.equal(page.select('skillSources'), undefined);
  assert.equal(page.render().filter(node => node.type === 'li').length, 1);
  assert.equal(page.row('code-review'), undefined);
  assert.equal(page.control('project-style').props['aria-checked'], false);
  assert.equal(page.projectMenu().props.selectedId, '/work/a');
  assert.equal(page.select('skillPreset'), undefined);
  page.search().props.onChange({ target: { value: '文案' } });
  assert.ok(page.row('project-style'));
  assert.deepEqual(app.skillWrites, []);
  app.unmount();
});

test('native skill groups collapse locally, search reveals matching groups and clearing restores manual choices', async () => {
  const app = await mount({ skillCatalog: catalogFixture({ skills: [
    skillFixture({ name: 'preinstalled-skill', source: 'bundled' }),
    skillFixture({ name: 'personal-skill', source: 'user-dsh' }),
  ] }) });
  app.set({ skillManagerEnabled: true });
  app.renderSkills();
  await app.reloadSkills();
  const render = () => descendants(app.renderSkills());
  const group = name => render().find(node => node.type === 'button' && node.props.id === `settings-test-group-${name}`);
  const card = name => render().find(node => node.type === 'li' && node.props['data-skill'] === name);
  const search = () => render().find(node => node.type === 'input' && node.props.type === 'search');
  assert.equal(group('preinstalled').props['aria-expanded'], false);
  assert.equal(group('personal').props['aria-expanded'], true);
  assert.deepEqual(render().filter(node => node.type === 'button' && /-group-/.test(node.props.id ?? '')).map(node => node.props.id), [
    'settings-test-group-personal', 'settings-test-group-preinstalled',
  ]);
  assert.ok(card('personal-skill'));
  assert.equal(card('preinstalled-skill'), undefined);
  assert.equal(render().filter(node => node.props.role === 'switch').length, 1);
  const reads = app.skillReads.length;
  group('personal').props.onClick();
  assert.equal(card('personal-skill'), undefined);
  assert.ok(!render().some(node => node.props.role === 'switch'));
  search().props.onChange({ target: { value: 'personal-skill' } });
  assert.equal(group('preinstalled'), undefined);
  assert.equal(group('personal').props['aria-expanded'], true);
  assert.ok(card('personal-skill'));
  assert.ok(descendants(card('personal-skill')).some(node => node.props.role === 'switch'));
  assert.ok(!descendants(card('personal-skill')).some(node => node.props['aria-expanded'] !== undefined));
  search().props.onChange({ target: { value: '' } });
  assert.equal(group('preinstalled').props['aria-expanded'], false);
  assert.equal(group('personal').props['aria-expanded'], false);
  assert.equal(card('personal-skill'), undefined);
  assert.deepEqual(app.skillWrites, []);
  assert.equal(app.skillReads.length, reads);
  app.unmount();
});

test('skill cards expose switches directly, reject old project actions and keep MCP independent', async () => {
  const app = await mount({ skillCatalog: catalogFixture({ skills: [
    skillFixture({ name: 'same-name', source: 'user-dsh' }),
    skillFixture({ name: 'same-name', source: 'project-dsh' }),
  ] }) });
  const page = await skillsPage(app);
  assert.equal(page.control('same-name').props['aria-checked'], true);
  const oldGlobalAction = page.control('same-name').props.onClick;
  assert.ok(!descendants(page.row('same-name')).some(node => node.props['aria-expanded'] !== undefined));
  await page.tab('project').props.onClick();
  assert.ok(page.row('same-name'));
  assert.equal(page.control('same-name').props['aria-checked'], true);
  await oldGlobalAction();
  assert.deepEqual(app.skillWrites, []);
  const oldProjectAction = page.control('same-name').props.onClick;
  await page.chooseProject('/work/b');
  assert.equal(page.control('same-name').props['aria-checked'], true);
  await oldProjectAction();
  assert.deepEqual(app.skillWrites, []);
  assert.ok(!descendants(page.row('same-name')).some(node => node.props['aria-expanded'] !== undefined));
  const mcp = await mcpPage(app);
  assert.ok(mcp.control('browser'));
  assert.equal(mcp.toggle('browser').props['aria-expanded'], false);
  mcp.toggle('browser').props.onClick();
  assert.equal(mcp.toggle('browser').props['aria-expanded'], true);
  assert.ok(!descendants(page.row('same-name')).some(node => node.props['aria-expanded'] !== undefined));
  assert.deepEqual(app.skillWrites, []);
  assert.deepEqual(app.mcpWrites, []);
  app.unmount();
});

test('the skills page never shows a load failure as an empty catalog and disables incomplete or read-only writes', async () => {
  const failed = await mount({ skillReadError: 'Skill catalog unavailable' });
  const bad = await skillsPage(failed);
  assert.ok(bad.render().some(node => node.props.role === 'alert'));
  assert.ok(!bad.render().some(node => node.props.children.includes('skillEmpty')));
  assert.ok(!bad.render().some(node => node.props.role === 'switch'));
  failed.unmount();
  const partial = await mount({ skillCatalog: catalogFixture({ complete: false }) });
  const incomplete = await skillsPage(partial);
  assert.equal(incomplete.control('code-review').props.disabled, true);
  await incomplete.control('code-review').props.onClick();
  assert.deepEqual(partial.skillWrites, []);
  assert.ok(incomplete.render().some(node => node.props.children.includes('skillIncomplete')));
  partial.unmount();
  const locked = await mount({ writable: false });
  const readOnly = await skillsPage(locked);
  assert.equal(readOnly.control('code-review').props.disabled, true);
  await readOnly.control('code-review').props.onClick();
  assert.deepEqual(locked.skillWrites, []);
  locked.unmount();
});

test('slow skill changes preserve accepted state and block duplicate writes, context changes and focus reloads', async () => {
  const response = Promise.withResolvers();
  const app = await mount({ skillReply: () => response.promise, skillCatalog: catalogFixture({ skills: [skillFixture({ source: 'project-dsh' })] }) });
  const page = await skillsPage(app, 'project');
  const click = page.control('code-review').props.onClick;
  page.projectTrigger().props.onClick();
  const changeContext = page.projectMenu().props.onSelect;
  const action = click();
  assert.equal(page.control('code-review').props['aria-checked'], true);
  assert.equal(page.control('code-review').props['aria-busy'], true);
  assert.equal(page.control('code-review').props.disabled, true);
  assert.equal(page.projectTrigger().props.disabled, true);
  assert.equal(page.tab('user').props.disabled, true);
  assert.equal(page.tab('project').props.disabled, true);
  assert.equal(page.select('skillPreset'), undefined);
  const reads = app.skillReads.length;
  changeContext('/work/b');
  page.projectTrigger().props.onClick();
  assert.equal(page.projectMenu().props.open, false);
  app.focus();
  await click();
  assert.equal(app.skillReads.length, reads);
  assert.equal(app.skillWrites.length, 1);
  response.resolve({ ok: true, value: catalogFixture({ cwd: '/work/a', scope: 'project', skills: [skillFixture({ source: 'project-dsh', enabled: false, modelInvocable: false, userInvocable: false })] }) });
  await action;
  assert.equal(page.control('code-review').props['aria-checked'], false);
  assert.equal(page.control('code-review').props.disabled, false);
  assert.deepEqual(app.skillWrites[0], { cwd: '/work/a', scope: 'project', name: 'code-review', enabled: false });
  app.unmount();
});

test('a failed skill change reads backend facts again and keeps its row error actionable', async () => {
  const app = await mount({ skillReply: async () => {
    app.setSkills(catalogFixture({ skills: [skillFixture({ enabled: false, modelInvocable: false, userInvocable: false })] }));
    return { ok: false, error: { message: 'Skill change was rejected' } };
  } });
  const page = await skillsPage(app);
  const reads = app.skillReads.length;
  await page.control('code-review').props.onClick();
  assert.equal(app.skillReads.length, reads + 1);
  assert.equal(page.control('code-review').props['aria-checked'], false);
  assert.equal(page.control('code-review').props.disabled, false);
  assert.ok(descendants(page.row('code-review')).some(node => node.props.role === 'alert' && node.props.children.includes('Skill change was rejected')));
  app.unmount();
});

test('skill context selection discards stale reads, preserves the project selector and ignores replies after unload', async () => {
  const old = Promise.withResolvers();
  const latest = Promise.withResolvers();
  const late = Promise.withResolvers();
  const app = await mount({ skillList: (cwd, scope) => {
    if (cwd === '/work/a' && scope === 'project') return old.promise;
    if (cwd === '/work/b' && scope === 'project') return latest.promise;
    if (cwd === '/work/late' && scope === 'project') return late.promise;
    return { ok: true, value: catalogFixture() };
  } });
  const page = await skillsPage(app);
  // Start an older refresh, then a new context before the first completes.
  const first = app.reloadSkills('/work/a', 'project');
  const second = app.reloadSkills('/work/b', 'project');
  latest.resolve({ ok: true, value: catalogFixture({ cwd: '/work/b', scope: 'project', workspaces: [{ path: '/work/b', title: 'Project Beta' }], skills: [skillFixture({ name: 'new-context', source: 'project-dsh' })] }) });
  await second;
  assert.ok(page.row('new-context'));
  assert.equal(page.projectMenu().props.selectedId, '/work/b');
  const singleProject = page.projectMenu().props.items;
  assert.equal(singleProject.length, 1);
  assert.equal(singleProject[0].id, '/work/b');
  assert.equal(singleProject[0].label.props.children[0], 'Project Beta');
  assert.equal(singleProject[0].label.props.title, '/work/b');
  assert.equal(page.projectTrigger().props.title, '/work/b');
  assert.equal(page.select('skillPreset'), undefined);
  old.resolve({ ok: true, value: catalogFixture() });
  await first;
  assert.ok(page.row('new-context'));
  assert.equal(page.row('code-review'), undefined);
  const source = app.skillsProps().skillsSource;
  const pending = app.reloadSkills('/work/late', 'project');
  const before = source.getSnapshot();
  app.unmount();
  late.resolve({ ok: true, value: catalogFixture() });
  await pending;
  assert.equal(source.getSnapshot(), before);
});

test('project choices show imported titles, retain path identities and recover after a selected project disappears', async () => {
  const app = await mount({ skillCatalog: catalogFixture({ workspaces: [
    { path: '/work/a', title: 'Same project' }, { path: '/work/b', title: 'Same project' },
  ], skills: [skillFixture({ source: 'project-dsh' })] }) });
  const page = await skillsPage(app, 'project');
  const options = page.projectMenu().props.items;
  assert.deepEqual(Array.from(options, item => ({ value: item.id, title: item.label.props.title, label: item.label.props.children[0] })), [
    { value: '/work/a', title: '/work/a', label: 'Same project (/work/a)' },
    { value: '/work/b', title: '/work/b', label: 'Same project (/work/b)' },
  ]);
  await page.chooseProject('/work/b');
  assert.deepEqual(app.skillReads.at(-1), { cwd: '/work/b', scope: 'project' });
  await page.tab('user').props.onClick();
  assert.equal(page.projectTrigger(), undefined);
  assert.deepEqual(app.skillReads.at(-1), { cwd: '', scope: 'user' });
  await page.tab('project').props.onClick();
  assert.deepEqual(app.skillReads.at(-1), { cwd: '/work/b', scope: 'project' });
  assert.equal(page.projectMenu().props.selectedId, '/work/b');
  app.setSkills(catalogFixture({ cwd: '/work/a', scope: 'project', workspaces: [{ path: '/work/a', title: 'Remaining project' }], skills: [] }));
  await app.reloadSkills('/work/a', 'project');
  assert.equal(page.projectMenu().props.selectedId, '/work/a');
  assert.equal(page.projectMenu().props.items[0].label.props.children[0], 'Remaining project');
  app.unmount();
});

test('the native project Menu receives controlled selection, closes locally and rejects stale project choices', async () => {
  const longTitle = 'Project with a long imported display name '.repeat(5);
  const app = await mount({ skillCatalog: catalogFixture({ workspaces: [
    { path: '/work/a', title: longTitle }, { path: '/work/b', title: 'Project Beta' },
  ], skills: [] }) });
  const page = await skillsPage(app, 'project');
  const menu = () => page.projectMenu().props;
  assert.equal(menu().align, 'end');
  assert.equal(menu().portal, true);
  assert.equal(menu().autoFocus, true);
  assert.equal(menu().selectedId, '/work/a');
  assert.equal(menu().open, false);
  assert.ok(descendants(page.projectTrigger()).some(node => node.props.children.includes(longTitle)));
  const toolbar = page.render().find(node => node.props.className === 'power-dsh-project-search-row');
  assert.ok(descendants(toolbar).some(node => node.type === 'native-menu-fixture'));
  assert.ok(descendants(toolbar).some(node => node.type === 'input' && node.props.type === 'search'));
  page.projectTrigger().props.onClick();
  assert.equal(menu().open, true);
  const selectedItem = page.render().find(node => node.props.role === 'menuitem' && node.props['data-id'] === '/work/a');
  assert.equal(selectedItem.props['aria-current'], true);
  const reads = app.skillReads.length;
  await selectedItem.props.onClick();
  assert.equal(menu().open, false);
  assert.equal(app.skillReads.length, reads);
  page.projectTrigger().props.onClick();
  menu().onClose();
  assert.equal(menu().open, false);
  assert.equal(app.skillReads.length, reads);
  page.projectTrigger().props.onClick();
  const staleSelect = menu().onSelect;
  await staleSelect('/not-imported');
  assert.equal(app.skillReads.length, reads);
  app.setSkills(catalogFixture({ cwd: '/work/a', scope: 'project', workspaces: [{ path: '/work/a', title: longTitle }], skills: [] }));
  await app.reloadSkills('/work/a', 'project');
  const updatedReads = app.skillReads.length;
  await staleSelect('/work/b');
  assert.equal(app.skillReads.length, updatedReads);
  page.projectTrigger().props.onClick();
  await page.tab('user').props.onClick();
  assert.equal(page.projectMenu(), undefined);
  const globalReads = app.skillReads.length;
  await staleSelect('/work/a');
  assert.equal(app.skillReads.length, globalReads);
  app.unmount();
});

test('a project read failure keeps imported choices available for recovery and no-project state is explicit', async () => {
  const app = await mount({ skillList: (cwd, scope) => {
    if (scope === 'user') return { ok: true, value: catalogFixture() };
    if (cwd === '/work/b') return { ok: true, value: catalogFixture({ cwd, scope, skills: [] }) };
    return { ok: false, error: { message: 'Selected project no longer exists' } };
  } });
  const page = await skillsPage(app);
  await page.tab('project').props.onClick();
  assert.ok(page.render().some(node => node.props.role === 'alert'));
  assert.equal(page.projectTrigger().props.disabled, false);
  await page.chooseProject('/work/b');
  assert.equal(page.projectMenu().props.selectedId, '/work/b');
  assert.ok(!page.render().some(node => node.props.role === 'alert'));
  app.unmount();
  const none = await mount({ skillCatalog: catalogFixture({ workspaces: [], skills: [] }) });
  const empty = await skillsPage(none, 'project');
  assert.equal(empty.projectTrigger().props.disabled, true);
  assert.ok(descendants(empty.projectTrigger()).some(node => node.props.children.includes('skillNoProjects')));
  assert.equal(empty.projectMenu().props.items.length, 0);
  empty.projectTrigger().props.onClick();
  assert.equal(empty.projectMenu().props.open, false);
  assert.ok(empty.render().some(node => node.type === 'p' && node.props.children.includes('skillNoProjects')));
  assert.ok(!empty.render().some(node => node.props.children.includes('skillEmpty')));
  none.unmount();
});

test('the skill management preference refreshes the Host mirror and reports rejected changes inline', async () => {
  let upgraded = false;
  const writes = [];
  const app = await mount({
    formReply: async (field, value) => { writes.push({ field, value }); return true; },
    formLoad: async () => upgraded ? { skillManagerEnabled: false } : undefined,
  });
  app.set({ skillManagerEnabled: undefined });
  app.selectSettingsTab('enhancements');
  const toggle = () => descendants(app.renderSettings()).find(node => node.props.id === 'settings-test-skillManagerEnabled');
  await toggle().props.onClick();
  assert.deepEqual(writes, []);
  assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes('skillManagerOutdated')));
  upgraded = true;
  await toggle().props.onClick();
  assert.deepEqual(writes, [{ field: 'skillManagerEnabled', value: true }]);
  assert.ok(app.entries.has('settings.section:power-dsh-skills'));
  app.unmount();
});

test('skill catalog codecs validate every field and discard data outside the public contract', async () => {
  const app = await mount();
  for (const descriptor of app.rpcDescriptors.filter(item => item.method === 'listSkills' || item.method === 'setSkillEnabled')) {
    for (const parameter of descriptor.parameters) {
      const codec = parameter.codec.create();
      assert.throws(() => codec.parse(parameter.name === 'enabled' ? 'false' : false), /boolean|string/);
    }
    const codec = descriptor.result.create();
    const result = codec.parse({ ...catalogFixture(), rawConfig: 'not public', workspaces: [{ path: '/work/a', title: 'Project Alpha', rawConfig: 'private' }], skills: [skillFixture({ env: { SECRET: 'not public' } })] });
    assert.equal('rawConfig' in result, false);
    assert.equal('env' in result.skills[0], false);
    assert.deepEqual(Object.keys(result.workspaces[0]).sort(), ['path', 'title']);
    for (const changed of [{ cwd: null }, { scope: false }, { scope: 'mode' }, { complete: 'true' }, { workspaces: [1] }, { workspaces: [{ path: '/work/a' }] }, { workspaces: [{ path: false, title: 'Invalid' }] }, { skills: [skillFixture({ enabled: 'true' })] }, { skills: [skillFixture({ enabled: false })] }, { skills: [skillFixture({ path: undefined })] }, { skills: [skillFixture({ origin: undefined })] }, { skills: [skillFixture({ origin: false })] }]) {
      assert.throws(() => codec.parse({ ...catalogFixture(), ...changed }), /Invalid skill/);
    }
  }
  app.unmount();
});

async function mcpPage(app, language) {
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
  return { render, row, control, search, group, toggle, tools, summary };
}

test('the MCP preference owns a separate page and icon with independent lifecycle and no server changes', async () => {
  const app = await mount();
  const section = 'settings.section:power-dsh-mcp';
  const icon = 'settings.section.icon:power-dsh-mcp';
  const baseline = app.entries.size;
  const subscriptions = app.subscriptions();
  for (let index = 0; index < 3; index++) {
    assert.ok(!app.entries.has(section));
    app.set({ mcpManagerEnabled: true });
    const entry = app.entries.get(section);
    assert.equal(entry.options.label(), 'mcpTab');
    assert.ok(app.entries.has(icon));
    app.set({ showVersion: true });
    assert.equal(app.entries.get(section), entry);
    assert.equal(app.entries.size, baseline + 2);
    app.set({ mcpManagerEnabled: false });
    assert.ok(!app.entries.has(section));
    assert.ok(!app.entries.has(icon));
    assert.equal(app.entries.size, baseline);
    assert.equal(app.subscriptions(), subscriptions);
  }
  app.set({ mcpManagerEnabled: true, skillManagerEnabled: true });
  assert.ok(app.entries.has('settings.section:power-dsh-skills'));
  app.renderMcp();
  app.renderSkills();
  assert.equal(app.focusSubscriptions(), 3);
  app.unmount();
  assert.ok(!app.entries.has(section));
  assert.ok(!app.entries.has(icon));
  assert.equal(app.focusSubscriptions(), 0);
  assert.equal(app.subscriptions(), 0);
  assert.deepEqual(app.mcpWrites, []);
});

test('MCP lists actual enabled state without inventing server descriptions or connection status', async () => {
  const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers: [
    mcpFixture(),
    mcpFixture({ id: 'include:files', name: 'files', enabled: false }),
    mcpFixture({ id: 'preset:standard/browser', name: 'preset-browser', source: 'preset:standard', group: 'builtin', canToggle: false, reason: 'preset-managed' }),
    mcpFixture({ id: 'include:conditional', name: 'conditional', stateKnown: false, canToggle: true, reason: 'conditional' }),
    mcpFixture({ id: 'include:future', name: 'future', canToggle: true, reason: 'unknown-restriction' }),
  ] }) });
  const page = await mcpPage(app);
  assert.equal(page.group('builtin').props['aria-expanded'], false);
  assert.equal(page.row('preset-browser'), undefined);
  page.group('builtin').props.onClick();
  assert.equal(page.render().filter(node => node.props.role === 'switch').length, 4);
  assert.equal(page.control('browser').props['aria-checked'], true);
  assert.equal(page.control('files').props['aria-checked'], false);
  assert.equal(page.control('preset-browser').props.disabled, true);
  assert.equal(page.control('conditional'), undefined);
  assert.equal(page.control('future').props.disabled, true);
  assert.ok(descendants(page.row('preset-browser')).some(node => node.props.children.includes('mcpPresetManaged')));
  assert.ok(descendants(page.row('conditional')).some(node => node.props.children.includes('mcpStateUnknown')));
  assert.ok(descendants(page.row('future')).some(node => node.props.children.includes('mcpReadOnly')));
  assert.ok(!descendants(page.row('browser')).some(node => node.type === 'p'));
  assert.ok(!page.render().some(node => node.type !== 'style' && node.props.children.some(child => typeof child === 'string' && /connected|online|已连接|在线/i.test(child))));
  for (const name of ['preset-browser', 'future']) await page.control(name).props.onClick();
  assert.deepEqual(app.mcpWrites, []);
  page.search().props.onChange({ target: { value: 'standard' } });
  assert.ok(page.row('preset-browser'));
  assert.equal(page.row('browser'), undefined);
  page.search().props.onChange({ target: { value: '' } });
  assert.ok(page.row('preset-browser'));
  assert.ok(!page.render().some(node => node.type === 'select'));
  page.group('builtin').props.onClick();
  assert.equal(page.row('preset-browser'), undefined);
  assert.equal(page.render().filter(node => node.type === 'li').length, 4);
  app.unmount();
});

test('MCP shows localized runtime state independently of its enable switch without claiming connectivity', async () => {
  const labels = {
    en: { pending: 'Pending', loading: 'Loading', active: 'Running', failed: 'Failed to load', unloading: 'Unloading', inactive: 'Not running' },
    zh: { pending: '等待中', loading: '加载中', active: '运行中', failed: '加载失败', unloading: '卸载中', inactive: '未运行' },
  };
  for (const language of ['en', 'zh']) {
    const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers: [
      ...Object.keys(labels[language]).map(runtimeState => mcpFixture({ id: `state:${runtimeState}`, name: runtimeState, runtimeState })),
      mcpFixture({ id: 'state:disabled', name: 'disabled', enabled: false, runtimeState: 'disabled' }),
      mcpFixture({ id: 'state:unknown', name: 'unknown', runtimeState: 'unknown' }),
      mcpFixture({ id: 'state:active-off', name: 'active-off', enabled: false, runtimeState: 'active' }),
    ] }) });
    const page = await mcpPage(app, language);
    const status = name => descendants(page.row(name)).find(node => node.props.className === 'power-dsh-mcp-runtime');
    for (const [state, label] of Object.entries(labels[language])) {
      const indicator = status(state);
      if (['pending', 'loading', 'unloading'].includes(state)) {
        assert.equal(indicator.props['aria-label'], label);
        assert.equal(indicator.props.children[0].type, 'native-state-dot-fixture');
        assert.equal(indicator.props.children[0].props.state, 'ongoing');
        assert.ok(!indicator.props.children.some(child => typeof child === 'string'));
      } else {
        assert.equal(indicator.props.children[0].type, 'native-state-dot-fixture');
        assert.equal(indicator.props.children[0].props.state, { active: 'done', failed: 'error', inactive: 'idle' }[state]);
        assert.equal(indicator.props.children[1], label);
        assert.equal(indicator.props['aria-label'], undefined);
      }
      assert.equal(status(state).props.role, 'status');
      assert.equal(status(state).props['data-state'], state);
      assert.equal(page.control(state).props['aria-checked'], true);
    }
    assert.equal(status('unknown'), undefined);
    assert.ok(!descendants(page.row('unknown')).some(node => node.props.className === 'power-dsh-mcp-card-meta'));
    for (const name of ['disabled', 'active-off']) {
      assert.equal(status(name).props.children[0].props.state, 'idle');
      assert.equal(status(name).props.children[1], language === 'en' ? 'Disabled' : '已关闭');
      assert.equal(status(name).props['data-state'], 'disabled');
      assert.equal(status(name).props.role, 'status');
      const meta = descendants(page.row(name)).find(node => node.props.className === 'power-dsh-mcp-card-meta');
      assert.ok(meta.props.children.some(child => child?.props?.className === 'power-dsh-mcp-runtime'), 'disabled and running share the same status row');
    }
    assert.equal(page.control('active-off').props['aria-checked'], false);
    assert.ok(!page.render().some(node => node.props.children.some(child => typeof child === 'string' && /online|connected|在线|已连接/.test(child))));
    app.unmount();
    assert.deepEqual(app.intervals(), []);
  }
});

test('MCP polls visible runtime status without blocking tools and releases refreshes on unmount', async () => {
  let reply;
  const app = await mount({ mcpList: () => reply?.promise ?? { ok: true, value: mcpCatalogFixture() } });
  const page = await mcpPage(app);
  const reads = app.mcpReads.length;
  assert.deepEqual(app.intervals(), [2000]);
  await app.tickIntervals();
  assert.equal(app.mcpReads.length, reads, 'hidden pages do not poll');
  app.setDocument({ hidden: false });
  reply = Promise.withResolvers();
  const pending = app.tickIntervals();
  assert.equal(app.mcpReads.length, reads + 1);
  assert.equal(app.mcpProps().mcpSource.getSnapshot().status, 'ready');
  assert.equal(page.control('browser').props.disabled, false);
  page.toggle('browser').props.onClick();
  await app.tickIntervals();
  assert.equal(app.mcpReads.length, reads + 1, 'background reads never overlap');
  reply.resolve({ ok: true, value: mcpCatalogFixture({ servers: [mcpFixture({ runtimeState: 'failed' })] }) });
  await pending;
  assert.equal(descendants(page.row('browser')).find(node => node.props.className === 'power-dsh-mcp-runtime').props.children[1], 'mcpRuntimeFailed');
  assert.equal(page.toggle('browser').props['aria-expanded'], true);
  reply = Promise.withResolvers();
  const late = app.tickIntervals();
  const source = app.mcpProps().mcpSource;
  const before = source.getSnapshot();
  app.unmount();
  assert.deepEqual(app.intervals(), []);
  reply.resolve({ ok: true, value: mcpCatalogFixture() });
  await late;
  assert.equal(source.getSnapshot(), before);
});

test('MCP background state cannot overwrite a switch write and polling skips pending writes', async () => {
  const stale = Promise.withResolvers();
  const write = Promise.withResolvers();
  let deferRead = false;
  const app = await mount({
    mcpList: () => deferRead ? stale.promise : { ok: true, value: mcpCatalogFixture() },
    mcpReply: () => write.promise,
  });
  const page = await mcpPage(app);
  app.setDocument({ hidden: false });
  deferRead = true;
  const background = app.tickIntervals();
  const operation = page.control('browser').props.onClick();
  const reads = app.mcpReads.length;
  await app.tickIntervals();
  assert.equal(app.mcpReads.length, reads);
  write.resolve({ ok: true, value: mcpCatalogFixture({ servers: [mcpFixture({ enabled: false, runtimeState: 'disabled' })] }) });
  await operation;
  stale.resolve({ ok: true, value: mcpCatalogFixture() });
  await background;
  assert.equal(page.control('browser').props['aria-checked'], false);
  assert.equal(app.mcpProps().mcpSource.getSnapshot().value.servers[0].runtimeState, 'disabled');
  app.unmount();
  assert.deepEqual(app.intervals(), []);
});

test('MCP second-row tags use verified local and HTTP transports, omit unknown types and remain searchable', async () => {
  for (const [language, localLabel] of [['en', 'Local'], ['zh', '本地']]) {
    const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers: [
      mcpFixture({ id: 'transport:stdio', name: 'process-server', transport: 'stdio', tools: ['run'] }),
      mcpFixture({ id: 'transport:http', name: 'network-server', transport: 'streamable-http', enabled: false }),
      mcpFixture({ id: 'transport:unknown', name: 'opaque-server', transport: 'unknown' }),
    ] }) });
    const page = await mcpPage(app, language);
    const tag = name => descendants(page.row(name)).find(node => node.props.className === 'power-dsh-mcp-transport');
    for (const [name, label, transport] of [['process-server', localLabel, 'stdio'], ['network-server', 'HTTP', 'streamable-http']]) {
      const badge = tag(name);
      assert.equal(badge.type, 'span');
      assert.equal(badge.props.children[0], label);
      assert.equal(badge.props['data-transport'], transport);
      const content = page.row(name).props.children.find(node => node?.props?.className === 'power-dsh-skill-card-content');
      const lines = content.props.children.filter(Boolean);
      assert.equal(lines[0].props.className, 'power-dsh-skill-card-main');
      assert.equal(lines[1].type, 'div');
      assert.equal(lines[1].props.className, 'power-dsh-mcp-card-meta');
      assert.equal(lines[1].props.children[0].props.id, badge.props.id);
      assert.equal(lines[1].props.children[1].props.className, 'power-dsh-mcp-runtime');
      assert.ok(!descendants(lines[0]).some(node => node.props.className === 'power-dsh-mcp-runtime'));
      assert.equal(lines[1].props.onClick, undefined);
      const toggle = page.toggle(name);
      if (name === 'network-server') {
        assert.equal(toggle, undefined);
        assert.equal(lines.length, 3);
        assert.equal(lines[2].props['data-state'], 'disabled');
        assert.equal(lines[2].props.children[0], language === 'en' ? 'No available tools' : '暂无可用工具');
        assert.equal(lines[2].props.onClick, undefined);
        assert.equal(lines[1].props.children[1].props.children[1], language === 'en' ? 'Disabled' : '已关闭');
        continue;
      }
      assert.equal(lines[2].props.className, toggle.props.className);
      const children = toggle.props.children.filter(Boolean);
      assert.equal(children[0].props.id, page.summary(name).props.id);
      assert.equal(children[1].type.name, 'SkillChevron');
      assert.ok(!descendants(toggle).some(node => node.props.className === 'power-dsh-mcp-transport'));
      assert.equal(toggle.props['aria-labelledby'], `${page.row(name).props['aria-labelledby']} ${page.summary(name).props.id}`);
    }
    assert.equal(tag('opaque-server'), undefined);
    assert.equal(page.control('network-server').props['aria-checked'], false);
    page.search().props.onChange({ target: { value: 'HTTP' } });
    assert.ok(page.row('network-server'));
    assert.equal(page.row('process-server'), undefined);
    assert.equal(page.row('opaque-server'), undefined);
    page.search().props.onChange({ target: { value: localLabel } });
    assert.ok(page.row('process-server'));
    assert.equal(page.row('network-server'), undefined);
    page.toggle('process-server').props.onClick();
    assert.equal(page.tools('process-server').props.hidden, false);
    assert.equal(page.control('process-server').props['aria-checked'], true);
    assert.deepEqual(app.mcpWrites, []);
    app.unmount();
  }
});

test('MCP global groups use explicit membership and restore manual choices after search', async () => {
  const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers: [
    mcpFixture(),
    mcpFixture({ id: 'preset:standard/browser', name: 'mode-browser', source: 'preset:standard', group: 'builtin', canToggle: false, reason: 'preset-managed' }),
    mcpFixture({ id: 'provider:files', name: 'provider-files', source: 'provider:local-files', group: 'user', canToggle: false }),
    mcpFixture({ id: 'include:plugin', name: 'plugin-browser', source: 'profile', origin: '@vendor/mcp-plugin', group: 'builtin' }),
  ] }) });
  const page = await mcpPage(app);
  assert.deepEqual(page.render().filter(node => node.props.id?.includes('-mcp-group-') && node.type === 'button').map(node => node.props.children[1].props.children[0]), [
    'skillPersonalGroup', 'skillPreinstalledGroup',
  ]);
  assert.equal(page.group('user').props['aria-expanded'], true);
  assert.equal(page.group('builtin').props['aria-expanded'], false);
  assert.ok(page.row('browser'));
  assert.ok(page.row('provider-files'));
  assert.equal(page.row('mode-browser'), undefined);
  assert.equal(page.row('plugin-browser'), undefined);
  const reads = app.mcpReads.length;
  page.group('user').props.onClick();
  assert.equal(page.row('browser'), undefined);
  page.search().props.onChange({ target: { value: 'browser' } });
  assert.equal(page.group('user').props['aria-expanded'], true);
  assert.equal(page.group('builtin').props['aria-expanded'], true);
  assert.ok(page.row('mode-browser'));
  page.group('builtin').props.onClick();
  page.search().props.onChange({ target: { value: '' } });
  for (const group of ['user', 'builtin']) assert.equal(page.group(group).props['aria-expanded'], false);
  assert.equal(page.render().filter(node => node.type === 'li').length, 0);
  assert.ok(!page.render().some(node => node.props.children.includes('mcpEmpty')));
  page.group('builtin').props.onClick();
  page.search().props.onChange({ target: { value: '@vendor/mcp-plugin' } });
  assert.ok(page.row('plugin-browser'));
  assert.equal(page.group('user'), undefined);
  page.search().props.onChange({ target: { value: 'missing-server' } });
  assert.ok(page.render().some(node => node.props.children.includes('mcpNoMatches')));
  page.search().props.onChange({ target: { value: '' } });
  assert.equal(page.group('builtin').props['aria-expanded'], true);
  assert.equal(page.group('user').props['aria-expanded'], false);
  assert.ok(page.row('mode-browser'));
  assert.deepEqual(app.mcpWrites, []);
  assert.equal(app.mcpReads.length, reads);
  app.unmount();
});

test('MCP cards preserve full-name tooltips, accessible disclosure controls and read-only reasons', async () => {
  const longName = 'server-with-a-very-long-configuration-instance-name';
  const tools = ['generate_image', 'generation_result'];
  const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers: [
    mcpFixture({ name: longName, tools }),
    mcpFixture({ id: 'preset:mode/browser', name: 'mode-browser', tools: ['navigate'], source: 'preset:mode', group: 'builtin', canToggle: false, reason: 'preset-managed' }),
    mcpFixture({ id: 'provider:files', name: 'provider-files', source: 'provider:files', canToggle: false }),
    mcpFixture({ id: 'include:unknown', name: 'unknown-server', stateKnown: false, reason: 'conditional' }),
  ] }) });
  const page = await mcpPage(app);
  page.group('builtin').props.onClick();
  for (const name of [longName, 'mode-browser', 'provider-files', 'unknown-server']) {
    const card = page.row(name);
    const toggle = page.toggle(name);
    const region = page.tools(name);
    const summary = page.summary(name);
    const title = descendants(card).find(node => node.props.id === card.props['aria-labelledby']);
    const tip = descendants(card).find(node => node.type === 'native-tooltip-fixture' && node.props.label === name);
    assert.ok(tip);
    assert.equal(tip.props.portal, true);
    assert.equal(tip.props.side, 'top');
    assert.equal(tip.props.delayMs, 0);
    assert.equal(tip.props.maxWidth, 400);
    assert.equal(tip.props.children[0].type, 'span');
    assert.equal(tip.props.children[0].props.className, 'power-dsh-skill-card-title');
    assert.equal(tip.props.children[0].props.id, title.props.id);
    assert.equal(tip.props.children[0].props.tabIndex, 0);
    const content = card.props.children.find(node => node?.props?.className === 'power-dsh-skill-card-content');
    const contentChildren = content.props.children.filter(Boolean);
    const mainIndex = contentChildren.findIndex(node => node?.props?.className === 'power-dsh-skill-card-main');
    const main = contentChildren[mainIndex];
    const secondLine = contentChildren[mainIndex + 1];
    const thirdLine = contentChildren[mainIndex + 2];
    assert.equal(secondLine.props.className, 'power-dsh-mcp-card-meta');
    assert.equal(secondLine.props.children.filter(Boolean)[0].props.className, 'power-dsh-mcp-runtime');
    assert.equal(main.props.children.length, 2);
    assert.ok(!descendants(main).some(node => node.props.className === 'power-dsh-mcp-runtime'));
    assert.equal(main.props.children[0].type, 'native-tooltip-fixture');
    assert.ok(descendants(main).some(node => node.props.id === title.props.id));
    assert.ok(!descendants(main).some(node => node.props.className === 'power-dsh-mcp-card-toggle'));
    assert.equal(thirdLine.type, 'button');
    assert.equal(thirdLine.props.className, 'power-dsh-mcp-card-toggle');
    const thirdLineChildren = thirdLine.props.children.filter(Boolean);
    assert.equal(thirdLineChildren[0].props.id, summary.props.id);
    assert.equal(thirdLineChildren[0].props.className, 'power-dsh-mcp-tools-summary');
    assert.equal(thirdLineChildren[1].type.name, 'SkillChevron');
    assert.equal(toggle.type, 'button');
    assert.equal(toggle.props.type, 'button');
    assert.equal(toggle.props['aria-expanded'], false);
    assert.equal(toggle.props['aria-controls'], region.props.id);
    assert.equal(toggle.props['aria-labelledby'], `${title.props.id} ${summary.props.id}`);
    assert.equal(region.props.role, 'region');
    assert.equal(region.props['aria-labelledby'], title.props.id);
    assert.equal(region.props.hidden, true);
    assert.equal(descendants(region).filter(node => node.type === 'li').length, 0);
    assert.ok(title.props.children.includes(name));
    assert.equal(card.props.onClick, undefined);
    assert.ok(!descendants(card).some(node => ['power-dsh-skill-origin', 'power-dsh-skill-card-meta'].includes(node.props.className)));
    assert.ok(!descendants(toggle).some(node => node.props.role === 'switch'));
    if (name !== 'unknown-server') {
      assert.equal(main.props.children[1].props.role, 'switch');
      assert.equal(page.control(name).props['aria-labelledby'], title.props.id);
    }
  }
  assert.ok(!page.render().some(node => node.type === 'native-tooltip-fixture' && node.props.label === tools.join(', ')));
  for (const [name, expected] of [['mode-browser', 'mcpPresetManaged'], ['provider-files', 'mcpReadOnly'], ['unknown-server', 'mcpStateUnknown']]) {
    const card = page.row(name);
    const reason = descendants(card).find(node => node.props.id === card.props['aria-describedby']);
    assert.ok(reason.props.children.includes(expected));
    const title = descendants(card).find(node => node.props.id === card.props['aria-labelledby']);
    assert.equal(title.props['aria-describedby'], reason.props.id);
    page.toggle(name).props.onClick();
    assert.equal(page.toggle(name).props['aria-expanded'], true, 'read-only status does not block reading tools');
    if (name !== 'unknown-server') {
      assert.equal(page.control(name).props['aria-describedby'], reason.props.id);
      assert.equal(page.control(name).props.disabled, true);
    }
  }
  assert.equal(page.control('unknown-server'), undefined);
  assert.deepEqual(app.mcpWrites, []);
  app.unmount();
});

test('MCP tool disclosures show complete individual names, localized counts and a static empty state', async () => {
  const tools = ['generate_image', 'generation_result', 'tool_with_a_very_long_name_that_must_remain_complete_after_expansion', ...Array.from({ length: 10 }, (_, index) => `full_tool_name_${index}`)];
  for (const [language, empty, count, label] of [['en', 'No loaded tools', `${tools.length} tools`, 'Tools'], ['zh', '暂无已加载工具', `${tools.length} 个工具`, '工具']]) {
    const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers: [
      mcpFixture({ tools, origin: '@example/image-provider' }),
      mcpFixture({ id: 'include:single', name: 'single', tools: ['navigate'] }),
      mcpFixture({ id: 'include:empty', name: 'unloaded', tools: [] }),
    ] }) });
    const page = await mcpPage(app, language);
    assert.equal(page.summary('browser').props.children[0], count);
    assert.equal(page.summary('single').props.children[0], language === 'en' ? '1 tool' : '1 个工具');
    const placeholder = () => descendants(page.row('unloaded')).find(node => node.props.className === 'power-dsh-mcp-card-placeholder');
    assert.equal(placeholder().props.children[0], empty);
    assert.equal(placeholder().props['data-state'], 'empty');
    assert.equal(page.toggle('browser').props['aria-expanded'], false);
    assert.equal(page.toggle('unloaded'), undefined);
    assert.equal(descendants(page.tools('browser')).filter(node => node.type === 'li').length, 0);
    const reads = app.mcpReads.length;
    page.toggle('browser').props.onClick();
    const region = page.tools('browser');
    assert.equal(region.props.hidden, false);
    const list = descendants(region).find(node => node.type === 'ul');
    assert.equal(list.props['aria-label'], label);
    const names = descendants(list).filter(node => node.props.className === 'power-dsh-mcp-tool-name');
    assert.deepEqual(names.map(node => node.props.children[0]), tools);
    assert.ok(names.every(node => node.type === 'li'));
    assert.ok(!descendants(region).some(node => node.type === 'native-tooltip-fixture'));
    assert.equal(page.toggle('unloaded'), undefined);
    assert.equal(page.tools('unloaded'), undefined);
    const emptyHeader = page.row('unloaded').props.children.find(node => node?.props?.className === 'power-dsh-skill-card-content');
    assert.equal(emptyHeader.props.onClick, undefined);
    assert.equal(emptyHeader.props['data-expandable'], false);
    assert.equal(placeholder().props.onClick, undefined);
    page.toggle('browser').props.onClick();
    assert.equal(page.tools('browser').props.hidden, true);
    assert.equal(descendants(page.tools('browser')).filter(node => node.type === 'li').length, 0);
    assert.equal(placeholder().props.children[0], empty);
    assert.equal(app.mcpReads.length, reads);
    assert.deepEqual(app.mcpWrites, []);
    app.unmount();
  }
});

test('disabled MCP cards hide all tool UI and collapse after status refresh even with cached tools', async () => {
  for (const language of ['en', 'zh']) {
    const servers = [
      mcpFixture({ id: 'include:empty', name: 'empty', enabled: false, tools: [], runtimeState: 'disabled', transport: 'stdio' }),
      mcpFixture({ id: 'include:cached', name: 'cached', enabled: false, tools: ['cached_tool'], runtimeState: 'active' }),
      mcpFixture({ tools: ['navigate'] }),
    ];
    const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers }) });
    const page = await mcpPage(app, language);
    const header = name => page.row(name).props.children.find(node => node?.props?.className === 'power-dsh-skill-card-content');
    const assertClosed = name => {
      assert.equal(page.control(name).props['aria-checked'], false);
      assert.equal(page.summary(name), undefined);
      assert.equal(page.toggle(name), undefined);
      assert.equal(page.tools(name), undefined);
      assert.equal(page.row(name).props['data-open'], false);
      assert.equal(header(name).props['data-expandable'], false);
      assert.equal(header(name).props.onClick, undefined);
      const placeholder = descendants(page.row(name)).find(node => node.props.className === 'power-dsh-mcp-card-placeholder');
      assert.equal(placeholder.props['data-state'], 'disabled');
      assert.equal(placeholder.props.children[0], language === 'en' ? 'No available tools' : '暂无可用工具');
      assert.equal(placeholder.props.onClick, undefined);
      assert.equal(placeholder.props['aria-hidden'], undefined);
      const status = descendants(page.row(name)).find(node => node.props.className === 'power-dsh-mcp-runtime');
      assert.equal(status.props.children[1], language === 'en' ? 'Disabled' : '已关闭');
      assert.equal(status.props.children[0].props.state, 'idle');
    };
    assertClosed('empty');
    assertClosed('cached');
    assert.ok(descendants(page.row('empty')).some(node => node.props.className === 'power-dsh-mcp-transport'));
    page.toggle('browser').props.onClick();
    assert.equal(page.tools('browser').props.hidden, false);
    const staleToggle = page.toggle('browser').props.onClick;
    app.setMcpServers(mcpCatalogFixture({ servers: servers.map(server => ({ ...server, enabled: false })) }));
    await app.reloadMcp();
    assertClosed('browser');
    staleToggle();
    assertClosed('browser');
    app.setMcpServers(mcpCatalogFixture({ servers }));
    await app.reloadMcp();
    assert.equal(page.toggle('browser').props['aria-expanded'], true, 'a stale handler cannot change expansion while disabled');
    assert.equal(page.control('browser').props['aria-checked'], true);
    app.setMcpServers(mcpCatalogFixture({ servers: servers.map(server => server.name === 'browser' ? { ...server, tools: [] } : server) }));
    await app.reloadMcp();
    assert.equal(page.toggle('browser'), undefined);
    assert.equal(page.tools('browser'), undefined);
    assert.equal(page.row('browser').props['data-open'], false);
    assert.equal(header('browser').props.onClick, undefined);
    staleToggle();
    assert.equal(page.row('browser').props['data-open'], false);
    const emptyState = header('browser').props.children.find(node => node?.props?.['data-state'] === 'empty');
    assert.equal(emptyState.props.children[0], language === 'en' ? 'No loaded tools' : '暂无已加载工具');
    assert.deepEqual(app.mcpWrites, []);
    app.unmount();
  }
});

test('MCP header and button expansion ignore switch bubbling and survive search, group folding and refresh', async () => {
  const tools = ['generate_image', 'generation_result'];
  const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers: [
    mcpFixture({ tools }), mcpFixture({ id: 'include:other', name: 'other', tools: ['search'] }),
  ] }) });
  const page = await mcpPage(app);
  const header = () => page.row('browser').props.children.find(node => node?.props?.className === 'power-dsh-skill-card-content');
  const clickHeader = interactive => header().props.onClick({ target: { closest: () => interactive }, defaultPrevented: false });
  clickHeader(null);
  assert.equal(page.toggle('browser').props['aria-expanded'], true, 'clicking header text or blank space expands the card');
  clickHeader(null);
  assert.equal(page.toggle('browser').props['aria-expanded'], false);
  header().props.onClick({ defaultPrevented: true });
  assert.equal(page.toggle('browser').props['aria-expanded'], false);
  page.toggle('browser').props.onClick();
  clickHeader(page.toggle('browser'));
  assert.equal(page.toggle('browser').props['aria-expanded'], true, 'the button click must not toggle twice when it bubbles');
  assert.equal(page.toggle('other').props['aria-expanded'], false);
  assert.equal(page.tools('browser').props.onClick, undefined);
  assert.equal(page.row('browser').props.onClick, undefined, 'the expanded tool list stays outside the click handler');
  await page.control('browser').props.onClick();
  assert.deepEqual(app.mcpWrites, [{ id: 'include:browser', enabled: false }]);
  assert.equal(header().props.onClick, undefined);
  assert.equal(page.toggle('browser'), undefined);
  assert.equal(page.tools('browser'), undefined);
  assert.equal(page.row('browser').props['data-open'], false);
  await page.control('browser').props.onClick();
  assert.equal(page.toggle('browser').props['aria-expanded'], true);
  assert.equal(page.toggle('other').props['aria-expanded'], false);
  const reads = app.mcpReads.length;
  page.search().props.onChange({ target: { value: 'GENERATION_RESULT' } });
  assert.ok(page.row('browser'));
  assert.equal(page.row('other'), undefined);
  assert.equal(page.toggle('browser').props['aria-expanded'], true);
  page.toggle('browser').props.onClick();
  assert.equal(page.toggle('browser').props['aria-expanded'], false);
  page.search().props.onChange({ target: { value: 'search' } });
  assert.ok(page.row('other'));
  assert.equal(page.toggle('other').props['aria-expanded'], false, 'tool-name search must not expand a card');
  page.search().props.onChange({ target: { value: '' } });
  assert.equal(page.toggle('browser').props['aria-expanded'], false);
  page.toggle('browser').props.onClick();
  page.group('user').props.onClick();
  assert.equal(page.row('browser'), undefined);
  page.group('user').props.onClick();
  assert.equal(page.toggle('browser').props['aria-expanded'], true);
  assert.equal(app.mcpReads.length, reads);
  await app.reloadMcp();
  assert.equal(page.toggle('browser').props['aria-expanded'], true);
  assert.equal(page.toggle('other').props['aria-expanded'], false);
  app.unmount();
});

test('MCP loading errors are localized and never represented as an empty configuration', async () => {
  for (const message of ['mcpUnavailable', 'unsafe diagnostic env=SECRET']) {
    const app = await mount({ mcpReadError: message });
    const page = await mcpPage(app);
    const visible = page.render().flatMap(node => node.props.children.filter(child => typeof child === 'string'));
    assert.ok(visible.includes(message === 'mcpUnavailable' ? 'mcpUnavailable' : 'mcpLoadFailed'));
    assert.ok(!visible.includes('mcpEmpty'));
    assert.ok(!visible.includes('unsafe diagnostic env=SECRET'));
    assert.ok(page.render().some(node => node.props.role === 'alert'));
    assert.ok(!page.render().some(node => node.props.role === 'switch'));
    app.unmount();
  }
  const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers: [] }) });
  const page = await mcpPage(app);
  assert.ok(page.render().some(node => node.props.children.includes('mcpEmpty')));
  app.unmount();
});

test('incomplete and read-only MCP catalogs cannot be changed', async () => {
  for (const options of [{ mcpCatalog: mcpCatalogFixture({ complete: false }) }, { writable: false }]) {
    const app = await mount(options);
    const page = await mcpPage(app);
    assert.equal(page.control('browser').props.disabled, true);
    await page.control('browser').props.onClick();
    assert.deepEqual(app.mcpWrites, []);
    if (options.mcpCatalog) assert.ok(page.render().some(node => node.props.children.includes('mcpIncomplete')));
    app.unmount();
  }
});

test('slow MCP writes use entry identity, keep accepted state and prevent duplicates and focus reloads', async () => {
  const reply = Promise.withResolvers();
  const app = await mount({ mcpReply: () => reply.promise });
  const page = await mcpPage(app);
  const click = page.control('browser').props.onClick;
  const action = click();
  assert.equal(page.control('browser').props['aria-checked'], true);
  assert.equal(page.control('browser').props['aria-busy'], true);
  assert.equal(page.control('browser').props.disabled, true);
  assert.equal(page.search().props.disabled, true);
  const reads = app.mcpReads.length;
  page.group('user').props.onClick();
  assert.equal(page.row('browser'), undefined);
  page.group('user').props.onClick();
  app.focus();
  await click();
  assert.equal(app.mcpReads.length, reads);
  assert.equal(app.mcpWrites.length, 1);
  reply.resolve({ ok: true, value: mcpCatalogFixture({ servers: [mcpFixture({ enabled: false })] }) });
  await action;
  assert.equal(page.control('browser').props['aria-checked'], false);
  assert.equal(page.control('browser').props.disabled, false);
  assert.equal(page.search().props.disabled, false);
  assert.deepEqual(app.mcpWrites[0], { id: 'include:browser', enabled: false });
  app.unmount();
});

test('MCP write outcomes remain localized and read backend state again even when the operation reports failure', async () => {
  for (const message of ['mcpChangeFailed', 'mcpRestartRequired', 'mcpChangeOverridden', 'mcpChangeUncertain', 'mcpUnavailable', 'unsafe header Authorization=SECRET']) {
    const app = await mount({ mcpReply: async () => {
      app.setMcpServers(mcpCatalogFixture({ servers: [mcpFixture({ enabled: false })] }));
      return { ok: false, error: { message } };
    } });
    const page = await mcpPage(app);
    const reads = app.mcpReads.length;
    await page.control('browser').props.onClick();
    assert.equal(app.mcpReads.length, reads + 1);
    assert.equal(page.control('browser').props['aria-checked'], false);
    const expected = message.startsWith('mcp') ? message : 'mcpChangeFailed';
    const alert = descendants(page.row('browser')).find(node => node.props.role === 'alert' && node.props.children.includes(expected));
    assert.ok(alert);
    assert.ok(page.control('browser').props['aria-describedby'].split(' ').includes(alert.props.id));
    assert.ok(!page.render().some(node => node.props.children.includes('unsafe header Authorization=SECRET')));
    app.unmount();
  }
});

test('MCP catalog generations discard old reads and release effects before late responses settle', async () => {
  const stale = Promise.withResolvers();
  const current = Promise.withResolvers();
  const late = Promise.withResolvers();
  let reads = 0;
  const app = await mount({ mcpList: () => {
    reads++;
    if (reads === 3) return stale.promise;
    if (reads === 4) return current.promise;
    if (reads === 5) return late.promise;
    return { ok: true, value: mcpCatalogFixture() };
  } });
  const page = await mcpPage(app);
  const old = app.reloadMcp();
  const latest = app.reloadMcp();
  current.resolve({ ok: true, value: mcpCatalogFixture({ servers: [mcpFixture({ name: 'current-browser' })] }) });
  await latest;
  stale.resolve({ ok: true, value: mcpCatalogFixture() });
  await old;
  assert.ok(page.row('current-browser'));
  assert.equal(page.row('browser'), undefined);
  const pending = app.reloadMcp();
  const source = app.mcpProps().mcpSource;
  const before = source.getSnapshot();
  app.unmount();
  late.resolve({ ok: true, value: mcpCatalogFixture() });
  await pending;
  assert.equal(source.getSnapshot(), before);
  assert.equal(app.focusSubscriptions(), 0);
});

test('MCP has no project controls while skills retain their independent project scope', async () => {
  const app = await mount();
  const page = await mcpPage(app);
  assert.ok(page.search());
  assert.ok(page.group('user'));
  assert.ok(!page.render().some(node => ['tablist', 'tab', 'tabpanel'].includes(node.props.role)));
  assert.ok(!page.render().some(node => node.props.className === 'power-dsh-project-trigger' || node.type === 'native-menu-fixture'));
  assert.ok(app.mcpReads.every(args => args.length === 0));
  assert.deepEqual(Object.keys(app.mcpProps().mcpSource.getSnapshot()).sort(), ['error', 'saving', 'status', 'value']);
  const skills = await skillsPage(app);
  assert.equal(skills.tab('user').props['aria-selected'], true);
  await skills.tab('project').props.onClick();
  assert.equal(skills.tab('project').props['aria-selected'], true);
  assert.ok(skills.projectTrigger());
  app.unmount();
});

test('MCP manager config uses its declared control while plugin-owned entries remain read-only', async () => {
  const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers: [
    mcpFixture({ id: 'manager:configured', name: 'managed', source: 'manager', origin: 'native-mcp' }),
    mcpFixture({ id: 'runtime:99', name: 'provided', source: 'plugin', group: 'builtin', origin: '@example/provider', canToggle: false, reason: 'plugin-managed' }),
  ] }) });
  const page = await mcpPage(app);
  assert.equal(page.control('managed').props.disabled, false);
  await page.control('managed').props.onClick();
  assert.deepEqual(app.mcpWrites, [{ id: 'manager:configured', enabled: false }]);
  page.group('builtin').props.onClick();
  assert.equal(page.control('provided').props.disabled, true);
  assert.ok(descendants(page.row('provided')).some(node => node.props.children.includes('mcpPluginManaged')));
  await page.control('provided').props.onClick();
  assert.equal(app.mcpWrites.length, 1);
  app.unmount();
});

test('MCP disabled manager and unloaded context reject previously captured actions', async () => {
  for (const unload of [false, true]) {
    const app = await mount();
    const page = await mcpPage(app);
    const action = page.control('browser').props.onClick;
    const props = app.mcpProps();
    if (unload) app.unmount(); else app.set({ mcpManagerEnabled: false });
    await action();
    await props.setMcpServerEnabled('include:browser', false);
    assert.deepEqual(app.mcpWrites, []);
    if (!unload) app.unmount();
  }
});

test('the MCP preference refreshes the Host mirror and shows rejection without enabling its page', async () => {
  let upgraded = false;
  const writes = [];
  const app = await mount({
    formReply: async (field, value) => { writes.push({ field, value }); return true; },
    formLoad: async () => upgraded ? { mcpManagerEnabled: false } : undefined,
  });
  app.set({ mcpManagerEnabled: undefined });
  app.selectSettingsTab('enhancements');
  const toggle = () => descendants(app.renderSettings()).find(node => node.props.id === 'settings-test-mcpManagerEnabled');
  await toggle().props.onClick();
  assert.deepEqual(writes, []);
  assert.ok(!app.entries.has('settings.section:power-dsh-mcp'));
  assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes('mcpManagerOutdated')));
  upgraded = true;
  await toggle().props.onClick();
  assert.deepEqual(writes, [{ field: 'mcpManagerEnabled', value: true }]);
  assert.ok(app.entries.has('settings.section:power-dsh-mcp'));
  app.unmount();
});

test('MCP codecs validate every public field and discard credential-bearing metadata', async () => {
  const app = await mount();
  const descriptors = app.rpcDescriptors.filter(item => item.method === 'listMcpServers' || item.method === 'setMcpServerEnabled');
  assert.deepEqual(Array.from(descriptors.find(item => item.method === 'listMcpServers').parameters, item => item.name), []);
  assert.deepEqual(Array.from(descriptors.find(item => item.method === 'setMcpServerEnabled').parameters, item => item.name), ['id', 'enabled']);
  for (const descriptor of descriptors) {
    for (const parameter of descriptor.parameters) assert.throws(() => parameter.codec.create().parse(parameter.name === 'enabled' ? 'false' : false), /boolean|string/);
    const codec = descriptor.result.create();
    const tools = ['generate_image', 'generation_result'];
    const result = codec.parse({ ...mcpCatalogFixture(), rawConfig: 'private', servers: [mcpFixture({ tools, env: { SECRET: 'private' }, headers: { Authorization: 'private' } })] });
    assert.equal('rawConfig' in result, false);
    assert.equal('env' in result.servers[0], false);
    assert.equal('headers' in result.servers[0], false);
    assert.deepEqual(Object.keys(result).sort(), ['complete', 'servers']);
    assert.deepEqual(Object.keys(result.servers[0]).sort(), ['canToggle', 'enabled', 'group', 'id', 'name', 'origin', 'reason', 'runtimeState', 'source', 'stateKnown', 'tools', 'transport']);
    assert.deepEqual(Array.from(result.servers[0].tools), tools);
    assert.notEqual(result.servers[0].tools, tools);
    result.servers[0].tools.push('client_only');
    assert.deepEqual(tools, ['generate_image', 'generation_result']);
    for (const invalid of [{ complete: 'true' }, { servers: null }, { servers: [mcpFixture({ group: 'preset' })] },
      ...[undefined, null, true, 'connected', 'online', 'offline', 'untrusted-secret'].map(runtimeState => ({ servers: [mcpFixture({ runtimeState })] })),
      ...[undefined, null, false, 'http', 'sse', 'local', { url: 'private' }].map(transport => ({ servers: [mcpFixture({ transport })] })),
      ...[undefined, null, 'generate_image', { name: 'generate_image' }, [null], [1], [false], [{ name: 'generate_image', description: 'private', execute() {} }], ['generate_image', { name: 'generation_result' }]].map(tools => ({ servers: [mcpFixture({ tools })] })),
      ...['id', 'name', 'source', 'origin', 'reason'].map(key => ({ servers: [mcpFixture({ [key]: null })] })), ...['enabled', 'stateKnown', 'canToggle'].map(key => ({ servers: [mcpFixture({ [key]: 'true' })] }))]) {
      assert.throws(() => codec.parse({ ...mcpCatalogFixture(), ...invalid }), /Invalid MCP/);
    }
  }
  app.unmount();
});

test('appearance shares the settings row and releases geometry observers on collapse', async () => {
  const app = await mount();
  app.set({ showThemeSwitcher: true });
  assert.equal(button(app.render()).props.style.left, 240);
  app.resize(360);
  assert.equal(button(app.render()).props.style.left, 320);
  assert.equal(app.render(false), null);
  assert.equal(app.geometry().listeners, 0);
  assert.equal(app.geometry().observeCount, app.geometry().disconnectCount);
  app.unmount();
});

test('appearance yields to reconnect and recovery, cancels pending recovery on another outage, and cleans up', async () => {
  const app = await mount();
  app.set({ showThemeSwitcher: true });
  assert.ok(button(app.render()));
  app.setConnectionState('connecting');
  assert.equal(app.render(), null);
  app.setConnectionState('connected');
  assert.equal(app.render(), null);
  assert.equal([...app.timers.values()][0].ms, 3000);
  app.setConnectionState('disconnected');
  assert.equal(app.timers.size, 0);
  assert.equal(app.render(), null);
  app.setConnectionState('connected');
  const timer = [...app.timers.values()][0];
  timer.fn();
  assert.ok(button(app.render()));
  app.unmount();
  assert.equal(app.connectionStateListeners.size, 0);
  assert.equal(app.timers.size, 0);
});

test('appearance yields to native update phases and ignores a stale initial status response', async () => {
  let listener;
  let removed = 0;
  const status = Promise.withResolvers();
  const app = await mount({ updates: {
    status: () => status.promise,
    subscribe(fn) { listener = fn; return () => { removed++; }; },
  } });
  app.set({ showThemeSwitcher: true });
  assert.equal(app.render(), null);
  listener({ phase: 'downloading' });
  status.resolve({ phase: 'idle' });
  await status.promise;
  assert.equal(app.render(), null);
  listener({ phase: 'idle' });
  assert.ok(button(app.render()));
  listener({ phase: 'error' });
  assert.equal(app.render(), null);
  app.unmount();
  assert.equal(removed, 1);
});


function restartControl(app) {
  return headerAction(app, 'restart');
}
function restartDialog(app) {
  return descendants(app.renderHeader()).find(node => node.type === 'native-modal-fixture');
}
function restartConfirmButton(app) {
  return descendants(restartDialog(app)).find(node => node.props['data-native-button'] && node.props.children.includes('restartAction'));
}
async function enableRestart(app) {
  app.set({ showRestartButton: true });
  app.renderHeader();
  await new Promise(resolve => setImmediate(resolve));
}

test('restart opens shared Modal and Buttons, and sends only one request after explicit confirmation', async () => {
  const app = await mount({ desktop: true });
  assert.equal(app.renderHeader(), null);
  const toggle = descendants(app.renderSettings()).find(node => node.props.id === 'settings-test-showRestartButton');
  await toggle.props.onClick();
  assert.equal(app.restartCalls.length, 0);
  app.renderHeader();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(headerPosition(app).left, 220);
  assert.deepEqual(Array.from(openHeaderMenu(app).props.items, item => item.id), ['restart']);
  app.set({ showRefreshButton: true });
  assert.equal(headerPosition(app).left, 220, 'A second action belongs in the same menu, without shifting the trigger.');
  assert.deepEqual(Array.from(openHeaderMenu(app).props.items, item => item.id), ['refresh', 'restart']);
  const control = restartControl(app);
  control.props.onClick();
  control.props.onClick();
  assert.equal(app.restartCalls.length, 0, 'Opening the modal must never restart the application.');
  const dialog = restartDialog(app);
  assert.equal(dialog.props.title, 'restart');
  assert.equal(dialog.props.description, 'restartConfirm');
  assert.equal(dialog.props.closeLabel, 'close');
  const actions = descendants(dialog).filter(node => node.props['data-native-button']);
  assert.deepEqual(actions.map(node => node.props.variant), ['outline', 'primary']);
  assert.equal(actions[0].props['data-modal-autofocus'], true, 'The shared modal should initially focus Cancel.');
  actions[1].props.onClick();
  actions[1].props.onClick();
  assert.equal(app.restartCalls.length, 1, 'Duplicate confirmation callbacks must not send a second request.');
  assert.equal(restartDialog(app), undefined);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.renderHeader(false), null);
  assert.deepEqual(app.intervals(), []);
  app.unmount();
  assert.equal(app.geometry().listeners, 0);
});

test('Cancel and the shared close callback never restart; callbacks from a dismissed dialog cannot confirm a new one', async () => {
  const app = await mount({ desktop: true });
  await enableRestart(app);
  restartControl(app).props.onClick({ stopPropagation() {} });
  const staleConfirm = restartConfirmButton(app).props.onClick;
  const cancel = descendants(restartDialog(app)).find(node => node.props.children?.includes('cancel'));
  cancel.props.onClick();
  assert.equal(restartDialog(app), undefined);
  staleConfirm();
  restartControl(app).props.onClick({ stopPropagation() {} });
  staleConfirm();
  assert.ok(restartDialog(app));
  // Native Modal routes Escape, mask clicks and the close icon through onClose.
  restartDialog(app).props.onClose();
  assert.equal(restartDialog(app), undefined);
  assert.equal(app.restartCalls.length, 0);
  app.unmount();
});

test('hidden or disabled restart controls dismiss confirmation and reject captured confirm callbacks', async () => {
  for (const hide of ['collapse', 'disable']) {
    const app = await mount({ desktop: true });
    await enableRestart(app);
    restartControl(app).props.onClick({ stopPropagation() {} });
    const staleConfirm = restartConfirmButton(app).props.onClick;
    if (hide === 'disable') app.set({ showRestartButton: false });
    assert.equal(app.renderHeader(hide !== 'collapse'), null);
    staleConfirm();
    assert.equal(app.restartCalls.length, 0);
    app.set({ showRestartButton: true });
    app.renderHeader();
    assert.equal(restartDialog(app), undefined, 'A dismissed confirmation must not reopen when the button returns.');
    app.unmount();
  }
});

test('Web and unsupported Hosts show neither restart button nor confirmation', async () => {
  for (const options of [{ desktop: false }, { desktop: true, restartStatus: { supported: false, running: false, error: '' } }]) {
    const app = await mount(options);
    await enableRestart(app);
    assert.equal(restartControl(app), undefined);
    assert.equal(restartDialog(app), undefined);
    assert.equal(app.restartCalls.length, 0);
    app.unmount();
  }
});

test('running restart disables only its menu item while refresh remains usable, and live preferences reject stale confirmation', async () => {
  let reloads = 0;
  const status = { supported: true, running: false, error: '' };
  const app = await mount({ desktop: true, restartStatus: status, reload: () => { reloads++; } });
  await enableRestart(app);
  app.set({ showRefreshButton: true });
  const staleMenu = openHeaderMenu(app);
  status.running = true;
  await app.tickIntervals();
  staleMenu.props.onSelect('restart');
  assert.equal(restartDialog(app), undefined);
  const menu = openHeaderMenu(app);
  assert.equal(menu.props.items.find(item => item.id === 'restart').disabled, true);
  assert.ok(!menu.props.items.find(item => item.id === 'refresh').disabled);
  headerAction(app, 'restart').props.onClick();
  assert.equal(restartDialog(app), undefined, 'A captured disabled row must not start confirmation.');
  headerAction(app, 'refresh').props.onClick();
  assert.equal(reloads, 1);
  assert.equal(app.restartCalls.length, 0);
  status.running = false;
  await app.tickIntervals();
  restartControl(app).props.onClick();
  const confirm = restartConfirmButton(app).props.onClick;
  app.set({ showRestartButton: false });
  confirm();
  assert.equal(app.restartCalls.length, 0, 'Confirmation reads the latest saved preference even before rendering.');
  assert.equal(restartDialog(app), undefined);
  assert.deepEqual(Array.from(openHeaderMenu(app).props.items, item => item.id), ['refresh']);
  app.unmount();
});

test('restart failures allow reopening confirmation and running helpers disable repeated requests', async () => {
  const status = { supported: true, running: false, error: '' };
  const app = await mount({ desktop: true, restartStatus: status,
    restartReply: async () => ({ ok: false, error: { message: 'restartFailed' } }) });
  await enableRestart(app);
  restartControl(app).props.onClick({ stopPropagation() {} });
  restartConfirmButton(app).props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  const tree = app.renderHeader();
  assert.ok(descendants(tree).some(node => node.props.role === 'alert' && node.props.children.includes('restartFailed')));
  assert.equal(restartControl(app).props.disabled, false);
  restartControl(app).props.onClick({ stopPropagation() {} });
  assert.ok(restartDialog(app));
  const staleConfirm = restartConfirmButton(app).props.onClick;
  status.running = true;
  await app.tickIntervals();
  assert.equal(restartControl(app).props.disabled, true);
  assert.equal(restartDialog(app), undefined);
  staleConfirm();
  assert.equal(app.restartCalls.length, 1);
  app.unmount();
});
