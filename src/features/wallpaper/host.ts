import type { NativeContext } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { HostOptions, HostService } from '../../shared/host/feature.ts';
import { WallpaperStore } from './wallpaper.ts';

export function createHost(_ctx: NativeContext, _config: LivePreferences, { owner, ensureActive }: HostOptions) {
  return { wallpaper: new WallpaperStore(owner.profileContext.home, ensureActive) };
}

export const methods = {
  readWallpaper() {
    return this.run(() => this.wallpaper.read());
  },
  saveWallpaper(dataUrl: string, name: string) {
    return this.run(() => this.wallpaper.save(dataUrl, name));
  },
  clearWallpaper() {
    return this.run(() => this.wallpaper.clear());
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
