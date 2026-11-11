import type { UsageDailyModelRow, UsageDayRow, UsageModelRow, UsageSnapshot, UsageSummary } from '../../shared/types/wire.ts';

/** The subset of a durable session event this fold reads. */
export interface UsageEventLike {
  readonly type: string;
  readonly time?: number;
  readonly data?: unknown;
}
/** One readable session log: its header timestamps plus the events to fold. */
export interface UsageSessionLike {
  readonly createdAt?: number;
  readonly events: readonly UsageEventLike[];
}
/** One session's folded contribution; cacheable per session and reporting zone. */
export interface SessionUsageFold {
  days: UsageDayRow[];
  models: UsageModelRow[];
  dailyModels: UsageDailyModelRow[];
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  turnCount: number;
  hasUsage: boolean;
  /** Earliest observed instant for this session, or null when it has no timed events. */
  firstTime: number | null;
  /** Latest observed instant for this session, or null when it has no timed events. */
  lastTime: number | null;
  longestSpanMs: number;

}
export interface UsageMergeInput {
  /** IANA time zone used to bucket days; defaults to UTC when invalid. */
  readonly timeZone: string;
  /** Whether every discovered session could be read. */
  readonly complete: boolean;
  readonly generatedAt: number;
  readonly sessions: readonly SessionUsageFold[];
}

const DAY_MS = 86_400_000;

function emptyDay(date: string): UsageDayRow {
  return { date, totalTokens: 0, turnCount: 0, toolCallCount: 0,
    inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, requestCount: 0, activeMs: 0 };
}

/** Split a recorded interval at reporting-zone midnights, including DST transitions. */
function addRuntime(rows: Map<string, UsageDayRow>, start: number, end: number, toDay: (time: number) => string) {
  let cursor = start;
  while (cursor < end) {
    const date = toDay(cursor);
    let boundary = end;
    if (toDay(end - 1) !== date) {
      let low = cursor;
      let high = end;
      while (high - low > 1) {
        const middle = Math.floor((low + high) / 2);
        if (toDay(middle) === date) low = middle; else high = middle;
      }
      boundary = high;
    }
    const row = rows.get(date) ?? emptyDay(date);
    row.activeMs += boundary - cursor;
    rows.set(date, row);
    cursor = boundary;
  }
}

/**
 * Bucket one instant into a `YYYY-MM-DD` day key in the requested zone.
 * Falls back to UTC when the runtime rejects the zone.
 */
export function dayKeyFormatter(timeZone: string): (time: number) => string {
  const options = { year: 'numeric', month: '2-digit', day: '2-digit' } as const;
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat('en-CA', { ...options, timeZone });
  } catch {
    format = new Intl.DateTimeFormat('en-CA', { ...options, timeZone: 'UTC' });
  }
  return time => {
    const parts = format.formatToParts(new Date(time));
    const pick = (type: string) => parts.find(part => part.type === type)?.value ?? '';
    return `${pick('year')}-${pick('month')}-${pick('day')}`;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Disjoint provider buckets of one settlement; the four parts always sum to the total. */
export interface UsageBuckets {
  inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; totalTokens: number;
}

function bucketsOf(raw: Record<string, unknown>): UsageBuckets {
  const inputTokens = finite(raw.inputTokens);
  const outputTokens = finite(raw.outputTokens);
  const cacheReadTokens = finite(raw.cacheReadTokens);
  const cacheWriteTokens = finite(raw.cacheWriteTokens);
  const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;
  return { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, totalTokens };
}

/** The last usage sample embedded in a settlement stream; usage chunks are never packed. */
function streamUsage(stream: unknown): Record<string, unknown> | null {
  if (!Array.isArray(stream)) return null;
  for (let index = stream.length - 1; index >= 0; index--) {
    const record = stream[index];
    if (!isRecord(record) || record.type !== 'chunk' || !isRecord(record.chunk)) continue;
    if (record.chunk.type !== 'usage' || !isRecord(record.chunk.usage)) continue;
    return record.chunk.usage;
  }
  return null;
}

/**
 * Provider-reported usage of one durable Assistant settlement.
 *
 * A failed or cancelled attempt still billed tokens, so its embedded stream
 * sample counts too; the Host token meter folds both event types.
 */
export function usageOf(event: UsageEventLike): UsageBuckets | null {
  if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt') return null;
  if (!isRecord(event.data)) return null;
  if (isRecord(event.data.usage)) return bucketsOf(event.data.usage);
  const sample = streamUsage(event.data.stream);
  return sample === null ? null : bucketsOf(sample);
}

/** Turn and step that own one settlement; the Host replaces samples within the same slot. */
function settlementOf(event: UsageEventLike): { turn: number; step: number } | null {
  if (!isRecord(event.data)) return null;
  const { turn, step } = event.data;
  return typeof turn === 'number' && Number.isFinite(turn) && typeof step === 'number' && Number.isFinite(step)
    ? { turn, step } : null;
}

type ModelRoute = { provider: string; modelId: string };

function modelRoute(source: unknown): ModelRoute | null {
  if (!isRecord(source) || typeof source.model !== 'string' || !source.model) return null;
  return { provider: typeof source.provider === 'string' ? source.provider : '', modelId: source.model };
}

/** Provider and model that produced one assistant message, when declared. */
export function modelOf(event: UsageEventLike): ModelRoute | null {
  if (event.type !== 'assistant/message' || !isRecord(event.data) || !isRecord(event.data.message)) return null;
  return modelRoute(event.data.message.source);
}

/** Recovery closes an open step immediately before closing its turn at the same timestamp. */
function isSyntheticStepEnd(stepEnd: UsageEventLike, next: UsageEventLike | undefined): boolean {
  if (next?.type !== 'turn/end' || stepEnd.time !== next.time || !isRecord(next.data) || !isRecord(next.data.reason)) return false;
  if (next.data.reason.kind !== 'interrupted' && next.data.reason.kind !== 'forked') return false;
  return !isRecord(stepEnd.data) || stepEnd.data.turn === undefined || stepEnd.data.turn === next.data.turn;
}

function timeOf(event: UsageEventLike): number | null {
  return typeof event.time === 'number' && Number.isFinite(event.time) && event.time > 0 ? event.time : null;
}

function dayDifference(left: string, right: string): number {
  const a = Date.parse(`${left}T00:00:00.000Z`);
  const b = Date.parse(`${right}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN;
  return Math.round((a - b) / DAY_MS);
}

function addDays(dateKey: string, days: number): string {
  const base = Date.parse(`${dateKey}T00:00:00.000Z`);
  if (!Number.isFinite(base)) return dateKey;
  return new Date(base + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Longest run of consecutive active days, and the run that reaches today or
 * yesterday. A single quiet day keeps the current streak alive.
 */
export function streakDays(days: readonly string[], today: string): { current: number; longest: number } {
  const unique = [...new Set(days)].sort();
  let longest = 0;
  let run = 0;
  let previous = '';
  for (const day of unique) {
    run = previous && dayDifference(day, previous) === 1 ? run + 1 : 1;
    previous = day;
    if (run > longest) longest = run;
  }
  let current = 0;
  if (unique.length > 0) {
    const gap = dayDifference(today, unique[unique.length - 1]);
    if (gap === 0 || gap === 1) current = run;
  }
  return { current, longest };
}

/** Fill every quiet day between the first and last activity with a zero row. */
export function fillDays(rows: readonly UsageDayRow[], firstDate: string, lastDate: string): UsageDayRow[] {
  if (!firstDate || !lastDate) return [];
  const known = new Map(rows.map(row => [row.date, row]));
  const total = dayDifference(lastDate, firstDate);
  if (!Number.isFinite(total) || total < 0) return [];
  const days: UsageDayRow[] = [];
  for (let offset = 0; offset <= total; offset++) {
    const date = addDays(firstDate, offset);
    days.push(known.get(date) ?? emptyDay(date));
  }
  return days;
}

/**
 * Fold child-owned session events into cacheable day and model aggregates.
 *
 * Only provider-reported usage from durable Assistant settlements counts.
 * Turns and tool calls are counted independently of usage.
 */
export function foldSession(session: UsageSessionLike, toDay: (time: number) => string): SessionUsageFold {
  const dayRows = new Map<string, UsageDayRow>();
  const modelRows = new Map<string, UsageModelRow>();
  const dailyModelRows = new Map<string, UsageDailyModelRow>();
  const fold: SessionUsageFold = {
    days: [], models: [], dailyModels: [], inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
    totalTokens: 0, turnCount: 0, hasUsage: false, firstTime: null, lastTime: null, longestSpanMs: 0,
  };
  const bump = (time: number, field: 'turnCount' | 'toolCallCount') => {
    const date = toDay(time);
    const row = dayRows.get(date) ?? emptyDay(date);
    row[field] += 1;
    dayRows.set(date, row);
  };
  let activeStart: number | null = null;
  let requestRoute: ModelRoute | null = null;
  type Settlement = { coords: ReturnType<typeof settlementOf>; usage: UsageBuckets; time: number; model: ModelRoute };
  let slot: Settlement | null = null;
  // Aggregate only the final sample of a slot, keeping its day and route together with its usage.
  const flushSlot = () => {
    const settlement = slot;
    slot = null;
    if (!settlement || settlement.usage.totalTokens === 0) return;
    const { time, usage, model: { provider, modelId } } = settlement;
    const date = toDay(time);
    const row = dayRows.get(date) ?? emptyDay(date);
    for (const field of ['totalTokens', 'inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'] as const) {
      row[field] += usage[field];
      fold[field] += usage[field];
    }
    row.requestCount += 1;
    dayRows.set(date, row);
    fold.hasUsage = true;
    const key = `${provider}\u0000${modelId}`;
    const entry = modelRows.get(key) ?? { modelId, provider, totalTokens: 0, requestCount: 0 };
    entry.totalTokens += usage.totalTokens;
    entry.requestCount += 1;
    modelRows.set(key, entry);
    const dayKey = `${date}\u0000${key}`;
    const daily = dailyModelRows.get(dayKey) ?? { date, modelId, provider, totalTokens: 0, requestCount: 0 };
    daily.totalTokens += usage.totalTokens;
    daily.requestCount += 1;
    dailyModelRows.set(dayKey, daily);
  };
  const observe = (time: number) => {
    if (fold.firstTime === null || time < fold.firstTime) fold.firstTime = time;
    if (fold.lastTime === null || time > fold.lastTime) fold.lastTime = time;
  };
  for (const [index, event] of session.events.entries()) {
    const time = timeOf(event);
    if (time !== null) observe(time);
    if (event.type === 'step/start') {
      activeStart = time;
    } else if (event.type === 'step/end') {
      if (activeStart !== null && time !== null && time > activeStart
        && !isSyntheticStepEnd(event, session.events[index + 1])) {
        addRuntime(dayRows, activeStart, time, toDay);
      }
      activeStart = null;
    } else if (event.type === 'turn/end' || event.type === 'turn/start') {
      activeStart = null;
      if (event.type === 'turn/start') {
        fold.turnCount += 1;
        if (time !== null) bump(time, 'turnCount');
      }
    } else if (event.type === 'request/context') {
      // The loop only logs changes to the effective route; a known route persists until superseded.
      const route = modelRoute(event.data);
      requestRoute = route?.provider ? route : null;
    } else if (event.type === 'llm/retry-started') {
      const retried = settlementOf(event);
      if (retried && slot?.coords?.turn === retried.turn && slot.coords.step === retried.step) flushSlot();
    } else if (event.type === 'assistant/message' || event.type === 'assistant/attempt') {
      const usage = usageOf(event);
      if (!usage || time === null) continue;
      const coords = settlementOf(event);
      if (!coords || slot?.coords?.turn !== coords.turn || slot.coords.step !== coords.step) flushSlot();
      slot = { coords, time, usage, model: modelOf(event) ?? requestRoute ?? { provider: '', modelId: '' } };
      if (!coords) flushSlot();
    } else if (event.type === 'tool/call' && time !== null) {
      bump(time, 'toolCallCount');
    }
  }
  flushSlot();
  if (fold.firstTime !== null && fold.lastTime !== null) {
    const start = typeof session.createdAt === 'number' && session.createdAt > 0
      ? Math.min(session.createdAt, fold.firstTime) : fold.firstTime;
    fold.longestSpanMs = Math.max(0, fold.lastTime - start);
  }
  fold.days = [...dayRows.values()].sort((left, right) => left.date.localeCompare(right.date));
  fold.models = [...modelRows.values()];
  fold.dailyModels = [...dailyModelRows.values()]
    .sort((left, right) => left.date.localeCompare(right.date) || left.modelId.localeCompare(right.modelId));
  return fold;
}

/**
 * Merge per-session folds into the lifetime projection shown by the page.
 * Days are bucketed in the caller's zone, so the same logs can report
 * different day boundaries for different clients.
 */
export function mergeUsage(input: UsageMergeInput): UsageSnapshot {
  const dayRows = new Map<string, UsageDayRow>();
  const modelRows = new Map<string, UsageModelRow>();
  const dailyModelRows = new Map<string, UsageDailyModelRow>();
  const summary: UsageSummary = {
    totalTokens: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
    peakDayTokens: 0, longestSessionMs: 0, currentStreakDays: 0, longestStreakDays: 0,
    activeDays: 0, sessionCount: 0, turnCount: 0,
  };
  const toDay = dayKeyFormatter(input.timeZone);
  let firstDate = '';
  let lastDate = '';
  for (const session of input.sessions) {
    for (const row of session.days) {
      const target = dayRows.get(row.date)
        ?? emptyDay(row.date);
      target.totalTokens += row.totalTokens;
      target.turnCount += row.turnCount;
      target.toolCallCount += row.toolCallCount;
      target.inputTokens += row.inputTokens;
      target.outputTokens += row.outputTokens;
      target.cacheReadTokens += row.cacheReadTokens;
      target.cacheWriteTokens += row.cacheWriteTokens;
      target.requestCount += row.requestCount;
      target.activeMs += row.activeMs;
      dayRows.set(row.date, target);
    }
    for (const model of session.models) {
      const key = `${model.provider}\u0000${model.modelId}`;
      const target = modelRows.get(key) ?? { modelId: model.modelId, provider: model.provider, totalTokens: 0, requestCount: 0 };
      target.totalTokens += model.totalTokens;
      target.requestCount += model.requestCount;
      modelRows.set(key, target);
    }
    for (const daily of session.dailyModels) {
      const key = `${daily.date}\u0000${daily.provider}\u0000${daily.modelId}`;
      const target = dailyModelRows.get(key)
        ?? { date: daily.date, modelId: daily.modelId, provider: daily.provider, totalTokens: 0, requestCount: 0 };
      target.totalTokens += daily.totalTokens;
      target.requestCount += daily.requestCount;
      dailyModelRows.set(key, target);
    }
    summary.totalTokens += session.totalTokens;
    summary.inputTokens += session.inputTokens;
    summary.outputTokens += session.outputTokens;
    summary.cacheReadTokens += session.cacheReadTokens;
    summary.cacheWriteTokens += session.cacheWriteTokens;
    summary.turnCount += session.turnCount;
    if (session.days.length > 0) summary.sessionCount += 1;
    if (session.longestSpanMs > summary.longestSessionMs) summary.longestSessionMs = session.longestSpanMs;
    if (session.firstTime !== null) {
      const first = toDay(session.firstTime);
      if (!firstDate || first < firstDate) firstDate = first;
    }
    if (session.lastTime !== null) {
      const last = toDay(session.lastTime);
      if (!lastDate || last > lastDate) lastDate = last;
    }
  }
  const rows = [...dayRows.values()].sort((left, right) => left.date.localeCompare(right.date));
  for (const row of rows) if (row.totalTokens > summary.peakDayTokens) summary.peakDayTokens = row.totalTokens;
  summary.activeDays = rows.filter(row => row.totalTokens > 0).length;
  const streak = streakDays(rows.filter(row => row.totalTokens > 0).map(row => row.date), toDay(input.generatedAt));
  summary.currentStreakDays = streak.current;
  summary.longestStreakDays = streak.longest;
  return {
    complete: input.complete,
    generatedAt: input.generatedAt,
    timeZone: input.timeZone,
    firstDate,
    lastDate,
    summary,
    sessionDays: input.sessions.map(session => session.days.map(row => row.date)).filter(dates => dates.length > 0),
    days: fillDays(rows, firstDate, lastDate),
    dailyModels: [...dailyModelRows.values()]
      .sort((left, right) => left.date.localeCompare(right.date) || left.modelId.localeCompare(right.modelId)),
    models: [...modelRows.values()].sort((left, right) => right.totalTokens - left.totalTokens
      || left.modelId.localeCompare(right.modelId)),
  };
}
