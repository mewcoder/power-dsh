import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClientFeature } from '../client.ts';
import { configFields } from '../config.ts';
import { TAIL_SHAPES } from '../geometry.ts';

function fixture({ enabled = false, available = true, conflict = false } = {}) {
  let snapshot = { status: 'ready', writable: true, value: { whaleMotionEnabled: enabled, showVersion: true } };
  const listeners = new Set(), cleanups = [], registrations = [];
  let current = null, conflicting = conflict;
  const runtime = {
    h: (type, props, ...children) => ({ type, props: { ...props, children } }),
    React: { useRef: () => ({ current: null }), useEffect: fn => fn() },
    useSnapshot: source => source.getSnapshot(),
    observable: getSnapshot => ({ getSnapshot, subscribe: () => () => {}, notify() {} }),
  };
  const feature = createClientFeature(runtime, {
    t: key => key,
    source: { getSnapshot: () => snapshot, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } },
    ctx: { slots: {
      inject(name, fn) { assert.equal(name, 'sidebar.brand.mark'); if (available) cleanups.push(fn()); },
      register(options, component) {
        if (conflicting) throw new Error('single slot priority occupied');
        const entry = { options, component }; registrations.push(entry); current = entry;
        return () => { if (current === entry) current = null; };
      },
    } },
  });
  return {
    feature, registrations, listeners,
    current: () => current,
    set(value, status = 'ready') { snapshot = { ...snapshot, status, value: { ...snapshot.value, ...value } }; [...listeners].forEach(fn => fn()); },
    conflict(value) { conflicting = value; },
    unmount() { cleanups.forEach(fn => fn?.()); },
  };
}
function descendants(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...(node.props.children ?? []).flat(Infinity).flatMap(descendants)];
}

test('default is off and enabling shadows only the fish while closing restores the native contribution', () => {
  assert.equal(configFields.whaleMotionEnabled.meta.default, false);
  const app = fixture();
  assert.equal(app.current(), null);
  app.set({ whaleMotionEnabled: true });
  assert.deepEqual(app.current().options, { name: 'sidebar.brand.mark', priority: -1 });
  app.set({ showVersion: false });
  app.set({ whaleMotionEnabled: true });
  assert.equal(app.registrations.length, 1, 'Unrelated form notifications do not restart the loop.');
  app.set({ whaleMotionEnabled: false });
  assert.equal(app.current(), null, 'The slot is released, not occupied by a null component.');
  app.set({ whaleMotionEnabled: true });
  assert.equal(app.registrations.length, 2);
  app.unmount();
  assert.equal(app.current(), null);
  assert.equal(app.listeners.size, 0);
});

test('unavailable form or missing slot does not install an override', () => {
  const app = fixture({ enabled: true });
  app.set({}, 'unavailable');
  assert.equal(app.current(), null);
  app.unmount();
  const missing = fixture({ enabled: true, available: false });
  assert.equal(missing.current(), null);
  assert.equal(missing.listeners.size, 0);
  missing.unmount();
});

test('slot conflict preserves existing display and reports a settings failure until explicit retry', () => {
  const app = fixture({ enabled: true, conflict: true });
  assert.equal(app.current(), null);
  assert.equal(app.feature.useSettings()[0].failure.code, 'PD-WHALE-SLOT');
  app.conflict(false);
  app.set({ showVersion: false });
  assert.equal(app.current(), null, 'Do not silently retry a failed registration on unrelated saves.');
  app.set({ whaleMotionEnabled: false });
  assert.equal(app.feature.useSettings()[0].failure, undefined);
  app.set({ whaleMotionEnabled: true });
  assert.ok(app.current());
  app.unmount();
});

test('only the tail loops automatically while native dimensions and color are preserved', () => {
  const app = fixture({ enabled: true });
  const view = app.current().component({ size: 24 });
  assert.equal(view.props.style.width, 24);
  assert.equal(view.props.style.height, 24 * 17.04 / 23.16);
  assert.equal(view.props['aria-hidden'], true);
  assert.equal(view.props.onMouseEnter, undefined);
  const nodes = descendants(view);
  const svg = nodes.find(node => node.type === 'svg');
  assert.equal(svg.props.viewBox, '0 0 23.16 17.04');
  assert.ok(nodes.filter(node => node.type === 'path').every(node => node.props.fill === 'currentColor'));
  assert.equal(nodes.some(node => node.type === 'animateTransform' || node.props.transform), false);
  const tracks = nodes.filter(node => node.type === 'animate');
  assert.equal(tracks.length, 1);
  const tail = tracks[0];
  assert.equal(tail.props.attributeName, 'd');
  assert.equal(tail.props.repeatCount, 'indefinite');
  assert.equal(tail.props.begin, undefined, 'Starts automatically without a pointer event.');
  assert.equal(tail.props.dur, '5.2s');
  assert.equal(tail.props.values.split(';').length, tail.props.keyTimes.split(';').length);
  assert.equal(nodes.some(node => node.props.attributeName === 'opacity' || node.type === 'rect'), false);
  app.unmount();
});

test('eye subpaths stay identical throughout the tail deformation', () => {
  const eyes = shape => shape.match(/M[^M]+/g).slice(-2);
  const baseline = eyes(TAIL_SHAPES[0]);
  for (const shape of TAIL_SHAPES) assert.deepEqual(eyes(shape), baseline);
  assert.notEqual(TAIL_SHAPES[0], TAIL_SHAPES[2], 'Tail geometry must actually move.');
  assert.equal(TAIL_SHAPES[0], TAIL_SHAPES.at(-1), 'Tail cycle closes without a geometry jump.');
});
