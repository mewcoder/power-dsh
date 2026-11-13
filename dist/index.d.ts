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
  notificationMode: string;
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
  showBackgroundShortcut: boolean;
  wallpaperEnabled?: boolean;
  wallpaperSelection?: string;
  wallpaperVisibility?: number;
  wallpaperBlur?: number;
  archiveManagerEnabled: boolean;
  autoArchiveDays: number;
  autoArchivedSessions: string[];
  usageStatsEnabled: boolean;
  projectManagerEnabled: boolean;
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
type FeatureId = 'version-display' | 'appearance-shortcut' | 'refresh-button' | 'restart-button' | 'notifications' | 'personalization' | 'skills' | 'mcp' | 'account-blocking' | 'search-blocking' | 'telemetry-blocking' | 'todo-blocking' | 'plan-blocking' | 'goal-blocking' | 'double-click-rename' | 'thinking-effort' | 'flowing-background' | 'archive' | 'usage-stats' | 'projects' | 'wallpaper' | 'plugin-updates';
type FeatureCategory = 'general' | 'interface' | 'enhance' | 'simplify' | 'other';
interface FeatureDefinition {
  readonly id: FeatureId;
  readonly category: FeatureCategory;
  readonly order: number;
  readonly keys: readonly PreferenceKey[];
  readonly spec: string;
}
type SkillScope = 'user' | 'project';
interface SkillOccurrence {
  agent: string;
  path: string;
  realPath: string;
  linked: boolean;
}
interface SkillVariant {
  id: string;
  description: string;
  path: string;
  flat: boolean;
  revision: string;
  sources: SkillOccurrence[];
}
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
interface ExternalSkillEntry {
  id: string;
  name: string;
  description: string;
  source: string;
  path: string;
  flat: boolean;
  variants?: SkillVariant[];
  sources?: SkillOccurrence[];
  comparison?: 'same' | 'different' | 'unknown';
  available?: boolean;
  conflict?: boolean;
  inherited?: boolean;
}
interface ExternalSkillDetail {
  name: string;
  description: string;
  /** Markdown body from the skill's `SKILL.md`, read on demand. */
  content: string;
  source: string;
  path: string;
}
interface ExternalSkillCatalog {
  complete: boolean;
  entries: ExternalSkillEntry[];
}
interface SkillImportResult {
  imported: string[];
  skipped: {
    name: string;
    reason: string;
  }[];
}
interface SkillImportDestination {
  path: string;
  complete: boolean;
  available: boolean;
  inherited: boolean;
}
interface SkillDetail {
  name: string;
  description: string;
  /** Markdown body from `SKILL.md`; empty when the provider serves no body. */
  content: string;
  /** Native discovery source, kept verbatim so the dialog can name it. */
  source: string;
  path: string;
  origin: string;
  enabled: boolean;
  modelInvocable: boolean;
  userInvocable: boolean;
  deletion?: SkillDeletion;
}
interface SkillDeletion {
  path: string;
  linked: boolean;
  revision: string;
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
/** Only explicitly declared reconnect fields; omitted values use the host's defaults. */
interface McpReconnectConfig {
  enabled?: boolean;
  initialDelayMs?: number;
  maxDelayMs?: number;
  maxAttempts?: number;
}
/** Read-only transport projection with masked argument credentials and no environment/header values. */
interface McpServerConfig {
  transport: McpTransport;
  /** Present only when the entry declares the field; defaults are not listed. */
  serverName?: string;
  command?: string;
  /** An empty list confirms no arguments; omission means their contents are unknown. */
  args?: string[];
  cwd?: string;
  url?: string;
  envKeys: string[];
  headerKeys: string[];
  reconnect?: McpReconnectConfig;
  /** Config fields supplied by a loader expression, so their value is not shown. */
  expressions: string[];
  /** The endpoint was omitted or contained parts outside the displayed origin. */
  urlQueryHidden: boolean;
}
interface McpServerDetail {
  server: McpServer;
  /** Null when the entry's configuration is not readable from this profile. */
  config: McpServerConfig | null;
}
interface PersonalizationFile {
  path: string;
  text: string;
  revision: string;
}
interface WallpaperAsset {
  path?: string;
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
interface WindowsNotification {
  group: string;
  tag: string;
  title: string;
  body: string;
  attention: boolean;
  preview: boolean;
  dismiss: string;
}
interface NotificationDelivery {
  shown: boolean;
  reason?: 'identity' | 'disabled';
}
interface NotificationCleared {
  cleared: boolean;
}
interface NotificationTransport {
  platform: 'win32' | 'darwin' | 'other';
  nativeAvailable: boolean;
  version: string;
}
interface PluginUpdateDiagnostic {
  stage: 'release.rpc' | 'git.resolve' | 'git.tags' | 'release.latest' | 'release.asset' | 'market.capabilities' | 'market.updates' | 'market.submit' | 'market.operation' | 'update.validation' | 'update.resume';
  reason: 'unavailable' | 'not-found' | 'process-exit' | 'incomplete-output' | 'http' | 'invalid-response' | 'tag-mismatch' | 'timeout' | 'cancelled' | 'network' | 'rate-limited' | 'identity-changed' | 'unknown-result' | 'dns' | 'proxy' | 'certificate' | 'authentication' | 'connection';
  observedAt: string;
  httpStatus?: number;
  exitCode?: number;
  systemCode?: string;
  elapsedMs?: number;
}
type PluginRelease = {
  status: 'ready';
  version: string;
  commit: string;
} | {
  status: 'unavailable' | 'git-unavailable';
  diagnostic?: PluginUpdateDiagnostic;
} | {
  status: 'rate-limited';
  retryAt: number;
  diagnostic?: PluginUpdateDiagnostic;
};
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
  path: string;
}
interface ArchiveSessionRow {
  sessionId: string;
  title: string;
  workspaceId: string;
  workspaceTitle: string;
  workspacePath: string;
  updatedAt: number;
  createdAt: number;
}
interface ArchiveCatalog {
  complete: boolean;
  workspaces: ArchiveWorkspaceRow[];
  sessions: ArchiveSessionRow[];
}
/** One day of locally recorded token activity; dates are `YYYY-MM-DD` in the reporting zone. */
interface UsageDayRow {
  date: string;
  totalTokens: number;
  turnCount: number;
  toolCallCount: number;
  /** Disjoint provider counters; the four parts sum to the day's total. */
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Recorded assistant messages on this day, including those without usage. */
  requestCount: number;
  /** Completed step runtime clipped to this calendar day. */
  activeMs: number;
}
interface UsageModelRow {
  modelId: string;
  provider: string;
  totalTokens: number;
  requestCount: number;
}
/** One model's tokens on one day, for the per-model trend lines. */
interface UsageDailyModelRow {
  date: string;
  modelId: string;
  provider: string;
  totalTokens: number;
  /** Billed settlements attributed to this model on this day. */
  requestCount: number;
}
interface UsageSummary {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  peakDayTokens: number;
  longestSessionMs: number;
  currentStreakDays: number;
  longestStreakDays: number;
  activeDays: number;
  sessionCount: number;
  turnCount: number;
}
interface UsageSnapshot {
  /** Whether every readable session log was folded; false when some were skipped. */
  complete: boolean;
  generatedAt: number;
  /** IANA zone the day buckets use; always the calling browser's zone. */
  timeZone: string;
  /** Earliest and latest observed activity date, or empty when nothing was recorded. */
  firstDate: string;
  lastDate: string;
  summary: UsageSummary;
  /** Activity dates per main-session family, without identifiers; count each family once in a date range. */
  sessionDays: string[][];
  /** Continuous daily series over the whole history, zero-filled for quiet days. */
  days: UsageDayRow[];
  /** Per-day totals for the models that appear in `models`, largest first. */
  dailyModels: UsageDailyModelRow[];
  /** Models ordered by total tokens, largest first. */
  models: UsageModelRow[];
}
interface ProjectRow {
  workspaceId: string;
  title: string;
  /** Native Workspace directory; empty when the baseline predates it. */
  path: string;
  /** Sessions currently accounted to this Workspace, archived ones included. */
  sessionCount: number;
  /** Latest activity among the Workspace's Sessions; 0 when none is dated. */
  lastActiveAt: number;
}
interface ProjectCatalog {
  complete: boolean;
  /** Native registry order, so manual sorting mirrors the sidebar. */
  projects: ProjectRow[];
}
/** Named Host operations, before the transport adds its result envelope. */
interface PowerDshMethods {
  restartStatus(): Promise<RestartStatus>;
  restartApp(): Promise<RestartAccepted>;
  listSystemSounds(): Promise<SystemSoundsCatalog>;
  playSystemSound(id: string, preview: boolean): Promise<SoundPlayback>;
  showWindowsNotification(notification: WindowsNotification): Promise<NotificationDelivery>;
  clearWindowsNotifications(group: string, tag: string): Promise<NotificationCleared>;
  notificationTransport(): Promise<NotificationTransport>;
  readPluginRelease(): Promise<PluginRelease>;
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
  readSkill(cwd: string, scope: string, name: string): Promise<SkillDetail | null>;
  setSkillEnabled(cwd: string, scope: string, name: string, enabled: boolean): Promise<SkillCatalog>;
  discoverExternalSkills(cwd: string, scope: string): Promise<ExternalSkillCatalog>;
  readExternalSkill(cwd: string, scope: string, id: string): Promise<ExternalSkillDetail | null>;
  importExternalSkills(cwd: string, scope: string, ids: string[]): Promise<SkillImportResult>;
  addSkill(cwd: string, scope: string, id: string, mode: string, revision: string): Promise<SkillImportResult>;
  readSkillImportDestination(cwd: string, scope: string, name: string, flat: boolean): Promise<SkillImportDestination>;
  importSkillTo(cwd: string, scope: string, id: string, revision: string, targetCwd: string): Promise<SkillImportResult>;
  deleteSkill(cwd: string, scope: string, name: string, revision: string): Promise<SkillCatalog>;
  listMcpServers(): Promise<McpCatalog>;
  readMcpServer(id: string): Promise<McpServerDetail | null>;
  setMcpServerEnabled(id: string, enabled: boolean): Promise<McpCatalog>;
  listArchivedSessions(): Promise<ArchiveCatalog>;
  restoreArchivedSession(sessionId: string): Promise<ArchiveCatalog>;
  deleteArchivedSession(sessionId: string): Promise<ArchiveCatalog>;
  readUsageStats(timeZone: string): Promise<UsageSnapshot>;
  listProjects(): Promise<ProjectCatalog>;
  removeProject(workspaceId: string): Promise<ProjectCatalog>;
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
  delete(request: {
    workspaceId: string;
  }): Promise<{
    deleted: boolean;
  }>;
}
/** Session list surface: the same activity order the native sidebar dates rows with. */
interface NativeSessionController {
  list(request: Record<string, never>, signal?: AbortSignal): Promise<{
    items: readonly {
      sessionId: string;
      updatedAt: number;
    }[];
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
  /** Load one skill's full definition, including its Markdown body. */
  get(name: string, options?: {
    cwd?: string;
    scope?: unknown;
  }): Promise<(NativeSkill & {
    content: string;
  }) | undefined>;
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
  collected?: {
    stdout?: {
      readFrom(offset: number): {
        text: string;
        lossy: boolean;
      };
    };
    stderr?: {
      readFrom(offset: number): {
        text: string;
        lossy: boolean;
      };
    };
  };
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
    env?: Record<string, string>;
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
  sessionController?: NativeSessionController;
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