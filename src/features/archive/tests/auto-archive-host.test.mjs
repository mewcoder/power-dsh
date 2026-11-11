import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installAutoArchive } from '../auto-archive-host.ts';
import { DAY_MS } from '../auto-archive-policy.ts';

const OLD = Date.UTC(2026, 8, 1);
const NOW = OLD + 30 * DAY_MS;
const flush = () => new Promise(setImmediate);
const deferred = () => Promise.withResolvers();

function fixture(t, { days = 30, version = '0.2.2-rc.1', preferences, candidateIds = ['idle'] } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: NOW });
  const raw = preferences ?? { autoArchiveDays: days, autoArchivedSessions: [], unrelated: 'keep' };
  const calls = [];
  const archived = new Set();
  const pinned = new Set();
  const live = new Map();
  const agents = new Map();
  const metadata = new Map(candidateIds.map(id => [id, { blank: false, lastPromptAt: OLD }]));
  const listeners = new Map();
  const releases = [];
  const native = {
    activity: () => [],
    beforeArchive: async () => {},
    afterAdmission: async () => {},
    edit: change => Object.assign(raw, change(raw)),
  };
  let queue = Promise.resolve();
  const enqueue = fn => {
    const result = queue.then(fn);
    queue = result.catch(() => {});
    return result;
  };
  const workspaceRegistry = {
    get archivedSessionIds() { return [...archived]; },
    get pinnedSessionIds() { return [...pinned]; },
    archiveSession(id, options = { stopActivity: false }) {
      calls.push(['archive', id]);
      return enqueue(async () => {
        await native.beforeArchive(id);
        if (archived.has(id)) return;
        assert.equal(options.stopActivity, false, 'automatic archive cannot stop any running work');
        const activity = await ctx.waterfall('workspace/session-activity', { sessionId: id }, () => native.activity(id));
        if (activity.length) throw new Error('session active');
        await native.afterAdmission(id);
        archived.add(id);
        pinned.delete(id);
      });
    },
    unarchiveSession: id => enqueue(() => { calls.push(['restore', id]); archived.delete(id); }),
    pinSession: id => enqueue(() => { pinned.add(id); }),
  };
  const ctx = {
    fiber: { entry: { options: { id: 'power-dsh', config: raw } } },
    workspaceRegistry, sessions: live, agents,
    clientModules: { graph: () => ({ release: { version } }) },
    sessionController: { list: async () => {
      calls.push(['list']);
      return { items: candidateIds.map(sessionId => ({ sessionId, updatedAt: OLD })) };
    } },
    sessionQuery: { observeSession: async (id, { signal }) => {
      signal.throwIfAborted();
      calls.push(['observe', id]);
      return {
        header: { id, createdAt: OLD, cwd: '/workspace' },
        source: live.has(id) ? 'live' : 'prepared', cursor: (live.get(id)?.seq ?? 5) - 1,
        projections: { values: { sessionListMetadata: metadata.get(id) } }, [Symbol.dispose]() {},
      };
    } },
    configEditor: { edit: async (_entry, change) => { calls.push(['save']); await native.edit(change); } },
    logger: { warn: message => calls.push(['warn', message]) },
    inject(_dependencies, callback) { callback(ctx); },
    effect(effect) { releases.push(effect()); },
    on(event, listener, options) {
      if (event === 'workspace/session-activity') assert.deepEqual(options, { global: true, prepend: true });
      listeners.set(event, listener);
      releases.push(() => listeners.delete(event));
    },
    async waterfall(event, req, next) { return listeners.get(event)?.(req, next) ?? next(); },
  };
  const start = () => installAutoArchive(ctx, {
    autoArchiveDays: { get: () => raw.autoArchiveDays }, autoArchivedSessions: { get: () => raw.autoArchivedSessions },
  });
  const dispose = () => { for (const release of releases.splice(0).reverse()) release?.(); };
  const tick = async (ms = 1) => { t.mock.timers.tick(ms); await flush(); };
  const notify = (event = 'settings/document-updated', namespace = 'power-dsh') => listeners.get(event)?.(namespace);
  t.after(dispose);
  return { archived, pinned, live, agents, metadata, native, workspaceRegistry, raw, calls, enqueue, start, dispose, tick, notify };
}

test('one confirmed durable exclusion precedes archiving and survives restore and reload', async t => {
  const f = fixture(t, { candidateIds: ['idle', 'pinned', 'active', 'unknown', 'blank', 'fresh', 'manual', 'old-exemption'] });
  f.pinned.add('pinned');
  f.agents.set('active', { status: 'running' });
  f.metadata.delete('unknown');
  f.metadata.set('blank', { blank: true, lastPromptAt: OLD });
  f.metadata.set('fresh', { blank: false, lastPromptAt: NOW }); // list can serve a stale cold projection
  f.archived.add('manual');
  f.raw.autoArchivedSessions = ['old-exemption', 'old-exemption'];
  f.native.beforeArchive = async id => assert.ok(f.raw.autoArchivedSessions.includes(id));
  f.start();
  await f.tick();
  assert.deepEqual([...f.archived], ['manual', 'idle']);
  assert.deepEqual([...f.pinned], ['pinned']);
  assert.deepEqual(f.raw, { autoArchiveDays: 30, autoArchivedSessions: ['old-exemption', 'idle'], unrelated: 'keep' });
  assert.deepEqual(f.calls.filter(([op]) => op === 'save' || op === 'archive'), [['save'], ['archive', 'idle']]);
  await f.workspaceRegistry.unarchiveSession('idle');
  f.dispose();
  f.start();
  await f.tick();
  await f.tick(DAY_MS);
  assert.deepEqual([...f.archived], ['manual']);
  assert.deepEqual(f.calls.filter(([op]) => op === 'archive'), [['archive', 'idle']]);
});

test('an unsupported version or the never setting performs no reads or writes', async t => {
  const f = fixture(t, { days: 30, version: '0.2.1-rc.5' });
  f.start();
  f.notify();
  f.notify('app-boot/config-reload');
  await f.tick(2 * DAY_MS);
  assert.deepEqual(f.calls, []);
  assert.equal(f.raw.autoArchiveDays, 30);
});

test('only a live threshold change starts a fresh pass and disabling cancels it', async t => {
  const f = fixture(t, { days: 0 });
  f.start();
  await f.tick(DAY_MS);
  assert.deepEqual(f.calls, []);
  const before = deferred();
  f.native.beforeArchive = () => before.promise;
  f.raw.autoArchiveDays = 30;
  f.notify('settings/document-updated', 'unrelated');
  await flush();
  assert.deepEqual(f.calls, []);
  f.notify();
  await flush();
  assert.deepEqual(f.calls.at(-1), ['archive', 'idle']);
  f.raw.autoArchiveDays = 0;
  f.notify();
  before.resolve();
  await flush();
  assert.equal(f.archived.size, 0);
});

test('a pin already queued ahead is preserved, and the attempt remains excluded', async t => {
  const f = fixture(t);
  const before = deferred();
  void f.enqueue(() => before.promise);
  void f.workspaceRegistry.pinSession('idle');
  f.start();
  await f.tick();
  assert.deepEqual(f.calls.at(-1), ['archive', 'idle']);
  before.resolve();
  await flush();
  assert.equal(f.archived.size, 0);
  assert.ok(f.pinned.has('idle'));
  assert.deepEqual(f.raw.autoArchivedSessions, ['idle']);
});

test('native activity and newer queued metadata block before archive commit', async t => {
  const f = fixture(t, { candidateIds: ['activity', 'updated', 'unknown-after-scan'] });
  f.native.activity = id => id === 'activity' ? [{ kind: 'job' }] : [];
  f.native.beforeArchive = async id => {
    if (id === 'updated') f.metadata.set(id, { blank: false, lastPromptAt: NOW });
    if (id === 'unknown-after-scan') f.metadata.delete(id);
  };
  f.start();
  await f.tick();
  assert.equal(f.archived.size, 0);
  assert.deepEqual(f.raw.autoArchivedSessions, ['activity', 'updated', 'unknown-after-scan']);
  assert.equal(f.calls.some(([op]) => op === 'restore' || op === 'warn'), false);
});

test('activity starting during the final native write triggers a reversible unarchive', async t => {
  const f = fixture(t);
  f.native.afterAdmission = async id => f.agents.set(id, { status: 'running' });
  f.start();
  await f.tick();
  assert.equal(f.archived.size, 0);
  assert.deepEqual(f.calls.at(-1), ['restore', 'idle']);
  assert.deepEqual(f.raw.autoArchivedSessions, ['idle']);
});

test('disposal before a queued native write blocks it even after the listener is removed', async t => {
  const f = fixture(t);
  const before = deferred();
  f.native.beforeArchive = () => before.promise;
  f.start();
  await f.tick();
  assert.deepEqual(f.calls.at(-1), ['archive', 'idle']);
  f.dispose();
  before.resolve();
  await f.tick(DAY_MS);
  assert.equal(f.archived.size, 0);
  assert.equal(f.calls.filter(([op]) => op === 'list').length, 1);
});

test('a manually queued archive for the same id is not vetoed or undone', async t => {
  const f = fixture(t);
  const before = deferred();
  void f.enqueue(() => before.promise);
  const manual = f.workspaceRegistry.archiveSession('idle');
  f.start();
  await f.tick();
  before.resolve();
  await manual;
  await flush();
  assert.deepEqual([...f.archived], ['idle']);
  assert.equal(f.calls.some(([op]) => op === 'restore'), false);
});

for (const mode of ['reject', 'no readback', 'already reserved']) {
  test(`an exclusion save with ${mode} cannot trigger native archive`, async t => {
    const f = fixture(t);
    f.native.edit = change => {
      if (mode === 'reject') throw new Error('config fault');
      if (mode === 'already reserved') f.raw.autoArchivedSessions.push('idle');
      change(f.raw);
    };
    f.start();
    await f.tick();
    assert.equal(f.archived.size, 0);
    assert.equal(f.calls.some(([op]) => op === 'archive'), false);
  });
}
