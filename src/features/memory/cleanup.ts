import { CLEANUP_PROMPT, modelCatalog, parseCleanupPlan, parseModel } from './cleanup-plan.ts';
import type { MemoryStore } from './memory-store.ts';
import type { MemoryCleanupPreview, MemoryModel } from './types.ts';
import { memoryError } from './types.ts';

export interface MemoryLlm {
  stream(options: MemoryModel & {
    system: string; messages: { role: 'user'; content: { type: 'text'; text: string }[] }[];
    maxTokens: number; signal: AbortSignal; purpose: string;
  }): AsyncIterable<{ type: string; text?: string; reason?: { kind: string } }>;
}
export interface CleanupRuntime { llm: MemoryLlm; catalog(): Promise<unknown> }

function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('memoryCleanupFailed'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export class MemoryCleanup {
  private job: { id: string; controller: AbortController } | null = null;
  private preview: { value: MemoryCleanupPreview; expires: number } | null = null;
  private catalogs = new Set<AbortController>();
  private store: MemoryStore;
  private ensure: () => void;
  private runtime: () => CleanupRuntime | null;
  constructor(store: MemoryStore, ensure: () => void, runtime: () => CleanupRuntime | null) {
    this.store = store;
    this.ensure = ensure;
    this.runtime = runtime;
  }

  cancel(id: string) {
    if (this.job?.id === id) { this.job.controller.abort(); this.job = null; }
    if (this.preview?.value.token === id) this.preview = null;
    return true;
  }

  cancelAll() {
    for (const request of this.catalogs) request.abort();
    this.catalogs.clear();
    this.job?.controller.abort();
    this.job = null;
    this.preview = null;
  }

  async models() {
    this.ensure();
    const service = this.runtime();
    if (!service) throw new Error('memoryModelUnavailable');
    const controller = new AbortController();
    this.catalogs.add(controller);
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const result = modelCatalog(await abortable(service.catalog(), controller.signal));
      this.ensure();
      if (!result.models.length || this.runtime()?.llm !== service.llm) throw new Error('memoryModelUnavailable');
      return result;
    } catch { throw new Error('memoryModelUnavailable'); }
    finally { clearTimeout(timer); this.catalogs.delete(controller); }
  }

  async prepare(scope: string, selection: string, id: string) {
    this.ensure();
    if (!/^[a-f0-9-]{36}$/.test(id) || selection.length > 1000) throw new Error('memoryInvalid');
    if (this.job) throw new Error('memoryBusy');
    const service = this.runtime();
    if (!service) throw new Error('memoryModelUnavailable');
    const job = { id, controller: new AbortController() };
    this.job = job;
    this.preview = null;
    const signal = job.controller.signal;
    const timer = setTimeout(() => job.controller.abort(), 60_000);
    const guard = () => {
      this.ensure();
      if (signal.aborted || this.job !== job || this.runtime()?.llm !== service.llm) throw new Error('memoryCleanupFailed');
    };
    try {
      const result = await abortable((async () => {
        const selected = parseModel(JSON.parse(selection));
        const models = modelCatalog(await service.catalog());
        guard();
        if (!models.models.some(row => row.provider === selected.provider && row.model === selected.model)) throw new Error('memoryModelUnavailable');
        const snapshot = await this.store.cleanupSnapshot(scope);
        guard();
        let text = '';
        let finished = false;
        if (snapshot.details.length) {
          for await (const chunk of service.llm.stream({ ...selected, system: CLEANUP_PROMPT,
            messages: [{ role: 'user', content: [{ type: 'text', text: JSON.stringify({ memories: snapshot.details.map(entry => ({
              id: entry.id, description: entry.description, content: entry.content,
            })) }) }] }],
            maxTokens: 16_384, signal, purpose: 'power-dsh-memory-cleanup' })) {
            guard();
            if (finished) throw new Error('memoryCleanupFailed');
            if (chunk.type === 'text-delta') {
              text += chunk.text ?? '';
              if (text.length > 80_000) throw new Error('memoryCleanupLimit');
            }
            if (chunk.type === 'tool-call-delta' || chunk.type === 'block-start' && Reflect.get(chunk, 'blockType') === 'tool-call') {
              throw new Error('memoryCleanupFailed');
            }
            if (chunk.type === 'finish') {
              if (chunk.reason?.kind !== 'stop') throw new Error('memoryCleanupFailed');
              finished = true;
            }
          }
          if (!finished) throw new Error('memoryCleanupFailed');
        } else { text = '{"changes":[]}'; }
        guard();
        const value: MemoryCleanupPreview = { token: id, scope, revision: snapshot.scope.revision,
          changes: parseCleanupPlan(text, snapshot.details) };
        this.preview = { value, expires: Date.now() + 600_000 };
        return value;
      })(), signal);
      guard();
      return result;
    } catch (error) {
      throw new Error(memoryError(error, 'memoryCleanupFailed'));
    } finally {
      clearTimeout(timer);
      job.controller.abort();
      if (this.job === job) this.job = null;
    }
  }

  async apply(id: string) {
    this.ensure();
    const pending = this.preview;
    if (!pending || pending.value.token !== id || pending.expires < Date.now()) throw new Error('memoryPreviewExpired');
    this.preview = null;
    const job = { id, controller: new AbortController() };
    this.job = job;
    try {
      return await this.store.applyCleanup(pending.value, () => {
        this.ensure();
        if (job.controller.signal.aborted || this.job !== job) throw new Error('memoryCleanupFailed');
      });
    } catch (error) { throw new Error(memoryError(error)); }
    finally { if (this.job === job) this.job = null; }
  }
}
