import z from "@deepseek-ai/schemastery";
interface DisabledSkillPreference {
  name: string;
  description: string;
  source: string;
  provider: string;
  path: string;
  scope: string;
  projectRoot: string;
  origin: string;
}
interface Preferences {
  showVersion: boolean;
  showThemeSwitcher: boolean;
  showRefreshButton: boolean;
  showRestartButton: boolean;
  notificationsEnabled: boolean;
  notificationSoundEnabled: boolean;
  notificationSound: string;
  personalizationEnabled: boolean;
  skillManagerEnabled: boolean;
  disabledSkills: DisabledSkillPreference[];
  mcpManagerEnabled: boolean;
  blockOfficialAccount: boolean;
  blockOfficialSearch: boolean;
  blockOfficialTelemetry: boolean;
  blockTodo: boolean;
  blockPlan: boolean;
  blockGoal: boolean;
  blockDoubleClickRename: boolean;
  showThinkingEffortSwitcher: boolean;
  thinkingEffortGlyph: string;
  flowingBackgroundEnabled: boolean;
  flowingBackgroundKind: string;
  flowingBackgroundOpacity: number;
  flowingBackgroundBlur: number;
  archiveManagerEnabled: boolean;
}
type PreferenceKey = keyof Preferences;
interface LiveValue<T> {
  get(): T;
}
type LivePreferences = { [K in PreferenceKey]: LiveValue<Preferences[K]>; };
type SettingsParameter = 'showVersion' | 'showThemeSwitcher' | 'showRefreshButton' | 'showRestartButton' | 'blockDoubleClickRename' | 'blockOfficialAccount' | 'blockOfficialTelemetry' | 'blockTodo' | 'blockPlan' | 'blockGoal' | 'blockOfficialSearch';
interface TelemetryStatus {
  protected: boolean;
  senders: {
    id: string;
    enabled: boolean;
    active: boolean;
    available: boolean;
  }[];
}
type SettingsOutput = Pick<Preferences, SettingsParameter> & {
  version: string | null;
  telemetry: TelemetryStatus;
};
type FeatureId = 'version-display' | 'appearance-shortcut' | 'refresh-button' | 'restart-button' | 'notifications' | 'personalization' | 'skills' | 'mcp' | 'account-blocking' | 'search-blocking' | 'telemetry-blocking' | 'todo-blocking' | 'plan-blocking' | 'goal-blocking' | 'double-click-rename' | 'thinking-effort' | 'flowing-background' | 'archive';
type FeatureCategory = 'general' | 'interface' | 'enhance' | 'simplify' | 'other';
interface FeatureDefinition {
  readonly id: FeatureId;
  readonly category: FeatureCategory;
  readonly order: number;
  readonly keys: readonly PreferenceKey[];
  readonly spec: string;
}
type SkillScope = 'user' | 'project';
interface SkillWorkspace {
  path: string;
  title: string;
}
interface SkillRow {
  name: string;
  description: string;
  source: string;
  path: string;
  origin: string;
  reason: string;
  enabled: boolean;
  modelInvocable: boolean;
  userInvocable: boolean;
  canToggle: boolean;
}
interface SkillCatalog {
  cwd: string;
  scope: SkillScope;
  workspaces: SkillWorkspace[];
  complete: boolean;
  skills: SkillRow[];
}
type McpRuntimeState = 'pending' | 'loading' | 'active' | 'failed' | 'unloading' | 'inactive' | 'disabled' | 'unknown';
type McpTransport = 'stdio' | 'streamable-http' | 'unknown';
interface McpServer {
  id: string;
  name: string;
  source: string;
  origin: string;
  reason: string;
  group: 'user' | 'builtin';
  transport: McpTransport;
  runtimeState: McpRuntimeState;
  tools: string[];
  enabled: boolean;
  stateKnown: boolean;
  canToggle: boolean;
}
interface McpCatalog {
  complete: boolean;
  servers: McpServer[];
}
interface PersonalizationFile {
  path: string;
  text: string;
  revision: string;
}
interface WallpaperAsset {
  name: string;
  mime: string;
  bytes: number;
  dataUrl: string;
}
interface WallpaperCleared {
  cleared: true;
}
interface SoundEntry {
  id: string;
  name: string;
}
interface SystemSoundsCatalog {
  platform: 'darwin' | 'win32' | 'other';
  sounds: SoundEntry[];
}
interface SoundPlayback {
  played: boolean;
}
interface RestartStatus {
  supported: boolean;
  running: boolean;
  error: '' | 'restartFailed';
}
interface RestartAccepted {
  accepted: true;
}
interface ArchiveWorkspaceRow {
  workspaceId: string;
  title: string;
}
interface ArchiveSessionRow {
  sessionId: string;
  title: string;
  workspaceId: string;
  workspaceTitle: string;
  updatedAt: number;
  createdAt: number;
}
interface ArchiveCatalog {
  complete: boolean;
  workspaces: ArchiveWorkspaceRow[];
  sessions: ArchiveSessionRow[];
}
/** Named Host operations, before the transport adds its result envelope. */
interface PowerDshMethods {
  restartStatus(): Promise<RestartStatus>;
  restartApp(): Promise<RestartAccepted>;
  listSystemSounds(): Promise<SystemSoundsCatalog>;
  playSystemSound(id: string, preview: boolean): Promise<SoundPlayback>;
  setAccountBlocked(blocked: boolean): Promise<PolicyResult>;
  setTelemetryBlocked(blocked: boolean): Promise<PolicyResult>;
  setTodoBlocked(blocked: boolean): Promise<PolicyResult>;
  setPlanBlocked(blocked: boolean): Promise<PolicyResult>;
  setGoalBlocked(blocked: boolean): Promise<PolicyResult>;
  setSearchBlocked(blocked: boolean): Promise<PolicyResult>;
  readPersonalization(): Promise<PersonalizationFile>;
  savePersonalization(text: string, revision: string): Promise<PersonalizationFile>;
  readWallpaper(): Promise<WallpaperAsset | null>;
  saveWallpaper(dataUrl: string, name: string): Promise<WallpaperAsset>;
  clearWallpaper(): Promise<WallpaperCleared>;
  listSkills(cwd: string, scope: string): Promise<SkillCatalog>;
  setSkillEnabled(cwd: string, scope: string, name: string, enabled: boolean): Promise<SkillCatalog>;
  listMcpServers(): Promise<McpCatalog>;
  setMcpServerEnabled(id: string, enabled: boolean): Promise<McpCatalog>;
  listArchivedSessions(): Promise<ArchiveCatalog>;
  restoreArchivedSession(sessionId: string): Promise<ArchiveCatalog>;
  deleteArchivedSession(sessionId: string): Promise<ArchiveCatalog>;
}
type PowerDshMethod = keyof PowerDshMethods;
interface Codec<T> {
  mode: 'strict';
  typeSymbol: string;
  create(): {
    parse(value: unknown): T;
  };
}
interface PolicyResult {
  blocked: boolean;
}
interface RpcParameter {
  name: string;
  wire: string;
  source: 'json';
  codec: Codec<unknown>;
}
interface RpcDescriptor<M extends string = string, R = unknown> {
  id: `power-dsh#powerDsh/${M}`;
  service: 'powerDsh';
  namespace: 'powerDsh';
  method: M;
  invocation: {
    kind: 'direct';
  };
  parameters: RpcParameter[];
  result: Codec<R>;
}
type Release = () => void;
interface NativePlugin {
  entryId: string;
  moduleName: string;
  patchId?: string;
  enabled: boolean;
  fiberPhase?: string | null;
  readOnlyReason?: string;
}
interface NativeChangeResult {
  application: string;
  warnings?: string[];
  error?: {
    diagnostic?: string;
    code?: string;
  };
  restartReason?: string;
}
type NativePayload = {
  [key: string]: any;
};
interface NativeEntry {
  id: string;
  disabled?: boolean;
  options: {
    id: string;
    name: string;
    config: NativePayload;
  };
  fiber?: NativeFiber;
  ctx: NativeContext;
}
interface NativeFiber {
  uid: number;
  state: number;
  entry?: NativeEntry;
  ctx: NativeContext;
  parent: {
    fiber: NativeFiber;
  };
  runtime?: {
    name?: string;
  };
  effectiveConfig?: NativePayload;
  config?: NativePayload;
  rawConfig?: NativePayload;
}
interface NativeCompositionRow {
  moduleName: string;
  entryId: string;
  enabled: boolean | 'conditional';
  fiberState?: number;
}
interface NativeComposition {
  id: string;
  broken?: boolean;
  rows: NativeCompositionRow[];
}
interface NativeLease {
  key: unknown;
  [Symbol.asyncDispose](): Promise<void>;
}
interface NativePresets {
  defaultId: string;
  compositionInventory(): Promise<NativeComposition[]>;
  serviceFor(agent: NativeAgent, name: string): unknown;
  acquireScope(id: string): Promise<NativeLease>;
}
interface NativeAgent {
  ctx: NativeContext;
}
interface NativeWorkspaceView {
  workspaceId: string;
  title: string;
  path: string;
  sessionIds: readonly string[];
}
interface NativeWorkspaceBaseline {
  items: readonly NativeWorkspaceView[];
  archivedSessionIds: readonly string[];
  pinnedSessionIds: readonly string[];
}
interface NativeWorkspaceController {
  follow(signal: AbortSignal): AsyncIterable<{
    type: string;
    value?: NativeWorkspaceBaseline;
  }>;
  unarchiveSession(request: {
    sessionId: string;
  }): Promise<{
    archivedSessionIds: readonly string[];
  }>;
}
type NativeSessionTitleObservation = {
  sessionId: string;
  status: 'fulfilled';
  value: {
    session: {
      createdAt: number;
    };
    title?: {
      title: string;
      updatedAt: number;
    };
  };
} | {
  sessionId: string;
  status: 'rejected';
  reason: unknown;
};
interface NativeSessionQuery {
  readTitleSnapshots(sessionIds: readonly string[], signal?: AbortSignal): Promise<readonly NativeSessionTitleObservation[]>;
  listSessions(signal?: AbortSignal): Promise<readonly {
    header: {
      id: string;
    };
    live: boolean;
  }[]>;
}
interface NativeSessionPersistence {
  stat(sessionId: string, options?: {
    signal?: AbortSignal;
  }): Promise<{
    header: {
      id: string;
      cwd?: string;
    };
    location?: {
      kind: string;
      path: string;
    };
  } | undefined>;
}
interface NativeSkill {
  name: string;
  description: string;
  source: string;
  provider: string;
  path?: string;
  origin?: string;
  resourceBase?: {
    kind: string;
    path?: string;
  };
  invocation: {
    modelInvocable: boolean;
    userInvocable: boolean;
  };
}
interface NativeSkillRecord {
  name: string;
  description: string;
  source: string;
  provider: string;
  path: string;
  origin: string;
  scope: string;
  projectRoot: string;
}
interface NativeSkillCandidate extends NativeSkillRecord {
  locator: NativeSkillRecord;
}
interface NativeSkillControl {
  signal: AbortSignal;
  invalidate(): void;
}
interface NativeSkills {
  snapshot(options: {
    cwd?: string;
    scope?: unknown;
  }): Promise<{
    complete: boolean;
    skills: NativeSkill[];
  }>;
  registerProvider(factory: (control: NativeSkillControl) => {
    name: string;
    list(options?: {
      cwd?: string;
    }): Promise<(NativeSkillRecord & {
      rank: number;
      locator: NativeSkillRecord;
      invocation: {
        modelInvocable: boolean;
        userInvocable: boolean;
      };
    })[]>;
    get(candidate: NativeSkillCandidate): Promise<NativeSkillRecord & {
      content: string;
      invocation: {
        modelInvocable: boolean;
        userInvocable: boolean;
      };
    }>;
  }): Release;
}
interface NativeTools {
  register(tool: unknown): Release;
  guard(callback: (execution: {
    name: string;
  }) => string | undefined): Release;
  restrict(options: {
    deny: string[];
  }): Release;
  get(name: string, scope?: unknown): unknown;
  definitions?(scope?: unknown): {
    name: string;
  }[];
  schemas(scope?: unknown): {
    name: string;
  }[];
}
interface NativeSettings {
  configure(options: {
    auto: boolean;
  }): Release;
  describe(options: {
    redactSecrets: boolean;
  }): {
    ns: string;
    revision: number;
  }[];
  mutate(namespace: string, mutations: {
    op: 'set';
    path: string[];
    value: unknown;
  }[], revision?: number): Promise<unknown>;
}
interface NativeSubprocessHandle {
  done: Promise<{
    exitCode: number | null;
    signal: string | null;
  }>;
  waitForExit(signal: AbortSignal): Promise<boolean>;
  terminate(): void;
}
interface NativeSubprocess {
  resolveExecutable(name: string, options: undefined, signal: AbortSignal): Promise<string>;
  spawn(options: {
    argv: string[];
    cwd: string;
    graceMs: number;
    signal: AbortSignal;
    stdio: {
      stdin: 'ignore';
      stdout: {
        maxBytes: number;
      };
      stderr: {
        maxBytes: number;
      };
    };
  }): NativeSubprocessHandle;
}
interface NativeServices {
  skills: NativeSkills;
  tools: NativeTools;
  settings: NativeSettings;
  subprocess: NativeSubprocess | undefined;
  fs: {
    resolve(path: string): Promise<unknown>;
    stat(path: unknown): Promise<unknown>;
  } | undefined;
  mcpManager: {
    config: {
      servers: LiveValue<Record<string, {
        enabled?: boolean;
        transport?: unknown;
      }>>;
    };
    list(): {
      name: string;
      configured: boolean;
    }[];
  } | undefined;
}
interface NativeScope {
  ctx: NativeContext;
  dispose(): Promise<void>;
}
type CreateScope = (ctx: NativeContext, key: unknown) => NativeScope;
interface NativeEvents {
  'agent/created': [event: {
    agent: NativeAgent;
  }];
  'agent/disposed': [event: {
    agent: NativeAgent;
  }];
  'agent-preset/selected': [id: string];
  'agent/pre-step': [event: {
    agent: NativeAgent;
  }, next: () => unknown];
  'settings/document-updated': [namespace: string];
  'app-boot/config-reload': [];
  'plugin-manager/changed': [];
}
/** Structural adapter for the verified current host; optional services are acquired in child contexts. */
interface NativeContext {
  invocation?: {
    peer: {
      principal: {
        kind: string;
      };
    };
  };
  fiber: {
    entry: NativeEntry;
  };
  profileContext: {
    home: string;
  };
  effect(effect: () => void | Release | (() => Promise<void>)): Release;
  inject(dependencies: string[], callback: (ctx: NativeContext) => unknown): unknown;
  on<E extends keyof NativeEvents>(event: E, listener: (...args: NativeEvents[E]) => unknown, options?: {
    global?: boolean;
    prepend?: boolean;
  }): Release;
  get<K extends keyof NativeServices>(key: K): NativeServices[K];
  pluginManager: {
    listPlugins(): Promise<NativePlugin[]>;
    listBundles(): Promise<{
      enabled: boolean;
      name: string;
      rows: {
        moduleName: string;
        entryId: string;
      }[];
    }[]>;
    setPluginEnabled(id: string, enabled: boolean): Promise<NativeChangeResult>;
  };
  configEditor: {
    entries(): NativeEntry[];
    edit(entry: NativeEntry, edit: (raw: NativePayload) => NativePayload): Promise<unknown>;
  };
  agents: {
    get(id: string): NativeAgent | undefined;
    list(): NativeAgent[];
  };
  agentPresets: NativePresets;
  skills: NativeSkills;
  tools: NativeTools;
  settings: NativeSettings;
  clientModules: {
    graph(): {
      release?: {
        version: string;
      };
    };
  };
  typert: {
    register(descriptor: unknown): Release;
  };
  sessionProjections: {
    register(projection: unknown): Promise<unknown>;
  };
  workspaceRegistry: {
    list(): {
      path: string;
      title: string;
    }[];
  };
  workspaceController?: NativeWorkspaceController;
  sessionQuery?: NativeSessionQuery;
  sessionPersistence?: NativeSessionPersistence;
  workingDirectory: {
    defaultDirectory: string;
  };
  loader: {
    import(name: '@deepseek-ai/dsh-scope'): Promise<{
      createScope: CreateScope;
      scopeOf(ctx: NativeContext): unknown;
      scopeChainOf(key: unknown): unknown[];
    }>;
    import(name: string): Promise<unknown>;
    entries(): Iterable<NativeEntry>;
    await?(): Promise<void>;
  };
  registry: {
    get(module: unknown): {
      fibers: Iterable<NativeFiber>;
    } | undefined;
  };
}
interface HostOptions {
  owner: NativeContext;
  ensureActive(): void;
}
type PolicyMethod = 'setAccountBlocked' | 'setTelemetryBlocked' | 'setTodoBlocked' | 'setPlanBlocked' | 'setGoalBlocked' | 'setSearchBlocked';
interface SettingsService {
  setAccountBlocked(blocked: boolean): Promise<PolicyResult>;
  setTelemetryBlocked(blocked: boolean): Promise<PolicyResult>;
  setTodoBlocked(blocked: boolean): Promise<PolicyResult>;
  setPlanBlocked(blocked: boolean): Promise<PolicyResult>;
  setGoalBlocked(blocked: boolean): Promise<PolicyResult>;
  setSearchBlocked(blocked: boolean): Promise<PolicyResult>;
  telemetry: {
    status(): Promise<TelemetryStatus>;
  };
}
type ToolSchema = import('@deepseek-ai/dsh-tools').ParameterPropertySpec;
interface SettingsToolContribution {
  parameters: Partial<Record<SettingsParameter, ToolSchema>>;
  output: Partial<Record<keyof SettingsOutput, ToolSchema>>;
  mutations?: {
    field: SettingsParameter;
    order: number;
    method?: PolicyMethod;
  }[];
  reads?: {
    order: number;
    read(input: {
      ctx: NativeContext;
      config: LivePreferences;
      service: SettingsService;
    }): Partial<SettingsOutput> | Promise<Partial<SettingsOutput>>;
  }[];
}
type ConfigFields = Partial<{ [K in PreferenceKey]: z<Preferences[K], Preferences[K], 'volatile-defined'>; }>;
interface HostFeature {
  definition: FeatureDefinition;
  configFields: ConfigFields;
  settingsTool?: SettingsToolContribution;
  createHost?(ctx: NativeContext, config: LivePreferences, options: HostOptions): object;
  methods?: Partial<PowerDshMethods>;
  rpc?: RpcDescriptor<PowerDshMethod>[];
}
export declare const Config: z<Partial<Preferences>, LivePreferences>;
export declare const inject: string[];
export declare function apply(ctx: unknown, config: LivePreferences, features?: readonly HostFeature[] | undefined): void;
export {};