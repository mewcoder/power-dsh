import { isRecord, type Codec, type PolicyResult, type RpcDescriptor } from '../types/protocol.ts';

export const booleanCodec: Codec<boolean> = {
  mode: 'strict', typeSymbol: 'boolean',
  create: () => ({ parse(value) {
    if (typeof value !== 'boolean') throw new TypeError('Expected a boolean');
    return value;
  } }),
};
export const stringCodec: Codec<string> = {
  mode: 'strict', typeSymbol: 'string',
  create: () => ({ parse(value) {
    if (typeof value !== 'string') throw new TypeError('Expected a string');
    return value;
  } }),
};
export function policyRpc<M extends string>(method: M, resultType: string): RpcDescriptor<M, PolicyResult> {
  return {
    id: `power-dsh#powerDsh/${method}`,
    service: 'powerDsh', namespace: 'powerDsh', method,
    invocation: { kind: 'direct' },
    parameters: [{ name: 'blocked', wire: 'blocked', source: 'json', codec: booleanCodec }],
    result: {
      mode: 'strict', typeSymbol: `power-dsh#${resultType}`,
      create: () => ({ parse(value) {
        if (!isRecord(value) || typeof value.blocked !== 'boolean') throw new TypeError('Invalid policy result');
        return { blocked: value.blocked };
      } }),
    },
  };
}
