import type { NativeContext } from '../../shared/host/native.ts';
import type { HostOptions, HostService } from '../../shared/host/feature.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import { TaskModels, type TaskModelRuntime, type ModelAgent } from './service.ts';

function safeError(failure: unknown): Error {
  const message = failure instanceof Error ? failure.message : '';
  return new Error(/^taskModels(?:Unavailable|ModelUnavailable|Conflict|Missing|ExistingSession|Invalid)$/.test(message) ? message : 'taskModelsFailed');
}

export function createHost(ctx: NativeContext, config: LivePreferences, { owner, ensureActive }: HostOptions) {
  const taskModels = new TaskModels(owner, config, ensureActive);
  ctx.inject(['schedule', 'sessionController', 'llm'], child => {
    const schedule = Reflect.get(child, 'schedule') as { catalog?: TaskModelRuntime['tasks'] } | undefined;
    const controller = child.sessionController as typeof child.sessionController & { modelCatalog?: TaskModelRuntime['catalog'] };
    const llm = Reflect.get(child, 'llm') as { resolveCallConfig?: TaskModelRuntime['resolve'] } | undefined;
    if (!schedule?.catalog || !controller?.modelCatalog || !llm?.resolveCallConfig) return;
    taskModels.runtime = {
      tasks: () => schedule.catalog!(), catalog: () => controller.modelCatalog!(),
      resolve: selection => llm.resolveCallConfig!(selection),
    };
    child.on('schedule/resolve-agent', async (_id, next) => {
      const agent = await next() as ModelAgent;
      try { await taskModels.prepare(agent); } catch (failure) { throw safeError(failure); }
      return agent;
    }, { prepend: true });
    child.on('agent/inbox/inserted', ({ agent, message }) => taskModels.inserted(agent as ModelAgent, message));
    child.on('agent/pre-step', ({ agent }, next) => { taskModels.check(agent); return next(); }, { prepend: true });
    child.effect(() => () => { taskModels.runtime = null; taskModels.clear(); });
  });
  ctx.on('settings/document-updated', namespace => {
    if (namespace === owner.fiber.entry.options.id) taskModels.clear();
  });
  ctx.effect(() => () => taskModels.clear());
  return { taskModels };
}

export const methods = {
  readTaskModels() { return this.run(() => this.taskModels.catalog().catch(failure => { throw safeError(failure); })); },
  saveTaskModel(id: string, selection: string, revision: string) {
    return this.run(() => this.taskModels.save(id, selection, revision).catch(failure => { throw safeError(failure); }));
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
