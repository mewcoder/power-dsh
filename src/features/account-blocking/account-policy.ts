import type { NativeContext, NativePlugin, LifecycleOptions } from '../../shared/host/native.ts';
import { PluginPolicy } from '../../shared/host/plugin-policy.ts';

const TARGETS = [
  '@deepseek-ai/dsh-client-ui-settings-account',
  '@deepseek-ai/dsh-llm-deepseek-account',
];

function isTarget(entry: NativePlugin) {
  if (TARGETS.includes(entry.moduleName)) return true;
  // Only the shipped DeepSeek key entry: separately added instances stay available.
  return entry.moduleName === '@deepseek-ai/dsh-llm-deepseek-api-key'
    && entry.entryId === 'include:llm-deepseek'
    && entry.patchId === 'llm-deepseek';
}

export class AccountPolicy extends PluginPolicy {
  constructor(ctx: NativeContext, options: LifecycleOptions = {}) {
    super(ctx, {
      matches: isTarget, flag: 'blockOfficialAccount', label: 'official-account',
    }, options);
  }
}
