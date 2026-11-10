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
export type PreferenceKey = keyof Preferences;
export type PowerDshPreferences = Preferences;
export interface LiveValue<T> { get(): T }
export type LivePreferences = { [K in PreferenceKey]: LiveValue<Preferences[K]> };
export type SettingsParameter = 'showVersion' | 'showThemeSwitcher' | 'showRefreshButton' | 'showRestartButton'
  | 'blockDoubleClickRename' | 'blockOfficialAccount' | 'blockOfficialTelemetry' | 'blockTodo' | 'blockPlan' | 'blockGoal' | 'blockOfficialSearch';
export type SettingsArguments = Partial<Pick<Preferences, SettingsParameter>>;
export interface TelemetryStatus {
  protected: boolean;
  senders: { id: string; enabled: boolean; active: boolean; available: boolean }[];
}
export type SettingsOutput = Pick<Preferences, SettingsParameter> & { version: string | null; telemetry: TelemetryStatus };
