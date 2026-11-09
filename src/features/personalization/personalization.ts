import { errorCode } from '../../shared/host/native.ts';
import type { PersonalizationFile as FileSnapshot } from './rpc.ts';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';

export const MAX_PROMPT_LENGTH = 20000;
const MAX_SOURCE_BYTES = 1024 * 1024;

function revision(text: string, exists: boolean) {
  return createHash('sha256').update(exists ? `file\0${text}` : 'missing').digest('hex');
}

// The native instruction file is the only source of truth; opening never writes it.
export class PersonalizationFile {
  home: string;
  path: string;
  ensureActive: () => void;
  constructor(home: string, ensureActive = () => {}) {
    if (!isAbsolute(home)) throw new TypeError('DSH home must be absolute');
    this.home = resolve(home);
    this.path = join(this.home, 'AGENTS.md');
    this.ensureActive = ensureActive;
  }

  async read(): Promise<FileSnapshot> {
    this.ensureActive();
    let text = '';
    let exists = true;
    try {
      const info = await lstat(this.path);
      if (!info.isFile()) throw new Error('Global AGENTS.md must be a regular file.');
      if (info.size > MAX_SOURCE_BYTES) throw new Error('Global AGENTS.md exceeds the native 1 MiB source limit.');
      text = await readFile(this.path, 'utf8');
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') throw error;
      exists = false;
    }
    this.ensureActive();
    return { path: this.path, text, revision: revision(text, exists) };
  }

  async save(text: string, expectedRevision: string) {
    if (typeof text !== 'string' || text.length > MAX_PROMPT_LENGTH) throw new TypeError('Instructions must be a string of at most 20000 characters.');
    if (typeof expectedRevision !== 'string' || !/^[a-f\d]{64}$/.test(expectedRevision)) throw new TypeError('Expected an instruction file revision.');
    const check = async () => {
      const current = await this.read();
      if (current.revision !== expectedRevision) {
        const error = Object.assign(new Error('Global AGENTS.md changed. Cancel to load the latest content before saving.'), { code: 'personalization/conflict' });
        throw error;
      }
      return current;
    };
    const current = await check();
    if (current.text === text) return current;
    await mkdir(this.home, { recursive: true });
    const temporary = join(this.home, `.AGENTS.md.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, text, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      await check();
      this.ensureActive();
      // Both paths are fixed to the verified DSH home; replace only its AGENTS.md.
      await rename(temporary, this.path);
    } finally {
      await unlink(temporary).catch(error => { if (errorCode(error) !== 'ENOENT') throw error; });
    }
    return this.read();
  }
}
