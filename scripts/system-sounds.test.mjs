import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SystemSounds } from '../system-sounds.js';

function fixture({ platform = 'darwin', service = true, playback, resolve, timeoutMs = 1000, io = {} } = {}) {
  const effects = [];
  const calls = [];
  const resolved = [];
  let state = { notificationsEnabled: true, notificationSoundEnabled: true, notificationSound: 'mac:Ping.aiff' };
  const config = Object.fromEntries(Object.keys(state).map(key => [key, { get: () => state[key] }]));
  const subprocess = {
    async resolveExecutable(program, env, signal) {
      resolved.push({ program, env, signal });
      if (resolve) await resolve();
      signal.throwIfAborted();
      return program === 'powershell.exe' ? 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' : program;
    },
    spawn(spec) {
      calls.push(spec);
      if (playback) return playback(spec);
      return { done: Promise.resolve({ exitCode: 0, signal: null }), terminate() {}, async waitForExit() { return true; } };
    },
  };
  const ctx = { get(name) { assert.equal(name, 'subprocess'); return service ? subprocess : undefined; }, effect(fn) { effects.push(fn()); } };
  const manager = new SystemSounds(ctx, config, {
    platform, timeoutMs,
    readDirectory: async () => [{ name: 'Ping.aiff', isFile: () => true }, { name: 'Glass.aiff', isFile: () => true }],
    fileInfo: async () => ({ isFile: () => true }),
    realPath: async file => file,
    ...io,
  });
  return { manager, effects, calls, resolved, set(patch) { state = { ...state, ...patch }; } };
}

test('real macOS enumeration includes actual built-in alert sounds without playing any audio', { skip: process.platform !== 'darwin' }, async () => {
  const ctx = { get: () => ({}), effect: () => {} };
  const manager = new SystemSounds(ctx, {});
  const result = await manager.list();
  assert.equal(result.platform, 'darwin');
  assert.equal(result.sounds[0].id, 'default');
  assert.ok(result.sounds.some(sound => sound.id === 'mac:Ping.aiff' && sound.name === 'Ping'));
  assert.ok(result.sounds.every(sound => Object.keys(sound).sort().join(',') === 'id,name'));
  await manager.close();
});

test('unsupported platforms and missing native service offer only the browser-owned default', async () => {
  for (const options of [{ platform: 'linux' }, { service: false }]) {
    const f = fixture(options);
    assert.deepEqual(await f.manager.list(), { platform: 'other', sounds: [{ id: 'default', name: 'default' }] });
    assert.deepEqual(await f.manager.play('default', true), { played: false });
    await assert.rejects(f.manager.play('mac:Ping.aiff', true), /notificationSoundUnavailable/);
    assert.equal(f.calls.length, 0);
  }
});

test('macOS sound choices exclude directories, symlinks, non-audio files and paths outside the system directory', async () => {
  const entry = (name, regular = true) => ({ name, isFile: () => regular });
  const f = fixture({ io: {
    readDirectory: async () => [entry('Ping.aiff'), entry('Glass.aiff'), entry('directory.aiff', false),
      entry('link.aiff'), entry('outside.aiff'), entry('readme.txt'), entry('../escape.aiff'), entry('.hidden.aiff')],
    fileInfo: async file => ({ isFile: () => !file.endsWith('/link.aiff') }),
    realPath: async file => file.endsWith('/outside.aiff') ? '/tmp/outside.aiff' : file,
  } });
  assert.deepEqual(await f.manager.list(), { platform: 'darwin', sounds: [
    { id: 'default', name: 'default' }, { id: 'mac:Glass.aiff', name: 'Glass' }, { id: 'mac:Ping.aiff', name: 'Ping' },
  ] });
  for (const id of ['mac:../escape.aiff', 'mac:/tmp/outside.aiff', 'mac:link.aiff', 'mac:outside.aiff', 'mac:readme.txt']) {
    await assert.rejects(f.manager.play(id, true), /notificationSoundInvalid/);
  }
  assert.equal(f.calls.length, 0);
});

test('macOS playback uses exact native argv with bounded collectors and the actual subprocess lifecycle', async () => {
  const f = fixture();
  assert.deepEqual(await f.manager.play('mac:Ping.aiff'), { played: true });
  assert.deepEqual(f.calls[0].argv, ['/usr/bin/afplay', '/System/Library/Sounds/Ping.aiff']);
  assert.deepEqual(f.calls[0].stdio, { stdin: 'ignore', stdout: { maxBytes: 1024 }, stderr: { maxBytes: 4096 } });
  assert.equal(f.calls[0].graceMs, 250);
  assert.ok(f.calls[0].signal instanceof AbortSignal);
  assert.equal(f.calls[0].cwd, process.cwd());
  assert.equal(Object.hasOwn(f.calls[0], 'shell'), false);
  assert.equal(Object.hasOwn(f.calls[0], 'env'), false);
});

test('automatic playback obeys live toggles and selection, while explicit preview can play an unselected built-in sound', async () => {
  const f = fixture();
  for (const patch of [{ notificationsEnabled: false }, { notificationsEnabled: true, notificationSoundEnabled: false },
    { notificationSoundEnabled: true, notificationSound: 'mac:Glass.aiff' }]) {
    f.set(patch);
    assert.deepEqual(await f.manager.play('mac:Ping.aiff'), { played: false });
  }
  assert.equal(f.calls.length, 0);
  assert.deepEqual(await f.manager.play('mac:Ping.aiff', true), { played: true });
  assert.deepEqual(await f.manager.play('default', false), { played: false });
  assert.deepEqual(await f.manager.play('default', true), { played: false });
  assert.equal(f.calls.length, 1);
});

test('a preference changed during executable lookup prevents a late automatic playback', async () => {
  const ready = Promise.withResolvers();
  const entered = Promise.withResolvers();
  const f = fixture({ resolve: async () => { entered.resolve(); await ready.promise; } });
  const operation = f.manager.play('mac:Ping.aiff');
  await entered.promise;
  f.set({ notificationSound: 'default' });
  ready.resolve();
  assert.deepEqual(await operation, { played: false });
  assert.equal(f.calls.length, 0);
});

test('Windows choices are static aliases and the PowerShell command never interpolates arbitrary input', async () => {
  const f = fixture({ platform: 'win32' });
  const result = await f.manager.list();
  assert.equal(result.platform, 'win32');
  assert.deepEqual(result.sounds.map(sound => sound.id).sort(), [
    'default', 'win:SystemAsterisk', 'win:SystemDefault', 'win:SystemExclamation', 'win:SystemHand', 'win:SystemQuestion',
  ].sort());
  for (const id of ['win:SystemAsterisk\'; evil-command', 'win:../Windows/file.wav', 'win:Beep', 'mac:Ping.aiff']) {
    await assert.rejects(f.manager.play(id, true), /notificationSoundInvalid/);
  }
  assert.equal(f.calls.length, 0);
  assert.deepEqual(await f.manager.play('win:SystemExclamation', true), { played: true });
  const argv = f.calls[0].argv;
  assert.deepEqual(argv.slice(1, 5), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command']);
  assert.match(argv[5], /DllImport\("winmm\.dll"/);
  assert.match(argv[5], /PlaySound\('SystemExclamation', \[IntPtr\]::Zero, 0x00210002\)/);
  assert.doesNotMatch(argv[5], /SND_ASYNC|evil-command|ExecutionPolicy/);
});

test('overlapping requests are skipped and plugin teardown cancels and joins its current managed playback', async () => {
  const started = Promise.withResolvers();
  let terminated = 0;
  let waited = 0;
  const f = fixture({ playback(spec) {
    const finished = Promise.withResolvers();
    spec.signal.addEventListener('abort', () => finished.resolve({ exitCode: null, signal: 'SIGTERM' }), { once: true });
    started.resolve();
    return { done: finished.promise, terminate() { terminated++; }, async waitForExit() { waited++; return true; } };
  } });
  const first = f.manager.play('mac:Ping.aiff', true);
  await started.promise;
  assert.deepEqual(await f.manager.play('mac:Glass.aiff', true), { played: false });
  await f.effects[0]();
  assert.deepEqual(await first, { played: false });
  assert.equal(f.calls.length, 1);
  assert.ok(terminated >= 1);
  assert.ok(waited >= 1);
  await assert.rejects(f.manager.list(), /notificationSoundUnavailable/);
  await assert.rejects(f.manager.play('mac:Ping.aiff', true), /notificationSoundUnavailable/);
});

test('timeout, spawn failure and nonzero command outcomes report playback failure without claiming audible success', async () => {
  for (const mode of ['timeout', 'spawn', 'exit']) {
    const f = fixture({ timeoutMs: 10, playback(spec) {
      if (mode === 'spawn') throw new Error('Native provider failed');
      const finished = Promise.withResolvers();
      if (mode === 'exit') finished.resolve({ exitCode: 1, signal: null });
      spec.signal.addEventListener('abort', () => finished.resolve({ exitCode: null, signal: 'SIGTERM' }), { once: true });
      return { done: finished.promise, terminate() {}, async waitForExit() { return true; } };
    } });
    await assert.rejects(f.manager.play('mac:Ping.aiff', true), /notificationSoundFailed/);
    assert.equal(f.manager.current, null);
    await f.manager.close();
  }
});
