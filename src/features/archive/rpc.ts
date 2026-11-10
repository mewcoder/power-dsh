import { isRecord, isArray, hasStrings, type Codec, type RpcDescriptor } from '../../shared/types/protocol.ts';
import type { ArchiveCatalog } from '../../shared/types/wire.ts';
export type { ArchiveCatalog, ArchiveSessionRow, ArchiveWorkspaceRow } from '../../shared/types/wire.ts';
import { stringCodec } from '../../shared/rpc/codecs.ts';

const archiveCatalogCodec: Codec<ArchiveCatalog> = {
  mode: 'strict', typeSymbol: 'power-dsh#ArchiveCatalog',
  create: () => ({ parse(value) {
    if (!isRecord(value) || typeof value.complete !== 'boolean'
      || !isArray(value.workspaces) || !isArray(value.sessions)) throw new TypeError('Invalid archive catalog');
    const workspaces = value.workspaces.map(row => {
      if (!isRecord(row) || !hasStrings(row, ['workspaceId', 'title'])) throw new TypeError('Invalid archive workspace');
      return { workspaceId: row.workspaceId, title: row.title };
    });
    const sessions = value.sessions.map(row => {
      if (!isRecord(row) || !hasStrings(row, ['sessionId', 'title', 'workspaceId', 'workspaceTitle'])
        || typeof row.updatedAt !== 'number' || !Number.isFinite(row.updatedAt)
        || typeof row.createdAt !== 'number' || !Number.isFinite(row.createdAt)) throw new TypeError('Invalid archive session');
      return { sessionId: row.sessionId, title: row.title, workspaceId: row.workspaceId,
        workspaceTitle: row.workspaceTitle, updatedAt: row.updatedAt, createdAt: row.createdAt };
    });
    return { complete: value.complete, workspaces, sessions };
  } }),
};

function archiveRpc<M extends string>(method: M, fields: string[]): RpcDescriptor<M, ArchiveCatalog> {
  return {
    id: `power-dsh#powerDsh/${method}`,
    service: 'powerDsh', namespace: 'powerDsh', method,
    invocation: { kind: 'direct' },
    parameters: fields.map(name => ({ name, wire: name, source: 'json', codec: stringCodec })),
    result: archiveCatalogCodec,
  };
}
export const LIST_ARCHIVED_SESSIONS_RPC = archiveRpc('listArchivedSessions', []);
export const RESTORE_ARCHIVED_SESSION_RPC = archiveRpc('restoreArchivedSession', ['sessionId']);
export const DELETE_ARCHIVED_SESSION_RPC = archiveRpc('deleteArchivedSession', ['sessionId']);

export const rpc = [LIST_ARCHIVED_SESSIONS_RPC, RESTORE_ARCHIVED_SESSION_RPC, DELETE_ARCHIVED_SESSION_RPC];
