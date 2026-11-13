import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { SKILL_SOURCES, discoverExternal, discoverSkillRoot, importDiscoveredSkill, parseSkillFrontmatter, resolveSkillRoots, resolveSelection } from '../skill-import.ts';

async function sandbox() {
  const root = await mkdtemp(join(tmpdir(), 'power-dsh-import-'));
  return { root, dispose: () => rm(root, { recursive: true, force: true }) };
}

async function writeSkill(root, name, body = 'Instructions') {
  const dir = join(root, name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: Test ${name}\n---\n\n${body}\n`);
}

test('frontmatter parsing accepts kebab names and rejects missing fields', () => {
  assert.deepEqual(parseSkillFrontmatter('---\nname: code-review\ndescription: Review code\n---\nbody'), {
    name: 'code-review', description: 'Review code',
  });
  assert.deepEqual(parseSkillFrontmatter('---\nname: "quoted-name"\ndescription: >\n  folded text\n---\n'), {
    name: 'quoted-name', description: 'folded text',
  });
  assert.equal(parseSkillFrontmatter('---\nname: Bad Name\ndescription: x\n---\n'), null);
  assert.equal(parseSkillFrontmatter('---\nname: ok\n---\n'), null);
  assert.equal(parseSkillFrontmatter('no frontmatter'), null);
});

test('discovery lists bundles and flat files while skipping hidden and malformed entries', async () => {
  const { root, dispose } = await sandbox();
  try {
    const source = join(root, 'claude');
    await writeSkill(source, 'code-review');
    await writeFile(join(source, 'flat-skill.md'), '---\nname: flat-skill\ndescription: Flat\n---\nbody');
    await mkdir(join(source, '.system'), { recursive: true });
    await writeFile(join(source, 'broken.md'), 'no frontmatter');
    const entries = await discoverSkillRoot({ source: 'claude-code', path: source });
    assert.deepEqual(entries.map(entry => [entry.name, entry.flat, entry.source]), [
      ['code-review', false, 'claude-code'],
      ['flat-skill', true, 'claude-code'],
    ]);
  } finally { await dispose(); }
});

test('a missing root is empty while already-known skills remain visible with native availability', async () => {
  const { root, dispose } = await sandbox();
  try {
    const source = join(root, 'codex');
    await writeSkill(source, 'shared-skill');
    await writeSkill(source, 'new-skill');
    const target = join(root, 'dsh', 'skills');
    const entries = await discoverExternal([{ source: 'codex', path: source }], target, new Set(['shared-skill']), new Map([['shared-skill', join(source, 'shared-skill', 'SKILL.md')]]));
    assert.deepEqual(entries.map(entry => [entry.name, entry.available]), [['new-skill', false], ['shared-skill', true]]);
    await writeSkill(target, 'new-skill');
    assert.deepEqual((await discoverExternal([{ source: 'codex', path: source }], target, new Set()))
      .map(entry => entry.name), ['new-skill', 'shared-skill']);
    assert.equal((await discoverExternal([{ source: 'codex', path: source }], target, new Set())).find(entry => entry.name === 'new-skill').conflict, true);
    const missing = await discoverExternal([{ source: 'missing', path: join(root, 'nope') }], target, new Set());
    assert.deepEqual(missing, []);
  } finally { await dispose(); }
});

test('import copies a bundle with resources and refuses to overwrite', async () => {
  const { root, dispose } = await sandbox();
  try {
    const source = join(root, 'cursor');
    await writeSkill(source, 'with-assets');
    await mkdir(join(source, 'with-assets', 'references'), { recursive: true });
    await writeFile(join(source, 'with-assets', 'references', 'notes.md'), 'reference');
    const [skill] = await discoverSkillRoot({ source: 'cursor', path: source });
    const target = join(root, 'dsh', 'skills');
    await importDiscoveredSkill(skill, target);
    assert.equal(await readFile(join(target, 'with-assets', 'references', 'notes.md'), 'utf8'), 'reference');
    await assert.rejects(() => importDiscoveredSkill(skill, target), /already exists/);
  } finally { await dispose(); }
});

test('roots cover the supported external agents in user and project scope', () => {
  const roots = resolveSkillRoots('/home/user', '/work/project', {});
  const user = roots.filter(root => root.scope === 'user');
  const sources = new Set(user.map(root => root.source));
  for (const id of ['claude-code', 'codex', 'cursor', 'gemini', 'opencode', 'copilot', 'windsurf', 'roo', 'trae', 'qoder', 'lingma', 'cc-switch', 'agents']) {
    assert.ok(sources.has(id), `Missing user root for ${id}`);
  }
  assert.equal(user.find(root => root.source === 'claude-code').path, join('/home/user', '.claude', 'skills'));
  assert.equal(user.find(root => root.source === 'opencode').path, join('/home/user', '.config', 'opencode', 'skills'));
  assert.equal(user.find(root => root.source === 'gemini').path, join('/home/user', '.gemini', 'antigravity', 'skills'));
  assert.equal(roots.find(root => root.source === 'codex' && root.scope === 'project').path, join('/work/project', '.codex', 'skills'));
});

test('tool home overrides relocate the user root and blank overrides are ignored', () => {
  const overridden = resolveSkillRoots('/home/user', '', { CODEX_HOME: '/custom/codex', CLAUDE_CONFIG_DIR: '/custom/claude' });
  assert.equal(overridden.find(root => root.source === 'codex' && root.scope === 'user').path, join('/custom/codex', 'skills'));
  assert.equal(overridden.find(root => root.source === 'claude-code' && root.scope === 'user').path, join('/custom/claude', 'skills'));
  const blank = resolveSkillRoots('/home/user', '', { CODEX_HOME: '   ' });
  assert.equal(blank.find(root => root.source === 'codex' && root.scope === 'user').path, join('/home/user', '.codex', 'skills'));
});

test('two tools serving the same linked directory describe one skill', async () => {
  const { root, dispose } = await sandbox();
  try {
    const shared = join(root, 'shared');
    await writeSkill(shared, 'linked-skill');
    const codex = join(root, 'codex');
    const claude = join(root, 'claude');
    await mkdir(codex, { recursive: true });
    await mkdir(claude, { recursive: true });
    await symlink(join(shared, 'linked-skill'), join(codex, 'linked-skill'), 'dir');
    await symlink(join(shared, 'linked-skill'), join(claude, 'linked-skill'), 'dir');
    const roots = [
      { source: 'codex', label: 'Codex', scope: 'user', path: codex },
      { source: 'claude-code', label: 'Claude Code', scope: 'user', path: claude },
    ];
    const entries = await discoverExternal(roots, join(root, 'dsh'), new Set());
    assert.equal(entries.length, 1, 'The same real directory collapses into one row');
  } finally { await dispose(); }
});

test('selection resolves only the requested ids', async () => {
  const { root, dispose } = await sandbox();
  try {
    const dir = join(root, 'codex');
    await writeSkill(dir, 'alpha');
    await writeSkill(dir, 'beta');
    const roots = [{ source: 'codex', label: 'Codex', scope: 'user', path: dir }];
    const selected = await resolveSelection(roots, ['codex:beta:dir']);
    assert.deepEqual(selected.map(skill => skill.name), ['beta']);
  } finally { await dispose(); }
});
