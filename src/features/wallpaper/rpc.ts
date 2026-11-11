import { isRecord, type Codec, type RpcDescriptor } from '../../shared/types/protocol.ts';
import type { WallpaperAsset, WallpaperCleared } from '../../shared/types/wire.ts';
import { stringCodec } from '../../shared/rpc/codecs.ts';
export type { WallpaperAsset } from '../../shared/types/wire.ts';

const wallpaperCodec: Codec<WallpaperAsset> = {
  mode: 'strict', typeSymbol: 'power-dsh#WallpaperAsset',
  create: () => ({ parse(value) {
    if (!isRecord(value) || typeof value.name !== 'string' || typeof value.mime !== 'string'
      || typeof value.bytes !== 'number' || typeof value.dataUrl !== 'string'
      || !value.dataUrl.startsWith('data:image/')) throw new TypeError('Invalid wallpaper asset');
    if (value.path !== undefined && typeof value.path !== 'string') throw new TypeError('Invalid wallpaper path');
    return { ...(value.path ? { path: value.path } : {}), name: value.name, mime: value.mime, bytes: value.bytes, dataUrl: value.dataUrl };
  } }),
};
const nullableWallpaperCodec: Codec<WallpaperAsset | null> = {
  mode: 'strict', typeSymbol: 'power-dsh#WallpaperAsset?',
  create: () => ({ parse(value) {
    return value === null ? null : wallpaperCodec.create().parse(value);
  } }),
};
const clearedCodec: Codec<WallpaperCleared> = {
  mode: 'strict', typeSymbol: 'power-dsh#WallpaperCleared',
  create: () => ({ parse(value) {
    if (!isRecord(value) || value.cleared !== true) throw new TypeError('Invalid wallpaper clear result');
    return { cleared: true };
  } }),
};

function descriptor<M extends string, R>(method: M, fields: string[], result: Codec<R>): RpcDescriptor<M, R> {
  return {
    id: `power-dsh#powerDsh/${method}`,
    service: 'powerDsh', namespace: 'powerDsh', method,
    invocation: { kind: 'direct' },
    parameters: fields.map(name => ({ name, wire: name, source: 'json', codec: stringCodec })),
    result,
  };
}

export const READ_WALLPAPER_RPC = descriptor('readWallpaper', [], nullableWallpaperCodec);
export const SAVE_WALLPAPER_RPC = descriptor('saveWallpaper', ['dataUrl', 'name'], wallpaperCodec);
export const CLEAR_WALLPAPER_RPC = descriptor('clearWallpaper', [], clearedCodec);

export const rpc = [READ_WALLPAPER_RPC, SAVE_WALLPAPER_RPC, CLEAR_WALLPAPER_RPC];
