import type z from '@deepseek-ai/schemastery';
import type { FeatureDefinition } from '../types/feature.ts';
import type { LivePreferences, Preferences, PreferenceKey, SettingsArguments, SettingsOutput, SettingsParameter, TelemetryStatus } from '../types/preferences.ts';
import type { PolicyResult, RpcDescriptor, PowerDshMethods, PowerDshMethod } from '../types/protocol.ts';
import type { NativeContext } from './native.ts';
import type { OperationQueue } from './operation-queue.ts';

export interface HostOptions { owner: NativeContext; ensureActive(): void }
export interface HostService {
  ctx: NativeContext;
  queue: OperationQueue;
  run<T>(operation: () => T | PromiseLike<T>): Promise<T>;
}
export type PolicyMethod = 'setAccountBlocked' | 'setTelemetryBlocked' | 'setTodoBlocked' | 'setPlanBlocked' | 'setGoalBlocked' | 'setSearchBlocked';
export interface SettingsService {
  setAccountBlocked(blocked: boolean): Promise<PolicyResult>;
  setTelemetryBlocked(blocked: boolean): Promise<PolicyResult>;
  setTodoBlocked(blocked: boolean): Promise<PolicyResult>;
  setPlanBlocked(blocked: boolean): Promise<PolicyResult>;
  setGoalBlocked(blocked: boolean): Promise<PolicyResult>;
  setSearchBlocked(blocked: boolean): Promise<PolicyResult>;
  telemetry: { status(): Promise<TelemetryStatus> };
}
export type ToolSchema = import('@deepseek-ai/dsh-tools').ParameterPropertySpec;
export interface SettingsToolContribution {
  parameters: Partial<Record<SettingsParameter, ToolSchema>>;
  output: Partial<Record<keyof SettingsOutput, ToolSchema>>;
  mutations?: { field: SettingsParameter; order: number; method?: PolicyMethod }[];
  reads?: { order: number; read(input: { ctx: NativeContext; config: LivePreferences; service: SettingsService }): Partial<SettingsOutput> | Promise<Partial<SettingsOutput>> }[];
}
export type ConfigFields = Partial<{ [K in PreferenceKey]: z<Preferences[K], Preferences[K], 'volatile-defined'> }>;
export interface HostFeature {
  definition: FeatureDefinition;
  configFields: ConfigFields;
  settingsTool?: SettingsToolContribution;
  createHost?(ctx: NativeContext, config: LivePreferences, options: HostOptions): object;
  methods?: Partial<PowerDshMethods>;
  rpc?: RpcDescriptor<PowerDshMethod>[];
}
export type { SettingsArguments };
