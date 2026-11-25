import { isRecord, isArray, isOneOf, hasStrings, type Codec, type RpcDescriptor } from '../../shared/types/protocol.ts';
import { booleanCodec, stringCodec } from '../../shared/rpc/codecs.ts';
import { MEMORY_TYPES, type MemoryCatalog, type MemoryFileDetail, type MemoryEntry, type MemoryWriteResult,
  type MemoryModels, type MemoryCleanupPreview, type MemoryCleanupResult, type MemoryDetail, type MemorySourceResult } from './types.ts';
import { parseModel, parseCleanupPlan } from './cleanup-plan.ts';
import { parseMemorySource } from './provenance.ts';

export function parseMemoryEntry(value: unknown): MemoryEntry {
  if (!isRecord(value) || !hasStrings(value, ['id', 'name', 'description', 'created', 'updated', 'originSessionId', 'revision'])
    || !isOneOf(value.type, MEMORY_TYPES)
    || typeof value.invalid !== 'boolean' || value.description.length > 160
    || !/^[a-f0-9]{64}$/.test(value.revision)
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.name) || value.name.length > 64
    || value.id !== `${value.type}/${value.name}`) throw new TypeError('memoryInvalid');
  return { id: value.id, name: value.name, description: value.description, type: value.type,
    created: value.created, updated: value.updated,
    originSessionId: value.originSessionId, revision: value.revision, invalid: value.invalid };
}

export const memoryCatalogCodec: Codec<MemoryCatalog> = {
  mode: 'strict', typeSymbol: 'power-dsh#MemoryCatalog',
  create: () => ({ parse(value) {
    if (!isRecord(value) || !hasStrings(value, ['path', 'error']) || typeof value.available !== 'boolean'
      || !isArray(value.scopes) || value.scopes.length > 65) throw new TypeError('memoryInvalid');
    const scopes = value.scopes.map(scope => {
      if (!isRecord(scope) || !hasStrings(scope, ['id', 'cwd', 'revision']) || typeof scope.complete !== 'boolean'
        || !isArray(scope.entries) || scope.entries.length > 500 || !/^(?:global|[a-f0-9]{64})$/.test(scope.id)
        || !/^[a-f0-9]{64}$/.test(scope.revision)) throw new TypeError('memoryInvalid');
      return { id: scope.id, cwd: scope.cwd, revision: scope.revision, complete: scope.complete, entries: scope.entries.map(parseMemoryEntry) };
    });
    if (new Set(scopes.map(scope => scope.id)).size !== scopes.length) throw new TypeError('memoryInvalid');
    return { path: value.path, available: value.available, error: value.error, scopes };
  } }),
};

const detailCodec: Codec<MemoryFileDetail> = {
  mode: 'strict', typeSymbol: 'power-dsh#MemoryFileDetail',
  create: () => ({ parse(value) {
    const entry = parseMemoryEntry(value);
    if (!isRecord(value) || typeof value.content !== 'string' || value.content.length > 1200
      || typeof value.path !== 'string' || !value.path) throw new TypeError('memoryInvalid');
    return { ...entry, content: value.content, path: value.path,
      source: parseMemorySource(value.source) };
  } }),
};

const writeCodec: Codec<MemoryWriteResult> = {
  mode: 'strict', typeSymbol: 'power-dsh#MemoryWriteResult',
  create: () => ({ parse(value) {
    if (!isRecord(value) || typeof value.indexUpdated !== 'boolean') throw new TypeError('memoryInvalid');
    return { indexUpdated: value.indexUpdated };
  } }),
};

function descriptor<M extends string, Result>(method: M, fields: string[], result: Codec<Result>): RpcDescriptor<M, Result> {
  return {
    id: `power-dsh#powerDsh/${method}`, service: 'powerDsh', namespace: 'powerDsh', method,
    invocation: { kind: 'direct' },
    parameters: fields.map(name => ({ name, wire: name, source: 'json', codec: stringCodec })),
    result,
  };
}

export const LIST_MEMORY_ENTRIES_RPC = descriptor('listMemoryEntries', [], memoryCatalogCodec);
export const READ_MEMORY_ENTRY_RPC = descriptor('readMemoryEntry', ['scope', 'id'], detailCodec);
export const READ_MEMORY_SOURCE_RPC = descriptor('readMemorySource', ['scope', 'id', 'revision', 'offset'], {
  mode: 'strict', typeSymbol: 'power-dsh#MemorySourceResult',
  create: () => ({ parse(value: unknown): MemorySourceResult {
    if (!isRecord(value) || typeof value.available !== 'boolean'
      || value.historical !== undefined && typeof value.historical !== 'boolean'
      || !isOneOf(value.reason, ['', 'not-recorded', 'unavailable', 'not-found', 'changed', 'workspace'] as const)
      || value.available !== (value.reason === '') || !isArray(value.messages) || value.messages.length > 5) throw new TypeError('memoryInvalid');
    const source = parseMemorySource(value.source);
    if (value.available && !source || !value.available && value.messages.length !== 0) throw new TypeError('memoryInvalid');
    const messages = value.messages.map(row => {
      if (!isRecord(row) || !Number.isSafeInteger(row.seq) || Number(row.seq) < 0 || typeof row.time !== 'number' || !Number.isFinite(new Date(row.time).getTime())
        || !isOneOf(row.role, ['user', 'assistant'] as const) || typeof row.target !== 'boolean'
        || typeof row.text !== 'string' || row.text.length > (row.target ? 8_000 : 1_000)
        || !Number.isSafeInteger(row.offset) || Number(row.offset) < 0 || !Number.isSafeInteger(row.length) || Number(row.length) < 0
        || row.nextOffset !== null && (!Number.isSafeInteger(row.nextOffset) || Number(row.nextOffset) <= Number(row.offset)
          || Number(row.nextOffset) >= Number(row.length))
        || Number(row.offset) + row.text.length !== (row.nextOffset ?? row.length)) throw new TypeError('memoryInvalid');
      return { seq: Number(row.seq), time: row.time, role: row.role, target: row.target, text: row.text,
        offset: Number(row.offset), length: Number(row.length), nextOffset: row.nextOffset === null ? null : Number(row.nextOffset) };
    });
    if (value.available && messages.filter(row => row.target && row.role === 'user' && row.seq === source?.seq).length !== 1) throw new TypeError('memoryInvalid');
    return { available: value.available, reason: value.reason, source, messages, historical: value.historical === true };
  } }),
});
export const DELETE_MEMORY_ENTRY_RPC = descriptor('deleteMemoryEntry', ['scope', 'id', 'revision'], writeCodec);
export const CLEAR_MEMORY_SCOPE_RPC = descriptor('clearMemoryScope', ['scope', 'revision'], writeCodec);
export const OPEN_MEMORY_FOLDER_RPC = descriptor('openMemoryFolder', ['scope'], booleanCodec);
export const MEMORY_CLEANUP_MODELS_RPC = descriptor('memoryCleanupModels', [], {
  mode: 'strict', typeSymbol: 'power-dsh#MemoryModels', create: () => ({ parse(value: unknown): MemoryModels {
    if (!isRecord(value) || !isArray(value.models) || value.models.length > 1000) throw new TypeError('memoryInvalid');
    return { default: value.default === null ? null : parseModel(value.default), models: value.models.map(model => {
      if (!isRecord(model) || typeof model.label !== 'string' || model.label.length > 400) throw new TypeError('memoryInvalid');
      const efforts = model.efforts === undefined ? [] : model.efforts;
      if (!isArray(efforts) || efforts.length > 100) throw new TypeError('memoryInvalid');
      return { ...parseModel(model), label: model.label, efforts: efforts.map(effort => {
        if (!isRecord(effort) || typeof effort.id !== 'string' || !effort.id || effort.id.length > 100
          || typeof effort.label !== 'string' || effort.label.length > 400) throw new TypeError('memoryInvalid');
        return { id: effort.id, label: effort.label };
      }) };
    }) };
  } }),
});
export const PREPARE_MEMORY_CLEANUP_RPC = descriptor('prepareMemoryCleanup', ['scope', 'model', 'token'], {
  mode: 'strict', typeSymbol: 'power-dsh#MemoryCleanupPreview', create: () => ({ parse(value: unknown): MemoryCleanupPreview {
    if (!isRecord(value) || !hasStrings(value, ['token', 'scope', 'revision']) || !/^[a-f0-9-]{36}$/.test(value.token)
      || !/^(?:global|[a-f0-9]{64})$/.test(value.scope) || !/^[a-f0-9]{64}$/.test(value.revision)
      || !isArray(value.changes) || value.changes.length > 50) throw new TypeError('memoryInvalid');
    const entries: MemoryDetail[] = [];
    const detail = (input: unknown) => {
      const entry = parseMemoryEntry(input);
      if (!isRecord(input) || entry.invalid || typeof input.content !== 'string' || !input.content.trim() || input.content.length > 1200) throw new TypeError('memoryInvalid');
      entries.push({ ...entry, content: input.content, source: parseMemorySource(input.source) });
      return entry;
    };
    const raw = value.changes.map(change => {
      if (!isRecord(change) || !isArray(change.removed) || change.removed.length > 49) throw new TypeError('memoryInvalid');
      const before = detail(change.before);
      return { id: before.id, description: change.description, content: change.content, reason: change.reason,
        remove: change.removed.map(entry => detail(entry).id) };
    });
    return { token: value.token, scope: value.scope, revision: value.revision,
      changes: parseCleanupPlan(JSON.stringify({ changes: raw }), entries) };
  } }),
});
export const CANCEL_MEMORY_CLEANUP_RPC = descriptor('cancelMemoryCleanup', ['token'], booleanCodec);
export const APPLY_MEMORY_CLEANUP_RPC = descriptor('applyMemoryCleanup', ['token'], {
  mode: 'strict', typeSymbol: 'power-dsh#MemoryCleanupResult', create: () => ({ parse(value: unknown): MemoryCleanupResult {
    if (!isRecord(value) || typeof value.indexUpdated !== 'boolean' || typeof value.backup !== 'string' || !value.backup || value.backup.length > 4096) throw new TypeError('memoryInvalid');
    return { indexUpdated: value.indexUpdated, backup: value.backup };
  } }),
});
export const rpc = [LIST_MEMORY_ENTRIES_RPC, READ_MEMORY_ENTRY_RPC, READ_MEMORY_SOURCE_RPC, DELETE_MEMORY_ENTRY_RPC, CLEAR_MEMORY_SCOPE_RPC, OPEN_MEMORY_FOLDER_RPC,
  MEMORY_CLEANUP_MODELS_RPC, PREPARE_MEMORY_CLEANUP_RPC, CANCEL_MEMORY_CLEANUP_RPC, APPLY_MEMORY_CLEANUP_RPC];
