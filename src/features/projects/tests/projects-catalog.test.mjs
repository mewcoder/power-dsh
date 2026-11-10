import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arrangeProjects, buildProjectCatalog, relativeTime } from '../projects-catalog.ts';

function baseline(overrides = {}) {
  return {
    items: [
      { workspaceId: 'w1', title: 'Alpha', path: '/work/alpha', sessionIds: ['s1', 's2'] },
      { workspaceId: 'w2', title: 'Beta', path: '/work/beta', sessionIds: ['s3'] },
      { workspaceId: 'w3', title: 'Gamma', path: '/work/gamma', sessionIds: [] },
    ],
    ...overrides,
  };
}

test('buildProjectCatalog keeps native registry order with counts and latest activity', () => {
  const catalog = buildProjectCatalog(baseline(), new Map([
    ['s1', { lastActiveAt: 10 }],
    ['s2', { lastActiveAt: 40 }],
    ['s3', { lastActiveAt: 25 }],
  ]));
  assert.equal(catalog.complete, true);
  assert.deepEqual(catalog.projects, [
    { workspaceId: 'w1', title: 'Alpha', path: '/work/alpha', sessionCount: 2, lastActiveAt: 40 },
    { workspaceId: 'w2', title: 'Beta', path: '/work/beta', sessionCount: 1, lastActiveAt: 25 },
    { workspaceId: 'w3', title: 'Gamma', path: '/work/gamma', sessionCount: 0, lastActiveAt: 0 },
  ]);
});

test('buildProjectCatalog tolerates a baseline without paths or activity', () => {
  const catalog = buildProjectCatalog({ items: [{ workspaceId: 'w1', title: 'Alpha', sessionIds: ['s1'] }] }, new Map());
  assert.deepEqual(catalog.projects, [
    { workspaceId: 'w1', title: 'Alpha', path: '', sessionCount: 1, lastActiveAt: 0 },
  ]);
});

test('arrangeProjects sorts by latest activity and keeps registry order for ties', () => {
  const catalog = buildProjectCatalog(baseline(), new Map([
    ['s1', { lastActiveAt: 10 }], ['s2', { lastActiveAt: 10 }], ['s3', { lastActiveAt: 30 }],
  ]));
  assert.deepEqual(arrangeProjects(catalog, '').map(row => row.workspaceId), ['w2', 'w1', 'w3'],
    'A never-used project trails dated ones and the tie keeps registry order.');
});

test('arrangeProjects keeps registry order in manual mode', () => {
  const catalog = buildProjectCatalog(baseline(), new Map([['s3', { lastActiveAt: 99 }]]));
  assert.deepEqual(arrangeProjects(catalog, '', 'manual').map(row => row.workspaceId), ['w1', 'w2', 'w3']);
});

test('arrangeProjects searches the title and the directory path', () => {
  const catalog = buildProjectCatalog(baseline(), new Map());
  assert.deepEqual(arrangeProjects(catalog, 'beta').map(row => row.workspaceId), ['w2']);
  assert.deepEqual(arrangeProjects(catalog, '/WORK/GAMMA').map(row => row.workspaceId), ['w3']);
  assert.deepEqual(arrangeProjects(catalog, 'missing'), []);
  assert.deepEqual(arrangeProjects(catalog, '  ').map(row => row.workspaceId), ['w1', 'w2', 'w3']);
});

test('relativeTime mirrors the native session-row buckets', () => {
  const now = 1_000_000_000_000;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  assert.deepEqual(relativeTime(now, now), { unit: 'now', n: 0 });
  assert.deepEqual(relativeTime(now - 5 * minute, now), { unit: 'minutes', n: 5 });
  assert.deepEqual(relativeTime(now - 3 * hour, now), { unit: 'hours', n: 3 });
  assert.deepEqual(relativeTime(now - 2 * day, now), { unit: 'days', n: 2 });
  assert.deepEqual(relativeTime(now - 40 * day, now), { unit: 'months', n: 1 });
  assert.deepEqual(relativeTime(now - 400 * day, now), { unit: 'years', n: 1 });
  assert.deepEqual(relativeTime(now + 10 * day, now), { unit: 'now', n: 0 }, 'Clock skew never renders a future distance.');
});
