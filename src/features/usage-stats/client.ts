import { styles as shellStyles } from '../../shared/client/shell-styles.ts';
import { errorMessage } from '../../shared/client/runtime.ts';
import type { ClientEnvironment, ClientFeature, ClientRuntime, FeatureState, IconProps, PageSlotProps, SnapshotSource } from '../../shared/client/types.ts';
import type { UsageDailyModelRow, UsageDayRow, UsageModelRow, UsageSnapshot } from './rpc.ts';
import { styles as featureStyles } from './styles.ts';

type UsageRange = '7d' | '30d';
type HeatmapMode = 'daily' | 'weekly' | 'cumulative';
const HEATMAP_WEEKS = 53;
const HEATMAP_DAYS = 7;
const DAY_MS = 86_400_000;
const MAX_TREND_MODELS = 6;

interface UsagePageProps extends PageSlotProps {
  usageSource: SnapshotSource<FeatureState<UsageSnapshot>>;
  loadUsageStats(): Promise<void>;
}

/** Compact token count; the unit stays implicit so the strip reads as one figure. */
export function formatTokens(value: number, locale: string): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  return new Intl.NumberFormat(locale, {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
  }).format(value);
}

/** Human duration in days, hours and minutes, largest two units. */
export function formatDuration(ms: number, dayUnit: string, hourUnit: string, minuteUnit: string): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}${dayUnit}`);
  if (hours > 0) parts.push(`${hours}${hourUnit}`);
  if (rest > 0 || parts.length === 0) parts.push(`${rest}${minuteUnit}`);
  return parts.slice(0, 2).join(' ');
}

function dayIndex(date: string): number | null {
  const value = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isFinite(value) ? Math.floor(value / DAY_MS) : null;
}

function dayKey(index: number): string {
  return new Date(index * DAY_MS).toISOString().slice(0, 10);
}

function levelFor(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((value / max) * 4))) as 1 | 2 | 3 | 4;
}

/** The last `range` days, zero-filled, so both range tabs render a complete axis. */
export function rangeDays(days: readonly UsageDayRow[], range: UsageRange, fallbackEnd: string): UsageDayRow[] {
  const count = range === '7d' ? 7 : 30;
  const known = new Map(days.map(row => [row.date, row]));
  const lastIndex = dayIndex(fallbackEnd);
  if (lastIndex === null) return days.slice(-count);
  const result: UsageDayRow[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const date = dayKey(lastIndex - offset);
    result.push(known.get(date) ?? { date, totalTokens: 0, turnCount: 0, toolCallCount: 0 });
  }
  return result;
}

/** Weekly and cumulative heatmap columns both derive from the same 53-week grid. */
export function heatmapGrid(days: readonly UsageDayRow[]): { date: string; row: UsageDayRow }[][] {
  const byDate = new Map(days.map(row => [row.date, row]));
  const known = days.map(row => dayIndex(row.date)).filter((value): value is number => value !== null);
  if (known.length === 0) return [];
  const end = Math.max(...known);
  const weekday = new Date(end * DAY_MS).getUTCDay();
  const endWeekStart = end - weekday;
  const start = endWeekStart - (HEATMAP_WEEKS - 1) * HEATMAP_DAYS;
  const columns: { date: string; row: UsageDayRow }[][] = [];
  for (let week = 0; week < HEATMAP_WEEKS; week++) {
    const column: { date: string; row: UsageDayRow }[] = [];
    for (let offset = 0; offset < HEATMAP_DAYS; offset++) {
      const date = dayKey(start + week * HEATMAP_DAYS + offset);
      column.push({ date, row: byDate.get(date) ?? { date, totalTokens: 0, turnCount: 0, toolCallCount: 0 } });
    }
    columns.push(column);
  }
  return columns;
}

/** Week labels keyed by the column that owns the month's first day. */
export function monthLabels(columns: readonly { date: string; row: UsageDayRow }[][], format: (date: string) => string) {
  const labels: { key: string; label: string; span: number }[] = [];
  for (const column of columns) {
    const anchor = column.find(cell => cell.date.endsWith('-01'))?.date ?? column[0]?.date ?? '';
    const month = anchor.slice(0, 7);
    const last = labels[labels.length - 1];
    if (last && last.key === month) last.span += 1;
    else labels.push({ key: month, label: format(anchor), span: 1 });
  }
  return labels;
}

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, Tooltip, Button, observable, useSnapshot, useMounted, errorFeedback } = runtime;
  const { ctx, t, savePreference, preferenceSlot, namespace } = env;
  const styles = shellStyles + featureStyles;
  // Lucide ChartColumn, ISC licensed; see docs/third-party-notices.md.
  function UsageIcon({ size = 16 }: IconProps) {
    return h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      'aria-hidden': true, focusable: false,
    }, h('path', { d: 'M3 3v16a2 2 0 0 0 2 2h16' }),
    h('path', { d: 'M7 16v-3' }), h('path', { d: 'M12 16V8' }), h('path', { d: 'M17 16v-6' }));
  }

  function localeTag(): string {
    return (typeof document !== 'undefined' && document.documentElement.lang) || 'en';
  }
  function browserZone(): string {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return typeof zone === 'string' && zone ? zone : 'UTC';
    } catch {
      return 'UTC';
    }
  }

  function UsagePage({ t, usageSource, loadUsageStats }: UsagePageProps) {
    const snapshot = useSnapshot(usageSource);
    const data = snapshot.value;
    const [range, setRange] = React.useState<UsageRange>('7d');
    const [mode, setMode] = React.useState<HeatmapMode>('daily');
    const mounted = useMounted();
    React.useEffect(() => {
      void loadUsageStats();
      const refresh = () => { void loadUsageStats(); };
      window.addEventListener('focus', refresh);
      return () => window.removeEventListener('focus', refresh);
    }, []);
    const locale = localeTag();
    const busy = snapshot.status === 'loading';
    const duration = (ms: number) => formatDuration(ms, t('usageUnitDay'), t('usageUnitHour'), t('usageUnitMinute'));
    const formatDays = (count: number) => t(count === 1 ? 'usageDay' : 'usageDays').replace('{count}', () => String(count));
    const summary = data?.summary;
    const metrics = [
      { key: 'usageTotalTokens', value: summary ? formatTokens(summary.totalTokens, locale) : '—' },
      { key: 'usagePeakTokens', value: summary ? formatTokens(summary.peakDayTokens, locale) : '—' },
      { key: 'usageLongestSession', value: summary ? duration(summary.longestSessionMs) : '—' },
      { key: 'usageCurrentStreak', value: summary ? formatDays(summary.currentStreakDays) : '—' },
      { key: 'usageLongestStreak', value: summary ? formatDays(summary.longestStreakDays) : '—' },
    ];

    const columns = data ? heatmapGrid(data.days) : [];
    const dailyMax = data ? Math.max(0, ...data.days.map(row => row.totalTokens)) : 0;
    const weeklyTotals = columns.map(column => column.reduce((sum, cell) => sum + cell.row.totalTokens, 0));
    const weeklyMax = Math.max(0, ...weeklyTotals);
    const cumulative = weeklyTotals.reduce<number[]>((result, value) => {
      result.push((result[result.length - 1] ?? 0) + value);
      return result;
    }, []);
    const cumulativeMax = Math.max(0, ...cumulative);
    const heatLevel = (columnIndex: number, row: UsageDayRow) => {
      if (mode === 'daily') return levelFor(row.totalTokens, dailyMax);
      const value = mode === 'weekly' ? weeklyTotals[columnIndex] ?? 0 : cumulative[columnIndex] ?? 0;
      const max = mode === 'weekly' ? weeklyMax : cumulativeMax;
      return levelFor(value, max);
    };
    const heatTitle = (columnIndex: number, row: UsageDayRow) => {
      if (mode === 'daily') {
        return t('usageHeatmapCell')
          .replace('{date}', () => row.date)
          .replace('{tokens}', () => formatTokens(row.totalTokens, locale))
          .replace('{turns}', () => String(row.turnCount));
      }
      const last = columns[columnIndex]?.[HEATMAP_DAYS - 1]?.date ?? row.date;
      const value = mode === 'weekly' ? weeklyTotals[columnIndex] ?? 0 : cumulative[columnIndex] ?? 0;
      return t(mode === 'weekly' ? 'usageWeekCell' : 'usageCumulativeCell')
        .replace('{date}', () => last)
        .replace('{tokens}', () => formatTokens(value, locale));
    };
    const formatMonth = (date: string) => {
      const value = Date.parse(`${date}T00:00:00.000Z`);
      if (!Number.isFinite(value)) return date.slice(5, 7);
      return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'short' }).format(value);
    };
    const labels = monthLabels(columns, formatMonth);

    const rangeRows = data ? rangeDays(data.days, range, data.lastDate) : [];
    const topModels: UsageModelRow[] = (data?.models ?? []).slice(0, MAX_TREND_MODELS);
    const trendMax = Math.max(0, ...(data?.dailyModels ?? [])
      .filter(row => topModels.some(model => model.modelId === row.modelId && model.provider === row.provider))
      .map(row => row.totalTokens));
    const pointsFor = (model: UsageModelRow) => {
      const byDate = new Map<string, number>();
      for (const row of data?.dailyModels ?? []) {
        if (row.modelId === model.modelId && row.provider === model.provider) byDate.set(row.date, row.totalTokens);
      }
      return rangeRows.map((row, index) => {
        const value = byDate.get(row.date) ?? 0;
        const x = rangeRows.length <= 1 ? 0 : (index / (rangeRows.length - 1)) * 100;
        const y = trendMax > 0 ? 100 - (value / trendMax) * 100 : 100;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      }).join(' ');
    };
    const axisLabels = rangeRows.filter((_, index) => rangeRows.length <= 7 || index % Math.ceil(rangeRows.length / 6) === 0 || index === rangeRows.length - 1);
    const modelTotal = (data?.models ?? []).reduce((sum, model) => sum + model.totalTokens, 0);
    const modelShare = (model: UsageModelRow) => modelTotal > 0 ? Math.max(1, Math.round((model.totalTokens / modelTotal) * 100)) : 0;

    const modelRows = (data?.models ?? []).map((model, index) => h('li', {
      key: `${model.provider}/${model.modelId}`, className: 'power-dsh-usage-model', 'data-model': index,
    },
    h('span', { className: 'power-dsh-usage-legend-dot', 'data-model': index }),
    h('span', { className: 'power-dsh-usage-model-name' }, model.modelId || t('usageUnknownModel')),
    h('span', { className: 'power-dsh-usage-model-bar', 'aria-hidden': true },
      h('span', { className: 'power-dsh-usage-model-bar-fill', 'data-model': index, style: { width: `${modelShare(model)}%` } })),
    h('span', { className: 'power-dsh-usage-model-value' }, formatTokens(model.totalTokens, locale)),
    h('span', { className: 'power-dsh-usage-model-requests' },
      t('usageModelRequests').replace('{count}', () => String(model.requestCount)))));
    const selectTab = (next: UsageRange) => { if (mounted.current && !busy) setRange(next); };
    const selectMode = (next: HeatmapMode) => { if (mounted.current) setMode(next); };

    return h('section', { className: 'power-dsh-page power-dsh-usage-page', 'aria-label': t('usageTab') },
      h('style', null, styles),
      h('header', null,
        h('h2', { className: 'power-dsh-title' }, t('usageTab')),
        h('p', { className: 'power-dsh-description' }, t('usagePageDescription'))),
      snapshot.status === 'error' && errorFeedback({ t, message: t(snapshot.error || 'usageLoadFailed'),
        code: 'PD-USAGE-LOAD', operation: 'readUsageStats', placement: 'page', retry: loadUsageStats, disabled: busy }),
      busy && !data && h('p', { className: 'power-dsh-notice', role: 'status' }, t('usageLoading')),
      data && !data.complete && h('p', { className: 'power-dsh-notice', role: 'status' }, t('usagePartial')),
      data && h('div', { className: 'power-dsh-usage-body' },
        h('section', { className: 'power-dsh-usage-summary', 'aria-label': t('usageTab') },
          ...metrics.map(metric => h('div', { key: metric.key, className: 'power-dsh-usage-metric' },
            h('div', { className: 'power-dsh-usage-metric-value' }, metric.value),
            h('div', { className: 'power-dsh-usage-metric-label' }, t(metric.key))))),
        h('section', { className: 'power-dsh-usage-card' },
          h('div', { className: 'power-dsh-usage-card-head' },
            h('h3', { className: 'power-dsh-usage-card-title' }, t('usageTokenActivity')),
            h('div', { className: 'power-dsh-usage-tabs', role: 'tablist', 'aria-label': t('usageTokenActivity') },
              ...(['daily', 'weekly', 'cumulative'] as const).map(option => h('button', {
                key: option, type: 'button', role: 'tab', className: 'power-dsh-usage-tab',
                'aria-selected': mode === option,
                onClick: () => selectMode(option),
              }, t(option === 'daily' ? 'usageHeatmapDaily' : option === 'weekly' ? 'usageHeatmapWeekly' : 'usageHeatmapCumulative'))))),
          columns.length > 0 && h('div', { className: 'power-dsh-usage-heatmap', 'data-mode': mode },
            h('div', { className: 'power-dsh-usage-heatmap-grid', style: { gridTemplateColumns: `repeat(${HEATMAP_WEEKS}, minmax(0, 1fr))` } },
              ...columns.map((column, columnIndex) => h('div', {
                key: column[0]?.date ?? String(columnIndex), className: 'power-dsh-usage-heatmap-column',
              }, ...column.map(cell => {
                const level = heatLevel(columnIndex, cell.row);
                return h(Tooltip, { key: cell.date, label: heatTitle(columnIndex, cell.row), side: 'top', portal: true, delayMs: 0, maxWidth: 360 },
                  h('span', { className: 'power-dsh-usage-heatmap-cell', 'data-level': level, 'data-has-usage': cell.row.totalTokens > 0 }));
              })))),
            h('div', { className: 'power-dsh-usage-heatmap-months', style: { gridTemplateColumns: `repeat(${HEATMAP_WEEKS}, minmax(0, 1fr))` } },
              ...labels.map(label => h('span', { key: label.key, className: 'power-dsh-usage-heatmap-month', style: { gridColumn: `span ${label.span}` } }, label.label)))),
          columns.length === 0 && h('p', { className: 'power-dsh-usage-empty' }, t('usageEmpty'))),
        h('div', { className: 'power-dsh-usage-range' },
          h('h3', { className: 'power-dsh-usage-section-title' }, t('usageRangeTitle')),
          h('div', { className: 'power-dsh-usage-tabs', role: 'tablist', 'aria-label': t('usageRangeTitle') },
            ...(['7d', '30d'] as const).map(option => h('button', {
              key: option, type: 'button', role: 'tab', className: 'power-dsh-usage-tab',
              'aria-selected': range === option, 'aria-disabled': busy || undefined,
              onClick: () => selectTab(option),
            }, t(option === '7d' ? 'usageRange7d' : 'usageRange30d'))))),
        h('section', { className: 'power-dsh-usage-card' },
          h('div', { className: 'power-dsh-usage-card-head' },
            h('h3', { className: 'power-dsh-usage-card-title' }, t('usageTrendTitle')),
            h('div', { className: 'power-dsh-usage-legend' },
              ...topModels.map(model => h('span', { key: `${model.provider}/${model.modelId}`, className: 'power-dsh-usage-legend-item' },
                h('span', { className: 'power-dsh-usage-legend-dot', 'data-model': topModels.indexOf(model) }),
                model.modelId || t('usageUnknownModel'))))),
          trendMax > 0
            ? h('div', { className: 'power-dsh-usage-chart' },
              h('svg', { className: 'power-dsh-usage-chart-svg', viewBox: '0 0 100 100', preserveAspectRatio: 'none', role: 'img', 'aria-label': t('usageTrendTitle') },
                h('line', { x1: 0, y1: 100, x2: 100, y2: 100, className: 'power-dsh-usage-chart-axis' }),
                ...topModels.map(model => h('polyline', {
                  key: `${model.provider}/${model.modelId}`, points: pointsFor(model),
                  className: 'power-dsh-usage-chart-line', 'data-model': topModels.indexOf(model),
                  fill: 'none', vectorEffect: 'non-scaling-stroke',
                }))),
              h('div', { className: 'power-dsh-usage-chart-axis-labels' },
                ...axisLabels.map(row => h('span', { key: row.date, className: 'power-dsh-usage-chart-axis-label' }, row.date.slice(5).replace('-', '/')))))
            : h('p', { className: 'power-dsh-usage-empty' }, t('usageChartEmpty'))),
        h('section', { className: 'power-dsh-usage-card' },
          h('h3', { className: 'power-dsh-usage-card-title' }, t('usageModelTitle')),
          modelRows.length > 0
            ? h('ul', { className: 'power-dsh-usage-models' }, ...modelRows)
            : h('p', { className: 'power-dsh-usage-empty' }, t('usageEmpty'))),
        h('div', { className: 'power-dsh-usage-actions' },
          h(Button, { variant: 'outline', size: 'sm', disabled: busy, 'aria-busy': busy, onClick: () => { void loadUsageStats(); } },
            t('usageRefresh')))));
  }

  let active = true;
  let usage: FeatureState<UsageSnapshot> = { status: 'loading', value: null, error: '' };
  const usageSource = observable(() => usage);
  let generation = 0;
  ctx.effect(() => () => { active = false; generation++; });

  const loadUsageStats = async () => {
    const current = ++generation;
    if (usage.status !== 'ready') { usage = { ...usage, status: 'loading', error: '' }; usageSource.notify(); }
    try {
      const result = await ctx.remote.powerDsh.readUsageStats(browserZone());
      if (!active || current !== generation) return;
      if (!result.ok) throw new Error(result.error.message);
      usage = { status: 'ready', value: result.value, error: '' };
    } catch (failure) {
      if (!active || current !== generation) return;
      // Keep the locale key, not the rendered sentence, so a language switch re-renders correctly.
      const message = errorMessage(failure) ?? '';
      usage = { ...usage, status: 'error', error: message.includes('usageUnavailable') ? 'usageUnavailable' : 'usageLoadFailed' };
    }
    usageSource.notify();
  };

  preferenceSlot('usageStatsEnabled', 'settings.section', {
    id: 'power-dsh-usage', order: 55, locale: namespace, label: () => t('usageTab'),
  }, (props: PageSlotProps) => h(UsagePage, { ...props, usageSource, loadUsageStats }));
  preferenceSlot('usageStatsEnabled', 'settings.section.icon', { id: 'power-dsh-usage' }, UsageIcon);
  return {
    settings: [{ field: 'usageStatsEnabled', description: 'usageStatsDescription',
      save: next => savePreference('usageStatsEnabled', next === true, 'usageOutdated'), hideError: true }],
    api: { usageSource, loadUsageStats },
  } satisfies ClientFeature;
}
