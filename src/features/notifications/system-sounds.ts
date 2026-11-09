import { errorMessage, type NativeContext, type NativeSubprocessHandle } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { SystemSoundsCatalog, SoundPlayback } from './rpc.ts';
import type { Dirent, Stats } from 'node:fs';
interface SoundOptions {
  platform?: string; soundsDirectory?: string; timeoutMs?: number; graceMs?: number;
  readDirectory?: (path: string, options: { withFileTypes: true }) => Promise<Dirent[]>;
  fileInfo?: (path: string) => Promise<Stats>;
  realPath?: (path: string) => Promise<string>;
}
interface SoundOperation { controller: AbortController; handle: NativeSubprocessHandle | null }
import { readdir, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_SOUND = { id: 'default', name: 'default' };
const WINDOWS_ALIASES = new Set(['SystemDefault', 'SystemAsterisk', 'SystemExclamation', 'SystemHand', 'SystemQuestion']);
const MAC_EXTENSIONS = new Set(['.aiff', '.aif', '.wav', '.caf']);

// Every alias inserted below comes from WINDOWS_ALIASES, never from arbitrary command text.
function windowsCommand(alias: string) {
  return `$ErrorActionPreference = 'Stop'\nAdd-Type -TypeDefinition @'\nusing System;\nusing System.Runtime.InteropServices;\npublic static class DshModSystemSound {\n  [DllImport("winmm.dll", CharSet = CharSet.Unicode, SetLastError = true)]\n  [return: MarshalAs(UnmanagedType.Bool)]\n  public static extern bool PlaySound(string sound, IntPtr module, uint flags);\n}\n'@\nif (-not [DshModSystemSound]::PlaySound('${alias}', [IntPtr]::Zero, 0x00210002)) { throw 'System sound playback failed' }`;
}

/** Host-local built-in sounds; the Client must restrict native playback to local connections. */
export class SystemSounds {
  ctx: NativeContext;
  config: LivePreferences;
  platform: string;
  directory: string;
  readDirectory: NonNullable<SoundOptions['readDirectory']>;
  fileInfo: NonNullable<SoundOptions['fileInfo']>;
  realPath: NonNullable<SoundOptions['realPath']>;
  timeoutMs: number;
  graceMs: number;
  closed: boolean;
  current: SoundOperation | null;
  constructor(ctx: NativeContext, config: LivePreferences, options: SoundOptions = {}) {
    this.ctx = ctx;
    this.config = config;
    this.platform = options.platform ?? process.platform;
    this.directory = options.soundsDirectory ?? '/System/Library/Sounds';
    this.readDirectory = options.readDirectory ?? readdir;
    this.fileInfo = options.fileInfo ?? lstat;
    this.realPath = options.realPath ?? realpath;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.graceMs = options.graceMs ?? 250;
    this.closed = false;
    this.current = null;
    ctx.effect(() => () => this.close());
  }

  async macFiles() {
    const entries = await this.readDirectory(this.directory, { withFileTypes: true });
    const files = new Map<string, { filename: string; name: string }>();
    const root = await this.realPath(this.directory);
    for (const entry of entries) {
      if (!entry.isFile() || entry.name !== path.basename(entry.name) || entry.name.startsWith('.')
        || !MAC_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      const filename = path.join(this.directory, entry.name);
      const info = await this.fileInfo(filename);
      if (!info.isFile() || await this.realPath(filename) !== path.join(root, entry.name)) continue;
      files.set(`mac:${entry.name}`, { filename, name: path.basename(entry.name, path.extname(entry.name)) });
    }
    return files;
  }

  async list(): Promise<SystemSoundsCatalog> {
    if (this.closed) throw new Error('notificationSoundUnavailable');
    if (!this.ctx.get('subprocess') || !['darwin', 'win32'].includes(this.platform)) {
      return { platform: 'other', sounds: [{ ...DEFAULT_SOUND }] };
    }
    try {
      const sounds = this.platform === 'darwin'
        ? [...await this.macFiles()].map(([id, value]) => ({ id, name: value.name }))
        : [...WINDOWS_ALIASES].map(alias => ({ id: `win:${alias}`, name: alias }));
      if (this.closed) throw new Error('notificationSoundUnavailable');
      sounds.sort((left, right) => left.name.localeCompare(right.name));
      return { platform: this.platform as 'darwin' | 'win32', sounds: [{ ...DEFAULT_SOUND }, ...sounds] };
    } catch (_error) {
      throw new Error('notificationSoundUnavailable');
    }
  }

  automaticAllowed(id: string) {
    return this.config.notificationsEnabled.get() === true && this.config.notificationSoundEnabled.get() === true
      && this.config.notificationSound.get() === id;
  }

  async play(id: string, preview = false): Promise<SoundPlayback> {
    if (this.closed) throw new Error('notificationSoundUnavailable');
    if (typeof id !== 'string' || typeof preview !== 'boolean') throw new Error('notificationSoundInvalid');
    // The browser owns the system-default notification, including its preview.
    if (id === 'default' || (!preview && !this.automaticAllowed(id)) || this.current) return { played: false };
    const subprocess = this.ctx.get('subprocess');
    if (!subprocess || !['darwin', 'win32'].includes(this.platform)) throw new Error('notificationSoundUnavailable');
    const operation: SoundOperation = { controller: new AbortController(), handle: null };
    this.current = operation;
    const timer = setTimeout(() => operation.controller.abort(), this.timeoutMs);
    try {
      let argv;
      if (this.platform === 'darwin') {
        const files = await this.macFiles();
        const sound = files.get(id);
        if (!sound) throw new Error('notificationSoundInvalid');
        const executable = await subprocess.resolveExecutable('/usr/bin/afplay', undefined, operation.controller.signal);
        argv = [executable, sound.filename];
      } else {
        const alias = id.startsWith('win:') ? id.slice(4) : '';
        if (!WINDOWS_ALIASES.has(alias)) throw new Error('notificationSoundInvalid');
        const executable = await subprocess.resolveExecutable('powershell.exe', undefined, operation.controller.signal);
        argv = [executable, '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', windowsCommand(alias)];
      }
      if (this.closed || (!preview && !this.automaticAllowed(id))) return { played: false };
      operation.controller.signal.throwIfAborted();
      const handle = subprocess.spawn({
        argv, cwd: process.cwd(), graceMs: this.graceMs, signal: operation.controller.signal,
        stdio: { stdin: 'ignore', stdout: { maxBytes: 1024 }, stderr: { maxBytes: 4096 } },
      });
      operation.handle = handle;
      const outcome = await handle.done;
      if (!await handle.waitForExit(operation.controller.signal)) throw new Error('notificationSoundFailed');
      operation.controller.signal.throwIfAborted();
      if (outcome.exitCode !== 0 || outcome.signal !== null) throw new Error('notificationSoundFailed');
      return { played: true };
    } catch (error) {
      operation.controller.abort();
      if (this.closed) return { played: false };
      throw new Error(errorMessage(error) === 'notificationSoundInvalid' ? 'notificationSoundInvalid' : 'notificationSoundFailed');
    } finally {
      clearTimeout(timer);
      if (operation.controller.signal.aborted) operation.handle?.terminate();
      if (this.current === operation) this.current = null;
    }
  }

  async close() {
    this.closed = true;
    const operation = this.current;
    if (!operation) return;
    operation.controller.abort();
    const handle = operation.handle;
    if (!handle) return;
    handle.terminate();
    // Bound this plugin's own teardown; the provider remains the final owner of the managed range.
    void handle.done.catch(() => {});
    await Promise.allSettled([handle.waitForExit(AbortSignal.timeout(this.graceMs + 1000))]);
  }
}
