import assert from 'node:assert/strict';
import { test } from 'node:test';
import { archiveCatalogFixture, archiveSessionFixture, mount, descendants, archivePage } from '../../../../tests/helpers/client-fixture.mjs';
import { styles } from '../styles.ts';

const catalog = archiveCatalogFixture({ sessions: [
  archiveSessionFixture({ sessionId: 's1', title: 'Alpha one', workspaceId: 'w1', workspaceTitle: 'Project Alpha', updatedAt: 30, createdAt: 100 }),
  archiveSessionFixture({ sessionId: 's2', title: 'Alpha two', workspaceId: 'w1', workspaceTitle: 'Project Alpha', updatedAt: 10, createdAt: 200 }),
  archiveSessionFixture({ sessionId: 's3', title: 'Beta one', workspaceId: 'w2', workspaceTitle: 'Project Beta', updatedAt: 20, createdAt: 300 }),
] });

test('the archive switch owns its own page and icon without extra subscriptions', async () => {
  const app = await mount();
  const section = 'settings.section:power-dsh-archive';
  const icon = 'settings.section.icon:power-dsh-archive';
  const baseline = app.entries.size;
  const subscriptions = app.subscriptions();
  for (let index = 0; index < 3; index++) {
    assert.ok(!app.entries.has(section));
    app.set({ archiveManagerEnabled: true });
    const entry = app.entries.get(section);
    assert.equal(entry.options.label(), 'archiveTab');
    assert.ok(app.entries.has(icon));
    app.set({ showVersion: true });
    assert.equal(app.entries.get(section), entry);
    assert.equal(app.entries.size, baseline + 2);
    app.set({ archiveManagerEnabled: false });
    assert.ok(!app.entries.has(section));
    assert.ok(!app.entries.has(icon));
    assert.equal(app.entries.size, baseline);
    assert.equal(app.subscriptions(), subscriptions);
  }
  app.unmount();
  assert.equal(app.focusSubscriptions(), 0);
  assert.deepEqual(app.archiveWrites, []);
});

test('archived projects start collapsed and expand without hiding rows from search', async () => {
  const app = await mount({ archiveCatalog: catalog });
  const page = await archivePage(app);
  const alpha = page.group('Project Alpha');
  const beta = page.group('Project Beta');
  assert.equal(alpha.props['aria-expanded'], false, 'Every group starts collapsed.');
  assert.equal(beta.props['aria-expanded'], false);
  assert.equal(page.row('s1'), undefined, 'Collapsed groups hide their rows.');
  assert.equal(page.row('s3'), undefined);

  const [folder, title, chevron] = alpha.props.children;
  assert.equal(folder.props.className, 'power-dsh-archive-group-folder', 'The folder icon leads the title button.');
  assert.equal(title.props.className, 'power-dsh-archive-group-title');
  assert.equal(chevron.type.name, 'SkillChevron', 'The chevron sits after the project name, not before it.');

  assert.ok(!page.render().some(node => node.props.className === 'power-dsh-archive-group-path'),
    'The workspace directory is no longer rendered as visible text.');
  assert.ok(!page.render().some(node => [node.props?.children].flat(Infinity).includes('/work/alpha')),
    'The path never appears inline on the header row.');
  const pathTip = page.render().find(node => node.type === 'native-tooltip-fixture' && node.props.label === '/work/alpha');
  assert.ok(pathTip, 'The workspace directory surfaces through the native tooltip.');
  assert.equal(pathTip.props.portal, true);
  const [anchor] = pathTip.props.children;
  assert.equal(anchor.type, 'button', 'The tooltip belongs to the group title button.');
  assert.ok(anchor.props.className.includes('power-dsh-archive-group-toggle'),
    'Hovering or focusing the title reveals the directory.');

  alpha.props.onClick();
  assert.equal(page.group('Project Alpha').props['aria-expanded'], true);
  assert.equal(page.row('s1').props['data-archive'], 's1');
  assert.ok(page.row('s2'));
  assert.equal(page.row('s3'), undefined, 'Opening one project keeps the other collapsed.');
  assert.equal(page.group('Project Beta').props['aria-expanded'], false);

  alpha.props.onClick();
  assert.equal(page.group('Project Alpha').props['aria-expanded'], false);
  assert.equal(page.row('s1'), undefined);

  page.search().props.onChange({ target: { value: 'Alpha two' } });
  assert.equal(page.group('Project Alpha').props['aria-expanded'], true, 'Search reveals matching rows inside a collapsed project.');
  assert.ok(page.row('s2'));
  assert.equal(page.row('s3'), undefined);
  page.search().props.onChange({ target: { value: '' } });
  assert.equal(page.group('Project Alpha').props['aria-expanded'], false, 'Clearing search restores the collapsed state.');
  assert.equal(page.row('s1'), undefined);

  page.expand('Project Alpha');
  assert.equal(page.row('s1').props['data-archive'], 's1');
  app.unmount();
});

const dialog = page => page.render().find(node => node.type === 'native-modal-fixture');
const confirm = page => descendants(dialog(page)).find(node => node.props.className === 'power-dsh-archive-confirm-delete');
const deleteAll = page => page.render().find(node => node.props.className?.includes('power-dsh-archive-delete-all'));

test('single deletion requires confirmation and restore remains independent', async () => {
  const app = await mount({ archiveCatalog: catalog });
  const page = await archivePage(app);
  page.expand('Project Alpha');
  page.action('s1', 'delete').props.onClick();
  const stale = confirm(page).props.onClick;
  dialog(page).props.onClose();
  await stale();
  assert.deepEqual(app.archiveWrites, []);
  page.action('s1', 'delete').props.onClick();
  await confirm(page).props.onClick();
  await page.action('s2', 'restore').props.onClick();
  assert.deepEqual(app.archiveWrites, [
    { method: 'deleteArchivedSession', sessionId: 's1' }, { method: 'restoreArchivedSession', sessionId: 's2' },
  ]);
  app.unmount();
});

test('refresh cannot replace the target of an open global confirmation', async () => {
  const app = await mount({ archiveCatalog: archiveCatalogFixture({ sessions: [catalog.sessions[0]] }) });
  const page = await archivePage(app);
  deleteAll(page).props.onClick();
  const stale = confirm(page).props.onClick;
  app.setArchive(archiveCatalogFixture({ sessions: [catalog.sessions[1]] }));
  await app.reloadArchive();
  await stale();
  assert.equal(dialog(page), undefined);
  assert.deepEqual(app.archiveWrites, []);
  app.unmount();
});

test('group deletion covers the entire workspace while a search is active', async () => {
  const app = await mount({ archiveCatalog: catalog });
  const page = await archivePage(app);
  page.search().props.onChange({ target: { value: 'Alpha one' } });
  const button = page.render().find(node => node.props['data-group-menu'] === 'w1');
  button.props.onClick();
  const menu = page.render().find(node => node.type === 'native-menu-fixture' && node.props.open);
  menu.props.onSelect('delete');
  await confirm(page).props.onClick();
  assert.deepEqual(app.archiveWrites.map(call => call.sessionId), ['s1', 's2']);
  app.unmount();
});

test('the trailing group uses the native ungrouped wording without a path tooltip', async () => {
  const app = await mount({ localeLanguage: 'zh', archiveCatalog: archiveCatalogFixture({ sessions: [
    archiveSessionFixture({ sessionId: 's1', title: 'Alpha one', workspaceId: 'w1', workspaceTitle: 'Project Alpha', workspacePath: '/work/alpha' }),
    archiveSessionFixture({ sessionId: 's9', title: 'Orphan', workspaceId: '', workspaceTitle: '', workspacePath: '' }),
  ] }) });
  const page = await archivePage(app, 'zh');
  assert.ok(page.group('未分组'), 'The trailing group matches the native Workspace wording.');
  const tips = page.render().filter(node => node.type === 'native-tooltip-fixture' && node.props.label === '/work/alpha');
  assert.equal(tips.length, 1, 'Only the real workspace carries the directory tooltip.');
  assert.equal(page.render().filter(node => node.props.className === 'power-dsh-archive-group-toggle').length, 2,
    'Both groups keep a plain title button.');
  app.unmount();
});

test('archive load and action failures stay recoverable and localized', async () => {
  const app = await mount({ archiveCatalog: catalog, archiveReadError: 'archiveUnavailable' });
  app.set({ archiveManagerEnabled: true });
  app.renderArchive('zh');
  await app.reloadArchive();
  const render = () => descendants(app.renderArchive('zh'));
  assert.ok(render().some(node => node.props.role === 'alert' || descendants(node).some(child => child.props.children === '归档管理暂不可用')));
  assert.ok(render().some(node => node.type === 'button' && node.props.children.includes('重试')));
  app.unmount();

  const failing = await mount({ archiveCatalog: catalog, archiveReply: () => ({ ok: false, error: { message: 'restore-failed' } }) });
  const page = await archivePage(failing);
  page.expand('Project Alpha');
  await page.action('s1', 'restore').props.onClick();
  assert.equal(page.row('s1').props['data-archive'], 's1', 'A failed restore keeps the row.');
  assert.ok(descendants(page.row('s1')).some(node => [node.props.children].flat(Infinity).includes('archiveRestoreFailed')));
  failing.unmount();
});

test('the group path only surfaces on hover, not in the header layout', async () => {
  const app = await mount();
  app.set({ archiveManagerEnabled: true });
  app.renderArchive();
  await new Promise(setImmediate); await new Promise(setImmediate);
  const header = descendants(app.renderArchive())
    .find(node => node.props?.className === 'power-dsh-archive-group-header');
  const classes = descendants(header).map(node => node.props?.className).filter(Boolean);
  assert.ok(!classes.includes('power-dsh-archive-group-path'), 'The path no longer occupies header space.');
  assert.ok(!classes.includes('power-dsh-archive-group-head'), 'There is no second line for the path.');
  assert.deepEqual(classes.filter(name => name.includes('archive-group')),
    ['power-dsh-archive-group-header', 'power-dsh-archive-group-toggle', 'power-dsh-archive-group-folder',
      'power-dsh-archive-group-title', 'power-dsh-archive-action power-dsh-archive-group-menu'],
    'The header keeps the title button, which owns the hover tooltip.');
  assert.equal(classes.filter(name => name === 'power-dsh-archive-count').length, 1,
    'The count stays pinned right.');
  assert.doesNotMatch(styles, /archive-group-path/, 'The removed path styles are gone.');
  app.unmount();
});
