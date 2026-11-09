import type { PreferenceKey } from './preferences.ts';

export type FeatureId = 'version-display' | 'appearance-shortcut' | 'refresh-button' | 'restart-button'
  | 'notifications' | 'personalization' | 'skills' | 'mcp' | 'account-blocking' | 'search-blocking'
  | 'telemetry-blocking' | 'todo-blocking' | 'plan-blocking' | 'goal-blocking' | 'double-click-rename' | 'thinking-effort' | 'flowing-background';
export type FeatureCategory = 'general' | 'interface' | 'enhance' | 'simplify';
export interface FeatureDefinition {
  readonly id: FeatureId;
  readonly category: FeatureCategory;
  readonly order: number;
  readonly keys: readonly PreferenceKey[];
  readonly spec: string;
}
