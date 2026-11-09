import type * as AccountFeature from '../features/account-blocking/host.ts';
import type * as TelemetryFeature from '../features/telemetry-blocking/host.ts';
import type * as TodoFeature from '../features/todo-blocking/host.ts';
import type * as PlanFeature from '../features/plan-blocking/host.ts';
import type * as GoalFeature from '../features/goal-blocking/host.ts';
import type * as SearchFeature from '../features/search-blocking/host.ts';
import type * as PersonalizationFeature from '../features/personalization/host.ts';
import type * as SkillsFeature from '../features/skills/host.ts';
import type * as McpFeature from '../features/mcp/host.ts';
import type * as NotificationsFeature from '../features/notifications/host.ts';
import type * as RestartFeature from '../features/restart-button/host.ts';
import { NativeRemoteService, type NativeContext } from '../shared/host/native.ts';
import type { HostFeature } from '../shared/host/feature.ts';
import type { LivePreferences } from '../shared/types/preferences.ts';
import { OperationQueue } from '../shared/host/operation-queue.ts';
import { HOST_FEATURES } from './host-features.ts';
import { MOD_RPC } from './rpc.ts';
import { createSettingsTool } from './settings-tool.ts';
export { Config } from './config.ts';

export const inject = ['settings', 'tools', 'clientModules', 'pluginManager', 'typert', 'configEditor', 'profileContext'];

type ComposedService =
  typeof AccountFeature.methods & ReturnType<typeof AccountFeature.createHost>
  & typeof TelemetryFeature.methods & ReturnType<typeof TelemetryFeature.createHost>
  & typeof TodoFeature.methods & ReturnType<typeof TodoFeature.createHost>
  & typeof PlanFeature.methods & ReturnType<typeof PlanFeature.createHost>
  & typeof GoalFeature.methods & ReturnType<typeof GoalFeature.createHost>
  & typeof SearchFeature.methods & ReturnType<typeof SearchFeature.createHost>
  & typeof PersonalizationFeature.methods & ReturnType<typeof PersonalizationFeature.createHost>
  & typeof SkillsFeature.methods & ReturnType<typeof SkillsFeature.createHost>
  & typeof McpFeature.methods & ReturnType<typeof McpFeature.createHost>
  & typeof NotificationsFeature.methods & ReturnType<typeof NotificationsFeature.createHost>
  & typeof RestartFeature.methods & ReturnType<typeof RestartFeature.createHost>;
interface ModService extends ComposedService {}
class ModService extends NativeRemoteService {
  queue: OperationQueue;
  constructor(ctx: NativeContext, queue: OperationQueue, features: readonly HostFeature[]) {
    super(ctx, 'powerDsh');
    this.queue = queue;
    for (const feature of features) {
      for (const [method, handler] of Object.entries(feature.methods ?? {})) {
        if (method in this) throw new Error(`Duplicate Host method: ${method}`);
        Reflect.set(this, method, handler);
      }
    }
  }

  run<T>(operation: () => T | PromiseLike<T>): Promise<T> {
    if (this.ctx.invocation && this.ctx.invocation.peer.principal.kind !== 'owner') {
      throw new Error('Only the profile owner can change Mod policies.');
    }
    return this.queue.run(operation);
  }
}

export function apply(ctx: NativeContext, config: LivePreferences, features: readonly HostFeature[] = HOST_FEATURES) {
  const featureIds = new Set();
  const selectedRpc = new Set();
  for (const feature of features) {
    const { id } = feature.definition;
    if (featureIds.has(id)) throw new Error(`Duplicate Host feature: ${id}`);
    featureIds.add(id);
    for (const descriptor of feature.rpc ?? []) {
      if (selectedRpc.has(descriptor.id)) throw new Error(`Duplicate Host RPC: ${descriptor.id}`);
      selectedRpc.add(descriptor.id);
    }
  }
  for (const feature of features) {
    for (const descriptor of feature.rpc ?? []) {
      if (!MOD_RPC.some(registered => registered === descriptor)) throw new Error(`Unregistered Host RPC: ${descriptor.id}`);
      if (typeof (feature.methods && Reflect.get(feature.methods, descriptor.method)) !== 'function') throw new Error(`Missing Host RPC method: ${descriptor.method}`);
    }
  }
  // Managed legacy installs must continue writing their actual entry.
  const namespace = ctx.fiber.entry?.options.id;
  if (!namespace) throw new Error('Mod preferences require a managed plugin entry.');
  const queue = new OperationQueue();
  ctx.effect(() => () => queue.close());
  const service = new ModService(ctx, queue, features);
  const options = { owner: ctx, ensureActive: () => queue.ensureActive() };
  for (const feature of features) {
    if (feature.createHost) ctx.inject([], child => {
      const state = feature.createHost!(child, config, options);
      for (const [key, value] of Object.entries(state)) {
        if (key in service) throw new Error(`Duplicate Host state: ${key}`);
        Reflect.set(service, key, value);
      }
    });
  }
  ctx.effect(() => ctx.typert.register({
    package: 'power-dsh', face: 'host', schemas: [],
    model: { services: [], events: [], objects: [] }, invocations: MOD_RPC.filter(rpc => selectedRpc.has(rpc.id)),
  }));
  ctx.effect(() => ctx.settings.configure({ auto: false }));
  ctx.effect(() => ctx.tools.register(createSettingsTool(ctx, config, namespace, service, features)));
}
