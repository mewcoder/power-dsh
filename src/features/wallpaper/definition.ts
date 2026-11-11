import type { FeatureDefinition } from '../../shared/types/feature.ts';
export const definition = Object.freeze({
  id: 'wallpaper', category: 'interface', order: -1,
  keys: Object.freeze(['wallpaperEnabled', 'wallpaperSelection', 'wallpaperVisibility', 'wallpaperBlur'] as const),
  spec: 'src/features/wallpaper/spec.md',
} satisfies FeatureDefinition);
