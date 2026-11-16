import type { NativeContext, Release } from '../../shared/host/native.ts';
import type { HostOptions } from '../../shared/host/feature.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import { isRecord } from '../../shared/types/protocol.ts';
import { HISTORY_POLICY, historyError, queryHistory, type HistoryQuery } from './history.ts';
import { createHistoryTool } from './tool.ts';

interface Prompt {
  section(options: { name: string; order: number; text: () => string; interpolate: boolean }): Release;
}

export function createHost(ctx: NativeContext, config: LivePreferences, { owner, ensureActive }: HostOptions) {
  let alive = true;
  let binding: { query: HistoryQuery; prompt: Prompt } | null = null;
  let lifetime: AbortController | null = null;
  let releases: Release[] = [];
  const stop = () => {
    lifetime?.abort();
    lifetime = null;
    for (const release of releases.splice(0).reverse()) release();
  };
  const sync = () => {
    if (!alive || !config.historySearchEnabled?.get() || !binding) { stop(); return; }
    if (lifetime) return;
    const current = binding;
    const operation = new AbortController();
    lifetime = operation;
    const check = () => {
      ensureActive();
      if (!alive || config.historySearchEnabled?.get() !== true) throw new Error('historyDisabled');
      if (operation.signal.aborted || lifetime !== operation || binding !== current) throw new Error('historyCancelled');
    };
    try {
      releases.push(current.prompt.section({ name: 'power-dsh:history-search', order: 710,
        interpolate: false, text: () => alive && !operation.signal.aborted && config.historySearchEnabled?.get() ? HISTORY_POLICY : '' }));
      releases.push(ctx.tools.register(createHistoryTool(async (request, caller, signal) => {
        try {
          check();
          if (!caller) throw new Error('historyWorkspaceRequired');
          const combined = AbortSignal.any([signal, operation.signal, AbortSignal.timeout(30_000)]);
          const data = await queryHistory(current.query, caller, request, combined, check);
          check();
          return JSON.stringify({ ok: true, error: '', data });
        } catch (error) {
          return JSON.stringify({ ok: false, error: historyError(error), data: null });
        }
      })));
    } catch {
      stop();
      throw new Error('historyUnavailable');
    }
  };
  ctx.inject(['sessionQuery', 'systemPrompt'], child => {
    const query: unknown = child.sessionQuery;
    const prompt: unknown = Reflect.get(child, 'systemPrompt');
    if (!isRecord(query) || typeof query.filterSessions !== 'function' || typeof query.readSurface !== 'function'
      || !isRecord(prompt) || typeof prompt.section !== 'function') return;
    stop();
    const current = { query: query as unknown as HistoryQuery, prompt: prompt as unknown as Prompt };
    binding = current;
    sync();
    child.effect(() => () => {
      if (binding !== current) return;
      stop();
      binding = null;
    });
  });
  ctx.on('settings/document-updated', namespace => {
    if (namespace === owner.fiber.entry?.options.id) sync();
  });
  ctx.effect(() => () => { alive = false; stop(); binding = null; });
  return {};
}
