import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mount, descendants } from '../../../../tests/helpers/client-fixture.mjs';
import { styles } from '../styles.ts';

const SLOT = 'conversation.input.right:power-dsh-thinking-effort';
const button = view => descendants(view).find(node => node.props?.className === 'power-dsh-effort-button');
const bars = view => descendants(view).filter(node => node.type === 'rect');
const ticks = view => descendants(view).filter(node => node.type === 'line');
const arcTicks = view => descendants(view).filter(node => node.props.className === 'power-dsh-effort-arc-tick');
const needle = view => descendants(view).find(node => typeof node.props.className === 'string'
  && node.props.className.split(' ').includes('power-dsh-effort-arc-needle'));
const lit = view => bars(view).filter(node => node.props.opacity === 1).length;
const tooltip = view => descendants(view).find(node => node.type === 'native-tooltip-fixture');
const click = view => button(view).props.onClick({ stopPropagation() {} });
const hint = view => button(view).props['aria-label'];
const graphicOnly = view => {
  const children = button(view).props.children.flat();
  return children.length === 1 && children[0].type === 'svg';
};

test('one composer button cycles every declared level and wraps back to default', async () => {
  const app = await mount();
  assert.equal(app.entries.has(SLOT), false);
  app.set({ showThinkingEffortSwitcher: true, thinkingEffortGlyph: 'signal' });
  assert.equal(app.entries.has(SLOT), true);
  app.set({ showThinkingEffortSwitcher: true });
  assert.equal(app.effortSessions.length, 0, 'Repeated config notifications must not resolve extra directories.');

  let view = app.renderEffort();
  assert.equal(bars(view).length, 4);
  assert.equal(lit(view), 0);
  assert.equal(graphicOnly(view), true, 'The button renders the graphic only, without a text label.');
  assert.equal(descendants(view).some(node => node.props?.className === 'power-dsh-effort-label'), false);
  assert.equal(button(view).props.children.flat()[0].props.width, 20);
  assert.equal(bars(view).every(node => typeof node.props.className === 'string'
    && node.props.className.startsWith('power-dsh-effort-bar-')), true, 'Bars use theme-token classes.');
  assert.equal(bars(view).every(node => node.props.className === 'power-dsh-effort-bar-off'), true);
  assert.equal(bars(view).some(node => node.props.fill !== undefined), false, 'Colors come from the theme stylesheet.');
  assert.match(hint(view), /effortDefault/);
  assert.deepEqual(app.effortSessions, ['session:one']);

  for (const [index, name] of ['Off', 'Low', 'High', 'Max'].entries()) {
    await click(view);
    assert.equal(app.effortSelects.length, index + 1);
    assert.equal(app.effortSelects[index].reasoningEffort, name.toLowerCase());
    view = app.renderEffort();
    assert.equal(lit(view), index + 1);
    assert.match(hint(view), new RegExp(name));
  }

  await click(view);
  assert.equal(app.effortSelects.length, 5);
  assert.equal(Object.hasOwn(app.effortSelects[4], 'reasoningEffort'), false, 'Default omits the effort field.');
  view = app.renderEffort();
  assert.equal(lit(view), 0);
  assert.match(hint(view), /effortDefault/);
  assert.equal(button(view).props.disabled, false);
  app.unmount();
});

test('bar count follows the model; missing levels or directories hide the button', async () => {
  const seven = Array.from({ length: 7 }, (_, index) => ({ id: `l${index}`, name: `L${index}` }));
  const app = await mount({ modelDirectory: {
    current: { provider: 'custom', model: 'seven' },
    groups: [{ id: 'custom', models: [{ id: 'seven', reasoning: { efforts: seven } }] }],
    status: 'ready', error: null,
  } });
  app.set({ showThinkingEffortSwitcher: true, thinkingEffortGlyph: 'signal' });
  const view = app.renderEffort();
  assert.equal(bars(view).length, 7);
  assert.equal(lit(view), 0);
  assert.equal(graphicOnly(view), true);
  await click(view);
  assert.equal(lit(app.renderEffort()), 1);

  app.setModelDirectory({
    current: { provider: 'custom', model: 'plain' },
    groups: [{ id: 'custom', models: [{ id: 'plain' }] }],
    status: 'ready', error: null,
  });
  assert.equal(button(app.renderEffort()), undefined, 'A model without declared levels renders nothing.');
  app.unmount();

  const missing = await mount({ modelDirectoriesAvailable: false });
  missing.set({ showThinkingEffortSwitcher: true });
  assert.equal(button(missing.renderEffort()), undefined, 'An absent service must not break the Client.');
  const noSession = await mount();
  noSession.set({ showThinkingEffortSwitcher: true });
  assert.equal(button(noSession.renderEffort('')), undefined);
  missing.unmount();
  noSession.unmount();
});

test('a failed selection keeps the saved level, reports a retry reason and blocks clicks while pending', async () => {
  let release;
  const app = await mount({ modelSelectReply: () => new Promise(resolve => { release = resolve; }) });
  app.set({ showThinkingEffortSwitcher: true, thinkingEffortGlyph: 'signal' });
  const first = app.renderEffort();
  const pending = click(first);
  const busyView = app.renderEffort();
  assert.equal(button(busyView).props.disabled, true);
  assert.equal(button(busyView).props['aria-busy'], true);
  assert.equal(button(busyView).props.onClick({ stopPropagation() {} }), undefined, 'A pending button ignores another click.');

  release({ ok: false, error: { message: 'session busy' } });
  await pending;
  const failed = app.renderEffort();
  assert.equal(lit(failed), 0);
  assert.match(hint(failed), /effortSwitchFailed/);
  assert.match(tooltip(failed).props.label, /effortSwitchFailed/);
  assert.match(tooltip(failed).props.label, /session busy/);
  assert.equal(app.effortSelects.length, 1);

  const retry = click(failed);
  release({ ok: true });
  await retry;
  assert.equal(app.effortSelects.length, 2);
  assert.equal(lit(app.renderEffort()), 1);
  assert.doesNotMatch(tooltip(app.renderEffort()).props.label, /effortSwitchFailed/);
  app.unmount();
});

test('closing the switch removes the composer registration and unmount releases side effects', async () => {
  const app = await mount();
  app.set({ showThinkingEffortSwitcher: true });
  assert.ok(button(app.renderEffort()));
  app.set({ showThinkingEffortSwitcher: false });
  assert.equal(app.entries.has(SLOT), false);
  assert.equal(app.renderEffort(), null);
  app.set({ showThinkingEffortSwitcher: true });
  assert.equal(app.entries.has(SLOT), true);
  app.unmount();
  assert.equal(app.entries.has(SLOT), false);
  assert.equal(app.subscriptions(), 0);
});

test('the button is ordered after the model seat with symmetric spacing on both sides', () => {
  const rule = styles.match(/\.power-dsh-effort-button \{([^}]*)\}/)?.[1] ?? '';
  assert.match(rule, /order:1;/, 'The button must sit after the model seat visually.');
  assert.match(rule, /margin-left:-8px;/, 'The 12px gap before the button is reduced on its own side.');
  assert.match(rule, /margin-right:-8px;/, 'The 12px gap to the submit action is reduced the same way.');
  assert.match(styles, /\.power-dsh-effort-bar-on \{ fill:var\(--dsw-alias-state-business-primary\)/);
});

test('the arc style renders a gauge with a needle that follows the stored preference', async () => {
  const app = await mount();
  app.set({ showThinkingEffortSwitcher: true, thinkingEffortGlyph: 'signal' });
  let view = app.renderEffort();
  assert.equal(bars(view).length, 4);
  assert.equal(ticks(view).length, 0);

  app.set({ thinkingEffortGlyph: 'arc' });
  view = app.renderEffort();
  assert.equal(bars(view).length, 0, 'The arc style replaces the signal bars.');
  assert.equal(arcTicks(view).length, 5, 'Graduations span the arc from end to end.');
  assert.ok(needle(view), 'The gauge has a needle.');
  assert.equal(graphicOnly(view), true);
  assert.match(hint(view), /effortDefault/);
  assert.match(needle(view).props.className, /power-dsh-effort-arc-auto/, 'The default needle is the grey automatic state.');
  const rotationOf = current => Number((/rotate\((-?[\d.]+)deg\)/.exec(needle(current).props.style.transform) || [])[1]);
  const before = rotationOf(view);
  assert.equal(before, -180, 'The automatic needle parks in the bottom gap.');

  await click(view);
  view = app.renderEffort();
  assert.equal(app.effortSelects.length, 1);
  assert.ok(rotationOf(view) > before, 'The needle rotates onto the scale as the level rises.');
  assert.doesNotMatch(needle(view).props.className, /power-dsh-effort-arc-auto/, 'A chosen level uses the accent needle.');

  for (const expected of [-45, 45, 135, 180, 225, 315, 405, 495, 540]) {
    const previous = rotationOf(view);
    await click(view);
    view = app.renderEffort();
    assert.equal(rotationOf(view), expected, 'Successive cycles keep the needle rotation continuous.');
    assert.ok(rotationOf(view) - previous <= 90, 'Returning to default must not sweep backwards across the scale.');
  }
  assert.match(needle(view).props.className, /power-dsh-effort-arc-auto/, 'The wrap still displays the grey default state.');

  app.set({ thinkingEffortGlyph: 'signal' });
  view = app.renderEffort();
  assert.equal(ticks(view).length, 0);
  assert.equal(bars(view).length, 4);
  app.unmount();
});

test('the gauge keeps its colours while busy, transitions levels and honours reduced motion', () => {
  const disabledRules = [...styles.matchAll(/([^{}]*:disabled[^{}]*)\{([^}]*)\}/g)];
  assert.ok(disabledRules.length > 0, 'The button still has a disabled state.');
  for (const [, , rule] of disabledRules) {
    assert.doesNotMatch(rule, /(?:color|stroke|fill|opacity)\s*:/, 'Busy state must not flash the graphic grey.');
  }
  const autoRule = styles.match(/\.power-dsh-effort-arc-auto \{([^}]*)\}/)?.[1] ?? '';
  assert.match(autoRule, /color:var\(--dsw-alias-label-tertiary\)/);
  assert.doesNotMatch(autoRule, /(?:stroke|fill|opacity|width)\s*:/, 'Default changes only colour, preserving the needle and hub silhouette.');
  assert.match(styles, /\.power-dsh-effort-arc-hub \{[^}]*stroke:none;/, 'The grey hub must not grow an extra outline.');
  assert.match(styles, /\.power-dsh-effort-arc-needle \{[^}]*transform-origin:8px 8\.5px/);
  assert.match(styles, /\.power-dsh-effort-arc-needle \{[^}]*transition:transform 180ms/);
  assert.match(styles, /@media \(prefers-reduced-motion:reduce\) \{ \.power-dsh-effort-arc-needle \{ transition:none; \} \}/);
});

test('the display style setting shows only with the switcher in Interface and switches to signal', async () => {
  const app = await mount();
  const styleTrigger = view => descendants(view).find(node => node.props.className === 'power-dsh-effort-style-select');
  let view = app.selectSettingsTab('interface');
  assert.equal(styleTrigger(view), undefined, 'No style row while the reasoning level switch is off.');

  app.set({ showThinkingEffortSwitcher: true });
  view = app.renderSettings();
  const trigger = styleTrigger(view);
  assert.ok(trigger, 'The style row appears with the switch.');
  assert.equal(trigger.props.children.includes('glyphArc'), true, 'The gauge is the default style.');

  trigger.props.onClick();
  view = app.renderSettings();
  const items = descendants(view).filter(node => node.props.role === 'menuitem');
  assert.deepEqual(items.map(item => item.props['data-id']), ['arc', 'signal'],
    'The default style is listed first, then the alternative.');
  const signal = items.find(item => item.props['data-id'] === 'signal');
  assert.ok(signal, 'The style menu offers the signal bars.');
  await signal.props.onClick();

  assert.equal(app.effortSelects.length, 0);
  const effort = app.renderEffort();
  assert.equal(arcTicks(effort).length, 0);
  assert.equal(bars(effort).length, 4);
  assert.equal(styleTrigger(app.renderSettings()).props.children.includes('glyphSignal'), true);
  assert.equal(styleTrigger(app.selectSettingsTab('general')), undefined, 'The style row belongs only to Interface.');
  assert.equal(styleTrigger(app.selectSettingsTab('interface')).props.children.includes('glyphSignal'), true, 'Changing tabs preserves the saved style.');

  app.set({ showThinkingEffortSwitcher: false });
  assert.equal(styleTrigger(app.renderSettings()), undefined);
  app.unmount();
});
