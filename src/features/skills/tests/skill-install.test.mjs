import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, realpath, lstat, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { discoverExternal, discoverSkillRoot, resolveSelection } from '../skill-import.ts';
import { skillRevision, readSkillPackage, pathInside, prepareSkillPackage, installPreparedSkill } from '../skill-content.ts';
import { addDiscoveredSkill } from '../skill-install.ts';

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'power-dsh-sources-'));
  const sources = join(root, 'sources');
  const target = join(root, 'profile', 'skills');
  const write = async (directory, name, body = 'Original instructions') => {
    const path = join(directory, name);
    await mkdir(path, { recursive: true });
    await writeFile(join(path, 'SKILL.md'), `---\nname: ${name}\ndescription: Skill ${name}\n---\n\n${body}\n`);
    return path;
  };
  const add = (skill, mode, revision, active = () => {}) => addDiscoveredSkill(target, skill, mode, revision, active);
  try { await run({ root, sources, target, add, write }); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test('discovery retains every source and distinguishes native availability from differing content', async () => fixture(async ({ root, target, write }) => {
  const claude = join(root, 'claude');
  const codex = join(root, 'codex');
  const cursor = join(root, 'cursor');
  const first = await write(claude, 'review');
  await write(codex, 'review');
  await mkdir(cursor);
  await symlink(first, join(cursor, 'review'), process.platform === 'win32' ? 'junction' : 'dir');
  const roots = [{ source: 'claude-code', path: claude }, { source: 'codex', path: codex }, { source: 'cursor', path: cursor }];
  const [entry] = await discoverExternal(roots, target, new Set());
  assert.equal(entry.comparison, 'same');
  assert.equal(entry.sources.length, 3);
  assert.equal(entry.variants.length, 2);
  assert.equal(entry.available, false);
  await write(target, 'review');
  const native = new Map([['review', join(target, 'review', 'SKILL.md')]]);
  const [existing] = await discoverExternal(roots, target, new Set(['review']), native);
  assert.equal(existing.available, true);
  assert.equal(existing.conflict, false);
  assert.equal(existing.id, entry.id);
  await writeFile(join(codex, 'review', 'tool.js'), 'different resource');
  const [changed] = await discoverExternal(roots, target, new Set(['review']), native);
  assert.equal(changed.available, true);
  assert.equal(changed.conflict, true);
  assert.equal(changed.comparison, 'different');
  assert.equal(changed.variants[0].id, entry.variants[0].id);
  assert.equal((await resolveSelection(roots, [entry.variants[0].id])).length, 1);
}));

test('candidate identities do not collide for the same agent and name in different folders', async () => fixture(async ({ sources, write }) => {
  await write(sources, 'review');
  await mkdir(join(sources, 'alias'));
  await writeFile(join(sources, 'alias', 'SKILL.md'), await readFile(join(sources, 'review', 'SKILL.md')));
  const entries = await discoverSkillRoot({ source: 'codex', path: sources });
  assert.equal(entries.length, 2);
  assert.notEqual(entries[0].id, entries[1].id);
}));

test('copy follows a root link, preserves resources and remains independent without writing history', async () => fixture(async ({ root, sources, target, add, write }) => {
  const source = await write(sources, 'review');
  await mkdir(join(source, 'scripts'));
  await writeFile(join(source, 'scripts', 'run.sh'), 'echo original', { mode: 0o755 });
  const alias = join(root, 'alias');
  await mkdir(alias);
  await symlink(source, join(alias, 'review'), process.platform === 'win32' ? 'junction' : 'dir');
  const [skill] = await discoverSkillRoot({ source: 'codex', path: alias });
  await add(skill, 'copy', await skillRevision(source, false));
  assert.equal((await lstat(join(target, 'review'))).isSymbolicLink(), false);
  assert.equal(await readFile(join(target, 'review', 'scripts', 'run.sh'), 'utf8'), 'echo original');
  assert.deepEqual(await readdir(join(root, 'profile')), ['skills']);
  await writeFile(join(source, 'scripts', 'run.sh'), 'echo newer');
  await rm(source, { recursive: true });
  assert.equal(await readFile(join(target, 'review', 'scripts', 'run.sh'), 'utf8'), 'echo original');
}));

test('the link operation references the real source without producing installation records', async () => fixture(async ({ sources, target, add, write }) => {
  const source = await write(sources, 'review');
  const [skill] = await discoverSkillRoot({ source: 'codex', path: sources });
  await add(skill, 'link', await skillRevision(source, false));
  assert.equal(await realpath(join(target, 'review')), await realpath(source));
  await rm(source, { recursive: true });
  assert.equal((await lstat(join(target, 'review'))).isSymbolicLink(), true);
}));

test('add refuses stale sources, dangling targets and flat-name conflicts without overwriting', async () => fixture(async ({ root, sources, target, add, write }) => {
  const source = await write(sources, 'review');
  const [skill] = await discoverSkillRoot({ source: 'codex', path: sources });
  const revision = await skillRevision(source, false);
  await write(sources, 'review', 'Changed');
  await assert.rejects(add(skill, 'copy', revision), /source-changed/);
  await mkdir(target, { recursive: true });
  await symlink(join(root, 'missing'), join(target, 'review'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(add(skill, 'copy', await skillRevision(source, false)), /name-conflict/);
  await rm(join(target, 'review'));
  await writeFile(join(target, 'review.md'), 'Existing flat skill');
  await assert.rejects(add(skill, 'copy', await skillRevision(source, false)), /name-conflict/);
  assert.equal(await readFile(join(target, 'review.md'), 'utf8'), 'Existing flat skill');
}));

test('unloading after publication removes only the unchanged copy owned by that operation', async () => fixture(async ({ sources, target, add, write }) => {
  const source = await write(sources, 'review');
  const [skill] = await discoverSkillRoot({ source: 'codex', path: sources });
  await assert.rejects(add(skill, 'copy', await skillRevision(source, false), () => {
    if (existsSync(join(target, 'review', 'SKILL.md'))) throw new Error('unloaded');
  }), /unloaded/);
  assert.deepEqual(await readdir(target), []);
}));

test('internal resource links are preserved and external resource links refuse import', async () => fixture(async ({ root, sources, target, add, write }) => {
  const source = await write(sources, 'review');
  await writeFile(join(source, 'asset.txt'), 'asset');
  await symlink('asset.txt', join(source, 'alias.txt'), 'file');
  const [skill] = await discoverSkillRoot({ source: 'codex', path: sources });
  await add(skill, 'copy', await skillRevision(source, false));
  assert.equal(await readFile(join(target, 'review', 'alias.txt'), 'utf8'), 'asset');
  await writeFile(join(root, 'outside.txt'), 'outside');
  await symlink(join(root, 'outside.txt'), join(source, 'external.txt'), 'file');
  await assert.rejects(readSkillPackage(source, false), /external-resource-link/);
}));

test('exclusive publication cleans an interrupted copy and never overwrites a target', async () => fixture(async ({ sources, target, write }) => {
  const source = await write(sources, 'review');
  await writeFile(join(source, 'asset.txt'), 'resource');
  const staged = await prepareSkillPackage(await readSkillPackage(source, false), target, () => {});
  const destination = join(target, 'review');
  try {
    await assert.rejects(installPreparedSkill(staged.path, destination, false, () => {
      if (existsSync(join(destination, 'asset.txt'))) throw new Error('unloaded during publication');
    }), /unloaded/);
    assert.equal(existsSync(destination), false);
    await write(target, 'review', 'Existing user skill');
    await assert.rejects(installPreparedSkill(staged.path, destination, false, () => {}), { code: 'EEXIST' });
    assert.match(await readFile(join(destination, 'SKILL.md'), 'utf8'), /Existing user skill/);
  } finally { await staged.close(); }
}));

test('legacy history is neither read nor changed and sibling paths remain outside the package', async () => fixture(async ({ root, sources, target, add, write }) => {
  assert.equal(pathInside(join(root, 'skills'), join(root, 'skills-other', 'review')), false);
  const history = join(root, 'profile', 'power-dsh', 'skill-imports.json');
  await mkdir(join(history, '..'), { recursive: true });
  await writeFile(history, '{old-invalid-record');
  const source = await write(sources, 'review');
  const [skill] = await discoverSkillRoot({ source: 'codex', path: sources });
  await add(skill, 'copy', await skillRevision(source, false));
  assert.equal(await readFile(history, 'utf8'), '{old-invalid-record');
}));
