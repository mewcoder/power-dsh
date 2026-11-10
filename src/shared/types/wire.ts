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
}
export interface ArchiveSessionRow {
  sessionId: string;
  title: string;
  workspaceId: string;
  workspaceTitle: string;
  updatedAt: number;
  createdAt: number;
}
export interface ArchiveCatalog {
  complete: boolean;
  workspaces: ArchiveWorkspaceRow[];
  sessions: ArchiveSessionRow[];
}
