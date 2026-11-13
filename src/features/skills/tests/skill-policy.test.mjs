import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve, sep, join } from 'node:path';
import { mkdtemp, mkdir, writeFile, readFile, rm, access, realpath, symlink, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { SkillPolicy } from '../skill-policy.ts';
import { skillMarkdown } from '../skill-content.ts';
import { OperationQueue } from '../../../shared/host/operation-queue.ts';

function fixture({ initial = [], incomplete = false, profileHome = resolve('/power-dsh-test-no-profile') } = {}) {
  let raw = { showVersion: true, personalizationEnabled: true, skillManagerEnabled: true, disabledSkills: initial };
  let complete = !incomplete;
  let rejectWrite = false;
  const providers = new Set();
  const listeners = new Map();
  const writes = [];
  let generation = {};
  const generations = new Set([generation]);
  const leases = [];
  const scopes = [];
  const live = [];
  const lookups = [];
  const markers = new Set(['/workspace/.git', '/other/.git'].map(filename => resolve(filename)));
  const native = [
    { name: 'review', description: 'Personal review', source: 'user-dsh', provider: 'filesystem', path: '/user/skills/review/SKILL.md', invocation: { modelInvocable: true, userInvocable: true } },
    { name: 'review', description: 'Review project code', source: 'project-dsh', provider: 'filesystem', path: '/workspace/.dsh/skills/review/SKILL.md', root: '/workspace', invocation: { modelInvocable: true, userInvocable: true } },
    { name: 'review', description: 'Other project review', source: 'project-agents', provider: 'filesystem', path: '/other/.agents/skills/review/SKILL.md', root: '/other', invocation: { modelInvocable: true, userInvocable: true } },
    { name: 'manual', description: 'User-only instructions', source: 'user-agents', provider: 'filesystem', path: '/agents/skills/manual/SKILL.md', invocation: { modelInvocable: false, userInvocable: true } },
    { name: 'blocked-by-author', description: 'Disabled upstream', source: 'runtime', provider: 'runtime', invocation: { modelInvocable: false, userInvocable: false } },
  ];
  const projectOf = cwd => {
    const directory = cwd ? resolve(cwd) : undefined;
    const workspace = resolve('/workspace');
    return directory?.startsWith(workspace + sep) || directory === workspace ? workspace : directory;
  };
  async function snapshot(options = {}) {
    lookups.push(options);
    const rows = new Map();
    const keys = [undefined];
    if (options.scope?.agent) keys.push(options.scope.parent, options.scope);
    else if (options.scope) keys.push(options.scope);
    for (const key of keys) {
      const candidates = generations.has(key) ? native.filter(row => !row.root || options.cwd !== undefined && resolve(row.root) === projectOf(options.cwd))
        .map(row => ({ ...row, rank: row.root ? row.source === 'project-dsh' ? 100 : 200 : row.provider === 'runtime' ? 250 : 400 })) : [];
      for (const entry of providers) if (entry.scope === key) candidates.push(...await entry.provider.list(options));
      candidates.sort((a, b) => a.rank - b.rank);
      const local = new Set();
      for (const row of candidates) {
        if (local.has(row.name)) continue;
        local.add(row.name); rows.set(row.name, row);
      }
    }
    return { skills: [...rows.values()], complete };
  }
  function registryFor(context) {
    return {
      registerProvider(create) {
        const controller = new AbortController();
        const control = { signal: controller.signal, invalidate() {} };
        const entry = { provider: create(control), scope: context._scope };
        providers.add(entry);
        return () => { providers.delete(entry); controller.abort(); };
      },
      snapshot,
    };
  }
  const fs = { resolve: async path => path, stat: async path => markers.has(path) ? { type: 'directory' } : undefined };
  const ctx = {
    profileContext: { home: profileHome },
    fiber: { entry: { options: { id: 'power-dsh' } } },
    get(name) { if (name === 'skills') return registryFor(this); if (name === 'fs') return fs; return undefined; },
    on(name, fn) {
      const callbacks = listeners.get(name) ?? new Set();
      callbacks.add(fn); listeners.set(name, callbacks);
      return () => callbacks.delete(fn);
    },
    workspaceRegistry: { list: () => [
      { path: '/workspace', title: 'Main app' }, { path: '/workspace/sub', title: 'Subproject' },
      { path: '/other', title: 'Other app' }, { path: '/no-git', title: 'Scratch project' },
    ] },
    workingDirectory: { defaultDirectory: '/workspace' },
    agents: { list: () => live, get: id => live.find(agent => agent.id === id) },
    agentPresets: {
      defaultId: 'standard',
      compositionInventory: async () => [{ id: 'standard', rows: [] }],
      serviceFor: () => undefined,
      async acquireScope() {
        const lease = { key: generation, disposed: false, async [Symbol.asyncDispose]() { this.disposed = true; } };
        leases.push(lease); return lease;
      },
    },
    configEditor: { async edit(entry, change) {
      assert.equal(entry, ctx.fiber.entry);
      if (rejectWrite) throw new Error('Write rejected');
      raw = change(raw); writes.push(structuredClone(raw));
    } },
  };
  const queue = new OperationQueue();
  const policy = new SkillPolicy(ctx, { disabledSkills: { get: () => raw.disabledSkills } }, { ensureActive: () => queue.ensureActive() });
  const createScope = (_owner, key) => {
    const scope = { ctx: Object.assign(Object.create(ctx), { _scope: key }), disposed: false, async dispose() { this.disposed = true; } };
    scopes.push(scope); return scope;
  };
  policy.bind(ctx, createScope);
  return {
    policy, writes, providers, leases, scopes, live, native, ctx, queue, lookups, markers, snapshot,
    get generation() { return generation; },
    get raw() { return raw; },
    setComplete(value) { complete = value; },
    setRejectWrite(value) { rejectWrite = value; },
    nextGeneration() { generation = {}; generations.add(generation); },
    callbacks(name) { return listeners.get(name); },
    agent(id) {
      const key = { agent: true, parent: generation };
      const agent = { id, key, ctx: Object.assign(Object.create(ctx), { _scope: key }) };
      live.push(agent); policy.attachAgent(agent); return agent;
    },
  };
}

const row = (view, name = 'review') => view.skills.find(item => item.name === name);

test('directory and plugin origins survive a disabled-policy reload without copying skill resources', async () => {
  const office = { name: 'office', description: 'Office workflows', source: 'bundled', provider: 'dsh-office',
    resourceBase: { kind: 'directory', path: '/Resources/office-assets/office' },
    invocation: { modelInvocable: true, userInvocable: true } };
  const external = { name: 'external-review', description: 'External skill', source: 'agent-codex', provider: 'dsh-skills-manager-external',
    path: '/home/test/.codex/skills/external-review/SKILL.md', invocation: { modelInvocable: true, userInvocable: true } };
  const app = fixture();
  let restored;
  app.native.push(office, external);
  try {
    const view = await app.policy.list();
    assert.equal(row(view).origin, '.dsh');
    assert.equal(row(view, 'manual').origin, '.agents');
    assert.equal(row(view, 'office').origin, '@deepseek-ai/dsh-skill-office');
    assert.equal(row(view, 'external-review').origin, '.codex');
    assert.equal(row(view, 'external-review').path, external.path);
    const disabled = await app.policy.setEnabled('', 'user', 'office', false);
    assert.equal(row(disabled, 'office').origin, '@deepseek-ai/dsh-skill-office');
    assert.equal(row(disabled, 'office').enabled, false);
    const externalDisabled = await app.policy.setEnabled('', 'user', 'external-review', false);
    assert.equal(row(externalDisabled, 'external-review').origin, '.codex');
    assert.equal(row(externalDisabled, 'external-review').path, external.path);
    const saved = app.raw.disabledSkills;
    assert.equal(saved.find(item => item.name === 'office').origin, '@deepseek-ai/dsh-skill-office');
    assert.equal(saved.find(item => item.name === 'external-review').origin, '.codex');
    assert.ok(saved.every(item => !Object.hasOwn(item, 'resourceBase') && !Object.hasOwn(item, 'content')));
    await app.policy.close();
    restored = fixture({ initial: structuredClone(saved) });
    restored.native.push(office, external);
    const reloaded = await restored.policy.list();
    assert.equal(row(reloaded, 'office').origin, '@deepseek-ai/dsh-skill-office');
    assert.equal(row(reloaded, 'office').enabled, false);
    assert.equal(row(reloaded, 'external-review').enabled, false);
    assert.equal(row(reloaded, 'external-review').origin, '.codex');
    assert.equal(row(reloaded, 'external-review').path, external.path);
    const enabled = await restored.policy.setEnabled('', 'user', 'office', true);
    assert.equal(row(enabled, 'office').enabled, true);
    assert.equal(row(enabled, 'office').origin, '@deepseek-ai/dsh-skill-office');
  } finally { await app.policy.close(); await restored?.policy.close(); }
});

test('skill detail returns null when its listed definition disappears, preserving genuine empty bodies', async () => {
  const app = fixture();
  const reads = [];
  let definition;
  app.policy.registry.get = async (name, options) => { reads.push({ name, options }); return definition; };
  try {
    assert.ok(row(await app.policy.list('', 'user')), 'Discovery still contains the summary.');
    assert.equal(await app.policy.read('', 'user', 'review'), null);
    assert.ok(row(await app.policy.list('', 'user')), 'A stale summary must not become an empty-body detail.');
    assert.deepEqual(reads, [{ name: 'review', options: { scope: app.generation } }]);
    definition = { ...app.native[0], content: '' };
    const empty = await app.policy.read('', 'user', 'review');
    assert.equal(empty.name, 'review');
    assert.equal(empty.content, '', 'A valid provider definition may have an empty body.');
    assert.deepEqual(app.writes, []);
  } finally { await app.policy.close(); }
});

test('user view omits cwd before native discovery and retains a same-named personal skill', async () => {
  const app = fixture();
  try {
    const view = await app.policy.list();
    assert.equal(view.cwd, ''); assert.equal(view.scope, 'user');
    assert.ok(!Object.hasOwn(view, 'preset')); assert.ok(!Object.hasOwn(view, 'presets'));
    assert.equal(row(view).description, 'Personal review');
    assert.equal(row(view).source, 'user-dsh');
    assert.ok(app.lookups.every(options => !Object.hasOwn(options, 'cwd')));
    const project = await app.policy.list('/workspace', 'project');
    assert.equal(row(project).description, 'Review project code');
    assert.ok(project.skills.every(item => item.source.startsWith('project-')));
  } finally { await app.policy.close(); }
});

test('the project catalog lists imported names only and never adds the process directory', async () => {
  const app = fixture();
  try {
    app.ctx.workingDirectory.defaultDirectory = '/not-imported';
    app.ctx.workspaceRegistry.list = () => [
      { path: '/other', title: 'Renamed project', sessionIds: ['private-session'] },
      { path: '/workspace', title: 'Main app' },
    ];
    const view = await app.policy.list('', 'project');
    assert.equal(view.cwd, resolve('/other'));
    assert.deepEqual(view.workspaces, [
      { path: resolve('/other'), title: 'Renamed project' }, { path: resolve('/workspace'), title: 'Main app' },
    ]);
    await assert.rejects(app.policy.list('/not-imported', 'project'), /no longer available/);
    app.ctx.workspaceRegistry.list = () => [];
    const reads = app.lookups.length;
    assert.deepEqual(await app.policy.list('', 'project'), {
      cwd: '', scope: 'project', workspaces: [], complete: true, skills: [],
    });
    assert.equal(app.lookups.length, reads, 'No project registry lookup may fall back to an unimported directory.');
    await assert.rejects(app.policy.setEnabled('', 'project', 'review', false), /cannot currently/);
    assert.equal(app.writes.length, 0);
    assert.ok((await app.policy.list('', 'user')).skills.length > 0);
  } finally { await app.policy.close(); }
});

test('user disable preserves project overrides and project toggles are independent by native project root', async () => {
  const app = fixture();
  try {
    assert.equal(row(await app.policy.setEnabled('', 'user', 'review', false)).enabled, false);
    assert.equal(row(await app.policy.list('/workspace', 'project')).enabled, true);
    assert.equal(row(await app.policy.list('/other', 'project')).enabled, true);
    const closed = row(await app.policy.setEnabled('/workspace/sub', 'project', 'review', false));
    assert.equal(closed.enabled, false); assert.equal(closed.modelInvocable, false); assert.equal(closed.userInvocable, false);
    assert.equal(closed.source, 'project-dsh');
    assert.equal(row(await app.policy.list('/workspace', 'project')).enabled, false);
    assert.equal(row(await app.policy.list('/other', 'project')).enabled, true);
    assert.equal(row(await app.policy.list('', 'user')).enabled, false);
    assert.deepEqual(app.raw.disabledSkills.map(item => [item.scope, item.projectRoot, item.name]).sort(), [
      ['project', resolve('/workspace'), 'review'], ['user', '', 'review'],
    ]);
    assert.equal(app.raw.showVersion, true); assert.equal(app.raw.personalizationEnabled, true);
    assert.ok(app.raw.disabledSkills.every(item => !Object.hasOwn(item, 'content')));
    assert.equal(app.native[0].invocation.modelInvocable, true);
    await app.policy.setEnabled('/workspace', 'project', 'review', true);
    assert.equal(row(await app.policy.list('/workspace/sub', 'project')).enabled, true);
    assert.equal(row(await app.policy.list()).enabled, false);
    await app.policy.setEnabled('', 'user', 'review', true);
    assert.deepEqual(app.raw.disabledSkills, []);
  } finally { await app.policy.close(); }
});

test('restoring a personal skill preserves the author user-only invocation rule', async () => {
  const app = fixture();
  try {
    await app.policy.setEnabled('', 'user', 'manual', false);
    const manual = row(await app.policy.setEnabled('', 'user', 'manual', true), 'manual');
    assert.equal(manual.enabled, true); assert.equal(manual.modelInvocable, false); assert.equal(manual.userInvocable, true);
  } finally { await app.policy.close(); }
});

test('live-agent exact policies contain only project masks while standing policies retain user precedence', async () => {
  const app = fixture();
  try {
    const agent = app.agent('existing');
    await app.policy.setEnabled('', 'user', 'review', false);
    let native = await app.snapshot({ cwd: '/workspace', scope: agent.key });
    assert.equal(row(native).invocation.modelInvocable, true);
    await app.policy.setEnabled('/workspace', 'project', 'review', false);
    native = await app.snapshot({ cwd: '/workspace/sub', scope: agent.key });
    assert.equal(row(native).invocation.modelInvocable, false); assert.equal(row(native).invocation.userInvocable, false);
    native = await app.snapshot({ cwd: '/other', scope: agent.key });
    assert.equal(row(native).invocation.modelInvocable, true);
    const agentProvider = [...app.providers].find(entry => entry.scope === agent.key).provider;
    assert.deepEqual(await agentProvider.list({}), []);
    const candidates = await agentProvider.list({ cwd: '/workspace' });
    assert.equal(candidates.length, 1); assert.equal(candidates[0].source, 'project-dsh');
    for (const fn of app.callbacks('agent/disposed')) fn({ agent });
    assert.equal(app.policy.agents.size, 0);
  } finally { await app.policy.close(); }
});

test('legacy project records infer a canonical root; unknown project roots remain stored and cannot broaden restrictions', async () => {
  const known = { name: 'review', description: 'Review project code', source: 'project-dsh', provider: 'filesystem', path: '/workspace/.dsh/skills/review/SKILL.md', scope: '', projectRoot: '' };
  const app = fixture({ initial: [known] });
  try {
    assert.equal(row(await app.policy.list('/workspace/sub', 'project')).enabled, false);
    assert.equal(row(await app.policy.list('/other', 'project')).enabled, true);
    assert.equal(row(await app.policy.list()).enabled, true);
    await app.policy.setEnabled('/workspace', 'project', 'review', true);
    assert.deepEqual(app.raw.disabledSkills, []);
  } finally { await app.policy.close(); }
  const unknown = fixture({ initial: [{ ...known, path: '/unknown/location.md' }] });
  try {
    const item = row(await unknown.policy.list('/workspace', 'project'));
    assert.equal(item.enabled, true); assert.equal(item.canToggle, false); assert.equal(item.reason, 'legacy-scope');
    assert.equal(row(await unknown.policy.list()).enabled, true);
    await unknown.policy.setEnabled('', 'user', 'manual', false);
    assert.ok(unknown.raw.disabledSkills.some(item => item.name === 'review' && item.scope === 'project' && item.projectRoot === ''));
  } finally { await unknown.policy.close(); }
});

test('author-disabled entries, incomplete observations, and unregistered contexts cannot be changed', async () => {
  const app = fixture();
  try {
    const sourceDisabled = row(await app.policy.list(), 'blocked-by-author');
    assert.equal(sourceDisabled.enabled, false); assert.equal(sourceDisabled.canToggle, false); assert.equal(sourceDisabled.reason, 'source-disabled');
    await assert.rejects(app.policy.setEnabled('', '', 'blocked-by-author', true), /cannot currently/);
    await assert.rejects(app.policy.list('/unregistered', 'project'), /no longer available/);
    await assert.rejects(app.policy.list('', 'standard'), /Invalid skill context/);
    await assert.rejects(app.policy.setEnabled('', '', '../review', false), /Invalid/);
    app.setComplete(false);
    assert.equal((await app.policy.list()).complete, false);
    await assert.rejects(app.policy.setEnabled('', '', 'review', false), /cannot currently/);
    assert.equal(app.writes.length, 0);
  } finally { await app.policy.close(); }
});

test('write failures retain actual state; same-state requests avoid writes and unload refuses pending operations', async () => {
  const app = fixture();
  try {
    await app.policy.setEnabled('', '', 'review', true); assert.equal(app.writes.length, 0);
    app.setRejectWrite(true);
    await assert.rejects(app.policy.setEnabled('', '', 'review', false), /Write rejected/);
    assert.equal(row(await app.policy.list()).enabled, true);
    app.queue.close();
    await assert.rejects(app.policy.setEnabled('', '', 'review', false), /unloaded/); assert.equal(app.writes.length, 0);
  } finally { await app.policy.close(); }
});

test('scope replacement and teardown release leases and providers', async () => {
  const saved = { name: 'review', description: 'Personal review', source: 'user-dsh', provider: 'filesystem', path: '/user/skills/review/SKILL.md', scope: 'user', projectRoot: '' };
  const app = fixture({ initial: [saved] });
  assert.equal(row(await app.policy.list()).enabled, false);
  const originalLease = app.leases[0];
  await Promise.all([app.policy.list(), app.policy.list()]); assert.equal(app.providers.size, 2);
  app.nextGeneration(); await app.policy.list();
  assert.equal(originalLease.disposed, true); assert.equal(app.scopes[0].disposed, true); assert.equal(app.providers.size, 2);
  await app.policy.close(); await app.policy.close(); assert.equal(app.providers.size, 0);
  assert.ok(app.leases.every(lease => lease.disposed)); assert.ok(app.scopes.every(scope => scope.disposed));
});

test('an initial undefined native scope key creates and owns a scope before later catalog reads reuse it', async () => {
  const app = fixture();
  app.ctx.agentPresets.acquireScope = async () => {
    const lease = { key: undefined, disposed: false, async [Symbol.asyncDispose]() { this.disposed = true; } };
    app.leases.push(lease);
    return lease;
  };
  try {
    const catalog = await app.policy.list('', 'user');
    assert.equal(catalog.scope, 'user');
    assert.equal(catalog.complete, true);
    assert.equal(app.scopes.length, 1);
    assert.equal(app.scopes[0].ctx._scope, undefined);
    assert.equal(app.leases[0].disposed, false);
    await app.policy.list('', 'user');
    assert.equal(app.scopes.length, 1);
    assert.equal(app.leases[0].disposed, false);
    assert.equal(app.leases[1].disposed, true);
  } finally { await app.policy.close(); }
  assert.equal(app.scopes[0].disposed, true);
  assert.equal(app.leases[0].disposed, true);
  assert.equal(app.writes.length, 0);
});

test('a disposed context refusing scope creation releases the incoming preset lease', async () => {
  const app = fixture();
  try {
    app.policy.createScope = () => { throw Object.assign(new Error('Inactive context'), { code: 'INACTIVE_EFFECT' }); };
    await assert.rejects(app.policy.list(), { code: 'INACTIVE_EFFECT' });
    assert.equal(app.leases.length, 1); assert.equal(app.leases[0].disposed, true);
  } finally { await app.policy.close(); }
});

test('isolated preset skill realms are rejected instead of displaying an unrelated Host catalog', async () => {
  const app = fixture();
  try {
    app.ctx.agentPresets.compositionInventory = async () => [{ id: 'standard', rows: [{ moduleName: '@deepseek-ai/dsh-skill', enabled: true }] }];
    await assert.rejects(app.policy.list(), /isolated skill service/); assert.equal(app.writes.length, 0);
  } finally { await app.policy.close(); }
});

test('closing while project discovery waits prevents preference writes even if the owner queue remains active', async () => {
  const app = fixture();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const findRoot = app.policy.projectRoot.bind(app.policy);
  app.policy.projectRoot = async cwd => { await gate; return findRoot(cwd); };
  const pending = app.policy.setEnabled('/workspace', 'project', 'review', false);
  await new Promise(resolve => setImmediate(resolve));
  await app.policy.close();
  release();
  await assert.rejects(pending, /unloaded/);
  assert.equal(app.writes.length, 0);
});

test('project discovery matches native nearest .git and otherwise keeps the requested cwd', async () => {
  const app = fixture();
  try {
    assert.equal(await app.policy.projectRoot('/workspace/sub'), resolve('/workspace'));
    app.markers.add(resolve('/workspace/sub/.git'));
    assert.equal(await app.policy.projectRoot('/workspace/sub'), resolve('/workspace/sub'));
    assert.equal(await app.policy.projectRoot('/no-git'), resolve('/no-git'));
  } finally { await app.policy.close(); }
});

async function importedFixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'power-dsh-policy-'));
  const sourceRoot = join(directory, 'codex');
  const source = join(sourceRoot, 'guide');
  const home = join(directory, 'profile');
  const projectA = join(directory, 'project-a');
  const projectB = join(directory, 'project-b');
  const target = join(home, 'skills', 'guide');
  const otherSource = join(directory, 'unrelated', 'guide');
  await mkdir(source, { recursive: true });
  await mkdir(otherSource, { recursive: true });
  const writeSource = body => writeFile(join(source, 'SKILL.md'), `---\nname: guide\ndescription: Guide instructions\n---\n${body}`);
  await writeSource('Original guide');
  await writeFile(join(otherSource, 'SKILL.md'), await readFile(join(source, 'SKILL.md')));
  const app = fixture({ profileHome: home });
  app.ctx.workspaceRegistry.list = () => [
    { path: projectA, title: 'Project A' }, { path: join(projectA, 'sub'), title: 'Subproject' },
    { path: projectB, title: 'Project B' },
  ];
  app.markers.add(join(projectA, '.git'));
  app.markers.add(join(projectB, '.git'));
  let registration = 'target';
  app.policy.externalRoots = () => [{ source: 'codex', path: sourceRoot, scope: 'user' }];
  const nativeSnapshot = app.policy.registry.snapshot;
  app.policy.registry.snapshot = async options => {
    const snapshot = await nativeSnapshot(options);
    const locations = [{ path: target, root: '', source: 'user-dsh' },
      ...[projectA, projectB].map(root => ({ path: join(root, '.dsh', 'skills', 'guide'), root, source: 'project-dsh' }))];
    for (const location of locations) {
      if (location.root && options.cwd !== location.root && options.cwd !== join(location.root, 'sub')) continue;
      try {
        await access(join(location.path, 'SKILL.md'));
        if (registration !== 'missing') {
          const masked = snapshot.skills.find(skill => skill.name === 'guide' && skill.provider === 'power-dsh-disabled-skills'
            && (location.root ? skill.scope === 'project' && skill.projectRoot === location.root : skill.scope === 'user'));
          if (location.root) snapshot.skills = snapshot.skills.filter(skill => skill.name !== 'guide' || skill === masked);
          if (!masked) snapshot.skills.push({
            name: 'guide', description: 'Guide instructions', source: location.source, provider: 'filesystem',
            path: join(registration === 'target' ? location.path : otherSource, 'SKILL.md'),
            invocation: { modelInvocable: true, userInvocable: true },
          });
        }
      } catch {}
    }
    return snapshot;
  };
  app.policy.registry.get = async (name, options) => {
    const skill = (await app.policy.registry.snapshot(options)).skills.find(row => row.name === name);
    return skill ? { ...skill, content: await skillMarkdown(target, false) } : undefined;
  };
  try {
    const [entry] = (await app.policy.discoverExternalSkills('', 'user')).entries;
    await run({ app, entry, source, target, home, projectA, projectB, writeSource, setRegistration: value => { registration = value; } });
  } finally {
    await app.policy.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test('native availability follows actual files and needs no persistent import record', async () => importedFixture(async ({ app, entry, target, home, writeSource }) => {
  const variant = entry.variants[0];
  assert.deepEqual(await app.policy.addSkill('', 'user', variant.id, 'copy', variant.revision), { imported: ['guide'], skipped: [] });
  const [existing] = (await app.policy.discoverExternalSkills('', 'user')).entries;
  assert.equal(existing.available, true);
  assert.equal(existing.conflict, false);
  await assert.rejects(access(join(home, 'power-dsh', 'skill-imports.json')), { code: 'ENOENT' });
  await assert.rejects(app.policy.addSkill('', 'user', variant.id, 'copy', variant.revision), /name-conflict/);
  await writeSource('Updated guide');
  const detail = await app.policy.read('', 'user', 'guide');
  assert.equal(detail.content, 'Original guide');
  assert.equal(Object.hasOwn(detail, 'installation'), false);
  assert.equal((await app.policy.discoverExternalSkills('', 'user')).entries[0].conflict, true);
  await rm(target, { recursive: true });
  const [removed] = (await app.policy.discoverExternalSkills('', 'user')).entries;
  assert.equal(removed.available, false);
  assert.equal(removed.conflict, false);
}));

test('missing native registration is neither a successful add nor a fabricated catalog row', async () => importedFixture(async ({ app, entry, target, setRegistration }) => {
  setRegistration('missing');
  const variant = entry.variants[0];
  await assert.rejects(app.policy.addSkill('', 'user', variant.id, 'copy', variant.revision), /readback-failed/);
  assert.match(await readFile(join(target, 'SKILL.md'), 'utf8'), /Original guide/);
  assert.equal(row(await app.policy.list(), 'guide'), undefined);
  const [remaining] = (await app.policy.discoverExternalSkills('', 'user')).entries;
  assert.equal(remaining.name, 'guide');
  assert.equal(remaining.conflict, true);
  assert.equal(remaining.available, false);
}));

test('a same-name provider at another path cannot confirm link installation', async () => importedFixture(async ({ app, entry, target, setRegistration }) => {
  setRegistration('other');
  const variant = entry.variants[0];
  await assert.rejects(app.policy.addSkill('', 'user', variant.id, 'link', variant.revision), /readback-failed/);
  assert.match(await readFile(join(target, 'SKILL.md'), 'utf8'), /Original guide/);
}));

test('stale selections and incomplete native discovery never write a skill', async () => importedFixture(async ({ app, entry, target, writeSource }) => {
  const variant = entry.variants[0];
  await writeSource('Changed after discovery');
  await assert.rejects(app.policy.addSkill('', 'user', variant.id, 'copy', variant.revision), /source-changed/);
  app.setComplete(false);
  await assert.rejects(app.policy.addSkill('', 'user', variant.id, 'copy', variant.revision), /catalog-incomplete/);
  await assert.rejects(access(target), { code: 'ENOENT' });
}));

test('native skills not imported by PowerDSH are already present even when invocation is disabled', async () => importedFixture(async ({ app, source }) => {
  app.native.push({ name: 'guide', description: 'Existing shared guide', source: 'user-agents', provider: 'filesystem',
    path: join(source, 'SKILL.md'), invocation: { modelInvocable: false, userInvocable: false } });
  const [existing] = (await app.policy.discoverExternalSkills('', 'user')).entries;
  assert.equal(existing.available, true);
  assert.equal(existing.conflict, false);
  assert.equal(row(await app.policy.list(), 'guide').enabled, false);
  await assert.rejects(app.policy.addSkill('', 'user', existing.variants[0].id, 'copy', existing.variants[0].revision), /name-conflict/);
}));

test('a corrupt legacy import history cannot block native listing or a new import', async () => importedFixture(async ({ app, entry, home }) => {
  const history = join(home, 'power-dsh', 'skill-imports.json');
  await mkdir(join(history, '..'), { recursive: true });
  await writeFile(history, '{corrupt legacy history');
  assert.equal((await app.policy.list()).complete, true);
  const variant = entry.variants[0];
  await app.policy.addSkill('', 'user', variant.id, 'copy', variant.revision);
  assert.equal(await readFile(history, 'utf8'), '{corrupt legacy history');
  assert.equal((await app.policy.discoverExternalSkills('', 'user')).entries[0].available, true);
}));

test('destination previews resolve project roots and flat filenames without writing files', async () => importedFixture(async ({ app, projectA, home, source }) => {
  assert.deepEqual(await app.policy.readSkillImportDestination('', 'user', 'guide', false),
    { path: join(home, 'skills', 'guide'), complete: true, available: false, inherited: false });
  assert.equal((await app.policy.readSkillImportDestination(join(projectA, 'sub'), 'project', 'guide', true)).path,
    join(projectA, '.dsh', 'skills', 'guide.md'));
  await assert.rejects(access(join(projectA, '.dsh')));
  await assert.rejects(access(join(home, 'skills')));
  await assert.rejects(app.policy.readSkillImportDestination('', 'user', '../escape', false), /Invalid/);
  await assert.rejects(app.policy.readSkillImportDestination(source, 'project', 'guide', false), /no longer available/);
}));

test('an existing global skill can be copied to a chosen project without affecting other targets', async () => importedFixture(async ({ app, entry, target, projectA, projectB }) => {
  const variant = entry.variants[0];
  await app.policy.addSkill('', 'user', variant.id, 'copy', variant.revision);
  const destination = await app.policy.readSkillImportDestination(projectB, 'project', 'guide', false);
  assert.equal(destination.available, false);
  assert.equal(destination.inherited, true);
  await app.policy.importSkillTo('', 'user', variant.id, variant.revision, projectB);
  assert.equal(await readFile(join(projectB, '.dsh', 'skills', 'guide', 'SKILL.md'), 'utf8'), await readFile(join(target, 'SKILL.md'), 'utf8'));
  await assert.rejects(access(join(projectA, '.dsh')));
  assert.equal((await app.policy.readSkillImportDestination(projectB, 'project', 'guide', false)).available, true);
  assert.equal((await app.policy.discoverExternalSkills('', 'user')).entries[0].available, true);
}));

test('project sources import to global or another project even without discovery roots at the destination', async () => importedFixture(async ({ app, entry, source, target, projectA, projectB }) => {
  const variant = entry.variants[0];
  app.policy.externalRoots = view => view.cwd === projectA ? [{ source: 'codex', path: join(source, '..'), scope: 'project' }] : [];
  await app.policy.importSkillTo(projectA, 'project', variant.id, variant.revision, '');
  await app.policy.importSkillTo(projectA, 'project', variant.id, variant.revision, projectB);
  assert.equal(await readFile(join(target, 'SKILL.md'), 'utf8'), await readFile(join(source, 'SKILL.md'), 'utf8'));
  assert.equal((await app.policy.readSkillImportDestination(projectB, 'project', 'guide', false)).available, true);
  await assert.rejects(access(join(projectA, '.dsh')));
  await app.policy.addSkill('', 'project', variant.id, 'copy', variant.revision);
  assert.equal((await app.policy.readSkillImportDestination(projectA, 'project', 'guide', false)).available, true);
}));

test('confirmation refuses occupied destinations, stale sources and removed workspaces', async () => importedFixture(async ({ app, entry, projectA, projectB, writeSource }) => {
  const variant = entry.variants[0];
  assert.equal((await app.policy.readSkillImportDestination(projectA, 'project', 'guide', false)).available, false);
  const destination = join(projectA, '.dsh', 'skills', 'guide.md');
  await mkdir(join(destination, '..'), { recursive: true });
  await writeFile(destination, 'Keep these instructions');
  await assert.rejects(app.policy.importSkillTo('', 'user', variant.id, variant.revision, projectA), /name-conflict/);
  assert.equal(await readFile(destination, 'utf8'), 'Keep these instructions');
  assert.equal((await app.policy.readSkillImportDestination(projectA, 'project', 'guide', false)).available, true);
  app.ctx.workspaceRegistry.list = () => [{ path: projectA, title: 'Project A' }];
  await assert.rejects(app.policy.importSkillTo('', 'user', variant.id, variant.revision, projectB), /no longer available/);
  await writeSource('Changed after opening confirmation');
  await assert.rejects(app.policy.importSkillTo('', 'user', variant.id, variant.revision, projectA), /source-changed/);
  await assert.rejects(access(join(projectB, '.dsh')));
}));

test('owned DSH skills expose a deletion token and deletion restores discovery imports', async () => importedFixture(async ({ app, entry, source, target }) => {
  const variant = entry.variants[0];
  await app.policy.addSkill('', 'user', variant.id, 'copy', variant.revision);
  const detail = await app.policy.read('', 'user', 'guide');
  assert.equal(detail.deletion.path, target);
  assert.equal(detail.deletion.linked, false);
  const after = await app.policy.deleteSkill('', 'user', 'guide', detail.deletion.revision);
  assert.ok(!after.skills.some(skill => skill.name === 'guide'));
  await assert.rejects(access(target));
  assert.equal(await readFile(join(source, 'SKILL.md'), 'utf8'), '---\nname: guide\ndescription: Guide instructions\n---\nOriginal guide');
  assert.equal((await app.policy.discoverExternalSkills('', 'user')).entries[0].available, false);
}));

test('native skill details resolve a linked file target without requiring deletion access', async () => importedFixture(async ({ app, entry, source, target }) => {
  const variant = entry.variants[0];
  await app.policy.addSkill('', 'user', variant.id, 'link', variant.revision);
  const detail = await app.policy.read('', 'user', 'guide');
  assert.equal(detail.path, join(target, 'SKILL.md'));
  assert.equal(detail.linkTarget, await realpath(join(source, 'SKILL.md')));
  app.native.push({ name: 'shared-guide', description: 'Read-only linked skill', source: 'user-agents', provider: 'filesystem',
    path: join(target, 'SKILL.md'), content: 'Instructions', invocation: { modelInvocable: true, userInvocable: true } });
  const shared = await app.policy.read('', 'user', 'shared-guide');
  assert.equal(shared.deletion, undefined);
  assert.equal(shared.linkTarget, detail.linkTarget);
}));

test('deleting a disabled project skill removes only its own policy and keeps the global copy', async () => importedFixture(async ({ app, entry, target, projectA, projectB }) => {
  const variant = entry.variants[0];
  await app.policy.addSkill('', 'user', variant.id, 'copy', variant.revision);
  await app.policy.importSkillTo('', 'user', variant.id, variant.revision, projectA);
  await app.policy.setEnabled('', 'user', 'guide', false);
  await app.policy.setEnabled(projectA, 'project', 'guide', false);
  const detail = await app.policy.read(projectA, 'project', 'guide');
  assert.ok(detail.deletion);
  await app.policy.deleteSkill(projectA, 'project', 'guide', detail.deletion.revision);
  assert.ok(!app.raw.disabledSkills.some(skill => skill.scope === 'project' && skill.name === 'guide'));
  assert.ok(app.raw.disabledSkills.some(skill => skill.scope === 'user' && skill.name === 'guide'));
  assert.equal(app.raw.showVersion, true);
  assert.equal(app.raw.personalizationEnabled, true);
  await access(join(target, 'SKILL.md'));
  await assert.rejects(access(join(projectA, '.dsh', 'skills', 'guide')));
  await assert.rejects(access(join(projectB, '.dsh')));
}));

test('delete refuses stale content, incomplete catalogs, removed projects and bundled sources', async () => importedFixture(async ({ app, entry, target, projectA }) => {
  const variant = entry.variants[0];
  await app.policy.addSkill('', 'user', variant.id, 'copy', variant.revision);
  const detail = await app.policy.read('', 'user', 'guide');
  await writeFile(join(target, 'new.txt'), 'New local instructions');
  await assert.rejects(app.policy.deleteSkill('', 'user', 'guide', detail.deletion.revision), /changed/);
  app.setComplete(false);
  assert.equal((await app.policy.read('', 'user', 'guide')).deletion, undefined);
  await assert.rejects(app.policy.deleteSkill('', 'user', 'guide', detail.deletion.revision), /unavailable/);
  app.setComplete(true);
  app.ctx.workspaceRegistry.list = () => [];
  await assert.rejects(app.policy.deleteSkill(projectA, 'project', 'guide', detail.deletion.revision), /no longer available/);
  app.policy.registry.snapshot = async () => ({ complete: true, skills: [{ name: 'guide', description: 'Shared',
    source: 'bundled', provider: 'filesystem', path: join(target, 'SKILL.md'), invocation: { modelInvocable: true, userInvocable: true } }] });
  assert.equal((await app.policy.read('', 'user', 'guide')).deletion, undefined);
  await assert.rejects(app.policy.deleteSkill('', 'user', 'guide', detail.deletion.revision), /changed/);
  await access(join(target, 'SKILL.md'));
}));

async function localDeletionFixture(source, run) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'power-dsh-shared-delete-')));
  const project = join(directory, 'project');
  const root = source === 'custom' ? join(directory, 'custom') : source.startsWith('project-')
    ? join(project, source === 'project-dsh' ? '.dsh' : '.agents', 'skills') : join(directory, '.agents', 'skills');
  const bundle = join(root, 'shared-guide');
  await mkdir(bundle, { recursive: true });
  await writeFile(join(bundle, 'SKILL.md'), 'Shared guide instructions');
  const app = fixture({ profileHome: join(directory, '.dsh') });
  app.ctx.workspaceRegistry.list = () => [{ path: project, title: 'Project' }];
  app.markers.add(join(project, '.git'));
  const entry = { name: 'shared-guide', description: 'Shared guide', source, provider: 'filesystem',
    path: join(bundle, 'SKILL.md'), invocation: { modelInvocable: true, userInvocable: true } };
  const nativeSnapshot = app.policy.registry.snapshot;
  app.policy.registry.snapshot = async options => {
    const snapshot = await nativeSnapshot(options);
    if (!source.startsWith('project-') || options.cwd === project) {
      try { await access(entry.path); snapshot.skills.push({ ...entry }); } catch {}
    }
    return snapshot;
  };
  app.policy.registry.get = async () => ({ content: await readFile(entry.path, 'utf8') });
  try { await run({ app, entry, directory, project, root, bundle, cwd: source.startsWith('project-') ? project : '', scope: source.startsWith('project-') ? 'project' : 'user' }); }
  finally { await app.policy.close(); await rm(directory, { recursive: true, force: true }); }
}

test('global shared, project shared and custom native skills expose deletion and remove exactly the displayed bundle', async () => {
  for (const source of ['user-agents', 'project-agents', 'project-dsh', 'custom']) {
    await localDeletionFixture(source, async ({ app, entry, root, bundle, cwd, scope }) => {
      await writeFile(join(root, 'keep.md'), 'Keep another skill');
      const detail = await app.policy.read(cwd, scope, entry.name);
      assert.equal(detail.deletion.path, bundle);
      const after = await app.policy.deleteSkill(cwd, scope, entry.name, detail.deletion.revision);
      assert.equal(after.skills.some(skill => skill.name === entry.name), false);
      await assert.rejects(access(bundle));
      assert.equal(await readFile(join(root, 'keep.md'), 'utf8'), 'Keep another skill');
    });
  }
});

test('shared skill links only unlink the selected entry and source changes invalidate confirmation', async () => localDeletionFixture('user-agents', async ({ app, entry, directory, bundle }) => {
  const target = join(directory, 'original');
  await rename(bundle, target);
  await symlink(target, bundle, process.platform === 'win32' ? 'junction' : 'dir');
  const detail = await app.policy.read('', 'user', entry.name);
  assert.equal(detail.deletion.linked, true);
  entry.source = 'custom';
  await assert.rejects(app.policy.deleteSkill('', 'user', entry.name, detail.deletion.revision), /changed/);
  const custom = await app.policy.read('', 'user', entry.name);
  await app.policy.deleteSkill('', 'user', entry.name, custom.deletion.revision);
  assert.equal(await readFile(join(target, 'SKILL.md'), 'utf8'), 'Shared guide instructions');
}));

test('custom flat Markdown skills delete just the displayed file', async () => localDeletionFixture('custom', async ({ app, entry, root, bundle }) => {
  entry.path = join(root, `${entry.name}.md`);
  await writeFile(entry.path, 'Flat guide instructions');
  const detail = await app.policy.read('', 'user', entry.name);
  assert.equal(detail.deletion.path, entry.path);
  await app.policy.deleteSkill('', 'user', entry.name, detail.deletion.revision);
  await assert.rejects(access(entry.path));
  assert.equal(await readFile(join(bundle, 'SKILL.md'), 'utf8'), 'Shared guide instructions');
}));

test('bundled, runtime, plugin and unknown native sources never expose filesystem deletion', async () => {
  for (const source of ['bundled', 'runtime', 'plugin', 'bundled-office', 'unknown']) {
    await localDeletionFixture(source, async ({ app, entry, bundle }) => {
      assert.equal((await app.policy.read('', 'user', entry.name)).deletion, undefined);
      await assert.rejects(app.policy.deleteSkill('', 'user', entry.name, 'a'.repeat(64)), /changed/);
      await access(bundle);
    });
  }
});

test('project shared roots through a symlink remain read-only, and another project cannot reuse a deletion token', async () => localDeletionFixture('project-agents', async ({ app, entry, directory, project, root }) => {
  const detail = await app.policy.read(project, 'project', entry.name);
  const other = join(directory, 'other-project');
  await mkdir(other);
  app.ctx.workspaceRegistry.list = () => [{ path: project, title: 'Project' }, { path: other, title: 'Other' }];
  app.markers.add(join(other, '.git'));
  await assert.rejects(app.policy.deleteSkill(other, 'project', entry.name, detail.deletion.revision), /unavailable/);
  const shared = join(directory, 'shared-root');
  await rename(root, shared);
  await symlink(shared, root, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await app.policy.read(project, 'project', entry.name)).deletion, undefined);
  await assert.rejects(app.policy.deleteSkill(project, 'project', entry.name, detail.deletion.revision), /changed/);
  await access(join(shared, entry.name, 'SKILL.md'));
}));

test('a rejected policy write restores the skill and retains its disabled state', async () => importedFixture(async ({ app, entry, target }) => {
  const variant = entry.variants[0];
  await app.policy.addSkill('', 'user', variant.id, 'copy', variant.revision);
  await app.policy.setEnabled('', 'user', 'guide', false);
  const detail = await app.policy.read('', 'user', 'guide');
  app.setRejectWrite(true);
  await assert.rejects(app.policy.deleteSkill('', 'user', 'guide', detail.deletion.revision), /Write rejected/);
  await access(join(target, 'SKILL.md'));
  assert.equal(row(await app.policy.list(), 'guide').enabled, false);
  assert.equal((await app.policy.read('', 'user', 'guide')).deletion.revision, detail.deletion.revision);
}));
