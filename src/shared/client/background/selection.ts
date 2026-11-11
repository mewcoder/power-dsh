import type { PreferenceValues } from '../types.ts';

export const WALLPAPER_CHOICES = ['none', 'flow', 'seaside', 'custom'] as const;
export type WallpaperChoice = typeof WALLPAPER_CHOICES[number];

/** Read earlier background configurations without rewriting the profile at startup. */
export function wallpaperEnabled(value: Partial<PreferenceValues> = {}) {
  return typeof value.wallpaperEnabled === 'boolean' ? value.wallpaperEnabled
    : value.flowingBackgroundEnabled === true;
}
export function wallpaperChoice(value: Partial<PreferenceValues> = {}): WallpaperChoice {
  if (typeof value.wallpaperSelection === 'string') {
    return (WALLPAPER_CHOICES as readonly string[]).includes(value.wallpaperSelection)
      ? value.wallpaperSelection as WallpaperChoice : 'none';
  }
  // The previous standalone wallpaper feature only supported custom images.
  if (value.wallpaperEnabled === true) return 'custom';
  if (value.flowingBackgroundEnabled === true) return value.flowingBackgroundKind === 'wallpaper' ? 'custom' : 'flow';
  return 'none';
}
export function wallpaperAppearance(value: Partial<PreferenceValues> = {}) {
  const legacy = value.wallpaperSelection === undefined && value.flowingBackgroundEnabled === true;
  const clamp = (number: unknown, fallback: number, max: number) =>
    typeof number === 'number' && Number.isFinite(number) ? Math.round(Math.min(max, Math.max(0, number))) : fallback;
  return {
    visibility: clamp(value.wallpaperVisibility, legacy ? clamp(value.flowingBackgroundOpacity, 100, 100) : 100, 100),
    blur: clamp(value.wallpaperBlur, legacy ? clamp(value.flowingBackgroundBlur, 0, 20) : 0, 20),
  };
}
