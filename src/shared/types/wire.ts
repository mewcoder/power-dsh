// Pure wire data models. Feature modules retain their codecs and runtime ownership.

export type SkillScope = 'user' | 'project';
export type SkillImportMode = 'copy' | 'link';
export interface SkillOccurrence {
  agent: string;
  path: string;
  realPath: string;
  linked: boolean;
}
export interface SkillVariant {
  id: string;
  description: string;
  path: string;
  flat: boolean;
  revision: string;
  sources: SkillOccurrence[];
}
export interface SkillWorkspace {
  path: string;
  title: string;
}
export interface SkillRow {
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
export type SkillEntry = SkillRow;
export interface SkillCatalog {
  cwd: string;
  scope: SkillScope;
  workspaces: SkillWorkspace[];
  complete: boolean;
  skills: SkillRow[];
}
export interface ExternalSkillEntry {
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
export interface ExternalSkillDetail {
  name: string;
  description: string;
  /** Markdown body from the skill's `SKILL.md`, read on demand. */
  content: string;
  source: string;
  path: string;
}
export interface ExternalSkillCatalog {
  complete: boolean;
  entries: ExternalSkillEntry[];
}
export interface SkillImportResult {
  imported: string[];
  skipped: { name: string; reason: string }[];
}
export interface SkillImportDestination {
  path: string;
  complete: boolean;
  available: boolean;
  inherited: boolean;
}
export interface SkillDetail {
  name: string;
  description: string;
  /** Markdown body from `SKILL.md`; empty when the provider serves no body. */
  content: string;
  /** Native discovery source, kept verbatim so the dialog can name it. */
  source: string;
  path: string;
  linkTarget?: string;
  origin: string;
  enabled: boolean;
  modelInvocable: boolean;
  userInvocable: boolean;
  /** The currently opened copy, kept for older clients and single-path deletion. */
  deletion?: SkillDeletion;
  /** Every deletable DSH copy of this skill across the current scope and workspaces. */
  deletions?: SkillDeletionOption[];
}
export interface SkillDeletion {
  path: string;
  linked: boolean;
  revision: string;
}
export interface SkillDeletionOption extends SkillDeletion {
  /** Empty for the global copy; workspace path for a project copy. */
  cwd: string;
  scope: SkillScope;
  /** Saved workspace title; empty for the global copy. */
  workspaceTitle: string;
}

export type McpRuntimeState = 'pending' | 'loading' | 'active' | 'failed' | 'unloading' | 'inactive' | 'disabled' | 'unknown';
export type McpTransport = 'stdio' | 'streamable-http' | 'unknown';
/** Live connection state reported by the native MCP client supervisor, not the load lifecycle. */
export type McpConnectionState = 'connected' | 'connecting' | 'reconnecting' | 'waiting-credentials' | 'failed' | 'closed';
export interface McpConnection {
  state: McpConnectionState;
  /** Connected: registered tools in the live generation. */
  toolCount?: number;
  /** Connected: epoch milliseconds when connect plus the initial tool sync completed. */
  connectedAt?: number;
  /** Connecting / reconnecting: consecutive failed attempts in the current outage. */
  attempt?: number;
  /** Reconnecting: the per-outage attempt budget. */
  maxAttempts?: number;
  /** Failed: which terminal stop produced this state. */
  reason?: 'gave-up' | 'reconnect-disabled' | 'unclosed-generation';
}
export interface McpServer {
  id: string;
  name: string;
  source: string;
  origin: string;
  reason: string;
  group: 'user' | 'builtin';
  transport: McpTransport;
  runtimeState: McpRuntimeState;
  /** Present only when a live native connection handle reports a state. */
  connection?: McpConnection;
  tools: string[];
  enabled: boolean;
  stateKnown: boolean;
  canToggle: boolean;
}
/** Read-only connectivity probe of one server; it never registers tools or keeps a process. */
export type McpProbe =
  | {
    ok: true;
    /** Identity the server reported during negotiation, when it sent one. */
    serverInfo?: { name: string; version: string };
    /** Raw advertised tool names, capped by the native probe. */
    toolNames: string[];
    truncated: boolean;
    durationMs: number;
    /** The connection succeeded but transport closure or local cleanup was not confirmed. */
    cleanupFailed: boolean;
  }
  | {
    ok: false;
    stage: 'connect' | 'list';
    /** Sanitized diagnostic text; never carries credentials or machine paths. */
    message: string;
    durationMs: number;
    cleanupFailed: boolean;
  };
export interface McpCatalog {
  complete: boolean;
  servers: McpServer[];
}
/** Only explicitly declared reconnect fields; omitted values use the host's defaults. */
export interface McpReconnectConfig {
  enabled?: boolean;
  initialDelayMs?: number;
  maxDelayMs?: number;
  maxAttempts?: number;
}
/** Read-only transport projection with masked argument credentials and no environment/header values. */
export interface McpServerConfig {
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
export interface McpServerDetail {
  server: McpServer;
  /** Null when the entry's configuration is not readable from this profile. */
  config: McpServerConfig | null;
}

export interface PersonalizationFile {
  path: string;
  text: string;
  revision: string;
}

export interface WallpaperAsset {
  path?: string;
  name: string;
  mime: string;
  bytes: number;
  dataUrl: string;
}
export interface WallpaperCleared {
  cleared: true;
}

export interface SoundEntry {
  id: string;
  name: string;
}
export interface SystemSoundsCatalog {
  platform: 'darwin' | 'win32' | 'other';
  sounds: SoundEntry[];
}
export type SystemSounds = SystemSoundsCatalog;
export interface SoundPlayback { played: boolean }
export interface WindowsNotification {
  group: string; tag: string; title: string; body: string;
  attention: boolean; preview: boolean; dismiss: string;
}
export interface NotificationDelivery { shown: boolean; reason?: 'identity' | 'disabled' }
export interface NotificationCleared { cleared: boolean }
export interface NotificationTransport { platform: 'win32' | 'darwin' | 'other'; nativeAvailable: boolean; version: string }
export interface PluginUpdateDiagnostic {
  stage: 'release.rpc' | 'git.resolve' | 'git.tags' | 'release.latest' | 'release.asset'
    | 'market.capabilities' | 'market.updates' | 'market.submit' | 'market.operation' | 'update.validation' | 'update.resume';
  reason: 'unavailable' | 'not-found' | 'process-exit' | 'incomplete-output' | 'http' | 'invalid-response'
    | 'tag-mismatch' | 'timeout' | 'cancelled' | 'network' | 'rate-limited' | 'identity-changed' | 'unknown-result'
    | 'dns' | 'proxy' | 'certificate' | 'authentication' | 'connection';
  observedAt: string;
  httpStatus?: number;
  exitCode?: number;
  systemCode?: string;
  elapsedMs?: number;
}
export type PluginRelease = { status: 'ready'; version: string; commit: string }
  | { status: 'unavailable' | 'git-unavailable'; diagnostic?: PluginUpdateDiagnostic }
  | { status: 'rate-limited'; retryAt: number; diagnostic?: PluginUpdateDiagnostic };

export interface RestartStatus {
  supported: boolean;
  running: boolean;
  error: '' | 'restartFailed';
}
export interface RestartAccepted { accepted: true }

export interface ArchiveWorkspaceRow {
  workspaceId: string;
  title: string;
  path: string;
}
export interface ArchiveSessionRow {
  sessionId: string;
  title: string;
  workspaceId: string;
  workspaceTitle: string;
  workspacePath: string;
  updatedAt: number;
  createdAt: number;
}
export interface ArchiveCatalog {
  complete: boolean;
  workspaces: ArchiveWorkspaceRow[];
  sessions: ArchiveSessionRow[];
}

/** One day of locally recorded token activity; dates are `YYYY-MM-DD` in the reporting zone. */
export interface UsageDayRow {
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
export interface UsageModelRow {
  modelId: string;
  provider: string;
  totalTokens: number;
  requestCount: number;
  /** Model settlements attempted, including failed attempts. */
  attemptCount: number;
  /** Attempts that settled without an assembled assistant message. */
  failedAttemptCount: number;
  /** Scheduled retry attempts attributed to this model. */
  retryCount: number;
  outputTokens: number;
  ttftMs: number;
  ttftSteps: number;
  decodeMs: number;
  decodeTokens: number;
}
/** One model's tokens on one day, for the per-model trend lines. */
export interface UsageDailyModelRow {
  date: string;
  modelId: string;
  provider: string;
  totalTokens: number;
  /** Billed settlements attributed to this model on this day. */
  requestCount: number;
  /** Model settlements attempted, including failed attempts. */
  attemptCount: number;
  /** Attempts that settled without an assembled assistant message. */
  failedAttemptCount: number;
  /** Scheduled retry attempts attributed to this model. */
  retryCount: number;
  outputTokens: number;
  ttftMs: number;
  ttftSteps: number;
  decodeMs: number;
  decodeTokens: number;
}
export interface UsageWorkspaceDayRow {
  date: string;
  totalTokens: number;
  activeMs: number;
}
/** One workspace's usage in the selected range, derived from session cwd. */
export interface UsageWorkspaceRow {
  path: string;
  totalTokens: number;
  activeMs: number;
  /** Activity dates per main-session family in this workspace, without identifiers. */
  sessionDays: string[][];
  /** Continuous daily series over the whole history, zero-filled for quiet days. */
  days: UsageWorkspaceDayRow[];
}
export interface UsageSummary {
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
/** Usage card totals, with disjoint provider input counters. */
export interface UsageCardSummary {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  requestCount: number;
  sessionCount: number;
  activeMs: number;
}
export interface UsageSnapshot {
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
  /** Workspaces ordered by total tokens in the selected range. */
  workspaces: UsageWorkspaceRow[];
}

export interface ProjectRow {
  workspaceId: string;
  title: string;
  /** Native Workspace directory; empty when the baseline predates it. */
  path: string;
  /** Sessions currently accounted to this Workspace, archived ones included. */
  sessionCount: number;
  /** Latest activity among the Workspace's Sessions; 0 when none is dated. */
  lastActiveAt: number;
}
export interface ProjectCatalog {
  complete: boolean;
  /** Native registry order, so manual sorting mirrors the sidebar. */
  projects: ProjectRow[];
}
export type MemoryType = 'user' | 'feedback' | 'project' | 'reference';
export interface MemoryEntry {
  id: string; name: string; description: string; type: MemoryType;
  created: string; updated: string; originSessionId: string; revision: string; invalid: boolean;
}
export interface MemorySource { sessionId: string; seq: number; time: number; hash: string }
export interface MemoryDetail extends MemoryEntry {
  content: string; source?: MemorySource | null;
}
export interface MemorySourceMessage {
  seq: number; time: number; role: 'user' | 'assistant'; text: string;
  target: boolean; offset: number; nextOffset: number | null; length: number;
}
export interface MemorySourceResult {
  available: boolean;
  historical?: boolean;
  reason: '' | 'not-recorded' | 'unavailable' | 'not-found' | 'changed' | 'workspace';
  source: MemorySource | null; messages: MemorySourceMessage[];
}
export interface MemoryFileDetail extends MemoryDetail { path: string }
export interface MemoryScope {
  id: string; cwd: string; revision: string; complete: boolean; entries: MemoryEntry[];
}
export interface MemoryCatalog { path: string; available: boolean; error: string; scopes: MemoryScope[] }
export interface MemoryWriteResult { indexUpdated: boolean }
export interface MemoryModel { provider: string; model: string; reasoningEffort?: string }
export interface MemoryModels { models: (MemoryModel & { label: string })[]; default: MemoryModel | null }
export interface MemoryCleanupChange {
  before: MemoryDetail; description: string; content: string; removed: MemoryDetail[]; reason: string;
}
export interface MemoryCleanupPreview {
  token: string; scope: string; revision: string; changes: MemoryCleanupChange[];
}
export interface MemoryCleanupResult extends MemoryWriteResult { backup: string }

/** One content-search hit: a session id plus a bounded snippet centered on the match. */
export interface SearchContentHit {
  sessionId: string;
  snippet: string;
}
/** Result of one content search over the derived session index. */
export interface SearchContentResult {
  available: boolean;
  items: SearchContentHit[];
  /**
   * Recent-message previews for sessions the caller named. A title match has no
   * content hit, so the row would otherwise leave its snippet line blank.
   */
  previews: SearchContentHit[];
}

/** One configured provider instance as a chain renders it. */
export interface WebSearchSlotRow {
  /** Instance id, unique across both chains; also the credential record id. */
  id: string;
  /** Vendor id: `tavily`, `firecrawl`, `tinyfish`, or `exa`. */
  provider: string;
  /** Where the user creates this vendor's API key. */
  keyUrl: string;
  /** Whether a non-empty key is stored. */
  configured: boolean;
  /** Whether a key value is actually stored. */
  hasKey: boolean;
  /** Whether the credential store accepts a write. */
  writable: boolean;
}
/** One capability's chain: its instances in fallback order. */
export interface WebSearchChain {
  /** Instance ids in fallback order, including `power-dsh-local-fetch` for fetch. */
  ids: string[];
}
/** The whole web-search page state: two independent chains of instances. */
export interface WebSearchCatalog {
  enabled: boolean;
  available: boolean;
  /** Every instance in either chain, keyed by its id. */
  slots: WebSearchSlotRow[];
  search: WebSearchChain;
  fetch: WebSearchChain;
}
/** One key-verification call against one backend. */
export interface TaskModelSelection { provider: string; model: string; reasoningEffort?: string }
export interface TaskModelOption { provider: string; model: string; label: string; efforts: { id: string; label: string }[] }
export interface TaskModelRow {
  id: string; title: string; target: 'new' | 'new_once' | 'session'; status: string;
  selection: TaskModelSelection | null; error: string;
}
export interface TaskModelCatalog { revision: string; tasks: TaskModelRow[]; models: TaskModelOption[] }

export interface WebSearchProbeDiagnostic {
  provider: 'tavily' | 'firecrawl' | 'tinyfish' | 'exa' | 'unknown';
  stage: 'credentials' | 'request' | 'response' | 'rpc';
  reason: 'key-missing' | 'auth' | 'forbidden' | 'quota' | 'rate-limit' | 'http' | 'network' | 'timeout' | 'invalid-response' | 'empty-response' | 'rpc' | 'unknown';
  auth: 'keyless' | 'missing' | 'api-key' | 'unknown';
  observedAt: string;
  httpStatus?: number;
  systemCode?: string;
}
export interface WebSearchProbe {
  ok: boolean;
  resultCount: number;
  durationMs: number;
  /** Safe one-line reason when `ok` is false. */
  message: string;
  diagnostic?: WebSearchProbeDiagnostic;
}
export type WebSearchQuotaData =
  | { kind: 'credits'; scope: 'key' | 'account'; used?: number; limit: number | null; remaining: number | null; paygoRemaining?: number }
  | { kind: 'balance'; currency: 'USD'; balance: string };
export type WebSearchQuota =
  | { status: 'ready'; observedAt: string; data: WebSearchQuotaData }
  | { status: 'error'; durationMs: number; diagnostic: WebSearchProbeDiagnostic }
  | { status: 'missing' | 'unsupported' };
