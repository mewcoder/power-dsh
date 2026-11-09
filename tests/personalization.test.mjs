import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Config } from '../src/index.js';
import { PersonalizationFile } from '../src/personalization.js';
import { OperationQueue } from '../src/operation-queue.js';

async function fixture(fn) {
  const home = await mkdtemp(join(tmpdir(), 'power-dsh-instructions-'));
  try { await fn(new PersonalizationFile(home), home); }
  finally {
    // Only remove the exact temporary directory created above, never a user DSH home.
    assert.equal(home.startsWith(join(tmpdir(), 'power-dsh-instructions-')), true);
    await rm(home, { recursive: true, force: true });
  }
}

test('opening missing AGENTS.md does not create files; explicit saves preserve literal Chinese text', () => fixture(async (file, home) => {
  const initial = await file.read();
  assert.equal(initial.path, join(home, 'AGENTS.md'));
  assert.equal(initial.text, '');
  assert.deepEqual(await readdir(home), []);
  const text = '始终用中文。{{literal}}\n😀';
  const saved = await file.save(text, initial.revision);
  assert.equal(await readFile(saved.path, 'utf8'), text);
  assert.equal(saved.text, text);
  assert.notEqual(saved.revision, initial.revision);
  assert.deepEqual(await readdir(home), ['AGENTS.md']);
  const cleared = await file.save('', saved.revision);
  assert.equal(cleared.text, '');
  assert.equal(await readFile(saved.path, 'utf8'), '');
}));

test('existing disk instructions win; external edits reject stale saves without overwriting content', () => fixture(async (file) => {
  await writeFile(file.path, '用户原内容');
  const original = await file.read();
  assert.equal(original.text, '用户原内容');
  await writeFile(file.path, '外部新内容');
  await assert.rejects(file.save('旧窗口草稿', original.revision), { code: 'personalization/conflict' });
  assert.equal(await readFile(file.path, 'utf8'), '外部新内容');
  const updated = await file.read();
  assert.notEqual(updated.revision, original.revision);
  assert.equal((await file.save('主动保存', updated.revision)).text, '主动保存');
}));

test('two queued stale editors cannot overwrite each other, and unloading prevents writes', () => fixture(async (file, home) => {
  const queue = new OperationQueue();
  const store = new PersonalizationFile(home, () => queue.ensureActive());
  const initial = await store.read();
  const one = queue.run(() => store.save('第一个窗口', initial.revision));
  const two = queue.run(() => store.save('第二个窗口', initial.revision));
  await one;
  await assert.rejects(two, { code: 'personalization/conflict' });
  queue.close();
  await assert.rejects(store.save('卸载后的写入', initial.revision), /unloaded/);
  assert.equal(await readFile(file.path, 'utf8'), '第一个窗口');
}));

test('validation preserves disk data, existing long files are readable, and symlinks are not replaced', () => fixture(async (file, home) => {
  await writeFile(file.path, '字'.repeat(20001));
  const initial = await file.read();
  assert.equal(initial.text.length, 20001);
  await assert.rejects(file.save(initial.text, initial.revision), /20000/);
  await assert.rejects(file.save(true, initial.revision), /string/);
  await assert.rejects(file.save('new', 'bad-revision'), /revision/);
  assert.equal((await file.read()).text.length, 20001);
  const other = join(home, 'other');
  const linkHome = await mkdtemp(join(tmpdir(), 'power-dsh-instructions-'));
  try {
    await writeFile(other, 'linked instructions');
    await symlink(other, join(linkHome, 'AGENTS.md'));
    await assert.rejects(new PersonalizationFile(linkHome).read(), /regular file/);
    assert.equal(await readFile(other, 'utf8'), 'linked instructions');
  } finally {
    assert.ok(linkHome.startsWith(join(tmpdir(), 'power-dsh-instructions-')));
    await rm(linkHome, { recursive: true, force: true });
  }
}));

test('feature defaults off and instruction text is not a settings field', () => {
  assert.equal(Config.dict.personalizationEnabled.meta.default, false);
  assert.equal(Config.dict.globalPrompt, undefined);
  assert.throws(() => new PersonalizationFile('relative/home'), /absolute/);
});
