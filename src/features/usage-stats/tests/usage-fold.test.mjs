import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dayKeyFormatter, fillDays, foldSession, mergeUsage, streakDays, usageOf,
} from '../usage-fold.ts';

const DAY = 86_400_000;
const at = (date) => Date.parse(`${date}T12:00:00.000Z`);

// One model request settles in its own step, so every helper message gets a fresh slot.
let nextStep = 0;
function assistant(time, usage, model = { provider: 'magpie', model: 'group/flash' }) {
  nextStep += 1;
  return { type: 'assistant/message', time, data: { turn: 1, step: nextStep, usage, message: { source: { kind: 'model', ...model } } } };
}

test('usageOf sums the four disjoint buckets without relying on a separate total', () => {
  assert.deepEqual(usageOf(assistant(1, { inputTokens: 10, outputTokens: 5, totalTokens: 30, cacheReadTokens: 12, cacheWriteTokens: 3 })),
    { inputTokens: 10, outputTokens: 5, cacheReadTokens: 12, cacheWriteTokens: 3, totalTokens: 30 });
  assert.equal(usageOf(assistant(1, { inputTokens: 10, outputTokens: 5 })).totalTokens, 15);
  assert.equal(usageOf(assistant(1, { inputTokens: 10, outputTokens: 5, cacheReadTokens: 80, cacheWriteTokens: 5, totalTokens: 999 })).totalTokens, 100);
  assert.equal(usageOf(assistant(1, { inputTokens: 10, outputTokens: 5, cacheReadTokens: 100 })).totalTokens, 115);
  assert.equal(usageOf({ type: 'assistant/message', time: 1, data: {} }), null);
  assert.equal(usageOf({ type: 'turn/start', time: 1, data: {} }), null);
  assert.equal(usageOf(assistant(1, { inputTokens: 0, outputTokens: 0 })).totalTokens, 0,
    'An explicit zero sample can replace an earlier sample; an absent sample cannot.');
  const attempt = stream => ({ type: 'assistant/attempt', time: 1, data: { turn: 1, step: 1, stream } });
  assert.deepEqual(usageOf(attempt([{ type: 'chunk', time: 1, chunk: { type: 'usage', usage: { inputTokens: 4, outputTokens: 1, cacheReadTokens: 2 } } }])),
    { inputTokens: 4, outputTokens: 1, cacheReadTokens: 2, cacheWriteTokens: 0, totalTokens: 7 },
    'A settlement without inline usage still bills its last streamed sample.');
  assert.equal(usageOf(attempt([{ type: 'text-chunks', texts: ['hi'] }])), null, 'A stream without usage carries no accounting.');
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
      { type: 'turn/end', time: at('2026-03-01'), data: { turn: 1 } },
      { type: 'tool/call', time: at('2026-03-02'), data: {} },
      { type: 'turn/start', time: at('2026-03-02'), data: { turn: 2 } },
      assistant(at('2026-03-02'), { inputTokens: 50, outputTokens: 10, totalTokens: 60 }, { provider: 'magpie', model: 'group/sol' }),
    ],
  }, toDay);
  assert.equal(fold.hasUsage, true);
  assert.equal(fold.totalTokens, 180);
  assert.equal(fold.turnCount, 2);
  assert.deepEqual(fold.days, [
    { date: '2026-03-01', totalTokens: 120, turnCount: 1, toolCallCount: 1,
      inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0, requestCount: 1, activeMs: 0 },
    { date: '2026-03-02', totalTokens: 60, turnCount: 1, toolCallCount: 1,
      inputTokens: 50, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0, requestCount: 1, activeMs: 0 },
  ]);
  assert.deepEqual(fold.models.map(row => [row.modelId, row.totalTokens, row.requestCount]).sort(),
    [['group/flash', 120, 1], ['group/sol', 60, 1]]);
  assert.deepEqual(fold.dailyModels.map(row => [row.date, row.modelId, row.totalTokens, row.requestCount]), [
    ['2026-03-01', 'group/flash', 120, 1],
    ['2026-03-02', 'group/sol', 60, 1],
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
  assert.deepEqual(filled[1], { date: '2026-03-02', totalTokens: 0, turnCount: 0, toolCallCount: 0,
    inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, requestCount: 0, activeMs: 0 });
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
  assert.deepEqual(snapshot.dailyModels.map(row => [row.date, row.modelId, row.totalTokens, row.requestCount]), [
    ['2026-03-01', 'group/flash', 100, 1],
    ['2026-03-02', 'group/flash', 500, 1],
    ['2026-03-02', 'group/sol', 15, 1],
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

test('calls follow the billed settlements the Host token meter counts', () => {
  const time = at('2026-03-01');
  const fold = foldSession({ events: [
    assistant(time, { inputTokens: 0, outputTokens: 0 }),
    { type: 'assistant/message', time: time + 1, data: {} },
    assistant(time + 2, { inputTokens: 10, outputTokens: 5, cacheReadTokens: 80, cacheWriteTokens: 5, totalTokens: 999 }),
  ] }, dayKeyFormatter('UTC'));
  assert.equal(fold.days[0].requestCount, 1, 'A settlement without billed usage is not a counted call.');
  assert.equal(fold.days[0].totalTokens, 100);
  assert.equal(fold.days[0].inputTokens + fold.days[0].cacheReadTokens + fold.days[0].cacheWriteTokens + fold.days[0].outputTokens, 100);
});

test('retried attempts add their billed usage while samples in one attempt are replaced', () => {
  const time = at('2026-03-01');
  const streamUsage = (inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens = 0) =>
    [{ type: 'chunk', time, chunk: { type: 'usage', usage: { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens } } }];
  const fold = foldSession({ events: [
    { type: 'step/start', time },
    { type: 'assistant/attempt', time, data: { turn: 1, step: 1, stream: streamUsage(10, 2, 3) } },
    { type: 'llm/retry-started', time, data: { turn: 1, step: 1 } },
    { type: 'assistant/message', time, data: { turn: 1, step: 1, usage: { inputTokens: 14, outputTokens: 5, cacheReadTokens: 8, cacheWriteTokens: 1 } } },
    { type: 'step/end', time: time + 1 },
  ] }, dayKeyFormatter('UTC'));
  assert.deepEqual(fold.days[0], {
    date: '2026-03-01', totalTokens: 43, turnCount: 0, toolCallCount: 0,
    inputTokens: 24, outputTokens: 7, cacheReadTokens: 11, cacheWriteTokens: 1, requestCount: 2, activeMs: 1,
  });
  const replaced = foldSession({ events: [
    { type: 'assistant/attempt', time, data: { turn: 2, step: 1, stream: streamUsage(5, 1, 0) } },
    { type: 'assistant/message', time, data: { turn: 2, step: 1, usage: { inputTokens: 9, outputTokens: 2, cacheReadTokens: 4 },
      message: { source: { kind: 'model', provider: 'magpie', model: 'group/flash' } } } },
  ] }, dayKeyFormatter('UTC'));
  assert.equal(replaced.days[0].totalTokens, 15, 'A later sample in the same slot replaces the earlier one.');
  assert.equal(replaced.days[0].requestCount, 1);
  assert.deepEqual(replaced.models, [{ modelId: 'group/flash', provider: 'magpie', totalTokens: 15, requestCount: 1 }]);
});

test('same-slot replacement uses the final four buckets, day and model, and can clear a slot', () => {
  const day1 = at('2026-03-01');
  const day2 = at('2026-03-02');
  const sample = (time, step, model, usage) => ({ type: 'assistant/message', time, data: {
    turn: 1, step, message: { source: { provider: 'p', model } }, usage,
  } });
  const fold = foldSession({ events: [
    sample(day1, 1, 'old', { inputTokens: 80, outputTokens: 5, cacheReadTokens: 10, cacheWriteTokens: 2 }),
    sample(day2, 1, 'final', { inputTokens: 3, outputTokens: 1, cacheReadTokens: 20 }),
    sample(day2, 1, 'final', { inputTokens: 3, outputTokens: 1, cacheReadTokens: 20 }),
    sample(day2, 2, 'cleared', { inputTokens: 4 }),
    sample(day2, 2, 'cleared', { inputTokens: 0 }),
    sample(day2, 3, 'kept', { inputTokens: 1 }),
    sample(day2, 3, 'kept', undefined),
  ] }, dayKeyFormatter('UTC'));
  assert.deepEqual(fold.days, [{ date: '2026-03-02', totalTokens: 25, turnCount: 0, toolCallCount: 0,
    inputTokens: 4, outputTokens: 1, cacheReadTokens: 20, cacheWriteTokens: 0, requestCount: 2, activeMs: 0 }]);
  assert.equal(fold.totalTokens, 25);
  assert.deepEqual(fold.dailyModels.map(row => [row.date, row.modelId, row.totalTokens, row.requestCount]), [
    ['2026-03-02', 'final', 24, 1], ['2026-03-02', 'kept', 1, 1],
  ]);
  assert.deepEqual(fold.models.map(row => [row.modelId, row.totalTokens, row.requestCount]), [['final', 24, 1], ['kept', 1, 1]]);
});

test('attempts use the recorded request route, never a nearby reply, and retain unknown usage', () => {
  const time = at('2026-03-01');
  const atStep = (type, step, data) => ({ type, time, data: { turn: 1, step, ...data } });
  const failure = (step, inputTokens) => atStep('assistant/attempt', step, { stream: [
    { type: 'chunk', chunk: { type: 'usage', usage: { inputTokens } } },
  ] });
  const reply = (step, model, inputTokens) => atStep('assistant/message', step, {
    message: { source: { provider: 'p', model } }, usage: { inputTokens },
  });
  const route = model => ({ type: 'request/context', time, data: { provider: 'p', model } });
  const fold = foldSession({ events: [
    reply(1, 'prior', 1), failure(2, 2),
    route('request-a'), failure(3, 3), atStep('llm/retry-started', 3), failure(3, 4),
    atStep('llm/retry-started', 3), route('request-b'), reply(3, 'request-b', 5),
    failure(4, 6),
  ] }, dayKeyFormatter('UTC'));
  assert.equal(fold.days[0].requestCount, 6);
  const rows = fold.dailyModels.map(row => [row.provider, row.modelId, row.totalTokens, row.requestCount]);
  assert.deepEqual(rows, [['', '', 2, 1], ['p', 'prior', 1, 1], ['p', 'request-a', 7, 2], ['p', 'request-b', 11, 2]]);
  assert.equal(rows.reduce((sum, row) => sum + row[2], 0), fold.totalTokens);
});
