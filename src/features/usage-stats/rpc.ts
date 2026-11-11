import { isRecord, isArray, hasStrings, type Codec, type RpcDescriptor } from '../../shared/types/protocol.ts';
import type { UsageSnapshot } from '../../shared/types/wire.ts';
export type { UsageCardSummary, UsageSnapshot, UsageSummary, UsageDayRow, UsageDailyModelRow, UsageModelRow } from '../../shared/types/wire.ts';
import { stringCodec } from '../../shared/rpc/codecs.ts';

const usageSnapshotCodec: Codec<UsageSnapshot> = {
  mode: 'strict', typeSymbol: 'power-dsh#UsageSnapshot',
  create: () => ({ parse(value) {
    if (!isRecord(value) || typeof value.complete !== 'boolean'
      || typeof value.generatedAt !== 'number' || !Number.isFinite(value.generatedAt)
      || !hasStrings(value, ['timeZone', 'firstDate', 'lastDate'])
      || !isRecord(value.summary) || !isArray(value.days) || !isArray(value.dailyModels) || !isArray(value.models)) {
      throw new TypeError('Invalid usage snapshot');
    }
    if (!isArray(value.sessionDays)) throw new TypeError('Invalid usage sessions');
    const sessionDays = value.sessionDays.map(dates => {
      if (!isArray(dates) || !dates.every(date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date))) {
        throw new TypeError('Invalid usage sessions');
      }
      return dates as string[];
    });
    const summary = value.summary;
    const fields = ['totalTokens', 'inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens',
      'peakDayTokens', 'longestSessionMs', 'currentStreakDays', 'longestStreakDays', 'activeDays',
      'sessionCount', 'turnCount'] as const;
    const counts: Record<string, number> = {};
    for (const field of fields) {
      const count = summary[field];
      if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) throw new TypeError('Invalid usage summary');
      counts[field] = count;
    }
    const dayFields = ['totalTokens', 'turnCount', 'toolCallCount', 'inputTokens', 'outputTokens',
      'cacheReadTokens', 'cacheWriteTokens', 'requestCount', 'activeMs'] as const;
    const days = value.days.map(row => {
      if (!isRecord(row) || typeof row.date !== 'string') throw new TypeError('Invalid usage day');
      const counts: Record<string, number> = {};
      for (const field of dayFields) {
        const count = row[field];
        if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) throw new TypeError('Invalid usage day');
        counts[field] = count;
      }
      return {
        date: row.date,
        totalTokens: counts.totalTokens, turnCount: counts.turnCount, toolCallCount: counts.toolCallCount,
        inputTokens: counts.inputTokens, outputTokens: counts.outputTokens,
        cacheReadTokens: counts.cacheReadTokens, cacheWriteTokens: counts.cacheWriteTokens,
        requestCount: counts.requestCount, activeMs: counts.activeMs,
      };
    });
    const dailyModels = value.dailyModels.map(row => {
      if (!isRecord(row) || !hasStrings(row, ['date', 'modelId', 'provider'])
        || typeof row.totalTokens !== 'number' || !Number.isFinite(row.totalTokens)
        || typeof row.requestCount !== 'number' || !Number.isFinite(row.requestCount)) {
        throw new TypeError('Invalid usage daily model');
      }
      return { date: row.date, modelId: row.modelId, provider: row.provider,
        totalTokens: row.totalTokens, requestCount: row.requestCount };
    });
    const models = value.models.map(row => {
      if (!isRecord(row) || !hasStrings(row, ['modelId', 'provider'])
        || typeof row.totalTokens !== 'number' || !Number.isFinite(row.totalTokens)
        || typeof row.requestCount !== 'number' || !Number.isFinite(row.requestCount)) {
        throw new TypeError('Invalid usage model');
      }
      return { modelId: row.modelId, provider: row.provider, totalTokens: row.totalTokens, requestCount: row.requestCount };
    });
    return {
      complete: value.complete, generatedAt: value.generatedAt, timeZone: value.timeZone,
      firstDate: value.firstDate, lastDate: value.lastDate, summary: counts as unknown as UsageSnapshot['summary'],
      days, dailyModels, models, sessionDays,
    };
  } }),
};

export const READ_USAGE_STATS_RPC: RpcDescriptor<'readUsageStats', UsageSnapshot> = {
  id: 'power-dsh#powerDsh/readUsageStats',
  service: 'powerDsh', namespace: 'powerDsh', method: 'readUsageStats',
  invocation: { kind: 'direct' },
  parameters: [{ name: 'timeZone', wire: 'timeZone', source: 'json', codec: stringCodec }],
  result: usageSnapshotCodec,
};

export const rpc = [READ_USAGE_STATS_RPC];
