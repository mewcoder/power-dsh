import { apply as applyHost } from './app/host.ts';
import type { NativeContext } from './shared/host/native.ts';
import type { HostFeature } from './shared/host/feature.ts';
import type { LivePreferences } from './shared/types/preferences.ts';

export { inject, Config } from './app/host.ts';

// Cordis exposes its base Context to plugin callers; DSH supplies the declared
// services before apply. Keep that dynamic boundary out of feature implementations.
export function apply(ctx: unknown, config: LivePreferences, features: readonly HostFeature[] | undefined = undefined): void {
  applyHost(ctx as NativeContext, config, features);
}
