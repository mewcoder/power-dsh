import type { WallpaperChoice } from '../../shared/client/background/selection.ts';
import seaside from '../../../assets/wallpapers/seaside.json' with { type: 'json' };

export const PRESET_IMAGES: Partial<Record<WallpaperChoice, string>> = { seaside: seaside.dataUrl };

// Thumbnail for the existing homepage flow; the full background uses WebGL.
export const FLOW_PREVIEW = 'linear-gradient(145deg, #d5e4f5 0%, #f9fcff 42%, #9fbde5 70%, #eef5ff 100%)';
