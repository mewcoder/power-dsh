import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startAnimation, canvasSize } from '../animation.ts';
import { mount, descendants } from '../../../../tests/helpers/client-fixture.mjs';
import { samplePatternMotion } from '../pattern.ts';

const SLOT = 'shell.overlay:power-dsh-flowing-background';
async function openTune(app) {
  app.selectSettingsTab('interface');
  descendants(app.renderSettings()).find(node => node.props.id === 'settings-test-flowingBackgroundTune').props.onClick();
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

test('the tune button opens a homepage panel that previews and saves both values', async () => {
  const app = await mount();
  app.selectSettingsTab('interface');
  const tune = view => descendants(view).find(node => node.props.id === 'settings-test-flowingBackgroundTune');
  assert.equal(tune(app.renderSettings()), undefined, 'No tuning entry while the background is off.');
  app.set({ flowingBackgroundEnabled: true });
  const button = tune(app.renderSettings());
  assert.ok(button, 'The type row exposes an adjustment icon.');
  const settingsNodes = descendants(app.renderSettings());
  const controls = settingsNodes.find(node => node.props.className === 'power-dsh-background-controls');
  assert.ok(descendants(controls).some(node => node.props.id === button.props.id), 'The icon sits beside the type selector.');
  assert.equal(button.props['data-native-button'], true);
  assert.equal(button.props.variant, 'ghost');
  assert.ok(button.props['aria-label']);
  assert.ok(descendants(button).some(node => node.type === 'svg' && node.props['aria-hidden']));
  assert.equal(button.props.children.some(child => typeof child === 'string'), false, 'The trigger is icon-only.');
  assert.equal(settingsNodes.some(node => node.props.children?.includes('flowingBackgroundTune')), false, 'There is no separate tuning explanation row.');
  const menu = settingsNodes.find(node => node.type === 'native-menu-fixture'
    && node.props.anchor?.props.className === 'power-dsh-background-style-select');
  assert.ok(menu, 'The type menu is the host Menu.');
  assert.equal(menu.props.anchor.props['data-native-button'], true, 'The dropdown trigger uses the host Button.');
  assert.equal(menu.props.anchor.props.variant, 'ghost');
  assert.equal(menu.props.anchor.props.size, 'md');
  const controlNodes = descendants(controls);
  assert.ok(controlNodes.findIndex(node => node.props.id === button.props.id)
    < controlNodes.findIndex(node => node.props.className === 'power-dsh-background-style-select'),
    'The adjustment icon precedes the dropdown in both visual and keyboard order.');
  assert.equal(app.entries.has('shell.overlay:power-dsh-background-tune'), true, 'The homepage panel is registered.');
  button.props.onClick();
  const panel = () => descendants(app.renderTunePanel()).find(node => node.props.className === 'power-dsh-background-panel');
  assert.ok(panel(), 'Clicking the adjustment icon shows the panel.');
  assert.deepEqual(app.settingsVisibility(), { open: false, closes: 1, opens: 0 }, 'The native settings modal closes for preview.');
  assert.equal(app.renderSettings(), null, 'The settings page is absent during preview.');
  assert.equal(app.entries.has('settings.launcher:power-dsh-background-return'), false, 'Preview never takes over the native settings entry.');
  assert.ok(descendants(app.renderTunePanel()).some(node => node.type === 'style'), 'The panel retains its styles when settings unmounts.');
  const sliders = () => descendants(app.renderTunePanel()).filter(node => node.type === 'input' && node.props.type === 'range');
  const opacity = () => sliders().find(node => node.props.id === 'power-dsh-tune-flowingBackgroundOpacity');
  const blur = () => sliders().find(node => node.props.id === 'power-dsh-tune-flowingBackgroundBlur');
  app.renderTunePanel();
  assert.equal(opacity().props.value, 0);
  assert.equal(blur().props.value, 0);
  opacity().props.onChange({ currentTarget: { value: '40' } });
  assert.equal(opacity().props.value, 40, 'Dragging previews without waiting for the save.');
  assert.equal(app.entries.has('settings.launcher:power-dsh-background-return'), false, 'Dragging never replaces the settings entry again.');
  assert.ok(app.settingsProps().source.getSnapshot().value.flowingBackgroundOpacity === undefined
    || app.settingsProps().source.getSnapshot().value.flowingBackgroundOpacity === 100,
    'Preview alone does not write a new preference.');
  await opacity().props.onPointerUp({ currentTarget: { value: '40' } });
  assert.equal(app.settingsProps().source.getSnapshot().value.flowingBackgroundOpacity, 60);
  blur().props.onChange({ currentTarget: { value: '12' } });
  await blur().props.onKeyUp({ key: 'ArrowRight', currentTarget: { value: '12' } });
  assert.equal(app.settingsProps().source.getSnapshot().value.flowingBackgroundBlur, 12);
  await descendants(app.renderTunePanel()).find(node => node.props.className === 'power-dsh-background-panel-close').props.onClick();
  assert.equal(panel(), undefined, 'Closing the panel leaves the homepage visible.');
  assert.deepEqual(app.settingsVisibility(), { open: false, closes: 1, opens: 0 });
  assert.equal(app.renderSettings(), null, 'Closing never reopens settings.');
  assert.equal(app.entries.has('settings.launcher:power-dsh-background-return'), false, 'The original settings launcher is restored.');
  app.unmount();
});

test('transparency starts at zero and inversely maps saved opacity for both background types', async () => {
  for (const kind of ['pattern', 'wallpaper']) {
    const app = await mount();
    app.set({ flowingBackgroundEnabled: true, flowingBackgroundKind: kind, flowingBackgroundOpacity: 35 });
    await openTune(app);
    const slider = () => descendants(app.renderTunePanel()).find(node => node.props.id === 'power-dsh-tune-flowingBackgroundOpacity');
    assert.equal(slider().props.value, 65, 'Existing saved opacity displays as equivalent transparency.');
    assert.equal(slider().props['aria-valuetext'], '65%');
    assert.equal(app.settingsProps().source.getSnapshot().value.flowingBackgroundOpacity, 35, 'Opening does not rewrite the saved appearance.');
    for (const [transparency, opacity] of [[0, 100], [100, 0], [25, 75]]) {
      slider().props.onChange({ currentTarget: { value: String(transparency) } });
      assert.equal(slider().props.value, transparency);
      assert.equal(slider().props['aria-valuetext'], `${transparency}%`);
      await slider().props.onPointerUp();
      assert.equal(app.settingsProps().source.getSnapshot().value.flowingBackgroundOpacity, opacity,
        'The persisted value keeps its existing CSS opacity meaning.');
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
  assert.equal(slider().props.value, 0, 'The preview rolls back to the inverse of the Host opacity.');
  assert.ok(nodes().some(node => node.props['data-error-code'] === 'PD-BACKGROUND-STYLE-SAVE'));
  rejectSave = false;
  slider().props.onChange({ currentTarget: { value: '65' } });
  // Blurring onto Close starts the same save; the click waits for it once.
  const saving = slider().props.onBlur();
  const closing = close().props.onClick();
  await Promise.all([saving, closing]);
  assert.equal(app.settingsProps().source.getSnapshot().value.flowingBackgroundOpacity, 35);
  assert.equal(app.settingsVisibility().open, false);
  assert.equal(close(), undefined);
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

test('failed saves keep the decoration disabled and preserve other preferences', async () => {
  const app = await mount({ formReply: () => false });
  app.set({ flowingBackgroundEnabled: false, showVersion: true });
  const control = () => descendants(app.selectSettingsTab('interface')).find(node => node.props.id === 'settings-test-flowingBackgroundEnabled');
  await control().props.onClick();
  assert.equal(control().props['aria-checked'], false);
  assert.equal(control().props['aria-invalid'], true);
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

test('the background type switches between the pattern and a saved wallpaper', async () => {
  const app = await mount();
  const trigger = view => descendants(view).find(node => node.props.className === 'power-dsh-background-style-select');
  let view = app.selectSettingsTab('interface');
  assert.equal(trigger(view), undefined, 'No type row while the background is off.');
  app.set({ flowingBackgroundEnabled: true });
  view = app.renderSettings();
  assert.equal(trigger(view).props.children.includes('flowingBackgroundKindPattern'), true, 'The pattern is the default type.');
  trigger(view).props.onClick();
  const wallpaperItem = descendants(app.renderSettings()).find(node => node.props.role === 'menuitem' && node.props['data-id'] === 'wallpaper');
  assert.ok(wallpaperItem, 'The type menu offers a custom wallpaper.');
  await wallpaperItem.props.onClick();
  assert.equal(app.settingsProps().source.getSnapshot().value.flowingBackgroundKind, 'wallpaper');
  assert.equal(trigger(app.renderSettings()).props.children.includes('flowingBackgroundKindWallpaper'), true);
  app.unmount();
});

test('selecting homepage flow restores zero transparency and zero blur', async () => {
  const app = await mount({ wallpaper: { name: 'sky.png', mime: 'image/png', bytes: 4, dataUrl: PNG } });
  app.set({ flowingBackgroundEnabled: true, flowingBackgroundKind: 'wallpaper', flowingBackgroundOpacity: 40, flowingBackgroundBlur: 16 });
  const view = () => descendants(app.renderSettings());
  app.selectSettingsTab('interface');
  view().find(node => node.props.className === 'power-dsh-background-style-select').props.onClick();
  await view().find(node => node.props.role === 'menuitem' && node.props['data-id'] === 'pattern').props.onClick();
  const saved = app.settingsProps().source.getSnapshot().value;
  assert.equal(saved.flowingBackgroundKind, 'pattern');
  assert.equal(saved.flowingBackgroundOpacity, 100);
  assert.equal(saved.flowingBackgroundBlur, 0);
  assert.deepEqual(app.wallpaperWrites, [], 'Selecting homepage flow never deletes the saved image.');
  await openTune(app);
  const panel = descendants(app.renderTunePanel());
  assert.equal(panel.find(node => node.props.id === 'power-dsh-tune-flowingBackgroundOpacity').props.value, 0);
  assert.equal(panel.find(node => node.props.id === 'power-dsh-tune-flowingBackgroundBlur').props.value, 0);
  assert.equal(panel.some(node => node.props.type === 'file'), false);
  app.unmount();
});

test('a rejected homepage default save shows an error and selecting it again completes the reset', async () => {
  let rejectBlur = true;
  const app = await mount({ formReply: async field => !(rejectBlur && field === 'flowingBackgroundBlur') });
  app.set({ flowingBackgroundEnabled: true, flowingBackgroundKind: 'wallpaper', flowingBackgroundOpacity: 40, flowingBackgroundBlur: 16 });
  app.selectSettingsTab('interface');
  const view = () => descendants(app.renderSettings());
  const selectHomepage = async () => {
    view().find(node => node.props.className === 'power-dsh-background-style-select').props.onClick();
    await view().find(node => node.props.role === 'menuitem' && node.props['data-id'] === 'pattern').props.onClick();
  };
  await selectHomepage();
  assert.equal(app.settingsProps().source.getSnapshot().value.flowingBackgroundBlur, 16);
  assert.ok(view().some(node => node.props['data-error-code'] === 'PD-BACKGROUND-KIND-SAVE'));
  rejectBlur = false;
  await selectHomepage();
  assert.equal(app.settingsProps().source.getSnapshot().value.flowingBackgroundOpacity, 100);
  assert.equal(app.settingsProps().source.getSnapshot().value.flowingBackgroundBlur, 0);
  assert.equal(view().some(node => node.props['data-error-code'] === 'PD-BACKGROUND-KIND-SAVE'), false);
  app.unmount();
});

test('the adjustment panel follows the selected type and never shows wallpaper controls for homepage flow', async () => {
  const app = await mount({ wallpaper: { name: 'sky.png', mime: 'image/png', bytes: 4, dataUrl: PNG } });
  app.set({ flowingBackgroundEnabled: true, flowingBackgroundKind: 'pattern' });
  await openTune(app);
  const nodes = () => descendants(app.renderTunePanel());
  const title = () => nodes().find(node => node.props.className === 'power-dsh-background-panel-title');
  const file = () => nodes().find(node => node.type === 'input' && node.props.type === 'file');
  assert.ok(title().props.children.includes('flowingBackgroundTunePatternTitle'));
  assert.equal(nodes().filter(node => node.props.type === 'range').length, 2);
  assert.equal(file(), undefined, 'Homepage flow has no wallpaper picker.');
  assert.equal(app.settingsProps().wallpaperSource.getSnapshot().status, 'idle', 'Opening homepage adjustment does not read the stored wallpaper.');
  app.set({ flowingBackgroundKind: 'wallpaper' });
  await new Promise(setImmediate);
  assert.ok(title().props.children.includes('flowingBackgroundTuneWallpaperTitle'));
  assert.ok(file());
  assert.ok(nodes().some(node => node.type === 'img' && node.props.src === PNG));
  const stalePicker = file();
  const staleRemove = nodes().find(node => node.type === 'button' && node.props.children.includes('flowingBackgroundWallpaperRemove'));
  app.set({ flowingBackgroundKind: 'pattern' });
  assert.ok(title().props.children.includes('flowingBackgroundTunePatternTitle'));
  assert.equal(file(), undefined, 'Changing back hides even a cached wallpaper.');
  assert.equal(nodes().some(node => node.type === 'img'), false);
  await stalePicker.props.onChange({ currentTarget: { files: [{ name: 'other.png', type: 'image/png', size: 12, dataUrl: PNG }], value: 'x' } });
  await staleRemove.props.onClick();
  assert.deepEqual(app.wallpaperWrites, [], 'Hidden wallpaper controls cannot write or switch the type back.');
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
  const remove = () => descendants(app.renderTunePanel()).find(node => node.type === 'button' && node.props.className === 'power-dsh-wallpaper-action'
    && node.props.children.includes('flowingBackgroundWallpaperRemove'));
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
