import { PluginPolicy } from './plugin-policy.js';

const MODULE = '@deepseek-ai/dsh-tool-todo';
const PRESET = '@deepseek-ai/dsh-agent-preset';
const TOOL = 'todo_write';

function todoRows(rows) {
  return Array.isArray(rows) ? rows.flatMap(row => row?.name === MODULE ? [row]
    : row?.group === true ? todoRows(row.config) : []) : [];
}

function hasTodo(rows) { return todoRows(rows).length > 0; }

function needsChange(rows, blocked) {
  return rows.some(row => row.name === MODULE
    ? (row.disabled ?? false) !== blocked
    : row.group === true && Array.isArray(row.config) && needsChange(row.config, blocked));
}

function disableTodo(rows, blocked) {
  return rows.map(row => row.name === MODULE ? { ...row, disabled: blocked }
    : row.group === true && Array.isArray(row.config) ? { ...row, config: disableTodo(row.config, blocked) } : row);
}
const DENIED = 'Todo is disabled in power-dsh settings.';

// Preset tools are inherited by Agents; a native restriction hides them and a guard denies dispatch.
export class TodoPolicy {
  constructor(owner, config, { ensureActive = () => {} } = {}) {
    Object.assign(this, { owner, config, ensureActive });
    this.context = null;
    this.restrictions = new Map();
    this.plugins = new PluginPolicy(owner, {
      matches: entry => entry.moduleName === MODULE,
      flag: 'blockTodo', label: 'Todo',
    }, { ensureActive });
  }

  blocked() { return this.config.blockTodo.get(); }

  bind(ctx) {
    this.context = ctx;
    ctx.effect(() => () => {
      this.context = null;
      for (const { release } of this.restrictions.values()) release();
      this.restrictions.clear();
    });
    ctx.tools.guard(exec => this.blocked() && exec.name === TOOL ? DENIED : undefined);
    ctx.on('agent/created', ({ agent }) => this.syncAgent(agent), { global: true });
    ctx.on('agent/disposed', ({ agent }) => {
      this.restrictions.get(agent)?.release();
      this.restrictions.delete(agent);
    }, { global: true });
    ctx.on('agent-preset/selected', id => {
      const agent = ctx.agents.get(id);
      if (agent) this.syncAgent(agent);
    }, { global: true });
    ctx.on('agent/pre-step', ({ agent }, next) => {
      this.syncAgent(agent);
      return next();
    }, { global: true, prepend: true });
    ctx.on('settings/document-updated', namespace => {
      if (namespace === this.owner.fiber.entry.options.id) this.sync();
    });
    this.sync();
  }

  syncAgent(agent) {
    const previous = this.restrictions.get(agent);
    if (previous && (previous.context !== agent.ctx || !this.blocked())) {
      previous.release();
      this.restrictions.delete(agent);
    }
    if (!this.blocked() || this.restrictions.has(agent)) return;
    const tools = agent.ctx.get('tools');
    if (!tools.get(TOOL, agent)) return;
    const release = tools.restrict({ deny: [TOOL] });
    this.restrictions.set(agent, { context: agent.ctx, release });
  }

  sync() {
    for (const agent of this.context.agents.list()) this.syncAgent(agent);
  }

  async setBlocked(blocked) {
    if (typeof blocked !== 'boolean') throw new TypeError('blocked must be boolean');
    this.ensureActive();
    if (!this.context) throw new Error('Todo blocking is unavailable. Re-enable power-dsh and try again.');
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
    const compositions = await this.context.agentPresets.compositionInventory();
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
    this.sync();
    if (this.blocked() !== blocked) throw new Error('The Todo setting did not match the requested value.');
    for (const agent of this.context.agents.list()) {
      const tools = agent.ctx.get('tools');
      if (blocked && tools.get(TOOL, agent)) {
        throw new Error('The Todo tool is still available. Re-enable power-dsh and try again.');
      }
    }
    return { blocked };
  }
}
