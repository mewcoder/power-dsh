import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, symlink, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeArtifact } from '../archive-service.ts';

async function scratch() {
  return mkdtemp(join(tmpdir(), 'power-dsh-archive-'));
}

test('removeArtifact deletes the session-owned directory whose name is the id', async () => {
  const root = await scratch();
  const dir = join(root, 'sess-1');
  await mkdir(dir);
  await writeFile(join(dir, 'gen-4.jsonl'), 'current');
  await writeFile(join(dir, 'gen-3.jsonl'), 'older');
  await removeArtifact(join(dir, 'gen-4.jsonl'), 'sess-1');
  assert.deepEqual(await readdir(root), []);
  await rm(root, { recursive: true, force: true });
});

test('removeArtifact deletes only the resolved file in a shared directory', async () => {
  const root = await scratch();
  await writeFile(join(root, 'a.jsonl'), 'a');
  await writeFile(join(root, 'b.jsonl'), 'b');
  await removeArtifact(join(root, 'a.jsonl'), 'sess-1');
  assert.deepEqual((await readdir(root)).sort(), ['b.jsonl']);
  await rm(root, { recursive: true, force: true });
});

test('removeArtifact refuses to delete through a symbolic-link session directory', async () => {
  const root = await scratch();
  const target = join(root, 'target');
  await mkdir(target);
  await writeFile(join(target, 'gen-4.jsonl'), 'current');
  await symlink(target, join(root, 'sess-1'));
  await assert.rejects(() => removeArtifact(join(root, 'sess-1', 'gen-4.jsonl'), 'sess-1'), /archiveDeleteUnsafe/);
  await rm(root, { recursive: true, force: true });
});

import { ArchiveService } from '../archive-service.ts';

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

test('delete removes the archived session artifact and clears its marker', async () => {
  const root = await scratch();
  const id = 'sess-del';
  const dir = join(root, id);
  await mkdir(dir);
  await writeFile(join(dir, 'session.v4.jsonl.zstd'), 'x');
  const controller = fakeController([id]);
  const service = new ArchiveService();
  service.workspaceController = controller;
  service.sessionQuery = fakeQuery();
  service.sessionPersistence = { async stat() { return { header: { id }, location: { kind: 'jsonl', path: join(dir, 'session.v4.jsonl.zstd') } }; } };
  const catalog = await service.delete(id);
  assert.deepEqual(catalog.sessions, []);
  assert.deepEqual(controller.state.unarchived, [id]);
  await assert.rejects(() => readdir(dir));
  await rm(root, { recursive: true, force: true });
});

test('delete refuses a session that is not archived', async () => {
  const service = new ArchiveService();
  service.workspaceController = fakeController([]);
  service.sessionQuery = fakeQuery();
  service.sessionPersistence = { async stat() { throw new Error('must not be called'); } };
  await assert.rejects(() => service.delete('sess-x'), /archiveNotArchived/);
});

test('delete keeps files when the storage location cannot be resolved', async () => {
  const root = await scratch();
  const id = 'sess-live';
  const dir = join(root, id);
  await mkdir(dir);
  await writeFile(join(dir, 'f'), 'x');
  const service = new ArchiveService();
  service.workspaceController = fakeController([id]);
  service.sessionQuery = fakeQuery();
  service.sessionPersistence = { async stat() { return { header: { id } }; } };
  await assert.rejects(() => service.delete(id), /archiveDeleteUnsupported/);
  assert.deepEqual(await readdir(dir), ['f']);
  await rm(root, { recursive: true, force: true });
});
