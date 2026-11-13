import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rename, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { RestartStatus, RestartAccepted } from './rpc.ts';

export interface WindowsRestartOptions {
  executable: string;
  env: NodeJS.ProcessEnv;
  hostPid?: number;
  run?: (script: string, signal: AbortSignal) => Promise<string>;
  handoffMs?: number;
}
interface Target { executable: string; mainPid: number; mainStart: string; hostPid: number; hostStart: string }
interface Operation { directory: string; nonce: string; committed: boolean; expiresAt: number }

export const WINDOWS_RESTART_IDENTITY = String.raw`
function Read-Process([int]$processId) {
  return Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $processId) -ErrorAction Stop
}
function Start-Stamp($process) {
  return ([datetime]$process.CreationDate).ToUniversalTime().Ticks.ToString()
}
function Matches-Process($process, [string]$executable, [string]$stamp) {
  return $null -ne $process -and [string]$process.ExecutablePath -ieq $executable -and (Start-Stamp $process) -eq $stamp
}
function Read-Product([string]$executable) {
  return [Diagnostics.FileVersionInfo]::GetVersionInfo($executable).ProductName
}
function Resolve-Target([string]$executable, [int]$hostPid) {
  if ([IO.Path]::GetFileName($executable) -ine 'DeepSeek Harness.exe') { throw 'identity' }
  if ((Read-Product $executable) -ne 'DeepSeek Harness') { throw 'identity' }
  $hostProcess = Read-Process $hostPid
  if ($null -eq $hostProcess -or [string]$hostProcess.ExecutablePath -ine $executable) { throw 'identity' }
  $main = $hostProcess
  $seen = @{}
  for ($step = 0; $step -lt 32; $step++) {
    if ($seen.ContainsKey([int]$main.ProcessId)) { throw 'identity' }
    $seen[[int]$main.ProcessId] = $true
    $parent = Read-Process ([int]$main.ParentProcessId)
    if ($null -eq $parent -or [string]$parent.ExecutablePath -ine $executable) { break }
    if ([datetime]$parent.CreationDate -gt [datetime]$main.CreationDate) { throw 'identity' }
    $main = $parent
  }
  if ($step -ge 32 -or $main.ProcessId -eq $hostPid -or [string]::IsNullOrWhiteSpace([string]$main.CommandLine) -or
    [string]$main.CommandLine -match '(?i)(?:^|\s)--(?:type|utility-sub-type|run-as-node)(?:[=\s]|$)') { throw 'identity' }
  return @{ executable = $executable; mainPid = [int]$main.ProcessId; mainStart = (Start-Stamp $main)
    hostPid = $hostPid; hostStart = (Start-Stamp $hostProcess) }
}`;

export const WINDOWS_RESTART_OPEN = String.raw`
function Open-Application([string]$directory, [string]$executable) {
  $shell = New-Object -ComObject WScript.Shell
  $shortcutPath = [IO.Path]::Combine($directory, 'application.lnk')
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $executable
  $shortcut.WorkingDirectory = [IO.Path]::GetDirectoryName($executable)
  $shortcut.WindowStyle = 1
  $shortcut.Save()
  Start-Process -FilePath ([IO.Path]::Combine($env:SystemRoot, 'explorer.exe')) -ArgumentList ('"' + $shortcutPath + '"') | Out-Null
}`;

export const WINDOWS_RESTART_HELPER = String.raw`param([Parameter(Mandatory = $true)][string]$Directory)
$ErrorActionPreference = 'Stop'
${WINDOWS_RESTART_IDENTITY}
${WINDOWS_RESTART_OPEN}
$env:ELECTRON_RUN_AS_NODE = $null
$env:NODE_OPTIONS = $null
$env:NODE_PATH = $null
$request = $null
function Publish-State([string]$phase) {
  $text = @{ nonce = [string]$request.nonce; phase = $phase } | ConvertTo-Json -Compress
  $temporary = [IO.Path]::Combine($Directory, 'state.next')
  [IO.File]::WriteAllText($temporary, $text, (New-Object Text.UTF8Encoding($false)))
  Move-Item -LiteralPath $temporary -Destination ([IO.Path]::Combine($Directory, 'state.json')) -Force
}
function Require-Time {
  if ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge [long]$request.expiresAt) { throw 'timeout' }
}
try {
  $request = Get-Content -LiteralPath ([IO.Path]::Combine($Directory, 'request.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
  $target = $request.target
  $helper = Read-Process $PID
  $ancestor = $helper
  for ($step = 0; $step -lt 64; $step++) {
    if ($null -eq $ancestor) { break }
    if ([int]$ancestor.ProcessId -eq [int]$target.mainPid -or [int]$ancestor.ProcessId -eq [int]$target.hostPid) { throw 'handoff' }
    $parent = Read-Process ([int]$ancestor.ParentProcessId)
    if ($null -eq $parent -or [datetime]$parent.CreationDate -gt [datetime]$ancestor.CreationDate) { break }
    $ancestor = $parent
  }
  if ($step -ge 64) { throw 'handoff' }
  Publish-State 'ready'
  $deadline = [DateTime]::UtcNow.AddSeconds(12)
  $approved = $false
  while ([DateTime]::UtcNow -lt $deadline) {
    $approval = [IO.Path]::Combine($Directory, 'commit')
    if (Test-Path -LiteralPath $approval) {
      $approved = [IO.File]::ReadAllText($approval) -ceq [string]$request.nonce
      break
    }
    Start-Sleep -Milliseconds 100
  }
  if (-not $approved) { throw 'handoff' }
  Require-Time
  $resolved = Resolve-Target ([string]$target.executable) ([int]$target.hostPid)
  if ($resolved.mainPid -ne $target.mainPid -or $resolved.mainStart -cne $target.mainStart -or
    $resolved.hostStart -cne $target.hostStart) { throw 'identity' }
  $oldMain = [Diagnostics.Process]::GetProcessById([int]$target.mainPid)
  $null = $oldMain.Handle
  if ([Math]::Abs([decimal]$oldMain.StartTime.ToUniversalTime().Ticks - [decimal]$target.mainStart) -gt 10) { throw 'identity' }
  $tree = @{}
  $queue = New-Object 'Collections.Generic.Queue[int]'
  $queue.Enqueue([int]$target.mainPid)
  while ($queue.Count -gt 0) {
    if ($tree.Count -ge 512) { throw 'identity' }
    $parentId = $queue.Dequeue()
    if ($tree.ContainsKey($parentId)) { throw 'identity' }
    $process = Read-Process $parentId
    if ($null -eq $process) { continue }
    $tree[$parentId] = Start-Stamp $process
    foreach ($child in @(Get-CimInstance Win32_Process -Filter ('ParentProcessId = ' + $parentId))) {
      if ([datetime]$child.CreationDate -ge [datetime]$process.CreationDate) { $queue.Enqueue([int]$child.ProcessId) }
    }
  }
  if (-not (Matches-Process (Read-Process ([int]$target.mainPid)) ([string]$target.executable) ([string]$target.mainStart))) { throw 'identity' }
  Require-Time
  Publish-State 'stopping'
  & ([IO.Path]::Combine($env:SystemRoot, 'System32', 'taskkill.exe')) /PID ([string]$target.mainPid) /T /F 2>$null | Out-Null
  if (-not $oldMain.WaitForExit(20000)) { throw 'timeout' }
  $deadline = [DateTime]::UtcNow.AddSeconds(10)
  do {
    $alive = $false
    foreach ($processId in @($tree.Keys)) {
      $process = Read-Process $processId
      if ($null -ne $process -and (Start-Stamp $process) -ceq $tree[$processId]) { $alive = $true; break }
    }
    if (-not $alive) { break }
    Start-Sleep -Milliseconds 100
  } while ([DateTime]::UtcNow -lt $deadline)
  if ($alive) { throw 'timeout' }
  Publish-State 'opening'
  Require-Time
  Open-Application $Directory ([string]$target.executable)
  $deadline = [DateTime]::UtcNow.AddSeconds(25)
  while ([DateTime]::UtcNow -lt $deadline) {
    $processes = @(Get-CimInstance Win32_Process -Filter "Name = 'DeepSeek Harness.exe'")
    foreach ($candidate in $processes) {
      if ([string]$candidate.ExecutablePath -ieq [string]$target.executable -and
        [bigint](Start-Stamp $candidate) -gt [bigint]$target.mainStart -and
        [string]$candidate.CommandLine -notmatch '(?i)(?:^|\s)--type(?:[=\s]|$)') {
        Publish-State 'opened'
        return
      }
    }
    Start-Sleep -Milliseconds 250
  }
  throw 'opening'
} catch {
  if ($null -ne $request) { try { Publish-State 'failed' } catch {} }
} finally {
  Remove-Item -LiteralPath $Directory -Recurse -Force -ErrorAction SilentlyContinue
}
`;

function payloadScript(value: unknown) {
  return `$data = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(JSON.stringify(value)).toString('base64')}')) | ConvertFrom-Json\n`;
}

export function windowsTargetScript(executable: string, hostPid: number) {
  return `$ErrorActionPreference = 'Stop'\n[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)\n${WINDOWS_RESTART_IDENTITY}\n${payloadScript({ executable, hostPid })}
Resolve-Target ([string]$data.executable) ([int]$data.hostPid) | ConvertTo-Json -Compress`;
}

export function windowsDispatchScript(directory: string, powershell: string) {
  return `$ErrorActionPreference = 'Stop'\n${payloadScript({ directory, powershell })}
$shell = New-Object -ComObject WScript.Shell
$shortcutPath = [IO.Path]::Combine([string]$data.directory, 'helper.lnk')
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = [string]$data.powershell
$scriptPath = [IO.Path]::Combine([string]$data.directory, 'helper.ps1')
$shortcut.Arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $scriptPath + '" -Directory "' + [string]$data.directory + '"'
$shortcut.WorkingDirectory = $env:SystemRoot
$shortcut.WindowStyle = 7
$shortcut.Save()
Start-Process -FilePath ([IO.Path]::Combine($env:SystemRoot, 'explorer.exe')) -ArgumentList ('"' + $shortcutPath + '"')`;
}

export class WindowsRestart {
  config: LivePreferences;
  options: WindowsRestartOptions;
  controller = new AbortController();
  current: Operation | null = null;
  pending = false;
  error: RestartStatus['error'] = '';
  closed = false;
  availability = { supported: false, expiresAt: 0 };
  constructor(config: LivePreferences, options: WindowsRestartOptions) { this.config = config; this.options = options; }

  powershell() {
    const root = this.options.env.SystemRoot;
    if (!root || !path.win32.isAbsolute(root) || /[\u0000-\u001f"]/.test(root)) throw new Error('restartUnavailable');
    return path.win32.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  }
  async run(script: string) {
    this.controller.signal.throwIfAborted();
    if (this.options.run) return this.options.run(script, this.controller.signal);
    const env = { ...this.options.env };
    for (const key of Object.keys(env)) if (['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'NODE_PATH'].includes(key.toUpperCase())) delete env[key];
    return new Promise<string>((resolve, reject) => {
      execFile(this.powershell(), ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
        { windowsHide: true, timeout: 10_000, maxBuffer: 8192, encoding: 'utf8', env, signal: this.controller.signal },
        (error, stdout) => error ? reject(new Error('restartUnavailable')) : resolve(stdout.replace(/^\uFEFF/, '').trim()));
    });
  }
  async target(): Promise<Target | null> {
    if (this.closed || !this.options.env.DSH_CLIENT_VERSION || !path.win32.isAbsolute(this.options.executable)
      || path.win32.basename(this.options.executable).toLowerCase() !== 'deepseek harness.exe') return null;
    try {
      this.powershell();
      const value: unknown = JSON.parse(await this.run(windowsTargetScript(this.options.executable, this.options.hostPid ?? process.pid)));
      if (!value || typeof value !== 'object') return null;
      const target = value as Partial<Target>;
      if (target.executable?.toLowerCase() !== this.options.executable.toLowerCase()
        || !Number.isSafeInteger(target.mainPid) || target.mainPid! <= 0 || target.mainPid === target.hostPid
        || target.hostPid !== (this.options.hostPid ?? process.pid)
        || !/^\d{15,20}$/.test(target.mainStart ?? '') || !/^\d{15,20}$/.test(target.hostStart ?? '')) return null;
      return target as Target;
    } catch { return null; }
  }
  async state(operation: Operation) {
    try {
      const value: unknown = JSON.parse(await readFile(path.join(operation.directory, 'state.json'), 'utf8'));
      if (value && typeof value === 'object' && 'nonce' in value && value.nonce === operation.nonce
        && 'phase' in value && typeof value.phase === 'string') return value.phase;
    } catch {}
    return '';
  }
  async status(): Promise<RestartStatus> {
    if (this.closed) throw new Error('restartUnavailable');
    const operation = this.current;
    if (operation?.committed) {
      const phase = await this.state(operation);
      let removed = false;
      if (phase === '') {
        try { await access(operation.directory); }
        catch (error) { removed = !!error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'; }
      }
      if (this.current === operation && (phase === 'failed' || phase === 'opened' || removed || Date.now() >= operation.expiresAt)) {
        this.error = 'restartFailed';
        this.current = null;
        await rm(operation.directory, { recursive: true, force: true }).catch(() => {});
      }
    }
    if (Date.now() >= this.availability.expiresAt) {
      this.availability = { supported: Boolean(await this.target()), expiresAt: Date.now() + 30_000 };
    }
    if (this.closed) throw new Error('restartUnavailable');
    return { supported: this.availability.supported, running: this.pending || this.current !== null, error: this.error };
  }
  async restart(afterUpdate = false): Promise<RestartAccepted> {
    const allowed = () => afterUpdate || this.config.showRestartButton.get() === true;
    if (this.closed || !allowed()) throw new Error('restartUnavailable');
    if (this.pending || this.current) throw new Error('restartBusy');
    this.pending = true;
    this.error = '';
    let operation: Operation | undefined;
    try {
      const target = await this.target();
      if (!target || this.closed || !allowed()) throw new Error('restartUnavailable');
      operation = { directory: await mkdtemp(path.join(tmpdir(), 'power-dsh-restart-')), nonce: randomUUID(), committed: false, expiresAt: Date.now() + 90_000 };
      this.current = operation;
      await writeFile(path.join(operation.directory, 'request.json'), JSON.stringify({ target, nonce: operation.nonce, expiresAt: operation.expiresAt }), { mode: 0o600 });
      await writeFile(path.join(operation.directory, 'helper.ps1'), WINDOWS_RESTART_HELPER, { mode: 0o600 });
      if (this.closed || !allowed()) throw new Error('restartUnavailable');
      await this.run(windowsDispatchScript(operation.directory, this.powershell()));
      const deadline = Date.now() + (this.options.handoffMs ?? 8000);
      while (Date.now() < deadline) {
        if (this.closed || !allowed()) throw new Error('restartUnavailable');
        const phase = await this.state(operation);
        if (phase === 'failed') throw new Error('restartFailed');
        if (phase === 'ready') {
          await writeFile(path.join(operation.directory, 'commit.next'), operation.nonce, { mode: 0o600 });
          if (this.closed || !allowed()) throw new Error('restartUnavailable');
          await rename(path.join(operation.directory, 'commit.next'), path.join(operation.directory, 'commit'));
          operation.committed = true;
          return { accepted: true };
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error('restartFailed');
    } catch (error) {
      if (operation && !operation.committed) await rm(operation.directory, { recursive: true, force: true }).catch(() => {});
      this.current = null;
      const unavailable = error instanceof Error && error.message === 'restartUnavailable';
      if (!unavailable) this.error = 'restartFailed';
      throw new Error(unavailable ? 'restartUnavailable' : 'restartFailed');
    } finally { this.pending = false; }
  }
  close() {
    this.closed = true;
    this.controller.abort();
  }
}
