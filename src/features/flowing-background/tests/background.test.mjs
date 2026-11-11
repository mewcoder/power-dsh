import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startAnimation, canvasSize } from '../../../shared/client/background/animation.ts';
import { mount, descendants } from '../../../../tests/helpers/client-fixture.mjs';
import { samplePatternMotion } from '../../../shared/client/background/pattern.ts';

test('legacy flow configuration owns no independent background UI or effects', async () => {
  const app = await mount({ featureIds: ['flowing-background'] });
  app.set({ flowingBackgroundEnabled: true, flowingBackgroundKind: 'pattern',
    flowingBackgroundOpacity: 35, flowingBackgroundBlur: 12, showBackgroundShortcut: true });
  const feature = app.settingsProps().features.find(entry => entry.definition.id === 'flowing-background');
  assert.equal(feature.settings.length, 5);
  assert.ok(feature.settings.every(setting => setting.hidden));
  assert.equal(feature.useSettings, undefined);
  assert.equal(feature.sidebar, undefined);
  assert.equal(feature.styles, undefined);
  assert.equal(app.entries.has('shell.overlay:power-dsh-flowing-background'), false);
  assert.equal(app.entries.has('shell.overlay:power-dsh-background-tune'), false);
  const fields = descendants(app.selectSettingsTab('interface'));
  assert.equal(fields.some(node => node.props.id === 'settings-test-flowingBackgroundEnabled'
    || node.props.id === 'settings-test-showBackgroundShortcut'
    || node.props.id === 'settings-test-flowingBackgroundTune'), false);
  assert.equal(app.connectionStateListeners.size, 0);
  assert.equal(app.settingsValue().flowingBackgroundEnabled, true);
  assert.equal(app.settingsValue().showBackgroundShortcut, true);
  app.unmount();
});

function fixture(reduced = false) {
  const frames = new Map();
  const listeners = new Map();
  let id = 0;
  let paints = 0;
  const listen = prefix => ({
    addEventListener(name, callback) { listeners.set(prefix + name, callback); },
    removeEventListener(name, callback) { if (listeners.get(prefix + name) === callback) listeners.delete(prefix + name); },
  });
  const media = { matches: reduced, ...listen('media:') };
  const win = {
    innerWidth: 1200, innerHeight: 800, devicePixelRatio: 2, ...listen('win:'),
    matchMedia: () => media,
    requestAnimationFrame(callback) { frames.set(++id, callback); return id; },
    cancelAnimationFrame(key) { frames.delete(key); },
  };
  const doc = { hidden: false, ...listen('doc:') };
  const deleted = { shader: 0, program: 0, buffer: 0 };
  const times = [];
  const uniforms = new Map();
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
    ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLE_STRIP: 8,
    shaderOk: true, programOk: true,
    createShader: type => ({ type }), shaderSource() {}, compileShader() {},
    getShaderParameter() { return this.shaderOk; }, deleteShader() { deleted.shader++; },
    createProgram: () => ({}), attachShader() {}, linkProgram() {},
    getProgramParameter() { return this.programOk; }, deleteProgram() { deleted.program++; },
    createBuffer: () => ({}), deleteBuffer() { deleted.buffer++; },
    getAttribLocation: () => 0, getUniformLocation: (_program, name) => ({ name }),
    useProgram() {}, bindBuffer() {}, bufferData() {}, enableVertexAttribArray() {}, vertexAttribPointer() {},
    viewport() {}, uniform2f(location, x, y) { uniforms.set(location.name, [x, y]); }, uniform1f(_location, value) { times.push(value); },
    drawArrays() { paints++; },
  };
  const canvas = { width: 0, height: 0, style: { background: '' }, getContext: () => gl, ...listen('canvas:') };
  const step = time => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)); };
  return { win, doc, media, canvas, frames, listeners, step, gl, deleted, times, uniforms, paints: () => paints };
}

test('hidden pages and reduced motion stop the frame chain; teardown releases all listeners', () => {
  const f = fixture();
  const dispose = startAnimation(f.canvas, f.win, f.doc);
  assert.equal(f.frames.size, 1);
  f.step(0);
  f.step(42);
  assert.equal(f.frames.size, 1);
  f.doc.hidden = true;
  f.listeners.get('doc:visibilitychange')();
  assert.equal(f.frames.size, 0);
  const before = f.paints();
  f.step(60000);
  assert.equal(f.paints(), before);
  f.doc.hidden = false;
  f.listeners.get('doc:visibilitychange')();
  f.listeners.get('doc:visibilitychange')();
  assert.equal(f.frames.size, 1);
  f.media.matches = true;
  f.listeners.get('media:change')();
  assert.equal(f.frames.size, 0);
  assert.ok(f.paints() > before);
  f.media.matches = false;
  f.listeners.get('media:change')();
  assert.equal(f.frames.size, 1);
  dispose();
  dispose();
  assert.equal(f.frames.size, 0);
  assert.equal(f.listeners.size, 0);
});

test('static preference draws once and unavailable WebGL installs no effects', () => {
  const f = fixture(true);
  const dispose = startAnimation(f.canvas, f.win, f.doc);
  assert.equal(f.frames.size, 0);
  assert.equal(f.paints(), 1);
  f.win.innerWidth = 900;
  f.listeners.get('win:resize')();
  assert.equal(f.canvas.width, 1350);
  assert.equal(f.frames.size, 0);
  dispose();
  const noCanvas = { getContext: () => null };
  startAnimation(noCanvas, f.win, f.doc)();
  assert.equal(f.listeners.size, 0);
});

test('context loss stops drawing, restoration starts one chain, and teardown frees GPU allocations', () => {
  const f = fixture();
  const dispose = startAnimation(f.canvas, f.win, f.doc);
  assert.equal(f.canvas.style.background, 'none');
  let prevented = false;
  f.listeners.get('canvas:webglcontextlost')({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(f.canvas.style.background, '');
  assert.equal(f.frames.size, 0);
  assert.deepEqual(f.deleted, { shader: 2, program: 1, buffer: 1 });
  f.listeners.get('canvas:webglcontextrestored')();
  assert.equal(f.canvas.style.background, 'none');
  assert.equal(f.frames.size, 1);
  dispose();
  assert.equal(f.canvas.style.background, '');
  dispose();
  assert.deepEqual(f.deleted, { shader: 4, program: 2, buffer: 2 });
  assert.equal(f.listeners.size, 0);
});

test('shader compilation and linking failures release allocations without scheduling frames', () => {
  for (const failure of ['shaderOk', 'programOk']) {
    const f = fixture();
    f.gl[failure] = false;
    startAnimation(f.canvas, f.win, f.doc)();
    assert.equal(f.frames.size, 0);
    assert.equal(f.listeners.size, 0);
    assert.deepEqual(f.deleted, failure === 'shaderOk'
      ? { shader: 1, program: 0, buffer: 0 } : { shader: 2, program: 1, buffer: 0 });
  }
});

test('CSS dimensions keep the pattern scale stable when the GPU pixel budget reduces resolution', () => {
  const f = fixture();
  const dispose = startAnimation(f.canvas, f.win, f.doc);
  assert.deepEqual(f.uniforms.get('u_cssSize'), [1200, 800]);
  assert.deepEqual(f.uniforms.get('u_resolution'), [f.canvas.width, f.canvas.height]);
  f.win.innerWidth = 10000;
  f.win.innerHeight = 5000;
  f.listeners.get('win:resize')();
  assert.deepEqual(f.uniforms.get('u_cssSize'), [10000, 5000]);
  assert.ok(f.canvas.width * f.canvas.height <= 2_000_000);
  assert.deepEqual(f.uniforms.get('u_resolution'), [f.canvas.width, f.canvas.height]);
  dispose();
});

test('the local body size and its ResizeObserver drive canvas sizing and are released on exit', () => {
  const f = fixture();
  const region = { clientWidth: 800, clientHeight: 600 };
  const previous = globalThis.ResizeObserver;
  let resize;
  let observed;
  let disconnected = false;
  globalThis.ResizeObserver = class {
    constructor(callback) { resize = callback; }
    observe(target) { observed = target; }
    disconnect() { disconnected = true; }
  };
  try {
    const dispose = startAnimation(f.canvas, f.win, f.doc, region);
    assert.equal(observed, region);
    assert.deepEqual(f.uniforms.get('u_cssSize'), [800, 600]);
    region.clientWidth = 700;
    resize();
    assert.deepEqual(f.uniforms.get('u_cssSize'), [700, 600]);
    dispose();
    assert.equal(disconnected, true);
    assert.equal(f.frames.size, 0);
  } finally {
    if (previous === undefined) delete globalThis.ResizeObserver;
    else globalThis.ResizeObserver = previous;
  }
});

test('homepage motion starts slowly and remains bounded over long-running sessions', () => {
  assert.deepEqual(samplePatternMotion(0), { a: [0, 0], b: [0, 0], phase: [0, 1] });
  const oneSecond = samplePatternMotion(1);
  for (const value of [...oneSecond.a, ...oneSecond.b]) assert.ok(value > .068 && value < .072);
  assert.deepEqual(samplePatternMotion(420).a, [0, 0]);
  assert.deepEqual(samplePatternMotion(460).b, [0, 0]);
  assert.deepEqual(samplePatternMotion(90).phase, [0, 1]);
  for (const seconds of [100, 100000, 1e12]) {
    const sample = samplePatternMotion(seconds);
    assert.ok([...sample.a, ...sample.b, ...sample.phase].every(Number.isFinite));
    assert.ok([...sample.a, ...sample.b].every(value => Math.abs(value) < 13));
    assert.ok(Math.abs(Math.hypot(...sample.phase) - 1) < 1e-12);
  }
});

test('drawing is throttled and backing-store size stays bounded', () => {
  const f = fixture();
  const dispose = startAnimation(f.canvas, f.win, f.doc);
  f.step(0);
  const before = f.paints();
  f.step(16);
  f.step(32);
  assert.equal(f.paints(), before);
  f.step(48);
  assert.equal(f.paints(), before + 1);
  dispose();
  for (const [w, h, ratio] of [[0, 0, 0], [1200, 800, 3], [10000, 10000, 4]]) {
    const size = canvasSize(w, h, ratio);
    assert.ok(size.width >= 1 && size.height >= 1);
    assert.ok(size.width * size.height <= 2_000_000);
    assert.ok(size.width <= Math.max(1, w) * 1.5);
  }
});
