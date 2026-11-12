import type { NativeContext, NativeSubprocessHandle } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { PluginRelease } from '../../shared/types/wire.ts';
import { versionParts } from './versions.ts';

const REPOSITORY = 'https://github.com/mewcoder/power-dsh';

export function releaseCommits(text: string) {
  const tags = new Map<string, { tag: string; commit?: string }>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^([a-f0-9]{40})\trefs\/tags\/v([^/\s^]+)(\^\{\})?$/.exec(line);
    if (!match || !versionParts(match[2])) continue;
    const entry = tags.get(match[2]) ?? { tag: '' };
    if (match[3]) entry.commit = match[1];
    else entry.tag = match[1];
    tags.set(match[2], entry);
  }
  return new Map([...tags].filter(([, value]) => value.tag).map(([version, value]) => [version, value.commit ?? value.tag]));
}

export class PluginReleases {
  ctx: NativeContext;
  config: LivePreferences;
  fetch: typeof fetch;
  controller: AbortController | null = null;
  handle: NativeSubprocessHandle | null = null;
  retryAt = 0;
  closed = false;
  constructor(ctx: NativeContext, config: LivePreferences, request: typeof fetch = fetch) {
    this.ctx = ctx;
    this.config = config;
    this.fetch = request;
    ctx.effect(() => () => this.close());
  }
  async head(url: string, signal: AbortSignal) {
    const response = await this.fetch(url, { method: 'HEAD', redirect: 'manual', credentials: 'omit', signal });
    if (response.status === 429 || (response.status === 403 && (response.headers.get('x-ratelimit-remaining') === '0'
      || response.headers.has('retry-after')))) {
      const now = Date.now();
      const retry = response.headers.get('retry-after') || '';
      const deadline = /^\d+$/.test(retry) ? now + Number(retry) * 1000 : Date.parse(retry);
      this.retryAt = Math.min(now + 86_400_000, Math.max(now + 60_000, Number.isFinite(deadline) ? deadline : 0));
      throw new Error('rate-limited');
    }
    return response;
  }
  async read(): Promise<PluginRelease> {
    if (this.closed || this.config.pluginUpdatesEnabled.get() !== true) return { status: 'unavailable' };
    if (this.retryAt > Date.now()) return { status: 'rate-limited', retryAt: this.retryAt };
    const subprocess = this.ctx.get('subprocess');
    if (!subprocess) return { status: 'git-unavailable' };
    const controller = this.controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    const stopped = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener('abort', () => reject(new Error('unavailable')), { once: true });
    });
    try {
      let executable: string;
      try { executable = await Promise.race([subprocess.resolveExecutable('git', undefined, controller.signal), stopped]); }
      catch (_error) { return { status: controller.signal.aborted ? 'unavailable' : 'git-unavailable' }; }
      if (this.closed || this.config.pluginUpdatesEnabled.get() !== true) return { status: 'unavailable' };
      const handle = this.handle = subprocess.spawn({
        argv: [executable, '-c', 'credential.helper=', '-c', 'core.askPass=', 'ls-remote', '--tags', `${REPOSITORY}.git`, 'refs/tags/v*'],
        env: { GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_COUNT: '0',
          GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' },
        cwd: process.cwd(), graceMs: 250, signal: controller.signal,
        stdio: { stdin: 'ignore', stdout: { maxBytes: 65_536 }, stderr: { maxBytes: 4096 } },
      });
      const outcome = await Promise.race([handle.done, stopped]);
      if (!await Promise.race([handle.waitForExit(controller.signal), stopped])
        || outcome.exitCode !== 0 || outcome.signal !== null) throw new Error('unavailable');
      const output = handle.collected?.stdout?.readFrom(0);
      if (!output || output.lossy || output.text.length > 65_536) throw new Error('unavailable');
      const tags = releaseCommits(output.text);
      controller.signal.throwIfAborted();
      if (this.config.pluginUpdatesEnabled.get() !== true) return { status: 'unavailable' };
      const latest = await this.head(`${REPOSITORY}/releases/latest`, controller.signal);
      controller.signal.throwIfAborted();
      const location = latest.headers.get('location') || '';
      const version = location.startsWith(`${REPOSITORY}/releases/tag/v`) ? location.slice(`${REPOSITORY}/releases/tag/v`.length) : '';
      if (latest.status !== 302 || !versionParts(version) || !tags.has(version)) throw new Error('unavailable');
      if (this.config.pluginUpdatesEnabled.get() !== true) return { status: 'unavailable' };
      const asset = await this.head(`${REPOSITORY}/releases/download/v${version}/power-dsh.tgz`, controller.signal);
      const assetUrl = new URL(asset.headers.get('location') || '');
      if (asset.status !== 302 || assetUrl.protocol !== 'https:' || assetUrl.hostname !== 'release-assets.githubusercontent.com'
        || assetUrl.username || assetUrl.password) {
        throw new Error('unavailable');
      }
      controller.signal.throwIfAborted();
      if (this.closed || this.config.pluginUpdatesEnabled.get() !== true) return { status: 'unavailable' };
      return { status: 'ready', version, commit: tags.get(version)! };
    } catch (error) {
      return error instanceof Error && error.message === 'rate-limited'
        ? { status: 'rate-limited', retryAt: this.retryAt } : { status: 'unavailable' };
    } finally {
      clearTimeout(timer);
      controller.abort();
      this.handle?.terminate();
      this.handle = null;
      if (this.controller === controller) this.controller = null;
    }
  }
  close() {
    this.closed = true;
    this.controller?.abort();
    this.handle?.terminate();
  }
}
