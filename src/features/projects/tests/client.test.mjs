import assert from 'node:assert/strict';
import { test } from 'node:test';
import { descendants, mount, projectCatalogFixture, projectRowFixture, projectsPage } from '../../../../tests/helpers/client-fixture.mjs';

const catalog = projectCatalogFixture({ projects: [
  projectRowFixture({ workspaceId: 'w1', title: 'power-dsh', path: '/work/power-dsh', sessionCount: 1, lastActiveAt: 30 }),
  projectRowFixture({ workspaceId: 'w2', title: 'ZCode', path: '/work/zcode', sessionCount: 71, lastActiveAt: 10 }),
  projectRowFixture({ workspaceId: 'w3', title: 'agework', path: '/work/agework', sessionCount: 2, lastActiveAt: 0 }),
] });

test('the project switch owns its own page and icon without extra subscriptions', async () => {
  const app = await mount();
  const section = 'settings.section:power-dsh-projects';
  const icon = 'settings.section.icon:power-dsh-projects';
  const baseline = app.entries.size;
  const subscriptions = app.subscriptions();
  for (let index = 0; index < 3; index++) {
    assert.ok(!app.entries.has(section));
    app.set({ projectManagerEnabled: true });
    const entry = app.entries.get(section);
    assert.equal(entry.options.label(), 'projectsTab');
    assert.ok(app.entries.has(icon));
    app.set({ showVersion: true });
    assert.equal(app.entries.get(section), entry);
    assert.equal(app.entries.size, baseline + 2);
    app.set({ projectManagerEnabled: false });
    assert.ok(!app.entries.has(section));
    assert.ok(!app.entries.has(icon));
    assert.equal(app.entries.size, baseline);
    assert.equal(app.subscriptions(), subscriptions);
  }
  app.unmount();
  assert.equal(app.focusSubscriptions(), 0);
  assert.deepEqual(app.projectWrites, []);
});

test('project rows show name, directory, session count and last activity', async () => {
  const app = await mount({ projectCatalog: catalog });
  const page = await projectsPage(app, 'en');
  const row = page.row('w1');
  assert.ok(row, 'The default recent sort lists the newest activity first.');
  const text = descendants(row).flatMap(node => [node.props.children].flat(Infinity)).filter(value => typeof value === 'string');
  assert.ok(text.includes('power-dsh'));
  assert.ok(text.includes('/work/power-dsh'));
  assert.ok(text.includes('1'));
  assert.ok(!text.includes('Never used'), 'A dated project shows its distance instead of the never-used label.');
  assert.ok(descendants(page.row('w3')).some(node => [node.props.children].flat(Infinity).includes('Never used')));
  assert.ok(page.render().some(node => node.type === 'native-tooltip-fixture' && node.props.label === '/work/power-dsh'));
  app.unmount();
});

test('project sort switches between latest activity and the native registry order', async () => {
  const app = await mount({ projectCatalog: catalog });
  const page = await projectsPage(app, 'en');
  const ids = () => page.render().filter(node => node.type === 'li').map(node => node.props['data-project']);
  assert.deepEqual(ids(), ['w1', 'w2', 'w3']);
  const trigger = page.render().find(node => node.type === 'button' && node.props['aria-label'] === 'Sort');
  assert.ok(trigger, 'Sorting uses the shared native Menu, not a system select.');
  trigger.props.onClick();
  const item = page.render().find(node => node.props.role === 'menuitem' && node.props['data-id'] === 'manual');
  await item.props.onClick();
  assert.deepEqual(ids(), ['w1', 'w2', 'w3'], 'The fixture registry order matches the activity order.');
  app.setProjects(projectCatalogFixture({ projects: [...catalog.projects].reverse() }));
  await app.reloadProjects();
  assert.deepEqual(ids(), ['w3', 'w2', 'w1']);
  app.unmount();
});

test('project search matches the name or the directory and keeps the empty states apart', async () => {
  const app = await mount({ projectCatalog: catalog });
  const page = await projectsPage(app, 'en');
  page.search().props.onChange({ target: { value: 'zcode' } });
  assert.ok(page.row('w2'));
  assert.ok(!page.row('w1'));
  page.search().props.onChange({ target: { value: '/work/agework' } });
  assert.ok(page.row('w3'));
  page.search().props.onChange({ target: { value: 'missing' } });
  assert.equal(page.render().filter(node => node.type === 'li').length, 0);
  assert.ok(page.render().some(node => [node.props.children].flat(Infinity).includes('No matching projects')));
  app.setProjects(projectCatalogFixture({ projects: [] }));
  page.search().props.onChange({ target: { value: '' } });
  await app.reloadProjects();
  assert.ok(page.render().some(node => [node.props.children].flat(Infinity).includes('No projects')));
  app.unmount();
});

test('removing a project asks for confirmation with the native dialog and danger styling', async () => {
  const app = await mount({ projectCatalog: catalog });
  const page = await projectsPage(app, 'en');
  const action = page.action('w1');
  assert.equal(action.props['aria-label'], 'Remove power-dsh');
  assert.equal(action.props.className.includes('power-dsh-projects-action-danger'), true);
  action.props.onClick();
  const dialog = page.render().find(node => node.type === 'native-modal-fixture');
  assert.ok(dialog, 'Removal is confirmed before touching the registry.');
  assert.equal(dialog.props.title, 'Remove project?');
  assert.ok(String(dialog.props.description).includes('power-dsh'));
  const buttons = descendants(dialog).filter(node => node.props['data-native-button']);
  assert.deepEqual(buttons.map(node => [node.props.children].flat(Infinity).join('')), ['Cancel', 'Remove project']);
  assert.equal(buttons[1].props.variant, 'outline');
  buttons[1].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(app.projectWrites, [{ method: 'removeProject', workspaceId: 'w1' }]);
  assert.equal(page.row('w1'), undefined);
  app.unmount();
});

test('cancelling the confirmation keeps the project and never calls the Host', async () => {
  const app = await mount({ projectCatalog: catalog });
  const page = await projectsPage(app);
  page.action('w2').props.onClick();
  const buttons = descendants(page.render().find(node => node.type === 'native-modal-fixture')).filter(node => node.props['data-native-button']);
  buttons[0].props.onClick();
  assert.ok(page.row('w2'));
  assert.deepEqual(app.projectWrites, []);
  app.unmount();
});

test('project load and remove failures stay recoverable and localized', async () => {
  const app = await mount({ projectCatalog: catalog, projectReadError: 'projectsUnavailable', localeLanguage: 'zh' });
  app.set({ projectManagerEnabled: true });
  app.renderProjects('zh');
  await app.reloadProjects();
  const render = () => descendants(app.renderProjects('zh'));
  assert.ok(render().some(node => [node.props.children].flat(Infinity).includes('项目管理暂不可用。')));

  const failing = await mount({ projectCatalog: catalog, localeLanguage: 'zh',
    projectReply: async () => ({ ok: false, error: { message: 'projectsNotFound' } }) });
  const page = await projectsPage(failing, 'zh');
  page.action('w2').props.onClick();
  const buttons = descendants(page.render().find(node => node.type === 'native-modal-fixture')).filter(node => node.props['data-native-button']);
  buttons[1].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  const zh = descendants(failing.renderProjects('zh'));
  assert.ok(zh.some(node => [node.props.children].flat(Infinity).includes('该项目已不存在。')));
  assert.deepEqual(failing.projectWrites, [{ method: 'removeProject', workspaceId: 'w2' }]);
  app.unmount();
  failing.unmount();
});
