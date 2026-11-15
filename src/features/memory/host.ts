import { join } from 'node:path';
import type { NativeContext, NativeSessionController, Release } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { HostOptions, HostService } from '../../shared/host/feature.ts';
import { MemoryStore } from './memory-store.ts';
import { createMemoryTool } from './memory-tool.ts';
import { memoryPolicy, renderMemoryContext, type MemoryPrompt } from './injection.ts';
import { memoryError } from './types.ts';
import { MemoryCleanup, type MemoryLlm } from './cleanup.ts';

export function createHost(ctx: NativeContext, config: LivePreferences, { owner, ensureActive }: HostOptions) {
  let alive = true;
  let prompt: MemoryPrompt | null = null;
  let registered = false;
  let failure = '';
  let releases: Release[] = [];
  let desktop: NativeSessionController | null = null;
  let llm: MemoryLlm | null = null;
  const folderOperations = new Set<AbortController>();
  const cancelFolders = () => {
    for (const operation of folderOperations) operation.abort();
    folderOperations.clear();
  };
  const ensureEnabled = () => {
    ensureActive();
    if (!alive || !config.memoryEnabled?.get()) throw new Error('memoryDisabled');
  };
  const memory = new MemoryStore(owner.profileContext.home, ensureEnabled);
  const cleanup = new MemoryCleanup(memory, ensureEnabled, () => {
    const catalog = desktop && Reflect.get(desktop, 'modelCatalog');
    return llm && typeof catalog === 'function' ? { llm, catalog: () => catalog.call(desktop) as Promise<unknown> } : null;
  });
  const stop = () => {
    cleanup.cancelAll();
    cancelFolders();
    for (const release of releases.splice(0).reverse()) release();
    registered = false;
    failure = '';
  };
  const sync = () => {
    if (!alive || !config.memoryEnabled?.get() || !prompt) { stop(); return; }
    if (registered) return;
    const current = prompt;
    try {
      releases.push(current.section({ name: 'power-dsh:memory-policy', order: 700, interpolate: false,
        text: () => config.memoryEnabled?.get() ? memoryPolicy(config.memoryAutoCapture?.get() !== false) : '' }));
      releases.push(current.context({ name: 'power-dsh:memory-index', order: 130, interpolate: false,
        text: context => {
          if (!alive || !config.memoryEnabled?.get() || !context.agent) return '';
          if (failure) return '<memory_index>Memory is unavailable. Do not rely on earlier memory snapshots.</memory_index>';
          const scopes = memory.cached(context.agent.session.header.cwd).filter(scope => scope.id === 'global'
            ? config.memoryGlobalEnabled?.get() !== false : config.memoryWorkspaceEnabled?.get() !== false);
          return renderMemoryContext(scopes);
        } }));
      releases.push(ctx.tools.register(createMemoryTool(memory, config, () => registered)));
      releases.push(ctx.on('agent/pre-step', async ({ agent }, next) => {
        if (!alive || !config.memoryEnabled?.get()) return next();
        try {
          const session = Reflect.get(agent, 'session') as { header?: { cwd?: string } } | undefined;
          await memory.refresh(session?.header?.cwd, config.memoryGlobalEnabled?.get() !== false,
            config.memoryWorkspaceEnabled?.get() !== false);
          failure = '';
        } catch (error) { failure = memoryError(error, 'memoryLoadFailed'); }
        return next();
      }, { prepend: true }));
      registered = true;
    } catch (error) {
      stop();
      failure = memoryError(error, 'memoryUnavailable');
    }
  };
  ctx.inject(['sessionController'], child => {
    desktop = child.sessionController ?? null;
    child.effect(() => () => { desktop = null; cancelFolders(); cleanup.cancelAll(); });
  });
  ctx.inject(['llm'], child => {
    const service: unknown = Reflect.get(child, 'llm');
    if (!service || typeof service !== 'object' || typeof Reflect.get(service, 'stream') !== 'function') return;
    llm = service as MemoryLlm;
    child.effect(() => () => { llm = null; cleanup.cancelAll(); });
  });
  ctx.inject(['systemPrompt'], child => {
    const service: unknown = Reflect.get(child, 'systemPrompt');
    if (!service || typeof service !== 'object'
      || !('section' in service) || typeof service.section !== 'function'
      || !('context' in service) || typeof service.context !== 'function') return;
    prompt = service as MemoryPrompt;
    sync();
    child.effect(() => () => { stop(); prompt = null; });
  });
  ctx.on('settings/document-updated', namespace => {
    if (namespace === owner.fiber.entry?.options.id) sync();
  });
  ctx.effect(() => () => { alive = false; stop(); memory.close(); });
  return {
    memory,
    memoryCleanup: cleanup,
    async memoryCatalog() {
      ensureEnabled();
      if (!registered) throw new Error('memoryUnavailable');
      try { return await memory.catalog(); } catch (error) { throw new Error(memoryError(error, 'memoryLoadFailed')); }
    },
    memoryEnsureEnabled: ensureEnabled,
    async memoryOpenFolder(scope: string) {
      ensureEnabled();
      try {
        const current = desktop;
        if (!current?.canOpenWorkspacePath?.() || !current.openWorkspacePath) throw new Error('memoryFolderUnavailable');
        const path = await memory.folder(scope);
        ensureEnabled();
        if (current !== desktop) throw new Error('memoryFolderUnavailable');
        const operation = new AbortController();
        folderOperations.add(operation);
        try {
          const result = await current.openWorkspacePath({ path }, operation.signal);
          ensureEnabled();
          operation.signal.throwIfAborted();
          if (!result.opened) throw new Error('memoryOpenFolderFailed');
          return true;
        } finally { folderOperations.delete(operation); }
      } catch (error) { throw new Error(memoryError(error, 'memoryOpenFolderFailed')); }
    },
  };
}

export const methods = {
  memoryCleanupModels() { return this.run(() => ({ pending: this.memoryCleanup.models() })).then(result => result.pending); },
  prepareMemoryCleanup(scope: string, model: string, token: string) {
    return this.run(() => ({ pending: this.memoryCleanup.prepare(scope, model, token) })).then(result => result.pending);
  },
  cancelMemoryCleanup(token: string) { return this.run(() => { this.memoryEnsureEnabled(); return this.memoryCleanup.cancel(token); }); },
  applyMemoryCleanup(token: string) {
    return this.run(() => ({ pending: this.memoryCleanup.apply(token) })).then(result => result.pending);
  },
  listMemoryEntries() { return this.run(() => this.memoryCatalog()); },
  openMemoryFolder(scope: string) { return this.run(() => this.memoryOpenFolder(scope)); },
  readMemoryEntry(scope: string, id: string) {
    return this.run(async () => {
      this.memoryEnsureEnabled();
      try {
        const detail = await this.memory.read(scope, id);
        const directory = await this.memory.folder(scope);
        return { ...detail, path: join(directory, `${detail.name}.md`) };
      } catch (error) { throw new Error(memoryError(error, 'memoryLoadFailed')); }
    });
  },
  deleteMemoryEntry(scope: string, id: string, revision: string) {
    return this.run(async () => {
      this.memoryEnsureEnabled();
      try { return await this.memory.remove(scope, id, revision); } catch (error) { throw new Error(memoryError(error)); }
    });
  },
  clearMemoryScope(scope: string, revision: string) {
    return this.run(async () => {
      this.memoryEnsureEnabled();
      try { return await this.memory.clear(scope, revision); } catch (error) { throw new Error(memoryError(error)); }
    });
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
