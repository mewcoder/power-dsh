import { isRecord, isArray, hasStrings, hasBooleans, isOneOf, type Codec, type RpcDescriptor } from '../../shared/types/protocol.ts';
import type { SkillScope, SkillWorkspace, SkillRow, SkillEntry, SkillCatalog, SkillDetail, ExternalSkillEntry, ExternalSkillCatalog, ExternalSkillDetail, SkillImportResult, SkillOccurrence, SkillVariant, SkillImportMode, SkillImportDestination, SkillDeletion } from '../../shared/types/wire.ts';
export type { SkillScope, SkillWorkspace, SkillRow, SkillEntry, SkillCatalog, SkillDetail, ExternalSkillEntry, ExternalSkillCatalog, ExternalSkillDetail, SkillImportResult, SkillOccurrence, SkillVariant, SkillImportMode, SkillImportDestination, SkillDeletion } from '../../shared/types/wire.ts';
import { stringCodec, booleanCodec } from '../../shared/rpc/codecs.ts';

function parseSources(value: unknown): SkillOccurrence[] {
  if (!isArray(value) || value.length > 400) throw new TypeError('Invalid skill sources');
  return value.map(source => {
    if (!isRecord(source) || !hasStrings(source, ['agent', 'path', 'realPath']) || typeof source.linked !== 'boolean') throw new TypeError('Invalid skill source');
    return { agent: source.agent, path: source.path, realPath: source.realPath, linked: source.linked };
  });
}
function parseVariant(value: unknown): SkillVariant {
  if (!isRecord(value) || !hasStrings(value, ['id', 'description', 'path', 'revision']) || typeof value.flat !== 'boolean') throw new TypeError('Invalid skill variant');
  return { id: value.id, description: value.description, path: value.path, revision: value.revision, flat: value.flat, sources: parseSources(value.sources) };
}
function parseDeletion(value: unknown): SkillDeletion {
  if (!isRecord(value) || !hasStrings(value, ['path', 'revision']) || typeof value.linked !== 'boolean'
    || !value.path || !/^[a-f0-9]{64}$/.test(value.revision)) throw new TypeError('Invalid skill deletion');
  return { path: value.path, revision: value.revision, linked: value.linked };
}
const skillCatalogCodec: Codec<SkillCatalog> = {
  mode: 'strict', typeSymbol: 'power-dsh#SkillCatalog',
  create: () => ({ parse(value) {
    if (!isRecord(value) || typeof value.cwd !== 'string' || !isOneOf(value.scope, ['user', 'project'])
      || typeof value.complete !== 'boolean'
      || !isArray(value.workspaces) || !value.workspaces.every((item): item is SkillWorkspace => isRecord(item) && typeof item.path === 'string' && typeof item.title === 'string')
      || !isArray(value.skills)) throw new TypeError('Invalid skill catalog');
    const skills = value.skills.map(row => {
      if (!isRecord(row) || !hasStrings(row, ['name', 'description', 'source', 'path', 'origin', 'reason'])
        || !hasBooleans(row, ['enabled', 'modelInvocable', 'userInvocable', 'canToggle'])
        || row.enabled !== (row.modelInvocable || row.userInvocable)) throw new TypeError('Invalid skill entry');
      return { name: row.name, description: row.description, source: row.source, path: row.path, origin: row.origin,
        enabled: row.enabled, modelInvocable: row.modelInvocable, userInvocable: row.userInvocable,
        canToggle: row.canToggle, reason: row.reason };
    });
    return { cwd: value.cwd, scope: value.scope, workspaces: value.workspaces.map(item => ({ path: item.path, title: item.title })), complete: value.complete, skills };
  } }),
};
const skillDetailCodec: Codec<SkillDetail | null> = {
  mode: 'strict', typeSymbol: 'power-dsh#SkillDetail',
  create: () => ({ parse(value) {
    if (value === null) return null;
    if (!isRecord(value) || !hasStrings(value, ['name', 'description', 'content', 'source', 'path', 'origin'])
      || !hasBooleans(value, ['enabled', 'modelInvocable', 'userInvocable'])) throw new TypeError('Invalid skill detail');
    return { name: value.name, description: value.description, content: value.content, source: value.source,
      path: value.path, origin: value.origin, enabled: value.enabled,
      modelInvocable: value.modelInvocable, userInvocable: value.userInvocable,
      ...(value.deletion === undefined ? {} : { deletion: parseDeletion(value.deletion) }) };
  } }),
};

function skillRpc<M extends string>(method: M, fields: string[], result: Codec<unknown> = skillCatalogCodec): RpcDescriptor<M> {
  return {
    id: `power-dsh#powerDsh/${method}`,
    service: 'powerDsh', namespace: 'powerDsh', method,
    invocation: { kind: 'direct' },
    parameters: fields.map(name => ({ name, wire: name, source: 'json', codec: name === 'enabled' || name === 'flat' ? booleanCodec : stringCodec })),
    result,
  };
}
export const LIST_SKILLS_RPC = skillRpc('listSkills', ['cwd', 'scope']);
export const READ_SKILL_RPC = skillRpc('readSkill', ['cwd', 'scope', 'name'], skillDetailCodec);
export const SET_SKILL_ENABLED_RPC = skillRpc('setSkillEnabled', ['cwd', 'scope', 'name', 'enabled']);


const externalSkillCatalogCodec: Codec<ExternalSkillCatalog> = {
  mode: 'strict', typeSymbol: 'power-dsh#ExternalSkillCatalog',
  create: () => ({ parse(value) {
    if (!isRecord(value) || typeof value.complete !== 'boolean' || !isArray(value.entries)) throw new TypeError('Invalid external skill catalog');
    const entries = value.entries.map(row => {
      if (!isRecord(row) || !hasStrings(row, ['id', 'name', 'description', 'source', 'path'])
        || typeof row.flat !== 'boolean') throw new TypeError('Invalid external skill entry');
      if (row.variants !== undefined && (!isArray(row.variants) || row.variants.length > 400)) throw new TypeError('Invalid skill variants');
      if (row.comparison !== undefined && !isOneOf(row.comparison, ['same', 'different', 'unknown'])) throw new TypeError('Invalid skill comparison');
      if (row.conflict !== undefined && typeof row.conflict !== 'boolean') throw new TypeError('Invalid skill conflict');
      if (row.available !== undefined && typeof row.available !== 'boolean') throw new TypeError('Invalid skill availability');
      if (row.inherited !== undefined && typeof row.inherited !== 'boolean') throw new TypeError('Invalid skill inheritance');
      return { id: row.id, name: row.name, description: row.description, source: row.source, path: row.path, flat: row.flat,
        ...(isArray(row.variants) ? { variants: row.variants.map(parseVariant) } : {}),
        ...(row.sources === undefined ? {} : { sources: parseSources(row.sources) }),
        ...(isOneOf(row.comparison, ['same', 'different', 'unknown']) ? { comparison: row.comparison } : {}),
        ...(typeof row.conflict === 'boolean' ? { conflict: row.conflict } : {}),
        ...(typeof row.available === 'boolean' ? { available: row.available } : {}),
        ...(typeof row.inherited === 'boolean' ? { inherited: row.inherited } : {}) };
    });
    return { complete: value.complete, entries };
  } }),
};

const skillImportResultCodec: Codec<SkillImportResult> = {
  mode: 'strict', typeSymbol: 'power-dsh#SkillImportResult',
  create: () => ({ parse(value) {
    if (!isRecord(value) || !isArray(value.imported) || !value.imported.every(item => typeof item === 'string')
      || !isArray(value.skipped)) throw new TypeError('Invalid skill import result');
    const skipped = value.skipped.map(item => {
      if (!isRecord(item) || !hasStrings(item, ['name', 'reason'])) throw new TypeError('Invalid skill import skipped row');
      return { name: item.name, reason: item.reason };
    });
    return { imported: value.imported as string[], skipped };
  } }),
};

const stringArrayCodec: Codec<string[]> = {
  mode: 'strict', typeSymbol: 'string[]',
  create: () => ({ parse(value) {
    if (!isArray(value) || !value.every(item => typeof item === 'string')) throw new TypeError('Expected a string array');
    return value as string[];
  } }),
};

const externalSkillDetailCodec: Codec<ExternalSkillDetail | null> = {
  mode: 'strict', typeSymbol: 'power-dsh#ExternalSkillDetail',
  create: () => ({ parse(value) {
    if (value === null) return null;
    if (!isRecord(value) || !hasStrings(value, ['name', 'description', 'content', 'source', 'path'])) throw new TypeError('Invalid external skill detail');
    return { name: value.name, description: value.description, content: value.content, source: value.source, path: value.path };
  } }),
};

export const READ_EXTERNAL_SKILL_RPC: RpcDescriptor<'readExternalSkill', ExternalSkillDetail | null> = {
  id: 'power-dsh#powerDsh/readExternalSkill', service: 'powerDsh', namespace: 'powerDsh', method: 'readExternalSkill',
  invocation: { kind: 'direct' }, parameters: [
    { name: 'cwd', wire: 'cwd', source: 'json', codec: stringCodec },
    { name: 'scope', wire: 'scope', source: 'json', codec: stringCodec },
    { name: 'id', wire: 'id', source: 'json', codec: stringCodec },
  ], result: externalSkillDetailCodec,
};

export const DISCOVER_EXTERNAL_SKILLS_RPC: RpcDescriptor<'discoverExternalSkills', ExternalSkillCatalog> = {
  id: 'power-dsh#powerDsh/discoverExternalSkills', service: 'powerDsh', namespace: 'powerDsh', method: 'discoverExternalSkills',
  invocation: { kind: 'direct' }, parameters: [
    { name: 'cwd', wire: 'cwd', source: 'json', codec: stringCodec },
    { name: 'scope', wire: 'scope', source: 'json', codec: stringCodec },
  ], result: externalSkillCatalogCodec,
};

export const IMPORT_EXTERNAL_SKILLS_RPC: RpcDescriptor<'importExternalSkills', SkillImportResult> = {
  id: 'power-dsh#powerDsh/importExternalSkills', service: 'powerDsh', namespace: 'powerDsh', method: 'importExternalSkills',
  invocation: { kind: 'direct' }, parameters: [
    { name: 'cwd', wire: 'cwd', source: 'json', codec: stringCodec },
    { name: 'scope', wire: 'scope', source: 'json', codec: stringCodec },
    { name: 'ids', wire: 'ids', source: 'json', codec: stringArrayCodec },
  ], result: skillImportResultCodec,
};

export const ADD_SKILL_RPC = skillRpc('addSkill', ['cwd', 'scope', 'id', 'mode', 'revision'], skillImportResultCodec);

const skillImportDestinationCodec: Codec<SkillImportDestination> = {
  mode: 'strict', typeSymbol: 'power-dsh#SkillImportDestination',
  create: () => ({ parse(value) {
    if (!isRecord(value) || !hasStrings(value, ['path']) || !hasBooleans(value, ['complete', 'available', 'inherited'])) throw new TypeError('Invalid skill import destination');
    return { path: value.path, complete: value.complete, available: value.available, inherited: value.inherited };
  } }),
};
export const READ_SKILL_IMPORT_DESTINATION_RPC = skillRpc('readSkillImportDestination', ['cwd', 'scope', 'name', 'flat'], skillImportDestinationCodec);
export const IMPORT_SKILL_TO_RPC = skillRpc('importSkillTo', ['cwd', 'scope', 'id', 'revision', 'targetCwd'], skillImportResultCodec);
export const DELETE_SKILL_RPC = skillRpc('deleteSkill', ['cwd', 'scope', 'name', 'revision']);

export const rpc = [LIST_SKILLS_RPC, READ_SKILL_RPC, SET_SKILL_ENABLED_RPC, DISCOVER_EXTERNAL_SKILLS_RPC, READ_EXTERNAL_SKILL_RPC, IMPORT_EXTERNAL_SKILLS_RPC, ADD_SKILL_RPC, READ_SKILL_IMPORT_DESTINATION_RPC, IMPORT_SKILL_TO_RPC, DELETE_SKILL_RPC];
