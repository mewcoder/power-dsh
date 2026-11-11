import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { mount, descendants } from '../../../../tests/helpers/client-fixture.mjs';
import { settingsPreviewFixture } from './settings-preview-fixture.mjs';

const SLOT = 'shell.overlay:power-dsh-wallpaper';
const TAB = 'settings.section:power-dsh-wallpaper';
const ICON = 'settings.section.icon:power-dsh-wallpaper';
const FLOW = 'shell.overlay:power-dsh-flowing-background';
const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const image = { name: 'sky.png', mime: 'image/png', bytes: 4, dataUrl: PNG };
const tick = () => new Promise(setImmediate);

// Execute nested production components with separate hook scopes per React position.
// The shared fixture normally only needs the top-level settings page.
function page(app) {
  const scopes = new Map();
  let opened = true;
  function render() {
    const alive = new Set();
    function expand(node, path = 'root') {
      if (!node || typeof node !== 'object') return node;
      if (typeof node.type === 'function') {
        let scope = scopes.get(path);
        if (!scope || scope.type !== node.type) {
          if (scope) app.disposeComponent(scope.component);
          const type = node.type;
          scope = { type, component: props => type(props) };
          scopes.set(path, scope);
        }
        alive.add(path);
        return expand(app.renderComponent({ type: scope.component, props: node.props }), `${path}/render`);
      }
      return { ...node, props: { ...node.props, children: (node.props?.children ?? []).flat().map((child, i) => expand(child, `${path}/${i}`)) } };
    }
    const entry = opened && app.entries.get(TAB);
    const result = expand(entry ? { type: entry.component, props: { t: key => key } } : null);
    for (const [path, scope] of scopes) if (!alive.has(path)) {
      app.disposeComponent(scope.component);
      scopes.delete(path);
    }
    return descendants(result);
  }
  const slider = field => render().find(node => node.props.id === `power-dsh-${field}`);
  return {
    render, slider,
    leave: () => { opened = false; render(); },
    enter: () => { opened = true; return render(); },
    control: () => descendants(app.selectSettingsTab('interface')).find(node => node.props.id === 'settings-test-wallpaperEnabled'),
    file: () => render().find(node => node.props.type === 'file'),
    preset: id => render().find(node => node.props.role === 'radio' && node.props['aria-label'] === `wallpaperPreset_${id}`),
    action: name => render().find(node => node.type === 'button' && node.props['aria-label'] === name),
    error: code => render().find(node => node.props['data-error-code'] === code),
  };
}
async function setup(options = {}, values = { wallpaperEnabled: true }) {
  const app = await mount(options);
  app.set(values.wallpaperEnabled === true ? { wallpaperSelection: 'custom', ...values } : values);
  app.selectSettingsTab('general');
  await tick();
  const view = page(app);
  view.render();
  await tick();
  return { app, ...view };
}
function change(view, field, value) {
  view.slider(field).props.onChange({ currentTarget: { value: String(value) } });
}
async function pick(view, file) {
  const target = { files: [file], value: 'picked' };
  await view.file().props.onChange({ currentTarget: target });
  assert.equal(target.value, '', 'The native picker can select the same file again.');
}

// Independent enable state and legacy compatibility must remain observable through
// the shipped settings page and slots, rather than only testing config helpers.
test('Interface starts with the custom wallpaper switch and enabling registers the native wallpaper page', async () => {
  const view = await setup({ localeLanguage: 'zh' }, {});
  const { app } = view;
  const main = () => descendants(app.renderSettings());
  const tabs = () => main().filter(node => node.props.role === 'tab');
  assert.equal(tabs()[0].props.id, 'settings-test-tab-general');
  assert.equal(tabs()[0].props['aria-selected'], true);
  assert.equal(tabs().length, 5);
  assert.equal(tabs().some(node => node.props.id === 'settings-test-tab-wallpaper'), false);
  assert.equal(main().some(node => node.props.id === 'settings-test-wallpaperEnabled'), false);
  app.selectSettingsTab('interface');
  assert.equal(main().find(node => node.props.role === 'switch').props.id, 'settings-test-wallpaperEnabled');
  assert.ok(main().find(node => node.props.id === 'settings-test-wallpaperEnabled-label').props.children.includes('开启自定义壁纸'));
  assert.equal(view.control().props['aria-checked'], false);
  assert.equal(view.file(), undefined);
  assert.equal(app.entries.has(SLOT), false);
  assert.equal(app.entries.has(TAB), false);
  assert.equal(app.entries.has(ICON), false);
  await view.control().props.onClick();
  await tick();
  assert.equal(app.settingsValue().wallpaperEnabled, true);
  assert.ok(view.file());
  assert.equal(app.entries.has(TAB), true);
  assert.equal(app.entries.has(ICON), true);
  app.set({ personalizationEnabled: true });
  const nativeWallpaper = app.entries.get(TAB);
  assert.equal(nativeWallpaper.options.order, 50.5);
  assert.ok(nativeWallpaper.options.order > app.entries.get('settings.section:power-dsh').options.order);
  assert.ok(nativeWallpaper.options.order < app.entries.get('settings.section:power-dsh-personalization').options.order);
  assert.equal(view.render().some(node => node.props.role === 'switch'), false, 'The native page does not duplicate the master switch.');
  assert.equal(view.render().filter(node => node.type === 'h2').length, 1);
  assert.equal(view.render().filter(node => node.props.type === 'range').length, 2);
  for (const field of ['wallpaperVisibility', 'wallpaperBlur']) {
    const slider = view.slider(field);
    const row = view.render().find(node => node.props.children?.some(child => child?.props?.id === slider.props.id));
    assert.ok(row && Object.hasOwn(row.props, 'data-power-dsh-wallpaper-slider'), 'Each input has an explicitly owned direct row.');
  }
  assert.equal(view.render().some(node => node.props.className === 'power-dsh-wallpaper-picker'), false);
  const generalNodes = descendants(app.selectSettingsTab('general'));
  assert.equal(generalNodes.some(node => node.props.type === 'file' || node.props.type === 'range'
    || node.props.id === 'settings-test-wallpaperEnabled'), false);
  assert.equal(app.renderTunePanel(), null);
  assert.equal(app.settingsValue().wallpaperSelection, 'none');
  assert.equal(app.entries.has(SLOT), false);
  assert.equal(view.slider('wallpaperVisibility').props.disabled, true);
  assert.equal(view.slider('wallpaperBlur').props.disabled, true);
  assert.equal(app.entries.has(FLOW), false);
  await view.control().props.onClick();
  assert.equal(view.file(), undefined);
  assert.equal(app.entries.has(SLOT), false);
  assert.equal(app.entries.has(TAB), false);
  assert.equal(app.entries.has(ICON), false);
  app.unmount();
  assert.equal(app.blurSubscriptions(), 0);
});

test('legacy wallpaper retains image and clamped appearance without rewriting preferences', async () => {
  const writes = [];
  const view = await setup({ wallpaper: image, formReply: (field, value) => { writes.push({ field, value }); return true; } }, {
    flowingBackgroundEnabled: true, flowingBackgroundKind: 'wallpaper', flowingBackgroundOpacity: 35, flowingBackgroundBlur: 37,
  });
  assert.equal(view.control().props['aria-checked'], true);
  assert.equal(view.slider('wallpaperVisibility').props.value, 35);
  assert.equal(view.slider('wallpaperBlur').props.value, 20);
  assert.ok(descendants(view.preset('custom')).some(node => node.props.style?.backgroundImage?.includes(PNG)));
  assert.equal(view.app.entries.has(FLOW), false);
  assert.deepEqual(writes, []);
  await view.control().props.onClick();
  assert.equal(view.app.settingsValue().wallpaperEnabled, false);
  assert.equal(view.app.entries.has(SLOT), false);
  assert.equal(view.app.entries.has(FLOW), false, 'Turning off the legacy wallpaper cannot silently enable flow.');
  view.app.unmount();
});

test('legacy homepage flow becomes a wallpaper selection and master-off never restores another background', async () => {
  const writes = [];
  const view = await setup({ formReply: (field, value) => { writes.push({ field, value }); return true; } }, {
    flowingBackgroundEnabled: true, flowingBackgroundKind: 'pattern', flowingBackgroundOpacity: 42, flowingBackgroundBlur: 6,
  });
  assert.equal(view.control().props['aria-checked'], true);
  assert.equal(view.preset('flow').props['aria-checked'], true);
  assert.equal(view.app.entries.has(TAB), true);
  assert.equal(view.app.entries.has(SLOT), true);
  assert.equal(view.app.entries.has(FLOW), false);
  assert.equal(view.app.entries.has('shell.overlay:power-dsh-background-tune'), false);
  assert.equal(view.slider('wallpaperVisibility').props.value, 42);
  assert.equal(view.slider('wallpaperBlur').props.value, 6);
  assert.deepEqual(writes, [], 'Legacy reads do not write on startup.');
  await view.control().props.onClick();
  assert.equal(view.app.entries.has(SLOT), false);
  assert.equal(view.app.entries.has(FLOW), false);
  assert.equal(view.app.entries.has(TAB), false);
  view.app.unmount();
});

test('custom image import selects custom and removing the active image selects none while preserving appearance', async () => {
  const view = await setup({}, { wallpaperEnabled: true, wallpaperSelection: 'none', wallpaperVisibility: 64, wallpaperBlur: 8 });
  await pick(view, { name: 'sky.png', type: 'image/png', size: 12, dataUrl: PNG });
  assert.equal(view.app.settingsValue().wallpaperSelection, 'custom');
  assert.equal(view.action('wallpaperReplace').props['data-native-button'], true);
  assert.equal(view.render().some(node => node.props.className === 'power-dsh-wallpaper-picker'), false, 'There is no separate file information row.');
  const tile = view.render().find(node => node.props.className === 'power-dsh-wallpaper-tile' && descendants(node).some(child => child.props['aria-label'] === 'wallpaperPreset_custom'));
  assert.ok(descendants(tile).some(node => node.props.className === 'power-dsh-wallpaper-tile-actions'));
  assert.equal(descendants(view.preset('custom')).some(node => ['wallpaperReplace', 'wallpaperRemove'].includes(node.props['aria-label'])), false, 'Image actions are siblings of the radio, never nested buttons.');
  assert.ok(descendants(view.preset('custom')).some(node => node.props.style?.backgroundImage?.includes(PNG)));
  await pick(view, { name: 'other.webp', type: 'image/webp', size: 12, dataUrl: 'data:image/webp;base64,YQ==' });
  assert.equal(view.app.wallpaperWrites[1].name, 'other.webp');
  assert.ok(view.render().some(node => node.type === 'native-tooltip-fixture' && node.props.label.startsWith('other.webp · ')));
  await view.action('wallpaperRemove').props.onClick();
  assert.deepEqual(view.app.wallpaperWrites.at(-1), { cleared: true });
  assert.equal(view.app.settingsValue().wallpaperSelection, 'none');
  assert.equal(view.app.entries.has(SLOT), false);
  assert.equal(descendants(view.preset('custom')).some(node => node.props.style?.backgroundImage), false);
  assert.ok(view.preset('custom'));
  assert.equal(view.action('wallpaperChoose'), undefined);
  assert.equal(view.slider('wallpaperVisibility').props.value, 64);
  assert.equal(view.slider('wallpaperBlur').props.value, 8);
  assert.equal(view.app.settingsValue().wallpaperEnabled, true);
  view.app.unmount();
});

test('a submitted image save updates the persistent asset after leaving and reopening settings', async () => {
  let finish;
  const reply = new Promise(resolve => { finish = resolve; });
  const view = await setup({ wallpaper: image, wallpaperReply: () => reply });
  const saving = pick(view, { name: 'later.png', type: 'image/png', size: 12, dataUrl: PNG });
  await tick();
  assert.equal(view.app.wallpaperWrites.length, 1, 'The Host operation is already submitted.');
  view.leave();
  view.render();
  finish({ ok: true, value: { ...image, name: 'later.png' } });
  await saving;
  view.enter();
  assert.ok(view.render().some(node => node.type === 'native-tooltip-fixture' && node.props.label.startsWith('later.png · ')),
    'Returning shows the successful Host result rather than the old cached file.');
  view.app.unmount();
});

test('invalid, oversized and unreadable files do not replace the saved image', async () => {
  const view = await setup({ wallpaper: image });
  for (const file of [
    { name: 'doc.pdf', type: 'application/pdf', size: 12, dataUrl: PNG },
    { name: 'large.png', type: 'image/png', size: 26 * 1024 * 1024, dataUrl: PNG },
    { name: 'broken.png', type: 'image/png', size: 12 },
  ]) {
    await pick(view, file);
    assert.equal(view.app.wallpaperWrites.length, 0);
    assert.ok(view.error('PD-WALLPAPER-ASSET'));
    assert.ok(view.render().some(node => node.type === 'native-tooltip-fixture' && node.props.label.startsWith('sky.png · ')));
  }
  view.app.unmount();
});

test('asset save and remove failures preserve the existing wallpaper and expose recoverable errors', async () => {
  const view = await setup({ wallpaper: image, wallpaperReply: async () => ({ ok: false, error: { message: 'private failure' } }), wallpaperClearError: 'private failure' });
  await pick(view, { name: 'new.png', type: 'image/png', size: 12, dataUrl: PNG });
  assert.ok(view.error('PD-WALLPAPER-ASSET'));
  assert.ok(view.render().some(node => node.type === 'native-tooltip-fixture' && node.props.label.startsWith(`${image.name} · `)));
  await view.action('wallpaperRemove').props.onClick();
  assert.ok(view.error('PD-WALLPAPER-ASSET'));
  assert.ok(view.action('wallpaperReplace'));
  view.app.unmount();
});

test('read failure exposes retry without independently enabling homepage flow', async () => {
  const view = await setup({ wallpaperReadError: 'private path' }, { wallpaperEnabled: true, flowingBackgroundEnabled: true });
  const feedback = view.error('PD-WALLPAPER-ASSET');
  assert.ok(feedback);
  assert.ok(descendants(feedback).some(node => node.type === 'button' && node.props.children.includes('retry')));
  assert.equal(descendants(view.preset('custom')).some(node => node.props.style?.backgroundImage), false);
  assert.equal(view.app.entries.has(FLOW), false);
  view.app.unmount();
});

test('preset tiles select built-in artwork persistently and none removes the only background layer', async () => {
  const view = await setup({}, { wallpaperEnabled: true, wallpaperSelection: 'none' });
  const radios = () => view.render().filter(node => node.props.role === 'radio');
  assert.equal(radios().length, 4);
  assert.equal(radios().filter(node => node.props['aria-checked']).length, 1);
  assert.equal(view.preset('none').props['aria-checked'], true);
  await view.preset('flow').props.onClick();
  assert.equal(view.app.settingsValue().wallpaperSelection, 'flow');
  assert.equal(view.app.entries.has(SLOT), true);
  assert.equal(view.app.entries.has(FLOW), false);
  await view.preset('none').props.onClick();
  assert.equal(view.app.settingsValue().wallpaperSelection, 'none');
  assert.equal(view.app.entries.has(SLOT), false);
  assert.equal(view.slider('wallpaperVisibility').props.disabled, true);
  assert.equal(view.slider('wallpaperBlur').props.disabled, true);
  view.app.unmount();
});

test('seaside selects the approved bundled JPEG without a persisted custom image or asset writes', async () => {
  const { dataUrl } = JSON.parse(await readFile(new URL('../../../../assets/wallpapers/seaside.json', import.meta.url), 'utf8'));
  assert.ok(dataUrl.startsWith('data:image/jpeg;base64,'));
  const bytes = Buffer.from(dataUrl.slice('data:image/jpeg;base64,'.length), 'base64');
  assert.equal(bytes.length, 2_102_697);
  assert.equal(bytes.subarray(0, 3).toString('hex'), 'ffd8ff');
  assert.equal(bytes.subarray(-2).toString('hex'), 'ffd9');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '3ce7069042d4286a7130953b36f0c1ee76dfc804f6c7a38c97140043fd5db07f');
  const writes = [];
  const view = await setup({ formReply: (field, value) => { writes.push({ field, value }); return true; } }, {
    wallpaperEnabled: true, wallpaperSelection: 'none', wallpaperVisibility: 64, wallpaperBlur: 8,
  });
  const preview = () => descendants(view.preset('seaside')).find(node => node.props.className === 'power-dsh-wallpaper-preset-preview');
  assert.equal(preview().props.style.backgroundImage, `url("${dataUrl}")`, 'The shipped Client embeds the complete approved photo.');
  assert.equal(descendants(view.preset('custom')).some(node => node.props.style?.backgroundImage), false);
  await view.preset('seaside').props.onClick();
  assert.deepEqual(writes, [{ field: 'wallpaperSelection', value: 'seaside' }]);
  assert.equal(view.app.settingsValue().wallpaperSelection, 'seaside');
  assert.equal(view.preset('seaside').props['aria-checked'], true);
  assert.equal(view.app.entries.has(SLOT), true);
  assert.equal(view.app.entries.has(FLOW), false);
  assert.equal(view.slider('wallpaperVisibility').props.value, 64);
  assert.equal(view.slider('wallpaperBlur').props.value, 8);
  assert.equal(view.slider('wallpaperVisibility').props.disabled, false);
  assert.deepEqual(view.app.wallpaperWrites, []);
  assert.deepEqual(view.app.rpcCalls, []);
  assert.equal(view.app.filePickerOpens(), 0);
  view.leave();
  view.enter();
  assert.equal(view.preset('seaside').props['aria-checked'], true);
  assert.equal(preview().props.style.backgroundImage, `url("${dataUrl}")`);
  view.app.unmount();
});

test('replacing and removing a custom image leaves the seaside photo intact and removal preserves its selection', async () => {
  const view = await setup({ wallpaper: image }, { wallpaperEnabled: true, wallpaperSelection: 'seaside' });
  const preview = () => descendants(view.preset('seaside')).find(node => node.props.className === 'power-dsh-wallpaper-preset-preview').props.style.backgroundImage;
  const original = preview();
  assert.ok(original.startsWith('url("data:image/jpeg;base64,'));
  const replacement = 'data:image/webp;base64,YQ==';
  await pick(view, { name: 'replacement.webp', type: 'image/webp', size: 12, dataUrl: replacement });
  assert.equal(view.app.settingsValue().wallpaperSelection, 'custom', 'Successful import still automatically selects custom.');
  assert.ok(descendants(view.preset('custom')).some(node => node.props.style?.backgroundImage?.includes(replacement)));
  assert.equal(preview(), original);
  await view.preset('seaside').props.onClick();
  await view.action('wallpaperRemove').props.onClick();
  assert.equal(view.app.settingsValue().wallpaperSelection, 'seaside');
  assert.equal(view.preset('seaside').props['aria-checked'], true);
  assert.equal(view.app.entries.has(SLOT), true);
  assert.equal(preview(), original);
  assert.equal(descendants(view.preset('custom')).some(node => node.props.style?.backgroundImage), false);
  assert.deepEqual(view.app.wallpaperWrites, [{ dataUrl: replacement, name: 'replacement.webp' }, { cleared: true }]);
  view.leave();
  view.enter();
  assert.equal(view.preset('seaside').props['aria-checked'], true);
  assert.equal(preview(), original);
  view.app.unmount();
});

test('a rejected preset selection rolls back to its confirmed tile and remains retryable', async () => {
  let fail = true;
  const view = await setup({ formReply: () => !fail }, { wallpaperEnabled: true, wallpaperSelection: 'flow' });
  await view.preset('none').props.onClick();
  assert.equal(view.app.settingsValue().wallpaperSelection, 'flow');
  assert.equal(view.preset('flow').props['aria-checked'], true);
  assert.ok(view.error('PD-WALLPAPER-SAVE'));
  fail = false;
  await view.preset('none').props.onClick();
  assert.equal(view.app.settingsValue().wallpaperSelection, 'none');
  assert.equal(view.error('PD-WALLPAPER-SAVE'), undefined);
  view.app.unmount();
});

test('legacy appearance migration preserves a newer external blur value while its visibility write waits', async () => {
  let release;
  const writes = [];
  const view = await setup({ formReply: (field, value) => {
    writes.push({ field, value });
    return field === 'wallpaperVisibility' ? new Promise(resolve => { release = resolve; }) : true;
  } }, { flowingBackgroundEnabled: true, flowingBackgroundKind: 'pattern', flowingBackgroundOpacity: 35, flowingBackgroundBlur: 6 });
  const selecting = view.preset('none').props.onClick();
  await tick();
  assert.deepEqual(writes, [{ field: 'wallpaperVisibility', value: 35 }]);
  view.app.set({ wallpaperBlur: 9 });
  release(true);
  await selecting;
  assert.deepEqual(writes, [
    { field: 'wallpaperVisibility', value: 35 },
    { field: 'wallpaperSelection', value: 'none' },
  ], 'Migration must not overwrite a field another settings view has already saved.');
  assert.equal(view.app.settingsValue().wallpaperBlur, 9);
  assert.equal(view.app.settingsValue().wallpaperSelection, 'none');
  assert.equal(view.slider('wallpaperBlur').props.value, 9);
  view.app.unmount();
});

test('rapid preset choices save serially without old acknowledgements taking back the last tile', async () => {
  let release;
  const writes = [];
  const view = await setup({ wallpaper: image, formReply: (field, value) => {
    writes.push({ field, value });
    return writes.length === 1 ? new Promise(resolve => { release = resolve; }) : true;
  } }, { wallpaperEnabled: true, wallpaperSelection: 'none' });
  const first = view.preset('flow').props.onClick();
  await tick();
  const last = view.preset('custom').props.onClick();
  assert.equal(view.preset('custom').props['aria-checked'], true);
  assert.equal(writes.length, 1);
  release(true);
  await Promise.all([first, last]);
  assert.deepEqual(writes, [{ field: 'wallpaperSelection', value: 'flow' }, { field: 'wallpaperSelection', value: 'custom' }]);
  assert.equal(view.preset('custom').props['aria-checked'], true);
  assert.equal(view.app.settingsValue().wallpaperSelection, 'custom');
  view.app.unmount();
});

test('preset keyboard navigation uses one tab stop and does not import an empty custom tile until activation', async () => {
  const view = await setup({}, { wallpaperEnabled: true, wallpaperSelection: 'none' });
  const event = key => ({ key, preventDefault() {} });
  assert.equal(view.render().filter(node => node.props.role === 'radio' && node.props.tabIndex === 0).length, 1);
  await view.preset('none').props.onKeyDown(event('ArrowRight'));
  assert.equal(view.app.settingsValue().wallpaperSelection, 'flow');
  await view.preset('flow').props.onKeyDown(event('End'));
  assert.equal(view.preset('custom').props.tabIndex, 0);
  assert.equal(view.preset('flow').props['aria-checked'], true, 'Focusing an empty custom tile does not select missing artwork.');
  assert.equal(view.app.filePickerOpens(), 0);
  view.preset('custom').props.onClick();
  assert.equal(view.app.filePickerOpens(), 1, 'Explicit activation opens the native picker.');
  assert.equal(view.app.wallpaperWrites.length, 0);
  await view.preset('custom').props.onKeyDown(event('Home'));
  assert.equal(view.app.settingsValue().wallpaperSelection, 'none');
  assert.equal(view.preset('none').props.tabIndex, 0);
  view.app.unmount();
});

test('removing a stored custom image while a built-in tile is selected preserves that selection', async () => {
  const view = await setup({ wallpaper: image }, { wallpaperEnabled: true, wallpaperSelection: 'flow' });
  await view.action('wallpaperRemove').props.onClick();
  assert.equal(view.app.settingsValue().wallpaperSelection, 'flow');
  assert.equal(view.preset('flow').props['aria-checked'], true);
  assert.equal(view.app.entries.has(SLOT), true);
  assert.deepEqual(view.app.wallpaperWrites, [{ cleared: true }]);
  view.app.unmount();
});

// The previous combined controls saved on blur. The independent sliders must
// discard interrupted drags, save once on release, and retain confirmed values.
test('sliders preview without writes, save once on release and ignore returning to the start', async () => {
  const writes = [];
  const view = await setup({ formReply: (field, value) => { writes.push({ field, value }); return true; } }, { wallpaperEnabled: true, wallpaperVisibility: 40, wallpaperBlur: 4 });
  for (const [field, initial, next] of [['wallpaperVisibility', 40, 80], ['wallpaperBlur', 4, 12]]) {
    change(view, field, next);
    assert.equal(view.slider(field).props.value, next);
    assert.equal(view.app.settingsValue()[field], initial);
    const before = writes.length;
    await view.slider(field).props.onPointerUp();
    assert.equal(writes.length, before + 1);
    assert.equal(view.app.settingsValue()[field], next);
    change(view, field, initial);
    change(view, field, next);
    await view.slider(field).props.onPointerUp();
    assert.equal(writes.length, before + 1, 'Dragging back to the confirmed value does not write.');
  }
  view.app.unmount();
});

test('cancelled capture, control blur and window blur discard previews and follow external updates', async () => {
  const view = await setup({}, { wallpaperEnabled: true, wallpaperVisibility: 40, wallpaperBlur: 4 });
  for (const field of ['wallpaperVisibility', 'wallpaperBlur']) {
    for (const event of ['onPointerCancel', 'onLostPointerCapture', 'onBlur', 'windowBlur']) {
      change(view, field, field === 'wallpaperBlur' ? 12 : 80);
      view.app.set({ [field]: field === 'wallpaperBlur' ? 6 : 55 });
      assert.equal(view.slider(field).props.value, field === 'wallpaperBlur' ? 12 : 80);
      if (event === 'windowBlur') view.app.blur();
      else view.slider(field).props[event]();
      assert.equal(view.slider(field).props.value, field === 'wallpaperBlur' ? 6 : 55);
    }
  }
  change(view, 'wallpaperVisibility', 90);
  view.leave();
  view.render();
  view.enter();
  assert.equal(view.slider('wallpaperVisibility').props.value, 55, 'Leaving settings discards the unfinished gesture.');
  view.app.unmount();
});

test('leaving controls or disabling the feature blocks stale file callbacks and removes unfinished previews', async () => {
  const view = await setup({}, { wallpaperEnabled: true, wallpaperVisibility: 40 });
  const oldFile = view.file();
  change(view, 'wallpaperVisibility', 80);
  await view.control().props.onClick();
  view.render();
  await oldFile.props.onChange({ currentTarget: { files: [{ name: 'stale.png', type: 'image/png', size: 12, dataUrl: PNG }], value: 'picked' } });
  assert.deepEqual(view.app.wallpaperWrites, []);
  assert.equal(view.app.entries.has(SLOT), false);
  await view.control().props.onClick();
  assert.equal(view.slider('wallpaperVisibility').props.value, 40);
  change(view, 'wallpaperVisibility', 90);
  view.app.setFormStatus('loading');
  view.app.setFormStatus('ready');
  assert.equal(view.slider('wallpaperVisibility').props.value, 40, 'An unavailable form invalidates the unfinished gesture.');
  view.app.unmount();
});

test('keyboard commits every navigation key and zero visibility disables blur without losing its value', async () => {
  const view = await setup({}, { wallpaperEnabled: true, wallpaperVisibility: 50, wallpaperBlur: 12 });
  let value = 51;
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']) {
    change(view, 'wallpaperVisibility', value);
    await view.slider('wallpaperVisibility').props.onKeyUp({ key });
    assert.equal(view.app.settingsValue().wallpaperVisibility, value++);
  }
  change(view, 'wallpaperVisibility', 0);
  await view.slider('wallpaperVisibility').props.onPointerUp();
  assert.equal(view.slider('wallpaperBlur').props.disabled, true);
  assert.equal(view.slider('wallpaperBlur').props.value, 12);
  change(view, 'wallpaperBlur', 4);
  assert.equal(view.app.settingsValue().wallpaperBlur, 12);
  change(view, 'wallpaperVisibility', 100);
  await view.slider('wallpaperVisibility').props.onPointerUp();
  assert.equal(view.slider('wallpaperBlur').props.disabled, false);
  assert.equal(view.slider('wallpaperBlur').props.value, 12);
  view.app.unmount();
});

test('failed appearance commits roll back to the latest confirmed value and remain adjustable', async () => {
  let fail = true;
  const view = await setup({ formReply: () => !fail }, { wallpaperEnabled: true, wallpaperVisibility: 40 });
  change(view, 'wallpaperVisibility', 80);
  await view.slider('wallpaperVisibility').props.onPointerUp();
  assert.equal(view.slider('wallpaperVisibility').props.value, 40);
  assert.ok(view.error('PD-WALLPAPER-SAVE'));
  fail = false;
  change(view, 'wallpaperVisibility', 65);
  await view.slider('wallpaperVisibility').props.onKeyUp({ key: 'End' });
  assert.equal(view.slider('wallpaperVisibility').props.value, 65);
  assert.equal(view.error('PD-WALLPAPER-SAVE'), undefined);
  view.app.unmount();
});

test('a newer successful save clears an earlier queued failure without dropping its value', async () => {
  const releases = [];
  const writes = [];
  const view = await setup({ formReply: (field, value) => {
    writes.push({ field, value });
    return new Promise(resolve => { releases.push(resolve); });
  } }, { wallpaperEnabled: true, wallpaperVisibility: 40 });
  change(view, 'wallpaperVisibility', 60);
  const first = view.slider('wallpaperVisibility').props.onPointerUp();
  await tick();
  change(view, 'wallpaperVisibility', 85);
  const last = view.slider('wallpaperVisibility').props.onPointerUp();
  releases[0](false);
  await first;
  await tick();
  assert.equal(view.slider('wallpaperVisibility').props.value, 85);
  assert.ok(view.error('PD-WALLPAPER-SAVE'), 'The first failed write is recoverable while the latest write waits.');
  releases[1](true);
  await last;
  assert.deepEqual(writes.map(write => write.value), [60, 85]);
  assert.equal(view.app.settingsValue().wallpaperVisibility, 85);
  assert.equal(view.error('PD-WALLPAPER-SAVE'), undefined, 'A confirmed newer save clears the obsolete failure.');
  view.app.unmount();
});

test('slow saves stay serial and old acknowledgements cannot overwrite newer committed values', async () => {
  const writes = [];
  let release;
  const view = await setup({ formReply: (field, value) => {
    writes.push({ field, value });
    return writes.length === 1 ? new Promise(resolve => { release = resolve; }) : true;
  } }, { wallpaperEnabled: true, wallpaperVisibility: 40 });
  change(view, 'wallpaperVisibility', 60);
  const first = view.slider('wallpaperVisibility').props.onPointerUp();
  await tick();
  change(view, 'wallpaperVisibility', 85);
  const last = view.slider('wallpaperVisibility').props.onPointerUp();
  view.app.set({ wallpaperVisibility: 45 });
  assert.equal(view.slider('wallpaperVisibility').props.value, 85);
  assert.equal(view.slider('wallpaperVisibility').props.disabled, false);
  assert.equal(writes.length, 1);
  release(true);
  await Promise.all([first, last]);
  assert.deepEqual(writes, [{ field: 'wallpaperVisibility', value: 60 }, { field: 'wallpaperVisibility', value: 85 }]);
  assert.equal(view.slider('wallpaperVisibility').props.value, 85);
  assert.equal(view.app.settingsValue().wallpaperVisibility, 85);
  view.app.unmount();
});

test('both sliders capture before hiding settings, keep active controls visible and restore before a slow save settles', async () => {
  for (const [field, next] of [['wallpaperVisibility', 80], ['wallpaperBlur', 12]]) {
    let release;
    const writes = [];
    const view = await setup({ formReply: (name, value) => {
      writes.push({ field: name, value });
      return new Promise(resolve => { release = resolve; });
    } }, { wallpaperEnabled: true, wallpaperVisibility: 40, wallpaperBlur: 4 });
    const dom = settingsPreviewFixture();
    dom.overlay.style.setProperty('visibility', 'visible');
    dom.overlay.style.setProperty('opacity', '0.85');
    dom.row.style.setProperty('opacity', '0.9');
    const entry = view.app.entries.get(TAB);
    const visibility = view.app.settingsVisibility();
    view.slider(field).props.onPointerDown(dom.event());
    assert.deepEqual(dom.captures, [{ pointerId: 7, visibility: 'visible' }]);
    assert.equal(dom.overlay.style.getPropertyValue('visibility'), 'hidden');
    assert.equal(dom.row.style.getPropertyValue('visibility'), 'visible');
    assert.equal(dom.row.style.getPropertyPriority('visibility'), 'important');
    assert.equal(dom.row.getAttribute('data-wallpaper-previewing'), '');
    assert.equal(dom.overlay.style.getPropertyValue('opacity'), '0.85');
    assert.equal(dom.row.style.getPropertyValue('opacity'), '0.9');
    assert.equal(dom.input.parentElement, dom.row);
    assert.equal(dom.row.parentElement, dom.panel);
    assert.deepEqual(dom.row.children, [dom.input]);
    assert.deepEqual(dom.overlay.children, [dom.mask, dom.panel]);
    change(view, field, next);
    assert.equal(view.slider(field).props.value, next, 'The same mounted component retains its live draft.');
    assert.equal(view.slider(field).props['data-pressed'], true);
    assert.deepEqual(writes, []);
    const saving = view.slider(field).props.onPointerUp(dom.event());
    assert.equal(dom.overlay.style.getPropertyValue('visibility'), 'visible', 'Settings returns before the queued write starts.');
    assert.equal(dom.row.style.getPropertyValue('visibility'), '');
    assert.equal(dom.row.hasAttribute('data-wallpaper-previewing'), false);
    assert.equal(dom.overlay.style.getPropertyValue('opacity'), '0.85');
    assert.equal(dom.row.style.getPropertyValue('opacity'), '0.9');
    assert.equal(view.slider(field).props['data-pressed'], undefined);
    view.slider(field).props.onLostPointerCapture(dom.event());
    assert.equal(view.slider(field).props.value, next, 'Normal capture release preserves the submitted value.');
    assert.equal(view.app.entries.get(TAB), entry);
    assert.deepEqual(view.app.settingsVisibility(), visibility, 'Preview never calls settings close or open.');
    await tick();
    assert.deepEqual(writes, [{ field, value: next }]);
    release(true);
    await saving;
    assert.equal(view.app.settingsValue()[field], next);
    view.app.unmount();
  }
});

test('interrupted pointer previews restore settings and reject late input and release saves', async () => {
  for (const reason of ['onPointerCancel', 'onLostPointerCapture', 'onBlur', 'windowBlur', 'leave', 'unmount']) {
    const writes = [];
    const view = await setup({ formReply: (field, value) => { writes.push({ field, value }); return true; } },
      { wallpaperEnabled: true, wallpaperVisibility: 40 });
    const dom = settingsPreviewFixture();
    view.slider('wallpaperVisibility').props.onPointerDown(dom.event());
    change(view, 'wallpaperVisibility', 80);
    const last = view.slider('wallpaperVisibility');
    if (reason === 'windowBlur') view.app.blur();
    else if (reason === 'leave') view.leave();
    else if (reason === 'unmount') view.app.unmount();
    else last.props[reason](dom.event());
    assert.equal(dom.overlay.style.getPropertyValue('visibility'), '', reason);
    assert.equal(dom.row.style.getPropertyValue('visibility'), '', reason);
    assert.equal(dom.row.hasAttribute('data-wallpaper-previewing'), false, reason);
    last.props.onChange({ currentTarget: { value: '95' } });
    await last.props.onPointerUp(dom.event());
    await tick();
    assert.deepEqual(writes, [], `${reason} cannot save a late native input event.`);
    if (reason === 'leave') view.enter();
    if (reason !== 'unmount') {
      assert.equal(view.slider('wallpaperVisibility').props.value, 40);
      view.app.unmount();
    }
  }
});

test('source unavailability, feature disable and selection changes restore an active preview', async () => {
  for (const reason of ['loading', 'disabled', 'selection']) {
    const writes = [];
    const view = await setup({ formReply: (field, value) => { writes.push({ field, value }); return true; } },
      { wallpaperEnabled: true, wallpaperSelection: 'flow', wallpaperVisibility: 40 });
    const dom = settingsPreviewFixture();
    view.slider('wallpaperVisibility').props.onPointerDown(dom.event());
    change(view, 'wallpaperVisibility', 80);
    const last = view.slider('wallpaperVisibility');
    if (reason === 'loading') view.app.setFormStatus('loading');
    else if (reason === 'disabled') view.app.set({ wallpaperEnabled: false });
    else view.app.set({ wallpaperSelection: 'custom' });
    view.render();
    assert.equal(dom.overlay.style.getPropertyValue('visibility'), '', reason);
    assert.equal(dom.row.style.getPropertyValue('visibility'), '', reason);
    assert.equal(dom.row.hasAttribute('data-wallpaper-previewing'), false, reason);
    if (reason === 'loading') view.app.setFormStatus('ready');
    last.props.onChange({ currentTarget: { value: '95' } });
    await last.props.onPointerUp(dom.event());
    await tick();
    assert.deepEqual(writes, []);
    view.app.unmount();
  }
});

test('unrelated pointers cannot start or end the primary slider preview', async () => {
  const view = await setup({}, { wallpaperEnabled: true, wallpaperVisibility: 40 });
  const dom = settingsPreviewFixture();
  for (const extra of [{ button: 2 }, { isPrimary: false }]) {
    view.slider('wallpaperVisibility').props.onPointerDown(dom.event(9, extra));
    assert.equal(dom.overlay.style.getPropertyValue('visibility'), '');
  }
  assert.deepEqual(dom.captures, []);
  view.slider('wallpaperVisibility').props.onPointerDown(dom.event());
  change(view, 'wallpaperVisibility', 80);
  await view.slider('wallpaperVisibility').props.onPointerUp(dom.event(9));
  view.slider('wallpaperVisibility').props.onPointerCancel(dom.event(9));
  view.slider('wallpaperVisibility').props.onLostPointerCapture(dom.event(9));
  assert.equal(dom.overlay.style.getPropertyValue('visibility'), 'hidden');
  assert.equal(view.app.settingsValue().wallpaperVisibility, 40);
  await view.slider('wallpaperVisibility').props.onPointerUp(dom.event());
  assert.equal(dom.overlay.style.getPropertyValue('visibility'), '');
  assert.equal(view.app.settingsValue().wallpaperVisibility, 80);
  view.app.unmount();
});

test('keyboard navigation after a canceled drag keeps settings visible and saves a fresh value', async () => {
  const view = await setup({}, { wallpaperEnabled: true, wallpaperVisibility: 40 });
  const dom = settingsPreviewFixture();
  view.slider('wallpaperVisibility').props.onPointerDown(dom.event());
  change(view, 'wallpaperVisibility', 80);
  view.slider('wallpaperVisibility').props.onPointerCancel(dom.event());
  view.slider('wallpaperVisibility').props.onKeyDown({ key: 'ArrowRight' });
  change(view, 'wallpaperVisibility', 41);
  await view.slider('wallpaperVisibility').props.onKeyUp({ key: 'ArrowRight' });
  assert.equal(dom.overlay.style.getPropertyValue('visibility'), '');
  assert.equal(view.app.settingsValue().wallpaperVisibility, 41);
  assert.equal(dom.captures.length, 1);
  view.app.unmount();
});

test('read-only wallpaper controls cannot start an invisible preview or submit a draft', async () => {
  const writes = [];
  const view = await setup({ writable: false, formReply: (field, value) => { writes.push({ field, value }); return true; } },
    { wallpaperEnabled: true, wallpaperVisibility: 40 });
  const dom = settingsPreviewFixture();
  view.slider('wallpaperVisibility').props.onPointerDown(dom.event());
  change(view, 'wallpaperVisibility', 90);
  await view.slider('wallpaperVisibility').props.onPointerUp(dom.event());
  assert.equal(dom.overlay.style.getPropertyValue('visibility'), '');
  assert.deepEqual(dom.captures, []);
  assert.deepEqual(writes, []);
  assert.equal(view.app.settingsValue().wallpaperVisibility, 40);
  view.app.unmount();
});

test('unsupported modal structure and failed capture leave settings visible during ordinary range adjustment', async () => {
  for (const reason of ['unsupported', 'capture-failed']) {
    const view = await setup({}, { wallpaperEnabled: true, wallpaperVisibility: 40 });
    const dom = settingsPreviewFixture();
    if (reason === 'unsupported') dom.mask.attributes['aria-hidden'] = 'false';
    else dom.input.setPointerCapture = () => { throw new Error('Pointer no longer active'); };
    view.slider('wallpaperVisibility').props.onPointerDown(dom.event());
    assert.equal(dom.overlay.style.getPropertyValue('visibility'), '');
    change(view, 'wallpaperVisibility', 70);
    await view.slider('wallpaperVisibility').props.onPointerUp(dom.event());
    assert.equal(view.app.settingsValue().wallpaperVisibility, 70);
    view.app.unmount();
  }
});

// Removed preview choices must not leave a stale radio or a running background.
test('removed wallpaper selections fall back to none without changing the saved profile', async () => {
  for (const removed of ['mist', 'dusk', 'aurora']) {
    const view = await setup({}, { wallpaperEnabled: true, wallpaperSelection: removed });
    assert.equal(view.render().filter(node => node.props.role === 'radio').length, 4);
    assert.equal(view.preset('none').props['aria-checked'], true);
    assert.equal(view.app.entries.has(SLOT), false);
    assert.equal(view.app.settingsValue().wallpaperSelection, removed);
    view.app.unmount();
  }
});
