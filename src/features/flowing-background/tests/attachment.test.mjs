import assert from 'node:assert/strict';
import { test } from 'node:test';
import { watchBackground } from '../attachment.ts';
import { createClientFeature } from '../client.ts';
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
  return { doc, win, body, head, layoutStyle, sidebarStyle, statuses, observers, starts, makeFrame, stops: () => stops,
    flush: () => [...observers].forEach(observer => observer.callback()),
    watch: (animate = (canvas, _win, _doc, target) => {
      starts.push({ canvas, target }); return () => { stops++; };
    }) => watchBackground(status => statuses.push(status), doc, win, animate),
  };
}

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
    assert.equal(settings(true).error, 'flowingBackgroundLayoutUnavailable');
    dispose();
    assert.equal(settings(true).error, 'flowingBackgroundLayoutUnavailable');
    assert.equal(settings(false).error, undefined);
    f.makeFrame();
    const disposeNext = effect();
    assert.equal(settings(true).error, undefined);
    disposeNext();
    assert.equal(f.observers.size, 0);
  } finally {
    if (previousDoc === undefined) delete globalThis.document; else globalThis.document = previousDoc;
    if (previousWin === undefined) delete globalThis.window; else globalThis.window = previousWin;
  }
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
