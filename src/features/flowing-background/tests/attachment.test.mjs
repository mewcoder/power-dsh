import assert from 'node:assert/strict';
import { test } from 'node:test';
import { watchBackground } from '../attachment.ts';
import { createClientFeature } from '../client.ts';
import { locales } from '../locales.ts';
import { createRuntime } from '../../../shared/client/runtime.ts';

// Verifies DOM ownership and rollback; this fixture does not render pixels.
class Element {
  constructor(tag = 'div', attributes = {}, className = '') {
    this.tagName = tag;
    if (tag === 'canvas') this.getContext = () => null;
    this.attributes = new Map(Object.entries(attributes));
    this.className = className;
    this.children = [];
    this.parentElement = null;
    this.clientWidth = 1200;
    this.clientHeight = 800;
    this.position = 'relative';
    this.display = 'grid';
    const declarations = new Map();
    this.style = {
      getPropertyValue: key => declarations.get(key)?.value ?? '',
      getPropertyPriority: key => declarations.get(key)?.priority ?? '',
      setProperty: (key, value, priority = '') => declarations.set(key, { value, priority }),
      removeProperty: key => declarations.delete(key),
    };
  }
  get isConnected() { return this.tagName === 'body' || this.parentElement?.isConnected === true; }
  setAttribute(key, value) { this.attributes.set(key, value); }
  hasAttribute(key) { return this.attributes.has(key); }
  matches(selector) {
    return selector.split(',').some(part => {
      const attrs = [...part.matchAll(/\[([^\]=]+)(?:="([^"]*)")?\]/g)];
      const classes = [...part.replace(/\[[^\]]*\]/g, '').matchAll(/\.([\w-]+)/g)];
      return attrs.every(([, key, value]) => this.attributes.has(key)
        && (value === undefined || this.attributes.get(key) === value))
        && classes.every(([, name]) => this.className.split(/\s+/).includes(name));
    });
  }
  querySelectorAll(selector) {
    const nodes = selector.startsWith(':scope >') ? this.children
      : this.children.flatMap(child => [child, ...child.descendants()]);
    return nodes.filter(child => child.matches(selector));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  appendChild(child) { child.remove(); child.parentElement = this; this.children.push(child); return child; }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    this.parentElement = null;
  }
}
function fixture(layout = 'pI_x6G', sidebarName = 'hHd-Xa') {
  const body = new Element('body');
  const head = new Element('head');
  const layoutStyle = new Element('style', { 'data-plugin-css': '@deepseek-ai/dsh-client-ui-layout/AppFrame.module.css' });
  layoutStyle.textContent = `.${layout}_frame{}.${layout}_sidebarCol{}.${layout}_centerCol{}`;
  const sidebarStyle = new Element('style', { 'data-plugin-css': '@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css' });
  sidebarStyle.textContent = `.${sidebarName}_root{}.${sidebarName}_scrollFade{}`;
  head.append(layoutStyle, sidebarStyle);
  const observers = new Set();
  const statuses = [];
  const reports = [];
  const starts = [];
  let stops = 0;
  const doc = { body, head, querySelectorAll: selector => [...head.querySelectorAll(selector), ...body.querySelectorAll(selector)],
    createElement: tag => new Element(tag) };
  const win = {
    getComputedStyle: node => ({ position: node.position, display: node.display,
      isolation: node.style.getPropertyValue('isolation') || 'auto' }),
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe(target, options) { this.target = target; this.options = options; observers.add(this); }
      disconnect() { observers.delete(this); }
    },
  };
  const makeFrame = () => {
    const target = new Element('div', {}, `${layout}_frame`);
    const sidebar = new Element('div', {}, `${layout}_sidebarCol`);
    const sidebarRoot = new Element('div', {}, `${sidebarName}_root`);
    const center = new Element('div', {}, `${layout}_centerCol`);
    const root = new Element('div', { 'data-phase': 'hero' });
    const content = new Element('div', { 'data-conversation-content': '' });
    const card = new Element('div', { 'data-composer-card': '' });
    card.style.setProperty('background-color', 'white');
    content.append(card); root.append(content); center.append(root); sidebar.append(sidebarRoot);
    target.append(sidebar, center, new Element('div', { 'data-rightbar-col': '' }),
      new Element('div', { 'data-shell-bottom': '' }), new Element('div', { 'data-shell-overlay': '' }));
    body.append(target);
    return { target, sidebar, sidebarRoot, center, root, content, card };
  };
  return { doc, win, body, head, layoutStyle, sidebarStyle, statuses, reports, observers, starts, makeFrame, stops: () => stops,
    flush: () => [...observers].forEach(observer => observer.callback()),
    watch: (animate = (canvas, _win, _doc, target) => {
      starts.push({ canvas, target }); return () => { stops++; };
    }) => watchBackground(status => { statuses.push(status.state); reports.push(status); }, doc, win, animate),
  };
}

function workspaceFixture(f, sidebarRoot, hash) {
  const sheet = new Element('style', { 'data-plugin-css': '@deepseek-ai/dsh-client-ui-workspace/WorkspaceBrowser.module.css' });
  sheet.textContent = `.${hash}_root{}.${hash}_treeBody{}.${hash}_fade{background:linear-gradient(transparent,gray)}`;
  f.head.append(sheet);
  const root = new Element('div', {}, `${hash}_root`);
  const body = new Element('div', {}, `${hash}_treeBody`);
  const fade = new Element('span', {}, `${hash}_fade`);
  body.append(fade); root.append(body); sidebarRoot.append(root);
  return { sheet, root, body, fade };
}

test('workspace list bottom fades use their own stylesheet mapping and restore on list replacement', () => {
  for (const hash of ['Gakraw', 'Kjh-qa', 'build_123']) {
    const f = fixture();
    const { sidebarRoot, target } = f.makeFrame();
    const { body, fade } = workspaceFixture(f, sidebarRoot, hash);
    fade.style.setProperty('display', 'inline', 'important');
    const outside = new Element('span', {}, `${hash}_fade`);
    f.body.append(outside);
    const otherElement = new Element('div', {}, `${hash}_fade`);
    const nested = new Element('span', {}, `${hash}_fade`);
    otherElement.append(nested); body.append(otherElement);
    const dispose = f.watch();
    assert.equal(f.statuses.at(-1), 'attached');
    assert.equal(fade.style.getPropertyValue('display'), 'none');
    assert.equal(outside.style.getPropertyValue('display'), '');
    assert.equal(otherElement.style.getPropertyValue('display'), '');
    assert.equal(nested.style.getPropertyValue('display'), '');
    target.setAttribute('data-sidebar-drawer', 'true'); f.flush();
    assert.equal(fade.style.getPropertyValue('display'), 'none');
    fade.remove();
    const next = new Element('span', {}, `${hash}_fade`); body.append(next); f.flush();
    assert.equal(fade.style.getPropertyValue('display'), 'inline');
    assert.equal(fade.style.getPropertyPriority('display'), 'important');
    assert.equal(next.style.getPropertyValue('display'), 'none');
    assert.equal(f.starts.length, 1);
    dispose();
    assert.equal(next.style.getPropertyValue('display'), '');
    assert.equal(f.observers.size, 0);
  }
});

test('missing or ambiguous workspace decoration metadata cannot block the background and late unique styles recover', () => {
  for (const reason of ['missing', 'wrong-owner', 'duplicate-sheet', 'duplicate-fade', 'missing-root', 'missing-body']) {
    const f = fixture();
    const { sidebarRoot } = f.makeFrame();
    const { sheet, fade } = workspaceFixture(f, sidebarRoot, 'Gakraw');
    const unique = sheet.textContent;
    let extra;
    if (reason === 'missing') sheet.remove();
    if (reason === 'wrong-owner') sheet.setAttribute('data-plugin-css', 'unrelated/WorkspaceBrowser.module.css');
    if (reason === 'duplicate-sheet') {
      extra = new Element('style', { 'data-plugin-css': '@deepseek-ai/dsh-client-ui-workspace/WorkspaceBrowser.module.css' });
      extra.textContent = unique; f.head.append(extra);
    }
    if (reason === 'duplicate-fade') sheet.textContent += '.other_fade{}';
    if (reason === 'missing-root') sheet.textContent = '.Gakraw_treeBody{}.Gakraw_fade{}';
    if (reason === 'missing-body') sheet.textContent = '.Gakraw_root{}.Gakraw_fade{}';
    const dispose = f.watch();
    assert.equal(f.statuses.at(-1), 'attached', reason);
    assert.equal(fade.style.getPropertyValue('display'), '', reason);
    sheet.setAttribute('data-plugin-css', '@deepseek-ai/dsh-client-ui-workspace/WorkspaceBrowser.module.css');
    sheet.textContent = unique; extra?.remove(); f.head.append(sheet); f.flush();
    assert.equal(fade.style.getPropertyValue('display'), 'none', reason);
    sheet.remove(); f.flush();
    assert.equal(fade.style.getPropertyValue('display'), '');
    f.head.append(sheet); f.flush();
    fade.style.setProperty('display', 'block', 'important');
    dispose();
    assert.equal(fade.style.getPropertyValue('display'), 'block');
    assert.equal(f.starts.length, 1);
  }
});

test('class mappings follow the actual npm and installed Desktop stylesheet hashes', () => {
  for (const [layout, sidebarName] of [['pI_x6G', 'hHd-Xa'], ['PIRFFq', 'kB3qhq']]) {
    const f = fixture(layout, sidebarName);
    const { target, sidebar, sidebarRoot } = f.makeFrame();
    const dispose = f.watch();
    assert.equal(f.statuses.at(-1), 'attached', layout);
    assert.equal(f.starts[0].target, target);
    const sheet = target.children.at(-1).children[0];
    assert.ok(sheet.textContent.includes(`html[data-windows-titlebar] .${layout}_frame:has(> .power-dsh-flowing-background)::before { background: transparent !important; }`));
    assert.ok(sheet.textContent.includes(`html[data-windows-titlebar] .${layout}_frame:not([data-sidebar-drawer]):has(> .power-dsh-flowing-background) > .${layout}_sidebarCol { border-right: 0.5px solid var(--dsw-alias-border-l3) !important; }`));
    assert.equal(sidebar.style.getPropertyValue('background-color'), 'transparent');
    assert.equal(sidebarRoot.style.getPropertyValue('background-color'), 'transparent');
    dispose();
    assert.equal(sheet.isConnected, false, 'Closing the background removes its Windows chrome rules.');
  }
});

test('missing or ambiguous official style metadata is never guessed and late loading recovers', () => {
  for (const reason of ['missing', 'wrong-owner', 'duplicate-sheet', 'duplicate-class']) {
    const f = fixture('PIRFFq', 'kB3qhq');
    f.makeFrame();
    const original = f.layoutStyle.textContent;
    let extra;
    if (reason === 'missing') f.layoutStyle.remove();
    if (reason === 'wrong-owner') f.layoutStyle.setAttribute('data-plugin-css', 'unrelated/AppFrame.module.css');
    if (reason === 'duplicate-sheet') {
      extra = new Element('style', { 'data-plugin-css': '@deepseek-ai/dsh-client-ui-layout/AppFrame.module.css' });
      extra.textContent = original; f.head.append(extra);
    }
    if (reason === 'duplicate-class') f.layoutStyle.textContent += '.other_frame{}';
    const dispose = f.watch();
    assert.equal(f.starts.length, 0, reason);
    assert.equal(f.statuses.at(-1), 'unavailable');
    if (reason === 'missing') f.head.append(f.layoutStyle);
    if (reason === 'wrong-owner') f.layoutStyle.setAttribute('data-plugin-css', '@deepseek-ai/dsh-client-ui-layout/AppFrame.module.css');
    extra?.remove();
    f.layoutStyle.textContent = original;
    f.flush();
    assert.equal(f.statuses.at(-1), 'attached', reason);
    assert.equal(f.starts.length, 1);
    dispose();
  }
});

test('released builds without unique scroll fade metadata still attach and refresh only the optional decoration', () => {
  for (const reason of ['missing', 'ambiguous']) {
    const f = fixture('PIRFFq', 'kB3qhq');
    const { sidebarRoot } = f.makeFrame();
    const fade = new Element('span', { 'aria-hidden': 'true' }, 'kB3qhq_scrollFade');
    sidebarRoot.append(fade);
    const unique = f.sidebarStyle.textContent;
    const unsupported = reason === 'missing' ? '.kB3qhq_root{}' : `${unique}.other_scrollFade{}`;
    f.sidebarStyle.textContent = unsupported;
    const dispose = f.watch();
    assert.equal(f.statuses.at(-1), 'attached', reason);
    assert.equal(f.starts.length, 1);
    assert.equal(sidebarRoot.style.getPropertyValue('background-color'), 'transparent');
    assert.equal(fade.style.getPropertyValue('display'), '');
    f.sidebarStyle.textContent = unique; f.flush();
    assert.equal(fade.style.getPropertyValue('display'), 'none');
    f.sidebarStyle.textContent = unsupported; f.flush();
    assert.equal(fade.style.getPropertyValue('display'), '');
    assert.equal(f.statuses.at(-1), 'attached');
    assert.equal(f.starts.length, 1, 'Optional metadata changes must not restart the background.');
    dispose();
    assert.equal(f.observers.size, 0);
  }
});

test('one frame-wide canvas sits below content and sidebar while card surfaces stay native', () => {
  const f = fixture();
  const { target, sidebar, sidebarRoot, center, root, card } = f.makeFrame();
  const dispose = f.watch();
  const layer = target.children.at(-1);
  assert.equal(layer.className, 'power-dsh-flowing-background');
  assert.equal(layer.attributes.get('aria-hidden'), 'true');
  assert.match(layer.children[0].textContent, /position: absolute;.*z-index: -1/);
  assert.equal(f.starts[0].target, target);
  for (const surface of [sidebar, sidebarRoot, center, root]) {
    assert.equal(surface.style.getPropertyValue('background-color'), 'transparent');
    assert.equal(surface.style.getPropertyValue('background-image'), 'none');
  }
  assert.equal(card.style.getPropertyValue('background-color'), 'white');
  assert.equal(target.style.getPropertyValue('isolation'), 'isolate');
  assert.equal(target.style.getPropertyValue('background-color'), 'var(--dsw-alias-bg-base)');
  f.flush();
  assert.equal(f.starts.length, 1);
  dispose(); dispose();
  assert.equal(f.stops(), 1);
  assert.equal(target.children.length, 5);
  assert.equal(sidebar.style.getPropertyValue('background-color'), '');
  assert.equal(target.style.getPropertyValue('isolation'), '');
  assert.equal(f.observers.size, 0);
});

test('sidebar drawer mode restores its opaque native surfaces without restarting the global animation', () => {
  const f = fixture();
  const { target, sidebar, sidebarRoot } = f.makeFrame();
  sidebar.style.setProperty('background-color', 'white');
  const dispose = f.watch();
  assert.equal(sidebar.style.getPropertyValue('background-color'), 'transparent');
  target.setAttribute('data-sidebar-drawer', 'true'); f.flush();
  assert.equal(sidebar.style.getPropertyValue('background-color'), 'white');
  assert.equal(sidebarRoot.style.getPropertyValue('background-color'), '');
  target.attributes.delete('data-sidebar-drawer'); f.flush();
  assert.equal(sidebar.style.getPropertyValue('background-color'), 'transparent');
  assert.equal(f.starts.length, 1);
  dispose();
});

test('native sidebar bottom fade stays hidden while enabled and restores on replacement and disposal', () => {
  for (const sidebarName of ['hHd-Xa', 'kB3qhq']) {
    const f = fixture('PIRFFq', sidebarName);
    const { target, sidebarRoot } = f.makeFrame();
    const fade = new Element('span', { 'aria-hidden': 'true' }, `${sidebarName}_scrollFade`);
    fade.style.setProperty('display', 'block', 'important');
    sidebarRoot.append(fade);
    const unrelated = new Element('span', { 'aria-hidden': 'true' }, `${sidebarName}_scrollFade`);
    f.body.append(unrelated);
    const dispose = f.watch();
    assert.equal(fade.style.getPropertyValue('display'), 'none');
    assert.equal(fade.style.getPropertyPriority('display'), 'important');
    assert.equal(unrelated.style.getPropertyValue('display'), '');
    target.setAttribute('data-sidebar-drawer', 'true'); f.flush();
    assert.equal(fade.style.getPropertyValue('display'), 'none');
    fade.remove();
    const replacement = new Element('span', { 'aria-hidden': 'true' }, `${sidebarName}_scrollFade`);
    sidebarRoot.append(replacement); f.flush();
    assert.equal(fade.style.getPropertyValue('display'), 'block');
    assert.equal(fade.style.getPropertyPriority('display'), 'important');
    assert.equal(replacement.style.getPropertyValue('display'), 'none');
    assert.equal(f.starts.length, 1);
    dispose();
    assert.equal(replacement.style.getPropertyValue('display'), '');
  }
});

test('sidebar fade cleanup preserves later styles and rolls back failed attachment', () => {
  for (const fail of [false, true]) {
    const f = fixture();
    const { sidebarRoot } = f.makeFrame();
    const fade = new Element('span', { 'aria-hidden': 'true' }, 'hHd-Xa_scrollFade');
    sidebarRoot.append(fade);
    const dispose = fail ? f.watch(() => { throw new Error('initialization failed'); }) : f.watch();
    if (fail) assert.equal(fade.style.getPropertyValue('display'), '');
    else fade.style.setProperty('display', 'inline', 'important');
    dispose();
    assert.equal(fade.style.getPropertyValue('display'), fail ? '' : 'inline');
  }
});

test('closing restores previous values and priorities without overwriting another owner', () => {
  const f = fixture();
  const { target, sidebar, center } = f.makeFrame();
  target.style.setProperty('isolation', 'auto', 'important');
  sidebar.style.setProperty('background-image', 'linear-gradient(blue, white)', 'important');
  const dispose = f.watch();
  center.style.setProperty('background-color', 'pink', 'important');
  dispose();
  assert.equal(target.style.getPropertyValue('isolation'), 'auto');
  assert.equal(target.style.getPropertyPriority('isolation'), 'important');
  assert.equal(sidebar.style.getPropertyValue('background-image'), 'linear-gradient(blue, white)');
  assert.equal(sidebar.style.getPropertyPriority('background-image'), 'important');
  assert.equal(center.style.getPropertyValue('background-color'), 'pink');
});

test('conversation and frame replacement restore old surfaces and keep only one animation', () => {
  const f = fixture();
  const dispose = f.watch();
  const old = f.makeFrame(); f.flush();
  assert.equal(f.statuses.at(-1), 'attached');
  old.root.setAttribute('data-phase', 'active'); f.flush();
  assert.equal(f.starts.length, 1, 'Sending a message keeps the global background.');
  old.root.remove();
  const replacement = new Element('div', { 'data-phase': 'active' });
  replacement.append(new Element('div', { 'data-conversation-content': '' }));
  old.center.append(replacement); f.flush();
  assert.equal(old.root.style.getPropertyValue('background-color'), '');
  assert.equal(replacement.style.getPropertyValue('background-color'), 'transparent');
  assert.equal(f.starts.length, 1, 'Changing conversations refreshes surfaces without resetting animation.');
  old.target.remove();
  const next = f.makeFrame(); f.flush();
  assert.equal(f.stops(), 1);
  assert.equal(f.starts.at(-1).target, next.target);
  assert.equal(old.target.style.getPropertyValue('isolation'), '');
  dispose();
  assert.equal(f.stops(), 2);
});

test('composer surroundings reveal the artwork in both themes while card and menu material stay native', () => {
  for (const base of ['#fff', '#151517']) {
    const f = fixture();
    const { root, content, card } = f.makeFrame();
    root.setAttribute('data-phase', 'active');
    const seat = new Element('div', { 'data-composer-seat': '', 'data-conversation-region': 'composer' });
    const fade = `linear-gradient(180deg, transparent, ${base} 36px)`;
    seat.style.setProperty('background-image', fade, 'important');
    seat.append(card); content.append(seat);
    card.style.setProperty('box-shadow', 'var(--dsw-elevation-soft)');
    const dispose = f.watch();
    assert.equal(seat.style.getPropertyValue('background-image'), 'none');
    assert.equal(card.style.getPropertyValue('background-color'), 'white');
    assert.equal(card.style.getPropertyValue('box-shadow'), 'var(--dsw-elevation-soft)');

    const menu = new Element('div', { 'data-menu-material': 'translucent' });
    menu.style.setProperty('box-shadow', 'var(--dsw-elevation-prominent)');
    const material = new Element();
    material.style.setProperty('background-color', base);
    material.style.setProperty('backdrop-filter', 'blur(40px) saturate(150%)');
    menu.append(material); f.body.append(menu);
    const backing = new Element('div', { 'data-menu-backing': '', 'aria-hidden': 'true' });
    backing.style.setProperty('background-color', base, 'important');
    f.body.append(backing); f.flush();
    assert.equal(backing.style.getPropertyValue('background-color'), base);
    assert.equal(menu.style.getPropertyValue('box-shadow'), 'var(--dsw-elevation-prominent)');
    assert.equal(material.style.getPropertyValue('background-color'), base);
    assert.equal(material.style.getPropertyValue('backdrop-filter'), 'blur(40px) saturate(150%)');
    assert.equal(f.starts.length, 1, 'Opening a menu must not restart the animation.');

    backing.remove(); f.flush();
    assert.equal(backing.style.getPropertyValue('background-color'), base);
    assert.equal(backing.style.getPropertyPriority('background-color'), 'important');
    f.body.append(backing); f.flush();
    assert.equal(backing.style.getPropertyValue('background-color'), base);
    dispose();
    assert.equal(seat.style.getPropertyValue('background-image'), fade);
    assert.equal(seat.style.getPropertyPriority('background-image'), 'important');
    assert.equal(backing.style.getPropertyValue('background-color'), base);
    assert.equal(backing.style.getPropertyPriority('background-color'), 'important');
    assert.equal(backing.style.getPropertyValue('background-image'), '');
  }
});

test('missing, hidden, ambiguous or unsupported frames never get a foreground fallback', () => {
  for (const reason of ['missing', 'hidden', 'ambiguous', 'static', 'non-grid', 'no-column']) {
    const f = fixture();
    if (reason !== 'missing') {
      const { target, center } = f.makeFrame();
      if (reason === 'hidden') target.clientWidth = 0;
      if (reason === 'ambiguous') f.makeFrame();
      if (reason === 'static') target.position = 'static';
      if (reason === 'non-grid') target.display = 'flex';
      if (reason === 'no-column') center.remove();
    }
    const dispose = f.watch();
    assert.equal(f.starts.length, 0, reason);
    assert.equal(f.statuses.at(-1), 'unavailable', reason);
    dispose();
    assert.equal(f.observers.size, 0);
  }
});

test('the shell controller renders nothing and reports layout feedback until recovery', () => {
  const f = fixture();
  let component;
  let effect;
  const React = { createElement: (type, props) => ({ type, props }), useLayoutEffect: fn => { effect = fn; },
    useSyncExternalStore: (_subscribe, get) => get() };
  const feature = createClientFeature(createRuntime(React, {}), {
    namespace: 'test', t: key => key,
    preferenceSlot: (_field, _slot, _options, view) => { component = view; },
  });
  assert.equal(component({}).type(), null);
  const previousDoc = globalThis.document;
  const previousWin = globalThis.window;
  globalThis.document = f.doc; globalThis.window = f.win;
  const settings = enabled => feature.useSettings({ snapshot: { value: { flowingBackgroundEnabled: enabled } } })[0];
  try {
    const dispose = effect();
    const first = settings(true).failure;
    assert.equal(first.code, 'PD-BACKGROUND-LAYOUT');
    assert.equal(first.operation, 'flowing-background.attach');
    assert.equal(first.context.stage, 'frame (flowingBackgroundStageFrame)');
    assert.equal(first.context.check, 'app-frame');
    assert.equal(first.context.result, 'missing (flowingBackgroundResultMissing)');
    assert.equal(first.context.expected, '1 visible frame');
    assert.equal(first.context.actual, '0');
    assert.equal(first.context.state, 'flowingBackgroundStatePreserved');
    assert.equal(first.context.recovery, 'flowingBackgroundRecoveryWait');
    f.flush();
    assert.equal(settings(true).failure.observedAt, first.observedAt);
    const originalStyles = f.layoutStyle.textContent;
    f.layoutStyle.textContent += '.other_frame{}'; f.flush();
    assert.equal(settings(true).failure.context.check, 'layout.frame');
    assert.equal(settings(true).failure.context.actual, '2');
    assert.equal(settings(true).failure.context.recovery, 'flowingBackgroundRecoveryUpdate');
    f.layoutStyle.textContent += '.third_frame{}'; f.flush();
    assert.equal(settings(true).failure.context.actual, '3', 'Updated counts must replace the prior diagnostic.');
    f.layoutStyle.textContent = originalStyles; f.flush();
    assert.equal(settings(true).error, undefined, 'A runtime fault is not a settings-save error.');
    dispose();
    assert.equal(settings(true).failure.code, 'PD-BACKGROUND-LAYOUT');
    assert.equal(settings(false).failure, undefined);
    f.makeFrame();
    const disposeNext = effect();
    assert.equal(settings(true).failure, undefined);
    disposeNext();
    assert.equal(f.observers.size, 0);
  } finally {
    if (previousDoc === undefined) delete globalThis.document; else globalThis.document = previousDoc;
    if (previousWin === undefined) delete globalThis.window; else globalThis.window = previousWin;
  }
});

test('background summaries and recovery guidance are bilingual while diagnostic identifiers stay stable', () => {
  const previousDoc = globalThis.document;
  const previousWin = globalThis.window;
  try {
    for (const language of ['en', 'zh']) {
      const f = fixture(); f.makeFrame(); f.layoutStyle.remove();
      globalThis.document = f.doc; globalThis.window = f.win;
      let component, effect;
      const React = { createElement: (type, props) => ({ type, props }), useLayoutEffect: fn => { effect = fn; },
        useSyncExternalStore: (_subscribe, get) => get() };
      const feature = createClientFeature(createRuntime(React, {}), { namespace: 'test',
        t: key => locales[language][key], preferenceSlot: (_field, _slot, _options, view) => { component = view; } });
      component({}).type();
      const dispose = effect();
      const current = () => feature.useSettings({ snapshot: { value: { flowingBackgroundEnabled: true } } })[0].failure;
      assert.ok(current().message.includes(locales[language].flowingBackgroundStylesMissing));
      assert.equal(current().context.check, 'layout.stylesheet');
      assert.ok(current().context.stage.startsWith('styles ('));
      assert.equal(current().context.recovery, locales[language].flowingBackgroundRecoveryWait);
      f.head.append(f.layoutStyle);
      f.layoutStyle.textContent += '.other_frame{}'; f.flush();
      assert.ok(current().message.includes(locales[language].flowingBackgroundStylesAmbiguous));
      assert.equal(current().context.recovery, locales[language].flowingBackgroundRecoveryUpdate);
      assert.equal(current().context.actual, '2');
      dispose();
    }
  } finally {
    if (previousDoc === undefined) delete globalThis.document; else globalThis.document = previousDoc;
    if (previousWin === undefined) delete globalThis.window; else globalThis.window = previousWin;
  }
});

test('background diagnostics identify the failed check without copying DOM, styles or exceptions', () => {
  const cases = [
    ['styles', 'layout.stylesheet', 'missing', '1', '0', f => f.layoutStyle.remove()],
    ['styles', 'layout.frame', 'ambiguous', '1', '2', f => { f.layoutStyle.textContent += '.other_frame{}'; }],
    ['styles', 'sidebar.root', 'missing', '1', '0', f => { f.sidebarStyle.textContent = '.kB3qhq_scrollFade{}'; }],
    ['frame', 'app-frame', 'hidden', '1 visible frame', '0', (_f, frame) => { frame.target.clientWidth = 0; }],
    ['frame', 'app-frame', 'ambiguous', '1 visible frame', '2', f => f.makeFrame()],
    ['frame', 'frame.position', 'unsupported', 'relative', 'static', (_f, frame) => { frame.target.position = 'static'; }],
    ['frame', 'frame.display', 'unsupported', 'grid', 'flex', (_f, frame) => { frame.target.display = 'flex'; }],
    ['frame', 'frame.center', 'missing', '1 direct child', '0', (_f, frame) => frame.center.remove()],
    ['environment', 'mutation-observer', 'unsupported', 'available', 'missing', f => { f.win.MutationObserver = undefined; }],
  ];
  for (const [stage, check, result, expected, actual, change] of cases) {
    const f = fixture('PIRFFq', 'kB3qhq');
    const frame = f.makeFrame();
    change(f, frame);
    const dispose = f.watch();
    assert.deepEqual(f.reports.at(-1), { state: 'unavailable', stage, check, result, expected, actual });
    dispose();
  }
  const f = fixture(); f.makeFrame();
  const dispose = f.watch(() => { throw new Error('token=do-not-copy /Users/private/data'); });
  assert.deepEqual(f.reports.at(-1), { state: 'unavailable', stage: 'initialization', check: 'attachment.initialize', result: 'failed', expected: 'completed', actual: 'exception' });
  assert.ok(!JSON.stringify(f.reports).includes('do-not-copy'));
  dispose();
});

test('failed global attachment rolls back surfaces without retrying on its own mutations', () => {
  const f = fixture();
  const { target, sidebar } = f.makeFrame();
  let attempts = 0;
  const dispose = f.watch(() => { attempts++; throw new Error('simulated initialization rejection'); });
  f.flush(); f.flush();
  assert.equal(attempts, 1);
  assert.equal(f.statuses.at(-1), 'unavailable');
  assert.equal(target.children.length, 5);
  assert.equal(target.style.getPropertyValue('isolation'), '');
  assert.equal(sidebar.style.getPropertyValue('background-color'), '');
  dispose();
});

test('live appearance notifications restyle the same artwork and release their subscription', () => {
  const f = fixture();
  f.makeFrame();
  let appearance = { opacity: 100, blur: 0 };
  let notify;
  let starts = 0;
  let stops = 0;
  let released = false;
  const dispose = watchBackground(() => {}, f.doc, f.win, () => {
    starts++;
    return () => { stops++; };
  }, appearance, () => appearance, listener => {
    notify = listener;
    return () => { released = true; };
  });
  const layer = f.body.querySelector('.power-dsh-flowing-background');
  const canvas = layer.children.find(child => child.tagName === 'canvas');
  appearance = { opacity: 35, blur: 16 };
  notify();
  assert.equal(layer.style.getPropertyValue('opacity'), '0.35');
  assert.equal(canvas.style.getPropertyValue('filter'), 'blur(16px)');
  for (const property of ['position', 'inset', 'width', 'height']) {
    assert.equal(canvas.style.getPropertyValue(property), '', 'Blur preserves the original canvas framing.');
  }
  appearance = { opacity: 100, blur: 0 };
  notify();
  assert.equal(layer.style.getPropertyValue('opacity'), '');
  assert.equal(canvas.style.getPropertyValue('filter'), '');
  for (const property of ['position', 'inset', 'width', 'height']) {
    assert.equal(canvas.style.getPropertyValue(property), '', 'Zero blur restores the original artwork geometry.');
  }
  assert.equal(f.body.querySelector('.power-dsh-flowing-background'), layer);
  assert.equal(starts, 1);
  assert.equal(stops, 0);
  dispose();
  assert.equal(stops, 1);
  assert.equal(released, true);
  notify();
  assert.equal(starts, 1);
});

test('opacity and frosted blur are written to the owned layer and canvas only', () => {
  const f = fixture();
  f.makeFrame();
  const dispose = watchBackground(() => {}, f.doc, f.win, () => () => {}, { opacity: 50, blur: 12 });
  const layer = f.body.querySelector('.power-dsh-flowing-background');
  assert.ok(layer, 'the background layer attaches');
  assert.equal(layer.style.getPropertyValue('opacity'), '0.5');
  const canvas = layer.children.find(child => child.tagName === 'canvas');
  assert.ok(canvas);
  assert.equal(canvas.style.getPropertyValue('filter'), 'blur(12px)');
  dispose();

  const clear = fixture();
  clear.makeFrame();
  const disposeClear = watchBackground(() => {}, clear.doc, clear.win, () => () => {}, { opacity: 100, blur: 0 });
  const clearLayer = clear.body.querySelector('.power-dsh-flowing-background');
  assert.equal(clearLayer.style.getPropertyValue('opacity'), '', 'full opacity keeps no inline override');
  assert.equal(clearLayer.children.find(child => child.tagName === 'canvas').style.getPropertyValue('filter'), '');
  disposeClear();
});

test('a wallpaper layer uses a cover image and never starts the GPU frame chain', () => {
  const f = fixture();
  f.makeFrame();
  const starts = [];
  const dispose = watchBackground(() => {}, f.doc, f.win, (canvas, _win, _doc, target) => {
    starts.push({ canvas, target });
    return () => {};
  }, { opacity: 80, blur: 8, wallpaper: { dataUrl: 'data:image/png;base64,AAAA', name: 'sky.png' } });
  const layer = f.body.querySelector('.power-dsh-flowing-background');
  assert.ok(layer);
  assert.equal(layer.attributes.get('data-kind'), 'wallpaper');
  assert.equal(layer.style.getPropertyValue('opacity'), '0.8');
  const image = layer.children.find(child => child.tagName === 'img');
  assert.ok(image, 'The wallpaper renders as an image');
  assert.equal(image.attributes.get('alt'), '', 'The decorative image stays out of the accessibility tree');
  assert.equal(image.attributes.get('draggable'), 'false');
  assert.equal(image.style.getPropertyValue('filter'), 'blur(8px)');
  for (const property of ['position', 'inset', 'width', 'height']) {
    assert.equal(image.style.getPropertyValue(property), '', 'Blur cannot enlarge the cover box.');
  }
  assert.equal(layer.children.some(child => child.tagName === 'canvas'), false);
  assert.equal(starts.length, 0, 'No WebGL chain is created for a static wallpaper');
  dispose();
});

test('wallpaper blur preserves image framing across the full range and clears old padding', () => {
  const f = fixture();
  f.makeFrame();
  let appearance = { opacity: 100, blur: 999, wallpaper: { dataUrl: 'data:image/png;base64,AAAA', name: 'sky.png' } };
  let notify;
  const dispose = watchBackground(() => {}, f.doc, f.win, () => {
    throw new Error('A wallpaper must not start a GPU chain.');
  }, appearance, () => appearance, listener => { notify = listener; return () => {}; });
  const layer = f.body.querySelector('.power-dsh-flowing-background');
  const image = layer.children.find(child => child.tagName === 'img');
  const frame = layer.parentElement;
  // Simulate an existing layer with geometry left by the previous blur behavior.
  image.style.setProperty('position', 'absolute');
  image.style.setProperty('inset', '-120px');
  image.style.setProperty('width', 'calc(100% + 240px)');
  image.style.setProperty('height', 'calc(100% + 240px)');
  for (const blur of [999, 40, 16, 8, 0]) {
    appearance = { ...appearance, blur };
    notify();
    assert.equal(image.style.getPropertyValue('filter'), blur ? `blur(${Math.min(40, blur)}px)` : '');
    assert.equal(layer.children.find(child => child.tagName === 'img'), image);
    for (const property of ['position', 'inset', 'width', 'height']) {
      assert.equal(image.style.getPropertyValue(property), '', 'Changing blur never scales or repositions the image.');
    }
    for (const property of ['filter', 'inset', 'width', 'height']) assert.equal(frame.style.getPropertyValue(property), '');
  }
  dispose();
});
