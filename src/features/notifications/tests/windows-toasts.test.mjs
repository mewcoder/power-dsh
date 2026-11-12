import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { WindowsToasts, windowsToastScript } from '../windows-toasts.ts';
import { parseWindowsNotification } from '../rpc.ts';

const request = (patch = {}) => ({
  group: 'pdclient', tag: 'task1', title: '任务已完成', body: 'Build the project',
  attention: false, preview: false, dismiss: '关闭', ...patch,
});
function payload(spec) {
  const script = Buffer.from(spec.argv.at(-1), 'base64').toString('utf16le');
  const match = script.match(/FromBase64String\('([A-Za-z0-9+/=]+)'\)/);
  assert.ok(match);
  return JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
}
function fixture({ platform = 'win32', service = true, resolve, playback, timeoutMs = 1000 } = {}) {
  let state = { notificationsEnabled: true, notificationSoundEnabled: true, notificationSound: 'default' };
  const config = Object.fromEntries(Object.keys(state).map(key => [key, { get: () => state[key] }]));
  const calls = [];
  const effects = [];
  const subprocess = {
    async resolveExecutable(name, _options, signal) {
      assert.equal(name, 'powershell.exe');
      if (resolve) await resolve(signal);
      signal.throwIfAborted();
      return 'powershell.exe';
    },
    spawn(spec) {
      calls.push(spec);
      return playback?.(spec) ?? {
        done: Promise.resolve({ exitCode: 0, signal: null }), terminate() {}, async waitForExit() { return true; },
      };
    },
  };
  const ctx = { effect(fn) { effects.push(fn()); }, get(name) { assert.equal(name, 'subprocess'); return service ? subprocess : undefined; } };
  const manager = new WindowsToasts(ctx, config, { platform, appId: 'com.deepseek.dsh', timeoutMs });
  return { manager, calls, effects, set(patch) { state = { ...state, ...patch }; } };
}

test('native Windows delivery uses managed non-detached PowerShell and a Unicode-safe WinRT command', async () => {
  const f = fixture();
  assert.deepEqual(await f.manager.show(request()), { shown: true });
  assert.equal(f.calls.length, 1);
  const spec = f.calls[0];
  assert.deepEqual(spec.argv.slice(0, -1), ['powershell.exe', '-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand']);
  for (const field of ['shell', 'detached', 'env']) assert.equal(Object.hasOwn(spec, field), false);
  assert.equal(spec.stdio.stdin, 'ignore');
  assert.equal(spec.stdio.stderr.maxBytes, 4096);
  const command = payload(spec);
  assert.equal(command.appId, 'com.deepseek.dsh');
  assert.equal(command.group, 'pdclient');
  assert.equal(command.tag, 'task1');
  assert.match(command.xml, /<text>任务已完成<\/text>/);
  assert.doesNotMatch(command.xml, /<audio|scenario=/);
  const script = Buffer.from(spec.argv.at(-1), 'base64').toString('utf16le');
  assert.match(script, /\$toast.SuppressPopup = \$false/);
  assert.match(script, /CreateToastNotifier\(\[string\]\$data.appId\)/);
  assert.match(script, /\$notifier.Setting.ToString\(\) -ne 'Enabled'/);
  assert.match(script, /\$notifier.Show\(\$toast\)/);
  await f.manager.close();
});

test('live sound preferences control native XML while attention notices request reminder behavior', async () => {
  const f = fixture();
  for (const patch of [
    { notificationSoundEnabled: false },
    { notificationSoundEnabled: true, notificationSound: 'win:SystemExclamation' },
  ]) {
    f.set(patch);
    await f.manager.show(request({ attention: true }));
    const { xml } = payload(f.calls.at(-1));
    assert.match(xml, /<audio silent="true"\/>/);
    assert.match(xml, /scenario="reminder" duration="long"/);
    assert.match(xml, /activationType="system" arguments="dismiss" content="关闭"/);
  }
  f.set({ notificationSoundEnabled: false });
  assert.deepEqual(await f.manager.show(request({ preview: true })), { shown: false });
  f.set({ notificationSoundEnabled: true, notificationSound: 'win:SystemExclamation' });
  assert.deepEqual(await f.manager.show(request({ preview: true })), { shown: false });
  f.set({ notificationSound: 'default' });
  assert.deepEqual(await f.manager.show(request({ preview: true })), { shown: true });
  assert.doesNotMatch(payload(f.calls.at(-1)).xml, /<audio|scenario=/);
  f.set({ notificationsEnabled: false });
  assert.deepEqual(await f.manager.show(request()), { shown: false });
  await f.manager.close();
});

test('notification text remains data across PowerShell and XML, including Chinese and shell-like content', async () => {
  const f = fixture();
  const body = `中文 <tag> & "quoted" 'single' $(exit 9); \` Unicode 🐟`;
  await f.manager.show(request({ body }));
  const command = payload(f.calls[0]);
  assert.match(command.xml, /中文 &lt;tag&gt; &amp; &quot;quoted&quot; &apos;single&apos;/);
  assert.ok(command.xml.includes('$(exit 9); ` Unicode 🐟'));
  const script = Buffer.from(f.calls[0].argv.at(-1), 'base64').toString('utf16le');
  assert.equal(script.includes(body), false);
  await f.manager.show(request({ body: '\uD800\uFFFE 🐟' }));
  assert.ok(payload(f.calls.at(-1)).xml.includes('<text>�� 🐟</text>'));
  for (const patch of [{ group: '../other' }, { tag: 'a'.repeat(17) }, { title: 'a'.repeat(81) },
    { body: 'a'.repeat(161) }, { body: 'nul\u0000' }, { attention: 1 }, { preview: 'yes' }, { dismiss: '' }]) {
    assert.throws(() => parseWindowsNotification(request(patch)), /Invalid Windows notification/);
  }
  await f.manager.close();
});

test('removing one native tag or group never clears the application-wide notification history', async () => {
  const f = fixture();
  await f.manager.show(request());
  await f.manager.show(request({ group: 'otherclient' }));
  assert.deepEqual(await f.manager.clear('pdclient', 'task1'), { cleared: true });
  assert.deepEqual(payload(f.calls.at(-1)), { appId: 'com.deepseek.dsh', group: 'pdclient', tag: 'task1' });
  await f.manager.clear('pdclient', '');
  assert.deepEqual(payload(f.calls.at(-1)), { appId: 'com.deepseek.dsh', group: 'pdclient', tag: '' });
  assert.equal(f.manager.groups.has('otherclient'), true);
  const script = Buffer.from(f.calls.at(-1).argv.at(-1), 'base64').toString('utf16le');
  assert.doesNotMatch(script, /History\.Clear|\.Clear\(/);
  assert.deepEqual(await f.manager.clear('unknown', ''), { cleared: false });
  await assert.rejects(f.manager.clear('bad/group', ''), /notificationFailed/);
  await f.manager.close();
  assert.deepEqual(payload(f.calls.at(-1)).groups, ['otherclient']);
});

test('disabling during executable resolution cancels the pending notification before spawn', async () => {
  const started = Promise.withResolvers();
  const resolved = Promise.withResolvers();
  const f = fixture({ resolve: () => { started.resolve(); return resolved.promise; } });
  const pending = f.manager.show(request());
  await started.promise;
  f.set({ notificationsEnabled: false });
  resolved.resolve();
  assert.deepEqual(await pending, { shown: false });
  assert.equal(f.calls.length, 0);
  await f.manager.close();
});

test('clearing pending work invalidates only the targeted session, preserving other sessions and later sends', async () => {
  const started = Promise.withResolvers();
  const resolved = Promise.withResolvers();
  const f = fixture({ resolve: () => { started.resolve(); return resolved.promise; } });
  const first = f.manager.show(request());
  await started.promise;
  const duplicate = f.manager.show(request());
  const other = f.manager.show(request({ tag: 'task2' }));
  const clear = f.manager.clear('pdclient', 'task1');
  const later = f.manager.show(request({ tag: 'task3' }));
  resolved.resolve();
  assert.deepEqual(await first, { shown: false });
  assert.deepEqual(await duplicate, { shown: false });
  assert.deepEqual(await other, { shown: true });
  await clear;
  assert.deepEqual(await later, { shown: true });
  assert.deepEqual(f.calls.map(spec => payload(spec).tag), ['task2', 'task1', 'task3']);
  await f.manager.close();
});

test('nonzero exits and timeouts report safe errors, terminate the helper, and do not poison later work', async () => {
  for (const timeout of [false, true]) {
    let terminated = 0;
    let runs = 0;
    const f = fixture({ timeoutMs: 20, playback: () => ++runs === 1 ? {
      done: timeout ? new Promise(() => {}) : Promise.resolve({ exitCode: 9, signal: null }),
      terminate() { terminated++; }, async waitForExit() { return true; },
    } : undefined });
    await assert.rejects(f.manager.show(request()), /^Error: notificationFailed$/);
    assert.ok(terminated >= 1);
    assert.deepEqual(await f.manager.show(request({ tag: 'next' })), { shown: true });
    await f.manager.close();
  }
});

test('unloading aborts the current helper, rejects queued sends and attempts only scoped cleanup', async () => {
  const started = Promise.withResolvers();
  let terminated = 0;
  let runs = 0;
  const f = fixture({ playback: () => {
    if (++runs !== 1) return;
    started.resolve();
    return { done: new Promise(() => {}), terminate() { terminated++; }, async waitForExit() { return true; } };
  } });
  const pending = assert.rejects(f.manager.show(request()), /notificationFailed/);
  await started.promise;
  const queued = assert.rejects(f.manager.show(request({ tag: 'queued' })), /unloaded/);
  await f.effects[0]();
  await Promise.all([pending, queued]);
  assert.ok(terminated >= 1);
  assert.equal(f.calls.length, 2);
  assert.deepEqual(payload(f.calls[1]).groups, ['pdclient']);
  await assert.rejects(f.manager.show(request({ tag: 'late' })), /unloaded/);
});

test('unsupported platforms or missing subprocess never silently route back to renderer notifications', async () => {
  for (const options of [{ platform: 'darwin' }, { service: false }]) {
    const f = fixture(options);
    await assert.rejects(f.manager.show(request()), /notificationUnsupported/);
    assert.equal(f.calls.length, 0);
    await f.manager.close();
  }
});

test('Windows PowerShell parses the exact helper and .NET accepts its XML without showing a toast', { skip: process.platform !== 'win32' }, () => {
  const command = { appId: 'com.deepseek.dsh', group: 'pdtest', tag: 'one',
    xml: '<toast scenario="reminder" duration="long"><visual><binding template="ToastGeneric"><text>中文 &amp; 🐟</text></binding></visual><audio silent="true"/><actions><action activationType="system" arguments="dismiss" content="关闭"/></actions></toast>' };
  const script = Buffer.from(windowsToastScript(command), 'utf8').toString('base64');
  const parser = `$ErrorActionPreference='Stop'; $script=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${script}')); $tokens=$null; $errors=$null; $null=[System.Management.Automation.Language.Parser]::ParseInput($script,[ref]$tokens,[ref]$errors); if ($errors.Count) { exit 1 }; $data=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(JSON.stringify(command)).toString('base64')}')) | ConvertFrom-Json; $xml=New-Object System.Xml.XmlDocument; $xml.LoadXml([string]$data.xml)`;
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand',
    Buffer.from(parser, 'utf16le').toString('base64')], { windowsHide: true, encoding: 'utf8', timeout: 15_000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});
