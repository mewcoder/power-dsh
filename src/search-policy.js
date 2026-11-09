const MODULE = '@deepseek-ai/dsh-tool-web';
const PRESET = '@deepseek-ai/dsh-agent-preset';
const TOOL = 'web_search';
const DENIED = 'Built-in web search is disabled in power-dsh settings.';

function searchRows(rows) {
  return Array.isArray(rows) ? rows.flatMap(row => row?.name === MODULE ? [row]
    : row?.group === true ? searchRows(row.config) : []) : [];
}

function configureSearch(rows, enabled) {
  return rows.map(row => row.name === MODULE ? { ...row, config: { ...row.config, search: enabled } }
    : row.group === true && Array.isArray(row.config) ? { ...row, config: configureSearch(row.config, enabled) } : row);
}

function targetRows(entry) {
  return entry.options.name === MODULE ? [{ config: entry.options.config }]
    : entry.options.name === PRESET ? searchRows(entry.options.config?.plugins) : [];
}

// Search and fetch share a plugin: change only its search config, never its enabled state.
export class SearchPolicy {
  constructor(owner, config, { ensureActive = () => {} } = {}) {
    Object.assign(this, { owner, config, ensureActive });
    this.context = null;
    this.restrictions = new Map();
  }

  blocked() { return this.config.blockOfficialSearch.get(); }

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
    if (!this.context) throw new Error('Search blocking is unavailable. Re-enable power-dsh and try again.');
    const enabled = !blocked;
    const entries = this.owner.configEditor.entries().filter(entry => !entry.disabled && targetRows(entry).length);
    if (!entries.length) throw new Error('No supported built-in search tools were found in this profile.');
    const expected = entries.map(entry => ({ id: entry.options.id, count: targetRows(entry).length,
      preset: entry.options.name === PRESET ? entry.options.config.id : undefined }));
    for (const entry of entries) {
      this.ensureActive();
      if (targetRows(entry).every(row => (row.config?.search ?? true) === enabled)) continue;
      await this.owner.configEditor.edit(entry, raw => {
        this.ensureActive();
        if (entry.options.name === MODULE) return { ...raw, search: enabled };
        if (searchRows(raw.plugins).length !== expected.find(target => target.id === entry.options.id).count) {
          throw new Error('The search mode configuration changed. Please try again.');
        }
        return { ...raw, plugins: configureSearch(raw.plugins, enabled) };
      });
    }
    const after = this.owner.configEditor.entries();
    this.ensureActive();
    for (const target of expected) {
      const entry = after.find(item => item.options.id === target.id);
      const rows = entry ? targetRows(entry) : [];
      if (rows.length !== target.count || rows.some(row => (row.config?.search ?? true) !== enabled)) {
        throw new Error(`The search configuration did not match the requested value: ${target.id}`);
      }
    }
    const compositions = await this.context.agentPresets.compositionInventory();
    this.ensureActive();
    for (const target of expected.filter(row => row.preset !== undefined)) {
      const preset = compositions.find(row => row.id === target.preset);
      if (!preset || preset.broken || preset.rows.filter(row => row.moduleName === MODULE).length !== target.count) {
        throw new Error(`The search mode configuration could not be applied: ${target.preset}`);
      }
    }
    await this.owner.configEditor.edit(this.owner.fiber.entry, raw => {
      this.ensureActive();
      return { ...raw, blockOfficialSearch: blocked };
    });
    this.ensureActive();
    if (!this.context) throw new Error('Search blocking has been unloaded.');
    this.sync();
    if (this.blocked() !== blocked) throw new Error('The search setting did not match the requested value.');
    for (const agent of this.context.agents.list()) {
      if (blocked && agent.ctx.get('tools').get(TOOL, agent)) {
        throw new Error('Built-in search is still available. Re-enable power-dsh and try again.');
      }
    }
    return { blocked };
  }
}
