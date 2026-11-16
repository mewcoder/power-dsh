import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mount, descendants } from '../../../../tests/helpers/client-fixture.mjs';
import { locales } from '../locales.ts';
import { configFields } from '../config.ts';

test('the independent experimental switch persists through the shared form without enabling memory or popup search', async t => {
  const writes = [];
  const app = await mount({ featureIds: ['history-search'], formReply: async (field, value) => {
    writes.push({ field, value });
    return true;
  } });
  t.after(() => app.unmount());
  app.set({ historySearchEnabled: false, memoryEnabled: false, searchPopupEnabled: false });
  app.selectSettingsTab('enhancements');
  const control = () => descendants(app.renderSettings()).find(node => node.props.role === 'switch');
  assert.equal(control().props['aria-checked'], false);
  assert.equal(configFields.historySearchEnabled.meta.default, false);
  assert.match(locales.zh.historySearchEnabled, /实验性/);
  assert.match(locales.en.historySearchEnabled, /experimental/);
  await control().props.onClick();
  assert.equal(control().props['aria-checked'], true);
  assert.deepEqual(writes, [{ field: 'historySearchEnabled', value: true }]);
  const snapshot = app.settingsProps().source.getSnapshot();
  assert.equal(snapshot.value.memoryEnabled, false);
  assert.equal(snapshot.value.searchPopupEnabled, false);
});

test('failed experimental switch saves retain the saved value and use shared accessible error feedback', async t => {
  const app = await mount({ featureIds: ['history-search'], formReply: async () => false });
  t.after(() => app.unmount());
  app.set({ historySearchEnabled: false });
  app.selectSettingsTab('enhancements');
  const control = () => descendants(app.renderSettings()).find(node => node.props.role === 'switch');
  await control().props.onClick();
  assert.equal(control().props['aria-checked'], false);
  assert.equal(control().props['aria-invalid'], true);
  const error = descendants(app.renderSettings()).find(node => node.props['data-error-code'] === 'PD-SETTINGS-SAVE');
  assert.ok(error);
  assert.ok(control().props['aria-describedby'].includes(error.props.id));
});
