import type { SkillCatalog, McpCatalog, PersonalizationFile, SystemSoundsCatalog, SoundPlayback, RestartStatus, RestartAccepted, ArchiveCatalog, WallpaperAsset, WallpaperCleared, UsageSnapshot, ProjectCatalog } from './wire.ts';

/** Named Host operations, before the transport adds its result envelope. */
export interface PowerDshMethods {
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
