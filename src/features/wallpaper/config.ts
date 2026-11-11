import z from '@deepseek-ai/schemastery';
export const configFields = {
  // Missing values preserve selections from the original combined background feature.
  wallpaperEnabled: z.boolean().volatile(),
  wallpaperSelection: z.string().volatile(),
  wallpaperVisibility: z.number().volatile(),
  wallpaperBlur: z.number().volatile(),
};
