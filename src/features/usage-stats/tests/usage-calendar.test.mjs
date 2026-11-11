import assert from 'node:assert/strict';
import { test } from 'node:test';
import { monthCells, rangeAfterClick, shiftMonth } from '../usage-calendar.ts';

test('calendar date arithmetic handles leap days, year boundaries and reverse selections', () => {
  const february = monthCells('2024-02');
  assert.equal(february.length, 42);
  assert.equal(february[0], '2024-01-29');
  assert.equal(february.at(-1), '2024-03-10');
  assert.ok(february.includes('2024-02-29'));
  assert.equal(shiftMonth('2024-01-31', 1), '2024-02-29');
  assert.equal(shiftMonth('2024-02-29', 12), '2025-02-28');
  assert.equal(shiftMonth('2026-12-15', 1), '2027-01-15');
  assert.deepEqual(monthCells('2026-13'), []);
  const anchor = rangeAfterClick({ start: '2026-03-01', end: '2026-03-03' }, '2026-02-28');
  assert.deepEqual(anchor, { start: '2026-02-28', end: '' });
  assert.deepEqual(rangeAfterClick(anchor, '2026-02-20'), { start: '2026-02-20', end: '2026-02-28' });
});
