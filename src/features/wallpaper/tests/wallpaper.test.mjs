import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_WALLPAPER_BYTES, WallpaperStore } from '../wallpaper.ts';

const PNG = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64')}`;

async function home(t) {
  const directory = await mkdtemp(join(tmpdir(), 'power-dsh-wallpaper-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('a saved wallpaper round-trips through the profile directory', async t => {
  const store = new WallpaperStore(await home(t));
  assert.equal(await store.read(), null, 'A missing wallpaper reads as empty, not as an error.');
  const saved = await store.save(PNG, 'my photo.png');
  assert.equal(saved.name, 'my photo.png');
  assert.equal(saved.mime, 'image/png');
  assert.equal(saved.dataUrl, PNG);
  const reread = await store.read();
  assert.deepEqual(reread, saved, 'The stored bytes and metadata survive a reload.');
  const info = await stat(store.binary);
  assert.equal(info.mode & 0o777, 0o600, 'The wallpaper file stays private to the profile owner.');
});

test('replacing and clearing a wallpaper leaves no temporary files behind', async t => {
  const directory = await home(t);
  const store = new WallpaperStore(directory);
  await store.save(PNG, 'first.png');
  const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64')}`;
  const replaced = await store.save(jpeg, 'second.jpg');
  assert.equal(replaced.name, 'second.jpg');
  assert.equal(replaced.mime, 'image/jpeg');
  assert.equal((await store.read()).dataUrl, jpeg);
  assert.deepEqual((await readdir(store.directory)).sort(), ['wallpaper.bin', 'wallpaper.json']);
  assert.deepEqual(await store.clear(), { cleared: true });
  assert.equal(await store.read(), null);
  assert.deepEqual(await store.clear(), { cleared: true }, 'Clearing twice is harmless.');
});

test('unsupported, empty and oversized payloads are rejected before writing', async t => {
  const store = new WallpaperStore(await home(t));
  for (const [payload, name] of [
    ['data:text/plain;base64,AAAA', 'a.png'],
    ['https://example.com/a.png', 'a.png'],
    ['data:image/png;base64,', 'a.png'],
    ['data:image/gif;base64,AAAA', 'a.gif'],
    [PNG, ''],
  ]) await assert.rejects(() => store.save(payload, name));
  const oversized = `data:image/png;base64,${Buffer.alloc(MAX_WALLPAPER_BYTES + 3).toString('base64')}`;
  await assert.rejects(() => store.save(oversized, 'big.png'), /25 MiB/);
  assert.equal(await store.read(), null);
});

test('path traversal in the display name cannot escape the profile directory', async t => {
  const directory = await home(t);
  const store = new WallpaperStore(directory);
  const saved = await store.save(PNG, '../../etc/passwd');
  assert.equal(saved.name, 'passwd', 'Only the base name is kept.');
  const saved2 = await store.save(PNG, 'C:\\Windows\\wall.png');
  assert.equal(saved2.name, 'wall.png');
  assert.equal(await readFile(store.metadata, 'utf8').then(JSON.parse).then(meta => meta.name), 'wall.png');
});

test('corrupt metadata is reported instead of guessing the image type', async t => {
  const directory = await home(t);
  const store = new WallpaperStore(directory);
  await store.save(PNG, 'ok.png');
  await writeFile(store.metadata, 'not json');
  await assert.rejects(() => store.read());
  await writeFile(store.metadata, JSON.stringify({ name: 'ok.png', mime: 'image/svg+xml' }));
  await assert.rejects(() => store.read());
});

test('an inactive plugin context never writes the wallpaper', async t => {
  const directory = await home(t);
  let active = true;
  const store = new WallpaperStore(directory, () => { if (!active) throw new Error('unloaded'); });
  await store.save(PNG, 'ok.png');
  active = false;
  await assert.rejects(() => store.save(PNG, 'later.png'), /unloaded/);
  await assert.rejects(() => store.clear(), /unloaded/);
});
