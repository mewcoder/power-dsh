import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWhaleTrigger } from '../trigger.ts';
import { mount } from '../../../../tests/helpers/client-fixture.mjs';

test('ignores automatic focus, blank clicks, untrusted events and repeated input interactions', () => {
  let plays = 0;
  const trigger = createWhaleTrigger(() => plays++);
  trigger.activate({ type: 'focus', isTrusted: true }, true);
  trigger.activate({ type: 'click', isTrusted: true, button: 0 }, false);
  trigger.activate({ type: 'click', isTrusted: false, button: 0 }, true);
  trigger.activate({ type: 'click', isTrusted: true, button: 2 }, true);
  assert.equal(plays, 0);
  trigger.activate({ type: 'click', isTrusted: true, button: 0 }, true);
  trigger.activate({ type: 'click', isTrusted: true, button: 0 }, true);
  assert.equal(plays, 1);
});

test('Tab intent expires after the event; remount resets the single-play opportunity', async () => {
  let plays = 0;
  const trigger = createWhaleTrigger(() => plays++);
  trigger.key({ key: 'Tab', isTrusted: true });
  trigger.activate({ type: 'focus', isTrusted: true }, true);
  assert.equal(plays, 1);
  trigger.dispose();
  const next = createWhaleTrigger(() => plays++);
  next.key({ key: 'Tab', isTrusted: true });
  await new Promise(resolve => setTimeout(resolve, 0));
  next.activate({ type: 'focus', isTrusted: true }, true);
  assert.equal(plays, 1);
  next.key({ key: 'Tab', isTrusted: true });
  next.activate({ type: 'focus', isTrusted: true }, true);
  assert.equal(plays, 2);
  next.dispose();
});

test('plugin toggle registers only the official decoration cell and releases it on disable', async () => {
  const app = await mount({ featureIds: ['home-whale'] });
  const slot = 'conversation.hero.frame:pixel-whale';
  assert.equal(app.entries.has(slot), false);
  app.set({ homeWhaleFocusEnabled: true });
  assert.equal(app.entries.get(slot).options.priority, -1);
  app.set({ homeWhaleFocusEnabled: false });
  assert.equal(app.entries.has(slot), false);
  app.unmount();
});
