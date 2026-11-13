import { errorCode, type NativeContext, type NativeAgent, type NativeSkill, type NativeSkillRecord, type NativeSkillControl, type NativeSkills, type NativeLease, type NativeScope, type CreateScope, type LifecycleOptions, type Release } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { SkillCatalog, SkillDetail, SkillScope, SkillWorkspace, ExternalSkillCatalog, ExternalSkillDetail, SkillImportResult } from './rpc.ts';
import { isRecord, hasStrings, isOneOf } from '../../shared/types/protocol.ts';
interface SkillView { cwd: string; scope: SkillScope; workspaces: SkillWorkspace[]; projectRoot: string; scopeKey: unknown }
type SkillIdentity = Pick<NativeSkill, 'name' | 'description' | 'source' | 'provider' | 'path' | 'origin' | 'resourceBase'>;
import { access, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { skillOrigin } from './skill-origin.ts';
import { SKILL_SOURCES, discoverExternal, readDiscoveredSkill, resolveSelection, resolveSkillRoots, packageLocation } from './skill-import.ts';
import { addDiscoveredSkill } from './skill-install.ts';
import { pathExists, skillRevision } from './skill-content.ts';
import { deleteOwnedSkill, skillDeletion } from './skill-delete.ts';
import { homedir } from 'node:os';

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

  /**
   * Load one skill's body for the read-only detail dialog.
   *
   * The body is read through the same preset scope the catalog used, so a
   * project copy resolves exactly as the listed row did. Nothing is cached,
   * written, or kept after the response.
   * @param cwd - project directory for the project scope; ignored for user scope.
   * @param scope - `user` or `project`.
   * @param name - skill name as the catalog lists it.
   * @returns the skill with its Markdown body, or null when it is not listed.
   */
  async read(cwd: string, scope: string, name: string): Promise<SkillDetail | null> {
    if (typeof name !== 'string' || !NAME.test(name)) throw new TypeError('Invalid skill operation.');
    const view = await this.context(cwd, scope);
    const before = await this.readView(view);
    const row = before.skills.find(skill => skill.name === name);
    if (!row) return null;
    let content = '';
    try {
      const definition = await this.registry.get(name, this.lookup(view));
      this.active();
      if (definition === undefined) return null;
      // A masked skill's body is withheld by this module, so the stored copy has none.
      if (typeof definition?.content === 'string') content = definition.content;
    } catch (error) {
      if (errorCode(error) === 'INACTIVE_EFFECT') throw error;
      this.active();
      throw new Error('The skill body could not be read.');
    }
    this.active();
    const deletion = before.complete ? await this.deletionFor(view, row).catch(() => null) : null;
    this.active();
    return { name: row.name, description: row.description, content, source: row.source, path: row.path,
      origin: row.origin, enabled: row.enabled, modelInvocable: row.modelInvocable, userInvocable: row.userInvocable,
      ...(deletion ? { deletion } : {}) };
  }

  deletionBase(view: SkillView) { return view.scope === 'user' ? this.owner.profileContext.home : view.projectRoot; }

  deletionFor(view: SkillView, row: SkillCatalog['skills'][number]) {
    if (row.source !== (view.scope === 'user' ? 'user-dsh' : 'project-dsh') || !row.path) return Promise.resolve(null);
    return skillDeletion(this.deletionBase(view), this.importTarget(view), row.name, row.path);
  }

  async deleteSkill(cwd: string, scope: string, name: string, revision: string): Promise<SkillCatalog> {
    if (typeof name !== 'string' || !NAME.test(name) || typeof revision !== 'string' || !/^[a-f0-9]{64}$/.test(revision)) throw new Error('skill-delete-unavailable');
    const view = await this.context(cwd, scope);
    const before = await this.readView(view);
    const row = before.skills.find(skill => skill.name === name);
    if (!before.complete || !row) throw new Error('skill-delete-unavailable');
    const deletion = await this.deletionFor(view, row);
    if (!deletion || deletion.revision !== revision) throw new Error('skill-delete-changed');
    const key = keyOf(view.scope, view.projectRoot, name);
    await deleteOwnedSkill(this.deletionBase(view), this.importTarget(view), name, row.path, revision, () => this.active(), async () => {
      let removed: NativeSkillRecord | undefined;
      if (!this.preferences().has(key)) return;
      await this.ctx.configEditor.edit(this.owner.fiber.entry, raw => {
        this.active();
        if (Object.hasOwn(raw, 'disabledSkills') && !Array.isArray(raw.disabledSkills)) throw new Error('skill-delete-unavailable');
        const next = records(raw.disabledSkills ?? this.config.disabledSkills.get());
        if (next.get(key)?.path === row.path) { removed = next.get(key); next.delete(key); }
        return { ...raw, disabledSkills: [...next.values()] };
      });
      return async () => {
        if (!removed || this.closed) return;
        await this.ctx.configEditor.edit(this.owner.fiber.entry, raw => {
          this.active();
          const next = records(raw.disabledSkills ?? this.config.disabledSkills.get());
          if (!next.has(key)) next.set(key, removed!);
          return { ...raw, disabledSkills: [...next.values()] };
        });
      };
    });
    this.active();
    this.invalidate();
    const after = await this.readView(view);
    if (!after.complete || after.skills.some(skill => skill.name === name && skill.path === row.path)) throw new Error('skill-delete-readback-failed');
    return after;
  }

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


  /** Target directory for imported skills in the current scope. */
  importTarget(view: SkillView): string {
    if (view.scope === 'user') return join(this.owner.profileContext.home, 'skills');
    if (!view.projectRoot) throw new Error('The selected workspace has no project root.');
    return join(view.projectRoot, '.dsh', 'skills');
  }

  externalRoots(view: SkillView) {
    return resolveSkillRoots(homedir(), view.scope === 'project' ? view.projectRoot : '').filter(root => root.scope === view.scope);
  }

  async discoverExternalSkills(cwd: string, scope: string): Promise<ExternalSkillCatalog> {
    const view = await this.context(cwd, scope);
    const catalog = await this.readView(view);
    const target = this.importTarget(view);
    const roots = this.externalRoots(view);
    const inherited = view.scope === 'project'
      ? (await this.registry.snapshot({ scope: view.scopeKey })).skills.filter(skill => !isProject(skill.source)).map(skill => skill.name) : [];
    const entries = await discoverExternal(roots, target, new Set(catalog.skills.map(skill => skill.name)),
      new Map(catalog.skills.map(skill => [skill.name, skill.path])), new Set(inherited));
    this.active();
    return { complete: catalog.complete, entries };
  }

  /**
   * Read one discovered skill's body without importing it.
   *
   * The dialog shows what the copy would hold, so the source file is read
   * in place and nothing is written.
   * @param cwd - project directory for the project scope; ignored for user scope.
   * @param scope - `user` or `project`.
   * @param id - stable id the discovery list gave the skill.
   * @returns the skill with its Markdown body, or null when it is gone.
   */
  async readExternal(cwd: string, scope: string, id: string): Promise<ExternalSkillDetail | null> {
    if (typeof id !== 'string' || id === '') throw new TypeError('Invalid skill operation.');
    const view = await this.context(cwd, scope);
    const roots = this.externalRoots(view);
    let [skill] = await resolveSelection(roots, [id]);
    if (!skill) {
      const entry = (await this.discoverExternalSkills(cwd, scope)).entries.find(item => item.id === id);
      if (entry?.comparison === 'same' && entry.variants?.[0]) [skill] = await resolveSelection(roots, [entry.variants[0].id]);
    }
    this.active();
    if (skill === undefined) return null;
    const labels = new Map(SKILL_SOURCES.map(spec => [spec.id, spec.label]));
    try {
      const detail = await readDiscoveredSkill(skill);
      return { ...detail, source: labels.get(skill.source) ?? skill.source };
    } catch (error) {
      this.active();
      throw new Error('The skill body could not be read.');
    }
  }

  async importExternalSkills(cwd: string, scope: string, ids: string[]): Promise<SkillImportResult> {
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 || ids.some(id => typeof id !== 'string' || id === '')) {
      throw new TypeError('Invalid skill import request.');
    }
    const imported: string[] = [];
    const skipped: { name: string; reason: string }[] = [];
    for (const id of ids) {
      const catalog = await this.discoverExternalSkills(cwd, scope);
      const entry = catalog.entries.find(item => item.id === id || item.variants?.some(variant => variant.id === id));
      const variant = entry?.variants?.find(item => item.id === id) ?? (entry?.comparison === 'same' ? entry.variants?.[0] : undefined);
      if (!entry || !variant) { skipped.push({ name: entry?.name ?? '', reason: 'skill-source-selection-required' }); continue; }
      try {
        await this.addSkill(cwd, scope, variant.id, 'copy', variant.revision);
        imported.push(entry.name);
      } catch (error) {
        skipped.push({ name: entry.name, reason: error instanceof Error ? error.message : 'skill-copy-failed' });
      }
    }
    this.active();
    this.invalidate();
    return { imported, skipped };
  }

  async addSkill(cwd: string, scope: string, id: string, mode: string, revision: string): Promise<SkillImportResult> {
    const source = await this.context(cwd, scope);
    return this.addSkillTo(source.cwd, source.scope, id, mode, revision, source.scope === 'project' ? source.cwd : '');
  }

  async readSkillImportDestination(cwd: string, scope: string, name: string, flat: boolean): Promise<import('./rpc.ts').SkillImportDestination> {
    if (typeof name !== 'string' || !NAME.test(name) || typeof flat !== 'boolean') throw new TypeError('Invalid skill import destination.');
    const view = await this.context(cwd, scope);
    const catalog = await this.readView(view);
    const root = this.importTarget(view);
    const available = catalog.skills.some(skill => skill.name === name)
      || await pathExists(join(root, name)) || await pathExists(join(root, `${name}.md`));
    const inherited = view.scope === 'project'
      && (await this.registry.snapshot({ scope: view.scopeKey })).skills.some(skill => skill.name === name && !isProject(skill.source));
    this.active();
    return { path: join(root, flat ? `${name}.md` : name), complete: catalog.complete, available, inherited };
  }

  async importSkillTo(cwd: string, scope: string, id: string, revision: string, targetCwd: string): Promise<SkillImportResult> {
    if (typeof targetCwd !== 'string') throw new TypeError('Invalid skill import destination.');
    return this.addSkillTo(cwd, scope, id, 'copy', revision, targetCwd);
  }

  async addSkillTo(cwd: string, scope: string, id: string, mode: string, revision: string, targetCwd: string): Promise<SkillImportResult> {
    if (typeof id !== 'string' || typeof revision !== 'string' || (mode !== 'copy' && mode !== 'link')) throw new Error('skill-operation-invalid');
    const source = await this.context(cwd, scope);
    const view = await this.context(targetCwd, targetCwd ? 'project' : 'user');
    const catalog = await this.readView(view);
    if (!catalog.complete) throw new Error('skill-catalog-incomplete');
    const discovered = await this.discoverExternalSkills(cwd, scope);
    if (!discovered.complete) throw new Error('skill-catalog-incomplete');
    const entry = discovered.entries.find(item => item.variants?.some(variant => variant.id === id));
    const variant = entry?.variants?.find(item => item.id === id);
    if (!entry || !variant || !revision || revision !== variant.revision) throw new Error('skill-source-changed');
    if (catalog.skills.some(skill => skill.name === entry.name)) throw new Error('skill-name-conflict');
    const roots = this.externalRoots(source);
    const [skill] = await resolveSelection(roots, [id]);
    if (!skill) throw new Error('skill-source-changed');
    this.active();
    await addDiscoveredSkill(this.importTarget(view), skill, mode, revision, () => this.active());
    this.invalidate();
    await this.verifyImportedSkill(view, skill.name, variant.flat, revision);
    return { imported: [skill.name], skipped: [] };
  }

  async verifyImportedSkill(view: SkillView, name: string, flat: boolean, revision: string) {
    const after = await this.readView(view);
    const accepted = after.skills.find(item => item.name === name);
    let verified = false;
    try {
      const location = accepted?.path ? (await packageLocation(accepted.path)).path : '';
      const target = join(this.importTarget(view), flat ? `${name}.md` : name);
      verified = Boolean(location) && await realpath(location) === await realpath(target) && await skillRevision(location, flat) === revision;
    } catch {}
    this.active();
    if (!after.complete || !verified) throw new Error('skill-readback-failed');
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
