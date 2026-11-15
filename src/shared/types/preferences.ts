export interface DisabledSkillPreference {
  name: string;
  description: string;
  source: string;
  provider: string;
  path: string;
  scope: string;
  projectRoot: string;
  origin: string;
}

export interface Preferences {
  showVersion: boolean;
  showThemeSwitcher: boolean;
  showRefreshButton: boolean;
  showRestartButton: boolean;
  notificationsEnabled: boolean;
  notificationMode: string;
  notificationSoundEnabled: boolean;
  notificationSound: string;
  personalizationEnabled: boolean;
  memoryEnabled: boolean;
  memoryAutoCapture: boolean;
  memoryGlobalEnabled: boolean;
  memoryWorkspaceEnabled: boolean;
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
  standalonePageEnabled: boolean;
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
  searchPopupEnabled: boolean;
}
export type PreferenceKey = keyof Preferences;
export type PowerDshPreferences = Preferences;
export interface LiveValue<T> { get(): T }
export type LivePreferences = { [K in PreferenceKey]: LiveValue<Preferences[K]> };
export interface TelemetryStatus {
  protected: boolean;
  senders: { id: string; enabled: boolean; active: boolean; available: boolean }[];
}
