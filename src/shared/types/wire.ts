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
