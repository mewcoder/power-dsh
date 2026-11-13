import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PluginUpdateClient, compareVersions } from '../update-client.ts';
import { updateDiagnosticContext } from '../diagnostics.ts';
import { locales } from '../locales.ts';

const schema = 'dsh-market/update-api/v1';
const commit = 'a'.repeat(40);
const operation = (patch = {}) => ({ schema, operationId: 'boot-update-1', kind: 'update', packageName: 'power-dsh',
  state: 'queued', beforeVersion: '0.0.5', installedVersion: '0.0.5',
  outcome: { refreshRequired: false, restartRequired: false }, ...patch });
function fixture({ source = 'npm', installed = '0.0.5', latest = '0.0.6', storageMap = new Map(), handler, version = '0.0.5',
  releaseResult = { status: 'ready', version: '0.0.6', commit }, releaseRead } = {}) {
  const calls = [];
  const releaseCalls = [];
  const timers = new Map();
  let nextTimer = 0;
  let allowed = true;
  let result = operation();
  const config = { source, installed, latest, boot: 'boot', available: true };
  const options = {
    version, baseURI: 'https://dsh.example/prefix/', canUse: () => allowed, notify() {}, runtimeVersion: async () => version,
    storage: { getItem: key => storageMap.get(key) ?? null, setItem: (key, value) => storageMap.set(key, value), removeItem: key => storageMap.delete(key) },
    completionStorage: { getItem: key => storageMap.get(key) ?? null, setItem: (key, value) => storageMap.set(key, value), removeItem: key => storageMap.delete(key) },
    schedule(callback, milliseconds) { timers.set(++nextTimer, { callback, milliseconds }); return nextTimer; },
    cancel(timer) { timers.delete(timer); },
    async release(signal) { releaseCalls.push(signal); return releaseRead ? releaseRead(signal) : releaseResult; },
    async fetch(url, init) {
      calls.push({ url, init });
      const custom = await handler?.(url, init);
      if (custom) return custom;
      let data;
      if (url.endsWith('/capabilities')) data = { schema, apiVersion: 1, stability: 'beta', bootId: config.boot,
        features: { check: true, update: true, progress: true },
        endpoints: { updates: '/dsh-market/api/v1/updates', operations: '/dsh-market/api/v1/operations' } };
      else if (url.endsWith('/updates') && init.method === 'POST') data = { schema, operation: result };
      else if (url.includes('/updates?')) data = { schema, package: { name: 'power-dsh', source: config.source,
        installedVersion: config.installed, latestVersion: config.latest, updateAvailable: config.available } };
      else if (url.includes('/operations?')) data = { schema, operation: result };
      else assert.fail(`Unexpected endpoint: ${url}`);
      return new Response(JSON.stringify(data), { status: 200 });
    },
  };
  const client = new PluginUpdateClient(options);
  return { client, calls, releaseCalls, timers, options, config, storageMap, setResult(value) { result = value; }, allow(value) { allowed = value; },
    async tick() { const entry = [...timers].find(([, timer]) => timer.milliseconds === 1500); assert.ok(entry); timers.delete(entry[0]); entry[1].callback(); await new Promise(resolve => setImmediate(resolve)); } };
}

test('manual update checks make no network calls until explicitly requested and never poll while idle', async () => {
  const f = fixture();
  await f.client.resume();
  assert.equal(f.calls.length, 0);
  f.allow(false);
  await f.client.check();
  assert.equal(f.calls.length, 0);
  f.allow(true);
  await f.client.check();
  assert.equal(f.client.state.phase, 'available');
  assert.equal(f.client.state.target.version, '0.0.6');
  assert.equal(f.calls.filter(call => call.init.method === 'POST').length, 0);
  assert.equal(f.timers.size, 0);
  for (const call of f.calls) {
    assert.equal(call.init.redirect, 'error');
    assert.equal(call.init.credentials, 'same-origin');
    assert.ok(call.url.startsWith('/prefix/dsh-market/api/v1/'));
  }
});

test('Git updates require an annotated official Release tag to resolve to the exact market target commit', async () => {
  for (const matches of [false, true]) {
    const f = fixture({ source: 'github', installed: 'c'.repeat(40), latest: matches ? commit : 'd'.repeat(40) });
    await f.client.check();
    assert.equal(f.client.state.phase, matches ? 'available' : 'unconfirmed');
    assert.equal(f.releaseCalls.length, 1);
  }
});

test('local sources, API absence, authentication failures and malformed capability data never enable mutation', async () => {
  for (const options of [
    { source: 'linked' }, { source: 'generation' },
    { handler: url => url.endsWith('/capabilities') ? new Response('', { status: 404 }) : null },
    { handler: url => url.endsWith('/capabilities') ? new Response('', { status: 403 }) : null },
    { handler: url => url.endsWith('/capabilities') ? new Response(JSON.stringify({ schema, features: {} })) : null },
  ]) {
    const f = fixture(options);
    await f.client.check();
    assert.equal(f.client.state.phase, 'error');
    assert.equal(f.client.state.target, null);
    assert.equal(f.calls.filter(call => call.init.method === 'POST').length, 0);
  }
});

test('release limits, missing Git and market permissions remain distinct safe failures', async () => {
  for (const [releaseResult, expected] of [
    [{ status: 'rate-limited', retryAt: Date.now() + 120_000 }, 'pluginUpdateRateLimited'],
    [{ status: 'git-unavailable' }, 'pluginUpdateGitUnavailable'],
    [{ status: 'unavailable' }, 'pluginUpdateCheckFailed'],
  ]) {
    const f = fixture({ releaseResult });
    await f.client.check();
    assert.equal(f.client.state.error, expected);
    assert.equal(f.client.state.target, null);
    assert.equal(f.calls.some(call => call.init.method === 'POST'), false);
    assert.equal(JSON.stringify(f.client.state).includes('private address'), false);
    assert.equal(f.timers.size, 0, 'Rate limits never schedule background retries.');
  }
  const denied = fixture({ handler: url => url.endsWith('/capabilities') ? new Response('', { status: 403 }) : null });
  await denied.client.check();
  assert.equal(denied.client.state.error, 'pluginUpdateDenied');
});

test('release cooldown survives a client reload, blocks repeated reads and expires without automatic requests', async () => {
  let now = 1_800_000_000_000;
  let limited = true;
  const storageMap = new Map();
  const releaseRead = () => limited ? { status: 'rate-limited', retryAt: now + 120_000 } : { status: 'ready', version: '0.0.6', commit };
  const f = fixture({ releaseRead, storageMap });
  f.options.now = () => now;
  await f.client.check();
  assert.equal(f.client.state.error, 'pluginUpdateRateLimited');
  await f.client.check();
  assert.equal(f.releaseCalls.length, 1);
  const reloaded = fixture({ releaseRead, storageMap });
  reloaded.options.now = () => now;
  await reloaded.client.resume();
  assert.equal(reloaded.calls.length, 0);
  await reloaded.client.check();
  assert.equal(reloaded.client.state.error, 'pluginUpdateRateLimited');
  assert.equal(reloaded.releaseCalls.length, 0);
  now += 121_000;
  limited = false;
  assert.equal(reloaded.releaseCalls.length, 0);
  await reloaded.client.check();
  assert.equal(reloaded.client.state.phase, 'available');
  assert.equal(reloaded.timers.size, 0);
});

test('failure diagnostics distinguish Host evidence, HTTP, invalid responses and network errors and clear on recovery', async () => {
  const evidence = { stage: 'release.asset', reason: 'http', httpStatus: 404, observedAt: '2026-11-12T00:00:00.000Z', elapsedMs: 42 };
  const host = fixture({ releaseResult: { status: 'unavailable', diagnostic: evidence } });
  await host.client.check();
  assert.equal(host.client.state.error, 'pluginUpdateAssetFailed');
  assert.deepEqual(host.client.state.diagnostic, evidence);
  for (const language of ['en', 'zh']) {
    const context = updateDiagnosticContext(evidence, '0.0.7', 'error', key => locales[language][key] || key);
    assert.ok(context.stage.includes('release.asset'));
    assert.ok(context.actual.includes('HTTP 404'));
    assert.ok(context.actual.includes('42 ms'));
    assert.ok(context.state.includes('0.0.7'));
    assert.ok(!JSON.stringify(context).includes('pluginUpdateStage_'));
  }
  for (const [handler, expected] of [
    [() => new Response('', { status: 502 }), { reason: 'http', httpStatus: 502 }],
    [() => new Response('private invalid body'), { reason: 'invalid-response', httpStatus: 200 }],
    [() => { throw new Error('password=private', { cause: { code: 'ECONNRESET' } }); }, { reason: 'network', systemCode: 'ECONNRESET' }],
  ]) {
    let fail = true;
    const f = fixture({ handler: () => fail ? handler() : null });
    await f.client.check();
    assert.equal(f.client.state.diagnostic.stage, 'market.capabilities');
    for (const [key, value] of Object.entries(expected)) assert.equal(f.client.state.diagnostic[key], value);
    assert.ok(!JSON.stringify(f.client.state).includes('private'));
    const observed = f.client.state.diagnostic.observedAt;
    await f.client.resume();
    assert.equal(f.client.state.diagnostic.observedAt, observed);
    fail = false;
    await f.client.check();
    assert.equal(f.client.state.phase, 'available');
    assert.equal(f.client.state.diagnostic, null);
  }
});

test('a request timeout retains its step and remains distinct from a network rejection', async () => {
  const started = Promise.withResolvers();
  const f = fixture({ handler: (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
    started.resolve();
  }) });
  const checking = f.client.check();
  await started.promise;
  [...f.timers.values()].find(timer => timer.milliseconds === 15000).callback();
  await checking;
  assert.equal(f.client.state.error, 'pluginUpdateTimeout');
  assert.equal(f.client.state.diagnostic.stage, 'market.capabilities');
  assert.equal(f.client.state.diagnostic.reason, 'timeout');
  assert.equal(f.timers.size, 0);
});

test('release and package validation reject wrong assets, versions, identities, and apparent updates that are not safe targets', async () => {
  for (const options of [
    { installed: '0.0.4' }, { latest: '0.0.7' },
    { releaseResult: { status: 'ready', version: '0.0.6-beta.1', commit } },
    { releaseResult: { status: 'ready', version: '0.0.6', commit: 'wrong' } },
    { handler: url => url.includes('/updates?') ? new Response(JSON.stringify({ schema, package: { name: 'other', updateAvailable: true } })) : null },
  ]) {
    const f = fixture(options);
    await f.client.check();
    assert.notEqual(f.client.state.phase, 'available');
    assert.equal(f.client.state.target, null);
  }
  const current = fixture({ version: '0.0.6' });
  await current.client.check();
  assert.equal(current.client.state.phase, 'current');
  assert.equal(current.calls.length, 0, 'A current version does not ask the market to refresh upstream metadata.');
  assert.equal(compareVersions('0.0.10', '0.0.9'), 1);
  assert.equal(compareVersions('0.0.6-beta.1', '0.0.5'), null);
});

test('confirmation rechecks both target and installed baseline, refusing changes before posting', async () => {
  const f = fixture();
  await f.client.check();
  const target = f.client.state.target;
  f.config.installed = '0.0.4';
  await f.client.update(target);
  assert.equal(f.client.state.error, 'pluginUpdateChanged');
  assert.equal(f.calls.filter(call => call.init.method === 'POST').length, 0);
});

test('an accepted operation is stored and polled; queued is never success and installed version must reach the confirmed target', async () => {
  const f = fixture();
  await f.client.check();
  const target = f.client.state.target;
  await Promise.all([f.client.update(target), f.client.update(target)]);
  const mutations = f.calls.filter(call => call.init.method === 'POST');
  assert.equal(mutations.length, 1);
  assert.deepEqual(JSON.parse(mutations[0].init.body), { packageName: 'power-dsh' });
  assert.equal(f.client.state.phase, 'updating');
  assert.equal(f.storageMap.size, 1);
  f.setResult(operation({ state: 'succeeded', installedVersion: '0.0.6', outcome: { refreshRequired: true, restartRequired: true } }));
  await f.tick();
  assert.equal(f.client.state.phase, 'done');
  assert.equal(f.client.state.refreshRequired, true);
  assert.equal(f.client.state.restartRequired, true);
  assert.equal(f.storageMap.has(f.client.storageKey), false);
  assert.equal(f.storageMap.has(f.client.completionKey), true);
  assert.equal(f.timers.size, 0);
});

test('older installed version, wrong operation or mismatched before version never reports update success', async () => {
  for (const patch of [{ installedVersion: '0.0.5' }, { packageName: 'other' }, { beforeVersion: '0.0.3' }]) {
    const f = fixture();
    await f.client.check();
    await f.client.update(f.client.state.target);
    f.setResult(operation({ state: 'succeeded', installedVersion: '0.0.6', ...patch }));
    await f.tick();
    assert.equal(f.client.state.phase, 'error');
    assert.equal(f.client.state.error, 'pluginUpdateUnknown');
    assert.equal(f.storageMap.size, 1);
  }
});

test('reload resumes the same operation even when new code is running, while a different Host boot never reuses its id', async () => {
  const f = fixture();
  await f.client.check();
  await f.client.update(f.client.state.target);
  f.client.close();
  assert.equal(f.timers.size, 0);
  const next = fixture({ storageMap: f.storageMap, version: '0.0.6' });
  next.setResult(operation({ state: 'succeeded', installedVersion: '0.0.6' }));
  await next.client.resume();
  assert.equal(next.client.state.phase, 'current');
  assert.equal(next.calls.some(call => call.init.method === 'POST'), false);
  const changed = fixture({ storageMap: new Map([[f.client.storageKey, JSON.stringify(f.client.state.pending)]]) });
  changed.config.boot = 'newboot';
  await changed.client.resume();
  assert.equal(changed.client.state.error, 'pluginUpdateUnknown');
  assert.equal(changed.calls.some(call => call.url.includes('/operations?')), false);
});

test('completed updates survive reload and only current Client plus current Host clear the activation receipt', async () => {
  const first = fixture();
  await first.client.check();
  await first.client.update(first.client.state.target);
  first.setResult(operation({ state: 'succeeded', installedVersion: '0.0.6', outcome: { restartRequired: true, refreshRequired: true } }));
  await first.tick();
  first.client.close();
  const older = fixture({ storageMap: first.storageMap });
  await older.client.resume();
  assert.equal(older.client.state.phase, 'done');
  assert.equal(older.client.state.restartRequired, true);
  assert.equal(older.calls.length, 0);
  await older.client.check();
  assert.equal(older.releaseCalls.length, 0);
  const newClient = fixture({ storageMap: first.storageMap, version: '0.0.6' });
  newClient.options.runtimeVersion = async () => '0.0.5';
  await newClient.client.resume();
  assert.equal(newClient.client.state.phase, 'done');
  assert.equal(first.storageMap.has(first.client.completionKey), true);
  newClient.options.runtimeVersion = async () => 'invalid';
  await newClient.client.resume();
  assert.equal(newClient.client.state.phase, 'done');
  newClient.options.runtimeVersion = async () => '0.0.6';
  await newClient.client.resume();
  assert.equal(newClient.client.state.phase, 'current');
  assert.equal(first.storageMap.has(first.client.completionKey), false);
  assert.equal(newClient.calls.length, 0);
});

test('persisted success takes precedence over a stale pending record and storage failures retain the in-memory outcome', async () => {
  const app = fixture();
  await app.client.check();
  await app.client.update(app.client.state.target);
  const pending = app.storageMap.get(app.client.storageKey);
  app.setResult(operation({ state: 'succeeded', installedVersion: '0.0.6' }));
  await app.tick();
  app.storageMap.set(app.client.storageKey, pending);
  const reload = fixture({ storageMap: app.storageMap });
  await reload.client.resume();
  assert.equal(reload.client.state.phase, 'done');
  assert.equal(reload.calls.length, 0);
  assert.equal(reload.storageMap.has(reload.client.storageKey), false);
  const broken = fixture();
  broken.options.completionStorage = { getItem: () => null, setItem() { throw new Error('full'); }, removeItem() {} };
  await broken.client.check();
  await broken.client.update(broken.client.state.target);
  broken.setResult(operation({ state: 'succeeded', installedVersion: '0.0.6' }));
  await broken.tick();
  assert.equal(broken.client.state.phase, 'done');
  assert.equal(broken.client.state.notice, 'pluginUpdateStorage');
});

test('completion survives a new session and late Host version reads cannot change a closed page', async () => {
  const app = fixture();
  await app.client.check();
  await app.client.update(app.client.state.target);
  app.setResult(operation({ state: 'succeeded', installedVersion: '0.0.6', outcome: { restartRequired: true, refreshRequired: false } }));
  await app.tick();
  const next = fixture({ version: '0.0.6' });
  next.options.completionStorage = app.options.completionStorage;
  const version = Promise.withResolvers();
  next.options.runtimeVersion = () => version.promise;
  const restoring = next.client.resume();
  next.client.close();
  version.resolve('0.0.6');
  await restoring;
  assert.equal(next.client.state.phase, 'done');
  assert.equal(app.storageMap.has(app.client.completionKey), true);
  assert.equal(next.calls.length, 0);
});

test('failed, cancelled and rolled-back operations retain honest terminal state and remove only their own record', async () => {
  for (const state of ['failed', 'cancelled', 'rolled-back']) {
    const f = fixture();
    f.storageMap.set('unrelated', 'keep');
    await f.client.check();
    await f.client.update(f.client.state.target);
    f.setResult(operation({ state }));
    await f.tick();
    assert.equal(f.client.state.phase, 'error');
    assert.equal(f.client.state.pending, null);
    assert.equal(f.storageMap.get('unrelated'), 'keep');
    assert.equal(f.storageMap.size, 1);
  }
});

test('a lost mutation response remains unknown and cannot automatically submit a second update', async () => {
  const f = fixture({ handler: (_url, init) => { if (init.method === 'POST') throw new Error('private network details'); } });
  await f.client.check();
  await f.client.update(f.client.state.target);
  assert.equal(f.client.state.error, 'pluginUpdateUnknown');
  assert.equal(f.client.state.pending.operationId, 'submission-unknown');
  await f.client.check();
  await f.client.update(f.client.state.target);
  assert.equal(f.calls.filter(call => call.init.method === 'POST').length, 1);
});

test('late reads after a page closes cannot replace state or leave timers running', async () => {
  const delayed = Promise.withResolvers();
  const f = fixture({ handler: url => url.endsWith('/capabilities') ? delayed.promise : null });
  const pending = f.client.check();
  f.client.close();
  delayed.resolve(new Response('', { status: 404 }));
  await pending;
  assert.notEqual(f.client.state.phase, 'available');
  assert.equal(f.timers.size, 0);
});
