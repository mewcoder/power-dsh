import { errorCode } from '../../shared/host/native.ts';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import type { WallpaperAsset, WallpaperCleared } from '../../shared/types/wire.ts';

/** Bounded so a single profile never carries an unbounded binary asset. */
export const MAX_WALLPAPER_BYTES = 25 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

function cleanName(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Wallpaper name must be a string.');
  // Keep only the base name; reject traversal and empty labels.
  const name = value.split(/[\\/]/).pop()?.trim() ?? '';
  if (!name || name.length > 200) throw new TypeError('Wallpaper name must be 1-200 characters.');
  return name;
}

interface AssetSnapshot { name: string; mime: string }

/** One user wallpaper stored inside the plugin's own profile directory. */
export class WallpaperStore {
  home: string;
  directory: string;
  binary: string;
  metadata: string;
  ensureActive: () => void;
  constructor(home: string, ensureActive = () => {}) {
    if (!isAbsolute(home)) throw new TypeError('DSH home must be absolute');
    this.home = resolve(home);
    this.directory = join(this.home, 'power-dsh');
    this.binary = join(this.directory, 'wallpaper.bin');
    this.metadata = join(this.directory, 'wallpaper.json');
    this.ensureActive = ensureActive;
  }

  async read(): Promise<WallpaperAsset | null> {
    this.ensureActive();
    let bytes: Buffer;
    try {
      const info = await lstat(this.binary);
      if (!info.isFile()) throw new Error('Wallpaper must be a regular file.');
      if (info.size > MAX_WALLPAPER_BYTES) throw new Error('Wallpaper exceeds the 25 MiB limit.');
      bytes = await readFile(this.binary);
    } catch (error) {
      if (errorCode(error) === 'ENOENT') return null;
      throw error;
    }
    let meta: AssetSnapshot;
    try {
      const raw = JSON.parse(await readFile(this.metadata, 'utf8')) as unknown;
      if (typeof raw !== 'object' || raw === null) throw new Error('Invalid wallpaper metadata.');
      const record = raw as Record<string, unknown>;
      if (typeof record.name !== 'string' || typeof record.mime !== 'string' || !Object.hasOwn(MIME_EXTENSIONS, record.mime)) {
        throw new Error('Invalid wallpaper metadata.');
      }
      meta = { name: record.name, mime: record.mime };
    } catch (error) {
      if (errorCode(error) === 'ENOENT') return null;
      throw error;
    }
    this.ensureActive();
    return { path: this.binary, name: meta.name, mime: meta.mime, bytes: bytes.byteLength, dataUrl: `data:${meta.mime};base64,${bytes.toString('base64')}` };
  }

  async save(dataUrl: string, rawName: string): Promise<WallpaperAsset> {
    if (typeof dataUrl !== 'string') throw new TypeError('Wallpaper must be a data URL.');
    const match = DATA_URL.exec(dataUrl);
    if (!match) throw new TypeError('Wallpaper must be a PNG, JPEG or WebP data URL.');
    const [, mime] = match;
    const name = cleanName(rawName);
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.byteLength === 0) throw new TypeError('Wallpaper image is empty.');
    if (bytes.byteLength > MAX_WALLPAPER_BYTES) throw new TypeError('Wallpaper exceeds the 25 MiB limit.');
    await mkdir(this.directory, { recursive: true });
    const binTmp = join(this.directory, `.wallpaper.${randomUUID()}.bin.tmp`);
    const metaTmp = join(this.directory, `.wallpaper.${randomUUID()}.json.tmp`);
    try {
      await writeFile(binTmp, bytes, { flag: 'wx', mode: 0o600 });
      await writeFile(metaTmp, JSON.stringify({ name, mime }), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      this.ensureActive();
      await rename(binTmp, this.binary);
      await rename(metaTmp, this.metadata);
    } finally {
      await unlink(binTmp).catch(error => { if (errorCode(error) !== 'ENOENT') throw error; });
      await unlink(metaTmp).catch(error => { if (errorCode(error) !== 'ENOENT') throw error; });
    }
    const saved = await this.read();
    if (!saved) throw new Error('Wallpaper was not stored.');
    return saved;
  }

  async clear(): Promise<WallpaperCleared> {
    this.ensureActive();
    await unlink(this.binary).catch(error => { if (errorCode(error) !== 'ENOENT') throw error; });
    await unlink(this.metadata).catch(error => { if (errorCode(error) !== 'ENOENT') throw error; });
    this.ensureActive();
    return { cleared: true };
  }
}
