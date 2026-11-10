import assert from 'node:assert/strict';
import { test } from 'node:test';
import { archiveCatalogFixture, archiveSessionFixture, mount, descendants, archivePage } from '../../../../tests/helpers/client-fixture.mjs';

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

test('archived projects collapse and expand without hiding rows from search', async () => {
  const app = await mount({ archiveCatalog: catalog });
  const page = await archivePage(app);
  const alpha = page.group('Project Alpha');
  const beta = page.group('Project Beta');
  assert.equal(alpha.props['aria-expanded'], true, 'Every group starts expanded.');
  assert.equal(beta.props['aria-expanded'], true);
  assert.ok(page.row('s1'));
  assert.ok(page.row('s3'));

  const pathLine = page.render().find(node => node.props.className === 'power-dsh-archive-group-path' && [node.props.children].flat(Infinity).includes('/work/alpha'));
  assert.ok(pathLine, 'Each project group shows its workspace directory.');
  assert.equal(pathLine.type, 'span', 'The path sits on the group header row instead of a second line.');
  assert.equal(pathLine.props.tabIndex, 0);
  assert.ok(page.render().some(node => node.type === 'native-tooltip-fixture' && node.props.label === '/work/alpha' && node.props.portal === true));

  alpha.props.onClick();
  assert.equal(page.group('Project Alpha').props['aria-expanded'], false);
  assert.equal(page.row('s1'), undefined);
  assert.equal(page.row('s2'), undefined);
  assert.ok(page.row('s3'), 'Collapsing one project keeps the other project open.');
  assert.equal(page.group('Project Beta').props['aria-expanded'], true);

  page.search().props.onChange({ target: { value: 'Alpha two' } });
  assert.equal(page.group('Project Alpha').props['aria-expanded'], true, 'Search reveals matching rows inside a collapsed project.');
  assert.ok(page.row('s2'));
  assert.equal(page.row('s3'), undefined);
  page.search().props.onChange({ target: { value: '' } });
  assert.equal(page.group('Project Alpha').props['aria-expanded'], false, 'Clearing search restores the manual collapse.');
  assert.equal(page.row('s1'), undefined);

  page.group('Project Alpha').props.onClick();
  assert.equal(page.row('s1').props['data-archive'], 's1');
  app.unmount();
});

test('archive rows restore and delete through the native confirmation with native buttons', async () => {
  const app = await mount({ archiveCatalog: catalog });
  const page = await archivePage(app);
  const actions = descendants(page.row('s1')).filter(node => node.type === 'button');
  assert.deepEqual(actions.map(node => node.props['data-delete'] ? 'delete' : 'restore'), ['delete', 'restore'], 'Delete stays left of restore.');
  const restore = page.action('s1', 'restore');
  assert.equal(restore.props['aria-label'], 'archiveRestore Alpha one');
  await restore.props.onClick();
  assert.deepEqual(app.archiveWrites, [{ method: 'restoreArchivedSession', sessionId: 's1' }]);
  assert.equal(page.row('s1'), undefined);

  const remove = page.action('s3', 'delete');
  assert.equal(remove.props['aria-label'], 'archiveDelete Beta one');
  assert.equal(remove.props.className.includes('power-dsh-archive-action-danger'), true);
  remove.props.onClick();
  const dialog = page.render().find(node => node.type === 'native-modal-fixture');
  assert.ok(dialog, 'Deleting asks for confirmation before touching files.');
  const buttons = descendants(dialog).filter(node => node.props['data-native-button']);
  assert.deepEqual(buttons.map(node => [node.props.children].flat(Infinity).join('')), ['cancel', 'archiveDeleteConfirm']);
  assert.equal(buttons[1].props.variant, 'outline');
  buttons[1].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(app.archiveWrites.at(-1), { method: 'deleteArchivedSession', sessionId: 's3' });
  assert.equal(page.row('s3'), undefined);
  app.unmount();
});

test('the trailing group uses the native ungrouped wording without a path line', async () => {
  const app = await mount({ localeLanguage: 'zh', archiveCatalog: archiveCatalogFixture({ sessions: [
    archiveSessionFixture({ sessionId: 's1', title: 'Alpha one', workspaceId: 'w1', workspaceTitle: 'Project Alpha', workspacePath: '/work/alpha' }),
    archiveSessionFixture({ sessionId: 's9', title: 'Orphan', workspaceId: '', workspaceTitle: '', workspacePath: '' }),
  ] }) });
  const page = await archivePage(app, 'zh');
  assert.ok(page.group('未分组'), 'The trailing group matches the native Workspace wording.');
  assert.equal(page.render().filter(node => node.props.className === 'power-dsh-archive-group-path').length, 1,
    'Only the real workspace renders a directory line.');
  assert.ok(page.render().some(node => node.props.className === 'power-dsh-archive-group-path'
    && [node.props.children].flat(Infinity).includes('/work/alpha')));
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

  const failing = await mount({ archiveCatalog: catalog, archiveReply: () => ({ ok: false, error: { message: 'archiveDeleteRemoveFailed' } }) });
  const page = await archivePage(failing);
  page.action('s1', 'delete').props.onClick();
  const dialog = page.render().find(node => node.type === 'native-modal-fixture');
  descendants(dialog).filter(node => node.props['data-native-button'])[1].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(page.row('s1').props['data-archive'], 's1', 'A failed delete keeps the row.');
  assert.ok(descendants(page.row('s1')).some(node => [node.props.children].flat(Infinity).includes('archiveDeleteRemoveFailed')));
  failing.unmount();
});

test('the header offers a delete-all action that confirms once and clears the list', async () => {
  const app = await mount({ archiveCatalog: archiveCatalogFixture({ sessions: [
    archiveSessionFixture({ sessionId: 's1' }),
    archiveSessionFixture({ sessionId: 's2' }),
    archiveSessionFixture({ sessionId: 's3' }),
  ] }) });
  app.set({ archiveManagerEnabled: true });
  app.renderArchive();
  await new Promise(setImmediate); await new Promise(setImmediate);
  const page = () => descendants(app.renderArchive());
  const bulk = () => page().find(node => typeof node.props?.className === 'string'
    && node.props.className.includes('power-dsh-archive-delete-all'));
  assert.ok(bulk(), 'The header carries the bulk action.');
  assert.ok(bulk().props.children.includes('archiveDeleteAll'));
  assert.ok(bulk().props.className.includes('power-dsh-archive-action'),
    'The bulk action reuses the row action geometry, which declares the border.');
  bulk().props.onClick();
  const dialog = () => page().find(node => node.props?.role === 'dialog');
  assert.ok(dialog(), 'The bulk action opens the native confirmation.');
  const confirm = page().find(node => typeof node.props?.className === 'string'
    && node.props.className.includes('power-dsh-archive-confirm-delete'));
  await confirm.props.onClick();
  // The batch awaits one request per row; flush the microtask queue between them.
  for (let index = 0; index < 8; index++) await new Promise(setImmediate);
  const deleted = app.archiveWrites.filter(entry => entry.method === 'deleteArchivedSession').map(entry => entry.sessionId);
  assert.deepEqual(deleted.slice().sort(), ['s1', 's2', 's3'],
    'Every listed session is deleted through the native confirmation.');
  app.unmount();
});

test('the group path sits on the title row as a smaller caption', async () => {
  const app = await mount();
  app.set({ archiveManagerEnabled: true });
  app.renderArchive();
  await new Promise(setImmediate); await new Promise(setImmediate);
  const header = descendants(app.renderArchive())
    .find(node => node.props?.className === 'power-dsh-archive-group-header');
  const classes = descendants(header).map(node => node.props?.className).filter(Boolean);
  assert.ok(classes.includes('power-dsh-archive-group-path'), 'The path stays on the header row.');
  assert.ok(!classes.includes('power-dsh-archive-group-head'), 'There is no second line for the path.');
  app.unmount();
});
