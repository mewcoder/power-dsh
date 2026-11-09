import type { NativeContext, NativePayload, LifecycleOptions, Release } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import { PluginPolicy } from '../../shared/host/plugin-policy.ts';

const MODULES = ['@deepseek-ai/dsh-command-goal', '@deepseek-ai/dsh-tool-goal'] as const;
const PRESET = '@deepseek-ai/dsh-agent-preset';

function isGoalEntry(name: unknown): boolean {
  return MODULES.some(moduleName => moduleName === name);
}

function goalRows(rows: unknown): NativePayload[] {
  return Array.isArray(rows) ? rows.flatMap(row => isGoalEntry(row?.name) ? [row]
    : row?.group === true ? goalRows(row.config) : []) : [];
}

function needsChange(rows: NativePayload[], blocked: boolean): boolean {
  return goalRows(rows).some(row => (row.disabled ?? false) !== blocked);
}

function setDisabled(rows: NativePayload[], blocked: boolean): NativePayload[] {
  return rows.map(row => isGoalEntry(row.name) ? { ...row, disabled: blocked }
    : row.group === true && Array.isArray(row.config) ? { ...row, config: setDisabled(row.config, blocked) } : row);
}

// Goal storage and automatic continuation stay global; only future command/tool declarations change.
export class GoalPolicy {
  owner: NativeContext;
  config: LivePreferences;
  ensureActive: Release;
  context: NativeContext | null = null;
  plugins: PluginPolicy;

  constructor(owner: NativeContext, config: LivePreferences, { ensureActive = () => {} }: LifecycleOptions = {}) {
    this.owner = owner;
    this.config = config;
    this.ensureActive = ensureActive;
    this.plugins = new PluginPolicy(owner, {
      matches: entry => isGoalEntry(entry.moduleName),
      flag: 'blockGoal', label: 'Goal mode',
    }, { ensureActive });
  }

  bind(ctx: NativeContext) {
    this.context = ctx;
    ctx.effect(() => () => { this.context = null; });
  }

  async setBlocked(blocked: boolean) {
    if (typeof blocked !== 'boolean') throw new TypeError('blocked must be boolean');
    this.ensureActive();
    const context = this.context;
    if (!context) throw new Error('Goal blocking is unavailable. Re-enable power-dsh and try again.');
    const presets = this.owner.configEditor.entries().filter(entry => entry.options.name === PRESET
      && goalRows(entry.options.config?.plugins).length > 0);
    const expected = presets.map(entry => ({
      id: entry.options.config.id,
      modules: MODULES.map(moduleName => ({
        moduleName, count: goalRows(entry.options.config.plugins).filter(row => row.name === moduleName).length,
      })),
    }));
    for (const entry of presets) {
      this.ensureActive();
      if (!needsChange(entry.options.config.plugins, blocked)) continue;
      await this.owner.configEditor.edit(entry, raw => {
        this.ensureActive();
        if (!goalRows(raw.plugins).length) throw new Error('The Goal mode configuration changed. Please try again.');
        return { ...raw, plugins: setDisabled(raw.plugins, blocked) };
      });
    }
    this.ensureActive();
    const compositions = await context.agentPresets.compositionInventory();
    this.ensureActive();
    for (const target of expected) {
      const preset = compositions.find(row => row.id === target.id);
      if (!preset || target.modules.some(({ moduleName, count }) =>
        preset.rows.filter(row => row.moduleName === moduleName).length !== count)) {
        throw new Error(`The Goal mode configuration could not be read back: ${target.id}`);
      }
    }
    for (const preset of compositions) {
      const targets = preset.rows.filter(row => isGoalEntry(row.moduleName));
      if (targets.length && (preset.broken || targets.some(row => row.enabled !== !blocked))) {
        throw new Error(`The Goal plugin change was not applied in mode: ${preset.id}`);
      }
    }
    await this.plugins.setBlocked(blocked);
    this.ensureActive();
    if (!this.context) throw new Error('Goal blocking has been unloaded.');
    if (this.config.blockGoal.get() !== blocked) throw new Error('The Goal setting did not match the requested value.');
    return { blocked };
  }
}
