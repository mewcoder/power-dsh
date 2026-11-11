import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ArchiveService } from '../archive-service.ts';
import { methods } from '../host.ts';

function fakeController(ids) {
  const state = { ids: [...ids], unarchived: [] };
  return {
    state,
    async *follow() {
      yield { type: 'baseline', value: {
        items: [{ workspaceId: 'w1', title: 'Alpha', sessionIds: [...state.ids] }],
        archivedSessionIds: [...state.ids],
      } };
    },
    async unarchiveSession({ sessionId }) {
      state.unarchived.push(sessionId);
      state.ids = state.ids.filter(id => id !== sessionId);
    },
  };
}
function fakeQuery() {
  return {
    async readTitleSnapshots(ids) {
      return ids.map(id => ({ sessionId: id, status: 'fulfilled', value: { session: { createdAt: 1 }, title: { title: 'T', updatedAt: 2 } } }));
    },
    async listSessions() { return []; },
  };
}

function deleteFixture(t, options = {}) {
  const id = 'target';
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'power-dsh-archive-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, '--project--', id);
  const transcript = join(dir, options.filename ?? 'session.v4.jsonl');
  const lock = join(dir, 'session.lock');
  mkdirSync(dir, { recursive: true });
  writeFileSync(transcript, 'transcript');
  writeFileSync(lock, '');
  const service = new ArchiveService();
  const controller = fakeController([id, 'keep']);
  service.workspaceController = controller;
  service.sessionQuery = fakeQuery();
  const state = { opens: 0, closes: 0, held: false };
  const access = {
    registry: { get archivedSessionIds() { return controller.state.ids; } },
    isLive: () => options.live === true,
    persistence: {
      name: 'session-persistence-jsonl',
      async stat(sessionId) {
        assert.equal(sessionId, id);
        if (options.missing) return undefined;
        return { header: { id }, formatStatus: options.formatStatus ?? 'current', revision: 'one', location: { kind: 'jsonl', path: transcript } };
      },
      async open(sessionId, mode) {
        assert.equal(sessionId, id);
        assert.equal(mode, 'write');
        state.opens++;
        if (options.writerHeld) throw Object.assign(new Error('owned'), { name: 'SessionAlreadyOwnedError' });
        state.held = true;
        await options.onOpen?.(controller, service);
        return { header: { id }, async close() { state.closes++; state.held = false; } };
      },
    },
  };
  service.deleteAccess = access;
  return { id, root, dir, transcript, lock, service, controller, access, state };
}

test('deletes one cold transcript under the writer lease and preserves neighboring data', async t => {
  const { id, dir, transcript, lock, service, controller, state } = deleteFixture(t, { filename: 'session.v4.jsonl.zstd' });
  const sibling = join(dirname(dir), 'keep');
  mkdirSync(sibling);
  writeFileSync(join(sibling, 'session.v4.jsonl.zstd'), 'unrelated');
  const unarchive = controller.unarchiveSession;
  controller.unarchiveSession = async request => {
    assert.equal(state.held, true);
    assert.equal(existsSync(transcript), false, 'A cold resume must not find the staged log.');
    assert.equal(existsSync(lock), true, 'The native lock must stay at its original path.');
    await unarchive(request);
  };
  const host = { archive: service, run: operation => operation() };
  const catalog = await methods.deleteArchivedSession.call(host, id);
  assert.deepEqual(catalog.sessions.map(row => row.sessionId), ['keep']);
  assert.deepEqual(controller.state.unarchived, [id]);
  assert.deepEqual(readdirSync(dir), ['session.lock']);
  assert.equal(readFileSync(join(sibling, 'session.v4.jsonl.zstd'), 'utf8'), 'unrelated');
  assert.deepEqual(state, { opens: 1, closes: 1, held: false });
});

test('rolls back staging if the native archive marker cannot be cleared', async t => {
  const { id, dir, transcript, service, controller, state } = deleteFixture(t);
  controller.unarchiveSession = async () => { throw new Error('store rejected'); };
  await assert.rejects(service.delete(id), /archiveDeleteUnarchiveFailed/);
  assert.equal(readFileSync(transcript, 'utf8'), 'transcript');
  assert.deepEqual(readdirSync(dir).sort(), ['session.lock', 'session.v4.jsonl']);
  assert.deepEqual(controller.state.ids, [id, 'keep']);
  assert.equal(state.closes, 1);
});

test('preserves both copies if rollback cannot restore without overwriting a replacement', async t => {
  const { id, dir, transcript, service, controller, state } = deleteFixture(t);
  controller.unarchiveSession = async () => {
    writeFileSync(transcript, 'replacement');
    throw new Error('store rejected');
  };
  await assert.rejects(service.delete(id), /archiveDeleteRecoveryRequired/);
  assert.equal(readFileSync(transcript, 'utf8'), 'replacement');
  const staged = readdirSync(dir).find(name => name.startsWith('.power-dsh-delete-'));
  assert.ok(staged);
  assert.equal(readFileSync(join(dir, staged, 'session.v4.jsonl'), 'utf8'), 'transcript');
  assert.deepEqual(controller.state.ids, [id, 'keep']);
  assert.equal(state.closes, 1);
  await assert.rejects(service.delete(id), /archiveDeleteRecoveryRequired/);
  assert.equal(state.opens, 1, 'Do not touch storage again while a staged copy needs recovery.');
});

test('refuses deletion if another surface restores it while write ownership is acquired', async t => {
  const { id, transcript, service, controller, state } = deleteFixture(t, {
    onOpen: controller => controller.unarchiveSession({ sessionId: 'target' }),
  });
  await assert.rejects(service.delete(id), /archiveNotArchived/);
  assert.equal(readFileSync(transcript, 'utf8'), 'transcript');
  assert.deepEqual(controller.state.unarchived, [id]);
  assert.equal(state.closes, 1);
});

test('closes the writer and keeps the transcript if native services are withdrawn', async t => {
  const { id, transcript, service, controller, state } = deleteFixture(t, {
    onOpen: (_controller, service) => { service.deleteAccess = null; },
  });
  await assert.rejects(service.delete(id), /archiveDeleteUnavailable/);
  assert.equal(readFileSync(transcript, 'utf8'), 'transcript');
  assert.deepEqual(controller.state.unarchived, []);
  assert.equal(state.closes, 1);
});

test('returns a partial catalog if refresh fails after committed deletion', async t => {
  const { id, transcript, service, controller } = deleteFixture(t);
  const unarchive = controller.unarchiveSession;
  controller.unarchiveSession = async request => {
    await unarchive(request);
    service.sessionQuery = null;
  };
  const catalog = await service.delete(id);
  assert.equal(catalog.complete, false);
  assert.deepEqual(catalog.sessions.map(row => row.sessionId), ['keep']);
  assert.equal(existsSync(transcript), false);
});

test('leaves live, writer-owned, missing and legacy sessions untouched', async t => {
  for (const [options, error] of [
    [{ live: true }, /archiveDeleteBusy/], [{ writerHeld: true }, /archiveDeleteBusy/],
    [{ missing: true }, /archiveDeleteUnsupported/], [{ formatStatus: 'migration-required' }, /archiveDeleteUnsupported/],
  ]) {
    const { id, transcript, service, controller, state } = deleteFixture(t, options);
    await assert.rejects(service.delete(id), error);
    assert.deepEqual(controller.state.ids, [id, 'keep']);
    assert.deepEqual(controller.state.unarchived, []);
    assert.equal(readFileSync(transcript, 'utf8'), 'transcript');
    assert.equal(state.opens, options.writerHeld ? 1 : 0);
  }
});

test('rejects alternate generations and a symlinked lock before acquiring a writer', async t => {
  const { id, dir, lock, service, state } = deleteFixture(t);
  const alternate = join(dir, 'session.v3.jsonl');
  writeFileSync(alternate, 'previous generation');
  await assert.rejects(service.delete(id), /archiveDeleteUnsupported/);
  rmSync(alternate);
  if (process.platform !== 'win32') {
    rmSync(lock);
    const target = join(dir, 'keep');
    writeFileSync(target, 'must not be truncated');
    symlinkSync(target, lock);
    await assert.rejects(service.delete(id), /archiveDeleteUnsafe/);
    assert.equal(readFileSync(target, 'utf8'), 'must not be truncated');
  }
  assert.equal(state.opens, 0);
});

test('refuses deletion without native services while leaving restore available', async t => {
  const { id, transcript, service, controller } = deleteFixture(t);
  service.deleteAccess = null;
  await assert.rejects(service.delete(id), /archiveDeleteUnavailable/);
  assert.equal(readFileSync(transcript, 'utf8'), 'transcript');
  assert.deepEqual(controller.state.unarchived, []);
  assert.deepEqual((await service.restore(id)).sessions.map(row => row.sessionId), ['keep']);
});

test('rows are dated by the native list activity, falling back to the title event', async () => {
  const service = new ArchiveService();
  service.workspaceController = fakeController(['s1', 's2']);
  service.sessionQuery = fakeQuery();
  service.sessionController = { async list() { return { items: [{ sessionId: 's1', updatedAt: 500 }] }; } };
  const catalog = await service.list();
  assert.deepEqual(catalog.sessions.map(row => [row.sessionId, row.updatedAt]), [['s1', 500], ['s2', 2]],
    'The list activity wins; a session missing from the list keeps the title event time.');
});

test('a failing session list keeps the archive readable', async () => {
  const service = new ArchiveService();
  service.workspaceController = fakeController(['s1']);
  service.sessionQuery = fakeQuery();
  service.sessionController = { async list() { throw new Error('list-failed'); } };
  const catalog = await service.list();
  assert.deepEqual(catalog.sessions.map(row => [row.sessionId, row.updatedAt]), [['s1', 2]]);
});


test('restores the transcript when the session becomes live during marker removal', async t => {
  const options = { live: false };
  const { id, transcript, service, controller } = deleteFixture(t, options);
  const original = controller.unarchiveSession;
  controller.unarchiveSession = async request => {
    await original(request);
    options.live = true;
  };
  await assert.rejects(service.delete(id), /archiveDeleteUnarchiveFailed/);
  assert.equal(readFileSync(transcript, 'utf8'), 'transcript');
});
