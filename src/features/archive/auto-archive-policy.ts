/** The saved threshold uses 0 for “never”; unsupported Hosts preserve the preference. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** A display timestamp is only a shortlist. Eligibility requires an exact native projection. */
export function idleSince(createdAt: unknown, metadata: unknown): number | undefined {
  if (!isTimestamp(createdAt) || metadata === null || typeof metadata !== 'object'
    || !('blank' in metadata) || metadata.blank !== false || !('lastPromptAt' in metadata)
    || !isTimestamp(metadata.lastPromptAt)) return undefined;
  return Math.max(createdAt, metadata.lastPromptAt);
}

export function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
export const AUTO_ARCHIVE_DAYS = Object.freeze([0, 7, 14, 30, 60, 90]);
export const AUTO_ARCHIVE_NEVER = 0;

export function normalizeDays(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && AUTO_ARCHIVE_DAYS.includes(value)
    ? value
    : AUTO_ARCHIVE_NEVER;
}
