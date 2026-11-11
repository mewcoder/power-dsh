export interface CalendarRange { start: string; end: string }
const DAY_MS = 86_400_000;

/** Six complete Monday-first weeks keep the month stable while a range is selected. */
export function monthCells(month: string): string[] {
  const first = Date.parse(`${month}-01T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}$/.test(month) || !Number.isFinite(first)
    || new Date(first).toISOString().slice(0, 7) !== month) return [];
  const offset = (new Date(first).getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => new Date(first + (index - offset) * DAY_MS).toISOString().slice(0, 10));
}

/** Move a calendar month, clamping the day instead of overflowing a shorter month. */
export function shiftMonth(date: string, delta: number): string {
  const target = new Date(`${date.slice(0, 7)}-01T00:00:00.000Z`);
  target.setUTCMonth(target.getUTCMonth() + delta);
  const last = new Date(target);
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  target.setUTCDate(Math.min(Number(date.slice(8)), last.getUTCDate()));
  return target.toISOString().slice(0, 10);
}

/** A complete range starts a new selection; a second click sorts both endpoints. */
export function rangeAfterClick(range: CalendarRange, date: string): CalendarRange {
  if (!range.start || range.end) return { start: date, end: '' };
  return date < range.start ? { start: date, end: range.start } : { start: range.start, end: date };
}
