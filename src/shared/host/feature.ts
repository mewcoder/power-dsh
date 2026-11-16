import type z from '@deepseek-ai/schemastery';
import type { FeatureDefinition } from '../types/feature.ts';
import type { LivePreferences, Preferences, PreferenceKey } from '../types/preferences.ts';
import type { RpcDescriptor, PowerDshMethods, PowerDshMethod } from '../types/protocol.ts';
import type { NativeContext } from './native.ts';
import type { OperationQueue } from './operation-queue.ts';

export interface HostOptions {
  owner: NativeContext;
  ensureActive(): void;
  setThirdPartySearchActive?(active: boolean): Promise<void>;
}
export interface HostService {
  ctx: NativeContext;
  queue: OperationQueue;
  run<T>(operation: () => T | PromiseLike<T>): Promise<T>;
}
export type ConfigFields = Partial<{ [K in PreferenceKey]: z<Preferences[K], Preferences[K], 'volatile-defined'> }>;
export interface HostFeature {
  definition: FeatureDefinition;
  configFields: ConfigFields;
  createHost?(ctx: NativeContext, config: LivePreferences, options: HostOptions): object;
  methods?: Partial<PowerDshMethods>;
  rpc?: RpcDescriptor<PowerDshMethod>[];
}
