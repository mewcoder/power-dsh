import { join } from 'node:path';
import type { NativeContext, NativeEntry, LifecycleOptions } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';

const MODULE = 'session-query-sqlite';
const ENGINE = '@deepseek-ai/dsh-session-query-sqlite';
// The shipped deployment entry (dsh-base bundle layer) mounts the engine with an
// in-memory index and search refused; enabling it points the derived index at a
// durable file under the plugin's own profile directory and opens it lazily.
const DISABLED: { path: string; openAt: string } = { path: ':memory:', openAt: 'never' };
const ENABLED_OPEN = 'first-search';
const INDEX_DIRECTORY = 'power-dsh';
const INDEX_FILE = 'session-query-index.sqlite3';

// Deployments enabling content search override the session-query-sqlite entry
// through the profile patch or a bundle layer; the native ConfigEditor persists
// such edits in the profile configuration, so this policy uses the same
// mechanism and reads the entry back before declaring success. A restart is
// still required for the already-mounted engine to pick the entry up.
export class EnhancePolicy {
  owner: NativeContext;
  config: LivePreferences;
  ensureActive: () => void;

  constructor(owner: NativeContext, config: LivePreferences, { ensureActive = () => {} }: LifecycleOptions = {}) {
    this.owner = owner;
    this.config = config;
    this.ensureActive = ensureActive;
  }

  enhanced() {
    return this.config.searchPopupEnabled.get();
  }

  findEntry(entries: readonly NativeEntry[]): NativeEntry | undefined {
    return entries.find(entry => !entry.disabled && entry.options.id === MODULE && entry.options.name === ENGINE);
  }

  desired(enabled: boolean): { path: string; openAt: string } {
    if (!enabled) return DISABLED;
    return { path: join(this.owner.profileContext.home, INDEX_DIRECTORY, INDEX_FILE), openAt: ENABLED_OPEN };
  }

  matches(config: unknown, desired: { path: string; openAt: string }): boolean {
    const row = (config ?? {}) as { path?: unknown; openAt?: unknown };
    return row.path === desired.path && row.openAt === desired.openAt;
  }

  async configureEngine(enabled: boolean) {
    this.ensureActive();
    const entry = this.findEntry(this.owner.configEditor.entries());
    if (!entry) throw new Error('No session-query index entry was found in this profile.');
    const desired = this.desired(enabled);
    if (!this.matches(entry.options.config, desired)) {
      this.ensureActive();
      await this.owner.configEditor.edit(entry, raw => ({ ...raw, path: desired.path, openAt: desired.openAt }));
    }
    const after = this.findEntry(this.owner.configEditor.entries());
    this.ensureActive();
    if (!after || !this.matches(after.options.config, desired)) {
      throw new Error(`The session-query index configuration did not match the requested value: ${MODULE}`);
    }
  }

  async setEnabled(enabled: boolean) {
    if (typeof enabled !== 'boolean') throw new TypeError('enabled must be boolean');
    await this.configureEngine(enabled);
    this.ensureActive();
    await this.owner.configEditor.edit(this.owner.fiber.entry, raw => {
      const next: Record<string, unknown> = { ...raw, searchPopupEnabled: enabled };
      delete next.searchEnhanceEnabled;
      return next;
    });
    this.ensureActive();
    if (this.enhanced() !== enabled) throw new Error('The search popup setting did not match the requested value.');
    return { enabled };
  }
}
