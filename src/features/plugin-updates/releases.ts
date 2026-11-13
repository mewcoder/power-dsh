import type { NativeContext, NativeSubprocessHandle } from '../../shared/host/native.ts';
import type { PluginRelease, PluginUpdateDiagnostic } from '../../shared/types/wire.ts';
import { versionParts } from './versions.ts';
import { networkCode, UpdateFailure } from './diagnostics.ts';

const REPOSITORY = 'https://github.com/mewcoder/power-dsh';

function gitFailureReason(text: string): PluginUpdateDiagnostic['reason'] {
  if (/could not resolve proxy|proxy authentication|CONNECT tunnel failed/i.test(text)) return 'proxy';
  if (/could not resolve host|name or service not known|temporary failure in name resolution/i.test(text)) return 'dns';
  if (/SSL certificate problem|server certificate verification failed|certificate verify failed/i.test(text)) return 'certificate';
  if (/authentication failed|could not read Username|terminal prompts disabled/i.test(text)) return 'authentication';
  if (/failed to connect|connection refused|connection reset|connection timed out/i.test(text)) return 'connection';
  return 'process-exit';
}

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
  fetch: typeof fetch;
  controller: AbortController | null = null;
  handle: NativeSubprocessHandle | null = null;
  retryAt = 0;
  closed = false;
  constructor(ctx: NativeContext, request: typeof fetch = fetch) {
    this.ctx = ctx;
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
      throw new UpdateFailure('rate-limited', { stage: url.endsWith('/latest') ? 'release.latest' : 'release.asset',
        reason: 'rate-limited', observedAt: new Date().toISOString(), httpStatus: response.status });
    }
    return response;
  }
  async read(): Promise<PluginRelease> {
    if (this.closed) return { status: 'unavailable' };
    if (this.retryAt > Date.now()) return { status: 'rate-limited', retryAt: this.retryAt };
    const subprocess = this.ctx.get('subprocess');
    if (!subprocess) return { status: 'git-unavailable', diagnostic: {
      stage: 'git.resolve', reason: 'unavailable', observedAt: new Date().toISOString() } };
    const started = Date.now();
    let stage: PluginUpdateDiagnostic['stage'] = 'git.resolve';
    let timedOut = false;
    const failure = (reason: PluginUpdateDiagnostic['reason'], details: Partial<Pick<PluginUpdateDiagnostic, 'httpStatus' | 'exitCode' | 'systemCode'>> = {}) =>
      new UpdateFailure('unavailable', { stage, reason, observedAt: new Date().toISOString(), elapsedMs: Date.now() - started, ...details });
    const controller = this.controller = new AbortController();
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 20_000);
    const stopped = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener('abort', () => reject(new Error('unavailable')), { once: true });
    });
    try {
      let executable: string;
      try { executable = await Promise.race([subprocess.resolveExecutable('git', undefined, controller.signal), stopped]); }
      catch (_error) { return { status: controller.signal.aborted ? 'unavailable' : 'git-unavailable',
        diagnostic: failure(controller.signal.aborted ? timedOut ? 'timeout' : 'cancelled' : 'not-found').diagnostic }; }
      if (this.closed) return { status: 'unavailable' };
      stage = 'git.tags';
      const handle = this.handle = subprocess.spawn({
        argv: [executable, '-c', 'credential.helper=', '-c', 'core.askPass=', 'ls-remote', '--tags', `${REPOSITORY}.git`, 'refs/tags/v*'],
        env: { GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_COUNT: '0',
          GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' },
        cwd: process.cwd(), graceMs: 250, signal: controller.signal,
        stdio: { stdin: 'ignore', stdout: { maxBytes: 65_536 }, stderr: { maxBytes: 4096 } },
      });
      const outcome = await Promise.race([handle.done, stopped]);
      if (!await Promise.race([handle.waitForExit(controller.signal), stopped])
        || outcome.exitCode !== 0 || outcome.signal !== null) throw failure(gitFailureReason(handle.collected?.stderr?.readFrom(0)?.text || ''),
          typeof outcome.exitCode === 'number' ? { exitCode: outcome.exitCode } : {});
      const output = handle.collected?.stdout?.readFrom(0);
      if (!output || output.lossy || output.text.length > 65_536) throw failure('incomplete-output');
      const tags = releaseCommits(output.text);
      controller.signal.throwIfAborted();
      stage = 'release.latest';
      const latest = await this.head(`${REPOSITORY}/releases/latest`, controller.signal);
      controller.signal.throwIfAborted();
      const location = latest.headers.get('location') || '';
      const version = location.startsWith(`${REPOSITORY}/releases/tag/v`) ? location.slice(`${REPOSITORY}/releases/tag/v`.length) : '';
      if (latest.status !== 302) throw failure('http', { httpStatus: latest.status });
      if (!versionParts(version)) throw failure('invalid-response', { httpStatus: latest.status });
      if (!tags.has(version)) throw failure('tag-mismatch', { httpStatus: latest.status });
      stage = 'release.asset';
      const asset = await this.head(`${REPOSITORY}/releases/download/v${version}/power-dsh.tgz`, controller.signal);
      if (asset.status !== 302) throw failure('http', { httpStatus: asset.status });
      let assetUrl: URL;
      try { assetUrl = new URL(asset.headers.get('location') || ''); }
      catch { throw failure('invalid-response', { httpStatus: asset.status }); }
      if (assetUrl.protocol !== 'https:' || assetUrl.hostname !== 'release-assets.githubusercontent.com'
        || assetUrl.username || assetUrl.password) {
        throw failure('invalid-response', { httpStatus: asset.status });
      }
      controller.signal.throwIfAborted();
      if (this.closed) return { status: 'unavailable' };
      return { status: 'ready', version, commit: tags.get(version)! };
    } catch (error) {
      const diagnostic = error instanceof UpdateFailure ? error.diagnostic
        : failure(controller.signal.aborted ? timedOut ? 'timeout' : 'cancelled'
          : stage.startsWith('release.') ? 'network' : 'unavailable', { systemCode: networkCode(error) }).diagnostic;
      return error instanceof Error && error.message === 'rate-limited'
        ? { status: 'rate-limited', retryAt: this.retryAt, diagnostic } : { status: 'unavailable', diagnostic };
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
