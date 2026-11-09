import type { NativeSkill } from '../../shared/host/native.ts';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join, win32 } from 'node:path';

const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const DIRECTORY_NAME = /^\.[a-z0-9][a-z0-9._-]*$/i;
// Confirmed provider identities in the shipped 0.2.2-rc.1 package implementations.
const BUNDLED_PROVIDERS = new Map([
  ['dsh-office', '@deepseek-ai/dsh-skill-office'],
  ['dsh-badge', '@deepseek-ai/dsh-skill-badge'],
]);
const DIRECTORIES = new Map([
  ['user-dsh', '.dsh'], ['project-dsh', '.dsh'],
  ['user-agents', '.agents'], ['project-agents', '.agents'],
]);
const absolutePath = (value: unknown): value is string => typeof value === 'string' && (isAbsolute(value) || win32.isAbsolute(value));

function directoryAt(path: unknown) {
  if (!absolutePath(path)) return '';
  const matches = [...path.replaceAll('\\', '/').matchAll(/(?:^|\/)(\.[a-z0-9][a-z0-9._-]*)\/skills(?=\/|$)/gi)];
  return matches.at(-1)?.[1] ?? '';
}

async function packageAt(path: string, readPackage: (path: string, encoding: 'utf8') => Promise<string>) {
  const filename = path.replaceAll('\\', '/');
  const candidates = [...filename.matchAll(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)/g)]
    .filter(match => match[1] !== '.pnpm').reverse();
  for (const match of candidates) {
    const expected = match[1];
    if (!PACKAGE_NAME.test(expected)) continue;
    const end = match.index + match[0].length;
    const manifest = join(filename.slice(0, end), 'package.json');
    try {
      const pkg = JSON.parse(await readPackage(manifest, 'utf8'));
      if (pkg.name === expected) return expected;
    } catch (_error) { /* Missing or invalid manifests do not establish an owning package. */ }
    return ''; // A containing package must not claim an unverified nested dependency.
  }
  return '';
}

/** Resolve a display-only origin from public skill paths or confirmed package metadata, without reading skill bodies. */
export async function skillOrigin(skill: Pick<NativeSkill, 'source' | 'provider' | 'path' | 'resourceBase' | 'origin'>, { readPackage = readFile }: { readPackage?: (path: string, encoding: 'utf8') => Promise<string> } = {}): Promise<string> {
  if (DIRECTORIES.has(skill.source)) return DIRECTORIES.get(skill.source)!;
  const paths = [skill.path, skill.resourceBase?.kind === 'directory' ? skill.resourceBase.path : undefined];
  const bundled = ['runtime', 'plugin', 'bundled'].includes(skill.source) || skill.source?.startsWith('bundled-');
  if (!bundled) {
    for (const path of paths) {
      const directory = directoryAt(path);
      if (directory) return directory;
    }
    return typeof skill.origin === 'string' && DIRECTORY_NAME.test(skill.origin) ? skill.origin : directoryAt(skill.origin);
  }
  if (typeof skill.origin === 'string' && PACKAGE_NAME.test(skill.origin)) return skill.origin;
  if (skill.source === 'bundled' && BUNDLED_PROVIDERS.has(skill.provider)) return BUNDLED_PROVIDERS.get(skill.provider)!;
  for (const path of paths) {
    if (!absolutePath(path)) continue;
    const owner = await packageAt(path, readPackage);
    if (owner) return owner;
  }
  return '';
}
