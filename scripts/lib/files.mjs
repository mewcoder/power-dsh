import { readdir } from 'node:fs/promises';
import path from 'node:path';

export async function listFiles(base, prefix = '') {
  const entries = await readdir(path.join(base, prefix), { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const name = path.posix.join(prefix, entry.name);
    return entry.isDirectory() ? listFiles(base, name) : [name];
  }));
  return nested.flat().sort();
}

export function matches(pattern, name) {
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const segments = pattern.split('/');
  const source = segments.map((segment, index) => segment === '**'
    ? '(?:[^/]+/)*'
    : segment.split('*').map(escape).join('[^/]*') + (index < segments.length - 1 ? '/' : '')).join('');
  return new RegExp(`^${source}$`).test(name);
}
