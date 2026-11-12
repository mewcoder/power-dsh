export const SCHEMA = 'dsh-market/update-api/v1';
const API = 'dsh-market/api/v1/';
const RELEASES = 'https://github.com/mewcoder/power-dsh/releases';
import type { PluginRelease } from '../../shared/types/wire.ts';
import { compareVersions, versionParts } from './versions.ts';
export { compareVersions } from './versions.ts';

interface Capabilities { bootId: string; update: boolean }
export interface UpdateTarget {
  version: string; url: string; source: string; installed: string; latest: string; bootId: string;
}
interface PendingUpdate { operationId: string; target: UpdateTarget; beforeVersion: string }
export interface UpdateState {
  phase: 'idle' | 'checking' | 'available' | 'current' | 'unconfirmed' | 'updating' | 'done' | 'error';
  target: UpdateTarget | null; error: string; notice: string;
  restartRequired: boolean; refreshRequired: boolean; pending: PendingUpdate | null;
}
interface UpdateOptions {
  baseURI: string; version: string; canUse(): boolean; notify(): void;
  fetch: typeof fetch; storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  schedule(callback: () => void, milliseconds: number): number; cancel(timer: number): void;
  now?(): number;
  release(signal: AbortSignal): Promise<PluginRelease>;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function problem(key: string): never { throw new Error(key); }
function validTarget(value: unknown): value is UpdateTarget {
  return record(value) && typeof value.version === 'string' && versionParts(value.version) !== null
    && value.url === `${RELEASES}/tag/v${value.version}` && ['github', 'npm'].includes(String(value.source))
    && typeof value.installed === 'string' && value.installed.length <= 128
    && typeof value.latest === 'string' && value.latest.length <= 128
    && typeof value.bootId === 'string' && value.bootId.length > 0 && value.bootId.length <= 128;
}

export class PluginUpdateClient {
  options: UpdateOptions;
  state: UpdateState = { phase: 'idle', target: null, error: '', notice: '', restartRequired: false, refreshRequired: false, pending: null };
  controller: AbortController | null = null;
  timer: number | null = null;
  busy = false;
  closed = false;
  sequence = 0;
  polls = 0;
  githubRetryAt = 0;
  readonly storageKey: string;
  constructor(options: UpdateOptions) {
    this.options = options;
    this.storageKey = `power-dsh:update:${new URL('.', options.baseURI).href}`;
  }
  publish(patch: Partial<UpdateState>) {
    if (this.closed) return;
    this.state = { ...this.state, ...patch };
    this.options.notify();
  }
  path(endpoint: string) {
    return new URL(`${API}${endpoint}`, this.options.baseURI).pathname;
  }
  githubCooldown() {
    try {
      const saved = Number(this.options.storage?.getItem('power-dsh:update:github-retry-at'));
      if (Number.isFinite(saved)) this.githubRetryAt = Math.max(this.githubRetryAt, saved);
    } catch (_error) {}
    return this.githubRetryAt > (this.options.now?.() ?? Date.now());
  }
  async request(url: string, signal: AbortSignal, body?: object) {
    const timeout = new AbortController();
    const timer = this.options.schedule(() => timeout.abort(), 15_000);
    try {
      const response = await this.options.fetch(url, {
        method: body ? 'POST' : 'GET', signal: AbortSignal.any([signal, timeout.signal]),
        credentials: 'same-origin', redirect: 'error', cache: 'no-store',
        headers: body ? { 'Content-Type': 'application/json' } : { Accept: 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const text = await response.text();
      if (text.length > 131_072) problem('pluginUpdateCheckFailed');
      if (!response.ok) {
        if (response.status === 429) {
          problem('pluginUpdateRateLimited');
        }
        problem(response.status === 404 || response.status === 405 ? 'pluginUpdateApiUnavailable'
          : response.status === 401 || response.status === 403 ? 'pluginUpdateDenied' : 'pluginUpdateCheckFailed');
      }
      const data: unknown = JSON.parse(text);
      if (!record(data) || data.schema !== SCHEMA) problem('pluginUpdateApiUnavailable');
      return data;
    } finally { this.options.cancel(timer); }
  }
  async discover(signal: AbortSignal): Promise<Capabilities> {
    const data = await this.request(this.path('capabilities'), signal);
    if (data.apiVersion !== 1 || !['beta', 'stable'].includes(String(data.stability)) || !record(data.features)
      || !record(data.endpoints) || data.features.check !== true || data.features.progress !== true
      || data.endpoints.updates !== '/dsh-market/api/v1/updates' || data.endpoints.operations !== '/dsh-market/api/v1/operations'
      || typeof data.bootId !== 'string' || !data.bootId || data.bootId.length > 128) problem('pluginUpdateApiUnavailable');
    return { bootId: data.bootId, update: data.features.update === true };
  }
  async inspect(signal: AbortSignal): Promise<{ target: UpdateTarget | null; phase: 'available' | 'current' | 'unconfirmed' }> {
    if (this.githubCooldown()) problem('pluginUpdateRateLimited');
    const release = await this.options.release(signal);
    signal.throwIfAborted();
    if (release.status === 'rate-limited') {
      const now = this.options.now?.() ?? Date.now();
      this.githubRetryAt = Math.min(now + 86_400_000, Math.max(now + 60_000, release.retryAt));
      try { this.options.storage?.setItem('power-dsh:update:github-retry-at', String(this.githubRetryAt)); } catch (_error) {}
      problem('pluginUpdateRateLimited');
    }
    if (release.status !== 'ready') problem(release.status === 'git-unavailable' ? 'pluginUpdateGitUnavailable' : 'pluginUpdateCheckFailed');
    const version = release.version;
    if (!versionParts(version) || !/^[a-f0-9]{40}$/.test(release.commit)) problem('pluginUpdateCheckFailed');
    const comparison = compareVersions(version, this.options.version);
    if (comparison === null) problem('pluginUpdateSource');
    if (comparison <= 0) return { target: null, phase: 'current' };
    const capabilities = await this.discover(signal);
    const data = await this.request(`${this.path('updates')}?name=power-dsh&force=1`, signal);
    const item = data.package;
    if (!record(item) || item.name !== 'power-dsh' || typeof item.updateAvailable !== 'boolean') problem('pluginUpdateCheckFailed');
    if (item.source !== 'github' && item.source !== 'npm') problem('pluginUpdateSource');
    if (!capabilities.update || !item.updateAvailable || typeof item.installedVersion !== 'string' || !item.installedVersion
      || item.installedVersion.length > 128 || typeof item.latestVersion !== 'string' || item.latestVersion.length > 128) {
      return { target: null, phase: 'unconfirmed' };
    }
    if (item.source === 'github') {
      if (item.latestVersion !== release.commit) return { target: null, phase: 'unconfirmed' };
    } else if (item.latestVersion !== version || item.installedVersion !== this.options.version) {
      return { target: null, phase: 'unconfirmed' };
    }
    return { phase: 'available', target: { version, url: `${RELEASES}/tag/v${version}`, source: item.source,
      installed: item.installedVersion, latest: item.latestVersion, bootId: capabilities.bootId } };
  }
  errorKey(error: unknown) {
    const key = error instanceof Error ? error.message : '';
    return ['pluginUpdateApiUnavailable', 'pluginUpdateDenied', 'pluginUpdateGitUnavailable', 'pluginUpdateRateLimited',
      'pluginUpdateSource', 'pluginUpdateChanged'].includes(key)
      ? key : 'pluginUpdateCheckFailed';
  }
  async check() {
    if (this.closed || this.busy || this.state.pending || !this.options.canUse()) return;
    this.busy = true;
    const sequence = ++this.sequence;
    const controller = this.controller = new AbortController();
    this.publish({ phase: 'checking', target: null, error: '', notice: '' });
    try {
      const result = await this.inspect(controller.signal);
      if (sequence === this.sequence && this.options.canUse()) this.publish({ ...result, error: '' });
    } catch (error) {
      if (sequence === this.sequence) this.publish({ phase: 'error', error: this.errorKey(error) });
    } finally { if (sequence === this.sequence) { this.busy = false; this.controller = null; } }
  }
  savePending(pending: PendingUpdate | null) {
    try {
      if (!this.options.storage) problem('pluginUpdateUnknown');
      if (pending) this.options.storage.setItem(this.storageKey, JSON.stringify(pending));
      else this.options.storage.removeItem(this.storageKey);
    } catch (_error) { if (pending) this.publish({ notice: 'pluginUpdateStorage' }); }
  }
  async update(expected: UpdateTarget) {
    if (this.closed || this.busy || this.state.pending || this.state.target !== expected || !this.options.canUse()) return;
    this.busy = true;
    const sequence = ++this.sequence;
    const controller = this.controller = new AbortController();
    let submitted = false;
    this.publish({ phase: 'checking', error: '' });
    try {
      const fresh = await this.inspect(controller.signal);
      if (sequence !== this.sequence || !this.options.canUse()) return;
      if (!fresh.target || JSON.stringify(fresh.target) !== JSON.stringify(expected)) problem('pluginUpdateChanged');
      submitted = true;
      const unknown = { operationId: 'submission-unknown', target: expected, beforeVersion: this.options.version };
      this.savePending(unknown);
      this.publish({ pending: unknown });
      const reply = await this.request(this.path('updates'), controller.signal, { packageName: 'power-dsh' });
      const operation = reply.operation;
      if (!record(operation) || operation.packageName !== 'power-dsh' || typeof operation.operationId !== 'string'
        || !operation.operationId || operation.operationId.length > 256) problem('pluginUpdateUnknown');
      const pending = { operationId: operation.operationId, target: expected, beforeVersion: this.options.version };
      this.savePending(pending);
      if (sequence !== this.sequence) return;
      this.polls = 0;
      this.publish({ phase: 'updating', pending, target: expected });
      this.observe(operation);
    } catch (error) {
      if (sequence === this.sequence) this.publish({ phase: 'error', target: null,
        error: submitted ? 'pluginUpdateUnknown' : this.errorKey(error) });
    } finally { if (sequence === this.sequence) { this.busy = false; this.controller = null; } }
  }
  observe(value: unknown) {
    const pending = this.state.pending;
    if (!pending || !record(value) || value.schema !== SCHEMA || value.kind !== 'update' || value.packageName !== 'power-dsh'
      || value.operationId !== pending.operationId) problem('pluginUpdateUnknown');
    if (value.state === 'queued' || value.state === 'running') {
      if (++this.polls > 400) problem('pluginUpdateUnknown');
      this.publish({ phase: 'updating', error: '' });
      this.timer = this.options.schedule(() => { this.timer = null; void this.poll(); }, 1500);
      return;
    }
    if (value.state === 'succeeded' && record(value.outcome) && typeof value.installedVersion === 'string'
      && value.beforeVersion === pending.beforeVersion && compareVersions(value.installedVersion, pending.target.version) !== null
      && compareVersions(value.installedVersion, pending.target.version)! >= 0
      && typeof value.outcome.refreshRequired === 'boolean' && typeof value.outcome.restartRequired === 'boolean') {
      this.savePending(null);
      this.publish({ phase: 'done', pending: null, error: '', restartRequired: value.outcome.restartRequired,
        refreshRequired: value.outcome.refreshRequired, target: { ...pending.target, version: value.installedVersion } });
    } else if (['failed', 'cancelled', 'rolled-back'].includes(String(value.state))) {
      this.savePending(null);
      this.publish({ phase: 'error', pending: null, target: null, error: value.state === 'rolled-back'
        ? 'pluginUpdateRolledBack' : value.state === 'cancelled' ? 'pluginUpdateCancelled' : 'pluginUpdateFailed' });
    } else problem('pluginUpdateUnknown');
  }
  async poll() {
    const pending = this.state.pending;
    if (this.closed || this.busy || !pending || !this.options.canUse()) return;
    this.busy = true;
    const sequence = ++this.sequence;
    const controller = this.controller = new AbortController();
    try {
      const reply = await this.request(`${this.path('operations')}?operationId=${encodeURIComponent(pending.operationId)}`, controller.signal);
      if (sequence === this.sequence && this.options.canUse()) this.observe(reply.operation);
    } catch (_error) {
      if (sequence === this.sequence) this.publish({ phase: 'error', error: 'pluginUpdateUnknown' });
    } finally { if (sequence === this.sequence) { this.busy = false; this.controller = null; } }
  }
  async resume() {
    if (this.closed || this.busy || !this.options.canUse()) return;
    if (this.timer !== null) this.options.cancel(this.timer);
    this.timer = null;
    let pending: unknown = this.state.pending;
    if (!pending) {
      try { pending = JSON.parse(this.options.storage?.getItem(this.storageKey) || 'null'); }
      catch (_error) { return; }
    }
    if (!pending) return;
    if (!record(pending) || typeof pending.operationId !== 'string' || !pending.operationId || pending.operationId.length > 256
      || !validTarget(pending.target) || typeof pending.beforeVersion !== 'string' || !versionParts(pending.beforeVersion)) { this.savePending(null); return; }
    const restored = { operationId: pending.operationId, target: pending.target, beforeVersion: pending.beforeVersion };
    this.busy = true;
    const sequence = ++this.sequence;
    const controller = this.controller = new AbortController();
    this.publish({ phase: 'updating', pending: restored, target: restored.target, error: '' });
    try {
      const capabilities = await this.discover(controller.signal);
      if (sequence !== this.sequence) return;
      if (capabilities.bootId !== restored.target.bootId) {
        this.savePending(null);
        this.publish({ phase: 'error', pending: null, target: null, error: 'pluginUpdateUnknown' });
        return;
      }
    } catch (_error) {
      if (sequence === this.sequence) this.publish({ phase: 'error', error: 'pluginUpdateUnknown' });
      return;
    } finally { if (sequence === this.sequence) { this.busy = false; this.controller = null; } }
    if (sequence === this.sequence && this.options.canUse()) { this.polls = 0; await this.poll(); }
  }
  pause() {
    this.sequence++;
    this.controller?.abort();
    this.controller = null;
    if (this.timer !== null) this.options.cancel(this.timer);
    this.timer = null;
    this.busy = false;
    if (this.state.phase === 'checking') this.publish({ phase: this.state.pending ? 'error' : 'idle',
      error: this.state.pending ? 'pluginUpdateUnknown' : '', target: null });
  }
  close() { this.pause(); this.closed = true; }
}
