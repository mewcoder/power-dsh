import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AUTO_ARCHIVE_DAYS, AUTO_ARCHIVE_NEVER, idleSince, normalizeDays } from '../auto-archive-policy.ts';

test('the default and every unknown value mean never', () => {
  assert.equal(normalizeDays(0), AUTO_ARCHIVE_NEVER);
  assert.equal(normalizeDays(7), 7);
  assert.equal(normalizeDays(30), 30);
  assert.equal(normalizeDays(45), AUTO_ARCHIVE_NEVER);
  assert.equal(normalizeDays('30'), AUTO_ARCHIVE_NEVER);
  assert.equal(normalizeDays(Number.NaN), AUTO_ARCHIVE_NEVER);
  assert.equal(normalizeDays(undefined), AUTO_ARCHIVE_NEVER);
  assert.deepEqual([...AUTO_ARCHIVE_DAYS], [0, 7, 14, 30, 60, 90]);
});

test('idle time requires a nonblank projection with an actual user prompt', () => {
  assert.equal(idleSince(10, { blank: false, lastPromptAt: 20 }), 20);
  assert.equal(idleSince(30, { blank: false, lastPromptAt: 20 }), 30);
  for (const metadata of [undefined, {}, { blank: true, lastPromptAt: 20 }, { blank: false, lastPromptAt: null }, { blank: false, lastPromptAt: Infinity }]) {
    assert.equal(idleSince(10, metadata), undefined);
  }
  assert.equal(idleSince(0, { blank: false, lastPromptAt: 20 }), undefined);
});
