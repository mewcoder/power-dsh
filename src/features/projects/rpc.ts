import { isRecord, isArray, hasStrings, type Codec, type RpcDescriptor } from '../../shared/types/protocol.ts';
import type { ProjectCatalog } from '../../shared/types/wire.ts';
export type { ProjectCatalog, ProjectRow } from '../../shared/types/wire.ts';
import { stringCodec } from '../../shared/rpc/codecs.ts';

const projectCatalogCodec: Codec<ProjectCatalog> = {
  mode: 'strict', typeSymbol: 'power-dsh#ProjectCatalog',
  create: () => ({ parse(value) {
    if (!isRecord(value) || typeof value.complete !== 'boolean' || !isArray(value.projects)) {
      throw new TypeError('Invalid project catalog');
    }
    const projects = value.projects.map(row => {
      if (!isRecord(row) || !hasStrings(row, ['workspaceId', 'title', 'path'])
        || typeof row.sessionCount !== 'number' || !Number.isFinite(row.sessionCount)
        || typeof row.lastActiveAt !== 'number' || !Number.isFinite(row.lastActiveAt)) {
        throw new TypeError('Invalid project row');
      }
      return { workspaceId: row.workspaceId, title: row.title, path: row.path,
        sessionCount: row.sessionCount, lastActiveAt: row.lastActiveAt };
    });
    return { complete: value.complete, projects };
  } }),
};

function projectRpc<M extends string>(method: M, fields: string[]): RpcDescriptor<M, ProjectCatalog> {
  return {
    id: `power-dsh#powerDsh/${method}`,
    service: 'powerDsh', namespace: 'powerDsh', method,
    invocation: { kind: 'direct' },
    parameters: fields.map(name => ({ name, wire: name, source: 'json', codec: stringCodec })),
    result: projectCatalogCodec,
  };
}
export const LIST_PROJECTS_RPC = projectRpc('listProjects', []);
export const REMOVE_PROJECT_RPC = projectRpc('removeProject', ['workspaceId']);

export const rpc = [LIST_PROJECTS_RPC, REMOVE_PROJECT_RPC];
