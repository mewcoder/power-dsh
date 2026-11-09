import { isRecord, isArray, hasStrings, hasBooleans, isOneOf, type Codec, type RpcDescriptor } from '../../shared/types/protocol.ts';
import type { SkillScope, SkillWorkspace, SkillRow, SkillEntry, SkillCatalog } from '../../shared/types/wire.ts';
export type { SkillScope, SkillWorkspace, SkillRow, SkillEntry, SkillCatalog } from '../../shared/types/wire.ts';
import { stringCodec, booleanCodec } from '../../shared/rpc/codecs.ts';

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
function skillRpc<M extends string>(method: M, fields: string[]): RpcDescriptor<M, SkillCatalog> {
  return {
    id: `power-dsh#powerDsh/${method}`,
    service: 'powerDsh', namespace: 'powerDsh', method,
    invocation: { kind: 'direct' },
    parameters: fields.map(name => ({ name, wire: name, source: 'json', codec: name === 'enabled' ? booleanCodec : stringCodec })),
    result: skillCatalogCodec,
  };
}
export const LIST_SKILLS_RPC = skillRpc('listSkills', ['cwd', 'scope']);
export const SET_SKILL_ENABLED_RPC = skillRpc('setSkillEnabled', ['cwd', 'scope', 'name', 'enabled']);

export const rpc = [LIST_SKILLS_RPC, SET_SKILL_ENABLED_RPC];
