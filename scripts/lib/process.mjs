import assert from 'node:assert/strict';
import { access, realpath } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Use npm's JS entry with the current Node. A pnpm-run script has a different
// npm_execpath, and Windows npm.cmd cannot be spawned as a native executable.
async function findNpmCli() {
  const candidates = [];
  const caller = process.env.npm_execpath;
  if (caller && /^npm(?:-cli)?\.js$/.test(path.basename(caller))) candidates.push(caller);
  for (const directory of [path.dirname(process.execPath), ...(process.env.PATH ?? '').split(path.delimiter).filter(Boolean)]) {
    const command = path.join(directory, process.platform === 'win32' ? 'npm.cmd' : 'npm');
    try {
      const target = await realpath(command);
      if (/^npm(?:-cli)?\.js$/.test(path.basename(target))) candidates.push(target);
    } catch { /* Try the adjacent Node/npm installation next. */ }
    candidates.push(path.join(directory, 'node_modules/npm/bin/npm-cli.js'));
  }
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch { /* Try the next installation. */ }
  }
  throw new Error('npm CLI not found. Run this check using a Node installation that includes npm.');
}

const npmCli = await findNpmCli();
export const npmInvocation = args => ({ command: process.execPath, args: [npmCli, ...args] });

export function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} failed (${result.signal ?? result.status})\n${result.stdout}${result.stderr}`);
  return result.stdout;
}

export function runNpm(args, cwd) {
  const invocation = npmInvocation(args);
  return run(invocation.command, invocation.args, cwd);
}
