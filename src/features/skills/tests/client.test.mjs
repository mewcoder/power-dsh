import assert from 'node:assert/strict';
import { test } from 'node:test';
import { skillFixture, catalogFixture, mount, button, descendants, skillsPage } from '../../../../tests/helpers/client-fixture.mjs';

const settle = () => new Promise(resolve => setImmediate(resolve));
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
  const loading = () => render().find(node => node.props.className === 'power-dsh-loading');
  assert.equal(loading().props.role, 'status');
  assert.equal(loading().props['data-compact'], undefined);
  assert.ok(descendants(loading()).some(node => node.type === 'native-state-dot-fixture' && node.props.state === 'ongoing'));
  reply.resolve({ ok: true, value: catalogFixture() });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(loading(), undefined);
  reply = Promise.withResolvers();
  const refresh = app.reloadSkills();
  assert.equal(loading().props['data-compact'], true);
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
  assert.equal(app.focusSubscriptions(), 2);
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
  assert.deepEqual(render().filter(node => node.type === 'button' && /-group-/.test(node.props.id ?? '')).map(node => node.props.id), [
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
  expandWorkspaceGroups(page);
  assert.ok(page.workspace('/work/a'));
  assert.equal(groupCount(page.workspace('/work/a')), undefined);
  assert.equal(page.workspace('/work/b'), undefined);
  stage = 1;
  app.focus();
  await settle();
  latest.resolve({ ok: true, value: catalogFixture({ cwd: '/work/a', scope: 'project', skills: [skillFixture({ name: 'new-context', source: 'project-dsh' })] }) });
  await settle();
  assert.ok(page.row('new-context', '/work/a'));
  old.resolve({ ok: true, value: catalogFixture({ cwd: '/work/a', scope: 'project', skills: [skillFixture({ name: 'old-context' })] }) });
  await settle();
  assert.ok(page.row('new-context', '/work/a'));
  assert.equal(page.row('old-context', '/work/a'), undefined);
  stage = 2;
  app.focus();
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

test('workspace groups retain distinct paths, counts and collapse choices across tabs, search and focus', async () => {
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
  assert.deepEqual(app.skillReads.slice(reads), [{ cwd: '', scope: 'user' }, { cwd: '/work/b', scope: 'project' }]);
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
  app.selectSettingsTab('enhancements');
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

test('each card footer names the skill directory it was loaded from', async () => {
  const app = await mount({ skillCatalog: catalogFixture({ skills: [
    skillFixture({ name: 'from-agents', source: 'user-agents', origin: '.agents', path: '/home/.agents/skills/from-agents/SKILL.md' }),
    skillFixture({ name: 'from-dsh', source: 'user-dsh', origin: '.dsh', path: '/home/.dsh/skills/from-dsh/SKILL.md' }),
    skillFixture({ name: 'bundled-style', source: 'bundled', origin: '@deepseek-ai/dsh-skill-office' }),
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
  // A package-provided skill names its package instead of inventing a directory.
  assert.ok(text(origin('bundled-style')).includes('dsh-skill-office'));
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
  // Closing is a view change only.
  descendants(page.dialog()).find(node => node.props['data-native-button']).props.onClick();
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

test('the discover tab lists global and each project with counts and imports one card', async () => {
  const app = await mount({
    featureIds: ['skills'],
    externalSkillCatalog: { complete: true, entries: [
      { id: 'claude-code:code-review:dir', name: 'code-review', description: 'Review code', source: 'Claude Code', path: '/home/.claude/skills/code-review', flat: false },
      { id: 'codex:report:dir', name: 'report', description: 'Write reports', source: 'Codex', path: '/home/.codex/skills/report', flat: false },
    ] },
  });
  app.set({ skillManagerEnabled: true });
  const page = await skillsPage(app);
  const label = value => String([].concat(value ?? []).join(''));
  await page.tab('sources').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(app.externalReads, [{ cwd: '', scope: 'user' }, { cwd: '/work/a', scope: 'project' }, { cwd: '/work/b', scope: 'project' }]);
  const groups = () => page.render().filter(node => node.type === 'section' && node.props['data-import-group']);
  assert.deepEqual(groups().map(node => node.props['data-import-group']), ['user', 'project', 'project']);
  assert.deepEqual(groups().map(node => node.props['data-import-cwd']), ['', '/work/a', '/work/b']);
  assert.deepEqual(groups().map(groupCount), [2, 2, 2]);
  assert.ok(!page.render().some(node => node.props.className === 'power-dsh-skill-group-description'));
  const cards = () => page.render().filter(node => node.type === 'li' && node.props['data-import']);
  assert.equal(cards().length, 6, 'Each group renders its own discovered skills');
  // Group headers collapse like the skill groups do.
  const toggle = descendants(groups()[0]).find(node => node.type === 'button' && node.props['aria-expanded'] === true);
  toggle.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(descendants(groups()[0]).find(node => node.type === 'button' && node.props['aria-controls']).props['aria-expanded'], false);
  toggle.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  const rowImport = descendants(cards()[0]).find(node => node.type === 'button' && node.props['data-import-action']);
  await rowImport.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(app.externalImports, []);
  await confirmDestination(page);
  assert.equal(JSON.stringify(app.externalImports), JSON.stringify([{ cwd: '', scope: 'user', ids: ['claude-code:code-review:dir'], mode: 'copy', revision: '', targetCwd: '' }]));
  assert.equal(cards().length, 6, 'Imported skills stay visible in their own group');
  assert.deepEqual(groups().map(groupCount), [2, 2, 2]);
  assert.equal(cards()[0].props['data-existing'], true);
  assert.equal(descendants(cards()[0]).find(node => node.props['data-import-action']), undefined);
  assert.ok(descendants(cards()[0]).some(node => node.type === 'span' && node.props.children.includes('skillAlreadyExists')));
  assert.ok(page.render().some(node => node.props.className === 'power-dsh-skill-import-notice'));
  assert.ok(!page.render().some(node => node.type === 'button' && node.props.children.includes('skillViewImported')));
  assert.equal(page.tab('sources').props['aria-selected'], true);
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
  await page.tab('sources').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
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
  const close = descendants(dialog).find(node => node.type === 'button' && node.props['data-modal-autofocus']);
  close.props.onClick();
  assert.equal(page.render().some(node => node.props.role === 'dialog'), false);
  app.unmount();
});

test('existing native skills have a title status, no import button and normal readable details', async () => {
  const entry = externalEntryFixture({ available: true });
  const app = await mount({
    featureIds: ['skills'],
    externalSkillCatalog: { complete: true, entries: [entry] },
    skillCatalog: catalogFixture({ workspaces: [] }),
  });
  app.set({ skillManagerEnabled: true });
  const page = await skillsPage(app);
  await page.tab('sources').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  const card = page.render().find(node => node.props['data-import'] === entry.name);
  assert.equal(card.props['data-existing'], true);
  const heading = descendants(card).find(node => node.props.className === 'power-dsh-skill-card-main');
  assert.ok(descendants(heading).some(node => node.type === 'span' && node.props.children.includes('skillAlreadyExists')));
  assert.ok(!descendants(card).find(node => node.props.className === 'power-dsh-skill-card-meta').props.children.some(node => node?.props?.className === 'power-dsh-skill-existing'));
  const add = descendants(card).find(node => node.props['data-import-action']);
  assert.equal(add, undefined);
  assert.ok(descendants(card).some(node => node.type === 'span' && node.props.children.includes('skillAlreadyExists')));
  assert.deepEqual(app.externalImports, []);
  descendants(card).find(node => node.props['data-import-detail']).props.onClick();await settle();
  assert.ok(page.dialog());
  assert.ok(!descendants(page.dialog()).some(node => node.type === 'button' && node.props.children.includes('skillAlreadyExists')));
  assert.ok(!descendants(page.dialog()).some(node => node.props.children.includes('skillAlreadyExists')));
  page.dialog().props.onClose();
  page.tab('user').props.onClick();
  app.setExternalSkills({ complete: true, entries: [{ ...entry, available: false }] });
  page.tab('sources').props.onClick();await settle();
  assert.equal(page.render().find(node => node.props['data-import'] === entry.name).props['data-existing'], false);
  assert.equal(page.render().find(node => node.props['data-import-action'] === entry.name).props.disabled, false);
  app.unmount();
});

test('project discovery details and imports keep the clicked project identity during pending operations', async () => {
  const pendingImport = Promise.withResolvers();
  const entry = { id: 'shared-id', name: 'project-helper', description: 'Project instructions', source: 'Cursor', path: '/work/skills/project-helper', flat: false };
  const app = await mount({
    featureIds: ['skills'], externalSkillCatalog: { complete: true, entries: [entry] },
    externalSkillReply: () => pendingImport.promise,
    skillCatalog: catalogFixture({ workspaces: [{ path: '/work/a', title: 'Same name' }, { path: '/work/b', title: 'Same name' }] }),
  });
  const page = await skillsPage(app);
  page.tab('sources').props.onClick();
  await settle();
  const group = path => page.render().find(node => node.props['data-import-cwd'] === path);
  const action = (path, attribute) => descendants(group(path)).find(node => node.props[attribute]);
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
  assert.equal(page.tab('sources').props['aria-selected'], true);
  assert.equal(action('/work/a', 'data-import-action').props.disabled, true);
  importClick();
  assert.deepEqual(app.externalImports.map(row => ({ ...row, ids: Array.from(row.ids) })), [{ cwd: '/work/b', scope: 'project', ids: [entry.id], mode: 'copy', revision: '', targetCwd: '/work/b' }]);
  assert.equal(groupCount(group('/work/a')), 1);
  assert.equal(groupCount(group('/work/b')), 1);
  pendingImport.resolve({ ok: true, value: { imported: [entry.name], skipped: [] } });
  await settle();
  assert.equal(groupCount(group('/work/a')), 1);
  assert.equal(groupCount(group('/work/b')), 1);
  assert.equal(action('/work/b', 'data-import-action'), undefined);
  assert.ok(descendants(group('/work/b')).some(node => node.type === 'span' && node.props.children.includes('skillAlreadyExists')));
  assert.equal(groupCount(group('')), 1);
  assert.ok(skillDetailText(action('/work/a', 'data-import-action')).includes('skillImportOne'));
  app.unmount();
});

test('discovery refresh preserves counts and cards, retries only the failed project and keeps collapse choices', async () => {
  const oldReply = Promise.withResolvers();
  const freshReply = Promise.withResolvers();
  const entry = { id: 'helper', name: 'helper', description: 'Review changes', source: 'Codex', path: '/skills/helper', flat: false };
  let stage = 0;
  const app = await mount({ featureIds: ['skills'], externalSkillList: (cwd, scope) => {
    if (cwd === '/work/b' && stage < 2) return { ok: false, error: { message: 'Could not scan project' } };
    if (cwd === '/work/a' && stage === 1) return oldReply.promise;
    if (cwd === '/work/a' && stage === 2) return freshReply.promise;
    return { ok: true, value: { complete: true, entries: [entry] } };
  } });
  const page = await skillsPage(app);
  const group = path => page.render().find(node => node.props['data-import-cwd'] === path);
  const toggle = path => descendants(group(path)).find(node => node.props['aria-controls']);
  page.tab('sources').props.onClick();
  await settle();
  assert.equal(groupCount(group('/work/b')), undefined);
  assert.ok(descendants(group('/work/b')).some(node => node.props.role === 'alert'));
  assert.ok(!descendants(group('/work/b')).some(node => node.props.children.includes('skillImportEmptyGroup')));
  assert.equal(groupCount(group('/work/a')), 1);
  toggle('').props.onClick();
  stage = 1;
  page.tab('user').props.onClick();
  page.tab('sources').props.onClick();
  assert.equal(toggle('').props['aria-expanded'], false);
  assert.equal(groupCount(group('/work/a')), 1);
  assert.ok(descendants(group('/work/a')).some(node => node.props['data-import'] === entry.name));
  assert.equal(descendants(group('/work/a')).find(node => node.props['data-import-action']).props.disabled, true);
  await settle();
  stage = 2;
  const reads = app.externalReads.length;
  const failure = descendants(group('/work/b')).find(node => node.props.role === 'alert');
  descendants(failure).find(node => node.props['data-native-button'] && node.props.children.includes('retry')).props.onClick();
  await settle();
  assert.deepEqual(app.externalReads.slice(reads), [{ cwd: '/work/b', scope: 'project' }]);
  assert.equal(groupCount(group('/work/b')), 1);
  page.tab('user').props.onClick();
  page.tab('sources').props.onClick();
  freshReply.resolve({ ok: true, value: { complete: true, entries: [] } });
  await settle();
  assert.equal(group('/work/a'), undefined);
  oldReply.resolve({ ok: true, value: { complete: true, entries: [entry] } });
  await settle();
  assert.equal(group('/work/a'), undefined);
  assert.equal(toggle('').props['aria-expanded'], false);
  app.unmount();
});

test('discovery search filters all source paths and descriptions, counts existing skills and restores collapse choices without scanning', async () => {
  const review = externalEntryFixture({ available: true });
  const helper = { id: 'helper', name: 'helper', description: 'Document changes', source: 'Cursor', path: '/work/a/.cursor/skills/helper', flat: false };
  const app = await mount({ featureIds: ['skills'], externalSkillList: cwd => ({ ok: true, value: {
    complete: true, entries: cwd === '' ? [review, helper] : cwd === '/work/a' ? [helper] : [],
  } }) });
  const page = await skillsPage(app);
  page.tab('sources').props.onClick();
  await settle();
  const group = path => page.render().find(node => node.props['data-import-cwd'] === path);
  const toggle = path => descendants(group(path)).find(node => node.props['aria-controls']);
  const search = value => page.search().props.onChange({ target: { value } });
  assert.equal(page.search().props['aria-label'], 'skillSearch');
  assert.equal(groupCount(group('')), 2);
  toggle('').props.onClick();
  assert.equal(toggle('').props['aria-expanded'], false);
  const reads = app.externalReads.length;
  for (const query of [' REVIEW ', 'rEvIeW CoDe', '.CODEX', 'first source', 'CLAUDE CODE']) {
    search(query);
    assert.equal(toggle('').props['aria-expanded'], true);
    assert.equal(groupCount(group('')), 1);
    assert.equal(group('/work/a'), undefined);
    const card = descendants(group('')).find(node => node.props['data-import'] === 'review');
    assert.equal(card.props['data-existing'], true);
    assert.ok(!descendants(card).some(node => node.props['data-import-action']));
  }
  toggle('').props.onClick();
  assert.equal(toggle('').props['aria-expanded'], true);
  search('missing-skill');
  assert.equal(page.render().filter(node => node.props['data-import-group']).length, 0);
  assert.equal(page.render().filter(node => node.props.children.includes('skillNoMatches')).length, 1);
  search('   ');
  assert.equal(toggle('').props['aria-expanded'], false);
  assert.equal(groupCount(group('')), 2);
  search('DOCUMENT');
  assert.equal(groupCount(group('')), 1);
  assert.equal(groupCount(group('/work/a')), 1);
  assert.equal(app.externalReads.length, reads);
  descendants(group('/work/a')).find(node => node.props['data-import-action'] === 'helper').props.onClick();
  await settle();
  assert.equal(app.importDestinationReads.at(-1).cwd, '/work/a');
  assert.deepEqual(app.externalImports, []);
  app.unmount();
});

test('discovery search retains pending scans and errors when no previous cards match', async () => {
  const reply = Promise.withResolvers();
  const app = await mount({ featureIds: ['skills'], externalSkillList: cwd => cwd === '/work/a' ? reply.promise
    : cwd === '/work/b' ? { ok: false, error: { message: 'Could not scan project' } }
      : { ok: true, value: { complete: true, entries: [] } } });
  const page = await skillsPage(app);
  page.tab('sources').props.onClick();
  page.search().props.onChange({ target: { value: 'missing-skill' } });
  await settle();
  const group = path => page.render().find(node => node.props['data-import-cwd'] === path);
  assert.ok(descendants(group('/work/a')).some(node => node.props.className === 'power-dsh-loading'));
  assert.ok(descendants(group('/work/b')).some(node => node.props.role === 'alert'));
  assert.ok(!page.render().some(node => node.props.children.includes('skillNoMatches')));
  reply.resolve({ ok: true, value: { complete: true, entries: [] } });
  await settle();
  assert.equal(group('/work/a'), undefined);
  assert.ok(descendants(group('/work/b')).some(node => node.props.role === 'alert'));
  app.unmount();
});

test('discovery with no imported projects scans only global skills', async () => {
  const reply = Promise.withResolvers();
  const app = await mount({ featureIds: ['skills'], skillCatalog: catalogFixture({ workspaces: [] }), externalSkillList: () => reply.promise });
  const page = await skillsPage(app);
  page.tab('sources').props.onClick();
  assert.equal(page.render().filter(node => node.props['data-import-group']).length, 1);
  assert.ok(!page.render().some(node => node.props.children.includes('skillImportEmptyGroup')));
  reply.resolve({ ok: true, value: { complete: true, entries: [] } });
  await settle();
  assert.deepEqual(app.externalReads, [{ cwd: '', scope: 'user' }]);
  const groups = page.render().filter(node => node.props['data-import-group']);
  assert.equal(groups.length, 0);
  assert.equal(page.render().filter(node => node.props.children.includes('skillImportEmptyGroup')).length, 1);
  app.unmount();
});

test('incomplete empty workspace and discovery catalogs retain their groups and never claim an empty page', async () => {
  const app = await mount({
    featureIds: ['skills'],
    skillList: (cwd, scope) => ({ ok: true, value: catalogFixture({ cwd, scope, complete: scope === 'user', skills: [] }) }),
    externalSkillCatalog: { complete: false, entries: [] },
  });
  const page = await skillsPage(app, 'project');
  for (const path of ['/work/a', '/work/b']) {
    assert.ok(page.workspace(path));
    assert.equal(groupCount(page.workspace(path)), undefined);
    assert.ok(descendants(page.workspace(path)).some(node => node.props.children.includes('skillIncomplete')));
  }
  assert.ok(!page.render().some(node => node.props.children.includes('skillEmpty')));
  page.tab('sources').props.onClick();
  await settle();
  page.search().props.onChange({ target: { value: 'missing-skill' } });
  const groups = page.render().filter(node => node.props['data-import-group']);
  assert.equal(groups.length, 3);
  assert.ok(groups.every(group => descendants(group).some(node => node.props.children.includes('skillIncomplete'))));
  assert.ok(!page.render().some(node => node.props.children.includes('skillImportEmptyGroup')));
  assert.ok(!page.render().some(node => node.props.children.includes('skillNoMatches')));
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
  page.tab('sources').props.onClick();await settle();
  assert.ok(page.render().some(node => node.props.children.includes('skillDiscoverDescription')));
  const card = page.render().find(node => node.props['data-import'] === 'review');
  const origin = descendants(card).find(node => node.props.className === 'power-dsh-skill-card-origin');
  assert.equal(origin.props['data-source-count'], 4);
  assert.ok(descendants(origin).some(node => node.props.className === 'power-dsh-skill-path-label' && node.props.children.includes('.claude')));
  const tooltip = descendants(card).find(node => node.type === 'native-tooltip-fixture' && node.props.label.includes(entry.sources[0].path));
  assert.equal(tooltip.props.label, entry.sources.map(source => source.path).join('\n'));
  assert.deepEqual(descendants(card).filter(node => node.type === 'button').map(node => node.props.children[0]), ['skillDetail', 'skillImportOne']);
  descendants(card).find(node => node.props['data-import-detail']).props.onClick();await settle();
  assert.deepEqual(descendants(page.dialog()).filter(node => node.type === 'dt').flatMap(node => node.props.children), ['skillDetailPath', 'skillDetailDescription']);
  assert.ok(!descendants(page.dialog()).some(node => node.type === 'input' || node.type === 'native-menu-fixture'));
  assert.ok(!skillDetailText(page.dialog()).includes('skillSourcesHint'));
  assert.deepEqual(app.externalDetailReads, [{ cwd: '', scope: 'user', id: 'variant-one' }]);
  page.dialog().props.onClose();
  descendants(card).find(node => node.props['data-import-action']).props.onClick();await settle();
  await confirmDestination(page);
  assert.equal(app.externalImports.length, 1);
  assert.equal(app.externalImports[0].ids[0], 'variant-one');
  assert.equal(app.externalImports[0].mode, 'copy');
  assert.equal(app.externalImports[0].revision, 'a'.repeat(64));
  assert.equal(page.tab('sources').props['aria-selected'], true);
  assert.ok(!page.render().some(node => node.props.children.includes('skillViewImported')));
  assert.equal(page.render().find(node => node.props['data-import'] === 'review').props['data-existing'], true);
  page.tab('user').props.onClick();await settle();
  assert.equal(page.search().props.value, '');
  assert.ok(page.row('review'));
  app.unmount();
});

test('different contents use a path field choice before confirming the same import action', async () => {
  const entry = externalEntryFixture();
  entry.variants.push({ ...entry.variants[0], id: 'variant-two', revision: 'b'.repeat(64), description: 'Second source', path: '/other/review', sources: [entry.sources[1]] });
  entry.comparison = 'different';
  const app = await mount({ featureIds: ['skills'], externalSkillCatalog: { complete: true, entries: [entry] } });
  const page = await skillsPage(app);page.tab('sources').props.onClick();await settle();
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
  const page = await skillsPage(app);page.tab('sources').props.onClick();await settle();
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
  const page = await skillsPage(app);page.tab('sources').props.onClick();await settle();
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

test('a pending source addition blocks closing, reselection and duplicate writes while failures preserve the choice', async () => {
  const entry = externalEntryFixture();
  entry.variants.push({ ...entry.variants[0], id: 'variant-two', revision: 'b'.repeat(64) });
  entry.comparison = 'different';
  const reply = Promise.withResolvers();
  const app = await mount({ featureIds: ['skills'], externalSkillCatalog: { complete: true, entries: [entry] },
    externalSkillReply: () => reply.promise });
  const page = await skillsPage(app);
  page.tab('sources').props.onClick();await settle();
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

test('a single path has plain directory text and its details lead to destination confirmation', async () => {
  const entry = externalEntryFixture();
  entry.sources = [entry.sources[1]];
  entry.variants[0] = { ...entry.variants[0], path: entry.sources[0].path, sources: entry.sources };
  const app = await mount({ featureIds: ['skills'], externalSkillCatalog: { complete: true, entries: [entry] } });
  const page = await skillsPage(app);
  page.tab('sources').props.onClick();await settle();
  const card = page.render().find(node => node.props['data-import'] === 'review');
  const origin = descendants(card).find(node => node.props.className === 'power-dsh-skill-card-origin');
  assert.equal(origin.props.children[0], '.codex');
  assert.equal(origin.props['data-source-count'], 1);
  assert.ok(!descendants(card).some(node => node.props.className === 'power-dsh-skill-path-stack'));
  assert.deepEqual(descendants(card).filter(node => node.type === 'button').map(node => node.props.children[0]), ['skillDetail', 'skillImportOne']);
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
  page.tab('sources').props.onClick();await settle();
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

test('a project import defaults to its group, allows another destination and keeps cards visible after success', async () => {
  const entry = externalEntryFixture();
  const app = await mount({ featureIds: ['skills'], externalSkillCatalog: { complete: true, entries: [entry] } });
  const page = await skillsPage(app);
  page.tab('sources').props.onClick();await settle();
  const group = cwd => page.render().find(node => node.props['data-import-cwd'] === cwd);
  const card = cwd => descendants(group(cwd)).find(node => node.props['data-import'] === entry.name);
  descendants(card('/work/a')).find(node => node.props['data-import-action']).props.onClick();await settle();
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
  assert.equal(page.tab('sources').props['aria-selected'], true);
  assert.equal(card('/work/b').props['data-existing'], true);
  assert.equal(card('/work/a').props['data-existing'], false);
  assert.equal(groupCount(group('/work/a')), 1);
  assert.equal(groupCount(group('/work/b')), 1);
  assert.deepEqual(descendants(page.render().find(node => node.props.className === 'power-dsh-skill-import-notice')).filter(node => node.type === 'button'), []);
  descendants(card('/work/b')).find(node => node.props['data-import-detail']).props.onClick();await settle();
  assert.ok(descendants(page.dialog()).some(node => node.type === 'native-markdown-fixture' && node.props.text.includes('Body of variant-one')));
  assert.ok(!descendants(page.dialog()).some(node => node.type === 'button' && node.props.children.includes('skillAlreadyExists')));
  assert.ok(!descendants(page.dialog()).some(node => node.props.children.includes('skillAlreadyExists')));
  page.dialog().props.onClose();
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
  page.tab('sources').props.onClick();await settle();
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
  const page = await skillsPage(app);
  page.tab('sources').props.onClick();await settle();
  const group = page.render().find(node => node.props['data-import-cwd'] === '/work/a');
  descendants(group).find(node => node.props['data-import-action']).props.onClick();await settle();
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
  const remove = () => descendants(page.dialog()).find(node => node.props.className === 'power-dsh-skill-delete');
  remove().props.onClick();
  assert.equal(page.dialog().props.title, 'skillDelete');
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
  const deletion = { path: '/work/b/.dsh/skills/code-review', linked: true, revision: 'd'.repeat(64) };
  const app = await mount({ featureIds: ['skills'], skillCatalog: catalogFixture({ skills: [skillFixture(),
    skillFixture({ source: 'project-dsh', path: deletion.path + '/SKILL.md', targetCwd: '/work/b', deletion })] }) });
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
