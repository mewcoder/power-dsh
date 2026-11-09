import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mount, descendants, personalization } from '../../../../tests/helpers/client-fixture.mjs';

test('personalization read failures appear before the editor with error semantics', async () => {
  const app = await mount({ fileReadError: 'Cannot read global AGENTS.md' });
  try {
    app.set({ personalizationEnabled: true });
    const page = await personalization(app);
    const view = page.render();
    const notice = view.find(node => node.props['data-error-code'] === 'PD-PERSONALIZATION-LOAD');
    assert.ok(notice.props.children.includes('Cannot read global AGENTS.md'));
    assert.equal(notice.props.role, 'alert');
    assert.equal(notice.props['data-tone'], 'error');
    assert.ok(view.indexOf(view.find(node => node.type === 'header')) < view.indexOf(notice));
    assert.ok(view.indexOf(notice) < view.indexOf(view.find(node => node.type === 'textarea')));
    assert.equal(page.editor().props.disabled, true);
    assert.equal(app.fileWrites.length, 0);
  } finally { app.unmount(); }
});

test('personalization loading and read-only notices remain before the editor without error semantics', async t => {
  for (const state of ['loading', 'readOnly']) await t.test(state, async () => {
    const app = await mount({ writable: state !== 'readOnly' });
    try {
      app.set({ personalizationEnabled: true });
      if (state === 'readOnly') await personalization(app);
      const view = descendants(app.renderPersonalization());
      const notice = view.find(node => node.props.className === 'power-dsh-notice');
      assert.ok(notice.props.children.includes(state));
      assert.equal(notice.props.role, 'status');
      assert.equal(notice.props['data-tone'], 'neutral');
      assert.ok(view.indexOf(notice) < view.indexOf(view.find(node => node.type === 'textarea')));
    } finally { app.unmount(); }
  });
});

test('personalization saves explicitly, cancels edits and preserves saved text when disabled', async () => {
  const writes = [];
  const app = await mount({ fileText: '已保存', formReply: async (field, value) => { writes.push({ field, value }); return true; } });
  app.set({ personalizationEnabled: true });
  const page = await personalization(app);
  assert.equal(page.editor().props.value, '已保存');
  const header = page.render().find(node => node.type === 'header');
  assert.equal(header.props.children.length, 2);
  assert.ok(header.props.children[0].props.children.includes('personalizationTab'));
  assert.ok(header.props.children[1].props.children.includes('全局指令（/test-dsh-home/AGENTS.md）'));
  assert.ok(!page.render().some(node => node.props.id?.endsWith('-prompt-count')));
  const actions = page.render().find(node => node.props.className === 'power-dsh-prompt-actions');
  assert.deepEqual(actions.props.children.map(node => node.props.children[0]), ['cancel', 'save']);
  assert.ok(!page.render().some(node => node.type === 'label'));
  assert.equal(page.editor().props.placeholder, 'globalPromptPlaceholder');
  page.editor().props.onChange({ target: { value: '中文草稿 {{literal}}' } });
  assert.equal(writes.length, 0);
  assert.equal(page.editor().props.value, '中文草稿 {{literal}}');
  page.action('cancel').props.onClick();
  assert.equal(page.editor().props.value, '已保存');
  page.editor().props.onChange({ target: { value: '中文保存 {{literal}}' } });
  await page.action('save').props.onClick();
  assert.equal(writes.length, 0);
  assert.deepEqual(app.fileWrites, [{ text: '中文保存 {{literal}}', revision: '1'.padStart(64, '0') }]);
  assert.equal(page.action('save').props.disabled, true);
  app.selectSettingsTab('enhancements');
  const toggle = () => descendants(app.renderSettings()).find(node => node.props.id === 'settings-test-personalizationEnabled');
  await toggle().props.onClick();
  assert.deepEqual(writes.at(-1), { field: 'personalizationEnabled', value: false });
  assert.ok(!app.entries.has('settings.section:power-dsh-personalization'));
  await toggle().props.onClick();
  assert.equal(page.editor().props.value, '中文保存 {{literal}}');
  // Empty text is a real save, allowing users to clear their instructions.
  page.editor().props.onChange({ target: { value: '' } });
  await page.action('save').props.onClick();
  assert.equal(app.fileWrites.at(-1).text, '');
  app.unmount();
});

test('failed saves retain drafts and slow saves prevent duplicate submissions', async () => {
  const response = Promise.withResolvers();
  let writes = 0;
  const app = await mount({ fileText: '原内容', fileReply: async () => { writes++; return response.promise; } });
  app.set({ personalizationEnabled: true });
  const page = await personalization(app);
  page.editor().props.onChange({ target: { value: '未丢失的草稿' } });
  const save = page.action('save').props.onClick;
  const pendingSave = save();
  assert.equal(page.editor().props.disabled, true);
  assert.equal(page.action('saving').props['aria-busy'], true);
  await save();
  assert.equal(writes, 1);
  response.resolve(false);
  await pendingSave;
  assert.equal(page.editor().props.value, '未丢失的草稿');
  assert.ok(page.render().some(node => node.props.role === 'alert' && node.props.children.includes('saveFailed')));
  page.action('cancel').props.onClick();
  assert.equal(page.editor().props.value, '原内容');
  app.unmount();
});

test('personalization detects remote changes and length limits, and respects read-only settings', async () => {
  const app = await mount();
  app.set({ personalizationEnabled: true });
  const page = await personalization(app);
  page.editor().props.onChange({ target: { value: '本地草稿' } });
  app.setFile('其他窗口保存');
  await app.reloadInstructions();
  assert.equal(page.editor().props.value, '本地草稿');
  assert.equal(page.action('save').props.disabled, true);
  assert.ok(page.render().some(node => node.props.children.includes('promptConflict')));
  page.action('cancel').props.onClick();
  assert.equal(page.editor().props.value, '其他窗口保存');
  page.editor().props.onChange({ target: { value: '字'.repeat(20001) } });
  assert.equal(page.action('save').props.disabled, true);
  assert.equal(page.editor().props['aria-invalid'], true);
  assert.ok(page.render().some(node => node.props.children.includes('promptTooLong')));
  app.unmount();
  const readOnly = await mount({ writable: false });
  readOnly.set({ personalizationEnabled: true });
  const locked = await personalization(readOnly);
  assert.equal(locked.editor().props.disabled, true);
  assert.equal(locked.action('save').props.disabled, true);
  assert.ok(!locked.render().some(node => node.props.role === 'switch'));
  readOnly.selectSettingsTab('enhancements');
  assert.equal(descendants(readOnly.renderSettings()).find(node => node.props.id === 'settings-test-personalizationEnabled').props.disabled, true);
  readOnly.unmount();
});

test('the Mod switch adds a separate native personalization tab and icon, without duplicate registrations or subscriptions', async () => {
  const app = await mount();
  const section = 'settings.section:power-dsh-personalization';
  const icon = 'settings.section.icon:power-dsh-personalization';
  const count = app.entries.size;
  const subscriptions = app.subscriptions();
  assert.ok(!app.entries.has(section));
  assert.ok(!app.entries.has(icon));
  for (let index = 0; index < 3; index++) {
    app.set({ personalizationEnabled: true });
    const entry = app.entries.get(section);
    assert.equal(entry.options.label(), 'personalizationTab');
    assert.ok(app.entries.has(icon));
    assert.ok(descendants(app.renderPersonalization()).some(node => node.type === 'textarea'));
    assert.ok(!descendants(app.renderPersonalization()).some(node => node.props.role === 'switch'));
    app.set({ globalPrompt: '保存内容' });
    assert.equal(app.entries.get(section), entry);
    assert.equal(app.entries.size, count + 2);
    app.set({ personalizationEnabled: false });
    assert.ok(!app.entries.has(section));
    assert.ok(!app.entries.has(icon));
    assert.equal(app.entries.size, count);
    assert.equal(app.subscriptions(), subscriptions);
  }
  app.set({ personalizationEnabled: true });
  app.unmount();
  assert.ok(!app.entries.has(section));
  assert.ok(!app.entries.has(icon));
  assert.equal(app.subscriptions(), 0);
});

test('personalization refreshes Host settings and leaves a rejected switch off without inline hints', async () => {
  const writes = [];
  let upgraded = false;
  const app = await mount({
    formReply: async (field, value) => { writes.push({ field, value }); return true; },
    formLoad: async () => upgraded ? { personalizationEnabled: false, globalPrompt: '' } : undefined,
  });
  app.set({ personalizationEnabled: undefined, globalPrompt: undefined });
  app.selectSettingsTab('enhancements');
  const toggle = () => descendants(app.renderSettings()).find(node => node.props.id === 'settings-test-personalizationEnabled');
  await toggle().props.onClick();
  assert.equal(writes.length, 0);
  assert.equal(toggle().props['aria-checked'], false);
  assert.ok(!descendants(app.renderSettings()).some(node => node.props.role === 'alert'));
  upgraded = true;
  await toggle().props.onClick();
  assert.deepEqual(writes, [{ field: 'personalizationEnabled', value: true }]);
  assert.ok(app.entries.has('settings.section:power-dsh-personalization'));
  assert.ok(!descendants(app.renderSettings()).some(node => node.props.role === 'alert'));
  app.unmount();
});

test('a disk revision conflict preserves the draft and cancel loads the current file', async () => {
  const app = await mount({ fileText: '旧内容' });
  app.set({ personalizationEnabled: true });
  const page = await personalization(app);
  page.editor().props.onChange({ target: { value: '本地草稿' } });
  app.setFile('另一个窗口的新内容');
  await page.action('save').props.onClick();
  assert.equal(app.fileWrites.length, 1);
  assert.equal(page.editor().props.value, '本地草稿');
  assert.ok(page.render().some(node => node.props.role === 'alert' && node.props.children.includes('promptConflict')));
  page.action('cancel').props.onClick();
  await app.reloadInstructions();
  assert.equal(page.editor().props.value, '另一个窗口的新内容');
  app.unmount();
});

test('an unreadable global file cannot be overwritten with a default empty draft', async () => {
  const app = await mount({ fileReadError: 'Cannot read global AGENTS.md' });
  app.set({ personalizationEnabled: true });
  const page = await personalization(app);
  assert.equal(page.editor().props.disabled, true);
  assert.equal(page.action('save').props.disabled, true);
  assert.equal(app.fileWrites.length, 0);
  assert.ok(page.render().some(node => node.props.children.includes('Cannot read global AGENTS.md')));
  app.unmount();
});
