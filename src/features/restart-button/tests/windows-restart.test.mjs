import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, writeFile, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { WindowsRestart, WINDOWS_RESTART_HELPER, WINDOWS_RESTART_IDENTITY, WINDOWS_RESTART_OPEN, windowsTargetScript, windowsDispatchScript } from '../windows-restart.ts';

const powershell = process.platform === 'win32' ? 'powershell.exe' : process.env.POWER_DSH_TEST_POWERSHELL;
const target = { executable: 'C:\\Apps\\DeepSeek Harness.exe', mainPid: 123, hostPid: 456,
  mainStart: '20261112080000123', hostStart: '20261112080001123' };
function payload(script) {
  return JSON.parse(Buffer.from(script.match(/FromBase64String\('([^']+)'\)/)[1], 'base64').toString('utf8'));
}
function fixture({ result = target, dispatch, timeout = 30, env, executable } = {}) {
  let enabled = true;
  const calls = [];
  const directories = [];
  const service = new WindowsRestart({ showRestartButton: { get: () => enabled } }, {
    executable: executable ?? target.executable, env: env ?? { DSH_CLIENT_VERSION: 'test', SystemRoot: 'C:\\Windows' },
    hostPid: target.hostPid, handoffMs: timeout,
    async run(script, signal) {
      calls.push({ script, signal });
      if (!script.includes('CreateShortcut')) return JSON.stringify(result);
      const { directory } = payload(script);
      directories.push(directory);
      const request = JSON.parse(await readFile(path.join(directory, 'request.json'), 'utf8'));
      assert.equal(await readFile(path.join(directory, 'helper.ps1'), 'utf8'), WINDOWS_RESTART_HELPER);
      if (dispatch) await dispatch({ directory, request, signal });
      else await writeFile(path.join(directory, 'state.json'), JSON.stringify({ nonce: request.nonce, phase: 'ready' }));
      return '';
    },
  });
  return { service, calls, directories, disable() { enabled = false; }, async cleanup() {
    service.close();
    for (const directory of directories) await rm(directory, { recursive: true, force: true });
  } };
}

test('Windows probes do not start a helper and reject unverifiable desktop identity', async () => {
  for (const options of [{ env: {} }, { executable: 'C:\\node.exe' }, { env: { DSH_CLIENT_VERSION: 'test' } },
    { result: { ...target, mainPid: target.hostPid } }, { result: { ...target, executable: 'C:\\Other.exe' } },
    { result: { ...target, hostPid: 999 } }, { result: { ...target, mainStart: 'invalid' } }]) {
    const f = fixture(options);
    assert.equal((await f.service.status()).supported, false);
    await assert.rejects(f.service.restart(), /restartUnavailable/);
    assert.equal(f.directories.length, 0);
    await f.cleanup();
  }
  const f = fixture();
  assert.equal((await f.service.status()).supported, true);
  assert.equal(f.directories.length, 0);
  await f.cleanup();
});

test('Windows only commits after the matching external helper is ready and preserves accepted handoff on unload', async () => {
  const f = fixture();
  try {
    assert.deepEqual(await f.service.restart(), { accepted: true });
    const directory = f.directories[0];
    const request = JSON.parse(await readFile(path.join(directory, 'request.json'), 'utf8'));
    assert.deepEqual(request.target, target);
    assert.equal(await readFile(path.join(directory, 'commit'), 'utf8'), request.nonce);
    assert.equal((await f.service.status()).running, true);
    await assert.rejects(f.service.restart(), /restartBusy/);
    f.service.close();
    assert.equal(await readFile(path.join(directory, 'commit'), 'utf8'), request.nonce);
    await assert.rejects(f.service.restart(), /restartUnavailable/);
  } finally { await f.cleanup(); }
});

test('failed, missing or mismatched helper readiness never commits, cleans files, and permits retry', async () => {
  for (const phase of ['failed', 'missing', 'wrong-nonce']) {
    const f = fixture({ dispatch: async ({ directory, request }) => {
      if (phase !== 'missing') await writeFile(path.join(directory, 'state.json'), JSON.stringify({
        nonce: phase === 'wrong-nonce' ? 'other' : request.nonce, phase: phase === 'failed' ? 'failed' : 'ready',
      }));
    } });
    await assert.rejects(f.service.restart(), /restartFailed/);
    for (const directory of f.directories) await assert.rejects(access(directory));
    assert.equal((await f.service.status()).running, false);
    await assert.rejects(f.service.restart(), /restartFailed/);
    await f.cleanup();
  }
});

test('disabling or unloading while dispatching cannot authorize a late helper', async () => {
  for (const action of ['disable', 'close']) {
    const started = Promise.withResolvers();
    const proceed = Promise.withResolvers();
    const f = fixture({ dispatch: async ({ directory, request }) => {
      started.resolve();
      await proceed.promise;
      await writeFile(path.join(directory, 'state.json'), JSON.stringify({ nonce: request.nonce, phase: 'ready' }));
    } });
    const pending = f.service.restart();
    await started.promise;
    await assert.rejects(f.service.restart(), /restartBusy/);
    if (action === 'close') f.service.close(); else f.disable();
    proceed.resolve();
    await assert.rejects(pending, /restartUnavailable/);
    await assert.rejects(access(f.directories[0]));
    await f.cleanup();
  }
});

test('helper failure after handoff reports failure without another launch or a false success', async () => {
  const f = fixture();
  await f.service.restart();
  const operation = f.service.current;
  await writeFile(path.join(operation.directory, 'state.json'), JSON.stringify({ nonce: operation.nonce, phase: 'failed' }));
  assert.deepEqual(await f.service.status(), { supported: true, running: false, error: 'restartFailed' });
  assert.equal(f.directories.length, 1);
  await f.cleanup();
});

test('a transient missing state keeps the operation locked, but helper expiry permits a safe retry', async () => {
  const f = fixture();
  await f.service.restart();
  const operation = f.service.current;
  await rm(path.join(operation.directory, 'state.json'));
  assert.equal((await f.service.status()).running, true);
  await assert.rejects(f.service.restart(), /restartBusy/);
  operation.expiresAt = Date.now() - 1;
  assert.deepEqual(await f.service.status(), { supported: true, running: false, error: 'restartFailed' });
  await f.cleanup();
});

test('PowerShell parses all Windows restart scripts without launching or killing anything', { skip: !powershell }, () => {
  for (const source of [WINDOWS_RESTART_HELPER, windowsTargetScript(target.executable, target.hostPid),
    windowsDispatchScript('C:\\Users\\中文 name\\Temp\\quote\'s', 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')]) {
    const encoded = Buffer.from(source).toString('base64');
    const parser = `$source=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')); $tokens=$null; $errors=$null; $null=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors); if($errors.Count){$errors | ForEach-Object { [Console]::Error.WriteLine($_.Message) }; exit 1}`;
    const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(parser, 'utf16le').toString('base64')],
      { encoding: 'utf8', timeout: 15000, windowsHide: true });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
  }
});

test('Windows reopens the verified application through Explorer without inheriting the helper console or falling back to a direct launch', { skip: !powershell }, () => {
  const directory = path.join(path.parse(process.cwd()).root, "restart test's 中文");
  const executable = path.join(directory, 'app', 'DeepSeek Harness.exe');
  const systemRoot = path.join(directory, 'Windows');
  const data = Buffer.from(JSON.stringify({ directory, executable, systemRoot,
    shortcut: path.join(directory, 'application.lnk'), workingDirectory: path.dirname(executable), explorer: path.join(systemRoot, 'explorer.exe') })).toString('base64');
  const script = `$ErrorActionPreference = 'Stop'\n${WINDOWS_RESTART_OPEN}\n` + String.raw`
$data = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('` + data + String.raw`')) | ConvertFrom-Json
$env:SystemRoot = $data.systemRoot
$script:calls = @()
$script:saved = $false
$script:failSave = $false
$script:failLaunch = $false
$script:shortcut = [pscustomobject]@{ TargetPath = ''; WorkingDirectory = ''; WindowStyle = 0 }
$script:shortcut | Add-Member -MemberType ScriptMethod -Name Save -Value {
  if ($script:failSave) { throw 'shortcut failed' }
  $script:saved = $true
}
$script:shell = [pscustomobject]@{}
$script:shell | Add-Member -MemberType ScriptMethod -Name CreateShortcut -Value {
  param([string]$shortcutPath)
  if ($shortcutPath -cne $data.shortcut) { throw 'incorrect shortcut path' }
  return $script:shortcut
}
function New-Object([string]$ComObject) {
  if ($ComObject -cne 'WScript.Shell') { throw 'unexpected COM object' }
  return $script:shell
}
function Start-Process([string]$FilePath, [string]$ArgumentList) {
  if (-not $script:saved) { throw 'shortcut was not saved' }
  $script:calls += @{ path = $FilePath; arguments = $ArgumentList }
  if ($script:failLaunch) { throw 'shell failed' }
}
Open-Application $data.directory $data.executable
if ($script:shortcut.TargetPath -cne $data.executable -or $script:shortcut.WorkingDirectory -cne $data.workingDirectory -or
  $script:shortcut.WindowStyle -ne 1) { throw 'application shortcut changed identity or hid the application' }
if ($script:calls.Count -ne 1 -or $script:calls[0].path -cne $data.explorer -or
  $script:calls[0].arguments -cne ('"' + $data.shortcut + '"')) { throw 'application did not use one quoted Explorer launch' }
foreach ($failure in @('save', 'launch')) {
  $script:calls = @()
  $script:saved = $false
  $script:failSave = $failure -eq 'save'
  $script:failLaunch = $failure -eq 'launch'
  $rejected = $false
  try { Open-Application $data.directory $data.executable } catch { $rejected = $true }
  if (-not $rejected) { throw 'failed relaunch was accepted' }
  $expectedCalls = if ($failure -eq 'save') { 0 } else { 1 }
  if ($script:calls.Count -ne $expectedCalls) { throw 'failed relaunch retried or started the application directly' }
}
`;
  const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { encoding: 'utf8', timeout: 15000, windowsHide: true });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

test('PowerShell identity validation binds the actual ancestry, path and creation time instead of matching an application name', { skip: !powershell }, () => {
  const script = `$ErrorActionPreference = 'Stop'\n${WINDOWS_RESTART_IDENTITY}\n` + String.raw`
function Read-Product([string]$executable) { return $script:product }
function Read-Process([int]$processId) { return $script:rows[$processId] }
$script:product = 'DeepSeek Harness'
$exe = '/apps/DeepSeek Harness.exe'
$created = [datetime]'2026-11-12T08:00:00Z'
function Reset-Rows {
  $script:rows = @{
    456 = [pscustomobject]@{ProcessId=456; ParentProcessId=123; ExecutablePath=$exe; CreationDate=$created.AddSeconds(1); CommandLine='host'}
    123 = [pscustomobject]@{ProcessId=123; ParentProcessId=99; ExecutablePath=$exe; CreationDate=$created; CommandLine='"/apps/DeepSeek Harness.exe"'}
    99 = [pscustomobject]@{ProcessId=99; ParentProcessId=0; ExecutablePath='/explorer.exe'; CreationDate=$created.AddSeconds(-1); CommandLine='explorer'}
  }
}
function Expect-Rejection {
  $rejected = $false
  try { $null = Resolve-Target $exe 456 } catch { $rejected = $true }
  if (-not $rejected) { throw 'Accepted unrelated or reused process' }
}
Reset-Rows
$target = Resolve-Target $exe 456
if ($target.mainPid -ne 123 -or $target.hostPid -ne 456) { throw 'Incorrect ancestor' }
if (-not (Matches-Process $script:rows[123] $exe $target.mainStart)) { throw 'Creation identity mismatch' }
$script:rows[123].CreationDate = $created.AddSeconds(2)
if (Matches-Process $script:rows[123] $exe $target.mainStart) { throw 'Accepted reused PID' }
Expect-Rejection
Reset-Rows
$script:rows[123].ExecutablePath = '/other/DeepSeek Harness.exe'
Expect-Rejection
Reset-Rows
$script:rows[123].CommandLine = 'app --type=utility'
Expect-Rejection
Reset-Rows
$script:rows[123].ParentProcessId = 456
Expect-Rejection
Reset-Rows
$script:rows[456].ExecutablePath = '/other/DeepSeek Harness.exe'
Expect-Rejection
Reset-Rows
$script:product = 'Unrelated product'
Expect-Rejection
`;
  const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { encoding: 'utf8', timeout: 15000, windowsHide: true });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});
