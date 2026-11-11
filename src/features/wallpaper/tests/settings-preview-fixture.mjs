import assert from 'node:assert/strict';

const SETTINGS_SELECTOR = '[data-shortcut-modal="settings"][role="dialog"][aria-modal="true"]';

/** Minimal owned range ancestry matching the verified native settings portal. */
export function settingsPreviewFixture() {
  function node(attributes = {}) {
    const properties = new Map();
    const style = {
      getPropertyValue: name => properties.get(name)?.value ?? '',
      getPropertyPriority: name => properties.get(name)?.priority ?? '',
      setProperty: (name, value, priority = '') => properties.set(name, { value, priority }),
      removeProperty: name => { const old = properties.get(name)?.value ?? ''; properties.delete(name); return old; },
    };
    return {
      attributes, style, children: [], parentElement: null,
      getAttribute: name => attributes[name] ?? null,
      hasAttribute: name => Object.hasOwn(attributes, name),
      setAttribute: (name, value) => { attributes[name] = String(value); },
      removeAttribute: name => { delete attributes[name]; },
    };
  }
  const body = node();
  const overlay = { ...node({ role: 'presentation' }), parentElement: body };
  const mask = { ...node({ 'aria-hidden': 'true' }), parentElement: overlay };
  const panel = { ...node({ 'data-shortcut-modal': 'settings', role: 'dialog', 'aria-modal': 'true' }), parentElement: overlay };
  const row = { ...node({ 'data-power-dsh-wallpaper-slider': '' }), parentElement: panel };
  body.children.push(overlay);
  overlay.children.push(mask, panel);
  panel.children.push(row);
  const captures = [];
  const input = {
    ...node(), isConnected: true, ownerDocument: { body }, parentElement: row,
    closest(selector) {
      assert.equal(selector, SETTINGS_SELECTOR, 'Only the owned input ancestry is queried.');
      return panel.attributes['data-shortcut-modal'] === 'settings' && panel.attributes.role === 'dialog'
        && panel.attributes['aria-modal'] === 'true' ? panel : null;
    },
    setPointerCapture(pointerId) { captures.push({ pointerId, visibility: overlay.style.getPropertyValue('visibility') }); },
  };
  row.children.push(input);
  return { body, overlay, mask, panel, row, input, captures,
    event: (pointerId = 7, extra = {}) => ({ pointerId, button: 0, isPrimary: true, timeStamp: 0, clientX: 100, currentTarget: input, ...extra }),
  };
}
