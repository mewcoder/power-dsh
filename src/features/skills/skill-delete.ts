import { lstat, mkdtemp, readdir, readlink, realpath, rename, rm, rmdir, unlink } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import type { SkillDeletion } from '../../shared/types/wire.ts';
import { pathExists, skillIdentity } from './skill-content.ts';

async function fingerprint(path: string): Promise<string> {
  const entries: unknown[] = [];
  const visit = async (current: string, name: string) => {
    if (entries.length >= 4096) throw new Error('skill-delete-unavailable');
    const info = await lstat(current);
    if (!info.isDirectory() && !info.isFile() && !info.isSymbolicLink()) throw new Error('skill-delete-unavailable');
    entries.push([name, info.dev, info.ino, info.mode, info.size, info.mtimeMs, name ? info.ctimeMs : 0,
      info.isSymbolicLink() ? await readlink(current) : '']);
    if (info.isDirectory()) for (const entry of (await readdir(current)).sort()) await visit(join(current, entry), name ? `${name}/${entry}` : entry);
  };
  await visit(path, '');
  return skillIdentity(JSON.stringify(entries));
}

export async function skillDeletion(base: string, root: string, name: string, sourcePath: string): Promise<SkillDeletion | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) return null;
  const bundle = join(root, name);
  const flat = join(root, `${name}.md`);
  const source = resolve(sourcePath);
  const path = source === bundle || source === join(bundle, 'SKILL.md') ? bundle : source === flat ? flat : '';
  if (!path) return null;
  if (await realpath(root) !== resolve(await realpath(base), relative(base, root))) return null;
  const info = await lstat(path);
  const linked = info.isSymbolicLink();
  if (!linked && (path === flat ? !info.isFile() : !info.isDirectory())) return null;
  const revision = skillIdentity(path, await fingerprint(path));
  return { path, linked, revision };
}

export async function deleteOwnedSkill(base: string, root: string, name: string, sourcePath: string, revision: string, active: () => void,
  prepare?: () => Promise<(() => Promise<void>) | undefined>) {
  const before = await skillDeletion(base, root, name, sourcePath);
  if (!before || !revision || revision !== before.revision) throw new Error('skill-delete-changed');
  active();
  const expected = await fingerprint(before.path);
  if (skillIdentity(before.path, expected) !== revision) throw new Error('skill-delete-changed');
  const temporary = await mkdtemp(join(root, '.power-dsh-delete-'));
  const staged = join(temporary, 'skill');
  let moved = false;
  let rollback: (() => Promise<void>) | undefined;
  try {
    active();
    const current = await skillDeletion(base, root, name, sourcePath);
    if (current?.revision !== revision) throw new Error('skill-delete-changed');
    active();
    await rename(before.path, staged);
    moved = true;
    if (await fingerprint(staged) !== expected) throw new Error('skill-delete-changed');
    active();
    rollback = await prepare?.();
    active();
    if (before.linked) await unlink(staged);
    else await rm(staged, { recursive: true });
    moved = false;
  } catch (error) {
    if (moved && !await pathExists(before.path)) await rename(staged, before.path).catch(() => {});
    await rollback?.();
    throw error;
  } finally {
    await rmdir(temporary).catch(() => {});
  }
}
