// Pure wire data models. Feature modules retain their codecs and runtime ownership.

export type SkillScope = 'user' | 'project';
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
export interface SkillDetail {
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
}

export type McpRuntimeState = 'pending' | 'loading' | 'active' | 'failed' | 'unloading' | 'inactive' | 'disabled' | 'unknown';
export type McpTransport = 'stdio' | 'streamable-http' | 'unknown';
export interface McpServer {
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
/** Read-only transport projection with no argument, environment, or header values. */
export interface McpServerConfig {
  transport: McpTransport;
  /** Present only when the entry declares the field; defaults are not listed. */
  serverName?: string;
  command?: string;
  argsHidden?: boolean;
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
}
/** One model's tokens on one day, for the per-model trend lines. */
export interface UsageDailyModelRow {
  date: string;
  modelId: string;
  provider: string;
  totalTokens: number;
  /** Billed settlements attributed to this model on this day. */
  requestCount: number;
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
