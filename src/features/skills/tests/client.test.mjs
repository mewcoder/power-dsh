import assert from 'node:assert/strict';
import { test } from 'node:test';
import { skillFixture, catalogFixture, mount, button, descendants, skillsPage } from '../../../../tests/helpers/client-fixture.mjs';

const settle = () => new Promise(resolve => setImmediate(resolve));
const refreshSkills = page => page.render().find(node => node.props['aria-label'] === 'skillRefresh');
async function confirmDestination(page) {
  await settle();
  const confirm = descendants(page.dialog()).find(node => node.props.className === 'power-dsh-confirm-import');
  assert.ok(confirm);
  assert.equal(confirm.props.disabled, false);
  confirm.props.onClick();
  await settle();
}
const groupCount = section => descendants(section).find(node => node.props.className === 'power-dsh-skill-group-count')?.props.children[0];
function expandWorkspaceGroups(page) {
  for (const group of page.render().filter(node => node.props['data-workspace'])) {
    const toggle = descendants(group).find(node => node.props['aria-controls']);
    if (!toggle.props['aria-expanded']) toggle.props.onClick();
  }
}

test('skill loading keeps the previous catalog only for a compact refresh in the same context', async () => {
  let reply = Promise.withResolvers();
  const detailReply = Promise.withResolvers();
  const app = await mount({ featureIds: ['skills'], skillList: () => reply.promise, skillDetailReply: () => detailReply.promise });
  app.set({ skillManagerEnabled: true });
  const render = () => descendants(app.renderSkills());
  const panel = () => render().find(node => node.props.role === 'tabpanel');
  const loading = () => render().find(node => node.props.className === 'power-dsh-loading');
  assert.equal(loading().props.role, 'status');
  assert.equal(loading().props['data-compact'], undefined);
  assert.ok(descendants(loading()).some(node => node.type === 'native-state-dot-fixture' && node.props.state === 'ongoing'));
  assert.ok(descendants(panel()).some(node => node.props.className === 'power-dsh-loading'));
  reply.resolve({ ok: true, value: catalogFixture() });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(loading(), undefined);
  reply = Promise.withResolvers();
  const refresh = app.reloadSkills();
  assert.equal(loading().props['data-compact'], true);
  const content = descendants(panel());
  assert.ok(content.some(node => node.props.type === 'search'));
  assert.ok(content.findIndex(node => node.props.type === 'search') < content.findIndex(node => node.props.className === 'power-dsh-loading'));
  assert.ok(render().some(node => node.props['data-skill'] === 'code-review'));
  reply.resolve({ ok: true, value: catalogFixture() });
  await refresh;
  render().find(node => node.props['data-detail'] === 'code-review').props.onClick({ currentTarget: null });
  const detailLoading = loading();
  assert.equal(detailLoading.props['data-compact'], undefined);
  assert.ok(descendants(detailLoading).some(node => node.props.children.includes('skillDetailLoading')));
  render().find(node => node.type === 'native-modal-fixture').props.onClose();
  reply = Promise.withResolvers();
  const changeContext = app.reloadSkills('/work/a', 'project');
  assert.equal(loading().props['data-compact'], undefined);
  assert.ok(!render().some(node => node.props['data-skill'] === 'code-review'));
  reply.resolve({ ok: true, value: catalogFixture({ cwd: '/work/a', scope: 'project' }) });
  await changeContext;
  assert.equal(loading(), undefined);
  reply = Promise.withResolvers();
  const failedRefresh = app.reloadSkills();
  reply.resolve({ ok: false, error: { message: 'Could not read skills' } });
  await failedRefresh;
  assert.ok(descendants(panel()).some(node => node.props['data-error-code'] === 'PD-SKILLS-LOAD'));
  assert.deepEqual(app.skillWrites, []);
  app.unmount();
});

test('the skill management switch controls only its own native page and icon and cleans subscriptions', async () => {
  const app = await mount();
  const section = 'settings.section:power-dsh-skills';
  const icon = 'settings.section.icon:power-dsh-skills';
  const baseline = app.entries.size;
  const subscriptions = app.subscriptions();
  assert.ok(!app.entries.has(section));
  assert.ok(!app.entries.has(icon));
  for (let index = 0; index < 3; index++) {
    app.set({ skillManagerEnabled: true });
    const entry = app.entries.get(section);
    assert.equal(entry.options.label(), 'skillsTab');
    assert.ok(app.entries.has(icon));
    app.set({ showVersion: true });
    assert.equal(app.entries.get(section), entry);
    assert.equal(app.entries.size, baseline + 2);
    app.set({ skillManagerEnabled: false });
    assert.ok(!app.entries.has(section));
    assert.ok(!app.entries.has(icon));
      assert.equal(app.entries.size, baseline);
    assert.equal(app.subscriptions(), subscriptions);
  }
  app.set({ skillManagerEnabled: true, personalizationEnabled: true });
  app.renderSkills();
  assert.equal(app.focusSubscriptions(), 1);
  app.unmount();
  assert.equal(app.subscriptions(), 0);
  assert.equal(app.focusSubscriptions(), 0);
  assert.ok(!app.entries.has(section));
  assert.ok(!app.entries.has(icon));
  assert.deepEqual(app.skillWrites, []);
});

test('skill management requests real scopes, keeps full hover text and searches without source selectors', async () => {
  const app = await mount({ skillCatalog: catalogFixture({ skills: [
    skillFixture(),
    skillFixture({ name: 'project-style', description: '项目文案规范', source: 'project-agents', enabled: false, modelInvocable: false, userInvocable: false }),
    skillFixture({ name: 'source-disabled', source: 'runtime', enabled: false, modelInvocable: false, userInvocable: false, canToggle: false, reason: 'source-disabled' }),
    skillFixture({ name: 'remote-style', source: 'remote-provider', description: 'Remote instructions' }),
    skillFixture({ name: 'custom-style', source: 'custom', origin: '.agents', path: '/user/.agents/skills/custom-style/SKILL.md' }),
    skillFixture({ name: 'bundled-style', source: 'bundled', origin: '@deepseek-ai/dsh-skill-office' }),
  ] }) });
  const page = await skillsPage(app);
  assert.equal(page.render().filter(node => node.type === 'li').length, 5);
  assert.ok(page.render().some(node => node.type === 'h2' && node.props.children.includes('skillsTab')));
  assert.ok(page.render().some(node => node.type === 'p' && node.props.children.includes('skillsDescription')));
  assert.ok(page.render().some(node => node.props.className === 'power-dsh-skill-scope-help' && node.props['aria-label'] === 'skillScopeHint'));
  assert.ok(page.render().some(node => node.type === 'native-tooltip-fixture' && node.props.label === 'skillScopeHint'));
  assert.ok(!page.render().some(node => node.props['aria-label'] === 'skillDirectoryHelp' || node.props.label === 'skillDirectoryHint'));
  assert.equal(page.tab('user').props['aria-selected'], true);
  assert.equal(page.projectTrigger(), undefined);
  assert.equal(page.select('skillPreset'), undefined);
  assert.equal(page.control('code-review').props['aria-checked'], true);
  const reviewDescription = descendants(page.row('code-review')).find(node => node.props.id?.endsWith('-description'));
  assert.equal(reviewDescription.props.title, undefined);
  assert.equal(reviewDescription.props.tabIndex, 0);
  const reviewTooltip = descendants(page.row('code-review')).find(node => node.type === 'native-tooltip-fixture' && node.props.label === 'Review code and boundary cases');
  assert.ok(reviewTooltip);
  assert.equal(reviewTooltip.props.portal, true);
  assert.equal(reviewTooltip.props.delayMs, 0);
  assert.equal(page.row('project-style'), undefined);
  assert.equal(page.control('source-disabled').props.disabled, true);
  assert.ok(descendants(page.row('source-disabled')).some(node => node.props.children.includes('skillSourceDisabled')));
  // The card footer no longer carries a source label; that moved into the detail dialog.
  for (const name of ['code-review', 'custom-style', 'bundled-style']) {
    assert.equal(descendants(page.row(name)).find(node => node.props.className === 'power-dsh-skill-origin'), undefined);
    assert.ok(page.detail(name), 'Every card keeps a detail action.');
  }
  assert.equal(page.select('skillSources'), undefined);
  for (const name of ['code-review', 'custom-style', 'remote-style', 'source-disabled', 'bundled-style']) {
    assert.ok(!descendants(page.row(name)).some(node => node.props.children.includes('skillPersonalSource') || node.props.children.includes('skillBundledSource')));
    // One switch plus one read-only detail action; no disclosure control.
    const buttons = descendants(page.row(name)).filter(node => node.type === 'button');
    assert.equal(buttons.filter(node => node.props.role === 'switch').length, 1);
    assert.equal(buttons.filter(node => node.props['data-detail']).length, 1);
    assert.ok(buttons.every(node => node.props.role === 'switch' || node.props['data-detail']));
    assert.ok(!descendants(page.row(name)).some(node => node.props['aria-expanded'] !== undefined));
  }
  page.search().props.onChange({ target: { value: 'Remote instructions' } });
  assert.ok(page.row('remote-style'));
  assert.equal(page.row('code-review'), undefined);
  page.search().props.onChange({ target: { value: '' } });
  page.search().props.onChange({ target: { value: 'skillBundledSource' } });
  assert.equal(page.render().filter(node => node.type === 'li').length, 2);
  assert.ok(page.row('source-disabled'));
  assert.ok(page.row('bundled-style'));
  page.search().props.onChange({ target: { value: '' } });
  const reads = app.skillReads.length;
  await page.tab('project').props.onClick();
  page.render();
  await settle();
  assert.equal(app.skillReads.length, reads + 2);
  assert.equal(app.skillReads.at(-1).scope, 'project');
  assert.equal(page.tab('project').props['aria-selected'], true);
  assert.equal(page.select('skillSources'), undefined);
  expandWorkspaceGroups(page);
  assert.equal(page.render().filter(node => node.type === 'li').length, 2);
  assert.equal(page.row('code-review'), undefined);
  assert.equal(page.control('project-style').props['aria-checked'], false);
  assert.equal(page.projectMenu(), undefined);
  assert.equal(groupCount(page.workspace('/work/a')), 1);
  assert.equal(groupCount(page.workspace('/work/b')), 1);
  assert.ok(!page.render().some(node => node.props.className === 'power-dsh-skill-group-description'));
  assert.equal(page.select('skillPreset'), undefined);
  page.search().props.onChange({ target: { value: '文案' } });
  assert.ok(page.row('project-style'));
  assert.deepEqual(app.skillWrites, []);
  app.unmount();
});

test('a catalog with only built-in skills starts expanded and respects later manual collapse', async () => {
  const app = await mount({ skillCatalog: catalogFixture({ skills: [
    skillFixture({ name: 'bundled-skill', source: 'bundled' }),
    skillFixture({ name: 'runtime-skill', source: 'runtime' }),
  ] }) });
  const page = await skillsPage(app);
  const group = () => page.render().find(node => node.props.id === 'settings-test-group-preinstalled');
  assert.equal(group().props['aria-expanded'], true);
  assert.ok(page.row('bundled-skill'));
  assert.ok(page.row('runtime-skill'));
  assert.ok(!page.render().some(node => node.props.id === 'settings-test-group-personal'));
  group().props.onClick();
  assert.equal(group().props['aria-expanded'], false);
  assert.equal(page.row('bundled-skill'), undefined);
  await app.reloadSkills();
  assert.equal(group().props['aria-expanded'], false, 'Refreshing does not override an explicit collapse.');
  page.search().props.onChange({ target: { value: 'bundled-skill' } });
  assert.ok(page.row('bundled-skill'));
  page.search().props.onChange({ target: { value: '' } });
  assert.equal(group().props['aria-expanded'], false, 'Clearing search restores the manual choice.');
  group().props.onClick();
  assert.ok(page.row('runtime-skill'));
  assert.deepEqual(app.skillWrites, []);
  app.unmount();
});

test('native skill groups collapse locally, search reveals matching groups and clearing restores manual choices', async () => {
  const app = await mount({ skillCatalog: catalogFixture({ skills: [
    skillFixture({ name: 'preinstalled-skill', source: 'bundled' }),
    skillFixture({ name: 'personal-skill', source: 'user-dsh' }),
  ] }) });
  app.set({ skillManagerEnabled: true });
  app.renderSkills();
  await app.reloadSkills();
  const render = () => descendants(app.renderSkills());
  const group = name => render().find(node => node.type === 'button' && node.props.id === `settings-test-group-${name}`);
  const card = name => render().find(node => node.type === 'li' && node.props['data-skill'] === name);
  const search = () => render().find(node => node.type === 'input' && node.props.type === 'search');
  assert.equal(group('preinstalled').props['aria-expanded'], false);
  assert.equal(group('personal').props['aria-expanded'], true);
  assert.equal(groupCount(group('personal')), 1);
  assert.ok(!render().some(node => node.props.className === 'power-dsh-skill-group-description'));
  assert.deepEqual(render().filter(node => node.type === 'button' && node.props.id?.startsWith('settings-test-group-')).map(node => node.props.id), [
    'settings-test-group-personal', 'settings-test-group-preinstalled',
  ]);
  assert.ok(card('personal-skill'));
  assert.equal(card('preinstalled-skill'), undefined);
  assert.equal(render().filter(node => node.props.role === 'switch').length, 1);
  const reads = app.skillReads.length;
  group('personal').props.onClick();
  assert.equal(card('personal-skill'), undefined);
  assert.ok(!render().some(node => node.props.role === 'switch'));
  search().props.onChange({ target: { value: 'personal-skill' } });
  assert.equal(group('preinstalled'), undefined);
  assert.equal(group('personal').props['aria-expanded'], true);
  assert.ok(card('personal-skill'));
  assert.ok(descendants(card('personal-skill')).some(node => node.props.role === 'switch'));
  assert.ok(!descendants(card('personal-skill')).some(node => node.props['aria-expanded'] !== undefined));
  search().props.onChange({ target: { value: '' } });
  assert.equal(group('preinstalled').props['aria-expanded'], false);
  assert.equal(group('personal').props['aria-expanded'], false);
  assert.equal(card('personal-skill'), undefined);
  assert.deepEqual(app.skillWrites, []);
  assert.equal(app.skillReads.length, reads);
  app.unmount();
});

test('the skills page never shows a load failure as an empty catalog and disables incomplete or read-only writes', async () => {
  const failed = await mount({ skillReadError: 'Skill catalog unavailable' });
  const bad = await skillsPage(failed);
  assert.ok(bad.render().some(node => node.props.role === 'alert'));
  assert.ok(!bad.render().some(node => node.props.children.includes('skillEmpty')));
  assert.ok(!bad.render().some(node => node.props.role === 'switch'));
  failed.unmount();
  const partial = await mount({ skillCatalog: catalogFixture({ complete: false }) });
  const incomplete = await skillsPage(partial);
  assert.equal(incomplete.control('code-review').props.disabled, true);
  await incomplete.control('code-review').props.onClick();
  assert.deepEqual(partial.skillWrites, []);
  assert.ok(incomplete.render().some(node => node.props.children.includes('skillIncomplete')));
  partial.unmount();
  const locked = await mount({ writable: false });
  const readOnly = await skillsPage(locked);
  assert.equal(readOnly.control('code-review').props.disabled, true);
  await readOnly.control('code-review').props.onClick();
  assert.deepEqual(locked.skillWrites, []);
  locked.unmount();
});

test('slow skill changes preserve accepted state and block duplicate writes, context changes and focus reloads', async () => {
  const response = Promise.withResolvers();
  const app = await mount({ skillReply: () => response.promise, skillCatalog: catalogFixture({ skills: [skillFixture({ source: 'project-dsh' })] }) });
  const page = await skillsPage(app, 'project');
  expandWorkspaceGroups(page);
  const click = page.control('code-review', '/work/a').props.onClick;
  const action = click();
  assert.equal(page.control('code-review', '/work/a').props['aria-checked'], true);
  assert.equal(page.control('code-review', '/work/a').props['aria-busy'], true);
  assert.equal(page.control('code-review', '/work/a').props.disabled, true);
  assert.equal(page.control('code-review', '/work/b').props.disabled, true);
  assert.equal(page.tab('user').props.disabled, true);
  assert.equal(page.tab('project').props.disabled, true);
  assert.equal(page.select('skillPreset'), undefined);
  const reads = app.skillReads.length;
  page.tab('user').props.onClick();
  assert.equal(page.tab('project').props['aria-selected'], true);
  app.focus();
  await click();
  assert.equal(app.skillReads.length, reads);
  assert.equal(app.skillWrites.length, 1);
  response.resolve({ ok: true, value: catalogFixture({ cwd: '/work/a', scope: 'project', skills: [skillFixture({ source: 'project-dsh', enabled: false, modelInvocable: false, userInvocable: false })] }) });
  await action;
  assert.equal(page.control('code-review', '/work/a').props['aria-checked'], false);
  assert.equal(page.control('code-review', '/work/b').props['aria-checked'], true);
  assert.equal(page.control('code-review', '/work/a').props.disabled, false);
  assert.deepEqual(app.skillWrites[0], { cwd: '/work/a', scope: 'project', name: 'code-review', enabled: false });
  app.unmount();
});

test('a failed skill change reads backend facts again and keeps its row error actionable', async () => {
  const app = await mount({ skillReply: async () => {
    app.setSkills(catalogFixture({ skills: [skillFixture({ enabled: false, modelInvocable: false, userInvocable: false })] }));
    return { ok: false, error: { message: 'Skill change was rejected' } };
  } });
  const page = await skillsPage(app);
  const reads = app.skillReads.length;
  await page.control('code-review').props.onClick();
  assert.equal(app.skillReads.length, reads + 1);
  assert.equal(page.control('code-review').props['aria-checked'], false);
  assert.equal(page.control('code-review').props.disabled, false);
  assert.ok(descendants(page.row('code-review')).some(node => node.props.role === 'alert' && node.props.children.includes('Skill change was rejected')));
  app.unmount();
});

test('workspace loading hides empty project headings and waits for both catalogs before showing an empty result', async () => {
  const installed = Promise.withResolvers();
  const discovered = Promise.withResolvers();
  const app = await mount({ featureIds: ['skills'],
    skillList: (cwd, scope) => scope === 'project' && cwd === '/work/a' ? installed.promise
      : { ok: true, value: catalogFixture({ cwd, scope, skills: [] }) },
    externalSkillList: cwd => cwd === '/work/b' ? discovered.promise
      : { ok: true, value: { complete: true, entries: [] } },
  });
  const page = await skillsPage(app);
  const assertLoading = () => {
    const nodes = page.render();
    assert.ok(!nodes.some(node => node.props['data-workspace']));
    assert.ok(!nodes.some(node => node.props.className === 'power-dsh-skill-empty'));
    assert.equal(nodes.filter(node => node.props.className === 'power-dsh-loading').length, 1);
  };
  page.tab('project').props.onClick();
  assertLoading();
  await settle();
  assertLoading();
  installed.resolve({ ok: true, value: catalogFixture({ cwd: '/work/a', scope: 'project', skills: [] }) });
  await settle();
  assertLoading();
  page.search().props.onChange({ target: { value: 'missing' } });
  assertLoading();
  discovered.resolve({ ok: true, value: { complete: true, entries: [] } });
  await settle();
  const nodes = page.render();
  assert.ok(!nodes.some(node => node.props['data-workspace'] || node.props.className === 'power-dsh-loading'));
  assert.deepEqual(nodes.filter(node => node.props.className === 'power-dsh-skill-empty').map(node => node.props.children[0]), ['skillNoMatches']);
  page.search().props.onChange({ target: { value: '' } });
  assert.deepEqual(page.render().filter(node => node.props.className === 'power-dsh-skill-empty').map(node => node.props.children[0]), ['skillEmpty']);
  app.unmount();
});

test('workspace refresh discards stale reads independently and ignores replies after unload', async () => {
  const old = Promise.withResolvers();
  const latest = Promise.withResolvers();
  const late = Promise.withResolvers();
  let stage = 0;
  const app = await mount({ skillList: (cwd, scope) => {
    if (scope === 'user') return { ok: true, value: catalogFixture() };
    if (cwd === '/work/b') return { ok: true, value: catalogFixture({ cwd, scope, skills: [] }) };
    return stage === 0 ? old.promise : stage === 1 ? latest.promise : late.promise;
  } });
  const page = await skillsPage(app, 'project');
  assert.equal(page.workspace('/work/a'), undefined);
  assert.equal(page.workspace('/work/b'), undefined);
  stage = 1;
  refreshSkills(page).props.onClick();
  await settle();
  latest.resolve({ ok: true, value: catalogFixture({ cwd: '/work/a', scope: 'project', skills: [skillFixture({ name: 'new-context', source: 'project-dsh' })] }) });
  await settle();
  assert.ok(page.row('new-context', '/work/a'));
  old.resolve({ ok: true, value: catalogFixture({ cwd: '/work/a', scope: 'project', skills: [skillFixture({ name: 'old-context' })] }) });
  await settle();
  assert.ok(page.row('new-context', '/work/a'));
  assert.equal(page.row('old-context', '/work/a'), undefined);
  stage = 2;
  refreshSkills(page).props.onClick();
  await settle();
  assert.equal(groupCount(page.workspace('/work/a')), 1);
  assert.ok(page.row('new-context', '/work/a'));
  const source = app.skillsProps().skillsSource;
  app.unmount();
  const before = source.getSnapshot();
  late.resolve({ ok: true, value: catalogFixture() });
  await settle();
  assert.equal(source.getSnapshot(), before);
});

test('workspace groups retain distinct paths, counts and collapse choices across tabs, search and manual refresh', async () => {
  const app = await mount({ skillCatalog: catalogFixture({ workspaces: [
    { path: '/work/a', title: 'Same project' }, { path: '/work/b', title: 'Same project' },
  ], skills: [skillFixture({ source: 'project-dsh' })] }) });
  const page = await skillsPage(app, 'project');
  for (const path of ['/work/a', '/work/b']) {
    const heading = descendants(page.workspaceToggle(path)).find(node => node.props.className === 'power-dsh-skill-group-title');
    assert.equal(heading.props.title, path);
    assert.equal(heading.props.children[0], 'Same project');
    assert.equal(groupCount(page.workspace(path)), 1);
    assert.equal(page.workspaceToggle(path).props['aria-expanded'], true);
    assert.ok(page.row('code-review', path));
  }
  const reads = app.skillReads.length;
  const discoveries = app.externalReads.length;
  page.workspaceToggle('/work/a').props.onClick();
  assert.equal(page.row('code-review', '/work/a'), undefined);
  assert.ok(page.row('code-review', '/work/b'));
  assert.equal(groupCount(page.workspace('/work/a')), 1);
  await page.tab('user').props.onClick();
  await page.tab('project').props.onClick();
  page.render();
  await settle();
  assert.equal(app.skillReads.length, reads);
  assert.equal(page.workspaceToggle('/work/a').props['aria-expanded'], false);
  page.search().props.onChange({ target: { value: 'code-review' } });
  assert.equal(page.workspaceToggle('/work/a').props['aria-expanded'], true);
  assert.equal(groupCount(page.workspace('/work/a')), 1);
  page.search().props.onChange({ target: { value: '' } });
  assert.equal(page.workspaceToggle('/work/a').props['aria-expanded'], false);
  page.render();
  app.focus();
  await settle();
  assert.deepEqual(app.skillReads.slice(reads), []);
  assert.deepEqual(app.externalReads.slice(discoveries), []);
  refreshSkills(page).props.onClick();
  await settle();
  assert.deepEqual(app.skillReads.slice(reads), [{ cwd: '/work/a', scope: 'project' }, { cwd: '/work/b', scope: 'project' }]);
  assert.deepEqual(app.externalReads.slice(discoveries), [{ cwd: '/work/a', scope: 'project' }, { cwd: '/work/b', scope: 'project' }]);
  assert.equal(page.workspaceToggle('/work/a').props['aria-expanded'], false);
  app.unmount();
});

test('the first workspace visit and manual refresh discover registry changes without reading the global catalog', async () => {
  const app = await mount({ featureIds: ['skills'], skillCatalog: catalogFixture({ workspaces: [], skills: [] }) });
  const page = await skillsPage(app);
  assert.equal(app.skillWorkspaceReads, 0);
  const reads = app.skillReads.length;
  app.setSkills(catalogFixture({ workspaces: [{ path: '/work/new', title: 'New project' }],
    skills: [skillFixture({ source: 'project-dsh', targetCwd: '/work/new' })] }));
  page.tab('project').props.onClick();
  assert.ok(!page.render().some(node => node.props.children.includes('skillNoProjects')));
  await settle();
  assert.ok(page.row('code-review', '/work/new'));
  assert.equal(app.skillWorkspaceReads, 1);
  assert.deepEqual(app.skillReads.slice(reads), [{ cwd: '/work/new', scope: 'project' }]);
  app.setSkills(catalogFixture({ workspaces: [], skills: [] }));
  refreshSkills(page).props.onClick();
  await settle();
  assert.equal(page.workspace('/work/new'), undefined);
  assert.ok(page.render().some(node => node.props.children.includes('skillNoProjects')));
  assert.equal(app.skillWorkspaceReads, 2);
  assert.deepEqual(app.skillReads.slice(reads), [{ cwd: '/work/new', scope: 'project' }]);
  app.unmount();
});

test('a failed project read during refresh leaves other project reads independent', async () => {
  let refreshing = false;
  const app = await mount({ featureIds: ['skills'], skillList: (cwd, scope) => {
    if (scope === 'user') return { ok: true, value: catalogFixture({ skills: [] }) };
    if (refreshing && (cwd === '/work/a' || cwd === '')) return { ok: false, error: { message: 'Project A could not be read' } };
    const skills = cwd === '/work/b' ? [skillFixture({ name: refreshing ? 'new-skill' : 'old-skill', source: 'project-dsh' })] : [];
    return { ok: true, value: catalogFixture({ cwd, scope, skills }) };
  } });
  const page = await skillsPage(app, 'project');
  assert.ok(page.row('old-skill', '/work/b'));
  refreshing = true;
  refreshSkills(page).props.onClick();
  await settle();
  assert.ok(descendants(page.workspace('/work/a')).some(node => node.props.role === 'alert'));
  assert.ok(page.row('new-skill', '/work/b'));
  assert.equal(page.row('old-skill', '/work/b'), undefined);
  app.unmount();
});

test('workspace counts follow each project result and search without mixing same-named skills', async () => {
  const app = await mount({ skillList: (cwd, scope) => ({ ok: true, value: catalogFixture({
    cwd, scope, skills: scope === 'user' ? [] : [skillFixture({ source: 'project-dsh' }),
      ...(cwd === '/work/a' ? [skillFixture({ name: 'alpha-only', source: 'project-dsh' })] : [])],
  }) }) });
  const page = await skillsPage(app, 'project');
  assert.equal(groupCount(page.workspace('/work/a')), 2);
  assert.equal(groupCount(page.workspace('/work/b')), 1);
  page.search().props.onChange({ target: { value: 'alpha-only' } });
  assert.equal(groupCount(page.workspace('/work/a')), 1);
  assert.equal(page.workspace('/work/b'), undefined);
  page.search().props.onChange({ target: { value: '' } });
  assert.equal(groupCount(page.workspace('/work/a')), 2);
  assert.equal(groupCount(page.workspace('/work/b')), 1);
  assert.equal(page.projectMenu(), undefined);
  assert.equal(page.projectTrigger(), undefined);
  app.unmount();
});

test('workspace failures remain local and retryable without claiming zero skills', async () => {
  let failed = true;
  const app = await mount({ skillList: (cwd, scope) => {
    if (scope === 'user') return { ok: true, value: catalogFixture() };
    if (cwd === '/work/a' && failed) return { ok: false, error: { message: 'Project could not be read' } };
    return { ok: true, value: catalogFixture({ cwd, scope, skills: [] }) };
  } });
  const page = await skillsPage(app, 'project');
  const failure = descendants(page.workspace('/work/a')).find(node => node.props.role === 'alert');
  assert.ok(failure);
  assert.equal(groupCount(page.workspace('/work/a')), undefined);
  assert.equal(page.workspace('/work/b'), undefined);
  assert.ok(!page.render().some(node => node.props.children.includes('skillEmpty')));
  assert.ok(!descendants(page.workspace('/work/a')).some(node => node.props.children.includes('skillWorkspaceEmpty')));
  failed = false;
  descendants(failure).find(node => node.props['data-native-button'] && node.props.children.includes('retry')).props.onClick();
  await settle();
  assert.equal(page.workspace('/work/a'), undefined);
  assert.equal(page.render().filter(node => node.props.children.includes('skillEmpty')).length, 1);
  assert.ok(!page.render().some(node => node.props.role === 'alert'));
  app.unmount();
  const none = await mount({ skillCatalog: catalogFixture({ workspaces: [], skills: [] }) });
  const empty = await skillsPage(none, 'project');
  assert.equal(empty.projectTrigger(), undefined);
  assert.ok(none.skillReads.every(read => read.scope === 'user'));
  assert.ok(empty.render().some(node => node.type === 'p' && node.props.children.includes('skillNoProjects')));
  assert.ok(!empty.render().some(node => node.props.children.includes('skillEmpty')));
  none.unmount();
});

test('the skill management preference refreshes the Host mirror and reports rejected changes inline', async () => {
  let upgraded = false;
  const writes = [];
  const app = await mount({
    formReply: async (field, value) => { writes.push({ field, value }); return true; },
    formLoad: async () => upgraded ? { skillManagerEnabled: false } : undefined,
  });
  app.set({ skillManagerEnabled: undefined });
  app.selectSettingsTab('management');
  const toggle = () => descendants(app.renderSettings()).find(node => node.props.id === 'settings-test-skillManagerEnabled');
  await toggle().props.onClick();
  assert.deepEqual(writes, []);
  assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes('skillManagerOutdated')));
  upgraded = true;
  await toggle().props.onClick();
  assert.deepEqual(writes, [{ field: 'skillManagerEnabled', value: true }]);
  assert.ok(app.entries.has('settings.section:power-dsh-skills'));
  app.unmount();
});

test('card footers use directory chips and keep built-in package sources as plain text', async () => {
  const builtinSources = ['runtime', 'plugin', 'bundled', 'bundled-office'];
  const app = await mount({ skillCatalog: catalogFixture({ skills: [
    skillFixture({ name: 'from-agents', source: 'user-agents', origin: '.agents', path: '/home/.agents/skills/from-agents/SKILL.md' }),
    skillFixture({ name: 'from-dsh', source: 'user-dsh', origin: '.dsh', path: '/home/.dsh/skills/from-dsh/SKILL.md' }),
    ...builtinSources.map(source => skillFixture({ name: `${source}-style`, source, origin: '@deepseek-ai/dsh-skill-office' })),
  ] }) });
  const page = await skillsPage(app);
  const origin = name => {
    const card = page.render().find(node => node.type === 'li' && node.props['data-skill'] === name);
    return descendants(card).find(node => String(node.props?.className ?? '').includes('power-dsh-skill-card-origin'));
  };
  // The label sits inside the shared Tooltip, so read the text through the tree.
  const text = node => {
    if (node === null || node === undefined) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(text).join('');
    return text(node.props?.children);
  };
  assert.equal(text(origin('from-agents')), '.agents');
  assert.equal(text(origin('from-dsh')), '.dsh');
  for (const name of ['from-agents', 'from-dsh']) {
    assert.ok(descendants(origin(name)).some(node => node.props.className === 'power-dsh-skill-path-label'));
  }
  for (const source of builtinSources) {
    const label = origin(`${source}-style`);
    assert.equal(text(label), '@deepseek-ai/dsh-skill-office');
    assert.ok(!descendants(label).some(node => node.props.className === 'power-dsh-skill-path-stack'));
  }
  app.unmount();
});

test('skill catalog codecs validate every field and discard data outside the public contract', async () => {
  const app = await mount();
  for (const descriptor of app.rpcDescriptors.filter(item => item.method === 'listSkills' || item.method === 'setSkillEnabled')) {
    for (const parameter of descriptor.parameters) {
      const codec = parameter.codec.create();
      assert.throws(() => codec.parse(parameter.name === 'enabled' ? 'false' : false), /boolean|string/);
    }
    const codec = descriptor.result.create();
    const result = codec.parse({ ...catalogFixture(), rawConfig: 'not public', workspaces: [{ path: '/work/a', title: 'Project Alpha', rawConfig: 'private' }], skills: [skillFixture({ env: { SECRET: 'not public' } })] });
    assert.equal('rawConfig' in result, false);
    assert.equal('env' in result.skills[0], false);
    assert.deepEqual(Object.keys(result.workspaces[0]).sort(), ['path', 'title']);
    for (const changed of [{ cwd: null }, { scope: false }, { scope: 'mode' }, { complete: 'true' }, { workspaces: [1] }, { workspaces: [{ path: '/work/a' }] }, { workspaces: [{ path: false, title: 'Invalid' }] }, { skills: [skillFixture({ enabled: 'true' })] }, { skills: [skillFixture({ enabled: false })] }, { skills: [skillFixture({ path: undefined })] }, { skills: [skillFixture({ origin: undefined })] }, { skills: [skillFixture({ origin: false })] }]) {
      assert.throws(() => codec.parse({ ...catalogFixture(), ...changed }), /Invalid skill/);
    }
  }
  app.unmount();
});

function skillDetailText(node) {
  if (node === null || node === undefined || node === false) return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(skillDetailText);
  if (typeof node !== 'object' || node.props?.hidden) return [];
  return skillDetailText(node.props?.children);
}

test('skill detail reads the body on demand and shows description, metadata and instructions', async () => {
  const app = await mount({
    skillCatalog: catalogFixture({ skills: [skillFixture({ description: 'Review code and boundary cases' })] }),
    skillDetail: { content: '# Review\n\nCheck the boundary cases.' },
  });
  const page = await skillsPage(app);
  assert.equal(page.dialog(), undefined);
  assert.equal(app.skillDetailReads.length, 0, 'Opening the page must not read a body.');
  page.detail('code-review').props.onClick({ currentTarget: null });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(page.dialog().props.title, 'skillDetailTitle');
  assert.equal(page.dialog().props.description, 'code-review');
  assert.ok(!descendants(page.dialog()).some(node => node.props.className === 'power-dsh-skill-link'));
  const text = skillDetailText(page.dialog());
  // Description, a short metadata list, then the body.
  assert.ok(text.includes('Review code and boundary cases'));
  // Only the path survives in the metadata block; enablement is the card's switch.
  assert.ok(text.includes('/skills/code-review/SKILL.md'));
  for (const gone of ['skillDetailSource', 'skillDetailEnabled', 'skillDetailModel', 'skillDetailUser']) {
    assert.ok(!text.includes(gone), `The dialog must not repeat ${gone}`);
  }
  assert.ok(!text.includes('skillDetailHeading'), 'The body carries no heading of its own.');
  const body = descendants(page.dialog()).find(node => node.props.className === 'power-dsh-skill-detail-markdown');
  assert.equal(descendants(page.dialog()).find(node => node.props.className === 'power-dsh-skill-detail-body').props.tabIndex, 0, 'The entire reading area can be scrolled with the keyboard.');
  const labels = descendants(page.dialog()).filter(node => node.type === 'dt').flatMap(node => node.props.children);
  assert.deepEqual(labels, ['skillDetailPath', 'skillDetailDescription']);
  const order = descendants(page.dialog()).find(node => node.props.className === 'power-dsh-skill-detail-body')
    .props.children.filter(Boolean).map(node => node.props.className);
  assert.deepEqual(order, ['power-dsh-skill-detail-list', 'power-dsh-skill-detail-markdown']);
  assert.deepEqual(app.skillDetailReads, [{ name: 'code-review' }]);
  assert.deepEqual(app.skillWrites, []);
  // Closing is a view change only; the footer keeps the default close action.
  const close = descendants(page.dialog()).find(node => node.type === 'button' && node.props['data-modal-autofocus']);
  assert.ok(close, 'The detail dialog offers a default close button.');
  assert.ok(close.props.children.includes('close'));
  close.props.onClick();
  assert.equal(page.dialog(), undefined);
  assert.ok(page.row('code-review'));
  app.unmount();
});

test('skill detail delegates document formatting and HTML omission to the public Markdown renderer', async () => {
  const content = '<!-- Licence notice -->\n\n# Review\n\n1. **Check** boundary cases\n\n```js\nconst n = 1;\n```';
  const description = 'A complete description.\nIt can span several lines without being cut off.';
  const app = await mount({ skillCatalog: catalogFixture({ skills: [skillFixture({ description })] }), skillDetail: { content } });
  const page = await skillsPage(app);
  page.detail('code-review').props.onClick({ currentTarget: null });
  await new Promise(resolve => setImmediate(resolve));
  const nodes = descendants(page.dialog());
  const reader = nodes.find(node => node.type === 'native-markdown-fixture');
  assert.ok(reader, 'Use the same public renderer as native document content.');
  assert.equal(reader.props.text, content, 'Pass the complete document to the renderer.');
  assert.equal(reader.props.omitHtml, true);
  assert.equal(reader.props.variant, 'compact');
  assert.equal(reader.props.labels.code.copyLabel, 'skillCopyCode');
  assert.equal(reader.props.labels.code.copiedLabel, 'skillCopiedCode');
  assert.equal(reader.props.labels.footnotes, 'skillFootnotes');
  const intro = nodes.find(node => node.props.className === 'power-dsh-skill-detail-description');
  assert.equal(intro.props.children[0], description);
  assert.equal(intro.props.title, undefined, 'The full introduction is visible without hover.');
  assert.ok(!nodes.some(node => node.type === 'pre'), 'The document is not presented as one code block.');
  app.unmount();
});

test('skill detail omits a missing path while retaining the labelled description', async () => {
  const app = await mount({ skillCatalog: catalogFixture({ skills: [
    skillFixture({ name: 'with-path', path: '/work/.agents/skills/with-path/SKILL.md' }),
    skillFixture({ name: 'no-path', path: '' }),
  ] }) });
  const page = await skillsPage(app);
  page.detail('with-path').props.onClick({ currentTarget: null });
  await new Promise(resolve => setImmediate(resolve));
  const text = skillDetailText(page.dialog());
  assert.ok(text.includes('/work/.agents/skills/with-path/SKILL.md'));
  app.unmount();

  const second = await mount({ skillCatalog: catalogFixture({ skills: [skillFixture({ name: 'no-path', path: '' })] }) });
  const page2 = await skillsPage(second);
  page2.detail('no-path').props.onClick({ currentTarget: null });
  await new Promise(resolve => setImmediate(resolve));
  const labels = descendants(page2.dialog()).filter(node => node.type === 'dt').flatMap(node => node.props.children);
  assert.deepEqual(labels, ['skillDetailDescription']);
  assert.deepEqual(second.skillWrites, []);
  second.unmount();
});

test('skill detail reports a missing body, a read failure and a vanished skill', async () => {
  const app = await mount({
    skillCatalog: catalogFixture({ skills: [skillFixture()] }),
    skillDetailReply: name => name === 'code-review'
      ? { ok: true, value: { name, description: '', content: '', source: 'user-dsh', path: '', origin: '', enabled: true, modelInvocable: true, userInvocable: true } }
      : { ok: true, value: null },
  });
  const page = await skillsPage(app);
  page.detail('code-review').props.onClick({ currentTarget: null });
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(skillDetailText(page.dialog()).includes('skillDetailNoContent'));
  app.unmount();

  const failing = await mount({ skillCatalog: catalogFixture({ skills: [skillFixture()] }), skillDetailError: 'The skill body could not be read.' });
  const page2 = await skillsPage(failing);
  page2.detail('code-review').props.onClick({ currentTarget: null });
  await new Promise(resolve => setImmediate(resolve));
  const failure = descendants(page2.dialog()).find(node => node.props['data-error-code'] === 'PD-SKILLS-DETAIL');
  assert.ok(failure);
  const retry = descendants(failure).find(node => node.props['data-native-button'] && node.props.children.includes('retry'));
  retry.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(failing.skillDetailReads.length, 2);
  failing.unmount();

  const missing = await mount({ skillCatalog: catalogFixture({ skills: [skillFixture()] }), skillDetailReply: () => ({ ok: true, value: null }) });
  const page3 = await skillsPage(missing);
  page3.detail('code-review').props.onClick({ currentTarget: null });
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(skillDetailText(page3.dialog()).includes('skillDetailMissing'));
  assert.deepEqual(missing.skillWrites, []);
  missing.unmount();
});

test('global discovery group lists importable skills and imports one card', async () => {
  const app = await mount({
    featureIds: ['skills'],
    externalSkillCatalog: { complete: true, entries: [
      { id: 'claude-code:code-review:dir', name: 'code-review', description: 'Review code', source: 'Claude Code', path: '/home/.claude/skills/code-review', flat: false },
      { id: 'codex:report:dir', name: 'report', description: 'Write reports', source: 'Codex', path: '/home/.codex/skills/report', flat: false },
    ] },
  });
  app.set({ skillManagerEnabled: true });
  const page = await skillsPage(app);
  await settle();
  page.render();
  assert.deepEqual(app.externalReads, [{ cwd: '', scope: 'user' }]);
  const group = () => page.discoveryGroup();
  assert.ok(group());
  assert.equal(descendants(group()).find(node => node.type === 'button' && node.props['aria-controls']).props['aria-expanded'], false);
  assert.equal(groupCount(group()), 2);
  await page.openDiscovery();
  assert.deepEqual(app.externalReads, [{ cwd: '', scope: 'user' }]);
  assert.equal(groupCount(group()), 2);
  const cards = () => page.render().filter(node => node.type === 'li' && node.props['data-import']);
  assert.equal(cards().length, 2);
  assert.ok(cards().every(card => card.props['data-import-cwd'] === '' && card.props['data-discovered'] === true
    && card.props.className === 'power-dsh-skill-card power-dsh-skill-card-discovered'));
  // The discovery group collapses like the native skill groups do.
  const toggle = () => descendants(group()).find(node => node.type === 'button' && node.props['aria-controls']);
  toggle().props.onClick();
  page.render();
  assert.equal(toggle().props['aria-expanded'], false);
  toggle().props.onClick();
  page.render();
  const rowImport = descendants(cards()[0]).find(node => node.type === 'button' && node.props['data-import-action']);
  await rowImport.props.onClick();
  await settle();
  assert.deepEqual(app.externalImports, []);
  await confirmDestination(page);
  assert.equal(JSON.stringify(app.externalImports), JSON.stringify([{ cwd: '', scope: 'user', ids: ['claude-code:code-review:dir'], mode: 'copy', revision: '', targetCwd: '' }]));
  await settle();
  page.render();
  assert.equal(cards().length, 1, 'Imported skills leave the discovery group');
  assert.ok(page.render().some(node => node.props.className === 'power-dsh-skill-import-notice'));
  assert.ok(!page.render().some(node => node.type === 'button' && node.props.children.includes('skillViewImported')));
  assert.equal(page.tab('user').props['aria-selected'], true);
  app.unmount();
});

test('workspace discovery cards stay in their project group and use the same importable style as global cards', async () => {
  const app = await mount({
    featureIds: ['skills'],
    skillCatalog: catalogFixture({ skills: [skillFixture({ name: 'installed-skill', source: 'project-dsh', targetCwd: '/work/a' })] }),
    externalSkillCatalog: { complete: true, entries: [
      { id: 'claude-code:review:dir', name: 'review', description: 'Review code', source: 'Claude Code', path: '/home/.claude/skills/review', flat: false },
    ] },
  });
  const page = await skillsPage(app, 'project');
  await settle();
  page.render();
  assert.deepEqual(app.externalReads, [
    { cwd: '', scope: 'user' }, { cwd: '/work/a', scope: 'project' }, { cwd: '/work/b', scope: 'project' },
  ]);
  const group = page.workspace('/work/a');
  const lists = descendants(group).filter(node => node.type === 'ul' && node.props.className === 'power-dsh-skill-cards');
  assert.equal(lists.length, 1, 'Installed and discovered cards share one card grid.');
  assert.deepEqual(lists[0].props.children.filter(Boolean).map(node => node.props['data-skill'] ?? node.props['data-import']),
    ['installed-skill', 'review']);
  for (const path of ['/work/a', '/work/b']) {
    const card = page.discovery('review', path);
    assert.ok(card, `Workspace ${path} renders its discovered card`);
    assert.equal(card.props['data-discovered'], true);
    assert.equal(card.props.className, 'power-dsh-skill-card power-dsh-skill-card-discovered');
    const header = descendants(card).find(node => node.props.className === 'power-dsh-skill-card-main');
    const action = descendants(header).find(node => node.props['data-import-action']);
    assert.equal(action.props['data-native-button'], true);
    assert.equal(action.props.variant, 'outline');
    assert.equal(action.props.size, 'sm');
    const footer = descendants(card).find(node => node.props.className === 'power-dsh-skill-card-meta');
    assert.deepEqual(descendants(footer).filter(node => node.type === 'button').map(node => node.props.children[0]), ['skillDetail']);
  }
  app.unmount();
});

test('importing across tabs defers the target catalog and discovery until that tab is opened', async () => {
  const entry = { id: 'codex:report:dir', name: 'report', description: 'Write reports', source: 'Codex',
    path: '/home/.codex/skills/report', flat: false };
  const app = await mount({ featureIds: ['skills'], externalSkillCatalog: { complete: true, entries: [entry] } });
  const page = await skillsPage(app);
  await page.openDiscovery();
  descendants(page.discovery('report')).find(node => node.props['data-import-action']).props.onClick();
  await settle();
  descendants(page.dialog()).find(node => node.type === 'native-menu-fixture').props.onSelect('/work/a');
  await confirmDestination(page);
  assert.equal(app.externalImports[0].targetCwd, '/work/a');
  assert.ok(app.skillReads.every(read => read.scope === 'user'));
  assert.ok(app.externalReads.every(read => read.scope === 'user'));
  page.tab('project').props.onClick();
  page.render();
  await settle();
  assert.ok(page.row('report', '/work/a'));
  assert.equal(page.discovery('report', '/work/a'), undefined);
  app.unmount();
});

test('a discovered skill opens the same detail dialog without importing it', async () => {
  const description = 'Review code and explain boundary cases. '.repeat(12);
  const app = await mount({
    featureIds: ['skills'],
    externalSkillCatalog: { complete: true, entries: [
      { id: 'claude-code:code-review:dir', name: 'code-review', description, source: 'Claude Code', path: '/home/.claude/skills/code-review', flat: false },
    ] },
  });
  app.set({ skillManagerEnabled: true });
  const page = await skillsPage(app);
  await settle();
  page.render();
  await page.openDiscovery();
  const card = page.render().find(node => node.type === 'li' && node.props['data-import'] === 'code-review');
  const tooltip = descendants(card).find(node => node.type === 'native-tooltip-fixture' && node.props.label === description);
  assert.ok(tooltip);
  assert.equal(tooltip.props.portal, true);
  const summary = descendants(tooltip).find(node => node.props.className === 'power-dsh-skill-card-description');
  assert.equal(summary.props.tabIndex, 0);
  assert.equal(summary.props.children[0], description);
  const detailButton = descendants(card).find(node => node.type === 'button' && node.props['data-import-detail'] === 'code-review');
  assert.equal(detailButton.props['aria-haspopup'], 'dialog');
  await detailButton.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(app.externalDetailReads, [{ cwd: '', scope: 'user', id: 'claude-code:code-review:dir' }]);
  const dialog = page.render().find(node => node.props.role === 'dialog');
  assert.ok(dialog, 'The detail dialog opens');
  assert.ok(skillDetailText(dialog).includes(description));
  assert.ok(descendants(dialog).some(node => String(node.props?.className ?? '').includes('power-dsh-skill-detail-markdown')));
  // Reading a source skill never imports it.
  assert.deepEqual(app.externalImports, []);
  const footerButtons = descendants(dialog).filter(node => node.props['data-native-button']);
  assert.deepEqual(footerButtons.map(node => node.props.children[0]), ['skillImportOne', 'close']);
  const close = footerButtons.find(node => node.props['data-modal-autofocus']);
  assert.ok(close, 'The detail dialog offers a default close button.');
  close.props.onClick();
  assert.equal(page.render().some(node => node.props.role === 'dialog'), false);
  app.unmount();
});

test('already present external skills are omitted from discovery in both scopes', async () => {
  const entry = externalEntryFixture({ available: true });
  const global = await mount({
    featureIds: ['skills'],
    externalSkillCatalog: { complete: true, entries: [entry] },
    skillCatalog: catalogFixture({ workspaces: [] }),
  });
  const globalPage = await skillsPage(global);
  await settle();
  globalPage.render();
  assert.equal(globalPage.discoveryGroup(), undefined, 'An empty scan never shows the group');
  assert.equal(globalPage.render().filter(node => node.type === 'li' && node.props['data-import']).length, 0);

  const workspace = await mount({ featureIds: ['skills'], externalSkillCatalog: { complete: true, entries: [entry] } });
  const workspacePage = await skillsPage(workspace, 'project');
  await settle();
  workspacePage.render();
  assert.equal(workspacePage.render().filter(node => node.type === 'li' && node.props['data-import']).length, 0);
  global.unmount();
  workspace.unmount();
});

test('project discovery details and imports keep the clicked project identity during pending operations', async () => {
  const pendingImport = Promise.withResolvers();
  const entry = { id: 'shared-id', name: 'project-helper', description: 'Project instructions', source: 'Cursor', path: '/work/skills/project-helper', flat: false };
  const app = await mount({
    featureIds: ['skills'], externalSkillCatalog: { complete: true, entries: [entry] },
    externalSkillReply: () => pendingImport.promise,
    skillCatalog: catalogFixture({ workspaces: [{ path: '/work/a', title: 'Same name' }, { path: '/work/b', title: 'Same name' }] }),
  });
  const page = await skillsPage(app, 'project');
  await settle();
  page.render();
  const action = (path, attribute) => descendants(page.workspace(path)).find(node => node.props[attribute]);
  await action('/work/b', 'data-import-detail').props.onClick();
  await settle();
  assert.deepEqual(app.externalDetailReads, [{ cwd: '/work/b', scope: 'project', id: entry.id }]);
  const dialog = page.dialog();
  assert.ok(dialog);
  dialog.props.onClose();
  const importClick = action('/work/b', 'data-import-action').props.onClick;
  importClick();
  await confirmDestination(page);
  assert.equal(page.tab('project').props.disabled, true);
  page.tab('project').props.onClick();
  assert.equal(page.tab('project').props['aria-selected'], true);
  assert.equal(action('/work/a', 'data-import-action').props.disabled, true);
  importClick();
  assert.deepEqual(app.externalImports.map(row => ({ ...row, ids: Array.from(row.ids) })), [{ cwd: '/work/b', scope: 'project', ids: [entry.id], mode: 'copy', revision: '', targetCwd: '/work/b' }]);
  pendingImport.resolve({ ok: true, value: { imported: [entry.name], skipped: [] } });
  await settle();
  page.render();
  assert.equal(action('/work/b', 'data-import-action'), undefined);
  assert.equal(action('/work/a', 'data-import-action').props.disabled, false);
  assert.ok(skillDetailText(action('/work/a', 'data-import-action')).includes('skillImportOne'));
  app.unmount();
});

test('global discovery failures stay local and retry without blocking installed skills', async () => {
  let failed = true;
  const entry = { id: 'helper', name: 'helper', description: 'Review changes', source: 'Codex', path: '/skills/helper', flat: false };
  const app = await mount({ featureIds: ['skills'], externalSkillList: cwd => {
    if (cwd !== '') return { ok: true, value: { complete: true, entries: [] } };
    return failed ? { ok: false, error: { message: 'Could not scan user skills' } }
      : { ok: true, value: { complete: true, entries: [entry] } };
  } });
  const page = await skillsPage(app);
  await settle();
  page.render();
  assert.ok(page.row('code-review'), 'Installed skills remain readable');
  const group = () => page.discoveryGroup();
  assert.ok(group());
  assert.equal(descendants(group()).find(node => node.type === 'button' && node.props['aria-controls']).props['aria-expanded'], false);
  await page.openDiscovery();
  assert.ok(descendants(group()).some(node => node.props.role === 'alert'));
  failed = false;
  descendants(group()).find(node => node.props['data-native-button'] && node.props.children.includes('retry')).props.onClick();
  await settle();
  page.render();
  assert.equal(groupCount(group()), 1);
  assert.equal(page.discovery('helper').props['data-import-cwd'], '');
  app.unmount();
});

test('workspace discovery errors stay local to the failed project and retry without a global reload', async () => {
  let failed = true;
  const entry = { id: 'helper', name: 'helper', description: 'Review changes', source: 'Codex', path: '/work/a/.codex/skills/helper', flat: false };
  const app = await mount({ featureIds: ['skills'], externalSkillList: cwd => {
    if (cwd === '/work/b') return failed ? { ok: false, error: { message: 'Could not scan project' } }
      : { ok: true, value: { complete: true, entries: [entry] } };
    if (cwd === '/work/a') return { ok: true, value: { complete: true, entries: [entry] } };
    return { ok: true, value: { complete: true, entries: [] } };
  } });
  const page = await skillsPage(app, 'project');
  await settle();
  page.render();
  assert.ok(page.discovery('helper', '/work/a'));
  assert.ok(!page.discovery('helper', '/work/b'));
  const failure = descendants(page.workspace('/work/b')).find(node => node.props.role === 'alert');
  assert.ok(failure);
  failed = false;
  const reads = app.externalReads.length;
  descendants(failure).find(node => node.props['data-native-button'] && node.props.children.includes('retry')).props.onClick();
  await settle();
  page.render();
  assert.deepEqual(app.externalReads.slice(reads), [{ cwd: '/work/b', scope: 'project' }]);
  assert.ok(page.discovery('helper', '/work/b'));
  app.unmount();
});

test('discovery search filters paths and descriptions in both scopes without rescanning', async () => {
  const helper = { id: 'helper', name: 'helper', description: 'Document changes', source: 'Cursor', path: '/work/a/.cursor/skills/helper', flat: false };
  const review = externalEntryFixture();
  const app = await mount({ featureIds: ['skills'], externalSkillList: cwd => ({ ok: true, value: {
    complete: true, entries: cwd === '' ? [review, helper] : cwd === '/work/a' ? [helper] : [],
  } }) });
  const page = await skillsPage(app);
  await settle();
  page.render();
  const group = () => page.discoveryGroup();
  const toggle = () => descendants(group()).find(node => node.type === 'button' && node.props['aria-controls']);
  await page.openDiscovery();
  assert.equal(groupCount(group()), 2);
  toggle().props.onClick();
  page.render();
  assert.equal(toggle().props['aria-expanded'], false);
  const reads = app.externalReads.length;
  for (const query of [' REVIEW ', 'rEvIeW CoDe', '.CLAUDE', 'first source', 'CLAUDE CODE']) {
    page.search().props.onChange({ target: { value: query } });
    page.render();
    assert.equal(toggle().props['aria-expanded'], true);
    assert.equal(groupCount(group()), 1);
    assert.ok(page.discovery('review'));
  }
  page.search().props.onChange({ target: { value: 'missing-skill' } });
  page.render();
  assert.equal(page.discoveryGroup(), undefined);
  assert.equal(page.render().filter(node => node.props.children.includes('skillNoMatches')).length, 1);
  page.search().props.onChange({ target: { value: '   ' } });
  page.render();
  assert.equal(toggle().props['aria-expanded'], false);
  assert.equal(groupCount(group()), 2);
  page.search().props.onChange({ target: { value: 'DOCUMENT' } });
  page.render();
  assert.equal(groupCount(group()), 1);
  page.tab('project').props.onClick();
  page.render();
  await settle();
  page.render();
  assert.ok(page.discovery('helper', '/work/a'));
  assert.equal(page.discovery('review', '/work/a'), undefined);
  assert.equal(app.externalReads.length, reads + 2);
  app.unmount();
});

test('global loading never flashes an empty group or empty list and refreshes only the visible tab', async () => {
  let discovery = Promise.withResolvers();
  const app = await mount({ featureIds: ['skills'], skillCatalog: catalogFixture({ skills: [] }),
    externalSkillList: cwd => cwd ? { ok: true, value: { complete: true, entries: [] } } : discovery.promise });
  app.set({ skillManagerEnabled: true });
  assert.deepEqual(app.skillReads, []);
  assert.deepEqual(app.externalReads, []);
  const page = await skillsPage(app);
  assert.deepEqual(app.externalReads, [{ cwd: '', scope: 'user' }]);
  assert.ok(app.skillReads.every(read => read.scope === 'user'));
  const assertLoading = () => {
    const nodes = page.render();
    assert.equal(page.discoveryGroup(), undefined);
    assert.ok(!nodes.some(node => node.props.className === 'power-dsh-skill-empty'));
    assert.equal(nodes.filter(node => node.props.className === 'power-dsh-loading').length, 1);
  };
  assertLoading();
  discovery.resolve({ ok: true, value: { complete: true, entries: [] } });
  await settle();
  assert.equal(page.render().filter(node => node.props.className === 'power-dsh-skill-empty').length, 1);
  page.tab('project').props.onClick();
  page.render();
  await settle();
  page.tab('user').props.onClick();
  page.render();
  const reads = app.skillReads.length;
  const discoveries = app.externalReads.length;
  app.focus();
  await settle();
  assert.equal(app.skillReads.length, reads);
  assert.equal(app.externalReads.length, discoveries);
  discovery = Promise.withResolvers();
  const refresh = refreshSkills(page).props.onClick;
  refresh();
  refresh();
  await settle();
  assertLoading();
  assert.equal(refreshSkills(page).props['aria-busy'], true);
  assert.deepEqual(app.skillReads.slice(reads), [{ cwd: '', scope: 'user' }]);
  assert.deepEqual(app.externalReads.slice(discoveries), [{ cwd: '', scope: 'user' }]);
  discovery.resolve({ ok: true, value: { complete: true, entries: [] } });
  await settle();
  assert.equal(page.render().filter(node => node.props.className === 'power-dsh-skill-empty').length, 1);
  app.unmount();
});

test('incomplete discovery catalogs keep their feedback but never claim an empty page', async () => {
  const app = await mount({
    featureIds: ['skills'],
    skillList: (cwd, scope) => ({ ok: true, value: catalogFixture({ cwd, scope, complete: false, skills: [] }) }),
    externalSkillCatalog: { complete: false, entries: [] },
  });
  const page = await skillsPage(app, 'project');
  await settle();
  page.render();
  for (const path of ['/work/a', '/work/b']) {
    assert.ok(page.workspace(path));
    assert.ok(descendants(page.workspace(path)).some(node => node.props.children.includes('skillIncomplete')));
  }
  assert.ok(!page.render().some(node => node.props.children.includes('skillEmpty')));
  page.tab('user').props.onClick();
  page.render();
  await settle();
  page.render();
  assert.ok(page.render().some(node => node.props.children.includes('skillIncomplete')));
  assert.ok(!page.render().some(node => node.props.children.includes('skillEmpty')));
  app.unmount();
});

function externalEntryFixture(overrides = {}) {
  const sources = [
    { agent: 'Claude Code', path: '/home/.claude/skills/review', realPath: '/home/.agents/skills/review', linked: true },
    { agent: 'Codex', path: '/home/.codex/skills/review', realPath: '/home/.agents/skills/review', linked: true },
    { agent: 'Cursor', path: '/home/.cursor/skills/review', realPath: '/home/.agents/skills/review', linked: true },
    { agent: 'Shared directory', path: '/home/.agents/skills/review', realPath: '/home/.agents/skills/review', linked: false },
  ];
  return { id: 'group-review', name: 'review', description: 'Review code', source: 'Claude Code', path: '/home/.agents/skills/review', flat: false,
    variants: [{ id: 'variant-one', description: 'Review from first source', path: sources[0].path, flat: false, revision: 'a'.repeat(64), sources }],
    sources, comparison: 'same', conflict: false, inherited: false, ...overrides };
}

test('multiple source paths share one label and confirm a destination before importing the candidate revision', async () => {
  const entry = externalEntryFixture();
  const app = await mount({ featureIds: ['skills'], externalSkillCatalog: { complete: true, entries: [entry] } });
  const page = await skillsPage(app);
  assert.ok(page.render().some(node => node.props.children.includes('skillsDescription')));
  await settle();
  page.render();
  await page.openDiscovery();
  const card = page.render().find(node => node.props['data-import'] === 'review');
  const origin = descendants(card).find(node => node.props.className === 'power-dsh-skill-card-origin');
  assert.equal(origin.props['data-source-count'], 4);
  assert.equal(descendants(origin).filter(node => node.props.className === 'power-dsh-skill-path-layer').length, 3);
  assert.ok(descendants(origin).some(node => node.props.className === 'power-dsh-skill-path-label' && node.props.children.includes('.claude')));
  const tooltip = descendants(card).find(node => node.type === 'native-tooltip-fixture' && node.props.label.includes(entry.sources[0].path));
  assert.equal(tooltip.props.label, entry.sources.map(source => source.path).join('\n'));
  assert.deepEqual(descendants(card).filter(node => node.type === 'button').map(node => node.props.children[0]), ['skillImportOne', 'skillDetail']);
  const header = descendants(card).find(node => node.props.className === 'power-dsh-skill-card-main');
  const action = descendants(header).find(node => node.props['data-import-action']);
  assert.equal(action.props['data-native-button'], true);
  assert.equal(action.props.variant, 'outline');
  assert.equal(action.props.size, 'sm');
  assert.equal(action.props['aria-label'], 'skillImportOne: review');
  assert.equal(action.props['aria-haspopup'], 'dialog');
  descendants(card).find(node => node.props['data-import-detail']).props.onClick();await settle();
  assert.deepEqual(descendants(page.dialog()).filter(node => node.type === 'dt').flatMap(node => node.props.children), ['skillDetailPath', 'skillDetailDescription']);
  assert.ok(!descendants(page.dialog()).some(node => node.type === 'input' || node.type === 'native-menu-fixture'));
  assert.ok(!skillDetailText(page.dialog()).includes('skillSourcesHint'));
  assert.equal(descendants(page.dialog()).filter(node => node.props.className === 'power-dsh-skill-link').length, 3);
  const linkTip = descendants(page.dialog()).find(node => node.type === 'native-tooltip-fixture' && node.props.label.includes(entry.sources[0].realPath));
  assert.ok(linkTip);
  assert.equal(linkTip.props.portal, true);
  assert.deepEqual(app.externalDetailReads, [{ cwd: '', scope: 'user', id: 'variant-one' }]);
  page.dialog().props.onClose();
  descendants(card).find(node => node.props['data-import-action']).props.onClick();await settle();
  await confirmDestination(page);
  assert.equal(app.externalImports.length, 1);
  assert.equal(app.externalImports[0].ids[0], 'variant-one');
  assert.equal(app.externalImports[0].mode, 'copy');
  assert.equal(app.externalImports[0].revision, 'a'.repeat(64));
  assert.ok(!page.render().some(node => node.props.children.includes('skillViewImported')));
  assert.equal(page.render().find(node => node.props['data-import'] === 'review'), undefined);
  assert.ok(page.row('review'));
  assert.equal(page.search().props.value, '');
  assert.ok(page.row('review'));
  app.unmount();
});

test('source stacks represent every unique path without repeating the directory text', async () => {
  for (const count of [1, 2, 4, 6]) {
    const entry = externalEntryFixture();
    const sources = Array.from({ length: count }, (_, index) => ({
      agent: `Agent ${index}`, path: `/home/.agent-${index}/skills/review`,
      realPath: '/home/.agents/skills/review', linked: true,
    }));
    entry.sources = [...sources, sources[0]];
    entry.variants = [{ ...entry.variants[0], path: sources[0].path, sources: entry.sources }];
    const app = await mount({ featureIds: ['skills'], externalSkillCatalog: { complete: true, entries: [entry] } });
    const page = await skillsPage(app);
    await settle();
    await page.openDiscovery();
    const card = page.render().find(node => node.props['data-import'] === 'review');
    const origin = descendants(card).find(node => node.props.className === 'power-dsh-skill-card-origin');
    assert.equal(origin.props['data-source-count'], count);
    const labels = descendants(origin).filter(node => node.props.className === 'power-dsh-skill-path-label');
    const layers = descendants(origin).filter(node => node.props.className === 'power-dsh-skill-path-layer');
    assert.equal(labels.length, 1);
    assert.deepEqual(labels[0].props.children, ['.agent-0']);
    assert.equal(layers.length + labels.length, count);
    assert.ok(layers.every(node => node.props['aria-hidden'] === true));
    const tooltip = descendants(card).find(node => node.type === 'native-tooltip-fixture' && node.props.label.includes(sources[0].path));
    assert.equal(tooltip.props.label, sources.map(source => source.path).join('\n'));
    app.unmount();
  }
});

test('different contents use a path field choice before confirming the same import action', async () => {
  const entry = externalEntryFixture();
  entry.variants.push({ ...entry.variants[0], id: 'variant-two', revision: 'b'.repeat(64), description: 'Second source', path: '/other/review', sources: [entry.sources[1]] });
  entry.comparison = 'different';
  const app = await mount({ featureIds: ['skills'], externalSkillCatalog: { complete: true, entries: [entry] } });
  const page = await skillsPage(app);await settle();
  page.render();
  await page.openDiscovery();
  page.render().find(node => node.props['data-import-action'] === 'review').props.onClick();await settle();
  assert.deepEqual(app.externalDetailReads, []);
  const add = () => descendants(page.dialog()).find(node => node.props['data-native-button'] && node.props.children.includes('skillImportOne'));
  assert.equal(add().props.disabled, true);
  const menu = descendants(page.dialog()).find(node => node.type === 'native-menu-fixture');
  assert.equal(menu.props.items.length, 2);
  assert.ok(menu.props.items.every(item => item.label.startsWith('/')));
  assert.ok(!descendants(page.dialog()).some(node => node.type === 'input'));
  menu.props.onSelect('variant-two');await settle();
  assert.equal(add().props.disabled, false);
  assert.equal(app.externalDetailReads.at(-1).id, 'variant-two');
  assert.ok(descendants(page.dialog()).some(node => node.type === 'native-markdown-fixture' && node.props.text.includes('variant-two')));
  add().props.onClick();await settle();
  await confirmDestination(page);
  assert.equal(app.externalImports[0].ids[0], 'variant-two');
  assert.equal(app.externalImports[0].revision, 'b'.repeat(64));
  app.unmount();
});

test('identical independent copies only require destination confirmation without a source or mode choice', async () => {
  const entry = externalEntryFixture();
  entry.variants.push({ ...entry.variants[0], id: 'other-copy', path: entry.sources[1].path, sources: [entry.sources[1]] });
  const app = await mount({ featureIds: ['skills'], externalSkillCatalog: { complete: true, entries: [entry] } });
  const page = await skillsPage(app);await settle();
  page.render();
  await page.openDiscovery();
  const card = page.render().find(node => node.props['data-import'] === 'review');
  assert.ok(!descendants(card).some(node => node.type === 'native-menu-fixture'));
  descendants(card).find(node => node.props['data-import-action']).props.onClick();await settle();
  assert.deepEqual(app.externalImports, []);
  assert.equal(descendants(page.dialog()).filter(node => node.type === 'native-menu-fixture').length, 1);
  await confirmDestination(page);
  assert.equal(app.externalImports.length, 1);
  assert.equal(app.externalImports[0].mode, 'copy');
  assert.equal(page.dialog(), undefined);
  assert.deepEqual(app.externalDetailReads, []);
  app.unmount();
});

test('name conflicts retain details with a disabled import and never offer overwrite', async () => {
  const entry = externalEntryFixture({ conflict: true });
  const app = await mount({ featureIds: ['skills'], externalSkillCatalog: { complete: true, entries: [entry] },
    skillCatalog: catalogFixture({ skills: [skillFixture({ name: 'review' })] }),
  });
  const page = await skillsPage(app);await settle();
  page.render();
  await page.openDiscovery();
  const add = page.render().find(node => node.props['data-import-action'] === 'review');
  assert.equal(add.props.disabled, true);
  assert.equal(add.props.title, 'skillNameConflict');
  page.render().find(node => node.props['data-import-detail'] === 'review').props.onClick();await settle();
  assert.ok(skillDetailText(page.dialog()).includes('skillNameConflict'));
  assert.equal(descendants(page.dialog()).find(node => node.props['data-native-button'] && node.props.children.includes('skillImportOne')).props.disabled, true);
  assert.deepEqual(app.externalImports, []);
  app.unmount();
});

test('skill details ignore legacy import metadata and expose only path, description and body', async () => {
  const installation = { mode: 'copy', state: 'source-changed', sourcePath: '/codex/review', realPath: '/codex/review', targetPath: '/dsh/review',
    sources: [], revision: 'confirmation-token', canUpdate: true };
  const value = { ...skillFixture(), content: 'Current DSH instructions', sourceContent: 'Updated source instructions', installation };
  const app = await mount({ featureIds: ['skills'], skillDetailReply: () => ({ ok: true, value }) });
  const page = await skillsPage(app);page.detail('code-review').props.onClick({ currentTarget: null });await settle();
  assert.deepEqual(descendants(page.dialog()).filter(node => node.type === 'dt').flatMap(node => node.props.children), ['skillDetailPath', 'skillDetailDescription']);
  assert.deepEqual(descendants(page.dialog()).filter(node => node.props['data-native-button']).map(node => node.props.children[0]), ['close']);
  assert.deepEqual(descendants(page.dialog()).filter(node => node.type === 'native-markdown-fixture').map(node => node.props.text), ['Current DSH instructions']);
  assert.deepEqual(app.skillWrites, []);
  app.unmount();
});

test('native linked paths show a focusable link icon with the confirmed target', async () => {
  const value = { ...skillFixture(), content: 'Instructions', linkTarget: '/shared/code-review/SKILL.md' };
  const app = await mount({ featureIds: ['skills'], localeLanguage: 'zh', skillDetailReply: () => ({ ok: true, value }) });
  const page = await skillsPage(app);
  page.detail('code-review').props.onClick({ currentTarget: null });await settle();
  const icon = descendants(page.dialog()).find(node => node.props.className === 'power-dsh-skill-link');
  assert.equal(icon.props.tabIndex, 0);
  assert.equal(icon.props['aria-label'], `skillSymbolicLink → ${value.linkTarget}`);
  const tooltip = descendants(page.dialog()).find(node => node.type === 'native-tooltip-fixture' && node.props.label === icon.props['aria-label']);
  assert.equal(tooltip.props.portal, true);
  assert.ok(descendants(page.dialog()).some(node => node.props.className === 'power-dsh-skill-detail-code' && node.props.children.includes(value.path)));
  assert.deepEqual(app.skillWrites, []);
  app.unmount();
});

test('a pending source addition blocks closing, reselection and duplicate writes while failures preserve the choice', async () => {
  const entry = externalEntryFixture();
  entry.variants.push({ ...entry.variants[0], id: 'variant-two', revision: 'b'.repeat(64) });
  entry.comparison = 'different';
  const reply = Promise.withResolvers();
  const app = await mount({ featureIds: ['skills'], externalSkillCatalog: { complete: true, entries: [entry] },
    externalSkillReply: () => reply.promise });
  const page = await skillsPage(app);
  await settle();
  page.render();
  await page.openDiscovery();
  page.render().find(node => node.props['data-import-action'] === 'review').props.onClick();await settle();
  const choice = () => descendants(page.dialog()).find(node => node.type === 'native-menu-fixture');
  choice().props.onSelect('variant-one');await settle();
  const add = descendants(page.dialog()).find(node => node.props['data-native-button'] && node.props.children.includes('skillImportOne'));
  add.props.onClick();
  await settle();
  const targetChoice = () => descendants(page.dialog()).find(node => node.type === 'native-menu-fixture');
  const reselection = targetChoice().props.onSelect;
  const confirm = descendants(page.dialog()).find(node => node.props.className === 'power-dsh-confirm-import');
  confirm.props.onClick();
  const reads = app.externalDetailReads.length;
  page.dialog().props.onClose();
  assert.ok(page.dialog());
  assert.equal(descendants(page.dialog()).find(node => node.props.className === 'power-dsh-skill-target-select').props.disabled, true);
  reselection('/work/b');
  confirm.props.onClick();
  assert.equal(app.externalImports.length, 1);
  assert.equal(app.externalDetailReads.length, reads);
  reply.resolve({ ok: false, error: { message: 'skill-source-changed' } });await settle();
  assert.ok(skillDetailText(page.dialog()).includes('skillStaleSource'));
  assert.equal(targetChoice().props.selectedId, 'user');
  assert.ok(page.render().some(node => node.props['data-import'] === 'review'));
  page.dialog().props.onClose();
  assert.equal(page.dialog(), undefined);
  app.unmount();
});

test('a single path has one directory chip and its details lead to destination confirmation', async () => {
  const entry = externalEntryFixture();
  entry.sources = [entry.sources[1]];
  entry.variants[0] = { ...entry.variants[0], path: entry.sources[0].path, sources: entry.sources };
  const app = await mount({ featureIds: ['skills'], externalSkillCatalog: { complete: true, entries: [entry] } });
  const page = await skillsPage(app);
  await settle();
  page.render();
  await page.openDiscovery();
  const card = page.render().find(node => node.props['data-import'] === 'review');
  const origin = descendants(card).find(node => node.props.className === 'power-dsh-skill-card-origin');
  assert.ok(descendants(origin).some(node => node.props.className === 'power-dsh-skill-path-label' && node.props.children.includes('.codex')));
  assert.equal(origin.props['data-source-count'], 1);
  const stack = descendants(origin).find(node => node.props.className === 'power-dsh-skill-path-stack');
  assert.equal(stack.props.style['--power-dsh-source-layers'], 0);
  assert.equal(descendants(origin).filter(node => node.props.className === 'power-dsh-skill-path-layer').length, 0);
  assert.deepEqual(descendants(card).filter(node => node.type === 'button').map(node => node.props.children[0]), ['skillImportOne', 'skillDetail']);
  descendants(card).find(node => node.props['data-import-detail']).props.onClick();await settle();
  const nodes = descendants(page.dialog());
  assert.ok(!nodes.some(node => node.type === 'input' || node.type === 'native-menu-fixture'));
  assert.equal(nodes.filter(node => node.type === 'code' && node.props.children.includes(entry.sources[0].path)).length, 1);
  assert.deepEqual(nodes.filter(node => node.type === 'dt').flatMap(node => node.props.children), ['skillDetailPath', 'skillDetailDescription']);
  nodes.find(node => node.props['data-native-button'] && node.props.children.includes('skillImportOne')).props.onClick();await settle();
  assert.deepEqual(app.externalImports, []);
  await confirmDestination(page);
  assert.equal(app.externalImports.length, 1);
  assert.equal(app.externalImports[0].mode, 'copy');
  assert.equal(page.dialog(), undefined);
  app.unmount();
});

test('path selection isolates late detail replies and never imports before the selected content arrives', async () => {
  const entry = externalEntryFixture();
  entry.variants.push({ ...entry.variants[0], id: 'variant-two', path: entry.sources[1].path, revision: 'b'.repeat(64) });
  entry.comparison = 'different';
  const first = Promise.withResolvers();
  const second = Promise.withResolvers();
  const app = await mount({ featureIds: ['skills'], externalSkillCatalog: { complete: true, entries: [entry] },
    externalDetailReply: id => id === 'variant-one' ? first.promise : second.promise });
  const page = await skillsPage(app);
  await settle();
  page.render();
  await page.openDiscovery();
  page.render().find(node => node.props['data-import-action'] === 'review').props.onClick();await settle();
  const menu = () => descendants(page.dialog()).find(node => node.type === 'native-menu-fixture');
  menu().props.onSelect('variant-one');
  menu().props.onSelect('variant-two');
  const add = () => descendants(page.dialog()).find(node => node.props['data-native-button'] && node.props.children.includes('skillImportOne'));
  assert.equal(add().props.disabled, true);
  second.resolve({ ok: true, value: { name: entry.name, description: 'Second instructions', path: entry.variants[1].path, source: 'Codex', content: 'Second body' } });await settle();
  assert.equal(add().props.disabled, false);
  first.resolve({ ok: true, value: { name: entry.name, description: 'First instructions', path: entry.variants[0].path, source: 'Claude Code', content: 'First body' } });await settle();
  assert.equal(menu().props.selectedId, 'variant-two');
  assert.deepEqual(descendants(page.dialog()).filter(node => node.type === 'native-markdown-fixture').map(node => node.props.text), ['Second body']);
  assert.deepEqual(app.externalImports, []);
  add().props.onClick();await settle();
  await confirmDestination(page);
  assert.equal(app.externalImports[0].ids[0], 'variant-two');
  app.unmount();
});

test('a workspace discovery import defaults to its project and allows another destination', async () => {
  const entry = externalEntryFixture();
  const app = await mount({ featureIds: ['skills'], externalSkillCatalog: { complete: true, entries: [entry] } });
  const page = await skillsPage(app, 'project');
  await settle();
  page.render();
  const card = cwd => page.discovery(entry.name, cwd);
  descendants(card('/work/a')).find(node => node.props['data-import-action']).props.onClick();
  await settle();
  const menu = () => descendants(page.dialog()).find(node => node.type === 'native-menu-fixture');
  assert.equal(menu().props.selectedId, '/work/a');
  assert.equal(menu().props.items.length, 3);
  assert.ok(skillDetailText(page.dialog()).includes('/work/a/.dsh/skills/review'));
  assert.deepEqual(app.externalImports, []);
  menu().props.onSelect('/work/b');await settle();
  assert.ok(skillDetailText(page.dialog()).includes('/work/b/.dsh/skills/review'));
  await confirmDestination(page);
  assert.equal(app.externalImports[0].cwd, '/work/a');
  assert.equal(app.externalImports[0].targetCwd, '/work/b');
  assert.equal(app.externalImports[0].revision, 'a'.repeat(64));
  assert.equal(page.dialog(), undefined);
  assert.equal(page.tab('project').props['aria-selected'], true);
  await settle();
  page.render();
  assert.equal(card('/work/b'), undefined, 'The target project no longer lists the imported skill as discovered');
  assert.ok(card('/work/a'), 'The source project keeps its discoverable copy');
  assert.ok(page.row('review', '/work/b'), 'The target project now lists the skill as installed');
  assert.equal(page.row('review', '/work/b').props.className, 'power-dsh-skill-card');
  assert.ok(descendants(page.row('review', '/work/b')).some(node => node.props.role === 'switch'));
  assert.ok(!descendants(page.row('review', '/work/b')).some(node => node.props['data-import-action']));
  assert.deepEqual(descendants(page.render().find(node => node.props.className === 'power-dsh-skill-import-notice')).filter(node => node.type === 'button'), []);
  const successTimer = [...app.timers.values()].find(timer => timer.ms === 3000);
  assert.ok(successTimer);
  successTimer.fn();
  assert.ok(!page.render().some(node => node.props.className === 'power-dsh-skill-import-notice'));
  app.unmount();
});

test('destination switching rejects stale replies and confirms neither loading nor occupied targets', async () => {
  const first = Promise.withResolvers();
  const other = Promise.withResolvers();
  const entry = externalEntryFixture();
  const app = await mount({ featureIds: ['skills'], externalSkillCatalog: { complete: true, entries: [entry] },
    importDestinationReply: cwd => cwd === '' ? first.promise : other.promise });
  const page = await skillsPage(app);
  await settle();
  page.render();
  await page.openDiscovery();
  page.render().find(node => node.props['data-import-action'] === entry.name).props.onClick();await settle();
  const menu = () => descendants(page.dialog()).find(node => node.type === 'native-menu-fixture');
  const add = () => descendants(page.dialog()).find(node => node.props.className === 'power-dsh-confirm-import');
  assert.equal(add().props.disabled, true);
  menu().props.onSelect('/work/b');await settle();
  other.resolve({ ok: true, value: { path: '/work/b/.dsh/skills/review', available: true, inherited: false, complete: true } });await settle();
  assert.equal(add(), undefined);
  assert.ok(skillDetailText(page.dialog()).includes('skillChooseOtherTarget'));
  first.resolve({ ok: true, value: { path: '/profile/skills/review', available: false, inherited: false, complete: true } });await settle();
  assert.equal(menu().props.selectedId, '/work/b');
  assert.ok(!skillDetailText(page.dialog()).includes('/profile/skills/review'));
  assert.deepEqual(app.externalImports, []);
  page.dialog().props.onClose();
  assert.equal(page.dialog(), undefined);
  app.unmount();
});

test('a destination read failure preserves the selection and supports retry without writing', async () => {
  let fail = true;
  const entry = externalEntryFixture();
  const app = await mount({ featureIds: ['skills'], externalSkillCatalog: { complete: true, entries: [entry] },
    importDestinationReply: cwd => fail ? { ok: false, error: { message: 'read rejected' } }
      : { ok: true, value: { path: `${cwd}/.dsh/skills/review`, available: false, inherited: false, complete: true } } });
  const page = await skillsPage(app, 'project');
  await settle();
  page.render();
  descendants(page.discovery(entry.name, '/work/a')).find(node => node.props['data-import-action']).props.onClick();
  await settle();
  assert.equal(descendants(page.dialog()).find(node => node.props.className === 'power-dsh-confirm-import').props.disabled, true);
  assert.equal(descendants(page.dialog()).find(node => node.type === 'native-menu-fixture').props.selectedId, '/work/a');
  fail = false;
  descendants(page.dialog()).find(node => node.props['data-native-button'] && node.props.children.includes('retry')).props.onClick();await settle();
  assert.equal(descendants(page.dialog()).find(node => node.props.className === 'power-dsh-confirm-import').props.disabled, false);
  assert.ok(skillDetailText(page.dialog()).includes('/work/a/.dsh/skills/review'));
  assert.deepEqual(app.externalImports, []);
  app.unmount();
});

test('deletion requires the displayed path confirmation and blocks stale, closing and duplicate actions', async () => {
  const reply = Promise.withResolvers();
  const deletion = { path: '/profile/skills/code-review', linked: false, revision: 'c'.repeat(64) };
  const app = await mount({ featureIds: ['skills'], skillCatalog: catalogFixture({ skills: [skillFixture({ deletion })] }), skillReply: () => reply.promise });
  const page = await skillsPage(app);
  page.detail('code-review').props.onClick({ currentTarget: null });await settle();
  assert.deepEqual(descendants(page.dialog()).filter(node => node.props['data-native-button']).map(node => node.props.children[0]), ['skillDelete', 'close']);
  const remove = () => descendants(page.dialog()).find(node => node.props.className === 'power-dsh-skill-delete');
  remove().props.onClick();
  assert.equal(page.dialog().props.title, 'skillDelete');
  assert.deepEqual(descendants(page.dialog()).filter(node => node.props['data-native-button']).map(node => node.props.children[0]), ['cancel', 'skillConfirm']);
  assert.ok(descendants(page.dialog()).find(node => node.props['data-native-button'] && node.props['data-modal-autofocus']).props.children.includes('cancel'));
  assert.ok(skillDetailText(page.dialog()).includes(deletion.path));
  assert.ok(skillDetailText(page.dialog()).includes('skillDeleteHint'));
  assert.deepEqual(app.skillDeletes, []);
  const stale = remove().props.onClick;
  descendants(page.dialog()).find(node => node.props['data-modal-autofocus']).props.onClick();
  stale();
  assert.deepEqual(app.skillDeletes, []);
  assert.equal(page.dialog().props.title, 'skillDetailTitle');
  remove().props.onClick();
  const confirm = remove().props.onClick;
  confirm();
  page.dialog().props.onClose();
  assert.ok(page.dialog());
  assert.equal(page.tab('project').props.disabled, true);
  assert.equal(remove().props.disabled, true);
  confirm();
  assert.equal(app.skillDeletes.length, 1);
  assert.deepEqual(app.skillDeletes[0], { cwd: '', scope: 'user', name: 'code-review', revision: deletion.revision });
  reply.resolve({ ok: true, value: catalogFixture({ skills: [] }) });await settle();
  assert.equal(page.dialog(), undefined);
  assert.equal(page.row('code-review'), undefined);
  app.unmount();
});

test('delete confirmation can select multiple DSH copies of one skill', async () => {
  const deletions = [
    { path: '/profile/skills/code-review', linked: false, revision: 'a'.repeat(64), cwd: '', scope: 'user', workspaceTitle: '' },
    { path: '/work/a/.dsh/skills/code-review', linked: false, revision: 'b'.repeat(64), cwd: '/work/a', scope: 'project', workspaceTitle: 'Project Alpha' },
  ];
  const app = await mount({ featureIds: ['skills'], skillDetailReply: () => ({ ok: true, value: { ...skillFixture(), content: 'Instructions', deletions } }) });
  const page = await skillsPage(app);
  page.detail('code-review').props.onClick({ currentTarget: null });await settle();
  descendants(page.dialog()).find(node => node.props.className === 'power-dsh-skill-delete').props.onClick();
  const dialog = () => page.dialog();
  const checkboxes = () => descendants(dialog()).filter(node => node.type === 'input' && node.props.type === 'checkbox');
  assert.equal(checkboxes().length, 2);
  assert.equal(checkboxes()[0].props.checked, true, 'The current copy is selected by default');
  assert.equal(checkboxes()[1].props.checked, false);
  checkboxes()[1].props.onChange();
  assert.equal(checkboxes()[1].props.checked, true);
  descendants(dialog()).find(node => node.props.className === 'power-dsh-skill-delete' && node.type === 'button').props.onClick();
  await settle();
  assert.deepEqual(app.skillDeletes.map(row => ({ cwd: row.cwd, revision: row.revision })), [
    { cwd: '', revision: 'a'.repeat(64) },
    { cwd: '/work/a', revision: 'b'.repeat(64) },
  ]);
  app.unmount();
});

test('delete failure retains the confirmation and requires refreshed details before another attempt', async () => {
  let revision = 'a'.repeat(64);
  const app = await mount({ featureIds: ['skills'],
    skillDetailReply: () => ({ ok: true, value: { ...skillFixture(), content: 'Instructions', deletion: { path: '/profile/skills/code-review', linked: false, revision } } }),
    skillReply: () => ({ ok: false, error: { message: 'skill-delete-changed' } }) });
  const page = await skillsPage(app);
  page.detail('code-review').props.onClick({ currentTarget: null });await settle();
  const remove = () => descendants(page.dialog()).find(node => node.props.className === 'power-dsh-skill-delete');
  remove().props.onClick();
  remove().props.onClick();await settle();
  assert.ok(skillDetailText(page.dialog()).includes('skillDeleteChanged'));
  assert.equal(remove().props.disabled, true);
  assert.ok(page.row('code-review'));
  revision = 'b'.repeat(64);
  descendants(page.dialog()).find(node => node.props['data-native-button'] && node.props.children.includes('retry')).props.onClick();await settle();
  assert.equal(page.dialog().props.title, 'skillDetailTitle');
  assert.equal(app.skillDeletes.length, 1);
  remove().props.onClick();
  remove().props.onClick();await settle();
  assert.equal(app.skillDeletes[1].revision, revision);
  app.unmount();
});

test('workspace deletion uses its own identity and links clearly preserve the source', async () => {
  const deletion = { path: '/work/b/.agents/skills/code-review', linked: true, revision: 'd'.repeat(64) };
  const app = await mount({ featureIds: ['skills'], skillCatalog: catalogFixture({ skills: [skillFixture(),
    skillFixture({ source: 'project-agents', path: deletion.path + '/SKILL.md', targetCwd: '/work/b', deletion })] }) });
  const page = await skillsPage(app);
  page.tab('project').props.onClick();await settle();
  expandWorkspaceGroups(page);
  await settle();
  const group = page.render().find(node => node.props['data-workspace'] === '/work/b');
  descendants(group).find(node => node.props['data-detail'] === 'code-review').props.onClick({ currentTarget: null });await settle();
  const remove = () => descendants(page.dialog()).find(node => node.props.className === 'power-dsh-skill-delete');
  assert.ok(remove().props.children.includes('skillRemoveLink'));
  remove().props.onClick();
  assert.ok(skillDetailText(page.dialog()).includes('skillRemoveLinkHint'));
  remove().props.onClick();await settle();
  assert.equal(app.skillDeletes[0].cwd, '/work/b');
  assert.equal(app.skillDeletes[0].scope, 'project');
  page.tab('user').props.onClick();await settle();
  assert.ok(page.row('code-review'));
  page.detail('code-review').props.onClick({ currentTarget: null });await settle();
  assert.ok(!descendants(page.dialog()).some(node => node.props.className === 'power-dsh-skill-delete'));
  app.unmount();
});
