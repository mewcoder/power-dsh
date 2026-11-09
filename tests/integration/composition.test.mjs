import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clientFeatures } from '../../src/app/client-features.ts';
import { skillFixture, catalogFixture, mount, descendants, skillsPage, mcpPage } from '../helpers/client-fixture.mjs';

test('skill cards expose switches directly, reject old project actions and keep MCP independent', async () => {
  const app = await mount({ skillCatalog: catalogFixture({ skills: [
    skillFixture({ name: 'same-name', source: 'user-dsh' }),
    skillFixture({ name: 'same-name', source: 'project-dsh' }),
  ] }) });
  const page = await skillsPage(app);
  assert.equal(page.control('same-name').props['aria-checked'], true);
  const oldGlobalAction = page.control('same-name').props.onClick;
  assert.ok(!descendants(page.row('same-name')).some(node => node.props['aria-expanded'] !== undefined));
  await page.tab('project').props.onClick();
  assert.ok(page.row('same-name'));
  assert.equal(page.control('same-name').props['aria-checked'], true);
  await oldGlobalAction();
  assert.deepEqual(app.skillWrites, []);
  const oldProjectAction = page.control('same-name').props.onClick;
  await page.chooseProject('/work/b');
  assert.equal(page.control('same-name').props['aria-checked'], true);
  await oldProjectAction();
  assert.deepEqual(app.skillWrites, []);
  assert.ok(!descendants(page.row('same-name')).some(node => node.props['aria-expanded'] !== undefined));
  const mcp = await mcpPage(app);
  assert.ok(mcp.control('browser'));
  assert.equal(mcp.toggle('browser').props['aria-expanded'], false);
  mcp.toggle('browser').props.onClick();
  assert.equal(mcp.toggle('browser').props['aria-expanded'], true);
  assert.ok(!descendants(page.row('same-name')).some(node => node.props['aria-expanded'] !== undefined));
  assert.deepEqual(app.skillWrites, []);
  assert.deepEqual(app.mcpWrites, []);
  app.unmount();
});

test('MCP has no project controls while skills retain their independent project scope', async () => {
  const app = await mount();
  const page = await mcpPage(app);
  assert.ok(page.search());
  assert.ok(page.group('user'));
  assert.ok(!page.render().some(node => ['tablist', 'tab', 'tabpanel'].includes(node.props.role)));
  assert.ok(!page.render().some(node => node.props.className === 'power-dsh-project-trigger' || node.type === 'native-menu-fixture'));
  assert.ok(app.mcpReads.every(args => args.length === 0));
  assert.deepEqual(Object.keys(app.mcpProps().mcpSource.getSnapshot()).sort(), ['error', 'saving', 'status', 'value']);
  const skills = await skillsPage(app);
  assert.equal(skills.tab('user').props['aria-selected'], true);
  await skills.tab('project').props.onClick();
  assert.equal(skills.tab('project').props['aria-selected'], true);
  assert.ok(skills.projectTrigger());
  app.unmount();
});

const featureIds = clientFeatures.map(feature => feature.definition.id);
const enabledPreferences = Object.fromEntries(clientFeatures.flatMap(feature => feature.definition.keys.filter(key => key !== 'disabledSkills').map(key => [key, key === 'notificationSound' ? 'default' : true])));

test('each Client feature can be omitted without removing another feature setting or side effect owner', async t => {
  const complete = await mount({ desktop: true });
  const settings = new Map(complete.settingsProps().features.map(feature => [feature.definition.id, feature.settings.filter(setting => !setting.hidden).map(setting => setting.field)]));
  complete.unmount();
  for (const omitted of clientFeatures) await t.test(omitted.definition.id, async () => {
    const app = await mount({ desktop: true, featureIds: featureIds.filter(id => id !== omitted.definition.id) });
    app.set(enabledPreferences);
    const controls = [];
    for (const tab of ['general', 'interface', 'enhancements', 'simplify']) {
      controls.push(...descendants(app.selectSettingsTab(tab)).filter(node => node.props.role === 'switch').map(node => node.props.id.replace('settings-test-', '')));
    }
    for (const feature of clientFeatures) for (const key of settings.get(feature.definition.id)) {
      assert.equal(controls.includes(key), feature !== omitted, `Independent contribution: ${key}`);
    }
    const omittedRpcIds = new Set(omitted.rpc.map(descriptor => descriptor.id));
    assert.ok(app.rpcDescriptors.every(descriptor => !omittedRpcIds.has(descriptor.id)), 'Strict mount excludes the omitted Host contract.');
    assert.equal(app.rpcDescriptors.length, complete.rpcDescriptors.length - omitted.rpc.length);
    for (const language of ['en', 'zh']) for (const key of Object.keys(omitted.locales[language])) {
      assert.equal(Object.hasOwn(app.dictionaries.get(language), key), false, `Omitted locale ownership: ${key}`);
    }
    if (omitted.definition.id === 'notifications') assert.equal(app.notificationSubscriptions(), 0);
    if (omitted.definition.id === 'double-click-rename') assert.equal(app.doubleClickListeners.size, 0);
    for (const id of ['personalization', 'skills', 'mcp']) {
      assert.equal(app.entries.has(`settings.section:power-dsh-${id}`), omitted.definition.id !== id);
      assert.equal(app.entries.has(`settings.section.icon:power-dsh-${id}`), omitted.definition.id !== id);
    }
    app.renderFooter();
    await new Promise(setImmediate);
    const footer = app.renderFooter();
    const trigger = descendants(footer).find(node => node.props['aria-label'] === 'moreActions');
    assert.ok(trigger, 'Either refresh or restart remains independently available.');
    trigger.props.onClick({ stopPropagation() {} });
    const menu = descendants(app.renderFooter()).find(node => node.type === 'native-menu-fixture');
    assert.deepEqual(Array.from(menu.props.items, item => item.id), [
      ...(omitted.definition.id === 'refresh-button' ? [] : ['refresh']),
      ...(omitted.definition.id === 'restart-button' ? [] : ['restart']),
    ]);
    app.unmount();
    assert.equal(app.subscriptions(), 0);
    assert.equal(app.focusSubscriptions(), 0);
    assert.equal(app.notificationSubscriptions(), 0);
    assert.equal(app.doubleClickListeners.size, 0);
    assert.deepEqual(app.intervals(), []);
  });
});

test('an empty Client selection renders the settings shell with no feature controls, menu or feature listeners', async () => {
  const app = await mount({ desktop: true, featureIds: [] });
  assert.equal(app.rpcDescriptors.length, 0);
  app.set(enabledPreferences);
  for (const tab of ['general', 'interface', 'enhancements', 'simplify']) {
    assert.equal(descendants(app.selectSettingsTab(tab)).filter(node => node.props.role === 'switch').length, 0);
  }
  assert.equal(descendants(app.renderFooter()).filter(node => node.props['aria-label'] === 'moreActions').length, 0);
  assert.equal(app.notificationSubscriptions(), 0);
  assert.equal(app.doubleClickListeners.size, 0);
  assert.deepEqual(app.intervals(), []);
  app.unmount();
  assert.equal(app.subscriptions(), 0);
});
