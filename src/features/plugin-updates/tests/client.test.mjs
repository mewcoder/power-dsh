import assert from 'node:assert/strict';
import { test } from 'node:test';
import { descendants, mount } from '../../../../tests/helpers/client-fixture.mjs';

test('plugin version is the last General setting row, always shown in General and stays manual', async () => {
  const app = await mount();
  const { version } = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../../../../package.json', import.meta.url), 'utf8'));
  const row = () => descendants(app.renderSettings()).find(node => node.props.role === 'group' && node.props['aria-label'] === 'pluginUpdateVersion');
  assert.ok(row().props.className.includes('power-dsh-setting-row'));
  assert.ok(descendants(row()).some(node => node.type === 'span' && node.props.children.includes(version)));
  assert.equal(descendants(row()).some(node => node.props.children.includes(`PowerDSH ${version}`)), false);
  assert.ok(descendants(row()).some(node => node.props.children.includes('pluginUpdateCheck')));
  const panel = descendants(app.renderSettings()).find(node => node.props.role === 'tabpanel');
  assert.equal(panel.props.children.at(-1).props['aria-label'], 'pluginUpdateVersion');
  const staleCheck = descendants(row()).find(node => node.type === 'button' && node.props.children.includes('pluginUpdateCheck')).props.onClick;
  for (const tab of ['interface', 'enhancements', 'simplify', 'other']) {
    app.selectSettingsTab(tab);
    assert.equal(row(), undefined);
    assert.equal(descendants(app.renderSettings()).filter(node => node.type === 'footer').length, 0);
  }
  await staleCheck();
  assert.equal(app.settingsProps().pluginUpdates.state.phase, 'idle');
  app.selectSettingsTab('general');
  assert.ok(row());
  app.settingsProps().pluginUpdates.publish({ phase: 'current', error: '', target: null });
  const versionLine = descendants(row()).find(node => node.props.className === 'power-dsh-description power-dsh-plugin-version');
  assert.ok(versionLine.props.children[0].props.children.includes(version));
  assert.equal(versionLine.props.children[1].props.role, 'status');
  assert.ok(versionLine.props.children[1].props.children.includes('pluginUpdateCurrent'));
  const check = descendants(row()).find(node => node.type === 'button' && node.props.children.includes('pluginUpdateCheck'));
  assert.equal(check.props.disabled, false);
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

test('update check errors pass specific evidence to shared details without a duplicate retry', async () => {
  const app = await mount({ updateFetch: async () => new Response('', { status: 502 }) });
  const view = () => descendants(app.renderSettings());
  await view().find(node => node.type === 'button' && node.props.children.includes('pluginUpdateCheck')).props.onClick();
  assert.equal(view().some(node => node.props.className === 'power-dsh-error-retry'), false);
  assert.equal(view().some(node => node.type === 'native-modal-fixture'), false);
  const details = view().find(node => typeof node.type === 'function' && node.props.code === 'PD-PLUGIN-UPDATE');
  assert.ok(details.props.context.stage.includes('market.capabilities'));
  assert.ok(details.props.context.actual.includes('HTTP 502'));
  assert.ok(details.props.observedAt);
  app.unmount();
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
  const hiddenConfirm = descendants(view().find(node => node.type === 'native-modal-fixture'))
    .find(node => node.type === 'button' && node.props.children.includes('pluginUpdateAction')).props.onClick;
  app.selectSettingsTab('interface');
  assert.equal(view().find(node => node.type === 'native-modal-fixture'), undefined);
  await hiddenConfirm();
  assert.equal(posts, 0);
  app.selectSettingsTab('general');
  await view().find(node => node.type === 'button' && node.props.children.includes('pluginUpdateCheck')).props.onClick();
  open().props.onClick();
  dialog = view().find(node => node.type === 'native-modal-fixture');
  descendants(dialog).find(node => node.type === 'button' && node.props.children.includes('pluginUpdateAction')).props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(posts, 1);
  assert.equal(app.settingsProps().pluginUpdates.state.phase, 'updating');
  app.unmount();
});
