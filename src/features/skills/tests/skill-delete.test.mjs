import assert from 'node:assert/strict';
import { test } from 'node:test';
import { access, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { skillDeletion, deleteOwnedSkill } from '../skill-delete.ts';

async function fixture(run) {
  const base = await mkdtemp(join(tmpdir(), 'power-dsh-delete-'));
  const root = join(base, 'skills');
  const path = join(root, 'guide');
  await mkdir(join(path, 'assets'), { recursive: true });
  await writeFile(join(path, 'SKILL.md'), 'Guide instructions');
  await writeFile(join(path, 'assets', 'sample.txt'), 'Resource');
  try { await run({ base, root, path }); }
  finally { await rm(base, { recursive: true, force: true }); }
}

test('deletion removes only the confirmed DSH bundle and all its resources', async () => fixture(async ({ base, root, path }) => {
  await writeFile(join(root, 'other.md'), 'Keep');
  const deletion = await skillDeletion(base, root, 'guide', join(path, 'SKILL.md'));
  assert.equal(deletion.path, path);
  assert.equal(deletion.linked, false);
  await deleteOwnedSkill(base, root, 'guide', join(path, 'SKILL.md'), deletion.revision, () => {});
  await assert.rejects(access(path));
  assert.equal(await readFile(join(root, 'other.md'), 'utf8'), 'Keep');
  assert.deepEqual(await readdir(root), ['other.md']);
}));

test('flat files delete individually and external resource links never delete their targets', async () => fixture(async ({ base, root, path }) => {
  const external = join(base, 'shared.txt');
  await writeFile(external, 'External source');
  await symlink(external, join(path, 'assets', 'external'));
  const bundle = await skillDeletion(base, root, 'guide', join(path, 'SKILL.md'));
  await deleteOwnedSkill(base, root, 'guide', join(path, 'SKILL.md'), bundle.revision, () => {});
  assert.equal(await readFile(external, 'utf8'), 'External source');
  const flat = join(root, 'flat.md');
  await writeFile(flat, 'Flat instructions');
  const deletion = await skillDeletion(base, root, 'flat', flat);
  await deleteOwnedSkill(base, root, 'flat', flat, deletion.revision, () => {});
  await assert.rejects(access(flat));
}));

test('root links and broken links are unlinked without touching source files', async () => fixture(async ({ base, root, path }) => {
  const source = join(base, 'external');
  await rename(path, source);
  await symlink(source, path, process.platform === 'win32' ? 'junction' : 'dir');
  const deletion = await skillDeletion(base, root, 'guide', join(path, 'SKILL.md'));
  assert.equal(deletion.linked, true);
  await deleteOwnedSkill(base, root, 'guide', join(path, 'SKILL.md'), deletion.revision, () => {});
  await assert.rejects(lstat(path));
  assert.equal(await readFile(join(source, 'SKILL.md'), 'utf8'), 'Guide instructions');
  await symlink(join(base, 'absent'), path);
  const broken = await skillDeletion(base, root, 'guide', join(path, 'SKILL.md'));
  await deleteOwnedSkill(base, root, 'guide', join(path, 'SKILL.md'), broken.revision, () => {});
  await assert.rejects(lstat(path));
}));

test('only exact DSH-owned entries are eligible and shared skill roots are refused', async () => fixture(async ({ base, root, path }) => {
  assert.equal(await skillDeletion(base, root, 'other', join(path, 'SKILL.md')), null);
  assert.equal(await skillDeletion(base, root, '../guide', join(path, 'SKILL.md')), null);
  assert.equal(await skillDeletion(base, root, 'guide', join(path, 'assets', 'sample.txt')), null);
  const shared = join(base, 'shared');
  await rename(root, shared);
  await symlink(shared, root, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(await skillDeletion(base, root, 'guide', join(path, 'SKILL.md')), null);
  await assert.rejects(deleteOwnedSkill(base, root, 'guide', join(path, 'SKILL.md'), 'a'.repeat(64), () => {}));
  assert.equal(await readFile(join(shared, 'guide', 'SKILL.md'), 'utf8'), 'Guide instructions');
}));

test('confirmation refuses changed resources and replacement paths', async () => fixture(async ({ base, root, path }) => {
  const deletion = await skillDeletion(base, root, 'guide', join(path, 'SKILL.md'));
  await writeFile(join(path, 'assets', 'sample.txt'), 'Changed resources');
  await assert.rejects(deleteOwnedSkill(base, root, 'guide', join(path, 'SKILL.md'), deletion.revision, () => {}), /changed/);
  const newer = await skillDeletion(base, root, 'guide', join(path, 'SKILL.md'));
  await rename(path, join(root, 'kept'));
  await mkdir(path);
  await writeFile(join(path, 'SKILL.md'), 'Replacement');
  await assert.rejects(deleteOwnedSkill(base, root, 'guide', join(path, 'SKILL.md'), newer.revision, () => {}), /changed/);
  assert.equal(await readFile(join(path, 'SKILL.md'), 'utf8'), 'Replacement');
}));

test('failed preparation or cancellation restores the staged entry and rolls back preferences', async () => fixture(async ({ base, root, path }) => {
  const deletion = await skillDeletion(base, root, 'guide', join(path, 'SKILL.md'));
  await assert.rejects(deleteOwnedSkill(base, root, 'guide', join(path, 'SKILL.md'), deletion.revision, () => {}, async () => {
    throw new Error('preference write rejected');
  }), /preference write rejected/);
  assert.equal(await readFile(join(path, 'SKILL.md'), 'utf8'), 'Guide instructions');
  let cancelled = false;
  let restored = false;
  await assert.rejects(deleteOwnedSkill(base, root, 'guide', join(path, 'SKILL.md'), deletion.revision,
    () => { if (cancelled) throw new Error('inactive'); }, async () => {
      cancelled = true;
      return async () => { restored = true; };
    }), /inactive/);
  assert.equal(restored, true);
  assert.equal(await readFile(join(path, 'SKILL.md'), 'utf8'), 'Guide instructions');
  assert.deepEqual(await readdir(root), ['guide']);
}));
