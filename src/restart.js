import { spawn } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';

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

/** Only the packaged macOS desktop Host can hand off a graceful application restart. */
export class DesktopRestart {
  constructor(ctx, config, options = {}) {
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

  async status() {
    if (this.closed) throw new Error('restartUnavailable');
    const supported = Boolean(await this.target());
    if (this.closed) throw new Error('restartUnavailable');
    return { supported, running: this.current !== null, error: this.error };
  }

  async restart() {
    if (this.closed || this.config.showRestartButton.get() !== true) throw new Error('restartUnavailable');
    if (this.current) throw new Error('restartBusy');
    const operation = { handle: null, handedOff: false };
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
      await new Promise((resolve, reject) => {
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
      if (failure?.message !== 'restartUnavailable') this.error = 'restartFailed';
      throw new Error(failure?.message === 'restartUnavailable' ? 'restartUnavailable' : 'restartFailed');
    }
  }

  close() {
    this.closed = true;
    // An accepted handoff must survive the application's normal Host teardown.
    if (this.current && !this.current.handedOff) this.current.handle?.kill();
  }
}
