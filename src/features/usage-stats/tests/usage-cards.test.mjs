import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayKeyFormatter, foldSession, mergeUsage } from '../usage-fold.ts';
import { READ_USAGE_STATS_RPC } from '../rpc.ts';

const minute = 60_000;
const at = text => Date.parse(text);
const event = (type, time, data = {}) => ({ type, time, data });
const usage = (time, totalTokens) => event('assistant/message', time, {
  turn: 1, step: 1, usage: { inputTokens: totalTokens - 1, outputTokens: 1, totalTokens },
});

test('runtime splits completed steps at the report midnight and excludes time between steps', () => {
  const start = at('2026-11-10T15:59:00Z');
  const fold = foldSession({ events: [
    event('step/start', start), usage(start + minute, 20), event('step/end', start + 2 * minute),
    event('step/start', start + 6 * 60 * minute), event('step/end', start + 6 * 60 * minute + minute),
  ] }, dayKeyFormatter('Asia/Shanghai'));
  assert.deepEqual(fold.days.map(day => [day.date, day.activeMs]), [
    ['2026-11-10', minute], ['2026-11-11', 2 * minute],
  ]);
  const report = mergeUsage({ sessions: [fold], timeZone: 'Asia/Shanghai', generatedAt: start + 7 * 60 * minute, complete: true });
  assert.deepEqual(report.sessionDays, [['2026-11-10', '2026-11-11']]);
  assert.equal(report.summary.sessionCount, 1, 'One session remains one session over multiple days.');
  assert.equal(report.days.reduce((sum, day) => sum + day.activeMs, 0), 3 * minute);
});

test('runtime uses real elapsed time on a daylight saving transition and waits for incomplete steps', () => {
  const start = at('2026-03-08T05:00:00Z');
  const fold = foldSession({ events: [
    event('step/start', start), event('step/end', start + 23 * 60 * minute),
  ] }, dayKeyFormatter('America/New_York'));
  assert.deepEqual(fold.days.map(day => [day.date, day.activeMs]), [['2026-03-08', 23 * 60 * minute]]);
  const unfinished = foldSession({ events: [
    event('step/start', start), usage(start + minute, 10),
    event('step/start', start + 24 * 60 * minute), usage(start + 24 * 60 * minute + 2 * minute, 20),
  ] }, dayKeyFormatter('UTC'));
  assert.equal(unfinished.days.reduce((sum, day) => sum + day.activeMs, 0), 0);
});

test('runtime excludes synthetic step ends without dropping completed steps in the repaired turn', () => {
  const start = at('2026-11-10T12:00:00Z');
  for (const kind of ['interrupted', 'forked']) {
    const fold = foldSession({ events: [
      event('turn/start', start, { turn: 1 }),
      event('step/start', start, { turn: 1, step: 1 }),
      event('step/end', start + minute, { turn: 1, step: 1 }),
      event('step/start', start + 2 * minute, { turn: 1, step: 2 }),
      event('tool/call', start + 6 * minute, { turn: 1, step: 2 }),
      event('step/end', start + 6 * minute, { turn: 1, step: 2 }),
      event('turn/end', start + 6 * minute, { turn: 1, reason: { kind } }),
      event('turn/start', start + 7 * minute, { turn: 2 }),
      event('step/start', start + 7 * minute, { turn: 2, step: 1 }),
      event('step/end', start + 9 * minute, { turn: 2, step: 1 }),
      event('turn/end', start + 9 * minute, { turn: 2, reason: { kind: 'aborted' } }),
    ] }, dayKeyFormatter('UTC'));
    assert.equal(fold.days[0].activeMs, 3 * minute, `Only recorded completions count (${kind}).`);
  }
});

test('card codec validates the added counters and projects no event payloads or session identifiers', () => {
  const generatedAt = at('2026-11-10T12:00:00Z');
  const fold = foldSession({ events: [usage(generatedAt, 10)] }, dayKeyFormatter('UTC'));
  const report = mergeUsage({ sessions: [fold], timeZone: 'UTC', generatedAt, complete: true });
  const codec = READ_USAGE_STATS_RPC.result.create();
  const parsed = codec.parse({ ...report, rawMessages: ['private'], sessionIds: ['private'] });
  assert.equal(parsed.days[0].requestCount, 1);
  assert.equal(parsed.last24Hours, undefined);
  assert.equal(parsed.rawMessages, undefined);
  assert.equal(parsed.sessionIds, undefined);
  assert.equal(parsed.usagePoints, undefined);
  for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, '4']) {
    assert.throws(() => codec.parse({ ...report, days: [{ ...report.days[0], activeMs: bad }] }), /Invalid usage day/);
  }
  assert.throws(() => codec.parse({ ...report, sessionDays: [['not-a-date']] }), /Invalid usage sessions/);
  const daily = { ...report.dailyModels[0], requestCount: '2' };
  assert.throws(() => codec.parse({ ...report, dailyModels: [daily] }), /Invalid usage daily model/);
});

test('runtime excludes turn setup and gaps between completed steps', () => {
  const start = at('2026-11-10T12:00:00Z');
  const fold = foldSession({ events: [
    event('turn/start', start),
    event('step/start', start + minute), event('step/end', start + 2 * minute),
    event('step/start', start + 10 * minute), event('step/end', start + 12 * minute),
    event('turn/end', start + 20 * minute),
  ] }, dayKeyFormatter('UTC'));
  assert.equal(fold.days[0].activeMs, 3 * minute);
});
