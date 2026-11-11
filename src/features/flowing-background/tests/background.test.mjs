import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startAnimation, canvasSize } from '../animation.ts';
import { mount, descendants } from '../../../../tests/helpers/client-fixture.mjs';
import { samplePatternMotion } from '../pattern.ts';

const SLOT = 'shell.overlay:power-dsh-flowing-background';
/** Choose one background type through the panel's radio group. */
async function chooseKind(app, kind) {
  const radio = descendants(app.renderTunePanel())
    .find(node => node.type === 'input' && node.props.type === 'radio' && node.props.value === kind);
  assert.ok(radio, `The panel offers the ${kind} radio.`);
  radio.props.onChange();
  app.renderTunePanel();
  await new Promise(setImmediate);
}

async function openTune(app) {
  app.selectSettingsTab('interface');
  const trigger = descendants(app.renderSettings()).find(node => node.props.id === 'settings-test-flowingBackgroundTune');
  assert.ok(trigger, 'The main background row exposes the adjustment icon.');
  trigger.props.onClick();
  app.renderTunePanel();
  await new Promise(setImmediate);
}

test('the persisted switch adds one decoration and removes it on disable and disposal', async () => {
  const app = await mount();
  assert.equal(app.entries.has(SLOT), false);
  app.set({ flowingBackgroundEnabled: true });
  const entry = app.entries.get(SLOT);
  assert.ok(entry);
  app.set({ flowingBackgroundEnabled: true });
  assert.equal(app.entries.get(SLOT), entry);
  const control = descendants(app.selectSettingsTab('interface')).find(node => node.props.id === 'settings-test-flowingBackgroundEnabled');
  assert.equal(control.props['aria-checked'], true);
  app.set({ flowingBackgroundEnabled: false });
  assert.equal(app.entries.has(SLOT), false);
  app.set({ flowingBackgroundEnabled: true });
  app.unmount();
  assert.equal(app.entries.has(SLOT), false);
});

test('the main row opens a panel that previews and saves appearance values', async () => {
  const app = await mount();
  app.selectSettingsTab('interface');
  const tune = view => descendants(view).find(node => node.props.id === 'settings-test-flowingBackgroundTune');
  assert.equal(tune(app.renderSettings()), undefined, 'No tuning entry while the background is off.');
  app.set({ flowingBackgroundEnabled: true });
  const button = tune(app.renderSettings());
  assert.ok(button, 'The main row exposes an adjustment icon.');
  const settingsNodes = descendants(app.renderSettings());
  const controls = settingsNodes.find(node => node.props.className === 'power-dsh-background-controls');
  assert.ok(descendants(controls).some(node => node.props.id === button.props.id), 'The icon sits on the main row.');
  assert.equal(button.props['data-native-button'], true);
  assert.equal(button.props.variant, 'ghost');
  assert.ok(button.props['aria-label']);
  // The entry renders the shared shirt glyph component, not an inline svg.
  assert.equal(button.props.children.some(child => child !== null && typeof child === 'object' && typeof child.type === 'function'), true,
    'The entry carries the shirt icon component.');
  assert.equal(settingsNodes.some(node => node.props.className === 'power-dsh-background-style-select'), false,
    'There is no separate background-type dropdown row.');
  button.props.onClick();
  const panel = () => descendants(app.renderTunePanel()).find(node => node.props.className === 'power-dsh-background-panel');
  assert.ok(panel(), 'Clicking the adjustment icon shows the panel.');
  assert.deepEqual(app.settingsVisibility(), { open: false, closes: 1, opens: 0 }, 'The native settings modal closes for preview.');
  assert.equal(app.renderSettings(), null, 'The settings page is absent during preview.');
  assert.ok(descendants(app.renderTunePanel()).some(node => node.type === 'style'), 'The panel retains its styles when settings unmounts.');
  const sliders = () => descendants(app.renderTunePanel()).filter(node => node.type === 'input' && node.props.type === 'range');
  const opacity = () => sliders().find(node => node.props.id === 'power-dsh-tune-flowingBackgroundOpacity');
  const blur = () => sliders().find(node => node.props.id === 'power-dsh-tune-flowingBackgroundBlur');
  app.renderTunePanel();
  assert.equal(opacity().props.value, 100, 'Opacity starts fully visible.');
  assert.equal(blur().props.value, 0);
  opacity().props.onChange({ currentTarget: { value: '40' } });
  assert.equal(opacity().props.value, 40, 'Dragging previews without waiting for the save.');
  assert.ok(app.settingsProps().source.getSnapshot().value.flowingBackgroundOpacity === undefined
    || app.settingsProps().source.getSnapshot().value.flowingBackgroundOpacity === 100,
    'Preview alone does not write a new preference.');
  await opacity().props.onPointerUp({ currentTarget: { value: '40' } });
  assert.equal(app.settingsProps().source.getSnapshot().value.flowingBackgroundOpacity, 40,
    'Opacity maps straight through, with no inversion.');
  blur().props.onChange({ currentTarget: { value: '12' } });
  await blur().props.onKeyUp({ key: 'ArrowRight', currentTarget: { value: '12' } });
  assert.equal(app.settingsProps().source.getSnapshot().value.flowingBackgroundBlur, 12);
  await descendants(app.renderTunePanel()).find(node => node.props.className === 'power-dsh-background-panel-close').props.onClick();
  assert.equal(panel(), undefined, 'Closing the panel leaves the homepage visible.');
  assert.deepEqual(app.settingsVisibility(), { open: false, closes: 1, opens: 0 });
  assert.equal(app.renderSettings(), null, 'Closing never reopens settings.');
  app.unmount();
});

test('keyboard adjustment never puts the panel into a disabled state', async () => {
  const app = await mount();
  app.set({ flowingBackgroundEnabled: true });
  await openTune(app);
  const nodes = () => descendants(app.renderTunePanel());
  const panel = () => nodes().find(node => node.props.className === 'power-dsh-background-panel');
  const radios = () => nodes().filter(node => node.type === 'input' && node.props.type === 'radio');
  const close = () => nodes().find(node => node.props.className === 'power-dsh-background-panel-close');
  const slider = () => nodes().find(node => node.props.id === 'power-dsh-tune-flowingBackgroundOpacity');
  assert.equal(panel().props['aria-busy'], undefined, 'The dialog is not busy on open.');
  slider().props.onChange({ currentTarget: { value: '55' } });
  await slider().props.onKeyUp({ key: 'ArrowRight', currentTarget: { value: '55' } });
  assert.equal(panel().props['aria-busy'], undefined, 'A save in flight must not mark the whole dialog busy.');
  assert.ok(radios().every(radio => radio.props.disabled === false), 'Type radios stay operable.');
  assert.equal(close().props.disabled, false, 'Close stays operable.');
  app.unmount();
});

test('the sliders stay enabled while saving and accept keyboard input', async () => {
  const app = await mount();
  app.set({ flowingBackgroundEnabled: true });
  await openTune(app);
  const opacity = () => descendants(app.renderTunePanel()).find(node => node.props.id === 'power-dsh-tune-flowingBackgroundOpacity');
  assert.equal(opacity().props.disabled, undefined, 'A range input is never disabled while a save is in flight.');
  assert.equal(opacity().props['aria-describedby'], 'power-dsh-tune-flowingBackgroundOpacity-description');
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']) {
    opacity().props.onChange({ currentTarget: { value: '60' } });
    await opacity().props.onKeyUp({ key, currentTarget: { value: '60' } });
    assert.equal(app.settingsProps().source.getSnapshot().value.flowingBackgroundOpacity, 60, `${key} commits.`);
  }
  assert.equal(opacity().props.onKeyUp({ key: 'Shift' }), undefined, 'Non-navigation keys do not commit.');
  app.unmount();
});

test('opacity maps directly for both background types and never rewrites on open', async () => {
  for (const kind of ['pattern', 'wallpaper']) {
    const app = await mount();
    app.set({ flowingBackgroundEnabled: true, flowingBackgroundKind: kind, flowingBackgroundOpacity: 35 });
    await openTune(app);
    const slider = () => descendants(app.renderTunePanel()).find(node => node.props.id === 'power-dsh-tune-flowingBackgroundOpacity');
    assert.equal(slider().props.value, 35, 'The saved opacity is shown as-is.');
    assert.equal(slider().props['aria-valuetext'], '35%');
    assert.equal(app.settingsProps().source.getSnapshot().value.flowingBackgroundOpacity, 35, 'Opening does not rewrite the saved appearance.');
    for (const [shown, stored] of [[0, 0], [100, 100], [75, 75]]) {
      slider().props.onChange({ currentTarget: { value: String(shown) } });
      assert.equal(slider().props.value, shown);
      assert.equal(slider().props['aria-valuetext'], `${shown}%`);
      await slider().props.onPointerUp();
      assert.equal(app.settingsProps().source.getSnapshot().value.flowingBackgroundOpacity, stored,
        'The persisted value is the same number the slider shows.');
    }
    app.unmount();
  }
});

test('closing saves the final drag and a failed preview save remains recoverable', async () => {
  let rejectSave = true;
  const app = await mount({ formReply: async () => !rejectSave });
  app.set({ flowingBackgroundEnabled: true });
  app.selectSettingsTab('interface');
  descendants(app.renderSettings()).find(node => node.props.id === 'settings-test-flowingBackgroundTune').props.onClick();
  const nodes = () => descendants(app.renderTunePanel());
  const slider = () => nodes().find(node => node.props.id === 'power-dsh-tune-flowingBackgroundOpacity');
  const close = () => nodes().find(node => node.props.className === 'power-dsh-background-panel-close');
  slider().props.onChange({ currentTarget: { value: '55' } });
  await close().props.onClick();
  assert.equal(app.settingsVisibility().open, false, 'A failed save does not dismiss its error.');
  assert.equal(slider().props.value, 100, 'The preview rolls back to the saved opacity.');
  assert.ok(nodes().some(node => node.props['data-error-code'] === 'PD-BACKGROUND-STYLE-SAVE'));
  rejectSave = false;
  slider().props.onChange({ currentTarget: { value: '65' } });
  // Blurring onto Close starts the same save; the click waits for it once.
  const saving = slider().props.onBlur();
  const closing = close().props.onClick();
  await Promise.all([saving, closing]);
  assert.equal(app.settingsProps().source.getSnapshot().value.flowingBackgroundOpacity, 65);
  assert.equal(app.settingsVisibility().open, false);
  assert.equal(close(), undefined);
  app.unmount();
});

test('adjustments made during a slow save are committed before the panel closes', async () => {
  const writes = [];
  let release;
  const app = await mount({ featureIds: ['flowing-background'], formReply: (field, value) => {
    writes.push({ field, value });
    if (writes.length === 1) return new Promise(resolve => { release = resolve; });
    return true;
  } });
  app.set({ flowingBackgroundEnabled: true });
  await openTune(app);
  const nodes = () => descendants(app.renderTunePanel());
  const slider = () => nodes().find(node => node.props.id === 'power-dsh-tune-flowingBackgroundOpacity');
  slider().props.onChange({ currentTarget: { value: '40' } });
  const first = slider().props.onPointerUp();
  await new Promise(setImmediate);
  slider().props.onChange({ currentTarget: { value: '65' } });
  const trailing = slider().props.onKeyUp({ key: 'ArrowRight' });
  const closing = nodes().find(node => node.props.className === 'power-dsh-background-panel-close').props.onClick();
  assert.equal(writes.length, 1, 'Saving remains serial while controls accept new input.');
  release(true);
  await Promise.all([first, trailing, closing]);
  assert.equal(app.settingsValue().flowingBackgroundOpacity, 65, 'The final adjustment must survive closing.');
  assert.deepEqual(writes, [
    { field: 'flowingBackgroundOpacity', value: 40 },
    { field: 'flowingBackgroundOpacity', value: 65 },
  ]);
  assert.equal(app.renderTunePanel(), null);
  app.unmount();
});

test('disabling the background closes preview without reopening settings', async () => {
  const app = await mount();
  app.set({ flowingBackgroundEnabled: true });
  app.selectSettingsTab('interface');
  descendants(app.renderSettings()).find(node => node.props.id === 'settings-test-flowingBackgroundTune').props.onClick();
  app.renderTunePanel();
  assert.equal(app.settingsVisibility().open, false);
  app.set({ flowingBackgroundEnabled: false });
  assert.equal(app.renderTunePanel(), null);
  assert.equal(app.settingsVisibility().open, false);
  assert.equal(app.entries.has('settings.launcher:power-dsh-background-return'), false);
  app.unmount();
});

test('a host dialog appearing over the preview commits the pending values and closes the panel', async () => {
  const app = await mount();
  app.set({ flowingBackgroundEnabled: true });
  app.selectSettingsTab('interface');
  descendants(app.renderSettings()).find(node => node.props.id === 'settings-test-flowingBackgroundTune').props.onClick();
  app.renderTunePanel();
  const panel = () => descendants(app.renderTunePanel()).find(node => node.props.className === 'power-dsh-background-panel');
  assert.ok(panel(), 'The preview is open.');
  const opacity = () => descendants(app.renderTunePanel()).find(node => node.type === 'input'
    && node.props.id === 'power-dsh-tune-flowingBackgroundOpacity');
  opacity().props.onChange({ currentTarget: { value: '40' } });
  assert.equal(opacity().props.value, 40, 'The new value is only a preview so far.');

  // Opening Settings (or any host dialog) raises an aria-modal layer above the
  // fixed preview; it must not stay stranded behind it.
  app.setModalLayer(true);
  await new Promise(setImmediate);
  assert.equal(panel(), undefined, 'The preview closes when a host dialog appears.');
  assert.equal(app.settingsProps().source.getSnapshot().value.flowingBackgroundOpacity, 40,
    'The pending value is committed on the way out.');

  // The panel stays closed after the dialog is dismissed.
  app.setModalLayer(false);
  await new Promise(setImmediate);
  assert.equal(panel(), undefined, 'Dismissing the dialog does not resurrect the preview.');
  app.unmount();
});

test('opening the preview from its settings row is not mistaken for a host dialog', async () => {
  const app = await mount();
  app.set({ flowingBackgroundEnabled: true });
  app.selectSettingsTab('interface');
  // The settings modal is up while its row is clicked and closes in the same
  // action. Only a *new* modal layer may close the preview, so the departure of
  // the settings dialog must leave the freshly opened preview alone.
  app.setModalLayer(true);
  descendants(app.renderSettings()).find(node => node.props.id === 'settings-test-flowingBackgroundTune').props.onClick();
  app.renderTunePanel();
  app.setModalLayer(false);
  await new Promise(setImmediate);
  assert.ok(descendants(app.renderTunePanel()).some(node => node.props.className === 'power-dsh-background-panel'),
    'The preview stays open when the settings modal merely goes away.');

  // A genuinely new dialog still closes it.
  app.setModalLayer(true);
  await new Promise(setImmediate);
  assert.equal(descendants(app.renderTunePanel()).find(node => node.props.className === 'power-dsh-background-panel'), undefined,
    'A later dialog still closes the preview.');
  app.unmount();
});

test('failed saves keep the decoration disabled and preserve other preferences', async () => {
  const app = await mount({ formReply: () => false });
  app.set({ flowingBackgroundEnabled: false, showVersion: true });
  const control = () => descendants(app.selectSettingsTab('interface')).find(node => node.props.id === 'settings-test-flowingBackgroundEnabled');
  assert.equal(control().props['aria-checked'], false);
  await control().props.onClick();
  assert.equal(control().props['aria-checked'], false, 'A failed save restores the saved value.');
  assert.equal(app.settingsProps().source.getSnapshot().value.showVersion, true);
  assert.equal(app.entries.has(SLOT), false);
  app.unmount();
});

test('global artwork stays enabled across conversations and panels without reading Session state', async () => {
  const app = await mount();
  app.set({ flowingBackgroundEnabled: true });
  const component = app.entries.get(SLOT).component;
  const unexpected = () => { throw new Error('Global background must not read conversation state'); };
  assert.ok(component({ t: key => key, usePanelInfo: unexpected, useSessions: unexpected }));
  assert.ok(component({ t: key => key }), 'Global artwork needs no Session or panel hooks.');
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

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

test('the panel switches the background type and saves it on close', async () => {
  const app = await mount();
  app.set({ flowingBackgroundEnabled: true });
  await openTune(app);
  const radio = kind => descendants(app.renderTunePanel())
    .find(node => node.type === 'input' && node.props.type === 'radio' && node.props.value === kind);
  assert.equal(radio('pattern').props.checked, true, 'The pattern is the default type.');
  assert.equal(radio('wallpaper').props.checked, false);
  assert.equal(app.settingsProps().source.getSnapshot().value.flowingBackgroundKind, 'pattern',
    'Opening the panel never writes.');
  await chooseKind(app, 'wallpaper');
  assert.equal(radio('wallpaper').props.checked, true, 'The chosen radio is checked.');
  assert.equal(radio('pattern').props.checked, false);
  assert.equal(app.settingsProps().source.getSnapshot().value.flowingBackgroundKind, 'pattern',
    'Choosing a type alone does not write.');
  await descendants(app.renderTunePanel()).find(node => node.props.className === 'power-dsh-background-panel-close').props.onClick();
  assert.equal(app.settingsProps().source.getSnapshot().value.flowingBackgroundKind, 'wallpaper',
    'Closing saves the chosen type.');
  app.unmount();
});

test('appearance is tunable for the built-in flow as well as a wallpaper', async () => {
  const app = await mount({ wallpaper: { name: 'sky.png', mime: 'image/png', bytes: 4, dataUrl: PNG } });
  app.set({ flowingBackgroundEnabled: true, flowingBackgroundKind: 'wallpaper', flowingBackgroundOpacity: 40, flowingBackgroundBlur: 16 });
  await openTune(app);
  const slider = () => descendants(app.renderTunePanel()).find(node => node.props.id === 'power-dsh-tune-flowingBackgroundOpacity');
  assert.equal(slider().props.value, 40);
  assert.equal(descendants(app.renderTunePanel()).some(node => node.type === 'input' && node.props.type === 'file'), true,
    'A wallpaper offers its picker inside the panel.');
  await chooseKind(app, 'pattern');
  assert.equal(descendants(app.renderTunePanel()).some(node => node.type === 'input' && node.props.type === 'file'), false,
    'Switching to the built-in flow hides the picker immediately.');
  await slider().props.onPointerUp();
  const saved = app.settingsProps().source.getSnapshot().value;
  assert.equal(saved.flowingBackgroundKind, 'pattern');
  assert.equal(saved.flowingBackgroundOpacity, 40, 'The built-in flow keeps its tunable opacity.');
  assert.deepEqual(app.wallpaperWrites, [], 'Switching types never deletes the saved image.');
  app.unmount();
});

test('the panel shows wallpaper controls only while the wallpaper type is selected', async () => {
  const app = await mount({ wallpaper: { name: 'sky.png', mime: 'image/png', bytes: 4, dataUrl: PNG } });
  app.set({ flowingBackgroundEnabled: true, flowingBackgroundKind: 'pattern' });
  await openTune(app);
  const nodes = () => descendants(app.renderTunePanel());
  const title = () => nodes().find(node => node.props.className === 'power-dsh-background-panel-title');
  const file = () => nodes().find(node => node.type === 'input' && node.props.type === 'file');
  assert.ok([].concat(title().props.children).includes('flowingBackgroundTuneTitle'), 'One panel title covers both types.');
  assert.equal(nodes().filter(node => node.props.type === 'range').length, 2, 'Appearance is tunable for the built-in flow.');
  assert.equal(file(), undefined, 'Homepage flow has no wallpaper picker.');
  assert.equal(app.settingsProps().wallpaperSource.getSnapshot().status, 'idle', 'Opening homepage adjustment does not read the stored wallpaper.');
  await chooseKind(app, 'wallpaper');
  await new Promise(setImmediate);
  assert.ok(file(), 'Selecting the wallpaper type reveals the picker.');
  assert.ok(nodes().some(node => node.type === 'img' && node.props.src === PNG), 'The saved wallpaper previews.');
  const stalePicker = file();
  const staleRemove = nodes().find(node => node.type === 'button'
    && typeof node.props.className === 'string' && node.props.className.includes('is-danger'));
  await chooseKind(app, 'pattern');
  assert.equal(file(), undefined, 'Changing back hides even a cached wallpaper.');
  assert.equal(nodes().some(node => node.type === 'img'), false);
  await stalePicker.props.onChange({ currentTarget: { files: [{ name: 'other.png', type: 'image/png', size: 12, dataUrl: PNG }], value: 'x' } });
  await staleRemove.props.onClick();
  assert.deepEqual(app.wallpaperWrites, [], 'Hidden wallpaper controls cannot write.');
  assert.equal(app.settingsProps().source.getSnapshot().value.flowingBackgroundKind, 'pattern');
  app.unmount();
});

test('picking a wallpaper inside its adjustment panel saves it without changing the type', async () => {
  const app = await mount();
  app.selectSettingsTab('interface');
  app.set({ flowingBackgroundEnabled: true, flowingBackgroundKind: 'wallpaper' });
  await openTune(app);
  const view = () => descendants(app.renderTunePanel());
  const file = view().find(node => node.type === 'input' && node.props.type === 'file');
  assert.ok(file, 'The wallpaper row exposes a file input.');
  await file.props.onChange({ currentTarget: { files: [{ name: 'sky.png', type: 'image/png', size: 12, dataUrl: PNG }], value: 'x' } });
  assert.deepEqual(app.wallpaperWrites.map(entry => entry.name), ['sky.png']);
  assert.equal(app.settingsProps().source.getSnapshot().value.flowingBackgroundKind, 'wallpaper');
  assert.equal(app.entries.has('settings.launcher:power-dsh-background-return'), false, 'Choosing a wallpaper keeps the native settings entry available.');
  assert.equal(view().some(node => node.type === 'img' && node.props.src === PNG), true, 'The saved wallpaper previews in the row.');
  app.unmount();
});

test('unsupported or oversized images are rejected before any Host write', async () => {
  const app = await mount();
  app.selectSettingsTab('interface');
  app.set({ flowingBackgroundEnabled: true, flowingBackgroundKind: 'wallpaper' });
  await openTune(app);
  const file = () => descendants(app.renderTunePanel()).find(node => node.type === 'input' && node.props.type === 'file');
  await file().props.onChange({ currentTarget: { files: [{ name: 'doc.pdf', type: 'application/pdf', size: 12, dataUrl: PNG }], value: 'x' } });
  assert.equal(app.wallpaperWrites.length, 0);
  assert.ok(descendants(app.renderTunePanel()).some(node => node.props['data-error-code'] === 'PD-BACKGROUND-WALLPAPER'));
  await file().props.onChange({ currentTarget: { files: [{ name: 'big.png', type: 'image/png', size: 26 * 1024 * 1024, dataUrl: PNG }], value: 'x' } });
  assert.equal(app.wallpaperWrites.length, 0);
  app.unmount();
});

test('removing the wallpaper clears it on the Host and returns to no image', async () => {
  const app = await mount({ wallpaper: { name: 'sky.png', mime: 'image/png', bytes: 4, dataUrl: PNG } });
  app.selectSettingsTab('interface');
  app.set({ flowingBackgroundEnabled: true, flowingBackgroundKind: 'wallpaper' });
  await openTune(app);
  const remove = () => descendants(app.renderTunePanel()).find(node => node.type === 'button'
    && typeof node.props.className === 'string' && node.props.className.includes('power-dsh-wallpaper-icon is-danger'));
  assert.ok(remove());
  await remove().props.onClick();
  assert.deepEqual(app.wallpaperWrites, [{ cleared: true }]);
  assert.equal(descendants(app.renderTunePanel()).some(node => node.type === 'img' && node.props.className === 'power-dsh-wallpaper-preview'), false);
  app.unmount();
});

test('wallpaper read failures show shared feedback and keep the row recoverable', async () => {
  const app = await mount({ wallpaperReadError: 'Cannot read wallpaper' });
  app.selectSettingsTab('interface');
  app.set({ flowingBackgroundEnabled: true, flowingBackgroundKind: 'wallpaper' });
  await openTune(app);
  const feedback = descendants(app.renderTunePanel()).find(node => node.props['data-error-code'] === 'PD-BACKGROUND-WALLPAPER');
  assert.ok(feedback);
  assert.ok(feedback.props.children.includes('Cannot read wallpaper'));
  app.unmount();
});

test('settings snapshots keep a stable identity so the real store cannot re-render forever', async () => {
  // The shared fixture returns getSnapshot() directly, which hides identity loops.
  // Render the same settings view twice and require identical snapshot objects.
  const app = await mount();
  app.selectSettingsTab('interface');
  app.set({ flowingBackgroundEnabled: true, flowingBackgroundKind: 'wallpaper' });
  await new Promise(setImmediate);
  const feature = app.settingsProps().features.find(entry => entry.definition.id === 'flowing-background');
  const view = { snapshot: app.settingsProps().source.getSnapshot(), disabled: false, saving: null, error: null,
    save: async () => {}, id: 'settings-test' };
  const first = feature.useSettings(view);
  const second = feature.useSettings(view);
  assert.equal(first.length, second.length);
  // Every observable-backed snapshot used by the rows must be referentially stable.
  const api = app.settingsProps();
  for (const source of [api.wallpaperSource]) {
    assert.equal(source.getSnapshot(), source.getSnapshot(), 'A snapshot getter must not build a new object per call');
  }
  app.unmount();
});

test('wallpaper actions use the shipped sprite glyphs as icon-only controls', async () => {
  const app = await mount({ wallpaper: { name: 'sky.png', mime: 'image/png', bytes: 4, dataUrl: PNG } });
  app.set({ flowingBackgroundEnabled: true, flowingBackgroundKind: 'wallpaper' });
  await openTune(app);
  const icons = () => descendants(app.renderTunePanel()).filter(node => node.type === 'button'
    && typeof node.props.className === 'string' && node.props.className.includes('power-dsh-wallpaper-icon'));
  assert.equal(icons().length, 2, 'Replace and remove are the only row actions.');
  assert.deepEqual(icons().map(node => node.props['aria-label']),
    ['flowingBackgroundWallpaperReplace', 'flowingBackgroundWallpaperRemove']);
  const glyphs = icons().map(node => descendants(node).find(child => child.props?.glyph)?.props.glyph);
  assert.deepEqual(glyphs, ['edit-outline', 'trash-outline'], 'Both reuse the host icon sprite.');
  assert.ok(icons().every(node => node.props.children.some(child => typeof child !== 'string')),
    'Neither action renders a text label.');
  app.unmount();
});

test('the sidebar shortcut appears beside the appearance button only when enabled', async () => {
  const app = await mount();
  const shortcut = () => descendants(app.renderFooter()).find(node => node.type === 'button'
    && node.props.className === 'power-dsh-background-shortcut');
  app.set({ flowingBackgroundEnabled: true });
  assert.equal(shortcut(), undefined, 'The shortcut is off by default.');
  app.set({ showBackgroundShortcut: true });
  assert.ok(shortcut(), 'Turning the preference on registers the sidebar entry.');
  assert.ok(shortcut().props['aria-label']);
  assert.equal(shortcut().props['aria-haspopup'], 'dialog');
  shortcut().props.onClick();
  assert.ok(descendants(app.renderTunePanel()).some(node => node.props.className === 'power-dsh-background-panel'),
    'The sidebar entry opens the same panel as the settings row.');
  app.set({ showBackgroundShortcut: false });
  assert.equal(shortcut(), undefined, 'Turning it off removes the entry.');

  // Turning the background itself off removes the shortcut even though its own
  // preference is still on; re-enabling the background brings it back.
  app.set({ showBackgroundShortcut: true });
  assert.ok(shortcut());
  app.set({ flowingBackgroundEnabled: false });
  assert.equal(shortcut(), undefined, 'Disabling the background removes the shortcut.');
  app.set({ flowingBackgroundEnabled: true });
  assert.ok(shortcut(), 'The retained preference returns with the background.');
  app.unmount();
});

test('footer shortcuts yield to connection status and remain hidden through recovery', async () => {
  for (const showThemeSwitcher of [false, true]) {
    const app = await mount({ featureIds: showThemeSwitcher
      ? ['flowing-background', 'appearance-shortcut'] : ['flowing-background'] });
    app.set({ flowingBackgroundEnabled: true, showBackgroundShortcut: true, showThemeSwitcher });
    const shortcut = () => descendants(app.renderFooter()).find(node => node.props.className === 'power-dsh-background-shortcut');
    assert.ok(shortcut());
    assert.equal(app.connectionStateListeners.size, 1, 'Both shortcuts share one connection observer.');
    app.setConnectionState('disconnected');
    assert.equal(shortcut(), undefined, 'The native disconnected indicator owns the footer.');
    app.setConnectionState('connecting');
    assert.equal(shortcut(), undefined);
    app.setConnectionState('connected');
    assert.equal(shortcut(), undefined, 'The native recovery indicator remains visible after reconnect.');
    const timer = [...app.timers.values()][0];
    assert.equal(timer.ms, 3000);
    app.setConnectionState('disconnected');
    assert.equal(app.timers.size, 0, 'Another outage cancels the pending recovery.');
    app.setConnectionState('connected');
    [...app.timers.values()][0].fn();
    assert.ok(shortcut(), 'The shortcut returns once native status has cleared.');
    app.unmount();
    assert.equal(app.connectionStateListeners.size, 0);
    assert.equal(app.timers.size, 0);
  }
});

test('footer shortcuts share native update availability and ignore stale initial status', async () => {
  let listener;
  let subscriptions = 0;
  let removed = 0;
  const status = Promise.withResolvers();
  const app = await mount({ featureIds: ['flowing-background', 'appearance-shortcut'], updates: {
    status: () => status.promise,
    subscribe(fn) { subscriptions++; listener = fn; return () => { removed++; }; },
  } });
  app.set({ flowingBackgroundEnabled: true, showBackgroundShortcut: true, showThemeSwitcher: true });
  const controls = () => descendants(app.renderFooter()).filter(node => ['power-dsh-background-shortcut', 'power-dsh-appearance-button'].includes(node.props.className));
  assert.equal(controls().length, 0, 'Initial update status reserves the footer.');
  assert.equal(subscriptions, 1, 'The shortcuts share a single desktop update subscription.');
  listener({ phase: 'downloading' });
  status.resolve({ phase: 'idle' });
  await new Promise(setImmediate);
  assert.equal(controls().length, 0, 'A stale idle response cannot cover the native download indicator.');
  listener({ phase: 'idle' });
  assert.equal(controls().length, 2);
  listener({ phase: 'error' });
  assert.equal(controls().length, 0, 'The native update retry action stays clickable.');
  listener({ phase: 'idle' });
  assert.equal(controls().length, 2, 'Both shortcuts return when the update indicator clears.');
  app.unmount();
  assert.equal(removed, 1);
});

test('the shortcut settings row appears only while the background is enabled', async () => {
  const app = await mount();
  const row = () => descendants(app.renderSettings()).find(node => node.props.role === 'switch'
    && node.props.id === 'settings-test-showBackgroundShortcut');
  app.selectSettingsTab('interface');
  assert.equal(row(), undefined, 'The dependent row is absent while the background is off.');
  app.set({ flowingBackgroundEnabled: true });
  assert.ok(row(), 'Turning the background on reveals the shortcut row.');
  app.set({ flowingBackgroundEnabled: false });
  assert.equal(row(), undefined, 'Turning the background off hides the row again.');
  app.unmount();
});

test('the sidebar shortcut sits flush to the appearance entry and keeps its slot when that entry is hidden', async () => {
  const app = await mount();
  app.set({ flowingBackgroundEnabled: true, showBackgroundShortcut: true });
  const shortcut = () => descendants(app.renderFooter()).find(node => node.type === 'button'
    && node.props.className === 'power-dsh-background-shortcut');
  // Appearance entry off: the background button takes over its slot (280 - 40).
  assert.equal(shortcut().props.style.left, 240);
  app.set({ showThemeSwitcher: true });
  assert.equal(shortcut().props.style.left, 208, 'Flush against the 32px appearance button with no gap.');
  app.resize(320);
  assert.equal(shortcut().props.style.left, 248, 'Stays anchored to the footer seat on resize.');
  app.set({ showThemeSwitcher: false });
  assert.equal(shortcut().props.style.left, 280, 'Falls back to the appearance slot after it is removed.');
  assert.equal(descendants(app.renderFooter(false)).find(node => node.props.className === 'power-dsh-background-shortcut'),
    undefined, 'The collapsed sidebar hides the fixed shortcut like the appearance entry.');
  app.unmount();
});
