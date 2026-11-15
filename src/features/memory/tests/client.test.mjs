import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mount, descendants } from '../../../../tests/helpers/client-fixture.mjs';

const flush = () => new Promise(resolve => setImmediate(resolve));
const refocus = async app => { app.focus(); await flush(); };
const row = { id: 'user/short-answers', name: 'short-answers', description: 'Keep answers short', type: 'user',
  created: '2026-11-14T00:00:00.000Z', updated: '2026-11-14T00:00:00.000Z',
  originSessionId: 'chat-1', revision: 'a'.repeat(64), invalid: false };
const catalog = entries => ({ path: '/test/memory', available: true, error: '',
  scopes: [{ id: 'global', cwd: '', complete: true, revision: 'b'.repeat(64), entries }] });
const text = node => [node?.props?.children].flat(Infinity).filter(value => typeof value === 'string').join('');
const buttons = view => descendants(view).filter(node => node.type === 'button');
const button = (view, label) => buttons(view).find(node => text(node) === label);
const modal = view => descendants(view).find(node => node.type === 'native-modal-fixture');
const scopeButton = (view, id = 'global') => buttons(view).find(node => node.props['data-memory-scope'] === id);
const namedButton = (view, label) => buttons(view).find(node => node.props['aria-label'] === label);
const folderButton = (view, name = 'Global memory') => namedButton(view, `Open memory folder for “${name}”`);
const cleanupButton = (view, name = 'Global memory') => namedButton(view, `Organize memories in “${name}”`);
const deleteScopeButton = (view, name = 'Global memory') => namedButton(view, `Delete memories in “${name}”`);
const cleanupNode = view => descendants(view).find(node => node.type?.name === 'MemoryCleanupDialog');

async function fixture(t, reply, options = {}) {
  const app = await mount({ featureIds: ['memory'], ...options });
  t.after(() => app.unmount());
  app.setMemoryReply(reply ?? (async () => ({ ok: true, value: catalog([row]) })));
  app.set({ memoryEnabled: true });
  const render = () => app.renderMemory('en');
  render();
  await flush();
  return { app, render };
}

test('manual cleanup uses current chat model, previews originals and only applies after confirmation', async t => {
  const current = { provider: 'provider', model: 'chat', reasoningEffort: 'low' };
  const models = { models: [{ ...current, label: 'Provider / Chat' }, { provider: 'provider', model: 'other', label: 'Provider / Other' }],
    default: { provider: 'provider', model: 'other' } };
  const { app, render } = await fixture(t, async (method, args) => {
    if (method === 'memoryCleanupModels') return { ok: true, value: models };
    if (method === 'prepareMemoryCleanup') {
      assert.equal(args[0], 'global');
      assert.deepEqual(JSON.parse(args[1]), current);
      return { ok: true, value: { token: args[2], scope: 'global', revision: 'b'.repeat(64),
        changes: [{ before: { ...row, content: 'Keep answers short, please.' }, description: row.description, content: 'Short answers.', removed: [], reason: 'Remove filler' }] } };
    }
    if (method === 'applyMemoryCleanup') return { ok: true, value: { indexUpdated: true, backup: '/test/memory-backups/job' } };
    return { ok: true, value: catalog([row]) };
  }, { modelDirectory: { current, status: 'ready', groups: [], error: null } });
  app.setSessions([{ id: 'active-chat', retainedBy: { mainView: 1 } }]);
  cleanupButton(render()).props.onClick();
  const dialog = cleanupNode(render());
  const renderDialog = () => app.renderComponent(dialog);
  renderDialog();
  await flush();
  const choices = descendants(renderDialog()).filter(node => node.type?.name === 'Choice');
  assert.match(choices[1].props.options[0].label, /Current chat/);
  assert.equal(app.memoryCalls.some(call => call.method === 'prepareMemoryCleanup'), false);
  await button(renderDialog(), 'Generate preview').props.onClick();
  assert.equal(app.memoryCalls.some(call => call.method === 'applyMemoryCleanup'), false);
  assert.match(JSON.stringify(renderDialog()), /Keep answers short, please/);
  assert.match(JSON.stringify(renderDialog()), /Short answers/);
  await button(renderDialog(), 'Apply').props.onClick();
  assert.equal(app.memoryCalls.filter(call => call.method === 'applyMemoryCleanup').length, 1);
  assert.match(JSON.stringify(renderDialog()), /memory-backups/);
});

test('cleanup labels host default honestly without a current chat and cancels a late preview when closed', async t => {
  let resolvePreview;
  const { app, render } = await fixture(t, async (method, args) => {
    if (method === 'memoryCleanupModels') return { ok: true, value: {
      models: [{ provider: 'provider', model: 'default', label: 'Configured' }], default: { provider: 'provider', model: 'default' } } };
    if (method === 'prepareMemoryCleanup') return new Promise(resolve => { resolvePreview = () => resolve({ ok: true,
      value: { token: args[2], scope: 'global', revision: 'b'.repeat(64), changes: [] } }); });
    if (method === 'cancelMemoryCleanup') return { ok: true, value: true };
    return { ok: true, value: catalog([row]) };
  });
  cleanupButton(render()).props.onClick();
  const dialog = cleanupNode(render());
  const renderDialog = () => app.renderComponent(dialog);
  renderDialog();
  await flush();
  const choices = descendants(renderDialog()).filter(node => node.type?.name === 'Choice');
  assert.match(choices[1].props.options[0].label, /Default/);
  const pending = button(renderDialog(), 'Generate preview').props.onClick();
  modal(renderDialog()).props.onClose();
  resolvePreview();
  await pending;
  assert.equal(cleanupNode(render()), undefined);
  assert.equal(app.memoryCalls.filter(call => call.method === 'cancelMemoryCleanup').length, 1);
  assert.equal(app.memoryCalls.some(call => call.method === 'applyMemoryCleanup'), false);
});

test('the accessible main switch controls automatic, global and project preferences', async t => {
  const app = await mount({ featureIds: ['memory'] });
  t.after(() => app.unmount());
  assert.equal(app.entries.has('settings.section:power-dsh-memory'), false);
  const settings = app.selectSettingsTab('enhancements');
  const control = descendants(settings).find(node => node.props.role === 'switch');
  assert.ok(control);
  await control.props.onClick();
  assert.equal(app.entries.has('settings.section:power-dsh-memory'), true);
  app.renderMemory('en');
  await flush();
  const switches = descendants(app.renderMemory('en')).filter(node => node.props.role === 'switch');
  assert.deepEqual(switches.map(node => node.props['aria-checked']), [true, true, true]);
  await switches[0].props.onClick();
  assert.deepEqual(descendants(app.renderMemory('en')).filter(node => node.props.role === 'switch')
    .map(node => node.props['aria-checked']), [false, true, true]);
  app.set({ memoryEnabled: false });
  assert.equal(app.entries.has('settings.section:power-dsh-memory'), false);
  assert.equal(app.entries.has('settings.section.icon:power-dsh-memory'), false);
});

test('read uses native detail rendering and deletion is the only entry action with revision confirmation', async t => {
  let entries = [row];
  const { app, render } = await fixture(t, async (method, args) => {
    if (method === 'listMemoryEntries') return { ok: true, value: catalog(entries) };
    if (method === 'readMemoryEntry') return { ok: true, value: { ...entries[0],
      path: '/test/memory/short-answers.md', content: '# Saved preference\nShort answers.' } };
    if (method === 'deleteMemoryEntry') {
      assert.deepEqual(args, ['global', row.id, row.revision]);
      entries = [];
    }
    return { ok: true, value: { indexUpdated: true } };
  });
  scopeButton(render()).props.onClick();
  await descendants(render()).find(node => node.props.className === 'power-dsh-memory-open').props.onClick();
  assert.ok(descendants(render()).some(node => node.type === 'native-markdown-fixture' && node.props.omitHtml === true));
  assert.equal(modal(render()).props.title, row.description);
  const metadata = descendants(modal(render())).find(node => node.props.className === 'power-dsh-memory-meta');
  assert.equal(text(metadata), 'File: short-answers.md');
  assert.doesNotMatch(JSON.stringify(modal(render())), /\/test\/memory/);
  modal(render()).props.onClose();
  assert.equal(button(render(), 'Pin'), undefined);
  assert.equal(button(render(), 'Unpin'), undefined);
  assert.equal(app.rpcDescriptors.some(descriptor => descriptor.method === 'setMemoryPinned'), false);
  button(render(), 'Delete').props.onClick();
  assert.equal(app.memoryCalls.filter(call => call.method === 'deleteMemoryEntry').length, 0);
  await button(modal(render()), 'Confirm').props.onClick();
  assert.equal(app.memoryCalls.filter(call => call.method === 'deleteMemoryEntry').length, 1);
  assert.equal(descendants(render()).filter(node => node.props.className === 'power-dsh-memory-row').length, 0);
  assert.equal(scopeButton(render()), undefined);
  assert.match(JSON.stringify(render()), /No memories yet/);
});

test('failed refresh preserves the confirmed list and disables writes until recovery', async t => {
  const { app, render } = await fixture(t);
  scopeButton(render()).props.onClick();
  app.setMemoryReply(async () => ({ ok: false, error: { message: 'memoryLoadFailed /private/path?token=secret' } }));
  await refocus(app);
  const failed = render();
  assert.equal(descendants(failed).filter(node => node.props.className === 'power-dsh-memory-row').length, 1);
  assert.equal(button(failed, 'Delete').props.disabled, true);
  assert.ok(descendants(failed).some(node => node.props['data-error-code'] === 'PD-MEMORY-LOAD'));
  assert.doesNotMatch(JSON.stringify(failed), /private\/path|token=secret/);
  assert.ok(descendants(failed).filter(node => node.props.role === 'switch').every(node => !node.props.disabled),
    'A disk error must not block independent configuration changes.');
  app.setMemoryReply(async () => ({ ok: true, value: catalog([row]) }));
  await refocus(app);
  assert.equal(button(render(), 'Delete').props.disabled, false);
});

test('read-only clients can view memories but cannot change settings or delete entries', async t => {
  const { render } = await fixture(t, undefined, { writable: false });
  assert.ok(descendants(render()).filter(node => node.props.role === 'switch').every(node => node.props.disabled));
  assert.equal(folderButton(render()).props.disabled, true);
  scopeButton(render()).props.onClick();
  assert.equal(button(render(), 'Delete').props.disabled, true);
  assert.equal(namedButton(render(), 'Clear memories in “Global memory”'), undefined);
});

test('closing a detail or changing Host generation discards late reads and confirmations', async t => {
  let resolveDetail;
  const { app, render } = await fixture(t, async method => method === 'readMemoryEntry'
    ? new Promise(resolve => { resolveDetail = resolve; })
    : { ok: true, value: catalog([row]) });
  scopeButton(render()).props.onClick();
  const reading = descendants(render()).find(node => node.props.className === 'power-dsh-memory-open').props.onClick();
  modal(render()).props.onClose();
  resolveDetail({ ok: true, value: { ...row, path: '/test/memory/short-answers.md', content: 'late secret detail' } });
  await reading;
  assert.equal(modal(render()), undefined);
  button(render(), 'Delete').props.onClick();
  assert.ok(modal(render()));
  app.setConnectionGeneration({ id: 99 });
  render();
  await flush();
  assert.equal(modal(render()), undefined);
});

test('delete confirmation carries the entry revision and an index failure reports committed changes', async t => {
  const { app, render } = await fixture(t, async (method, args) => {
    if (method === 'deleteMemoryEntry') {
      assert.deepEqual(args, ['global', row.id, row.revision]);
      return { ok: true, value: { indexUpdated: false } };
    }
    return { ok: true, value: catalog([row]) };
  });
  scopeButton(render()).props.onClick();
  button(render(), 'Delete').props.onClick();
  assert.equal(app.memoryCalls.filter(call => call.method === 'deleteMemoryEntry').length, 0);
  await button(modal(render()), 'Confirm').props.onClick();
  assert.equal(modal(render()), undefined);
  assert.ok(descendants(render()).some(node => node.props['data-error-code'] === 'PD-MEMORY-ACTION'));
  assert.match(JSON.stringify(render()), /change was saved/);
});

test('reconnection releases old operation busy state without letting its late response unlock a newer request', async t => {
  const replies = [];
  const { app, render } = await fixture(t, async method => method === 'deleteMemoryEntry'
    ? new Promise(resolve => replies.push(resolve)) : { ok: true, value: catalog([row]) });
  scopeButton(render()).props.onClick();
  button(render(), 'Delete').props.onClick();
  const original = button(modal(render()), 'Confirm').props.onClick();
  assert.equal(button(render(), 'Delete').props.disabled, true);
  app.setConnectionGeneration({ id: 2 });
  render();
  await flush();
  assert.equal(button(render(), 'Delete').props.disabled, false);
  button(render(), 'Delete').props.onClick();
  const newer = button(modal(render()), 'Confirm').props.onClick();
  replies[0]({ ok: true, value: { indexUpdated: true } });
  await original;
  assert.equal(button(render(), 'Delete').props.disabled, true);
  replies[1]({ ok: true, value: { indexUpdated: true } });
  await newer;
  assert.equal(button(render(), 'Delete').props.disabled, false);
});

test('an empty library guides capture and explains memory through the description help icon', async t => {
  const { app, render } = await fixture(t, async () => ({ ok: true, value: catalog([]) }));
  const view = render();
  const empty = descendants(view).find(node => node.props.className === 'power-dsh-memory-empty');
  assert.equal(empty.props.role, 'status');
  assert.match(JSON.stringify(empty), /No memories yet/);
  assert.match(JSON.stringify(empty), /Useful information from chats is remembered automatically/);
  assert.equal(descendants(empty).filter(node => node.type === 'p').length, 2);
  const brain = empty.props.children.find(node => typeof node?.type === 'function');
  assert.equal(brain.type(brain.props).type, 'svg');
  assert.equal(button(view, 'Clear'), undefined);
  assert.equal(descendants(view).some(node => node.props.className === 'power-dsh-memory-group'), false);
  assert.equal(descendants(view).some(node => node.props.type === 'search'), false);
  assert.equal(button(view, 'Refresh'), undefined);
  assert.equal(descendants(view).filter(node => node.type === 'header').length, 1);
  assert.equal(descendants(view).some(node => text(node) === 'Saved memories'), false);
  assert.equal(descendants(view).some(node => node.props.className === 'power-dsh-memory-storage'), false);
  assert.equal(descendants(view).some(node => node.type === 'details' || node.type === 'summary'), false);
  const header = descendants(view).find(node => node.type === 'header');
  const explanation = descendants(header).find(node => node.type === 'native-tooltip-fixture');
  const anchor = descendants(explanation).find(node => node.props.className === 'power-dsh-memory-help');
  assert.equal(anchor.props.tabIndex, 0);
  assert.equal(anchor.props['aria-label'], explanation.props.label);
  assert.equal(explanation.props.portal, true);
  assert.equal(explanation.props.delayMs, 0);
  const icon = anchor.props.children[0];
  assert.equal(icon.props.glyph, 'question-outline');
  assert.equal(icon.props.size, 14);
  assert.equal(explanation.props.label,
    'Automatically remember your preferences and project details for future chats\nSaved on this device: /test/memory');
  assert.equal(descendants(view).filter(node => text(node).includes('/test/memory')).length, 0);
  const chinese = app.renderMemory('zh');
  const chineseHelp = descendants(chinese).find(node => node.props.className === 'power-dsh-memory-help');
  assert.equal(chineseHelp.props['aria-label'], '自动记住你的偏好和项目要点，下次聊天接着用\n本机保存位置：/test/memory');
  assert.match(JSON.stringify(chinese), /聊天中的有用信息会自动记录/);
});

test('loading and failed reads never display a successful empty-library message', async t => {
  const { app, render } = await fixture(t, async () => ({ ok: true, value: catalog([]) }));
  let resolveRead;
  app.setMemoryReply(() => new Promise(resolve => { resolveRead = resolve; }));
  app.focus();
  assert.equal(descendants(render()).some(node => node.props.className === 'power-dsh-memory-empty'), false);
  assert.ok(descendants(render()).some(node => node.props.role === 'status'));
  resolveRead({ ok: false, error: { message: 'memoryLoadFailed' } });
  await flush();
  assert.equal(descendants(render()).some(node => node.props.className === 'power-dsh-memory-empty'), false);
  assert.ok(descendants(render()).some(node => node.props['data-error-code'] === 'PD-MEMORY-LOAD'));
  app.setMemoryReply(async () => ({ ok: true, value: catalog([]) }));
  const retry = descendants(render()).find(node => node.props.className === 'power-dsh-error-retry');
  assert.ok(retry);
  await retry.props.onClick();
  assert.match(JSON.stringify(render()), /No memories yet/);
});

test('the mechanism hint works before a directory is available and uses the confirmed path after recovery', async t => {
  const { app, render } = await fixture(t, async () => ({ ok: false, error: { message: 'memoryUnavailable' } }));
  const hint = () => descendants(render()).find(node => node.props.className === 'power-dsh-memory-help').props['aria-label'];
  assert.match(hint(), /Memories are saved locally/);
  assert.doesNotMatch(hint(), /undefined|null|\/test\/memory/);
  app.setMemoryReply(async () => ({ ok: true, value: catalog([row]) }));
  await refocus(app);
  assert.match(hint(), /Saved on this device: \/test\/memory/);
  const chineseHelp = descendants(app.renderMemory('zh')).find(node => node.props.className === 'power-dsh-memory-help');
  assert.match(chineseHelp.props['aria-label'], /记住你的偏好和项目要点，下次聊天接着用/);
  assert.match(chineseHelp.props['aria-label'], /本机保存位置：\/test\/memory/);
});

test('expanded scopes show every entry directly and keep actions in the group header', async t => {
  const entries = [row, { ...row, id: 'project/build', name: 'build', type: 'project', description: 'Build command' }];
  const { render } = await fixture(t, async () => ({ ok: true, value: catalog(entries) }));
  assert.deepEqual(descendants(scopeButton(render())).find(node => node.props.className === 'power-dsh-memory-count').props.children, [2]);
  scopeButton(render()).props.onClick();
  assert.equal(descendants(render()).some(node => node.props.type === 'search'), false);
  assert.equal(descendants(render()).filter(node => node.props.className === 'power-dsh-memory-row').length, 2);
  assert.ok(deleteScopeButton(render()));
  assert.ok(folderButton(render()));
  assert.equal(descendants(render()).some(node => node.type === 'native-menu-fixture'), false);
  assert.equal(descendants(render()).filter(node => node.props.className === 'power-dsh-memory-row').length, 2);
});

test('incomplete project scopes retain their warning and folder access in either view', async t => {
  const partial = catalog([row]);
  partial.scopes.push({ id: 'workspace-id', cwd: '/test/project', complete: false, entries: [row], revision: '' });
  const { app, render } = await fixture(t, async () => ({ ok: true, value: partial }));
  assert.ok(descendants(render()).some(node => node.props['data-error-code'] === 'PD-MEMORY-LIMIT'));
  assert.equal(folderButton(render(), 'project').props.disabled, false);
  assert.equal(deleteScopeButton(render(), 'project').props.disabled, true);
  assert.equal(cleanupButton(render(), 'project').props.disabled, true);
  scopeButton(render(), 'workspace-id').props.onClick();
  assert.equal(descendants(render()).some(node => node.props.type === 'search'), false);
  assert.ok(descendants(render()).some(node => node.props['data-error-code'] === 'PD-MEMORY-LIMIT'));
  assert.equal(folderButton(render(), 'project').props.disabled, false);
  assert.equal(descendants(render()).some(node => text(node) === 'No memories yet'), false);
  partial.scopes[1].entries = [];
  await refocus(app);
  assert.ok(descendants(render()).some(node => node.props['data-error-code'] === 'PD-MEMORY-LIMIT'));
  assert.equal(descendants(render()).some(node => text(node) === 'No memories yet'), false);
});

test('overview groups expose adjacent neutral organize, folder and delete icons without a page action', async t => {
  const value = catalog([row, { ...row, id: 'user/newer', name: 'newer', updated: new Date(2026, 10, 15, 13, 47).toISOString() }]);
  value.scopes.push({ id: 'project-a', cwd: '/test/power-dsh', complete: true, revision: 'c'.repeat(64), entries: [row] },
    { id: 'project-b', cwd: 'C:\\work\\another-project', complete: true, revision: 'd'.repeat(64), entries: [row] });
  const { render } = await fixture(t, async () => ({ ok: true, value }));
  const view = render();
  assert.equal(buttons(view).filter(node => node.props['data-memory-scope']).length, 3);
  assert.equal(descendants(view).some(node => text(node) === 'Saved memories'), false);
  assert.equal(button(view, 'Refresh'), undefined);
  assert.equal(descendants(view).filter(node => node.props.className === 'power-dsh-memory-row').length, 0);
  assert.equal(descendants(view).some(node => node.props.type === 'search' || node.type === 'native-menu-fixture'), false);
  const name = trigger => text(descendants(trigger).find(node => node.props.className === 'power-dsh-memory-scope-name'));
  assert.equal(name(scopeButton(view)), 'Global memory');
  assert.equal(name(scopeButton(view, 'project-a')), 'power-dsh');
  assert.equal(name(scopeButton(view, 'project-b')), 'another-project');
  for (const trigger of buttons(view).filter(node => node.props['data-memory-scope'])) {
    assert.equal(descendants(trigger).some(node => ['globe-outline', 'folder-close'].includes(node.props.glyph)), false);
    const children = trigger.props.children.flat(Infinity);
    assert.equal(children[0].props.className, 'power-dsh-memory-chevron');
    assert.equal(children[0].props.width, 12);
    assert.ok(descendants(children[0]).some(node => node.props.href === '#dsw-icon-chevron-down-outline-regular'));
    assert.equal(children[1].props.className, 'power-dsh-memory-scope-name');
  }
  assert.deepEqual(descendants(scopeButton(view)).find(node => node.props.className === 'power-dsh-memory-count').props.children, [2]);
  assert.doesNotMatch(JSON.stringify(scopeButton(view)), /2026-11-15|Updated/);
  const headers = descendants(view).filter(node => node.props.className === 'power-dsh-memory-scope-row');
  for (const header of headers) {
    assert.equal(buttons(header).length, 4);
    const folder = buttons(header).find(node => node.props.className === 'power-dsh-memory-folder');
    assert.equal(text(folder), '');
    assert.equal(folder.props.children[0].props.glyph, 'folder-open-outline');
    assert.equal(folder.props.children[0].props.size, 16);
    assert.ok(descendants(header).some(node => node.type === 'native-tooltip-fixture' && node.props.label === folder.props['aria-label']));
    const actions = buttons(header).slice(1);
    assert.equal(actions[1].props.children[0].props.glyph, 'folder-open-outline');
    assert.equal(actions[2].props.children[0].props.glyph, 'trash-outline');
    const cleanupIcon = actions[0].props.children[0];
    assert.equal(cleanupIcon.type, 'svg');
    assert.equal(cleanupIcon.props.width, 16);
    assert.equal(cleanupIcon.props.height, 16);
    assert.equal(cleanupIcon.props['aria-hidden'], true);
    assert.ok(actions.every(action => text(action) === '' && action.props['aria-label']));
    assert.equal(actions[2].props.className, actions[0].props.className);
    assert.doesNotMatch(actions[2].props.className, /power-dsh-memory-delete/);
  }
  assert.equal(button(view, 'Organize memories'), undefined);
  assert.ok(descendants(view).some(node => node.type === 'native-tooltip-fixture' && node.props.label === '/test/power-dsh'));
  assert.equal(text(scopeButton(view)).includes('short-answers'), false);
});

test('group organization starts with the clicked project and does not expand the group', async t => {
  const value = catalog([row]);
  value.scopes.push({ id: 'project-id', cwd: '/test/project', complete: true, revision: 'c'.repeat(64), entries: [row] });
  const { render } = await fixture(t, async () => ({ ok: true, value }));
  cleanupButton(render(), 'project').props.onClick();
  assert.equal(cleanupNode(render()).props.initialScope, 'project-id');
  assert.equal(scopeButton(render(), 'project-id').props['aria-expanded'], false);
});

test('group deletion confirms the scope snapshot, permits cancellation and preserves other groups', async t => {
  const value = catalog([row]);
  value.scopes.push({ id: 'project-id', cwd: '/test/project', complete: true, revision: 'c'.repeat(64), entries: [row] });
  const { app, render } = await fixture(t, async (method, args) => {
    if (method === 'clearMemoryScope') {
      assert.deepEqual(args, ['global', 'b'.repeat(64)]);
      value.scopes[0].entries = [];
      return { ok: true, value: { indexUpdated: true } };
    }
    return { ok: true, value };
  });
  deleteScopeButton(render()).props.onClick();
  assert.match(modal(render()).props.description, /all memories in “Global memory”/);
  assert.equal(app.memoryCalls.some(call => call.method === 'clearMemoryScope'), false);
  button(render(), 'Cancel').props.onClick();
  assert.equal(modal(render()), undefined);
  deleteScopeButton(render()).props.onClick();
  await button(render(), 'Confirm').props.onClick();
  assert.equal(scopeButton(render()), undefined);
  assert.ok(scopeButton(render(), 'project-id'));
  assert.equal(value.scopes[1].entries.length, 1);
});

test('group deletion conflicts preserve the group and read-only actions cannot open management dialogs', async t => {
  const { app, render } = await fixture(t, async method => method === 'clearMemoryScope'
    ? { ok: false, error: { message: 'memoryConflict' } } : { ok: true, value: catalog([row]) });
  deleteScopeButton(render()).props.onClick();
  await button(render(), 'Confirm').props.onClick();
  assert.ok(scopeButton(render()));
  assert.ok(modal(render()));
  assert.equal(descendants(render()).find(node => node.props.role === 'alert').props.children[0], 'memoryConflict');
  assert.equal(app.memoryCalls.filter(call => call.method === 'clearMemoryScope').length, 1);
  const readonly = await fixture(t, undefined, { writable: false });
  for (const control of [deleteScopeButton(readonly.render()), cleanupButton(readonly.render())]) {
    assert.equal(control.props.disabled, true);
    control.props.onClick();
  }
  assert.equal(modal(readonly.render()), undefined);
  assert.equal(cleanupNode(readonly.render()), undefined);
});

test('groups expand independently and restore all entries when reopened', async t => {
  const value = catalog([row]);
  value.scopes.push({ id: 'project-id', cwd: '/test/project', complete: true, revision: 'c'.repeat(64),
    entries: [{ ...row, description: 'Use TypeScript' }] });
  const { render } = await fixture(t, async () => ({ ok: true, value }));
  assert.equal(scopeButton(render()).props['aria-expanded'], false);
  assert.equal(scopeButton(render(), 'project-id').props['aria-expanded'], false);
  const panel = (view, id) => {
    const trigger = scopeButton(view, id);
    const section = descendants(view).find(node => node.type === 'section' && node.props['aria-labelledby'] === trigger.props.id);
    return section.props.children.flat(Infinity).find(node => node?.props?.id === trigger.props['aria-controls']);
  };
  assert.equal(panel(render(), 'global').props.hidden, true);
  scopeButton(render()).props.onClick();
  assert.equal(scopeButton(render()).props['aria-expanded'], true);
  assert.equal(panel(render(), 'global').props.hidden, false);
  assert.ok(scopeButton(render(), 'project-id'));
  const title = descendants(render()).find(node => node.props.className === 'power-dsh-memory-name');
  assert.equal(text(title), 'Keep answers short');
  const entry = descendants(render()).find(node => node.props.className === 'power-dsh-memory-row');
  assert.equal(descendants(entry).some(node => text(node).includes('short-answers')), false);
  scopeButton(render()).props.onClick();
  assert.equal(panel(render(), 'global').props.hidden, true);
  scopeButton(render(), 'project-id').props.onClick();
  assert.equal(descendants(render()).some(node => node.props.type === 'search'), false);
  assert.match(JSON.stringify(render()), /Use TypeScript/);
  scopeButton(render()).props.onClick();
  assert.equal(scopeButton(render(), 'project-id').props['aria-expanded'], true);
  assert.equal(scopeButton(render()).props['aria-expanded'], true);
  assert.equal(descendants(panel(render(), 'global')).filter(node => node.props.className === 'power-dsh-memory-row').length, 1);
  assert.equal(descendants(panel(render(), 'project-id')).filter(node => node.props.className === 'power-dsh-memory-row').length, 1);
  assert.equal(buttons(render()).some(node => node.props.autoFocus), false);
});

test('refresh preserves expanded groups and their entries when another scope disappears', async t => {
  const value = catalog([row]);
  const project = { id: 'project-id', cwd: '/test/project', complete: true, revision: 'c'.repeat(64), entries: [row] };
  value.scopes.push(project);
  const { app, render } = await fixture(t, async () => ({ ok: true, value }));
  scopeButton(render(), 'project-id').props.onClick();
  scopeButton(render()).props.onClick();
  await refocus(app);
  assert.equal(scopeButton(render()).props['aria-expanded'], true);
  assert.equal(descendants(render()).filter(node => node.props.className === 'power-dsh-memory-row').length, 2);
  value.scopes.pop();
  await refocus(app);
  render();
  assert.ok(scopeButton(render()));
  assert.equal(scopeButton(render(), 'project-id'), undefined);
  assert.equal(scopeButton(render()).props['aria-expanded'], true);
});

test('each collapsed scope opens its own folder without changing expansion or reloading memories', async t => {
  const value = catalog([row]);
  const projectId = 'c'.repeat(64);
  value.scopes.push({ id: projectId, cwd: '/test/project', complete: true, revision: 'd'.repeat(64), entries: [row] });
  const { app, render } = await fixture(t, async method => ({ ok: true, value: method === 'openMemoryFolder' ? true : value }));
  await namedButton(render(), 'Open memory folder for “Global memory”').props.onClick();
  await namedButton(render(), 'Open memory folder for “project”').props.onClick();
  assert.deepEqual(app.memoryCalls.filter(call => call.method === 'openMemoryFolder').map(call => call.args), [['global'], [projectId]]);
  assert.equal(app.memoryCalls.filter(call => call.method === 'listMemoryEntries').length, 1);
  assert.equal(scopeButton(render()).props['aria-expanded'], false);
  assert.equal(scopeButton(render(), projectId).props['aria-expanded'], false);
  assert.equal(modal(render()), undefined);
  const chinese = app.renderMemory('zh');
  assert.ok(namedButton(chinese, '打开“全局记忆”的记忆文件夹'));
  assert.ok(namedButton(chinese, '打开“project”的记忆文件夹'));
  assert.equal(button(chinese, '打开文件夹'), undefined);
});

test('folder failures preserve memories and allow retry while busy or read-only gestures cannot open twice', async t => {
  let respond;
  const { app, render } = await fixture(t, async method => method === 'openMemoryFolder'
    ? new Promise(resolve => { respond = resolve; }) : { ok: true, value: catalog([row]) }, { localeLanguage: 'en' });
  const opening = folderButton(render()).props.onClick();
  assert.equal(folderButton(render()).props.disabled, true);
  await folderButton(render()).props.onClick();
  assert.equal(app.memoryCalls.filter(call => call.method === 'openMemoryFolder').length, 1);
  respond({ ok: false, error: { message: 'memoryFolderUnavailable' } });
  await opening;
  assert.match(JSON.stringify(render()), /This environment cannot open folders/);
  assert.ok(scopeButton(render()));
  assert.equal(folderButton(render()).props.disabled, false);
  app.setMemoryReply(async () => ({ ok: true, value: true }));
  await folderButton(render()).props.onClick();
  assert.equal(descendants(render()).some(node => node.props['data-error-code'] === 'PD-MEMORY-ACTION'), false);
  const readonly = await fixture(t, undefined, { writable: false });
  assert.equal(folderButton(readonly.render()).props.disabled, true);
  await folderButton(readonly.render()).props.onClick();
  assert.equal(readonly.app.memoryCalls.some(call => call.method === 'openMemoryFolder'), false);
});

test('a late folder failure after reconnection cannot overwrite the recovered page', async t => {
  let respond;
  const { app, render } = await fixture(t, async method => method === 'openMemoryFolder'
    ? new Promise(resolve => { respond = resolve; }) : { ok: true, value: catalog([row]) });
  const opening = folderButton(render()).props.onClick();
  app.setConnectionGeneration({ id: 2 });
  render();
  await flush();
  respond({ ok: false, error: { message: 'memoryOpenFolderFailed' } });
  await opening;
  assert.equal(folderButton(render()).props.disabled, false);
  assert.equal(descendants(render()).some(node => node.props['data-error-code'] === 'PD-MEMORY-ACTION'), false);
});

test('entry dates show local hours and minutes while scope headers have no dates', async t => {
  const updated = new Date(2026, 10, 14, 9, 27, 36).toISOString();
  const { render } = await fixture(t, async () => ({ ok: true, value: catalog([
    { ...row, updated }, { ...row, id: 'user/broken', name: 'broken', updated: '', invalid: true },
  ]) }));
  assert.doesNotMatch(JSON.stringify(scopeButton(render())), /2026-11-14|09:27/);
  scopeButton(render()).props.onClick();
  const dates = descendants(render()).filter(node => node.props.className === 'power-dsh-memory-meta').map(text);
  assert.deepEqual(dates, ['2026-11-14 09:27', 'Invalid format']);
  assert.doesNotMatch(dates.join(' '), /09:27:36|Invalid Date/);
});
