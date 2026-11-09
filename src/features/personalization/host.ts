import type { NativeContext } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { HostOptions, HostService } from '../../shared/host/feature.ts';
import { PersonalizationFile } from './personalization.ts';

export function createHost(_ctx: NativeContext, _config: LivePreferences, { owner, ensureActive }: HostOptions) {
  return { instructions: new PersonalizationFile(owner.profileContext.home, ensureActive) };
}

export const methods = {
  readPersonalization() {
    return this.run(() => this.instructions.read());
  },
  savePersonalization(text: string, revision: string) {
    return this.run(() => this.instructions.save(text, revision));
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
