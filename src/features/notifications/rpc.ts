import { isRecord, isArray, isOneOf, type Codec, type RpcDescriptor } from '../../shared/types/protocol.ts';
import type { SoundEntry, SystemSoundsCatalog, SystemSounds, SoundPlayback } from '../../shared/types/wire.ts';
export type { SoundEntry, SystemSoundsCatalog, SystemSounds, SoundPlayback } from '../../shared/types/wire.ts';
import { stringCodec, booleanCodec } from '../../shared/rpc/codecs.ts';

const soundCatalogCodec: Codec<SystemSoundsCatalog> = {
  mode: 'strict', typeSymbol: 'power-dsh#SystemSounds',
  create: () => ({ parse(value) {
    if (!isRecord(value) || !isOneOf(value.platform, ['darwin', 'win32', 'other']) || !isArray(value.sounds)
      || !value.sounds.every((row): row is SoundEntry => isRecord(row) && typeof row.id === 'string' && typeof row.name === 'string')) throw new TypeError('Invalid system sounds');
    return { platform: value.platform, sounds: value.sounds.map(row => ({ id: row.id, name: row.name })) };
  } }),
};
export const LIST_SYSTEM_SOUNDS_RPC: RpcDescriptor<'listSystemSounds', SystemSoundsCatalog> = {
  id: 'power-dsh#powerDsh/listSystemSounds', service: 'powerDsh', namespace: 'powerDsh', method: 'listSystemSounds',
  invocation: { kind: 'direct' }, parameters: [], result: soundCatalogCodec,
};
export const PLAY_SYSTEM_SOUND_RPC: RpcDescriptor<'playSystemSound', SoundPlayback> = {
  id: 'power-dsh#powerDsh/playSystemSound', service: 'powerDsh', namespace: 'powerDsh', method: 'playSystemSound',
  invocation: { kind: 'direct' },
  parameters: [
    { name: 'id', wire: 'id', source: 'json', codec: stringCodec },
    { name: 'preview', wire: 'preview', source: 'json', codec: booleanCodec },
  ],
  result: { mode: 'strict', typeSymbol: 'power-dsh#SoundPlayback', create: () => ({ parse(value) {
    if (!isRecord(value) || typeof value.played !== 'boolean') throw new TypeError('Invalid sound playback');
    return { played: value.played };
  } }) },
};

export const rpc = [LIST_SYSTEM_SOUNDS_RPC, PLAY_SYSTEM_SOUND_RPC];
