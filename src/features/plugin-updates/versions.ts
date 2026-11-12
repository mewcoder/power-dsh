export function versionParts(value: unknown): number[] | null {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) return null;
  const parts = value.split('.').map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}

export function compareVersions(left: string, right: string): number | null {
  const first = versionParts(left);
  const second = versionParts(right);
  if (!first || !second) return null;
  for (let index = 0; index < 3; index++) if (first[index] !== second[index]) return first[index] > second[index] ? 1 : -1;
  return 0;
}
