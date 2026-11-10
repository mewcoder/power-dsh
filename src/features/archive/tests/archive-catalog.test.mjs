import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildArchiveCatalog, groupArchivedSessions } from '../archive-catalog.ts';

function baseline(overrides = {}) {
  return {
    items: [
      { workspaceId: 'w1', title: 'Alpha', sessionIds: ['s1', 's2'] },
      { workspaceId: 'w2', title: 'Beta', sessionIds: ['s3'] },
    ],
    archivedSessionIds: ['s2', 's3', 's4'],
    ...overrides,
  };
}

test('buildArchiveCatalog folds archived ids with workspace ownership and titles', () => {
  const titles = new Map([
    ['s2', { title: 'Hello', updatedAt: 20, createdAt: 100 }],
    ['s3', { title: 'World', updatedAt: 10, createdAt: 200 }],
  ]);
  const catalog = buildArchiveCatalog(baseline(), titles);
  assert.equal(catalog.complete, true);
  assert.deepEqual(catalog.workspaces, [
    { workspaceId: 'w1', title: 'Alpha' },
    { workspaceId: 'w2', title: 'Beta' },
  ]);
  assert.deepEqual(catalog.sessions, [
    { sessionId: 's2', title: 'Hello', workspaceId: 'w1', workspaceTitle: 'Alpha', updatedAt: 20, createdAt: 100 },
    { sessionId: 's3', title: 'World', workspaceId: 'w2', workspaceTitle: 'Beta', updatedAt: 10, createdAt: 200 },
    { sessionId: 's4', title: '', workspaceId: '', workspaceTitle: '', updatedAt: 0, createdAt: 0 },
  ]);
});

test('buildArchiveCatalog deduplicates archived ids and tolerates missing titles', () => {
  const catalog = buildArchiveCatalog(baseline({ archivedSessionIds: ['s2', 's2', 's3'] }), new Map());
  assert.deepEqual(catalog.sessions.map(row => row.sessionId), ['s2', 's3']);
  assert.ok(catalog.sessions.every(row => row.title === '' && row.updatedAt === 0 && row.createdAt === 0));
});

test('groupArchivedSessions groups in native workspace order and puts leftover ids last', () => {
  const catalog = buildArchiveCatalog(baseline(), new Map([
    ['s2', { title: 'Hello', updatedAt: 20, createdAt: 100 }],
    ['s3', { title: 'World', updatedAt: 10, createdAt: 200 }],
    ['s4', { title: 'Orphan', updatedAt: 30, createdAt: 300 }],
  ]));
  const groups = groupArchivedSessions(catalog, '', 'Ungrouped');
  assert.deepEqual(groups.map(group => group.title), ['Alpha', 'Beta', 'Ungrouped']);
  assert.deepEqual(groups.map(group => group.sessions.map(row => row.sessionId)), [['s2'], ['s3'], ['s4']]);
});

test('groupArchivedSessions matches title or workspace name and hides empty groups', () => {
  const catalog = buildArchiveCatalog(baseline(), new Map([
    ['s2', { title: 'Hello', updatedAt: 20, createdAt: 100 }],
    ['s3', { title: 'World', updatedAt: 10, createdAt: 200 }],
  ]));
  assert.deepEqual(groupArchivedSessions(catalog, 'world', 'Ungrouped').map(group => group.key), ['w2']);
  assert.deepEqual(groupArchivedSessions(catalog, 'alpha', 'Ungrouped').map(group => group.key), ['w1']);
  assert.deepEqual(groupArchivedSessions(catalog, 'missing', 'Ungrouped'), []);
});

test('groupArchivedSessions keeps only the selected project when filtered', () => {
  const catalog = buildArchiveCatalog(baseline(), new Map([
    ['s2', { title: 'Hello', updatedAt: 20, createdAt: 100 }],
    ['s3', { title: 'World', updatedAt: 10, createdAt: 200 }],
    ['s4', { title: 'Orphan', updatedAt: 30, createdAt: 300 }],
  ]));
  assert.deepEqual(groupArchivedSessions(catalog, '', 'Ungrouped', { projectId: 'w2' }).map(group => group.key), ['w2']);
  assert.deepEqual(groupArchivedSessions(catalog, '', 'Ungrouped', { projectId: 'w1' })
    .flatMap(group => group.sessions.map(row => row.sessionId)), ['s2']);
});

test('groupArchivedSessions sorts each group by updatedAt or createdAt', () => {
  const catalog = buildArchiveCatalog(
    baseline({ items: [{ workspaceId: 'w1', title: 'Alpha', sessionIds: ['s2', 's5'] }], archivedSessionIds: ['s2', 's5'] }),
    new Map([
      ['s2', { title: 'Zeta', updatedAt: 20, createdAt: 500 }],
      ['s5', { title: 'Alpha', updatedAt: 40, createdAt: 100 }],
    ]),
  );
  const ids = (sortBy) => groupArchivedSessions(catalog, '', 'Ungrouped', { sortBy })
    .flatMap(group => group.sessions.map(row => row.sessionId));
  assert.deepEqual(ids('updated'), ['s5', 's2']);
  assert.deepEqual(ids('created'), ['s2', 's5']);
});
