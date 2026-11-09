import type { LiveValue } from '../types/preferences.ts';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';

export type Release = () => void;
export interface LifecycleOptions { ensureActive?: Release }
export interface NativePlugin {
  entryId: string; moduleName: string; patchId?: string; enabled: boolean;
  fiberPhase?: string | null; readOnlyReason?: string;
}
export interface NativeChangeResult {
  application: string; warnings?: string[]; error?: { diagnostic?: string; code?: string }; restartReason?: string;
}
// Plugin configuration belongs to the native host and has no common published SDK
// type. This is the sole permissive payload boundary: native plugin-specific fields
// must survive ConfigEditor edits, while feature code checks fields before use.
// Dynamic module imports below return unknown or a verified structural module shape.
export type NativePayload = { [key: string]: any };
export interface NativeEntry {
  id: string; disabled?: boolean;
  options: { id: string; name: string; config: NativePayload };
  fiber?: NativeFiber; ctx: NativeContext;
}
export interface NativeFiber {
  uid: number; state: number; entry?: NativeEntry; ctx: NativeContext;
  parent: { fiber: NativeFiber }; runtime?: { name?: string };
  effectiveConfig?: NativePayload; config?: NativePayload; rawConfig?: NativePayload;
}
export interface NativeCompositionRow { moduleName: string; entryId: string; enabled: boolean | 'conditional'; fiberState?: number }
export interface NativeComposition { id: string; broken?: boolean; rows: NativeCompositionRow[] }
export interface NativeLease { key: unknown; [Symbol.asyncDispose](): Promise<void> }
export interface NativePresets {
  defaultId: string;
  compositionInventory(): Promise<NativeComposition[]>;
  serviceFor(agent: NativeAgent, name: string): unknown;
  acquireScope(id: string): Promise<NativeLease>;
}
export interface NativeAgent { ctx: NativeContext }
export interface NativeSkill {
  name: string; description: string; source: string; provider: string; path?: string; origin?: string;
  resourceBase?: { kind: string; path?: string };
  invocation: { modelInvocable: boolean; userInvocable: boolean };
}
export interface NativeSkillRecord {
  name: string; description: string; source: string; provider: string; path: string;
  origin: string; scope: string; projectRoot: string;
}
export interface NativeSkillCandidate extends NativeSkillRecord { locator: NativeSkillRecord }
export interface NativeSkillControl { signal: AbortSignal; invalidate(): void }
export interface NativeSkills {
  snapshot(options: { cwd?: string; scope?: unknown }): Promise<{ complete: boolean; skills: NativeSkill[] }>;
  registerProvider(factory: (control: NativeSkillControl) => {
    name: string;
    list(options?: { cwd?: string }): Promise<(NativeSkillRecord & { rank: number; locator: NativeSkillRecord; invocation: { modelInvocable: boolean; userInvocable: boolean } })[]>;
    get(candidate: NativeSkillCandidate): Promise<NativeSkillRecord & { content: string; invocation: { modelInvocable: boolean; userInvocable: boolean } }>;
  }): Release;
}
export interface NativeTools {
  register(tool: unknown): Release;
  guard(callback: (execution: { name: string }) => string | undefined): Release;
  restrict(options: { deny: string[] }): Release;
  get(name: string, scope?: unknown): unknown;
  definitions?(scope?: unknown): { name: string }[];
  schemas(scope?: unknown): { name: string }[];
}
export interface NativeSettings {
  configure(options: { auto: boolean }): Release;
  describe(options: { redactSecrets: boolean }): { ns: string; revision: number }[];
  mutate(namespace: string, mutations: { op: 'set'; path: string[]; value: unknown }[], revision?: number): Promise<unknown>;
}
export interface NativeSubprocessHandle {
  done: Promise<{ exitCode: number | null; signal: string | null }>;
  waitForExit(signal: AbortSignal): Promise<boolean>;
  terminate(): void;
}
export interface NativeSubprocess {
  resolveExecutable(name: string, options: undefined, signal: AbortSignal): Promise<string>;
  spawn(options: { argv: string[]; cwd: string; graceMs: number; signal: AbortSignal; stdio: { stdin: 'ignore'; stdout: { maxBytes: number }; stderr: { maxBytes: number } } }): NativeSubprocessHandle;
}
interface NativeServices {
  skills: NativeSkills; tools: NativeTools; settings: NativeSettings;
  subprocess: NativeSubprocess | undefined;
  fs: { resolve(path: string): Promise<unknown>; stat(path: unknown): Promise<unknown> } | undefined;
  mcpManager: { config: { servers: LiveValue<Record<string, { enabled?: boolean; transport?: unknown }>> }; list(): { name: string; configured: boolean }[] } | undefined;
}
export interface NativeScope { ctx: NativeContext; dispose(): Promise<void> }
export type CreateScope = (ctx: NativeContext, key: unknown) => NativeScope;
interface NativeEvents {
  'agent/created': [event: { agent: NativeAgent }];
  'agent/disposed': [event: { agent: NativeAgent }];
  'agent-preset/selected': [id: string];
  'agent/pre-step': [event: { agent: NativeAgent }, next: () => unknown];
  'settings/document-updated': [namespace: string];
  'app-boot/config-reload': [];
  'plugin-manager/changed': [];
}
/** Structural adapter for the verified current host; optional services are acquired in child contexts. */
export interface NativeContext {
  invocation?: { peer: { principal: { kind: string } } };
  fiber: { entry: NativeEntry };
  profileContext: { home: string };
  effect(effect: () => void | Release | (() => Promise<void>)): Release;
  inject(dependencies: string[], callback: (ctx: NativeContext) => unknown): unknown;
  on<E extends keyof NativeEvents>(event: E, listener: (...args: NativeEvents[E]) => unknown, options?: { global?: boolean; prepend?: boolean }): Release;
  get<K extends keyof NativeServices>(key: K): NativeServices[K];
  pluginManager: {
    listPlugins(): Promise<NativePlugin[]>;
    listBundles(): Promise<{ enabled: boolean; name: string; rows: { moduleName: string; entryId: string }[] }[]>;
    setPluginEnabled(id: string, enabled: boolean): Promise<NativeChangeResult>;
  };
  configEditor: { entries(): NativeEntry[]; edit(entry: NativeEntry, edit: (raw: NativePayload) => NativePayload): Promise<unknown> };
  agents: { get(id: string): NativeAgent | undefined; list(): NativeAgent[] };
  agentPresets: NativePresets;
  skills: NativeSkills;
  tools: NativeTools;
  settings: NativeSettings;
  clientModules: { graph(): { release?: { version: string } } };
  typert: { register(descriptor: unknown): Release };
  sessionProjections: { register(projection: unknown): Promise<unknown> };
  workspaceRegistry: { list(): { path: string; title: string }[] };
  workingDirectory: { defaultDirectory: string };
  loader: {
    import(name: '@deepseek-ai/dsh-scope'): Promise<{
      createScope: CreateScope;
      scopeOf(ctx: NativeContext): unknown;
      scopeChainOf(key: unknown): unknown[];
    }>;
    import(name: string): Promise<unknown>;
    entries(): Iterable<NativeEntry>;
    await?(): Promise<void>;
  };
  registry: { get(module: unknown): { fibers: Iterable<NativeFiber> } | undefined };
}
/** Cordis owns the actual context object; only its consumed structural surface crosses this adapter. */
export const NativeRemoteService = TypertRemoteService as unknown as {
  new(ctx: NativeContext, serviceKey: string): { ctx: NativeContext };
};

export function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
}
export function errorMessage(error: unknown): string {
  return typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : '';
}
