import type { ClientEnvironment, ClientFeature, ClientRuntime } from '../../shared/client/types.ts';

/** Preserve legacy configuration ownership; the wallpaper page now owns all background UI. */
export function createClientFeature(_runtime: ClientRuntime, _env: ClientEnvironment) {
  return {
    settings: [
      { field: 'flowingBackgroundEnabled', hidden: true },
      { field: 'flowingBackgroundKind', hidden: true },
      { field: 'flowingBackgroundOpacity', hidden: true },
      { field: 'flowingBackgroundBlur', hidden: true },
      { field: 'showBackgroundShortcut', hidden: true },
    ],
  } satisfies ClientFeature;
}
