import assert from 'node:assert/strict';
import { test } from 'node:test';
import { descendants, mount } from '../../../../tests/helpers/client-fixture.mjs';

test('plugin update footer shows its own running version, stays manual and can be independently hidden', async () => {
  const app = await mount();
  const { version } = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../../../../package.json', import.meta.url), 'utf8'));
  const footer = () => descendants(app.renderSettings()).find(node => node.type === 'footer');
  assert.ok(descendants(footer()).some(node => node.props.children.includes(`PowerDSH ${version}`)));
  assert.ok(descendants(footer()).some(node => node.props.children.includes('pluginUpdateCheck')));
  for (const tab of ['interface', 'enhancements', 'simplify', 'other']) {
    app.selectSettingsTab(tab);
    assert.equal(descendants(app.renderSettings()).filter(node => node.type === 'footer').length, 1);
  }
  app.set({ pluginUpdatesEnabled: false });
  assert.equal(footer(), undefined);
  app.set({ pluginUpdatesEnabled: true });
  assert.ok(footer());
  app.unmount();
});

test('read-only settings cannot initiate update reads and unavailable API errors use shared feedback', async () => {
  let requests = 0;
  const app = await mount({ writable: false, updateFetch: async () => { requests++; return new Response('', { status: 404 }); } });
  const check = descendants(app.renderSettings()).find(node => node.type === 'button' && node.props.children.includes('pluginUpdateCheck'));
  assert.equal(check.props.disabled, true);
  await check.props.onClick();
  assert.equal(requests, 0);
  app.unmount();
  const allowed = await mount({ updateFetch: async () => new Response('', { status: 404 }) });
  await descendants(allowed.renderSettings()).find(node => node.type === 'button' && node.props.children.includes('pluginUpdateCheck')).props.onClick();
  assert.ok(descendants(allowed.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes('pluginUpdateApiUnavailable')));
  allowed.unmount();
});

test('rate-limit feedback offers the releases page and opening settings never performs update checks', async () => {
  const app = await mount({ updateFetch: async url => url.endsWith('/capabilities')
    ? new Response('', { status: 429 }) : assert.fail(`Unexpected request: ${url}`) });
  await descendants(app.renderSettings()).find(node => node.type === 'button' && node.props.children.includes('pluginUpdateCheck')).props.onClick();
  const view = descendants(app.renderSettings());
  assert.ok(view.some(node => node.props.role === 'alert' && node.props.children.includes('pluginUpdateRateLimited')));
  const link = view.find(node => node.type === 'a' && node.props.href === 'https://github.com/mewcoder/power-dsh/releases');
  assert.equal(link.props.rel, 'noopener noreferrer');
  app.unmount();
});

test('checking and opening the confirmation never installs; only the current confirmed action submits once', async () => {
  const schema = 'dsh-market/update-api/v1';
  let posts = 0;
  const app = await mount({ updateFetch: async (url, init) => {
    let data;
    if (url.endsWith('/capabilities')) data = { schema, apiVersion: 1, stability: 'beta', bootId: 'boot',
      features: { check: true, update: true, progress: true }, endpoints: { updates: '/dsh-market/api/v1/updates', operations: '/dsh-market/api/v1/operations' } };
    else if (init.method === 'POST') {
      posts++;
      data = { schema, operation: { schema, operationId: 'boot-op', kind: 'update', packageName: 'power-dsh', state: 'queued' } };
    } else if (url.includes('/updates?')) data = { schema, package: { name: 'power-dsh', source: 'github', installedVersion: 'b'.repeat(40), latestVersion: 'a'.repeat(40), updateAvailable: true } };
    else if (url.includes('/git/ref/')) data = { object: { type: 'commit', sha: 'a'.repeat(40) } };
    else data = { tag_name: 'v0.0.999', draft: false, prerelease: false, html_url: 'https://github.com/mewcoder/power-dsh/releases/tag/v0.0.999',
      assets: [{ name: 'power-dsh.tgz', state: 'uploaded', browser_download_url: 'https://github.com/mewcoder/power-dsh/releases/download/v0.0.999/power-dsh.tgz' }] };
    return new Response(JSON.stringify(data));
  } });
  const view = () => descendants(app.renderSettings());
  await view().find(node => node.type === 'button' && node.props.children.includes('pluginUpdateCheck')).props.onClick();
  assert.equal(posts, 0);
  const open = () => view().find(node => node.type === 'button' && node.props.children.includes('pluginUpdateAction 0.0.999'));
  open().props.onClick();
  let dialog = view().find(node => node.type === 'native-modal-fixture');
  assert.ok(dialog);
  const staleConfirm = descendants(dialog).find(node => node.type === 'button' && node.props.children.includes('pluginUpdateAction')).props.onClick;
  dialog.props.onClose();
  await staleConfirm();
  assert.equal(posts, 0);
  open().props.onClick();
  dialog = view().find(node => node.type === 'native-modal-fixture');
  descendants(dialog).find(node => node.type === 'button' && node.props.children.includes('pluginUpdateAction')).props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(posts, 1);
  assert.equal(app.settingsProps().pluginUpdates.state.phase, 'updating');
  app.unmount();
});
