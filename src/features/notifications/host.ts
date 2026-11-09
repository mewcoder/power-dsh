import type { NativeContext } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { HostOptions, HostService } from '../../shared/host/feature.ts';
import { notificationProjection } from './notifications.ts';
import { SystemSounds } from './system-sounds.ts';

export function createHost(ctx: NativeContext, config: LivePreferences) {
  ctx.inject(['sessionProjections'], async child => {
    await child.sessionProjections.register(notificationProjection());
  });
  return { sounds: new SystemSounds(ctx, config) };
}

export const methods = {
  listSystemSounds() {
    return this.run(() => this.sounds.list());
  },
  playSystemSound(id: string, preview: boolean) {
    // Playback has its own overlap control and must not block policy changes.
    this.queue.ensureActive();
    if (this.ctx.invocation && this.ctx.invocation.peer.principal.kind !== 'owner') {
      throw new Error('Only the profile owner can play system sounds.');
    }
    return this.sounds.play(id, preview);
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
