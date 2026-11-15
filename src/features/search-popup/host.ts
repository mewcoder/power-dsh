import type { NativeContext } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { HostOptions, HostService } from '../../shared/host/feature.ts';
import { EnhancePolicy } from './enhance-policy.ts';
import { ContentIndex, type ContentProjector } from './content-index.ts';
import { RecentPreviews } from './recent-previews.ts';

export function createHost(ctx: NativeContext, config: LivePreferences, { owner, ensureActive }: HostOptions) {
  const enhance = new EnhancePolicy(owner, config, { ensureActive });
  const content = new ContentIndex(owner, () => config.searchPopupEnabled.get());
  const recentPreviews = new RecentPreviews();
  let binding: object | null = null;
  ctx.inject(['sessionQuery', 'sessions', 'sessionPersistence'], child => {
    const service = child.sessionQuery as unknown as ContentIndex['service'];
    const store = (child as unknown as { sessions: ContentIndex['store'] }).sessions;
    const persistence = child.sessionPersistence as unknown as ContentIndex['persistence'];
    if (!service || typeof service.searchSessions !== 'function' || typeof service.readSurface !== 'function'
      || !store || typeof store.get !== 'function' || !persistence || typeof persistence.list !== 'function') return;
    const current = {};
    binding = current;
    content.service = service;
    content.store = store;
    content.persistence = persistence;
    recentPreviews.service = service;
    recentPreviews.store = store;
    child.on('session/event', (session, event) => {
      content.append(session, event);
      recentPreviews.invalidate(session.id);
    }, { global: true });
    child.on('session/created', session => {
      content.invalidate(session.id);
      recentPreviews.invalidate(session.id);
    }, { global: true });
    child.on('session/disposed', session => {
      content.invalidate(session.id);
      recentPreviews.invalidate(session.id);
    }, { global: true });
    child.effect(() => () => {
      if (binding !== current) return;
      binding = null;
      content.service = null;
      content.store = null;
      content.persistence = null;
      content.clear();
      recentPreviews.service = null;
      recentPreviews.store = null;
      recentPreviews.clear();
    });
  });
  ctx.inject(['loader'], async child => {
    let active = true;
    let project: ContentProjector | undefined;
    child.effect(() => () => {
      active = false;
      if (content.project === project) content.project = null;
    });
    try {
      const module = await child.loader.import('@deepseek-ai/dsh-session-query') as {
        buildSessionEventSearchDocuments?: ContentProjector;
      };
      if (typeof module.buildSessionEventSearchDocuments !== 'function') return;
      project = module.buildSessionEventSearchDocuments;
      if (active) content.project = project;
    } catch {}
  });
  ctx.effect(() => () => content.dispose());
  ctx.effect(() => () => recentPreviews.dispose());
  return { enhance, content, recentPreviews };
}

export const methods = {
  async setSearchPopupEnabled(enabled: boolean) {
    return this.run(async () => {
      const result = await this.enhance.setEnabled(enabled);
      if (!enabled) {
        this.content.clear();
        this.recentPreviews.clear();
      }
      // The shared policy wire envelope names its field `blocked`; map the
      // semantic `enabled` onto it at the boundary.
      return { blocked: result.enabled };
    });
  },
  // A read-only convenience over the derived index: the Client asks once per
  // query, and a disabled or absent index answers `available: false` so the
  // panel falls back to the native service without an error.
  async searchSessionContent(query: string, limit: number, previewIds: readonly string[], sessionIds: readonly string[]) {
    return this.run(async () => {
      if (this.enhance.enhanced() && query.trim() !== '' && sessionIds.length > 0) await this.enhance.configureEngine(true);
      return this.content.query(query, limit, previewIds, sessionIds);
    });
  },
  async readRecentSessionPreviews(sessionIds: readonly string[], versions: readonly string[]) {
    return this.run(() => this.enhance.enhanced() ? this.recentPreviews.read(sessionIds, versions)
      : { available: true, items: [], previews: [] });
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
