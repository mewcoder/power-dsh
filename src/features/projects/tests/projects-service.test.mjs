import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProjectsService } from '../projects-service.ts';

function controller({ items, archivedSessionIds = [], onDelete } = {}) {
  const calls = [];
  return {
    calls,
    async *follow() {
      yield { type: 'baseline', value: { items: items ?? [
        { workspaceId: 'w1', title: 'Alpha', path: '/work/alpha', sessionIds: ['s1', 's2'] },
        { workspaceId: 'w2', title: 'Beta', path: '/work/beta', sessionIds: ['s3'] },
      ], archivedSessionIds } };
    },
    async delete(request) {
      calls.push(request);
      onDelete?.(request);
      return { deleted: true };
    },
  };
}

function sessions(rows = [{ sessionId: 's1', updatedAt: 10 }, { sessionId: 's3', updatedAt: 30 }]) {
  const calls = [];
  return { calls, async list(request, signal) { calls.push({ request, signal }); return { items: rows }; } };
}

test('list folds the workspace baseline with the session activity list', async () => {
  const workspace = controller();
  const session = sessions();
  const service = new ProjectsService();
  service.workspaceController = workspace;
  service.sessionController = session;
  const catalog = await service.list();
  assert.equal(catalog.complete, true);
  assert.deepEqual(catalog.projects, [
    { workspaceId: 'w1', title: 'Alpha', path: '/work/alpha', sessionCount: 2, lastActiveAt: 10 },
    { workspaceId: 'w2', title: 'Beta', path: '/work/beta', sessionCount: 1, lastActiveAt: 30 },
  ]);
  assert.deepEqual(workspace.calls, []);
  assert.equal(session.calls.length, 1);
});

test('list still reports projects when the session list is unavailable', async () => {
  const service = new ProjectsService();
  service.workspaceController = controller();
  const catalog = await service.list();
  assert.deepEqual(catalog.projects.map(row => [row.workspaceId, row.lastActiveAt]), [['w1', 0], ['w2', 0]]);
});

test('list degrades to no activity when the session list rejects', async () => {
  const service = new ProjectsService();
  service.workspaceController = controller();
  service.sessionController = { async list() { throw new Error('SESSION_QUERY_PERSISTENCE_FAILED'); } };
  const catalog = await service.list();
  assert.deepEqual(catalog.projects.map(row => row.lastActiveAt), [0, 0]);
});

test('list ignores malformed activity rows instead of failing the page', async () => {
  const service = new ProjectsService();
  service.workspaceController = controller();
  service.sessionController = sessions([
    { sessionId: 's1', updatedAt: 12 },
    { sessionId: 's3', updatedAt: Number.NaN },
    { sessionId: 42, updatedAt: 5 },
    null,
  ]);
  const catalog = await service.list();
  assert.deepEqual(catalog.projects.map(row => row.lastActiveAt), [12, 0]);
});

test('list refuses to guess without the native workspace controller', async () => {
  const service = new ProjectsService();
  await assert.rejects(() => service.list(), /projectsUnavailable/);
});

test('remove calls the native delete once and returns the reloaded catalog', async () => {
  const deleted = [];
  const workspace = controller({ onDelete: request => deleted.push(request.workspaceId) });
  const service = new ProjectsService();
  service.workspaceController = workspace;
  service.sessionController = sessions();
  const catalog = await service.remove('w1');
  assert.deepEqual(deleted, ['w1']);
  assert.deepEqual(workspace.calls, [{ workspaceId: 'w1' }]);
  assert.deepEqual(catalog.projects.map(row => row.workspaceId), ['w1', 'w2'],
    'The fixture baseline is stable, so the reloaded catalog keeps both rows.');
});

test('remove rejects invalid, unknown and unavailable targets without writing', async () => {
  const workspace = controller();
  const service = new ProjectsService();
  service.workspaceController = workspace;
  service.sessionController = sessions();
  await assert.rejects(() => service.remove(''), /projectsInvalidWorkspace/);
  await assert.rejects(() => service.remove('x'.repeat(1025)), /projectsInvalidWorkspace/);
  await assert.rejects(() => service.remove('missing'), /projectsNotFound/);
  assert.deepEqual(workspace.calls, []);
  const unavailable = new ProjectsService();
  await assert.rejects(() => unavailable.remove('w1'), /projectsUnavailable/);
  const readOnly = new ProjectsService();
  readOnly.workspaceController = { async *follow() { yield { type: 'baseline', value: { items: [] } }; } };
  await assert.rejects(() => readOnly.remove('w1'), /projectsUnavailable/,
    'A Host whose workspace controller cannot delete refuses instead of reporting success.');
});
