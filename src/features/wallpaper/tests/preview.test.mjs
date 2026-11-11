import assert from 'node:assert/strict';
import { test } from 'node:test';
import { temporarilyHideSettings } from '../preview.ts';
import { settingsPreviewFixture } from './settings-preview-fixture.mjs';

const PREVIEW = 'data-wallpaper-previewing';
const visibility = node => [node.style.getPropertyValue('visibility'), node.style.getPropertyPriority('visibility')];

test('preview hides native settings while the same mounted slider row stays visible', () => {
  const dom = settingsPreviewFixture();
  const nodes = [dom.body, dom.overlay, dom.mask, dom.panel, dom.row, dom.input];
  const structure = nodes.map(node => ({ node, parent: node.parentElement, children: [...node.children] }));
  for (const node of nodes) {
    node.style.setProperty('opacity', '0.85', 'important');
    node.style.setProperty('display', 'block');
    node.style.setProperty('position', 'relative');
  }
  const restore = temporarilyHideSettings(dom.input);
  assert.equal(typeof restore, 'function');
  assert.deepEqual(visibility(dom.overlay), ['hidden', 'important']);
  assert.deepEqual(visibility(dom.row), ['visible', 'important'], 'The active controls override inherited hidden visibility.');
  assert.equal(dom.row.getAttribute(PREVIEW), '');
  assert.equal(dom.input.isConnected, true);
  assert.equal(dom.panel.getAttribute('aria-modal'), 'true');
  for (const { node, parent, children } of structure) {
    assert.equal(node.parentElement, parent);
    assert.deepEqual(node.children, children);
    assert.equal(node.style.getPropertyValue('opacity'), '0.85');
    assert.equal(node.style.getPropertyPriority('opacity'), 'important');
    assert.equal(node.style.getPropertyValue('display'), 'block');
    assert.equal(node.style.getPropertyValue('position'), 'relative');
  }
  restore();
  assert.deepEqual(visibility(dom.overlay), ['', '']);
  assert.deepEqual(visibility(dom.row), ['', '']);
  assert.equal(dom.row.hasAttribute(PREVIEW), false);
});

test('restoration preserves empty and nonempty visibility values and priorities on both nodes', () => {
  const originals = [['', ''], ['visible', ''], ['hidden', 'important'], ['collapse', 'important']];
  for (const overlayValue of originals) for (const rowValue of originals) {
    const dom = settingsPreviewFixture();
    dom.overlay.style.setProperty('visibility', ...overlayValue);
    dom.row.style.setProperty('visibility', ...rowValue);
    const restore = temporarilyHideSettings(dom.input);
    restore();
    assert.deepEqual(visibility(dom.overlay), overlayValue);
    assert.deepEqual(visibility(dom.row), rowValue);
    dom.overlay.style.setProperty('visibility', 'collapse');
    dom.row.style.setProperty('visibility', 'hidden');
    dom.row.setAttribute(PREVIEW, 'later');
    restore();
    assert.deepEqual(visibility(dom.overlay), ['collapse', ''], 'Repeated cleanup is inert.');
    assert.deepEqual(visibility(dom.row), ['hidden', '']);
    assert.equal(dom.row.getAttribute(PREVIEW), 'later');
  }
});

test('restoration independently preserves third-party visibility values and priority changes', () => {
  for (const target of ['overlay', 'row']) {
    const ownValue = target === 'overlay' ? 'hidden' : 'visible';
    for (const [value, priority] of [['collapse', 'important'], [ownValue, ''], ['', '']]) {
      const dom = settingsPreviewFixture();
      dom.overlay.style.setProperty('visibility', 'visible');
      dom.row.style.setProperty('visibility', 'collapse');
      const restore = temporarilyHideSettings(dom.input);
      if (value) dom[target].style.setProperty('visibility', value, priority);
      else dom[target].style.removeProperty('visibility');
      restore();
      assert.deepEqual(visibility(dom[target]), [value, priority]);
      const other = target === 'overlay' ? 'row' : 'overlay';
      assert.deepEqual(visibility(dom[other]), [other === 'overlay' ? 'visible' : 'collapse', ''], 'A changed node cannot block cleanup of the other node.');
    }
  }
});

test('preview marker restores its previous value and preserves later attribute writes', () => {
  for (const original of [null, '', 'already-marked']) {
    for (const later of [undefined, null, 'third-party']) {
      const dom = settingsPreviewFixture();
      if (original !== null) dom.row.setAttribute(PREVIEW, original);
      const restore = temporarilyHideSettings(dom.input);
      assert.equal(dom.row.getAttribute(PREVIEW), '');
      if (later === null) dom.row.removeAttribute(PREVIEW);
      else if (later !== undefined) dom.row.setAttribute(PREVIEW, later);
      restore();
      assert.equal(dom.row.getAttribute(PREVIEW), later === undefined ? original : later);
      restore();
      assert.equal(dom.row.getAttribute(PREVIEW), later === undefined ? original : later);
    }
  }
});

test('unsupported settings ancestry or an input without its own direct slider row is left untouched', () => {
  const cases = [
    dom => { dom.input.isConnected = false; },
    dom => { dom.row.removeAttribute('data-power-dsh-wallpaper-slider'); },
    dom => { dom.row.removeAttribute('data-power-dsh-wallpaper-slider'); dom.panel.setAttribute('data-power-dsh-wallpaper-slider', ''); },
    dom => { dom.input.parentElement = dom.panel; },
    dom => { dom.panel.attributes['data-shortcut-modal'] = 'other'; },
    dom => { dom.panel.attributes.role = 'menu'; },
    dom => { dom.panel.attributes['aria-modal'] = 'false'; },
    dom => { dom.panel.parentElement = null; },
    dom => { dom.overlay.parentElement = {}; },
    dom => { dom.overlay.attributes.role = 'dialog'; },
    dom => { dom.overlay.children.push({}); },
    dom => { dom.overlay.children = [dom.panel, dom.mask]; },
    dom => { dom.mask.attributes['aria-hidden'] = 'false'; },
    dom => { dom.overlay.children = [dom.panel]; },
  ];
  for (const mutate of cases) {
    const dom = settingsPreviewFixture();
    dom.overlay.style.setProperty('visibility', 'collapse', 'important');
    dom.row.style.setProperty('visibility', 'hidden');
    dom.overlay.style.setProperty('opacity', '0.8');
    mutate(dom);
    assert.equal(temporarilyHideSettings(dom.input), null);
    assert.deepEqual(visibility(dom.overlay), ['collapse', 'important']);
    assert.deepEqual(visibility(dom.row), ['hidden', '']);
    assert.equal(dom.row.hasAttribute(PREVIEW), false);
    assert.equal(dom.overlay.style.getPropertyValue('opacity'), '0.8');
  }
});
