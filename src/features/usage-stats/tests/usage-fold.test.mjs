import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dayKeyFormatter, fillDays, foldSession, mergeUsage, streakDays, usageOf,
} from '../usage-fold.ts';

const DAY = 86_400_000;
const at = (date) => Date.parse(`${date}T12:00:00.000Z`);

function assistant(time, usage, model = { provider: 'magpie', model: 'group/flash' }) {
  return { type: 'assistant/message', time, data: { turn: 1, step: 1, usage, message: { source: { kind: 'model', ...model } } } };
}

test('usageOf reads provider accounting and falls back to the component sum', () => {
  assert.deepEqual(usageOf(assistant(1, { inputTokens: 10, outputTokens: 5, totalTokens: 30, cacheReadTokens: 12, cacheWriteTokens: 3 })),
    { inputTokens: 10, outputTokens: 5, cacheReadTokens: 12, cacheWriteTokens: 3, totalTokens: 30 });
  assert.equal(usageOf(assistant(1, { inputTokens: 10, outputTokens: 5 })).totalTokens, 15);
  assert.equal(usageOf(assistant(1, { inputTokens: 10, outputTokens: 5, cacheReadTokens: 100 })).totalTokens, 115);
  assert.equal(usageOf({ type: 'assistant/message', time: 1, data: {} }), null);
  assert.equal(usageOf({ type: 'turn/start', time: 1, data: {} }), null);
  assert.equal(usageOf(assistant(1, { inputTokens: 0, outputTokens: 0 })), null, 'A zero-only sample is not usage.');
  assert.equal(usageOf(assistant(1, { inputTokens: -4, outputTokens: 5 })).totalTokens, 5, 'Negative counters are discarded.');
});

test('foldSession buckets tokens, turns and tools per day in the requested zone', () => {
  const toDay = dayKeyFormatter('UTC');
  const fold = foldSession({
    createdAt: at('2026-03-01'),
    events: [
      { type: 'turn/start', time: at('2026-03-01'), data: { turn: 1 } },
      assistant(at('2026-03-01'), { inputTokens: 100, outputTokens: 20, totalTokens: 120 }),
      { type: 'tool/call', time: at('2026-03-01'), data: {} },
      { type: 'tool/call', time: at('2026-03-02'), data: {} },
      { type: 'turn/start', time: at('2026-03-02'), data: { turn: 2 } },
      assistant(at('2026-03-02'), { inputTokens: 50, outputTokens: 10, totalTokens: 60 }, { provider: 'magpie', model: 'group/sol' }),
    ],
  }, toDay);
  assert.equal(fold.hasUsage, true);
  assert.equal(fold.totalTokens, 180);
  assert.equal(fold.turnCount, 2);
  assert.deepEqual(fold.days, [
    { date: '2026-03-01', totalTokens: 120, turnCount: 1, toolCallCount: 1 },
    { date: '2026-03-02', totalTokens: 60, turnCount: 1, toolCallCount: 1 },
  ]);
  assert.deepEqual(fold.models.map(row => [row.modelId, row.totalTokens, row.requestCount]).sort(),
    [['group/flash', 120, 1], ['group/sol', 60, 1]]);
  assert.deepEqual(fold.dailyModels.map(row => [row.date, row.modelId, row.totalTokens]), [
    ['2026-03-01', 'group/flash', 120],
    ['2026-03-02', 'group/sol', 60],
  ]);
  assert.equal(fold.longestSpanMs, DAY, 'The span runs from creation to the last event.');
});

test('dayKeyFormatter buckets by the requested zone instead of UTC', () => {
  const utc = dayKeyFormatter('UTC');
  const shanghai = dayKeyFormatter('Asia/Shanghai');
  // 17:30Z is already the next calendar day in Asia/Shanghai.
  const time = Date.parse('2026-03-01T17:30:00.000Z');
  assert.equal(utc(time), '2026-03-01');
  assert.equal(shanghai(time), '2026-03-02');
  assert.equal(dayKeyFormatter('Not/AZone')(time), '2026-03-01', 'An unknown zone falls back to UTC.');
});

test('streakDays counts consecutive active days and tolerates one quiet day', () => {
  assert.deepEqual(streakDays([], '2026-03-10'), { current: 0, longest: 0 });
  assert.deepEqual(streakDays(['2026-03-08', '2026-03-09', '2026-03-10'], '2026-03-10'), { current: 3, longest: 3 });
  assert.deepEqual(streakDays(['2026-03-08', '2026-03-09'], '2026-03-10'), { current: 2, longest: 2 },
    'A quiet day after the last active day keeps the streak alive.');
  assert.deepEqual(streakDays(['2026-03-01', '2026-03-02', '2026-03-07', '2026-03-08', '2026-03-09'], '2026-03-12'),
    { current: 0, longest: 3 }, 'Two quiet days end the current streak.');
  assert.deepEqual(streakDays(['2026-03-01', '2026-03-01', '2026-03-02'], '2026-03-02'), { current: 2, longest: 2 },
    'Duplicate days count once.');
});

test('fillDays inserts quiet days between the first and last activity', () => {
  const rows = [{ date: '2026-03-01', totalTokens: 5, turnCount: 1, toolCallCount: 0 }];
  const filled = fillDays(rows, '2026-03-01', '2026-03-04');
  assert.deepEqual(filled.map(row => row.date), ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04']);
  assert.deepEqual(filled[1], { date: '2026-03-02', totalTokens: 0, turnCount: 0, toolCallCount: 0 });
  assert.deepEqual(fillDays([], '', ''), []);
});

test('mergeUsage combines sessions, keeps the peak day and orders models', () => {
  const toDay = dayKeyFormatter('UTC');
  const first = foldSession({ createdAt: at('2026-03-01'), events: [
    assistant(at('2026-03-01'), { inputTokens: 90, outputTokens: 10, totalTokens: 100 }),
  ] }, toDay);
  const second = foldSession({ createdAt: at('2026-03-02'), events: [
    assistant(at('2026-03-02'), { inputTokens: 400, outputTokens: 100, totalTokens: 500 }),
    assistant(at('2026-03-02'), { inputTokens: 10, outputTokens: 5, totalTokens: 15 }, { provider: 'magpie', model: 'group/sol' }),
  ] }, toDay);
  const snapshot = mergeUsage({
    timeZone: 'UTC', complete: false, generatedAt: at('2026-03-03'), sessions: [first, second],
  });
  assert.equal(snapshot.complete, false);
  assert.equal(snapshot.timeZone, 'UTC');
  assert.equal(snapshot.firstDate, '2026-03-01');
  assert.equal(snapshot.lastDate, '2026-03-02');
  assert.equal(snapshot.summary.totalTokens, 615);
  assert.equal(snapshot.summary.inputTokens, 500);
  assert.equal(snapshot.summary.outputTokens, 115);
  assert.equal(snapshot.summary.peakDayTokens, 515);
  assert.equal(snapshot.summary.activeDays, 2);
  assert.equal(snapshot.summary.sessionCount, 2);
  assert.equal(snapshot.summary.currentStreakDays, 2, 'The streak runs through the generated date.');
  assert.equal(snapshot.summary.longestStreakDays, 2);
  assert.deepEqual(snapshot.days.map(row => row.totalTokens), [100, 515]);
  assert.deepEqual(snapshot.models.map(row => [row.modelId, row.totalTokens]), [['group/flash', 600], ['group/sol', 15]],
    'Models are ordered by total tokens, largest first.');
  assert.deepEqual(snapshot.dailyModels.map(row => [row.date, row.modelId, row.totalTokens]), [
    ['2026-03-01', 'group/flash', 100],
    ['2026-03-02', 'group/flash', 500],
    ['2026-03-02', 'group/sol', 15],
  ]);
});

test('mergeUsage reports an empty history without inventing days', () => {
  const snapshot = mergeUsage({ timeZone: 'UTC', complete: true, generatedAt: at('2026-03-03'), sessions: [] });
  assert.equal(snapshot.firstDate, '');
  assert.equal(snapshot.lastDate, '');
  assert.deepEqual(snapshot.days, []);
  assert.deepEqual(snapshot.models, []);
  assert.deepEqual(snapshot.dailyModels, []);
  assert.equal(snapshot.summary.totalTokens, 0);
  assert.equal(snapshot.summary.currentStreakDays, 0);
});
