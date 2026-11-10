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
