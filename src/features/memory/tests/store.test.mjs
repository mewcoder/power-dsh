import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, lstat, readdir, realpath, symlink, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { MemoryStore, buildMemoryIndex } from '../memory-store.ts';
import { createHash } from 'node:crypto';

async function fixture(t) {
  const home = await mkdtemp(join(tmpdir(), 'power-dsh-memory-'));
  const store = new MemoryStore(home);
  t.after(async () => { store.close(); await rm(home, { recursive: true, force: true }); });
  return { home, store };
}
const input = (overrides = {}) => ({
  type: 'user', name: 'chinese-readmes', description: 'README 使用中文', content: '用户希望 README 默认使用中文。',
  revision: '', originSessionId: 'session-1', ...overrides,
});

test('saving an exact duplicate under another name reuses the canonical file and revision', async t => {
  const { store } = await fixture(t);
  const original = await store.save('global', input());
  const duplicate = await store.save('global', input({ name: 'another-name', type: 'feedback', content: `  ${input().content}  \r\n` }));
  assert.equal(duplicate.reused, true);
  assert.deepEqual(duplicate.entry, original.entry);
  assert.equal((await store.list('global')).entries.length, 1);
  const unchanged = await store.save('global', input({ revision: original.entry.revision }));
  assert.equal(unchanged.reused, true);
  assert.equal(unchanged.entry.updated, original.entry.updated);
  assert.equal((await store.list('global', '', 'README')).entries[0].id, original.entry.id);
  assert.equal((await store.list('global', '', '不存在的主题')).entries.length, 0);
});

test('memory entries persist across instances and indexes are derived without losing Chinese text', async t => {
  const { home, store } = await fixture(t);
  const saved = await store.save('global', input());
  assert.equal(saved.indexUpdated, true);
  const path = join(home, 'power-dsh/memory/chinese-readmes.md');
  if (process.platform !== 'win32') assert.equal((await lstat(path)).mode & 0o777, 0o600);
  assert.match(await readFile(join(home, 'power-dsh/memory/MEMORY.md'), 'utf8'), /README 使用中文/);
  const second = new MemoryStore(home);
  t.after(() => second.close());
  assert.equal((await second.read('global', 'user/chinese-readmes')).content, input().content);
  const changed = await second.save('global', input({ revision: saved.entry.revision, content: '新的稳定偏好。' }));
  await assert.rejects(store.save('global', input({ revision: saved.entry.revision })), /memoryConflict/);
  assert.equal((await store.read('global', changed.entry.id)).content, '新的稳定偏好。');
});

test('workspace identity follows real paths and never falls back to process cwd', async t => {
  const { home, store } = await fixture(t);
  const project = join(home, 'project');
  await mkdir(project);
  const workspace = await store.workspace(project);
  await store.save(workspace.id, input({ type: 'project', name: 'build-command' }), workspace.cwd);
  await store.refresh(project);
  assert.equal(store.cached(project).find(scope => scope.id !== 'global').entries.length, 1);
  assert.equal((await store.list('global')).entries.length, 0);
  await assert.rejects(store.workspace(undefined), /memoryWorkspaceUnavailable/);
  await assert.rejects(store.workspace('.'), /memoryWorkspaceUnavailable/);
  await assert.rejects(store.workspace(join(home, 'missing')), /memoryWorkspaceUnavailable/);
  const catalog = await store.catalog();
  assert.equal(catalog.scopes.find(scope => scope.id === workspace.id).cwd, workspace.cwd);
  assert.equal(catalog.scopes.length, 2);
  await rm(project, { recursive: true });
  await store.refresh(project);
  assert.equal(store.cached(project).some(scope => scope.id === workspace.id), false);
});

test('global files are flat in the memory root and clearing them preserves project files', async t => {
  const { home, store } = await fixture(t);
  await store.save('global', input());
  const project = join(home, 'project');
  await mkdir(project);
  const workspace = await store.workspace(project);
  await store.save(workspace.id, input({ type: 'project' }), workspace.cwd);
  const root = await realpath(join(home, 'power-dsh/memory'));
  const projectDirectory = join(root, workspace.id);
  assert.equal(await store.folder('global'), root);
  assert.equal(await store.folder(workspace.id), projectDirectory);
  assert.deepEqual((await readdir(root)).sort(), ['MEMORY.md', 'chinese-readmes.md', workspace.id].sort());
  assert.deepEqual((await readdir(projectDirectory)).sort(), ['MEMORY.md', 'chinese-readmes.md', 'scope.json']);
  assert.match(await readFile(join(root, 'MEMORY.md'), 'utf8'), /→ chinese-readmes\.md/);
  assert.equal((await store.list('global')).entries.length, 1);
  const before = await store.read(workspace.id, 'project/chinese-readmes');
  const global = (await store.catalog()).scopes.find(scope => scope.id === 'global');
  await store.clear('global', global.revision);
  assert.equal((await store.list('global')).entries.length, 0);
  assert.equal((await store.read(workspace.id, before.id)).revision, before.revision);
});

test('flat filenames cannot collide across types or overwrite the reserved index', async t => {
  const { store } = await fixture(t);
  const original = await store.save('global', input());
  await assert.rejects(store.save('global', input({ type: 'feedback' })), /memoryConflict/);
  await assert.rejects(store.save('global', input({ name: 'memory' })), /memoryInvalid/);
  assert.equal((await store.read('global', original.entry.id)).revision, original.entry.revision);
});

test('file-manager metadata is ignored without hiding memories or counting toward the workspace limit', async t => {
  const { home, store } = await fixture(t);
  await store.save('global', input());
  const project = join(home, 'project');
  await mkdir(project);
  const workspace = await store.workspace(project);
  await store.save(workspace.id, input({ type: 'project', name: 'build-command' }), workspace.cwd);
  const root = join(home, 'power-dsh/memory');
  const metadata = ['.DS_Store', 'Thumbs.db', 'desktop.ini', ...Array.from({ length: 65 }, (_, index) => `._metadata-${index}`)];
  await Promise.all(metadata.map(name => writeFile(join(root, name), 'file-manager metadata')));
  await writeFile(join(root, workspace.id, '.DS_Store'), 'project metadata');
  const catalog = await store.catalog();
  assert.deepEqual(catalog.scopes.map(scope => [scope.id, scope.entries.length, scope.complete]),
    [['global', 1, true], [workspace.id, 1, true]]);
  assert.equal((await store.read(workspace.id, 'project/build-command')).content, input().content);
  assert.equal(await readFile(join(root, '.DS_Store'), 'utf8'), 'file-manager metadata');
});

test('creating a 65th project is refused before it can make the memory catalog unreadable', async t => {
  const { home, store } = await fixture(t);
  const root = join(home, 'power-dsh/memory');
  await mkdir(root, { recursive: true });
  for (let index = 0; index < 64; index++) {
    const cwd = join(home, `project-${index}`);
    const hash = createHash('sha256').update(cwd).digest('hex');
    await mkdir(join(root, hash));
    await writeFile(join(root, hash, 'scope.json'), JSON.stringify({ cwd }));
  }
  const cwd = join(home, 'new-project');
  await mkdir(cwd);
  const workspace = await store.workspace(cwd);
  await assert.rejects(store.save(workspace.id, input(), workspace.cwd), /memoryLimit/);
  assert.equal((await store.catalog()).scopes.length, 65);
  await assert.rejects(lstat(join(root, workspace.id)), { code: 'ENOENT' });
});

test('workspace scanning still rejects unexpected directories, symlinks and hash-named regular files', async t => {
  const { home, store } = await fixture(t);
  const directory = join(home, 'power-dsh/memory');
  await mkdir(directory, { recursive: true });
  const unexpected = join(directory, 'unexpected');
  await mkdir(unexpected);
  await assert.rejects(store.catalog(), /memoryInvalid/);
  await rm(unexpected, { recursive: true });
  const hashed = join(directory, 'a'.repeat(64));
  await writeFile(hashed, 'not a directory');
  await assert.rejects(store.catalog(), /memoryInvalid/);
  await unlink(hashed);
  const outside = join(home, 'outside');
  await mkdir(outside);
  await symlink(outside, hashed, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(store.catalog(), /memoryInvalid/);
});

test('revision conflicts protect updated entries from stale deletion', async t => {
  const { store } = await fixture(t);
  const saved = await store.save('global', input());
  const changed = await store.save('global', input({ revision: saved.entry.revision, content: '更新后的记忆。' }));
  await assert.rejects(store.remove('global', saved.entry.id, saved.entry.revision), /memoryConflict/);
  assert.equal((await store.read('global', changed.entry.id)).content, '更新后的记忆。');
  await store.remove('global', changed.entry.id, changed.entry.revision);
  await assert.rejects(store.read('global', changed.entry.id), /memoryNotFound/);
});

test('scope clear rejects a stale confirmation and preserves new entries', async t => {
  const { store } = await fixture(t);
  await store.save('global', input());
  const before = (await store.catalog()).scopes[0];
  await store.save('global', input({ name: 'new-preference', content: '另一个偏好。' }));
  await assert.rejects(store.clear('global', before.revision), /memoryConflict/);
  assert.equal((await store.list('global')).entries.length, 2);
  const current = (await store.catalog()).scopes[0];
  assert.equal((await store.clear('global', current.revision)).indexUpdated, true);
  assert.equal((await store.list('global')).entries.length, 0);
});

test('malformed frontmatter stays visible and can be removed without entering the index', async t => {
  const { home, store } = await fixture(t);
  await store.save('global', input());
  await writeFile(join(home, 'power-dsh/memory/broken.md'), 'not frontmatter');
  const catalog = await store.catalog();
  const broken = catalog.scopes[0].entries.find(row => row.name === 'broken');
  assert.equal(broken.invalid, true);
  assert.doesNotMatch(await readFile(join(home, 'power-dsh/memory/MEMORY.md'), 'utf8'), /broken/);
  await store.remove('global', broken.id, broken.revision);
  assert.equal((await store.list('global')).entries.length, 1);
});

test('path traversal and memory-directory symlinks cannot write outside the memory root', async t => {
  const { home, store } = await fixture(t);
  await assert.rejects(store.save('global', input({ name: '../escaped' })), /memoryInvalid/);
  await assert.rejects(store.read('../outside', 'user/name'), /memoryInvalid/);
  await assert.rejects(store.read('global', 'user/name/../../escaped'), /memoryInvalid/);
  const outside = join(home, 'outside');
  await mkdir(outside);
  await mkdir(join(home, 'power-dsh'), { recursive: true });
  await rm(join(home, 'power-dsh/memory'), { recursive: true });
  await symlink(outside, join(home, 'power-dsh/memory'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(store.save('global', input()), /memoryInvalid/);
  await assert.rejects(lstat(join(outside, 'chinese-readmes.md')), { code: 'ENOENT' });
});

test('index failure reports committed data and a later refresh repairs the index', async t => {
  const { home, store } = await fixture(t);
  const saved = await store.save('global', input());
  const indexPath = join(home, 'power-dsh/memory/MEMORY.md');
  await unlink(indexPath);
  await mkdir(indexPath);
  const result = await store.save('global', input({ revision: saved.entry.revision, content: '已经保存的新正文。' }));
  assert.equal(result.indexUpdated, false);
  assert.equal((await store.read('global', saved.entry.id)).content, '已经保存的新正文。');
  await rm(indexPath, { recursive: true });
  await store.refresh();
  assert.match(await readFile(indexPath, 'utf8'), /chinese-readmes/);
});

test('an active cross-profile writer is rejected and release permits the next operation', async t => {
  const { home, store } = await fixture(t);
  await store.save('global', input());
  const lockPath = join(home, 'power-dsh/memory/.write-lock');
  await writeFile(lockPath, JSON.stringify({ pid: process.pid, token: 'other-profile' }));
  await assert.rejects(store.list('global'), /memoryBusy/);
  await unlink(lockPath);
  assert.equal((await store.list('global')).entries.length, 1);
});

test('concurrent creations serialize and cannot silently overwrite one another', async t => {
  const { store } = await fixture(t);
  const results = await Promise.allSettled([store.save('global', input()), store.save('global', input({ content: '另一会话的正文。' }))]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.match(results.find(result => result.status === 'rejected').reason.message, /memoryConflict/);
});

test('a late permission change cancels an atomic write and keeps the old entry', async t => {
  const { store } = await fixture(t);
  const original = await store.save('global', input());
  let checks = 0;
  await assert.rejects(store.save('global', input({ revision: original.entry.revision, content: '不应该写入。' }), '', () => {
    if (++checks === 3) throw new Error('memoryDisabled');
  }), /memoryDisabled/);
  assert.equal((await store.read('global', original.entry.id)).content, input().content);
});

test('index budgets count UTF-16 characters, preserve whole links and expose omissions', () => {
  const entries = Array.from({ length: 220 }, (_, index) => ({
    id: `user/topic-${index}`, name: `topic-${index}`, description: '中文描述'.repeat(30),
    invalid: false,
  }));
  const text = buildMemoryIndex(entries, 1500);
  assert.ok(text.length <= 1500);
  assert.match(text, /^- topic-0 → topic-0.md —/);
  assert.match(text, /WARNING:/);
  for (const line of text.split('\n').filter(line => line.startsWith('- '))) assert.match(line, /→ topic-\d+.md — /);
});

test('pagination still discovers entries omitted from the injected index', async t => {
  const { home, store } = await fixture(t);
  await store.save('global', input());
  const directory = join(home, 'power-dsh/memory');
  const template = await readFile(join(directory, 'chinese-readmes.md'), 'utf8');
  await Promise.all(Array.from({ length: 55 }, (_, index) => {
    const name = `topic-${index}`;
    return writeFile(join(directory, `${name}.md`), template.replace('name: "chinese-readmes"', `name: "${name}"`));
  }));
  const first = await store.list('global');
  assert.equal(first.entries.length, 50);
  assert.equal(first.nextCursor, '50');
  const second = await store.list('global', first.nextCursor);
  assert.equal(second.entries.length, 6);
  assert.equal(second.nextCursor, '');
  assert.equal(new Set([...first.entries, ...second.entries].map(entry => entry.id)).size, 56);
  await assert.rejects(store.list('global', '-1'), /memoryInvalid/);
});
