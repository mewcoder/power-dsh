import { errorMessage, type NativeContext } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { RestartStatus, RestartAccepted } from './rpc.ts';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
interface RestartOptions {
  platform?: string; executable?: string; env?: NodeJS.ProcessEnv;
  readFile?: (path: string, encoding: 'utf8') => Promise<string>;
  realpath?: (path: string) => Promise<string>;
  spawn?: (command: string, args: string[], options: SpawnOptions) => ChildProcess;
  windows?: Partial<WindowsRestartOptions>;
}
interface RestartOperation { handle: ChildProcess | null; handedOff: boolean }
import { spawn } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import { WindowsRestart, type WindowsRestartOptions } from './windows-restart.ts';

// The helper outlives the Host only after an explicit restart request.
// A cancelled quit or a timeout exits without launching another copy.
export const MAC_RESTART_SCRIPT = `on run argv
  set appPath to item 1 of argv
  delay 0.5
  with timeout of 120 seconds
    tell application appPath to quit
  end timeout
  repeat 120 times
    if not (application appPath is running) then
      do shell script "/usr/bin/open -a " & quoted form of appPath
      return
    end if
    delay 0.25
  end repeat
  error "Application did not exit" number 1001
end run`;

/** Verified packaged desktop Hosts can hand off one application restart. */
export class DesktopRestart {
  config: LivePreferences;
  platform: string;
  executable: string;
  env: NodeJS.ProcessEnv;
  readFile: NonNullable<RestartOptions['readFile']>;
  realpath: NonNullable<RestartOptions['realpath']>;
  spawn: NonNullable<RestartOptions['spawn']>;
  closed: boolean;
  current: RestartOperation | null;
  error: RestartStatus['error'];
  windows: WindowsRestart | null;
  constructor(ctx: NativeContext, config: LivePreferences, options: RestartOptions = {}) {
    this.config = config;
    this.platform = options.platform ?? process.platform;
    this.executable = options.executable ?? process.execPath;
    this.env = options.env ?? process.env;
    this.readFile = options.readFile ?? readFile;
    this.realpath = options.realpath ?? realpath;
    this.spawn = options.spawn ?? spawn;
    this.closed = false;
    this.current = null;
    this.error = '';
    this.windows = this.platform === 'win32' ? new WindowsRestart(config, {
      executable: this.executable, env: this.env, ...options.windows,
    }) : null;
    ctx.effect(() => () => this.close());
  }

  async target() {
    if (this.platform !== 'darwin' || !this.env.DSH_CLIENT_VERSION) return null;
    try {
      const executable = await this.realpath(this.executable);
      const marker = '.app/Contents/MacOS/';
      const end = executable.indexOf(marker);
      if (end < 0) return null;
      const app = executable.slice(0, end + 4);
      const plist = await this.readFile(`${app}/Contents/Info.plist`, 'utf8');
      if (!/<key>CFBundleIdentifier<\/key>\s*<string>com\.deepseek\.dsh<\/string>/.test(plist)) return null;
      return app;
    } catch (_error) {
      return null; // Unverified paths never become restart targets.
    }
  }

  async status(): Promise<RestartStatus> {
    if (this.windows) return this.windows.status();
    if (this.closed) throw new Error('restartUnavailable');
    const supported = Boolean(await this.target());
    if (this.closed) throw new Error('restartUnavailable');
    return { supported, running: this.current !== null, error: this.error };
  }

  async restart(): Promise<RestartAccepted> {
    if (this.windows) return this.windows.restart();
    if (this.closed || this.config.showRestartButton.get() !== true) throw new Error('restartUnavailable');
    if (this.current) throw new Error('restartBusy');
    const operation: RestartOperation = { handle: null, handedOff: false };
    this.current = operation;
    this.error = '';
    try {
      const app = await this.target();
      if (this.closed || !app || this.config.showRestartButton.get() !== true) throw new Error('restartUnavailable');
      const env = { ...this.env };
      for (const key of ['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'NODE_PATH']) delete env[key];
      const child = this.spawn('/usr/bin/osascript', ['-e', MAC_RESTART_SCRIPT, app], {
        detached: true, stdio: 'ignore', env,
      });
      operation.handle = child;
      await new Promise<void>((resolve, reject) => {
        child.once('error', reject);
        child.once('spawn', () => {
          if (this.closed) { child.kill(); reject(new Error('restartUnavailable')); return; }
          operation.handedOff = true;
          child.unref();
          resolve();
        });
        child.once('exit', code => {
          if (this.current === operation) {
            this.current = null;
            if (!this.closed && code !== 0) this.error = 'restartFailed';
          }
        });
      });
      return { accepted: true };
    } catch (failure) {
      if (this.current === operation) this.current = null;
      if (errorMessage(failure) !== 'restartUnavailable') this.error = 'restartFailed';
      throw new Error(errorMessage(failure) === 'restartUnavailable' ? 'restartUnavailable' : 'restartFailed');
    }
  }

  close() {
    this.closed = true;
    this.windows?.close();
    // An accepted handoff must survive the application's normal Host teardown.
    if (this.current && !this.current.handedOff) this.current.handle?.kill();
  }
}
