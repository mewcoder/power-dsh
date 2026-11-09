const RETIRED_PREFERENCES = ['accountRestore', 'telemetryRestore', 'telemetryPluginRestore', 'settingsFullscreen'];

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
      // The lock may arrive after unload or another feature's settings write.
      this.ensureActive();
      const next = { ...raw, [this.flag]: blocked };
      for (const key of RETIRED_PREFERENCES) delete next[key];
      return next;
    });
    this.ensureActive();
    return { blocked };
  }
}
