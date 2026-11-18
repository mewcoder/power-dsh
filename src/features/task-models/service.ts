import type { TaskModelCatalog, TaskModelSelection } from './types.ts';
import { parseBindings, parseModels, parseSelection, reminderTaskId, requireModel } from './types.ts';
import type { NativeContext, NativeAgent } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';

export interface ScheduleTask {
  id: string; title: string; status: string;
  target: { kind: 'new' | 'new_once' | 'session'; sessionId?: string };
}
export interface TaskModelRuntime {
  tasks(): Promise<ScheduleTask[]>;
  catalog(): Promise<unknown>;
  resolve(selection: TaskModelSelection): Promise<unknown>;
}
export interface ModelAgent extends NativeAgent {
  id: string;
  model: { select(selection: TaskModelSelection): void };
}

export class TaskModels {
  private ctx: NativeContext;
  private config: LivePreferences;
  private ensure: () => void;
  runtime: TaskModelRuntime | null = null;
  private prepared = new WeakMap<NativeAgent, Map<string, TaskModelSelection | null>>();
  private blocked = new WeakSet<NativeAgent>();
  private errors = new Map<string, string>();
  private generation = 0;

  constructor(ctx: NativeContext, config: LivePreferences, ensure: () => void) {
    this.ctx = ctx; this.config = config; this.ensure = ensure;
  }

  enabled() { return this.config.taskModelsEnabled?.get() === true; }
  private revision() { return this.config.taskModelBindings?.get() ?? '{}'; }
  private available() {
    this.ensure();
    if (!this.enabled() || !this.runtime) throw new Error('taskModelsUnavailable');
    return this.runtime;
  }

  async catalog(): Promise<TaskModelCatalog> {
    const runtime = this.available();
    const [tasks, catalog] = await Promise.all([runtime.tasks(), runtime.catalog()]);
    this.available();
    if (this.runtime !== runtime) throw new Error('taskModelsUnavailable');
    const revision = this.revision();
    const bindings = parseBindings(revision);
    const models = parseModels(catalog);
    return { revision, models, tasks: tasks.map(task => {
      const selection = bindings.get(task.id) ?? null;
      let error = this.errors.get(task.id) ?? '';
      if (selection) try { requireModel(selection, models); } catch { error = 'taskModelsModelUnavailable'; }
      return { id: task.id, title: task.title, target: task.target.kind, status: task.status, selection, error };
    }) };
  }

  async save(id: string, text: string, revision: string): Promise<TaskModelCatalog> {
    const runtime = this.available();
    if (!id || id.length > 200 || text.length > 2000) throw new Error('taskModelsInvalid');
    const selection = text === '' ? null : parseSelection(JSON.parse(text));
    const task = (await runtime.tasks()).find(row => row.id === id);
    if (!task) throw new Error('taskModelsMissing');
    if (selection) {
      if (task.target.kind === 'session') throw new Error('taskModelsExistingSession');
      requireModel(selection, parseModels(await runtime.catalog()));
      try { await runtime.resolve(selection); } catch { throw new Error('taskModelsModelUnavailable'); }
    }
    this.available();
    if (runtime !== this.runtime) throw new Error('taskModelsUnavailable');
    await this.ctx.configEditor.edit(this.ctx.fiber.entry, raw => {
      this.available();
      const current = typeof raw.taskModelBindings === 'string' ? raw.taskModelBindings : this.revision();
      if (current !== revision) throw new Error('taskModelsConflict');
      const bindings = parseBindings(current);
      if (selection) bindings.set(id, selection); else bindings.delete(id);
      if (bindings.size > 1000) throw new Error('taskModelsInvalid');
      return { ...raw, taskModelBindings: JSON.stringify(Object.fromEntries(bindings)) };
    });
    this.available();
    this.errors.delete(id);
    return this.catalog();
  }

  async prepare(agent: ModelAgent) {
    if (!this.enabled() || !this.runtime) return;
    if (typeof agent.model?.select !== 'function') throw new Error('taskModelsUnavailable');
    const runtime = this.runtime;
    const generation = this.generation;
    const bindings = parseBindings(this.revision());
    if (!bindings.size) return;
    const tasks = (await runtime.tasks()).filter(task => bindings.has(task.id) && task.target.kind !== 'session'
      && (task.target.kind !== 'new_once' || task.target.sessionId === agent.id));
    if (!tasks.length || !this.enabled() || this.runtime !== runtime) return;
    const catalog = await runtime.catalog();
    if (!this.enabled() || this.runtime !== runtime) return;
    if (generation !== this.generation) throw new Error('taskModelsConflict');
    const models = parseModels(catalog);
    const prepared = new Map<string, TaskModelSelection | null>();
    for (const task of tasks) {
      const selection = bindings.get(task.id);
      if (!selection || task.target.kind === 'session'
        || task.target.kind === 'new_once' && task.target.sessionId !== agent.id) continue;
      try {
        requireModel(selection, models);
        await runtime.resolve(selection);
        prepared.set(task.id, selection);
      } catch { prepared.set(task.id, null); }
    }
    if (this.enabled() && this.runtime === runtime) {
      if (generation !== this.generation) throw new Error('taskModelsConflict');
      this.prepared.set(agent, prepared);
    }
  }

  inserted(agent: ModelAgent, message: unknown) {
    if (!this.enabled()) return;
    const id = reminderTaskId(message);
    if (!id) return;
    const prepared = this.prepared.get(agent);
    if (!prepared?.has(id)) return;
    const selection = prepared.get(id);
    if (!selection) {
      this.blocked.add(agent); this.errors.set(id, 'taskModelsModelUnavailable'); return;
    }
    try {
      agent.model.select(selection);
      this.blocked.delete(agent); this.errors.delete(id);
    } catch { this.blocked.add(agent); this.errors.set(id, 'taskModelsModelUnavailable'); }
  }

  check(agent: NativeAgent) {
    if (this.enabled() && this.blocked.has(agent)) {
      throw new Error('Scheduled model unavailable. Review Settings → power-dsh → Task models, then run the task again.');
    }
  }

  clear() { this.generation++; this.prepared = new WeakMap(); this.blocked = new WeakSet(); this.errors.clear(); }
}
