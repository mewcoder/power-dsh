import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, realpath, rename, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { isAbsolute, join, resolve } from 'node:path';
import { OperationQueue } from '../../shared/host/operation-queue.ts';
import { MEMORY_TYPES, type MemoryCatalog, type MemoryDetail, type MemoryEntry, type MemoryScope, type MemoryType, type MemoryCleanupPreview } from './types.ts';
import { isRecord } from '../../shared/types/protocol.ts';

const MAX_FILE_BYTES = 16_384;
const MAX_ENTRIES = 500;
const MAX_SCOPES = 64;
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SCOPE = /^(?:global|[a-f0-9]{64})$/;
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const missing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === 'ENOENT';
const exists = (error: unknown) => (error as NodeJS.ErrnoException)?.code === 'EEXIST';
const normalized = (text: string) => text.normalize('NFC').replace(/\r\n?/g, '\n').split('\n').map(line => line.trimEnd()).join('\n').trim();

export function validateMemoryName(name: string) {
  if (name.length > 64 || !NAME.test(name) || name === 'memory') throw new Error('memoryInvalid');
}

function entryParts(id: string): [MemoryType, string] {
  const [type, name, extra] = id.split('/');
  if (extra !== undefined || !MEMORY_TYPES.includes(type as MemoryType) || !name) throw new Error('memoryInvalid');
  validateMemoryName(name);
  return [type as MemoryType, name];
}

function summary(entry: MemoryDetail): MemoryEntry {
  const { content: _content, ...row } = entry;
  return row;
}

function indexField(text: string) {
  return text.replace(/[\r\n\u0000-\u001f\u007f]/g, ' ').replace(/[<>&]/g, character =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[character]!).replaceAll('{{', '{\u200b{');
}

export function buildMemoryIndex(entries: readonly MemoryEntry[], budget = 25_000) {
  const lines: string[] = [];
  let length = 0;
  const rows = entries.filter(row => !row.invalid);
  for (const entry of rows) {
    const line = `- ${entry.name} → ${entry.name}.md — ${indexField(entry.description)}`;
    if (lines.length >= 200 || length + line.length + 1 > budget - 160) break;
    lines.push(line);
    length += line.length + 1;
  }
  if (lines.length < rows.length) lines.push(`WARNING: ${rows.length - lines.length} entries omitted. Use power_dsh_memory list to page through all entries.`);
  return lines.join('\n');
}

export function parseMemoryFile(text: string, name: string): MemoryDetail {
  validateMemoryName(name);
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!match) throw new Error('memoryInvalid');
  const fields: Record<string, unknown> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const field = /^([a-zA-Z]+): (.+)$/.exec(line);
    if (!field || Object.hasOwn(fields, field[1]!)) throw new Error('memoryInvalid');
    fields[field[1]!] = JSON.parse(field[2]!);
  }
  const [type] = entryParts(`${fields.type}/${name}`);
  const id = `${type}/${name}`;
  const content = match[2]!;
  if (fields.schemaVersion !== 1 || fields.name !== name || fields.type !== type
    || typeof fields.description !== 'string' || !fields.description.trim()
    || fields.description.length > 160 || /[\r\n\u0000-\u001f\u007f]/.test(fields.description)
    || typeof fields.created !== 'string'
    || typeof fields.updated !== 'string' || typeof fields.originSessionId !== 'string'
    || fields.originSessionId.length > 200 || !Number.isFinite(Date.parse(fields.created))
    || !Number.isFinite(Date.parse(fields.updated)) || !content.trim() || content.length > 1200) throw new Error('memoryInvalid');
  return { id, name, type, description: fields.description, created: fields.created,
    updated: fields.updated, originSessionId: fields.originSessionId, content, revision: digest(text), invalid: false };
}

function serialize(entry: MemoryDetail) {
  const fields = { schemaVersion: 1, name: entry.name, description: entry.description, type: entry.type,
    created: entry.created, updated: entry.updated, originSessionId: entry.originSessionId };
  return `---\n${Object.entries(fields).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n${entry.content}`;
}

interface ScopeData { scope: MemoryScope; details: MemoryDetail[] }
interface SaveMemory { type: MemoryType; name: string; description: string; content: string; revision: string; originSessionId: string }

export class MemoryStore {
  readonly path: string;
  readonly queue = new OperationQueue();
  private snapshots = new Map<string, ScopeData>();
  private workspaces = new Map<string, { id: string; cwd: string }>();
  private closed = false;
  private home: string;
  private ensureActive: () => void;

  constructor(home: string, ensureActive: () => void = () => {}) {
    this.home = home;
    this.ensureActive = ensureActive;
    this.path = resolve(home, 'power-dsh/memory');
  }

  close() { this.closed = true; this.queue.close(); this.snapshots.clear(); this.workspaces.clear(); }

  private check() {
    if (this.closed) throw new Error('memoryDisabled');
    this.ensureActive();
  }

  private scopeParts(scope: string) {
    if (!SCOPE.test(scope)) throw new Error('memoryInvalid');
    return scope === 'global' ? [] : [scope];
  }

  private async directory(parts: string[], create: boolean, base = 'memory') {
    let current = await realpath(this.home);
    for (const part of ['power-dsh', base, ...parts]) {
      current = join(current, part);
      if (create) {
        this.check();
        try { await mkdir(current, { mode: 0o700 }); } catch (error) { if (!exists(error)) throw error; }
      }
      try {
        const info = await lstat(current);
        if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('memoryInvalid');
        if (await realpath(current) !== current) throw new Error('memoryInvalid');
      } catch (error) {
        if (missing(error) && !create) return null;
        throw error;
      }
    }
    return current;
  }

  private async readFile(directory: string, filename: string) {
    const target = join(directory, filename);
    const info = await lstat(target);
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_FILE_BYTES) throw new Error('memoryInvalid');
    const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.size > MAX_FILE_BYTES || opened.ino !== info.ino || opened.dev !== info.dev) throw new Error('memoryConflict');
      const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
      let offset = 0;
      while (offset < buffer.length) {
        const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
        if (bytesRead === 0) break;
        offset += bytesRead;
      }
      const after = await handle.stat();
      if (offset > MAX_FILE_BYTES) throw new Error('memoryInvalid');
      if (after.size !== opened.size || after.mtimeMs !== opened.mtimeMs) throw new Error('memoryConflict');
      return buffer.subarray(0, offset).toString('utf8');
    } finally { await handle.close(); }
  }

  private async atomic(directory: string, filename: string, text: string, guard: () => void = () => {}, restoring = false) {
    if (!restoring) this.check();
    guard();
    try {
      const info = await lstat(join(directory, filename));
      if (!info.isFile() || info.isSymbolicLink()) throw new Error('memoryInvalid');
    } catch (error) { if (!missing(error)) throw error; }
    const temporary = `.memory-${randomUUID()}.tmp`;
    const handle = await open(join(directory, temporary), 'wx', 0o600);
    try {
      await handle.writeFile(text, 'utf8');
      await handle.sync();
      if (!restoring) this.check();
      guard();
      await rename(join(directory, temporary), join(directory, filename));
    } finally {
      await handle.close();
      await unlink(join(directory, temporary)).catch(error => { if (!missing(error)) throw error; });
    }
  }

  private async locked<T>(operation: () => Promise<T>): Promise<T> {
    return this.queue.run(async () => {
      this.check();
      const directory = await this.directory([], true);
      if (!directory) throw new Error('memoryUnavailable');
      const token = JSON.stringify({ pid: process.pid, token: randomUUID() });
      let handle;
      try { handle = await open(join(directory, '.write-lock'), 'wx', 0o600); } catch (error) {
        if (!exists(error)) throw error;
        try {
          const oldText = await this.readFile(directory, '.write-lock');
          const old: unknown = JSON.parse(oldText);
          if (typeof old !== 'object' || old === null || !('pid' in old)
            || !Number.isSafeInteger(old.pid) || Number(old.pid) <= 0) throw new Error('memoryBusy');
          try { process.kill(Number(old.pid), 0); throw new Error('memoryBusy'); } catch (failure) {
            if ((failure as NodeJS.ErrnoException).code !== 'ESRCH') throw new Error('memoryBusy');
          }
          if (await this.readFile(directory, '.write-lock') !== oldText) throw new Error('memoryBusy');
          await unlink(join(directory, '.write-lock'));
          handle = await open(join(directory, '.write-lock'), 'wx', 0o600);
        } catch { throw new Error('memoryBusy'); }
      }
      try {
        await handle.writeFile(token);
        await this.recover(directory);
        this.check();
        return await operation();
      } finally {
        await handle.close();
        if (await this.readFile(directory, '.write-lock').catch(() => '') === token) await unlink(join(directory, '.write-lock'));
      }
    });
  }

  async workspace(cwd: string | undefined) {
    if (!cwd || !isAbsolute(cwd)) throw new Error('memoryWorkspaceUnavailable');
    let canonical: string;
    try { canonical = await realpath(cwd); } catch {
      this.workspaces.delete(cwd);
      throw new Error('memoryWorkspaceUnavailable');
    }
    const info = { id: digest(canonical), cwd: canonical };
    this.workspaces.set(cwd, info);
    return info;
  }

  private async load(scope: string, cwd = ''): Promise<ScopeData> {
    const directory = await this.directory(this.scopeParts(scope), false);
    const details: MemoryDetail[] = [];
    let complete = true;
    if (directory) {
      if (scope !== 'global') {
        const metadata: unknown = JSON.parse(await this.readFile(directory, 'scope.json'));
        if (typeof metadata !== 'object' || metadata === null || !('cwd' in metadata)
          || typeof metadata.cwd !== 'string' || !isAbsolute(metadata.cwd)
          || digest(metadata.cwd) !== scope || cwd && metadata.cwd !== cwd) throw new Error('memoryInvalid');
        cwd = metadata.cwd;
      }
      const files = (await readdir(directory)).sort();
      for (const file of files) {
        if (!file.endsWith('.md') || file.toLowerCase() === 'memory.md') continue;
        if (details.length >= MAX_ENTRIES) { complete = false; break; }
        const name = file.slice(0, -3);
        try { validateMemoryName(name); } catch { complete = false; continue; }
        const text = await this.readFile(directory, file);
        try { details.push(parseMemoryFile(text, name)); } catch {
          details.push({ id: `user/${name}`, name, type: 'user', description: '', content: '',
            created: '', updated: '', originSessionId: '', revision: digest(text), invalid: true });
        }
      }
    }
    return this.cache(scope, cwd, details, complete);
  }

  private cache(scope: string, cwd: string, details: MemoryDetail[], complete: boolean) {
    details.sort((left, right) => right.updated.localeCompare(left.updated) || left.id.localeCompare(right.id));
    const entries = details.map(summary);
    const data: ScopeData = { scope: { id: scope, cwd, complete, entries,
      revision: digest(JSON.stringify(entries.map(row => [row.id, row.revision]).sort())) }, details };
    this.snapshots.set(scope, data);
    return data;
  }

  private async rebuild(data: ScopeData) {
    const directory = await this.directory(this.scopeParts(data.scope.id), false);
    if (!directory) return true;
    const text = buildMemoryIndex(data.scope.entries);
    try {
      if (await this.readFile(directory, 'MEMORY.md').catch(error => {
        if (missing(error)) return null;
        throw error;
      }) !== text) await this.atomic(directory, 'MEMORY.md', text);
      return true;
    } catch { return false; }
  }

  async refresh(cwd?: string, globalEnabled = true, workspaceEnabled = true) {
    if (!globalEnabled && !workspaceEnabled) return;
    const workspace = cwd && workspaceEnabled ? await this.workspace(cwd).catch(() => null) : null;
    return this.locked(async () => {
      if (globalEnabled) {
        const global = await this.load('global');
        if (!await this.rebuild(global)) throw new Error('memoryWriteFailed');
      }
      if (workspace) {
        const project = await this.load(workspace.id, workspace.cwd);
        if (!await this.rebuild(project)) throw new Error('memoryWriteFailed');
      }
    });
  }

  cached(cwd?: string): MemoryScope[] {
    const project = cwd ? this.workspaces.get(cwd) : undefined;
    return ['global', ...(project ? [project.id] : [])].flatMap(id => {
      const value = this.snapshots.get(id);
      return value ? [{ ...value.scope, entries: value.scope.entries.map(row => ({ ...row })) }] : [];
    });
  }

  async catalog(): Promise<MemoryCatalog> {
    return this.locked(async () => {
      const scopes = [(await this.load('global')).scope];
      const directory = await this.directory([], false);
      if (directory) {
        const names = (await readdir(directory, { withFileTypes: true }))
          .filter(entry => !entry.isFile() || /^[a-f0-9]{64}$/.test(entry.name))
          .map(entry => entry.name).sort();
        if (names.length > MAX_SCOPES) throw new Error('memoryLimit');
        for (const name of names) {
          if (!/^[a-f0-9]{64}$/.test(name)) throw new Error('memoryInvalid');
          scopes.push((await this.load(name)).scope);
        }
      }
      for (const scope of scopes) if (!await this.rebuild(this.snapshots.get(scope.id)!)) throw new Error('memoryWriteFailed');
      return { path: this.path, available: true, error: '', scopes };
    });
  }

  async folder(scope: string) {
    this.check();
    const directory = await this.directory(this.scopeParts(scope), false);
    this.check();
    if (!directory) throw new Error('memoryNotFound');
    return directory;
  }

  async list(scope: string, cursor = '', query = '') {
    if (cursor && !/^\d{1,6}$/.test(cursor) || query.length > 160) throw new Error('memoryInvalid');
    return this.locked(async () => {
      const { scope: snapshot, details } = await this.load(scope);
      const term = query.trim().normalize('NFC').toLowerCase();
      const entries = term ? details.filter(entry => !entry.invalid &&
        normalized(`${entry.name}\n${entry.description}\n${entry.content}`).toLowerCase().includes(term)).map(summary) : snapshot.entries;
      const offset = Number(cursor);
      return { entries: entries.slice(offset, offset + 50), complete: snapshot.complete,
        nextCursor: offset + 50 < entries.length ? String(offset + 50) : '' };
    });
  }

  async read(scope: string, id: string) {
    entryParts(id);
    return this.locked(async () => {
      const entry = (await this.load(scope)).details.find(row => row.id === id);
      if (!entry) throw new Error('memoryNotFound');
      return { ...entry };
    });
  }

  async save(scope: string, input: SaveMemory, cwd = '', guard: () => void = () => {}) {
    validateMemoryName(input.name);
    if (!MEMORY_TYPES.includes(input.type) || !input.description.trim() || input.description.length > 160
      || /[\r\n\u0000-\u001f\u007f]/.test(input.description) || !input.content.trim() || input.content.length > 1200) throw new Error('memoryInvalid');
    return this.locked(async () => {
      guard();
      const data = await this.load(scope, cwd);
      const id = `${input.type}/${input.name}`;
      const previous = data.details.find(row => row.name === input.name);
      if (previous && previous.id !== id || (previous?.revision ?? '') !== input.revision) throw new Error('memoryConflict');
      if (!data.scope.complete) throw new Error('memoryLimit');
      const duplicate = !previous ? data.details.find(row => !row.invalid && normalized(row.content) === normalized(input.content)) : null;
      if (duplicate) return { entry: summary(duplicate), indexUpdated: await this.rebuild(data), reused: true };
      if (previous && !previous.invalid && previous.content === input.content && previous.description === input.description) {
        return { entry: summary(previous), indexUpdated: await this.rebuild(data), reused: true };
      }
      if (!data.scope.complete || !previous && data.details.length >= MAX_ENTRIES) throw new Error('memoryLimit');
      if (scope !== 'global') {
        if (!cwd || digest(cwd) !== scope) throw new Error('memoryWorkspaceUnavailable');
        if (!await this.directory(this.scopeParts(scope), false)) {
          const root = await this.directory([], true);
          const projects = (await readdir(root!, { withFileTypes: true })).filter(entry => entry.isDirectory());
          if (projects.length >= MAX_SCOPES) throw new Error('memoryLimit');
        }
        const directory = await this.directory(this.scopeParts(scope), true);
        if (!directory) throw new Error('memoryUnavailable');
        await this.atomic(directory, 'scope.json', JSON.stringify({ cwd }), guard);
      }
      const directory = await this.directory(this.scopeParts(scope), true);
      if (!directory) throw new Error('memoryUnavailable');
      const now = new Date().toISOString();
      const entry: MemoryDetail = { id, name: input.name, type: input.type, description: input.description,
        content: input.content, created: previous?.created || now, updated: now,
        originSessionId: input.originSessionId.slice(0, 200), revision: '', invalid: false };
      const text = serialize(entry);
      parseMemoryFile(text, input.name);
      await this.atomic(directory, `${input.name}.md`, text, guard);
      entry.revision = digest(text);
      const updated = this.cache(scope, cwd, [...data.details.filter(row => row.id !== id), entry], data.scope.complete);
      return { entry: summary(entry), indexUpdated: await this.rebuild(updated), reused: false };
    });
  }

  async remove(scope: string, id: string, revision: string, guard: () => void = () => {}) {
    const [, name] = entryParts(id);
    return this.locked(async () => {
      guard();
      const data = await this.load(scope);
      const entry = data.details.find(row => row.id === id);
      if (!entry) throw new Error('memoryNotFound');
      if (entry.revision !== revision) throw new Error('memoryConflict');
      const directory = await this.directory(this.scopeParts(scope), false);
      if (!directory) throw new Error('memoryNotFound');
      this.check();
      guard();
      await unlink(join(directory, `${name}.md`));
      const updated = this.cache(scope, data.scope.cwd,
        data.details.filter(row => row.id !== id), data.scope.complete);
      return { indexUpdated: await this.rebuild(updated) };
    });
  }

  async clear(scope: string, revision: string) {
    return this.locked(async () => {
      const data = await this.load(scope);
      if (!data.scope.complete) throw new Error('memoryLimit');
      if (revision !== data.scope.revision) throw new Error('memoryConflict');
      let deleted = 0;
      try {
        for (const entry of data.details) {
          const [, name] = entryParts(entry.id);
          const directory = await this.directory(this.scopeParts(scope), false);
          if (!directory) throw new Error('memoryConflict');
          this.check();
          await unlink(join(directory, `${name}.md`));
          deleted++;
        }
      } catch (error) {
        if (deleted > 0) throw new Error('memoryClearPartial');
        throw error;
      }
      const updated = this.cache(scope, data.scope.cwd, [], data.scope.complete);
      return { indexUpdated: await this.rebuild(updated) };
    });
  }

  async cleanupSnapshot(scope: string) {
    return this.locked(async () => {
      const data = await this.load(scope);
      if (!data.scope.complete || data.details.some(entry => entry.invalid)) throw new Error('memoryIncomplete');
      if (JSON.stringify(data.details).length > 80_000) throw new Error('memoryCleanupLimit');
      return { scope: { ...data.scope }, details: data.details.map(entry => ({ ...entry })) };
    });
  }

  private async recover(root: string) {
    let journal: unknown;
    try { journal = JSON.parse(await this.readFile(root, '.cleanup-journal.json')); } catch (error) {
      if (missing(error)) return;
      throw new Error('memoryRecoveryRequired');
    }
    try {
      if (!isRecord(journal) || typeof journal.job !== 'string' || !/^[a-f0-9-]{36}$/.test(journal.job)
        || typeof journal.scope !== 'string') throw new Error('memoryRecoveryRequired');
      const directory = await this.directory(this.scopeParts(journal.scope), false);
      const backup = await this.directory([journal.job], false, 'memory-backups');
      if (!directory || !backup) throw new Error('memoryRecoveryRequired');
      const manifest: unknown = JSON.parse(await this.readFile(backup, 'manifest.json'));
      if (!Array.isArray(manifest) || manifest.length > 50) throw new Error('memoryRecoveryRequired');
      const originals: { name: string; text: string }[] = [];
      const names = new Set<string>();
      for (const row of manifest) {
        if (!isRecord(row) || typeof row.name !== 'string' || typeof row.before !== 'string' || !/^[a-f0-9]{64}$/.test(row.before)
          || typeof row.after !== 'string' || !/^(?:[a-f0-9]{64})?$/.test(row.after) || names.has(row.name)) throw new Error('memoryRecoveryRequired');
        validateMemoryName(row.name);
        names.add(row.name);
        const text = await this.readFile(backup, `${row.name}.md`);
        if (digest(text) !== row.before) throw new Error('memoryRecoveryRequired');
        const current = await this.readFile(directory, `${row.name}.md`).catch(error => { if (missing(error)) return null; throw error; });
        const revision = current === null ? '' : digest(current);
        if (revision !== row.before && revision !== row.after) throw new Error('memoryRecoveryRequired');
        originals.push({ name: row.name, text });
      }
      for (const row of originals) await this.atomic(directory, `${row.name}.md`, row.text, undefined, true);
      await unlink(join(root, '.cleanup-journal.json'));
      this.snapshots.delete(journal.scope);
    } catch { throw new Error('memoryRecoveryRequired'); }
  }

  async applyCleanup(preview: MemoryCleanupPreview, guard: () => void = () => {}) {
    return this.locked(async () => {
      guard();
      const data = await this.load(preview.scope);
      if (!data.scope.complete || data.scope.revision !== preview.revision) throw new Error('memoryConflict');
      if (!preview.changes.length) throw new Error('memoryInvalid');
      const directory = await this.directory(this.scopeParts(preview.scope), false);
      const root = await this.directory([], false);
      if (!directory || !root) throw new Error('memoryNotFound');
      const targets: { name: string; before: string; after: string; text: string; original: string }[] = [];
      for (const change of preview.changes) {
        for (const entry of [change.before, ...change.removed]) {
          if (targets.some(row => row.name === entry.name)) throw new Error('memoryInvalid');
          validateMemoryName(entry.name);
          const current = data.details.find(row => row.id === entry.id);
          if (!current || current.invalid || current.revision !== entry.revision) throw new Error('memoryConflict');
          const original = await this.readFile(directory, `${entry.name}.md`);
          if (digest(original) !== entry.revision) throw new Error('memoryConflict');
          const text = entry.id === change.before.id ? serialize({ ...current, description: change.description,
            content: change.content, updated: new Date().toISOString() }) : '';
          if (text) parseMemoryFile(text, entry.name);
          targets.push({ name: entry.name, before: digest(original), after: text ? digest(text) : '', text, original });
          if (targets.length > 50) throw new Error('memoryCleanupLimit');
        }
      }
      const job = randomUUID();
      const backup = await this.directory([job], true, 'memory-backups');
      if (!backup) throw new Error('memoryWriteFailed');
      for (const row of targets) await this.atomic(backup, `${row.name}.md`, row.original, guard);
      await this.atomic(backup, 'manifest.json', JSON.stringify(targets.map(({ name, before, after }) => ({ name, before, after }))), guard);
      if ((await this.load(preview.scope)).scope.revision !== preview.revision) throw new Error('memoryConflict');
      await this.atomic(root, '.cleanup-journal.json', JSON.stringify({ job, scope: preview.scope }), guard);
      try {
        for (const row of targets) {
          this.check();
          guard();
          if (digest(await this.readFile(directory, `${row.name}.md`)) !== row.before) throw new Error('memoryConflict');
          if (row.text) await this.atomic(directory, `${row.name}.md`, row.text, guard);
          else {
            this.check();
            guard();
            await unlink(join(directory, `${row.name}.md`));
          }
        }
        guard();
        this.check();
        await unlink(join(root, '.cleanup-journal.json'));
      } catch (error) {
        await this.recover(root);
        throw error;
      }
      const remaining = data.details.filter(entry => !targets.some(row => row.name === entry.name));
      const updated = this.cache(preview.scope, data.scope.cwd, [...remaining,
        ...targets.filter(row => row.text).map(row => parseMemoryFile(row.text, row.name))], true);
      return { indexUpdated: await this.rebuild(updated), backup };
    });
  }
}
