import { styles as shellStyles } from '../../shared/client/shell-styles.ts';
import { errorMessage } from '../../shared/client/runtime.ts';
import type { ClientEnvironment, ClientFeature, ClientRuntime, FeatureState, IconProps, PageSlotProps, SnapshotSource } from '../../shared/client/types.ts';
import type { UsageCardSummary, UsageDayRow, UsageModelRow, UsageSnapshot } from './rpc.ts';
import { styles as featureStyles } from './styles.ts';
import { monthCells, rangeAfterClick, shiftMonth } from './usage-calendar.ts';

/** Whole-page period presets; `all` keeps the full history and `custom` uses the picked dates. */
type UsagePeriod = 'today' | 'week' | 'month' | 'all' | 'd7' | 'd30' | 'custom';
/** The trend's own zoom, independent of the page period that bounds it. */
type UsageRange = '7d' | '30d';
interface UsageWindow { start: string; end: string }
const HEATMAP_WEEKS = 53;
const HEATMAP_DAYS = 7;
const DAY_MS = 86_400_000;
/** A quiet day still needs every counter so period sums stay uniform. */
const emptyDay = (date: string): UsageDayRow => ({
  date, totalTokens: 0, turnCount: 0, toolCallCount: 0,
  inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, requestCount: 0, activeMs: 0,
});
const MAX_TREND_MODELS = 6;
/** One locale key per period; the ids stay stable regardless of the label. */
const PERIOD_LABELS = {
  today: 'usagePeriodToday', week: 'usagePeriodWeek', d7: 'usagePeriod7d',
  month: 'usagePeriodMonth', d30: 'usagePeriod30d', all: 'usagePeriodAll', custom: 'usagePeriodCustom',
} as const;

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
export function formatDuration(ms: number, dayUnit: string, hourUnit: string, minuteUnit: string, secondUnit = 's'): string {
  if (ms > 0 && ms < 60_000) return `${Math.max(1, Math.floor(ms / 1000))}${secondUnit}`;
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const value = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isFinite(value) && new Date(value).toISOString().slice(0, 10) === date
    ? Math.floor(value / DAY_MS) : null;
}

/** Read the report's current calendar day in the same zone as its daily buckets. */
function reportDay(time: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(time);
  const part = (type: string) => parts.find(value => value.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function dayKey(index: number): string {
  return new Date(index * DAY_MS).toISOString().slice(0, 10);
}

function levelFor(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((value / max) * 4))) as 1 | 2 | 3 | 4;
}

/**
 * The trend keeps its own 7/30-day zoom, ending on the report day and zero-filled so every
 * day has a point. It is never narrowed below the page period, which still clips it.
 */
export function trendDays(days: readonly UsageDayRow[], range: UsageRange, today: string): UsageDayRow[] {
  const known = new Map(days.map(row => [row.date, row]));
  const endIndex = dayIndex(today);
  if (endIndex === null) return [];
  const count = range === '7d' ? 7 : 30;
  const result: UsageDayRow[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const date = dayKey(endIndex - offset);
    result.push(known.get(date) ?? emptyDay(date));
  }
  return result;
}

/** Date bounds for the selector, anchored on the report's current day, not its last activity. */
export function periodWindow(period: UsagePeriod, today: string, custom?: UsageWindow): UsageWindow | null {
  if (period === 'custom') return custom ?? null;
  if (period === 'all') return null;
  const index = dayIndex(today);
  if (index === null) return null;
  const end = dayKey(index);
  if (period === 'today') return { start: end, end };
  if (period === 'd7') return { start: dayKey(index - 6), end };
  if (period === 'd30') return { start: dayKey(index - 29), end };
  if (period === 'week') {
    // Monday-based week containing the newest day.
    const weekday = (new Date(index * DAY_MS).getUTCDay() + 6) % 7;
    return { start: dayKey(index - weekday), end };
  }
  return { start: `${end.slice(0, 7)}-01`, end };
}

/** Keep only rows inside the window; a null window keeps everything. */
export function withinWindow<T extends { date: string }>(rows: readonly T[], window: UsageWindow | null): T[] {
  return window === null ? [...rows] : rows.filter(row => row.date >= window.start && row.date <= window.end);
}

/** Sum calendar-day counters and count each active session once in the selected range. */
export function summarizeCards(data: UsageSnapshot, window: UsageWindow | null): UsageCardSummary {
  const days = withinWindow(data.days, window);
  const sum = (field: keyof Omit<UsageDayRow, 'date'>) => days.reduce((total, day) => total + day[field], 0);
  return {
    totalTokens: sum('totalTokens'), inputTokens: sum('inputTokens'), outputTokens: sum('outputTokens'),
    cacheReadTokens: sum('cacheReadTokens'), cacheWriteTokens: sum('cacheWriteTokens'),
    requestCount: sum('requestCount'), activeMs: sum('activeMs'),
    sessionCount: data.sessionDays.filter(dates => dates.some(date => window === null || (date >= window.start && date <= window.end))).length,
  };
}

/** The 53-week daily grid, ending with the Monday-first week that contains the report day. */
export function heatmapGrid(days: readonly UsageDayRow[], today: string): { date: string; row: UsageDayRow }[][] {
  const end = dayIndex(today);
  if (end === null) return [];
  const byDate = new Map(days.map(row => [row.date, row]));
  const weekday = (new Date(end * DAY_MS).getUTCDay() + 6) % 7;
  const endWeekStart = end - weekday;
  const start = endWeekStart - (HEATMAP_WEEKS - 1) * HEATMAP_DAYS;
  const columns: { date: string; row: UsageDayRow }[][] = [];
  for (let week = 0; week < HEATMAP_WEEKS; week++) {
    const column: { date: string; row: UsageDayRow }[] = [];
    for (let offset = 0; offset < HEATMAP_DAYS; offset++) {
      const date = dayKey(start + week * HEATMAP_DAYS + offset);
      column.push({ date, row: (date <= today ? byDate.get(date) : undefined) ?? emptyDay(date) });
    }
    columns.push(column);
  }
  return columns;
}

/**
 * Month labels anchored at the column that owns each month's first day.
 * `start` is a zero-based week index so the label can sit above its own column.
 */
export function monthLabels(
  columns: readonly { date: string; row: UsageDayRow }[][],
  format: (date: string) => string,
): { key: string; label: string; start: number; span: number }[] {
  // A label sits on the week that owns the month's first day. Anchoring first and then
  // measuring to the next anchor keeps every month present, however weeks straddle months.
  const anchors: { key: string; label: string; start: number }[] = [];
  columns.forEach((column, index) => {
    const anchor = column.find(cell => cell.date.endsWith('-01'))?.date;
    if (anchor === undefined) return;
    anchors.push({ key: anchor.slice(0, 7), label: format(anchor), start: index });
  });
  return anchors.map((anchor, index) => ({
    ...anchor,
    span: (anchors[index + 1]?.start ?? columns.length) - anchor.start,
  }));
}

/**
 * A Catmull-Rom curve through the series, drawn with cubic Béziers.
 * Smoothing keeps a seven-day series readable instead of a sawtooth.
 */
export function smoothPath(points: readonly { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  const round = (value: number) => Math.round(value * 100) / 100;
  const first = points[0]!;
  if (points.length === 1) return `M ${round(first.x)} ${round(first.y)}`;
  let path = `M ${round(first.x)} ${round(first.y)}`;
  for (let index = 0; index < points.length - 1; index++) {
    const previous = points[index - 1] ?? points[index]!;
    const current = points[index]!;
    const next = points[index + 1]!;
    const after = points[index + 2] ?? next;
    // A sixth of the neighbouring span is the standard Catmull-Rom to Bézier conversion.
    const control1 = { x: current.x + (next.x - previous.x) / 6, y: current.y + (next.y - previous.y) / 6 };
    const control2 = { x: next.x - (after.x - current.x) / 6, y: next.y - (after.y - current.y) / 6 };
    path += ` C ${round(control1.x)} ${round(control1.y)} ${round(control2.x)} ${round(control2.y)} ${round(next.x)} ${round(next.y)}`;
  }
  return path;
}

export function createClientFeature(runtime: ClientRuntime, env: ClientEnvironment) {
  const { React, h, Tooltip, Modal, Button, observable, useSnapshot, useMounted, errorFeedback } = runtime;
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
    const [period, setPeriod] = React.useState<UsagePeriod>('today');
    const [range, setRange] = React.useState<UsageRange>('7d');
    const [custom, setCustom] = React.useState<UsageWindow | null>(null);
    const [customOpen, setCustomOpen] = React.useState(false);
    const [draftStart, setDraftStart] = React.useState('');
    const [draftEnd, setDraftEnd] = React.useState('');
    const [calendarFocus, setCalendarFocus] = React.useState('');
    const [hoverDate, setHoverDate] = React.useState('');
    const calendarFocusRef = React.useRef<HTMLButtonElement | null>(null);
    const moveCalendarFocus = React.useRef(false);
    const mounted = useMounted();
    React.useEffect(() => {
      void loadUsageStats();
      const refresh = () => { void loadUsageStats(); };
      window.addEventListener('focus', refresh);
      return () => window.removeEventListener('focus', refresh);
    }, []);
    const locale = localeTag();
    const busy = snapshot.status === 'loading';
    const duration = (ms: number) => formatDuration(ms, t('usageUnitDay'), t('usageUnitHour'), t('usageUnitMinute'), t('usageUnitSecond'));
    const today = reportDay(data?.generatedAt ?? Date.now(), data?.timeZone || browserZone());
    // The heatmap keeps the full history. Other sections read the selected calendar bounds.
    const activeWindow = periodWindow(period, today, custom ?? undefined);
    const displayedWindow = activeWindow ?? (data?.firstDate ? { start: data.firstDate, end: today } : null);
    const rangeLabel = displayedWindow ? `${displayedWindow.start} → ${displayedWindow.end}` : t('usagePeriodCustom');
    const summary = data ? summarizeCards(data, activeWindow) : null;
    const count = (value: number) => new Intl.NumberFormat(locale).format(value);
    const input = summary ? summary.inputTokens + summary.cacheReadTokens + summary.cacheWriteTokens : 0;
    const cacheRate = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 })
      .format(input > 0 && summary ? summary.cacheReadTokens / input : 0);
    const tokenDetail = summary ? [
      `${t('usageInput')} ${formatTokens(input, locale)}`,
      `${t('usageOutput')} ${formatTokens(summary.outputTokens, locale)}`,
    ] : [];
    const metrics = [
      { key: 'usageTotalTokens', value: summary ? formatTokens(summary.totalTokens, locale) : '—',
        exact: summary ? count(summary.totalTokens) : '', details: tokenDetail,
        detailTitle: summary ? `${t('usageInput')} ${count(input)} · ${t('usageOutput')} ${count(summary.outputTokens)}` : '' },
      { key: 'usageCacheReadTokens', value: summary ? formatTokens(summary.cacheReadTokens, locale) : '—',
        exact: summary ? count(summary.cacheReadTokens) : '',
        details: summary ? [t('usageCacheRate').replace('{rate}', () => cacheRate)] : [],
        hint: t('usageCacheHint') },
      { key: 'usageSessions', value: summary ? count(summary.sessionCount) : '—',
        details: summary ? [`${t('usageDuration')} ${duration(summary.activeMs)}`] : [],
        detailTitle: summary ? `${t('usageDuration')} ${duration(summary.activeMs)}` : '',
        hint: `${t('usageSessionsHint')} ${t('usageRuntimeHint')}` },
    ];

    const columns = data ? heatmapGrid(data.days, today) : [];
    const heatRows = columns.flat();
    const dailyMax = Math.max(0, ...heatRows.map(cell => cell.row.totalTokens));
    const hasActivity = dailyMax > 0;
    const heatTitle = (row: UsageDayRow) => t('usageHeatmapCell')
      .replace('{date}', () => row.date)
      .replace('{tokens}', () => formatTokens(row.totalTokens, locale));
    const formatMonth = (date: string) => {
      const value = Date.parse(`${date}T00:00:00.000Z`);
      if (!Number.isFinite(value)) return date.slice(5, 7);
      return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'short' }).format(value);
    };
    const labels = monthLabels(columns, formatMonth);
    // Roving focus: one grid cell is tabbable and the arrow keys walk the calendar.
    const [heatFocus, setHeatFocus] = React.useState('');
    const heatFocusRef = React.useRef<HTMLSpanElement | null>(null);
    const moveHeatFocus = React.useRef(false);
    const firstHeatDate = heatRows[0]?.date ?? today;
    const activeHeatDate = heatFocus >= firstHeatDate && heatFocus <= today ? heatFocus : today;
    function heatKey(event: import('react').KeyboardEvent<HTMLSpanElement>, date: string) {
      const index = dayIndex(date);
      if (index === null) return;
      const weekday = (new Date(index * DAY_MS).getUTCDay() + 6) % 7;
      const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7,
        Home: -weekday, End: 6 - weekday };
      if (!(event.key in offsets)) return;
      event.preventDefault();
      const target = dayKey(index + offsets[event.key]);
      const next = event.key === 'End' && target > today ? today : target;
      if (next < firstHeatDate || next > today || next === date) return;
      moveHeatFocus.current = true;
      setHeatFocus(next);
    }
    React.useEffect(() => {
      if (moveHeatFocus.current) {
        moveHeatFocus.current = false;
        heatFocusRef.current?.focus();
      }
    }, [heatFocus]);
    // The trend owns its 7/30-day zoom, so a one-day page period cannot reduce it to a single point.
    const rangeRows = data ? trendDays(data.days, range, today) : [];
    const trendWindow: UsageWindow | null = rangeRows.length > 0
      ? { start: rangeRows[0]!.date, end: rangeRows[rangeRows.length - 1]!.date } : null;
    // The trend only plots its own zoom, but the model list answers for the page period.
    const trendModels = data ? withinWindow(data.dailyModels, trendWindow) : [];
    const periodModels = data ? withinWindow(data.dailyModels, activeWindow) : [];
    const totalModels = (rows: readonly typeof periodModels[number][]) => {
      const totals = new Map<string, UsageModelRow>();
      for (const row of rows) {
        const key = `${row.provider}/${row.modelId}`;
        const current = totals.get(key);
        totals.set(key, { modelId: row.modelId, provider: row.provider, totalTokens: (current?.totalTokens ?? 0) + row.totalTokens,
          requestCount: (current?.requestCount ?? 0) + row.requestCount });
      }
      return totals;
    };
    const trendModelTotals = totalModels(trendModels);
    const modelTotals = totalModels(periodModels);
    const topModels: UsageModelRow[] = [...trendModelTotals.values()].sort((left, right) => right.totalTokens - left.totalTokens)
      .slice(0, MAX_TREND_MODELS);
    const trendMax = Math.max(0, ...trendModels
      .filter(row => topModels.some(model => model.modelId === row.modelId && model.provider === row.provider))
      .map(row => row.totalTokens));
    const seriesFor = (model: UsageModelRow) => {
      const byDate = new Map<string, number>();
      for (const row of trendModels) {
        if (row.modelId === model.modelId && row.provider === model.provider) byDate.set(row.date, row.totalTokens);
      }
      return rangeRows.map((row, index) => ({
        x: rangeRows.length <= 1 ? 0 : (index / (rangeRows.length - 1)) * 100,
        y: trendMax > 0 ? 100 - ((byDate.get(row.date) ?? 0) / trendMax) * 100 : 100,
      }));
    };
    const axisLabels = rangeRows.filter((_, index) => rangeRows.length <= 7 || index % Math.ceil(rangeRows.length / 6) === 0 || index === rangeRows.length - 1);
    const periodModelRows = [...modelTotals.values()].sort((left, right) => right.totalTokens - left.totalTokens);
    const modelTotal = periodModelRows.reduce((sum, model) => sum + model.totalTokens, 0);
    const modelShare = (model: UsageModelRow) => modelTotal > 0 ? Math.max(1, Math.round((model.totalTokens / modelTotal) * 100)) : 0;

    const modelRows = periodModelRows.map((model, index) => h('li', {
      key: `${model.provider}/${model.modelId}`, className: 'power-dsh-usage-model', 'data-model': index,
      title: `${model.modelId || t('usageUnknownModel')} · ${formatTokens(model.totalTokens, locale)} · `
        + t('usageModelRequests').replace('{count}', () => String(model.requestCount)),
    },
    h('span', { className: 'power-dsh-usage-legend-dot', 'data-model': index }),
    h('span', { className: 'power-dsh-usage-model-name' }, model.modelId || t('usageUnknownModel')),
    h('span', { className: 'power-dsh-usage-model-value' }, formatTokens(model.totalTokens, locale)),
    h('span', { className: 'power-dsh-usage-model-share' },
      t('usageModelShare').replace('{rate}', () => `${modelShare(model)}%`)),
    h('span', { className: 'power-dsh-usage-model-bar', 'aria-hidden': true },
      h('span', { className: 'power-dsh-usage-model-bar-fill', 'data-model': index, style: { width: `${modelShare(model)}%` } }))));
    // Empty history is a valid result; a date picker should not restrict choices to recorded days.
    const customValid = dayIndex(draftStart) !== null && dayIndex(draftEnd) !== null && draftStart <= draftEnd;
    const customId = `${React.useId()}-usage-period`;
    const selectRange = (next: UsageRange) => { if (mounted.current && !busy) setRange(next); };
    function openCustom() {
      if (!mounted.current || busy) return;
      const seeded = period === 'custom' && custom ? custom
        : displayedWindow ?? periodWindow('d7', today)!;
      setDraftStart(seeded.start);
      setDraftEnd(seeded.end);
      setCalendarFocus(seeded.end);
      setHoverDate('');
      setCustomOpen(true);
    }

    React.useEffect(() => {
      if (customOpen && moveCalendarFocus.current) {
        moveCalendarFocus.current = false;
        calendarFocusRef.current?.focus();
      }
    }, [customOpen, calendarFocus]);
    const visibleDate = calendarFocus || today;
    const visibleMonth = visibleDate.slice(0, 7);
    const monthTitle = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: 'long' })
      .format(Date.parse(`${visibleMonth}-01T00:00:00Z`));
    const weekdayLabels = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC', weekday: 'narrow',
    }).format(Date.parse('2026-01-05T00:00:00Z') + index * DAY_MS));
    const preview = !draftEnd && draftStart && hoverDate
      ? { start: hoverDate < draftStart ? hoverDate : draftStart, end: hoverDate > draftStart ? hoverDate : draftStart }
      : { start: draftStart, end: draftEnd || draftStart };
    function pickDay(date: string) {
      if (!mounted.current) return;
      const next = rangeAfterClick({ start: draftStart, end: draftEnd }, date);
      setDraftStart(next.start);
      setDraftEnd(next.end);
      setCalendarFocus(date);
      setHoverDate('');
    }
    function calendarKey(event: import('react').KeyboardEvent<HTMLButtonElement>, date: string) {
      const index = dayIndex(date)!;
      const weekday = (new Date(index * DAY_MS).getUTCDay() + 6) % 7;
      const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7,
        Home: -weekday, End: 6 - weekday };
      const next = event.key === 'PageUp' ? shiftMonth(date, -1) : event.key === 'PageDown' ? shiftMonth(date, 1)
        : event.key in offsets ? dayKey(index + offsets[event.key]) : null;
      if (!next) return;
      event.preventDefault();
      moveCalendarFocus.current = true;
      setCalendarFocus(next);
      if (draftStart && !draftEnd) setHoverDate(next);
    }
    const cells = monthCells(visibleMonth);
    const calendarRows = Array.from({ length: 6 }, (_, week) => h('div', { key: week, role: 'row', className: 'power-dsh-usage-calendar-week' },
      ...cells.slice(week * 7, week * 7 + 7).map(date => {
        const inside = Boolean(preview.start && date >= preview.start && date <= preview.end);
        const endpoint = date === preview.start || date === preview.end;
        return h('div', { key: date, role: 'gridcell', 'aria-selected': inside,
          className: 'power-dsh-usage-calendar-cell', 'data-in-range': inside,
          'data-edge': date === preview.start && date === preview.end ? 'single' : date === preview.start ? 'start' : date === preview.end ? 'end' : undefined },
        h('button', { type: 'button', className: 'power-dsh-usage-calendar-day', 'data-calendar-day': date,
          id: `${customId}-${date}`, 'aria-label': date, 'aria-current': date === today ? 'date' : undefined,
          'data-outside': date.slice(0, 7) !== visibleMonth, 'data-endpoint': endpoint,
          'data-modal-autofocus': date === visibleDate || undefined, tabIndex: date === visibleDate ? 0 : -1,
          ref: date === visibleDate ? (node: HTMLButtonElement | null): void => { calendarFocusRef.current = node; } : undefined,
          onClick: () => pickDay(date), onKeyDown: (event: import('react').KeyboardEvent<HTMLButtonElement>) => calendarKey(event, date),
          onMouseEnter: () => { if (draftStart && !draftEnd) setHoverDate(date); },
        }, String(Number(date.slice(8)))));
      })));
    const monthArrow = (direction: -1 | 1) => h('button', {
      type: 'button', className: 'power-dsh-usage-calendar-nav', 'data-calendar-month': direction,
      'aria-label': t(direction === -1 ? 'usagePreviousMonth' : 'usageNextMonth'),
      onClick: () => { if (mounted.current) { setCalendarFocus(shiftMonth(visibleDate, direction)); setHoverDate(''); } },
    }, h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3,
      strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false },
      h('path', { d: direction === -1 ? 'm10 4-4 4 4 4' : 'm6 4 4 4-4 4' })));
    const customDialog = customOpen ? h(Modal, {
      open: true, onClose: () => { if (mounted.current) setCustomOpen(false); },
      title: t('usageCustomTitle'), closeLabel: t('close'), className: 'power-dsh-usage-custom',
      footer: h(React.Fragment, null,
        h(Button, { variant: 'outline', onClick: () => { if (mounted.current) setCustomOpen(false); } }, t('cancel')),
        h(Button, { variant: 'primary', disabled: !customValid,
          onClick: () => {
            if (!mounted.current || !customValid) return;
            setCustom({ start: draftStart, end: draftEnd });
            setPeriod('custom');
            setCustomOpen(false);
          } }, t('usageCustomApply'))),
    },
    h('div', { className: 'power-dsh-usage-custom-shortcuts', role: 'group', 'aria-label': t('usageCustomShortcuts') },
      ...(['d7', 'd30'] as const).map(option => {
        const selected = periodWindow(option, today)!;
        return h('button', { key: option, type: 'button', className: 'power-dsh-usage-custom-shortcut',
          'data-period-shortcut': option, 'aria-pressed': draftStart === selected.start && draftEnd === selected.end,
          onClick: () => {
            if (!mounted.current) return;
            setDraftStart(selected.start); setDraftEnd(selected.end); setCalendarFocus(selected.end); setHoverDate('');
          },
        }, t(PERIOD_LABELS[option]));
      })),
    h('div', { className: 'power-dsh-usage-calendar-selection' },
      h('div', null, h('span', { className: 'power-dsh-usage-calendar-field-label' }, t('usageCustomStart')),
        h('span', { 'data-calendar-start': true }, draftStart || '—')),
      h('span', { className: 'power-dsh-usage-calendar-selection-arrow', 'aria-hidden': true }, '→'),
      h('div', null, h('span', { className: 'power-dsh-usage-calendar-field-label' }, t('usageCustomEnd')),
        h('span', { 'data-calendar-end': true }, draftEnd || '—'))),
    h('div', { className: 'power-dsh-usage-calendar-header' }, monthArrow(-1),
      h('span', { id: `${customId}-month`, 'aria-live': 'polite' }, monthTitle), monthArrow(1)),
    h('div', { role: 'grid', 'aria-labelledby': `${customId}-month`, 'data-calendar-visible': visibleMonth, className: 'power-dsh-usage-calendar-grid', onMouseLeave: () => setHoverDate('') },
      h('div', { role: 'row', className: 'power-dsh-usage-calendar-week' },
        ...weekdayLabels.map((label, index) => h('span', { key: index, role: 'columnheader', className: 'power-dsh-usage-calendar-weekday' }, label))),
      ...calendarRows),
    h('p', { role: 'status', className: 'power-dsh-usage-calendar-hint' }, t(draftStart && !draftEnd ? 'usageSelectEnd' : 'usageSelectStart'))) : null;

    return h('section', { className: 'power-dsh-page power-dsh-usage-page', 'aria-label': t('usageTab') },
      h('style', null, styles),
      h('header', null,
        h('h2', { className: 'power-dsh-title' }, t('usageTab')),
        h('p', { className: 'power-dsh-description' }, t('usagePageDescription'))),
      h('div', { className: 'power-dsh-usage-period', role: 'group', 'aria-label': t('usagePeriodTitle') },
        h('div', { className: 'power-dsh-usage-period-presets' },
          ...(['today', 'week', 'month', 'all', 'custom'] as const).map(option => h('button', {
            key: option, type: 'button', className: 'power-dsh-usage-period-option', 'data-period': option,
            'aria-pressed': period === option, disabled: busy,
            'aria-haspopup': option === 'custom' ? 'dialog' : undefined,
            'aria-expanded': option === 'custom' ? customOpen : undefined,
            onClick: () => {
              if (!mounted.current || busy) return;
              if (option === 'custom') openCustom(); else setPeriod(option);
            },
          },
          option === 'custom' && h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none',
            stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round',
            'aria-hidden': true, focusable: false },
            h('rect', { x: 2, y: 3.5, width: 12, height: 10.5, rx: 2 }),
            h('path', { d: 'M5 2v3M11 2v3M2 7h12' })),
          t(PERIOD_LABELS[option])))),
        period === 'custom' && h('span', { className: 'power-dsh-usage-period-dates-label', title: rangeLabel }, rangeLabel)),
      snapshot.status === 'error' && errorFeedback({ t, message: t(snapshot.error || 'usageLoadFailed'),
        code: 'PD-USAGE-LOAD', operation: 'readUsageStats', placement: 'page', retry: loadUsageStats, disabled: busy }),
      busy && !data && h('p', { className: 'power-dsh-notice', role: 'status' }, t('usageLoading')),
      data && !data.complete && h('p', { className: 'power-dsh-notice', role: 'status' }, t('usagePartial')),
      data && h('div', { className: 'power-dsh-usage-body' },
        h('section', { className: 'power-dsh-usage-group', 'aria-label': t('usageGroupRange') },
          h('h2', { className: 'power-dsh-usage-group-title' }, t('usageGroupRange')),
        h('section', { className: 'power-dsh-usage-summary', 'aria-label': t('usageSummaryTitle') },
          ...metrics.map(metric => h('div', { key: metric.key, className: 'power-dsh-usage-metric', 'data-metric': metric.key },
            metric.hint ? h(Tooltip, { label: metric.hint, side: 'top', portal: true, delayMs: 0, maxWidth: 360 },
              h('span', { className: 'power-dsh-usage-metric-label', tabIndex: 0 }, t(metric.key)))
              : h('span', { className: 'power-dsh-usage-metric-label' }, t(metric.key)),
            h('div', { className: 'power-dsh-usage-metric-value', title: metric.exact || metric.value }, metric.value),
            h('div', { className: 'power-dsh-usage-metric-detail', title: metric.detailTitle },
              ...metric.details.map(detail => h('span', { key: detail }, detail)))))),
          h('section', { className: 'power-dsh-usage-card' },
            h('h3', { className: 'power-dsh-usage-card-title' }, t('usageModelTitle')),
            modelRows.length > 0
              ? h('ul', { className: 'power-dsh-usage-models' }, ...modelRows)
              : h('p', { className: 'power-dsh-usage-empty' }, t('usageEmpty')))),
        h('section', { className: 'power-dsh-usage-group', 'aria-label': t('usageGroupHistory') },
          h('h2', { className: 'power-dsh-usage-group-title' }, t('usageGroupHistory')),
        h('section', { className: 'power-dsh-usage-card' },
          h('div', { className: 'power-dsh-usage-card-head' },
            h('h3', { className: 'power-dsh-usage-card-title' }, t('usageTokenActivity'))),
          !hasActivity && h('p', { className: 'power-dsh-usage-empty' }, t('usageEmpty')),
          hasActivity && h('div', { className: 'power-dsh-usage-heatmap',
            style: { gridTemplateColumns: `repeat(${HEATMAP_WEEKS}, minmax(0, 1fr))` } },
            ...columns.map((column, columnIndex) => column.map((cell, rowIndex) => {
              const layout = {
                className: 'power-dsh-usage-heatmap-cell',
                'data-level': levelFor(cell.row.totalTokens, dailyMax),
                'data-has-usage': cell.row.totalTokens > 0,
                style: { gridColumn: columnIndex + 1, gridRow: rowIndex + 1 },
              };
              if (cell.date > today) return h('span', { key: cell.date, ...layout, 'data-future': true, 'aria-hidden': true });
              const selectable = cell.date === activeHeatDate;
              const label = heatTitle(cell.row);
              return h(Tooltip, { key: cell.date, label, side: 'top', portal: true, delayMs: 0, maxWidth: 360 },
                h('span', {
                  ...layout, role: 'gridcell', 'aria-label': label, 'aria-selected': selectable,
                  'data-today': cell.date === today || undefined,
                  tabIndex: selectable ? 0 : -1,
                  onKeyDown: (event: import('react').KeyboardEvent<HTMLSpanElement>) => heatKey(event, cell.date),
                  ref: selectable ? (node: HTMLSpanElement | null): void => { heatFocusRef.current = node; } : undefined,
                }));
            }))),
          hasActivity && h('div', { className: 'power-dsh-usage-heatmap-months',
            style: { gridTemplateColumns: `repeat(${HEATMAP_WEEKS}, minmax(0, 1fr))` } },
            ...labels.map(label => h('span', { key: label.key, className: 'power-dsh-usage-heatmap-month',
              style: { gridColumn: `${label.start + 1} / span ${label.span}` } }, label.label)))),
        h('section', { className: 'power-dsh-usage-card' },
          h('div', { className: 'power-dsh-usage-card-head' },
            h('h3', { className: 'power-dsh-usage-card-title' }, t('usageTrendTitle')),
            h('div', { className: 'power-dsh-usage-tabs', role: 'tablist', 'aria-label': t('usageRangeTitle') },
              ...(['7d', '30d'] as const).map(option => h('button', {
                key: option, type: 'button', role: 'tab', className: 'power-dsh-usage-tab', 'data-range': option,
                'aria-selected': range === option, 'aria-disabled': busy || undefined,
                onClick: () => selectRange(option),
              }, t(option === '7d' ? 'usageRange7d' : 'usageRange30d')))),
            h('div', { className: 'power-dsh-usage-legend' },
              ...topModels.map(model => h('span', { key: `${model.provider}/${model.modelId}`, className: 'power-dsh-usage-legend-item' },
                h('span', { className: 'power-dsh-usage-legend-dot', 'data-model': topModels.indexOf(model) }),
                model.modelId || t('usageUnknownModel'))))),
          trendMax > 0
            ? h('div', { className: 'power-dsh-usage-chart' },
              h('svg', { className: 'power-dsh-usage-chart-svg', viewBox: '0 0 100 100', preserveAspectRatio: 'none', role: 'img', 'aria-label': t('usageTrendTitle') },
                h('line', { x1: 0, y1: 100, x2: 100, y2: 100, className: 'power-dsh-usage-chart-axis' }),
                ...topModels.map(model => h('path', {
                  key: `${model.provider}/${model.modelId}`, d: smoothPath(seriesFor(model)),
                  className: 'power-dsh-usage-chart-line', 'data-model': topModels.indexOf(model),
                  fill: 'none', vectorEffect: 'non-scaling-stroke',
                }))),
              h('div', { className: 'power-dsh-usage-chart-axis-labels' },
                ...axisLabels.map(row => h('span', { key: row.date, className: 'power-dsh-usage-chart-axis-label' }, row.date.slice(5).replace('-', '/')))))
            : h('p', { className: 'power-dsh-usage-empty' }, t('usageChartEmpty')))),
        h('div', { className: 'power-dsh-usage-actions' },
          h(Button, { variant: 'outline', size: 'sm', disabled: busy, 'aria-busy': busy, onClick: () => { void loadUsageStats(); } },
            t('usageRefresh')))),
      customDialog);

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
