import { errorCode, type NativeContext, type NativeAgent, type NativeSkill, type NativeSkillRecord, type NativeSkillControl, type NativeSkills, type NativeLease, type NativeScope, type CreateScope, type LifecycleOptions, type Release } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { SkillCatalog, SkillScope, SkillWorkspace } from './rpc.ts';
import { isRecord, hasStrings, isOneOf } from '../../shared/types/protocol.ts';
interface SkillView { cwd: string; scope: SkillScope; workspaces: SkillWorkspace[]; projectRoot: string; scopeKey: unknown }
type SkillIdentity = Pick<NativeSkill, 'name' | 'description' | 'source' | 'provider' | 'path' | 'origin' | 'resourceBase'>;
import { access } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { skillOrigin } from './skill-origin.ts';

const PROVIDER = 'power-dsh-disabled-skills';
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const USER_RANK = 225;
const PROJECT_RANK = Number.MIN_SAFE_INTEGER;

function isProject(source: string) { return source === 'project' || source.startsWith('project-'); }
function keyOf(scope: string, projectRoot: string, name: string) { return JSON.stringify([scope, projectRoot, name]); }
function skillPath(skill: Pick<NativeSkill, 'path' | 'resourceBase'>) { return skill.path || (skill.resourceBase?.kind === 'directory' ? skill.resourceBase.path : '') || ''; }
function recordOf(skill: SkillIdentity, scope: string, projectRoot = ''): NativeSkillRecord {
  return {
    name: skill.name, description: skill.description, source: skill.source,
    provider: skill.provider, path: skillPath(skill), scope, projectRoot, origin: skill.origin ?? '',
  };
}
function legacyProjectRoot(path: string) {
  if (!isAbsolute(path)) return '';
  const normalized = resolve(path).replaceAll('\\', '/');
  const index = normalized.search(/\/\.(?:dsh|agents)\/skills\//);
  return index < 0 ? '' : resolve(normalized.slice(0, index) || '/');
}
function records(value: unknown): Map<string, NativeSkillRecord> {
  if (!Array.isArray(value) || value.length > 2048) throw new Error('Invalid DSH skill preferences.');
  const result = new Map<string, NativeSkillRecord>();
  for (const row of value) {
    if (!isRecord(row) || typeof row.name !== 'string' || !NAME.test(row.name)
      || !hasStrings(row, ['name', 'description', 'source', 'provider', 'path']) || !row.description
      || (row.scope !== undefined && !isOneOf(row.scope, ['', 'user', 'project']))
      || (row.projectRoot !== undefined && typeof row.projectRoot !== 'string')
      || (row.origin !== undefined && typeof row.origin !== 'string')) throw new Error('Invalid DSH skill preferences.');
    const scope = row.scope || (isProject(row.source) ? 'project' : 'user');
    let projectRoot = '';
    if (scope === 'project') {
      if (row.projectRoot && !isAbsolute(row.projectRoot)) throw new Error('Invalid DSH project skill preferences.');
      projectRoot = row.projectRoot ? resolve(row.projectRoot) : legacyProjectRoot(row.path);
    }
    const key = keyOf(scope, projectRoot, row.name);
    if (result.has(key)) throw new Error('Invalid DSH skill preferences.');
    // Unlocatable legacy project entries stay stored and never become user-wide restrictions.
    result.set(key, recordOf(row, scope, projectRoot));
  }
  return result;
}

// Native invocation policy affects DSH only; shared SKILL.md files are never edited.
export class SkillPolicy {
  owner: NativeContext;
  config: LivePreferences;
  ensureActive: Release;
  ctx!: NativeContext;
  createScope!: CreateScope;
  registry!: NativeSkills;
  controls: Set<NativeSkillControl>;
  agents: Map<NativeAgent, { ctx: NativeContext; stop: Release }>;
  scopes: Map<string, { lease: NativeLease; scope: NativeScope; stop: Release }>;
  scopeTasks: Map<string, Promise<unknown>>;
  releases: Release[];
  closed: boolean;
  ready: Promise<void> | null;
  constructor(ctx: NativeContext, config: LivePreferences, { ensureActive = () => {} }: LifecycleOptions = {}) {
    this.owner = ctx; this.config = config; this.ensureActive = ensureActive;
    this.controls = new Set();
    this.agents = new Map();
    this.scopes = new Map();
    this.scopeTasks = new Map();
    this.releases = [];
    this.closed = false;
    this.ready = null;
  }

  preferences() { return records(this.config.disabledSkills.get()); }
  active() {
    this.ensureActive();
    if (this.closed) throw new Error('Skill management has been unloaded.');
  }

  bind(ctx: NativeContext, createScope: CreateScope) {
    this.ctx = ctx;
    this.createScope = createScope;
    this.registry = ctx.get('skills');
    if (!this.registry?.registerProvider || !this.registry.snapshot) throw new Error('DSH skill management is unavailable.');
    this.releases.push(this.register(ctx));
    this.releases.push(ctx.on('agent/created', ({ agent }) => this.attachAgent(agent), { global: true, prepend: true }));
    this.releases.push(ctx.on('agent-preset/selected', sessionId => {
      const agent = ctx.agents.get(sessionId);
      if (agent) this.attachAgent(agent);
    }, { global: true }));
    this.releases.push(ctx.on('settings/document-updated', namespace => {
      if (namespace === this.owner.fiber.entry.options.id) this.invalidate();
    }));
    this.releases.push(ctx.on('app-boot/config-reload', () => this.invalidate()));
    this.releases.push(ctx.on('agent/disposed', ({ agent }) => {
      this.agents.get(agent)?.stop();
      this.agents.delete(agent);
    }, { global: true }));
    this.releases.push(ctx.on('plugin-manager/changed', () => {
      void this.warmScopes().catch(() => {}); // Requests report unavailable native compositions.
      for (const agent of ctx.agents.list()) this.attachAgent(agent);
      this.invalidate();
    }));
    for (const agent of ctx.agents.list()) this.attachAgent(agent);
    if (ctx.loader?.await) void ctx.loader.await().then(() => this.warmScopes()).catch(() => {});
  }

  async projectRoot(cwd: string) {
    const start = resolve(cwd);
    const fs = this.ctx.get('fs');
    for (let current = start; ; current = dirname(current)) {
      let exists = false;
      try {
        const marker = join(current, '.git');
        if (fs) exists = await fs.stat(await fs.resolve(marker)) !== undefined;
        else { await access(marker); exists = true; }
      } catch (_error) { /* The native provider also treats inaccessible markers as absent. */ }
      if (exists) return current;
      if (dirname(current) === current) return start;
    }
  }

  register(context: NativeContext, projectOnly = false) {
    if (this.closed) throw new Error('Skill management has been unloaded.');
    let control: NativeSkillControl | undefined;
    const stop = context.get('skills').registerProvider(lifecycle => {
      control = lifecycle;
      this.controls.add(lifecycle);
      lifecycle.signal.addEventListener('abort', () => this.controls.delete(lifecycle), { once: true });
      return {
        name: PROVIDER,
        list: async (options = {}) => {
          const preferences = [...this.preferences().values()];
          const hasProject = options.cwd !== undefined && preferences.some(row => row.scope === 'project' && row.projectRoot);
          const root = hasProject ? await this.projectRoot(options.cwd!) : '';
          return preferences.filter(row => row.scope === 'user' ? !projectOnly : root && row.projectRoot === root)
            .map(row => ({
              ...row, provider: PROVIDER, rank: row.scope === 'user' ? USER_RANK : PROJECT_RANK, locator: row,
              invocation: { modelInvocable: false, userInvocable: false },
            }));
        },
        get: async candidate => ({
          ...candidate.locator, provider: PROVIDER, content: '',
          invocation: { modelInvocable: false, userInvocable: false },
        }),
      };
    });
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      if (control) this.controls.delete(control);
      stop();
    };
  }

  attachAgent(agent: NativeAgent) {
    if (this.closed || this.agents.get(agent)?.ctx === agent.ctx) return;
    if (this.ctx.agentPresets.serviceFor(agent, 'skills') !== undefined) return;
    this.agents.get(agent)?.stop();
    try {
      // User masks stay in the standing layer so native project overrides retain precedence.
      const stop = this.register(agent.ctx, true);
      this.agents.set(agent, { ctx: agent.ctx, stop });
    } catch (error) {
      if (errorCode(error) !== 'INACTIVE_EFFECT') throw error;
    }
  }

  invalidate() {
    for (const control of this.controls) if (!control.signal.aborted) control.invalidate();
  }

  async warmScopes() {
    if (this.closed) return;
    const prepareAll = this.preferences().size > 0;
    const compositions = await this.ctx.agentPresets.compositionInventory();
    if (this.closed) return;
    const supported = compositions.filter(row => !row.broken
      && !row.rows.some(entry => entry.moduleName === '@deepseek-ai/dsh-skill' && entry.enabled !== false));
    for (const [preset, entry] of this.scopes) {
      if (supported.some(row => row.id === preset)) continue;
      this.scopes.delete(preset);
      entry.stop();
      try { await entry.scope.dispose(); }
      finally { await entry.lease[Symbol.asyncDispose](); }
    }
    for (const row of supported) {
      if (this.closed) return;
      if (!prepareAll && !this.scopes.has(row.id)) continue;
      await this.scope(row.id);
    }
  }

  scope(preset: string): Promise<unknown> {
    const pending = this.scopeTasks.get(preset);
    if (pending) return pending;
    const task = this.openScope(preset).finally(() => this.scopeTasks.delete(preset));
    this.scopeTasks.set(preset, task);
    return task;
  }

  async openScope(preset: string): Promise<unknown> {
    this.active();
    const lease = await this.ctx.agentPresets.acquireScope(preset);
    if (this.closed) { await lease[Symbol.asyncDispose](); this.active(); throw new Error('Skill management has been unloaded.'); }
    const previous = this.scopes.get(preset);
    if (previous && previous.lease.key === lease.key) { await lease[Symbol.asyncDispose](); return previous.lease.key; }
    let scope;
    let stop;
    try {
      scope = this.createScope(this.ctx, lease.key);
      stop = this.register(scope.ctx);
    } catch (error) {
      try { await scope?.dispose(); }
      finally { await lease[Symbol.asyncDispose](); }
      throw error;
    }
    this.scopes.set(preset, { lease, scope, stop });
    if (previous) {
      previous.stop();
      try { await previous.scope.dispose(); }
      finally { await previous.lease[Symbol.asyncDispose](); }
    }
    return lease.key;
  }

  async context(cwd: string, scope: string): Promise<SkillView> {
    if (typeof cwd !== 'string' || typeof scope !== 'string' || !['', 'user', 'project'].includes(scope)) throw new TypeError('Invalid skill context.');
    await this.ready;
    this.active();
    if (!this.ctx || this.closed) throw new Error('DSH skill management is unavailable.');
    const workspaces = this.ctx.workspaceRegistry.list().map(row => ({ path: resolve(row.path), title: row.title }));
    scope ||= 'user';
    const defaultDirectory = resolve(this.ctx.workingDirectory.defaultDirectory);
    const firstProject = workspaces.find(row => row.path === defaultDirectory) ?? workspaces[0];
    cwd = scope === 'user' ? '' : cwd ? resolve(cwd) : firstProject?.path ?? '';
    if (scope === 'project' && cwd && !workspaces.some(row => row.path === cwd)) throw new Error('The selected skill workspace is no longer available.');
    const preset = this.ctx.agentPresets.defaultId;
    const composition = (await this.ctx.agentPresets.compositionInventory()).find(row => row.id === preset && !row.broken);
    this.active();
    if (!composition) throw new Error('The current DSH skill composition is unavailable.');
    if (composition.rows.some(row => row.moduleName === '@deepseek-ai/dsh-skill' && row.enabled !== false)) {
      throw new Error('The current mode provides an isolated skill service and cannot currently be managed here.');
    }
    const scopeKey = await this.scope(preset);
    const projectRoot = scope === 'project' && cwd ? await this.projectRoot(cwd) : '';
    this.active();
    return { cwd, scope: scope as SkillScope, workspaces, projectRoot, scopeKey };
  }

  lookup(view: SkillView) { return view.scope === 'project' ? { cwd: view.cwd, scope: view.scopeKey } : { scope: view.scopeKey }; }

  async readView(view: SkillView): Promise<SkillCatalog> {
    if (view.scope === 'project' && !view.cwd) {
      this.active();
      return { cwd: '', scope: 'project', workspaces: view.workspaces, complete: true, skills: [] };
    }
    const snapshot = await this.registry.snapshot(this.lookup(view));
    this.active();
    const preferences = this.preferences();
    const skills = await Promise.all(snapshot.skills.filter(skill => isProject(skill.source) === (view.scope === 'project')).map(async skill => {
      const key = keyOf(view.scope, view.projectRoot, skill.name);
      const masked = skill.provider === PROVIDER;
      const original = masked ? preferences.get(key) ?? skill : skill;
      const modelInvocable = skill.invocation.modelInvocable;
      const userInvocable = skill.invocation.userInvocable;
      const enabled = modelInvocable || userInvocable;
      const legacy = view.scope === 'project' && preferences.has(keyOf('project', '', skill.name));
      const reason = !snapshot.complete ? 'incomplete' : legacy ? 'legacy-scope' : !masked && !enabled ? 'source-disabled'
        : preferences.has(key) && enabled ? 'unsupported' : '';
      return {
        name: skill.name, description: original.description, source: original.source,
        path: skillPath(original), origin: await skillOrigin(original), enabled, modelInvocable, userInvocable,
        canToggle: snapshot.complete && reason === '', reason,
      };
    }));
    this.active();
    return { cwd: view.cwd, scope: view.scope, workspaces: view.workspaces, complete: snapshot.complete, skills };
  }

  async list(cwd = '', scope = '') { return this.readView(await this.context(cwd, scope)); }

  async setEnabled(cwd: string, scope: string, name: string, enabled: boolean) {
    if (typeof name !== 'string' || !NAME.test(name) || typeof enabled !== 'boolean') throw new TypeError('Invalid skill operation.');
    const view = await this.context(cwd, scope);
    const before = await this.readView(view);
    const row = before.skills.find(skill => skill.name === name);
    if (!before.complete || !row?.canToggle) throw new Error('This skill cannot currently be changed in DSH.');
    if (row.enabled === enabled) return before;
    const native = await this.registry.snapshot(this.lookup(view));
    if (!native.complete) throw new Error('Skill discovery is incomplete. Refresh and try again.');
    const skill = native.skills.find(item => item.name === name && isProject(item.source) === (view.scope === 'project'));
    if (!skill) throw new Error('This skill is no longer available.');
    const origin = enabled ? '' : await skillOrigin(skill);
    this.active();
    await this.ctx.configEditor.edit(this.owner.fiber.entry, raw => {
      this.active();
      if (Object.hasOwn(raw, 'disabledSkills') && !Array.isArray(raw.disabledSkills)) throw new Error('Skill preferences are controlled by an expression and cannot be changed here.');
      const next = records(raw.disabledSkills ?? this.config.disabledSkills.get());
      const key = keyOf(view.scope, view.projectRoot, name);
      if (enabled) next.delete(key);
      else next.set(key, recordOf({ ...skill, origin }, view.scope, view.projectRoot));
      if (next.size > 2048) throw new Error('Too many disabled skill preferences.');
      return { ...raw, disabledSkills: [...next.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value) };
    });
    this.active();
    this.invalidate();
    for (const agent of this.ctx.agents.list()) this.attachAgent(agent);
    await this.warmScopes();
    const after = await this.list(before.cwd, before.scope);
    if (after.skills.find(item => item.name === name)?.enabled !== enabled) throw new Error('DSH did not accept the requested skill state. Refresh the list to inspect its actual state.');
    return after;
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    for (const release of this.releases.splice(0).reverse()) release();
    for (const entry of this.agents.values()) entry.stop();
    this.agents.clear();
    for (const entry of this.scopes.values()) {
      entry.stop();
      try { await entry.scope.dispose(); }
      finally { await entry.lease[Symbol.asyncDispose](); }
    }
    this.scopes.clear();
  }
}
