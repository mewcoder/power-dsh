import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mount, descendants, archivePage } from '../../../../tests/helpers/client-fixture.mjs';

const card = app => descendants(app.renderArchive()).find(node => node.props?.className === 'power-dsh-archive-auto');
const daysControl = app => descendants(card(app)).find(node => typeof node.props?.className === 'string'
  && node.props.className.includes('power-dsh-archive-auto-select'));

test('automatic archiving is a single dropdown on the archive page, defaulting to never', async () => {
  const app = await mount();
  await archivePage(app);
  assert.ok(card(app), 'The page carries the automatic archiving card.');
  const control = daysControl(app);
  assert.ok(control, 'The card carries one control.');
  assert.equal(control.props.children[0], 'autoArchiveNever', 'It defaults to never.');
  assert.equal(control.props['aria-haspopup'], 'menu');
  assert.ok(!descendants(card(app)).some(node => node.props?.role === 'switch'),
    'There is no separate switch that could disagree with the threshold.');
  assert.ok(!descendants(app.renderSettings()).some(node => node.props?.id === 'settings-test-autoArchiveDays'),
    'The main settings page no longer carries this preference.');
  app.unmount();
});

test('choosing a day count saves it, and never turns the feature back off', async () => {
  const app = await mount();
  await archivePage(app);
  const menu = () => descendants(card(app)).find(node => node.type === 'native-menu-fixture');
  daysControl(app).props.onClick();
  assert.equal(menu().props.open, true);
  assert.deepEqual([...menu().props.items].map(item => item.id), ['0', '7', '14', '30', '60', '90']);
  assert.equal(menu().props.items[0].label, 'autoArchiveNever', 'The first option reads as never.');

  await descendants(menu()).find(item => item.props['data-id'] === '14').props.onClick();
  assert.equal(app.settingsValue().autoArchiveDays, 14, 'The chosen threshold is persisted.');
  assert.equal(daysControl(app).props.children[0], 'autoArchiveDaysValue');

  daysControl(app).props.onClick();
  await descendants(menu()).find(item => item.props['data-id'] === '0').props.onClick();
  assert.equal(app.settingsValue().autoArchiveDays, 0, 'Never is stored as 0.');
  assert.equal(daysControl(app).props.children[0], 'autoArchiveNever');
  app.unmount();
});

test('an open auto-archive menu closes on read-only state and rejects its captured selection', async () => {
  let writes = 0;
  const app = await mount({ featureIds: ['archive'], formReply: async () => { writes++; return true; } });
  await archivePage(app);
  const menu = () => descendants(card(app)).find(node => node.type === 'native-menu-fixture');
  daysControl(app).props.onClick();
  const select = menu().props.onSelect;
  assert.equal(menu().props.open, true);
  app.archiveProps().settingsSource.getSnapshot().writable = false;
  app.set({});
  assert.equal(menu().props.open, false);
  assert.equal(daysControl(app).props.disabled, true);
  await select('90');
  assert.equal(writes, 0);
  app.archiveProps().settingsSource.getSnapshot().writable = true;
  app.set({});
  assert.equal(menu().props.open, false, 'Restoring permission does not reopen a dismissed menu.');
  app.unmount();
  await select('90');
  assert.equal(writes, 0, 'An unmounted page cannot submit a captured selection.');
});

test('auto-archive selections serialize immediately and failed saves remain associated with the control', async () => {
  let finish;
  let writes = 0;
  const app = await mount({ featureIds: ['archive'], formReply: () => {
    writes++;
    return new Promise(resolve => { finish = resolve; });
  } });
  await archivePage(app);
  daysControl(app).props.onClick();
  const select = descendants(card(app)).find(node => node.type === 'native-menu-fixture').props.onSelect;
  const saving = select('14');
  await select('90');
  assert.equal(writes, 1, 'Two callbacks in one render may start only one write.');
  finish(false);
  await saving;
  const control = daysControl(app);
  assert.equal(control.props['aria-invalid'], true);
  assert.ok(control.props['aria-describedby'].includes('auto-error'));
  assert.equal(app.settingsValue().autoArchiveDays, 0);
  app.unmount();
});
