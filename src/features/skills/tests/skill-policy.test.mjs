import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SkillPolicy } from '../skill-policy.ts';
import { OperationQueue } from '../../../shared/host/operation-queue.ts';

function fixture({ initial = [], incomplete = false } = {}) {
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
  const markers = new Set(['/workspace/.git', '/other/.git']);
  const native = [
    { name: 'review', description: 'Personal review', source: 'user-dsh', provider: 'filesystem', path: '/user/skills/review/SKILL.md', invocation: { modelInvocable: true, userInvocable: true } },
    { name: 'review', description: 'Review project code', source: 'project-dsh', provider: 'filesystem', path: '/workspace/.dsh/skills/review/SKILL.md', root: '/workspace', invocation: { modelInvocable: true, userInvocable: true } },
    { name: 'review', description: 'Other project review', source: 'project-agents', provider: 'filesystem', path: '/other/.agents/skills/review/SKILL.md', root: '/other', invocation: { modelInvocable: true, userInvocable: true } },
    { name: 'manual', description: 'User-only instructions', source: 'user-agents', provider: 'filesystem', path: '/agents/skills/manual/SKILL.md', invocation: { modelInvocable: false, userInvocable: true } },
    { name: 'blocked-by-author', description: 'Disabled upstream', source: 'runtime', provider: 'runtime', invocation: { modelInvocable: false, userInvocable: false } },
  ];
  const projectOf = cwd => cwd?.startsWith('/workspace/') || cwd === '/workspace' ? '/workspace' : cwd;
  async function snapshot(options = {}) {
    lookups.push(options);
    const rows = new Map();
    const keys = [undefined];
    if (options.scope?.agent) keys.push(options.scope.parent, options.scope);
    else if (options.scope) keys.push(options.scope);
    for (const key of keys) {
      const candidates = generations.has(key) ? native.filter(row => !row.root || options.cwd !== undefined && row.root === projectOf(options.cwd))
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
    assert.equal(view.cwd, '/other');
    assert.deepEqual(view.workspaces, [
      { path: '/other', title: 'Renamed project' }, { path: '/workspace', title: 'Main app' },
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
      ['project', '/workspace', 'review'], ['user', '', 'review'],
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
    assert.equal(await app.policy.projectRoot('/workspace/sub'), '/workspace');
    app.markers.add('/workspace/sub/.git');
    assert.equal(await app.policy.projectRoot('/workspace/sub'), '/workspace/sub');
    assert.equal(await app.policy.projectRoot('/no-git'), '/no-git');
  } finally { await app.policy.close(); }
});
