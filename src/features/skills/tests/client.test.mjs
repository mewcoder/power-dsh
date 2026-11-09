import assert from 'node:assert/strict';
import { test } from 'node:test';
import { skillFixture, catalogFixture, mount, button, descendants, skillsPage } from '../../../../tests/helpers/client-fixture.mjs';

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
  for (const [name, label, text] of [
    ['code-review', '/skills/code-review/SKILL.md', '.dsh'],
    ['custom-style', '/user/.agents/skills/custom-style/SKILL.md', '.agents'],
    ['bundled-style', '@deepseek-ai/dsh-skill-office', '@deepseek-ai/dsh-skill-office'],
  ]) {
    const tip = descendants(page.row(name)).find(node => node.type === 'native-tooltip-fixture' && node.props.label === label);
    assert.ok(tip);
    assert.equal(tip.props.portal, true);
    assert.equal(tip.props.delayMs, 0);
    const anchor = tip.props.children[0];
    assert.ok(anchor.props.children.includes(text));
    assert.equal(anchor.props.title, undefined);
    assert.equal(anchor.props.tabIndex, 0);
  }
  assert.equal(page.select('skillSources'), undefined);
  for (const name of ['code-review', 'custom-style', 'remote-style', 'source-disabled', 'bundled-style']) {
    assert.ok(!descendants(page.row(name)).some(node => node.props.children.includes('skillPersonalSource') || node.props.children.includes('skillBundledSource')));
    assert.equal(descendants(page.row(name)).filter(node => node.type === 'button').length, 1);
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
  assert.equal(app.skillReads.length, reads + 1);
  assert.equal(app.skillReads.at(-1).scope, 'project');
  assert.equal(page.tab('project').props['aria-selected'], true);
  assert.equal(page.select('skillSources'), undefined);
  assert.equal(page.render().filter(node => node.type === 'li').length, 1);
  assert.equal(page.row('code-review'), undefined);
  assert.equal(page.control('project-style').props['aria-checked'], false);
  assert.equal(page.projectMenu().props.selectedId, '/work/a');
  assert.equal(page.select('skillPreset'), undefined);
  page.search().props.onChange({ target: { value: '文案' } });
  assert.ok(page.row('project-style'));
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
  const click = page.control('code-review').props.onClick;
  page.projectTrigger().props.onClick();
  const changeContext = page.projectMenu().props.onSelect;
  const action = click();
  assert.equal(page.control('code-review').props['aria-checked'], true);
  assert.equal(page.control('code-review').props['aria-busy'], true);
  assert.equal(page.control('code-review').props.disabled, true);
  assert.equal(page.projectTrigger().props.disabled, true);
  assert.equal(page.tab('user').props.disabled, true);
  assert.equal(page.tab('project').props.disabled, true);
  assert.equal(page.select('skillPreset'), undefined);
  const reads = app.skillReads.length;
  changeContext('/work/b');
  page.projectTrigger().props.onClick();
  assert.equal(page.projectMenu().props.open, false);
  app.focus();
  await click();
  assert.equal(app.skillReads.length, reads);
  assert.equal(app.skillWrites.length, 1);
  response.resolve({ ok: true, value: catalogFixture({ cwd: '/work/a', scope: 'project', skills: [skillFixture({ source: 'project-dsh', enabled: false, modelInvocable: false, userInvocable: false })] }) });
  await action;
  assert.equal(page.control('code-review').props['aria-checked'], false);
  assert.equal(page.control('code-review').props.disabled, false);
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

test('skill context selection discards stale reads, preserves the project selector and ignores replies after unload', async () => {
  const old = Promise.withResolvers();
  const latest = Promise.withResolvers();
  const late = Promise.withResolvers();
  const app = await mount({ skillList: (cwd, scope) => {
    if (cwd === '/work/a' && scope === 'project') return old.promise;
    if (cwd === '/work/b' && scope === 'project') return latest.promise;
    if (cwd === '/work/late' && scope === 'project') return late.promise;
    return { ok: true, value: catalogFixture() };
  } });
  const page = await skillsPage(app);
  // Start an older refresh, then a new context before the first completes.
  const first = app.reloadSkills('/work/a', 'project');
  const second = app.reloadSkills('/work/b', 'project');
  latest.resolve({ ok: true, value: catalogFixture({ cwd: '/work/b', scope: 'project', workspaces: [{ path: '/work/b', title: 'Project Beta' }], skills: [skillFixture({ name: 'new-context', source: 'project-dsh' })] }) });
  await second;
  assert.ok(page.row('new-context'));
  assert.equal(page.projectMenu().props.selectedId, '/work/b');
  const singleProject = page.projectMenu().props.items;
  assert.equal(singleProject.length, 1);
  assert.equal(singleProject[0].id, '/work/b');
  assert.equal(singleProject[0].label.props.children[0], 'Project Beta');
  assert.equal(singleProject[0].label.props.title, '/work/b');
  assert.equal(page.projectTrigger().props.title, '/work/b');
  assert.equal(page.select('skillPreset'), undefined);
  old.resolve({ ok: true, value: catalogFixture() });
  await first;
  assert.ok(page.row('new-context'));
  assert.equal(page.row('code-review'), undefined);
  const source = app.skillsProps().skillsSource;
  const pending = app.reloadSkills('/work/late', 'project');
  const before = source.getSnapshot();
  app.unmount();
  late.resolve({ ok: true, value: catalogFixture() });
  await pending;
  assert.equal(source.getSnapshot(), before);
});

test('project choices show imported titles, retain path identities and recover after a selected project disappears', async () => {
  const app = await mount({ skillCatalog: catalogFixture({ workspaces: [
    { path: '/work/a', title: 'Same project' }, { path: '/work/b', title: 'Same project' },
  ], skills: [skillFixture({ source: 'project-dsh' })] }) });
  const page = await skillsPage(app, 'project');
  const options = page.projectMenu().props.items;
  assert.deepEqual(Array.from(options, item => ({ value: item.id, title: item.label.props.title, label: item.label.props.children[0] })), [
    { value: '/work/a', title: '/work/a', label: 'Same project (/work/a)' },
    { value: '/work/b', title: '/work/b', label: 'Same project (/work/b)' },
  ]);
  await page.chooseProject('/work/b');
  assert.deepEqual(app.skillReads.at(-1), { cwd: '/work/b', scope: 'project' });
  await page.tab('user').props.onClick();
  assert.equal(page.projectTrigger(), undefined);
  assert.deepEqual(app.skillReads.at(-1), { cwd: '', scope: 'user' });
  await page.tab('project').props.onClick();
  assert.deepEqual(app.skillReads.at(-1), { cwd: '/work/b', scope: 'project' });
  assert.equal(page.projectMenu().props.selectedId, '/work/b');
  app.setSkills(catalogFixture({ cwd: '/work/a', scope: 'project', workspaces: [{ path: '/work/a', title: 'Remaining project' }], skills: [] }));
  await app.reloadSkills('/work/a', 'project');
  assert.equal(page.projectMenu().props.selectedId, '/work/a');
  assert.equal(page.projectMenu().props.items[0].label.props.children[0], 'Remaining project');
  app.unmount();
});

test('the native project Menu receives controlled selection, closes locally and rejects stale project choices', async () => {
  const longTitle = 'Project with a long imported display name '.repeat(5);
  const app = await mount({ skillCatalog: catalogFixture({ workspaces: [
    { path: '/work/a', title: longTitle }, { path: '/work/b', title: 'Project Beta' },
  ], skills: [] }) });
  const page = await skillsPage(app, 'project');
  const menu = () => page.projectMenu().props;
  assert.equal(menu().align, 'end');
  assert.equal(menu().portal, true);
  assert.equal(menu().autoFocus, true);
  assert.equal(menu().selectedId, '/work/a');
  assert.equal(menu().open, false);
  assert.ok(descendants(page.projectTrigger()).some(node => node.props.children.includes(longTitle)));
  const toolbar = page.render().find(node => node.props.className === 'power-dsh-project-search-row');
  assert.ok(descendants(toolbar).some(node => node.type === 'native-menu-fixture'));
  assert.ok(descendants(toolbar).some(node => node.type === 'input' && node.props.type === 'search'));
  page.projectTrigger().props.onClick();
  assert.equal(menu().open, true);
  const selectedItem = page.render().find(node => node.props.role === 'menuitem' && node.props['data-id'] === '/work/a');
  assert.equal(selectedItem.props['aria-current'], true);
  const reads = app.skillReads.length;
  await selectedItem.props.onClick();
  assert.equal(menu().open, false);
  assert.equal(app.skillReads.length, reads);
  page.projectTrigger().props.onClick();
  menu().onClose();
  assert.equal(menu().open, false);
  assert.equal(app.skillReads.length, reads);
  page.projectTrigger().props.onClick();
  const staleSelect = menu().onSelect;
  await staleSelect('/not-imported');
  assert.equal(app.skillReads.length, reads);
  app.setSkills(catalogFixture({ cwd: '/work/a', scope: 'project', workspaces: [{ path: '/work/a', title: longTitle }], skills: [] }));
  await app.reloadSkills('/work/a', 'project');
  const updatedReads = app.skillReads.length;
  await staleSelect('/work/b');
  assert.equal(app.skillReads.length, updatedReads);
  page.projectTrigger().props.onClick();
  await page.tab('user').props.onClick();
  assert.equal(page.projectMenu(), undefined);
  const globalReads = app.skillReads.length;
  await staleSelect('/work/a');
  assert.equal(app.skillReads.length, globalReads);
  app.unmount();
});

test('a project read failure keeps imported choices available for recovery and no-project state is explicit', async () => {
  const app = await mount({ skillList: (cwd, scope) => {
    if (scope === 'user') return { ok: true, value: catalogFixture() };
    if (cwd === '/work/b') return { ok: true, value: catalogFixture({ cwd, scope, skills: [] }) };
    return { ok: false, error: { message: 'Selected project no longer exists' } };
  } });
  const page = await skillsPage(app);
  await page.tab('project').props.onClick();
  assert.ok(page.render().some(node => node.props.role === 'alert'));
  assert.equal(page.projectTrigger().props.disabled, false);
  await page.chooseProject('/work/b');
  assert.equal(page.projectMenu().props.selectedId, '/work/b');
  assert.ok(!page.render().some(node => node.props.role === 'alert'));
  app.unmount();
  const none = await mount({ skillCatalog: catalogFixture({ workspaces: [], skills: [] }) });
  const empty = await skillsPage(none, 'project');
  assert.equal(empty.projectTrigger().props.disabled, true);
  assert.ok(descendants(empty.projectTrigger()).some(node => node.props.children.includes('skillNoProjects')));
  assert.equal(empty.projectMenu().props.items.length, 0);
  empty.projectTrigger().props.onClick();
  assert.equal(empty.projectMenu().props.open, false);
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
