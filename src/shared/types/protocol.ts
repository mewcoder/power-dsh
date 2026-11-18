import type { SkillCatalog, SkillDetail, ExternalSkillCatalog, ExternalSkillDetail, SkillImportResult, SkillImportDestination, McpCatalog, McpServerDetail, McpProbe, PersonalizationFile, SystemSoundsCatalog, SoundPlayback, RestartStatus, RestartAccepted, ArchiveCatalog, WallpaperAsset, WallpaperCleared, UsageSnapshot, ProjectCatalog } from './wire.ts';
import type { WindowsNotification, NotificationDelivery, NotificationCleared } from './wire.ts';
import type { NotificationTransport, PluginRelease } from './wire.ts';
import type { SearchContentResult } from './wire.ts';
import type { MemoryCatalog, MemoryFileDetail, MemoryWriteResult, MemoryModels, MemoryCleanupPreview, MemoryCleanupResult, MemorySourceResult } from './wire.ts';
import type { WebSearchCatalog, WebSearchProbe, WebSearchQuota } from './wire.ts';
import type { TaskModelCatalog } from './wire.ts';

/** Named Host operations, before the transport adds its result envelope. */
export interface PowerDshMethods {
  readTaskModels(): Promise<TaskModelCatalog>;
  saveTaskModel(id: string, selection: string, revision: string): Promise<TaskModelCatalog>;
  memoryCleanupModels(): Promise<MemoryModels>;
  prepareMemoryCleanup(scope: string, model: string, token: string): Promise<MemoryCleanupPreview>;
  cancelMemoryCleanup(token: string): Promise<boolean>;
  applyMemoryCleanup(token: string): Promise<MemoryCleanupResult>;
  listMemoryEntries(): Promise<MemoryCatalog>;
  readMemoryEntry(scope: string, id: string): Promise<MemoryFileDetail>;
  readMemorySource(scope: string, id: string, revision: string, offset: string): Promise<MemorySourceResult>;
  deleteMemoryEntry(scope: string, id: string, revision: string): Promise<MemoryWriteResult>;
  clearMemoryScope(scope: string, revision: string): Promise<MemoryWriteResult>;
  openMemoryFolder(scope: string): Promise<boolean>;
  restartStatus(): Promise<RestartStatus>;
  restartApp(): Promise<RestartAccepted>;
  restartAfterUpdate(): Promise<RestartAccepted>;
  pluginRuntimeVersion(): Promise<string>;
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
  setSearchPopupEnabled(enabled: boolean): Promise<PolicyResult>;
  searchSessionContent(query: string, limit: number, previewIds: readonly string[], sessionIds: readonly string[]): Promise<SearchContentResult>;
  readRecentSessionPreviews(sessionIds: readonly string[], versions: readonly string[]): Promise<SearchContentResult>;
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
  probeMcpServer(id: string): Promise<McpProbe>;
  readWebSearch(): Promise<WebSearchCatalog>;
  readWebSearchQuota(id: string): Promise<WebSearchQuota>;
  addWebSearchSlot(capability: string, provider: string): Promise<WebSearchCatalog>;
  removeWebSearchSlot(capability: string, id: string): Promise<WebSearchCatalog>;
  reorderWebSearchChain(capability: string, ids: readonly string[]): Promise<WebSearchCatalog>;
  saveWebSearchKey(id: string, value: string): Promise<WebSearchCatalog>;
  probeWebSearchSearch(id: string): Promise<WebSearchProbe>;
  probeWebSearchFetch(id: string): Promise<WebSearchProbe>;
  listArchivedSessions(): Promise<ArchiveCatalog>;
  restoreArchivedSession(sessionId: string): Promise<ArchiveCatalog>;
  deleteArchivedSession(sessionId: string): Promise<ArchiveCatalog>;
  readUsageStats(timeZone: string): Promise<UsageSnapshot>;
  listProjects(): Promise<ProjectCatalog>;
  removeProject(workspaceId: string): Promise<ProjectCatalog>;
}
export type PowerDshMethod = keyof PowerDshMethods;

export interface Codec<T> {
  mode: 'strict';
  typeSymbol: string;
  create(): { parse(value: unknown): T };
}
export interface PolicyResult { blocked: boolean }
export interface RpcParameter {
  name: string;
  wire: string;
  source: 'json';
  codec: Codec<unknown>;
}
export interface RpcDescriptor<M extends string = string, R = unknown> {
  id: `power-dsh#powerDsh/${M}`;
  service: 'powerDsh';
  namespace: 'powerDsh';
  method: M;
  invocation: { kind: 'direct' };
  parameters: RpcParameter[];
  result: Codec<R>;
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}
export function isStringArray(value: unknown): value is string[] {
  return isArray(value) && value.every(item => typeof item === 'string');
}

/** Validate external wire objects before reading their fields. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
export function hasStrings<K extends string>(value: Record<string, unknown>, keys: readonly K[]): value is Record<K, string> & Record<string, unknown> {
  return keys.every(key => typeof value[key] === 'string');
}
export function hasBooleans<K extends string>(value: Record<string, unknown>, keys: readonly K[]): value is Record<K, boolean> & Record<string, unknown> {
  return keys.every(key => typeof value[key] === 'boolean');
}
export function isOneOf<const T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}
