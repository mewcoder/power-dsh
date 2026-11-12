import { isRecord, isArray, isOneOf, type Codec, type RpcDescriptor } from '../../shared/types/protocol.ts';
import type { SoundEntry, SystemSoundsCatalog, SystemSounds, SoundPlayback } from '../../shared/types/wire.ts';
export type { SoundEntry, SystemSoundsCatalog, SystemSounds, SoundPlayback } from '../../shared/types/wire.ts';
import { stringCodec, booleanCodec } from '../../shared/rpc/codecs.ts';
import type { WindowsNotification, NotificationDelivery, NotificationCleared } from '../../shared/types/wire.ts';
import type { NotificationTransport } from '../../shared/types/wire.ts';

export function parseWindowsNotification(value: unknown): WindowsNotification {
  if (!isRecord(value) || typeof value.group !== 'string' || !/^[a-z0-9]{1,16}$/.test(value.group)
    || typeof value.tag !== 'string' || !/^[a-z0-9]{1,16}$/.test(value.tag)
    || typeof value.title !== 'string' || !value.title || value.title.length > 80
    || typeof value.body !== 'string' || value.body.length > 160
    || typeof value.dismiss !== 'string' || !value.dismiss || value.dismiss.length > 40
    || typeof value.attention !== 'boolean' || typeof value.preview !== 'boolean'
    || [value.title, value.body, value.dismiss].some(text => /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))) {
    throw new TypeError('Invalid Windows notification');
  }
  return { group: value.group, tag: value.tag, title: value.title, body: value.body,
    attention: value.attention, preview: value.preview, dismiss: value.dismiss };
}

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

export const SHOW_WINDOWS_NOTIFICATION_RPC: RpcDescriptor<'showWindowsNotification', NotificationDelivery> = {
  id: 'power-dsh#powerDsh/showWindowsNotification', service: 'powerDsh', namespace: 'powerDsh', method: 'showWindowsNotification',
  invocation: { kind: 'direct' },
  parameters: [{ name: 'notification', wire: 'notification', source: 'json', codec: {
    mode: 'strict', typeSymbol: 'power-dsh#WindowsNotification', create: () => ({ parse: parseWindowsNotification }),
  } }],
  result: { mode: 'strict', typeSymbol: 'power-dsh#NotificationDelivery', create: () => ({ parse(value) {
    if (!isRecord(value) || typeof value.shown !== 'boolean') throw new TypeError('Invalid notification delivery');
    return { shown: value.shown };
  } }) },
};
export const CLEAR_WINDOWS_NOTIFICATIONS_RPC: RpcDescriptor<'clearWindowsNotifications', NotificationCleared> = {
  id: 'power-dsh#powerDsh/clearWindowsNotifications', service: 'powerDsh', namespace: 'powerDsh', method: 'clearWindowsNotifications',
  invocation: { kind: 'direct' },
  parameters: [
    { name: 'group', wire: 'group', source: 'json', codec: stringCodec },
    { name: 'tag', wire: 'tag', source: 'json', codec: stringCodec },
  ],
  result: { mode: 'strict', typeSymbol: 'power-dsh#NotificationCleared', create: () => ({ parse(value) {
    if (!isRecord(value) || typeof value.cleared !== 'boolean') throw new TypeError('Invalid notification cleanup');
    return { cleared: value.cleared };
  } }) },
};

export const NOTIFICATION_TRANSPORT_RPC: RpcDescriptor<'notificationTransport', NotificationTransport> = {
  id: 'power-dsh#powerDsh/notificationTransport', service: 'powerDsh', namespace: 'powerDsh', method: 'notificationTransport',
  invocation: { kind: 'direct' }, parameters: [],
  result: { mode: 'strict', typeSymbol: 'power-dsh#NotificationTransport', create: () => ({ parse(value) {
    if (!isRecord(value) || !isOneOf(value.platform, ['win32', 'darwin', 'other'])
      || typeof value.nativeAvailable !== 'boolean' || typeof value.version !== 'string'
      || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(value.version)) throw new TypeError('Invalid notification transport');
    return { platform: value.platform, nativeAvailable: value.nativeAvailable, version: value.version };
  } }) },
};

export const rpc = [LIST_SYSTEM_SOUNDS_RPC, PLAY_SYSTEM_SOUND_RPC, SHOW_WINDOWS_NOTIFICATION_RPC, CLEAR_WINDOWS_NOTIFICATIONS_RPC, NOTIFICATION_TRANSPORT_RPC];
