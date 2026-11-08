const PREFERENCES = ['showVersion', 'showThemeSwitcher', 'showRefreshButton', 'showRestartButton', 'blockOfficialAccount', 'blockOfficialSearch', 'blockOfficialTelemetry', 'blockTodo', 'personalizationEnabled', 'skillManagerEnabled', 'mcpManagerEnabled', 'disabledSkills', 'globalPrompt'];

// A block switch directly disables or enables its matching native plugins.
export class PluginPolicy {
  constructor(ctx, { matches, flag, label }, { ensureActive = () => {} } = {}) {
    Object.assign(this, { ctx, matches, flag, label, ensureActive });
  }

  targets(entries) { return entries.filter(this.matches); }

  async setBlocked(blocked) {
    if (typeof blocked !== 'boolean') throw new TypeError('blocked must be boolean');
    this.ensureActive();
    const entries = await this.ctx.pluginManager.listPlugins();
    this.ensureActive();
    const targets = this.targets(entries);
    if (!targets.length) throw new Error(`No supported ${this.label} features were found in this profile.`);
    const enabled = !blocked;
    const plan = (blocked ? targets : [...targets].reverse()).filter(entry =>
      entry.enabled !== enabled || (!enabled && entry.fiberPhase === 'active'));
    for (const entry of plan) {
      if (entry.readOnlyReason) throw new Error(`${this.label} feature cannot be changed: ${entry.moduleName}`);
    }
    for (const entry of plan) {
      this.ensureActive();
      const result = await this.ctx.pluginManager.setPluginEnabled(entry.entryId, enabled);
      this.ensureActive();
      if (result.application !== 'applied' || result.warnings?.length) {
        const detail = result.warnings?.join('; ') || result.error?.diagnostic || result.error?.code || result.restartReason || '';
        throw new Error(`${this.label} change was not applied: ${entry.entryId} (${result.application}). ${detail}`);
      }
    }
    const after = await this.ctx.pluginManager.listPlugins();
    this.ensureActive();
    for (const target of targets) {
      const entry = after.find(item => item.entryId === target.entryId);
      if (!entry || !this.matches(entry) || entry.enabled !== enabled || (!enabled && entry.fiberPhase === 'active')) {
        throw new Error(`${this.label} feature state did not match the requested value: ${target.entryId}`);
      }
    }
    await this.ctx.configEditor.edit(this.ctx.fiber.entry, raw => {
      // The native lock may have been acquired after unload. Keep only current preferences.
      this.ensureActive();
      const next = Object.fromEntries(PREFERENCES.filter(key => Object.hasOwn(raw, key)).map(key => [key, raw[key]]));
      return { ...next, [this.flag]: blocked };
    });
    this.ensureActive();
    return { blocked };
  }
}
