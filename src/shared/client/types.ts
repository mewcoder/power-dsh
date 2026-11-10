import type * as ReactTypes from 'react';
import type { FeatureDefinition } from '../types/feature.ts';
import type { Preferences } from '../types/preferences.ts';
import type { PowerDshMethods, RpcDescriptor } from '../types/protocol.ts';

export type ReactModule = typeof ReactTypes;
export type Dispose = () => void;
export type Listener = () => void;
export interface SnapshotSource<T> { getSnapshot(): T; subscribe(listener: Listener): Dispose; }
export interface Observable<T> extends SnapshotSource<T> { notify(): void; }
export type Translate = (key: string) => string;
export type Locales = Record<'en' | 'zh', Record<string, string>>;
export interface IconProps { size?: number; }

// These public primitives are supplied by the host factory; React is never imported at runtime.
export interface MenuProps {
  open: boolean; onClose(): void; onSelect(id: string): void | Promise<void>;
  items: { id: string; label: ReactTypes.ReactNode; disabled?: boolean }[];
  anchor: ReactTypes.ReactNode; selectedId?: string; align?: 'start' | 'end'; portal?: boolean;
  autoFocus?: boolean; minWidthFromAnchor?: boolean; className?: string;
}
export interface TooltipProps { label: string; side?: 'top' | 'bottom'; portal?: boolean; delayMs?: number; maxWidth?: number; children?: ReactTypes.ReactElement; }
export interface ModalProps { open: boolean; onClose(): void; title: string; closeLabel: string; description: string; footer?: ReactTypes.ReactNode; }
export type StateDotState = 'ongoing' | 'done' | 'error' | 'idle' | 'warning';
export interface PublicPrimitives {
  Menu: ReactTypes.ComponentType<MenuProps>;
  Tooltip: ReactTypes.ComponentType<TooltipProps>;
  StateDot: ReactTypes.ComponentType<{ state: StateDotState }>;
  Modal: ReactTypes.ComponentType<ModalProps>;
  Button: ReactTypes.ComponentType<ReactTypes.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'outline' | 'primary' | 'ghost'; size?: 'md' | 'sm'; 'data-modal-autofocus'?: boolean }>;
}
export interface ClientRuntime extends PublicPrimitives {
  React: ReactModule; h: ReactModule['createElement'];
  observable<T>(getSnapshot: () => T): Observable<T>;
  useSnapshot<T>(source: SnapshotSource<T>): T;
  useMounted(): ReactTypes.MutableRefObject<boolean>;
  NativeIcon: ReactTypes.ComponentType<{ glyph: string; size?: number }>;
  errorFeedback(props: import('./error-feedback.ts').ErrorFeedbackProps): ReactTypes.ReactElement;
}

// disabledSkills is internal Host policy state and has no scalar Client setting.
export type PreferenceValues = Omit<Preferences, 'disabledSkills'>;
export type PreferenceKey = keyof PreferenceValues;
export type PreferenceValue = PreferenceValues[PreferenceKey];
export interface FormSnapshot { status: 'loading' | 'ready' | 'unavailable'; writable: boolean; value?: Partial<PreferenceValues>; }
export interface SettingsForm extends SnapshotSource<FormSnapshot> { set<K extends PreferenceKey>(field: K, value: PreferenceValues[K]): Promise<boolean>; }
export interface PageSlotProps { t: Translate; close?: () => void; }
export interface SlotProps extends PageSlotProps { wide: boolean; }
/** Session-scoped composer slots additionally carry the owning session id. */
export interface ComposerSlotProps extends PageSlotProps { sessionId?: string }
export type SlotComponent = ReactTypes.ComponentType<PageSlotProps> | ReactTypes.ComponentType<SlotProps>
  | ReactTypes.ComponentType<IconProps> | ReactTypes.ComponentType<ComposerSlotProps>;
export interface SlotOptions { name?: string; id: string; order?: number; locale?: string; label?: () => string; }
export interface ConfigForms { get(id: string): SettingsForm; describe(): { load(): Promise<unknown> }; }
export type RpcReply<T> = { ok: true; value: T } | { ok: false; error: { message: string } };
export type PowerDshRemote = {
  [M in keyof PowerDshMethods]: (...args: Parameters<PowerDshMethods[M]>) => Promise<RpcReply<Awaited<ReturnType<PowerDshMethods[M]>>>>;
};
// Generation snapshots are opaque object identities; no Host fields are read by this client.
export interface Connection { isLoopback: boolean; generation: SnapshotSource<object | undefined>; state: SnapshotSource<string | undefined>; }
export interface NotificationOutcome { seq: number; reason: string; }
export interface SessionRow { origin?: string; displayTitle?: string; title?: string; running: boolean; projectionValues?: { powerDshNotifications?: NotificationOutcome }; retainedBy?: { mainView?: number }; }
export interface PendingInteraction { key: string; kind: string; review?: unknown; answerable?: boolean; }
export interface SessionStatus { running?: boolean; pendingInteraction?: PendingInteraction; }
export interface ThemeService { getTheme(): { preference: string }; setTheme(id: string): void; }
// Consumed service members only; optional services are accessed inside their ctx.inject callbacks.
export interface ClientContext {
  effect(callback: () => void | Dispose): void;
  inject(services: string[], callback: (ctx: ClientContext) => void): void;
  on(event: string, callback: Listener): void;
  remote: { $mount(options: { package: string; descriptors: readonly RpcDescriptor[] }): Promise<void>; powerDsh: PowerDshRemote };
  slots: { inject(name: string, callback: () => void | Dispose): void; register(options: (SlotOptions & { name: string }) | { name: 'sidebar.brand.mark'; priority: number }, component: SlotComponent): Dispose };
  locale: { register(namespace: string, language: string, dictionary: Record<string, string>): Dispose; bind(namespace: string): Translate };
  configForms: ConfigForms; connection: Connection; theme: ThemeService;
  sessions: { list: SnapshotSource<{ phase: string; ids: string[]; byId: Record<string, SessionRow> }> };
  uiSession: { sessionStatus: SnapshotSource<ReadonlyMap<string, SessionStatus>> };
}
export type SavePreference = <K extends PreferenceKey>(field: K, value: PreferenceValues[K], unavailable?: string, type?: 'boolean' | 'string' | 'number') => Promise<void>;
export interface ClientEnvironment {
  ctx: ClientContext; form: SettingsForm; source: SnapshotSource<FormSnapshot>; t: Translate; version: string | null; namespace: string;
  savePreference: SavePreference;
  preferenceSlot(field: PreferenceKey, name: string, options: SlotOptions, component: SlotComponent): void;
}
export interface SavingSetting { field: PreferenceKey; value: PreferenceValue; }
export interface SettingError { field: PreferenceKey; message: string; }
export interface SettingsViewContext { snapshot: FormSnapshot; disabled: boolean; saving: SavingSetting | null; error: SettingError | null; save(field: PreferenceKey, next: PreferenceValue): Promise<void>; id: string; leaveSettings?: () => void; }
export interface SettingFailure {
  message: string; code: string; operation: string;
  context?: import('../types/diagnostics.ts').DiagnosticContext;
  observedAt?: string;
}
export interface SettingContribution {
  failure?: SettingFailure;
  field: PreferenceKey; description?: string; category?: 'general' | 'interface' | 'enhancements' | 'simplify' | 'other'; hidden?: boolean; hideError?: boolean; error?: string;
  save?(next: PreferenceValue, context: { mounted: ReactTypes.MutableRefObject<boolean> }): Promise<void>;
  canSave?(next: PreferenceValue): boolean; render?(): ReactTypes.ReactNode;
}
export interface HeaderActionContext { wide: boolean; latestWide: ReactTypes.MutableRefObject<boolean>; mounted: ReactTypes.MutableRefObject<boolean>; source: SnapshotSource<FormSnapshot>; t: Translate; }
export interface HeaderAction { id: string; label: string; visible: boolean; disabled?: boolean; error?: string; canUse(): boolean; select(): void; isConfirming?(): boolean; dialog?: ReactTypes.ReactNode; }
export interface ClientFeature {
  settings?: SettingContribution[]; styles?: string; api?: Record<string, unknown>;
  useSettings?(context: SettingsViewContext): SettingContribution[];
  sidebar?(props: SlotProps): ReactTypes.ReactNode;
  headerAction?(context: HeaderActionContext): HeaderAction;
}
export type ClientFeatureDefinition = FeatureDefinition;
export interface ClientFeatureSelection { definition: ClientFeatureDefinition; create(runtime: ClientRuntime, env: ClientEnvironment): ClientFeature; locales: Locales; rpc: readonly RpcDescriptor[]; }
export interface FeatureState<T> { status: 'idle' | 'loading' | 'ready' | 'error'; value: T | null; error: string; }

export interface UpdatePresentation { phase: string; }
export interface DesktopUpdates { open(): Promise<unknown>; status(): Promise<UpdatePresentation>; subscribe(callback: (presentation: UpdatePresentation) => void): Dispose; }
export interface DesktopBridge { protocolVersion: number; updates?: DesktopUpdates; }
export interface HostModuleRequire {
  (id: 'react'): ReactModule;
  (id: '@deepseek-ai/dsh-client-ui-primitives'): PublicPrimitives;
}
declare global {
  interface Window {
    __DSH_BOOT__?: { release?: { version?: unknown } };
    __ModuleLoader__: { load(module: { id: string; factory(require: HostModuleRequire): { inject: string[]; apply(ctx: ClientContext): Promise<void> } }): void };
    dshDesktop?: DesktopBridge;
  }
  interface NotificationOptions { renotify?: boolean; }
}
