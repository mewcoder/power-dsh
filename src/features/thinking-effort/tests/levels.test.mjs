import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arcGeometry, barGeometry, currentChoiceIndex, effortChoices, litBars } from '../levels.ts';

const levels = [
  { id: 'off', name: 'Off' }, { id: 'low', name: 'Low' },
  { id: 'high', name: 'High' }, { id: 'max', name: 'Max' },
];
const seven = [
  { id: 'minimal', name: 'Minimal' }, { id: 'low', name: 'Low' }, { id: 'medium', name: 'Medium' },
  { id: 'high', name: 'High' }, { id: 'ultra', name: 'Ultra' }, { id: 'max', name: 'Max' },
  { id: 'extra', name: 'Extra' },
];

test('effort choices follow the native model seat sequence', () => {
  const withoutDefault = effortChoices({ efforts: levels }, 'Default');
  assert.deepEqual(withoutDefault.map(choice => choice.id), [undefined, 'off', 'low', 'high', 'max']);
  const withDefault = effortChoices({ efforts: levels, defaultEffort: 'high' }, 'Default');
  assert.deepEqual(withDefault.map(choice => choice.id), ['off', 'low', 'high', 'max']);
  assert.deepEqual(effortChoices({ efforts: [] }, 'Default'), []);
  assert.deepEqual(effortChoices(undefined, 'Default'), []);
});

test('the reported effort resolves to its declared level without inventing one', () => {
  const choices = effortChoices({ efforts: levels }, 'Default');
  assert.equal(currentChoiceIndex(choices, undefined), 0);
  assert.equal(currentChoiceIndex(choices, 'high'), 3);
  assert.equal(currentChoiceIndex(choices, 'unknown'), 0);
  const noDefault = effortChoices({ efforts: levels, defaultEffort: 'high' }, 'Default');
  assert.equal(currentChoiceIndex(noDefault, 'high'), 2);
});

test('default lights no bar and each declared level lights one more bar', () => {
  const choices = effortChoices({ efforts: levels }, 'Default');
  assert.deepEqual(choices.map((_, index) => litBars(choices, index)), [0, 1, 2, 3, 4]);
  const noDefault = effortChoices({ efforts: levels, defaultEffort: 'high' }, 'Default');
  assert.deepEqual(noDefault.map((_, index) => litBars(noDefault, index)), [1, 2, 3, 4]);
});

test('bar count equals the declared level count and stays inside the fixed glyph', () => {
  for (const [reasoning, count] of [[{ efforts: levels.slice(0, 3) }, 3], [{ efforts: levels }, 4], [{ efforts: seven }, 7]]) {
    const bars = barGeometry(reasoning.efforts.length, 0);
    assert.equal(bars.length, count);
    assert.ok(bars[0].x >= 0);
    assert.ok(bars[count - 1].x + bars[count - 1].width <= 44.01);
    assert.ok(bars.every((bar, index) => index === 0 || bar.height > bars[index - 1].height));
    assert.equal(bars[count - 1].height, 13);
    assert.ok(bars.every(bar => !bar.filled));
  }
  assert.deepEqual(barGeometry(0, 0), []);
});

test('bar heights divide the available height by the declared level count', () => {
  assert.deepEqual(barGeometry(1, 0).map(bar => bar.height), [13]);
  assert.deepEqual(barGeometry(2, 0).map(bar => bar.height), [6.5, 13]);
  assert.deepEqual(barGeometry(4, 0).map(bar => bar.height), [3.25, 6.5, 9.75, 13]);
  for (const count of [2, 3, 4, 7]) {
    const bars = barGeometry(count, 0, 20);
    assert.ok(bars.every((bar, index) => Math.abs(bar.height - 13 * (index + 1) / count) <= 0.005));
    assert.ok(bars.every(bar => Math.abs(bar.y + bar.height - 14) <= 0.01), 'All bars share a baseline.');
  }
});

test('lit bars track the active count and very long ladders are scaled rather than truncated', () => {
  assert.equal(barGeometry(4, 2).filter(bar => bar.filled).length, 2);
  assert.equal(barGeometry(4, 4).filter(bar => bar.filled).length, 4);
  const many = Array.from({ length: 12 }, (_, index) => ({ id: `l${index}`, name: `L${index}` }));
  const bars = barGeometry(many.length, 12);
  assert.equal(bars.length, 12);
  assert.ok(bars[11].x + bars[11].width <= 44.01);
  assert.ok(bars[11].width < 3);
  assert.ok(bars.every(bar => bar.filled));
});

test('the compact pure-graphic glyph scales any ladder into 20px', () => {
  for (const count of [3, 4, 7, 12]) {
    const bars = barGeometry(count, count, 20);
    assert.equal(bars.length, count);
    assert.ok(bars[0].x >= -0.01);
    assert.ok(bars[count - 1].x + bars[count - 1].width <= 20.01);
    assert.ok(bars[count - 1].height > bars[0].height);
  }
});

test('the gauge mirrors the host icon with a light ring and a needle that follows the level', () => {
  const empty = arcGeometry(4, 0);
  assert.equal(empty.ticks.length, 5, 'Five graduations span the arc from end to end.');
  assert.ok(empty.needle);
  assert.match(empty.track, /^M3\.4041/);
  assert.equal(empty.auto, true, 'No chosen level is the automatic state.');
  assert.equal(empty.needle.rotation, -180, 'The automatic needle parks in the bottom gap.');
  assert.equal(arcGeometry(4, 1).auto, false);
  assert.equal(arcGeometry(4, 1).needle.rotation, -135, 'The first real level sits at the left end.');
  assert.equal(arcGeometry(4, 4).needle.rotation, 135, 'The last real level sits at the right end.');
  assert.equal(arcGeometry(1, 1).needle.rotation, 0, 'A single level points straight up.');
  const first = arcGeometry(4, 1).needle;
  assert.equal(first.x1, 8);
  assert.equal(first.x2, 8, 'The needle rotates around the hub from a fixed upward line.');
  assert.ok(first.y2 < first.y1, 'The base needle points straight up.');
  for (const point of [empty.needle, arcGeometry(4, 4).needle]) {
    for (const [x, y] of [[point.x1, point.y1], [point.x2, point.y2]]) {
      assert.ok(x >= 0 && x <= 16 && y >= 0 && y <= 16, `Needle point ${x},${y} stays inside 16x16.`);
    }
  }
  for (const tick of empty.ticks) {
    for (const [x, y] of [[tick.x1, tick.y1], [tick.x2, tick.y2]]) {
      assert.ok(x >= 0 && x <= 16 && y >= 0 && y <= 16, `Tick point ${x},${y} stays inside 16x16.`);
    }
  }
  assert.deepEqual(arcGeometry(0, 0), { track: '', ticks: [], needle: null, hub: { cx: 8, cy: 8.5, r: 1 }, auto: true });
});
