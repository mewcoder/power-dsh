import type { NativeContext, NativePayload, LifecycleOptions, Release } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import { PluginPolicy } from '../../shared/host/plugin-policy.ts';

const MODULE = '@deepseek-ai/dsh-tool-todo';
const PRESET = '@deepseek-ai/dsh-agent-preset';

function todoRows(rows: unknown): NativePayload[] {
  return Array.isArray(rows) ? rows.flatMap(row => row?.name === MODULE ? [row]
    : row?.group === true ? todoRows(row.config) : []) : [];
}

function hasTodo(rows: unknown) { return todoRows(rows).length > 0; }

function needsChange(rows: NativePayload[], blocked: boolean): boolean {
  return rows.some(row => row.name === MODULE
    ? (row.disabled ?? false) !== blocked
    : row.group === true && Array.isArray(row.config) && needsChange(row.config, blocked));
}

function disableTodo(rows: NativePayload[], blocked: boolean): NativePayload[] {
  return rows.map(row => row.name === MODULE ? { ...row, disabled: blocked }
    : row.group === true && Array.isArray(row.config) ? { ...row, config: disableTodo(row.config, blocked) } : row);
}
// Only native declarations change; already-open Agents retain their leased revision.
export class TodoPolicy {
  owner: NativeContext;
  config: LivePreferences;
  ensureActive: Release;
  context: NativeContext | null;
  plugins: PluginPolicy;

  constructor(owner: NativeContext, config: LivePreferences, { ensureActive = () => {} }: LifecycleOptions = {}) {
    this.owner = owner; this.config = config; this.ensureActive = ensureActive;
    this.context = null;
    this.plugins = new PluginPolicy(owner, {
      matches: entry => entry.moduleName === MODULE,
      flag: 'blockTodo', label: 'Todo',
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
    if (!context) throw new Error('Todo blocking is unavailable. Re-enable power-dsh and try again.');
    const presets = this.owner.configEditor.entries().filter(entry => entry.options.name === PRESET
      && hasTodo(entry.options.config?.plugins));
    const expected = presets.map(entry => ({
      id: entry.options.config.id, count: todoRows(entry.options.config.plugins).length,
    }));
    for (const entry of presets) {
      this.ensureActive();
      if (!needsChange(entry.options.config.plugins, blocked)) continue;
      await this.owner.configEditor.edit(entry, raw => {
        this.ensureActive();
        if (!hasTodo(raw.plugins)) throw new Error('The Todo mode configuration changed. Please try again.');
        return { ...raw, plugins: disableTodo(raw.plugins, blocked) };
      });
    }
    this.ensureActive();
    const compositions = await context.agentPresets.compositionInventory();
    this.ensureActive();
    for (const target of expected) {
      const preset = compositions.find(row => row.id === target.id);
      if (!preset || preset.rows.filter(row => row.moduleName === MODULE).length !== target.count) {
        throw new Error(`The Todo mode configuration could not be read back: ${target.id}`);
      }
    }
    for (const preset of compositions) {
      const targets = preset.rows.filter(row => row.moduleName === MODULE);
      if (targets.length && (preset.broken || targets.some(row => row.enabled !== !blocked))) {
        throw new Error(`The Todo plugin change was not applied in mode: ${preset.id}`);
      }
    }
    await this.plugins.setBlocked(blocked);
    this.ensureActive();
    if (!this.context) throw new Error('Todo blocking has been unloaded.');
    if (this.config.blockTodo.get() !== blocked) throw new Error('The Todo setting did not match the requested value.');
    return { blocked };
  }
}
