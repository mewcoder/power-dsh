import { isRecord, hasStrings, hasBooleans, isOneOf, type Codec, type RpcDescriptor } from '../../shared/types/protocol.ts';
import type { PersonalizationFile } from '../../shared/types/wire.ts';
export type { PersonalizationFile } from '../../shared/types/wire.ts';
import { stringCodec } from '../../shared/rpc/codecs.ts';

const fileCodec: Codec<PersonalizationFile> = {
  mode: 'strict', typeSymbol: 'power-dsh#PersonalizationFile',
  create: () => ({ parse(value) {
    if (!isRecord(value) || typeof value.path !== 'string' || typeof value.text !== 'string'
      || typeof value.revision !== 'string' || !/^[a-f\d]{64}$/.test(value.revision)) throw new TypeError('Invalid instruction file');
    return { path: value.path, text: value.text, revision: value.revision };
  } }),
};
function fileRpc<M extends string>(method: M, fields: string[]): RpcDescriptor<M, PersonalizationFile> {
  return {
    id: `power-dsh#powerDsh/${method}`,
    service: 'powerDsh', namespace: 'powerDsh', method,
    invocation: { kind: 'direct' },
    parameters: fields.map(name => ({ name, wire: name, source: 'json', codec: stringCodec })),
    result: fileCodec,
  };
}
export const READ_PERSONALIZATION_RPC = fileRpc('readPersonalization', []);
export const SAVE_PERSONALIZATION_RPC = fileRpc('savePersonalization', ['text', 'revision']);

export const rpc = [READ_PERSONALIZATION_RPC, SAVE_PERSONALIZATION_RPC];
