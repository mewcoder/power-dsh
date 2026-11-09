import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { DesktopRestart } from '../restart.ts';

function fixture(overrides = {}) {
  const effects = [];
  const children = [];
  const calls = [];
  let enabled = true;
  const app = '/Applications/DSH Test.app';
  const service = new DesktopRestart({ effect(fn) { effects.push(fn()); } }, { showRestartButton: { get: () => enabled } }, {
    platform: 'darwin', executable: `${app}/Contents/MacOS/DSH`,
    env: { DSH_CLIENT_VERSION: 'test', ELECTRON_RUN_AS_NODE: '1', NODE_OPTIONS: '--inspect', NODE_PATH: '/unused', LANG: 'en_US.UTF-8' },
    realpath: async value => value,
    readFile: async () => '<key>CFBundleIdentifier</key>\n<string>com.deepseek.dsh</string>',
    spawn(...args) {
      calls.push(args);
      const child = new EventEmitter();
      child.unref = () => { child.detached = true; };
      child.kill = () => { child.killed = true; };
      children.push(child);
      queueMicrotask(() => child.emit('spawn'));
      return child;
    }, ...overrides,
  });
  return { service, app, calls, children, effects, disable() { enabled = false; } };
}

test('restart rejects unverified applications, other platforms and non-desktop Hosts', async () => {
  for (const overrides of [
    { platform: 'win32' }, { platform: 'linux' }, { env: {} },
    { executable: '/usr/local/bin/node' },
    { readFile: async () => '<key>CFBundleIdentifier</key><string>other.app</string>' },
    { realpath: async () => { throw new Error('missing'); } },
  ]) {
    const f = fixture(overrides);
    assert.deepEqual(await f.service.status(), { supported: false, running: false, error: '' });
    await assert.rejects(f.service.restart(), /restartUnavailable/);
    assert.equal(f.calls.length, 0);
  }
});

test('a preference never starts a process; only explicit restart hands off fixed argv', async () => {
  const f = fixture();
  assert.equal((await f.service.status()).supported, true);
  assert.equal(f.calls.length, 0);
  await f.service.restart();
  const [command, argv, options] = f.calls[0];
  assert.equal(command, '/usr/bin/osascript');
  assert.equal(argv.at(-1), f.app);
  assert.equal(argv.length, 3);
  assert.equal(options.detached, true);
  assert.equal(options.stdio, 'ignore');
  assert.deepEqual(options.env, { DSH_CLIENT_VERSION: 'test', LANG: 'en_US.UTF-8' });
  assert.equal(f.children[0].detached, true);
  await assert.rejects(f.service.restart(), /restartBusy/);
  assert.equal(f.calls.length, 1);
  // An application exit must not terminate its accepted relaunch helper.
  f.effects.forEach(dispose => dispose());
  assert.equal(f.children[0].killed, undefined);
  await assert.rejects(f.service.restart(), /restartUnavailable/);
});

test('failed or cancelled quit releases the lock, exposes failure and allows retry', async () => {
  const f = fixture();
  await f.service.restart();
  f.children[0].emit('exit', 1);
  assert.deepEqual(await f.service.status(), { supported: true, running: false, error: 'restartFailed' });
  await f.service.restart();
  assert.equal(f.calls.length, 2);
  f.children[1].emit('exit', 0);
  assert.deepEqual(await f.service.status(), { supported: true, running: false, error: '' });
  f.disable();
  await assert.rejects(f.service.restart(), /restartUnavailable/);
  assert.equal(f.calls.length, 2);
});

test('unload or disabling during path validation cancels before handoff', async () => {
  let resolve;
  const f = fixture({ realpath: () => new Promise(done => { resolve = done; }) });
  const pending = f.service.restart();
  await assert.rejects(f.service.restart(), /restartBusy/);
  f.service.close();
  resolve(`${f.app}/Contents/MacOS/DSH`);
  await assert.rejects(pending, /restartUnavailable/);
  assert.equal(f.calls.length, 0);
});

test('spawn errors release the restart lock without accepting a handoff', async () => {
  const f = fixture({ spawn() {
    const child = new EventEmitter();
    queueMicrotask(() => child.emit('error', new Error('not executable')));
    return child;
  } });
  await assert.rejects(f.service.restart(), /restartFailed/);
  assert.equal((await f.service.status()).running, false);
});
