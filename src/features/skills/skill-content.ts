import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, mkdtemp, open, readdir, realpath, rm, rmdir, stat, symlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export interface SkillFile {
  path: string;
  kind: 'directory' | 'file' | 'link';
  data: Buffer;
  mode: number;
  linkDirectory?: boolean;
}
export interface SkillPackage {
  flat: boolean;
  revision: string;
  files: SkillFile[];
}
export interface SkillReadBudget { files: number; bytes: number }

export function skillIdentity(...values: string[]) {
  return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}

export function pathInside(root: string, candidate: string) {
  const suffix = relative(resolve(root), resolve(candidate));
  return suffix === '' || (!isAbsolute(suffix) && suffix !== '..' && !suffix.startsWith(`..${sep}`));
}

export async function pathIdentity(path: string) {
  const value = await lstat(path);
  return `${value.dev}:${value.ino}`;
}

export async function pathExists(path: string) {
  try { await lstat(path); return true; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw new Error('skill-target-unavailable');
  }
}

async function boundedRead(path: string, size: number) {
  const handle = await open(path, 'r');
  try {
    const data = Buffer.alloc(size + 1);
    let length = 0;
    while (length < data.length) {
      const result = await handle.read(data, length, data.length - length, length);
      if (!result.bytesRead) break;
      length += result.bytesRead;
    }
    if (length !== size) throw new Error('skill-source-changed');
    return data.subarray(0, length);
  } finally { await handle.close(); }
}

export async function readSkillPackage(path: string, flat: boolean, budget: SkillReadBudget = { files: 0, bytes: 0 }): Promise<SkillPackage> {
  const root = await realpath(path);
  const files: SkillFile[] = [];
  let bytes = 0;
  const collect = async (current: string, name: string): Promise<void> => {
    budget.files++;
    if (budget.files > 4096 || files.length >= 512) throw new Error('skill-content-limit');
    const info = await lstat(current);
    if (info.isSymbolicLink()) {
      const target = await realpath(current);
      if (!pathInside(root, target)) throw new Error('skill-external-resource-link');
      const normalized = relative(dirname(current), target).split(sep).join('/') || '.';
      files.push({ path: name, kind: 'link', data: Buffer.from(normalized), mode: info.mode, linkDirectory: (await stat(target)).isDirectory() });
    } else if (info.isDirectory()) {
      if (name) files.push({ path: name, kind: 'directory', data: Buffer.alloc(0), mode: info.mode });
      const entries = (await readdir(current)).sort();
      for (const entry of entries) {
        if (entry === '.git' || entry === '.DS_Store') continue;
        await collect(join(current, entry), name ? `${name}/${entry}` : entry);
      }
    } else if (info.isFile()) {
      bytes += info.size;
      budget.bytes += info.size;
      if (bytes > 50 * 1024 * 1024 || budget.bytes > 256 * 1024 * 1024 || budget.files > 4096 || files.length >= 512) throw new Error('skill-content-limit');
      const data = await boundedRead(current, info.size);
      const after = await lstat(current);
      if (data.length !== info.size || after.ino !== info.ino || after.mtimeMs !== info.mtimeMs || after.size !== info.size) throw new Error('skill-source-changed');
      files.push({ path: name, kind: 'file', data, mode: info.mode });
    } else throw new Error('skill-resource-unsupported');
    if (files.length > 512) throw new Error('skill-content-limit');
  };
  await collect(root, flat ? 'SKILL.md' : '');
  if (!files.some(file => file.path === 'SKILL.md' && file.kind !== 'directory')) throw new Error('skill-definition-missing');
  const hash = createHash('sha256');
  for (const file of files.slice().sort((first, second) => first.path < second.path ? -1 : first.path > second.path ? 1 : 0)) {
    hash.update(JSON.stringify([file.path, file.kind, file.data.length]));
    hash.update(file.data);
  }
  return { flat, revision: hash.digest('hex'), files };
}

export async function skillRevision(path: string, flat: boolean) {
  return (await readSkillPackage(path, flat)).revision;
}

export async function skillMarkdown(path: string, flat: boolean) {
  const file = flat ? path : join(path, 'SKILL.md');
  const info = await lstat(await realpath(file));
  if (info.size > 1024 * 1024) throw new Error('skill-content-limit');
  const text = (await boundedRead(file, info.size)).toString('utf8');
  const end = text.startsWith('---') ? text.indexOf('\n---', 3) : -1;
  if (end < 0) return text.trim();
  const body = text.indexOf('\n', end + 1);
  return body < 0 ? '' : text.slice(body + 1).trim();
}

async function writePackage(snapshot: SkillPackage, target: string, active: () => void, reservedIdentity = '') {
  if (snapshot.flat) {
    active();
    const definition = snapshot.files.find(file => file.path === 'SKILL.md')!;
    await writeFile(target, definition.data, { flag: 'wx', mode: definition.mode & 0o777 });
    return;
  }
  if (!reservedIdentity) await mkdir(target);
  const created: { file: SkillFile; identity: string }[] = [];
  const ordered = snapshot.files.slice().sort((first, second) => first.path === 'SKILL.md' ? 1 : second.path === 'SKILL.md' ? -1 : first.path.split('/').length - second.path.split('/').length);
  try {
    for (const file of ordered) {
      active();
      if (reservedIdentity && await pathIdentity(target) !== reservedIdentity) throw new Error('skill-target-changed');
      const destination = join(target, file.path);
      if (file.kind === 'directory') await mkdir(destination, { mode: file.mode & 0o777 });
      else if (file.kind === 'link') {
        const link = file.data.toString().split('/').join(sep);
        await symlink(link, destination, file.linkDirectory ? 'dir' : 'file');
      }
      else await writeFile(destination, file.data, { flag: 'wx', mode: file.mode & 0o777 });
      created.push({ file, identity: await pathIdentity(destination) });
    }
  } catch (error) {
    if (reservedIdentity && await pathIdentity(target).catch(() => '') === reservedIdentity) {
      for (const { file, identity } of created.reverse()) {
        const destination = join(target, file.path);
        try {
          if (await pathIdentity(destination) !== identity) continue;
          if (file.kind === 'directory') await rmdir(destination);
          else if (file.kind === 'link' || (await boundedRead(destination, file.data.length)).equals(file.data)) await rm(destination);
        } catch {}
      }
    }
    throw error;
  }
}

export async function prepareSkillPackage(snapshot: SkillPackage, targetRoot: string, active: () => void) {
  active();
  await mkdir(targetRoot, { recursive: true });
  const temporary = await mkdtemp(join(targetRoot, '.power-dsh-'));
  const path = join(temporary, snapshot.flat ? 'skill.md' : 'skill');
  try {
    await writePackage(snapshot, path, active);
    active();
    if (await skillRevision(path, snapshot.flat) !== snapshot.revision) throw new Error('skill-copy-verification-failed');
    return { path, close: () => rm(temporary, { recursive: true, force: true }) };
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

export async function installPreparedSkill(staged: string, target: string, flat: boolean, active: () => void) {
  active();
  if (flat) {
    await copyFile(staged, target, constants.COPYFILE_EXCL);
    return;
  }
  const snapshot = await readSkillPackage(staged, false);
  active();
  await mkdir(target);
  const identity = await pathIdentity(target);
  try {
    active();
    if (await pathIdentity(target) !== identity || (await readdir(target)).length !== 0) throw new Error('skill-target-changed');
    await writePackage(snapshot, target, active, identity);
  } catch (error) {
    if (await pathIdentity(target).catch(() => '') === identity) await rmdir(target).catch(() => {});
    throw error;
  }
}

export async function installSkillLink(source: string, target: string, flat: boolean, active: () => void) {
  active();
  await mkdir(dirname(target), { recursive: true });
  if (pathInside(source, target)) throw new Error('skill-circular-link');
  try {
    await symlink(source, target, process.platform === 'win32' ? flat ? 'file' : 'junction' : flat ? 'file' : 'dir');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('skill-name-conflict');
    throw new Error('skill-link-failed');
  }
}
