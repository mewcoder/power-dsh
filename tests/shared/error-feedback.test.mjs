import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createErrorFeedback } from '../../src/shared/client/error-feedback.ts';
import { diagnosticReport, sanitizeDiagnosticText } from '../../src/shared/types/diagnostics.ts';
import { locales } from '../../src/shared/client/locales.ts';

function descendants(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...(node.props.children || []).flat(Infinity).flatMap(descendants)];
}

function fixture(language = 'en') {
  const states = [];
  const effects = [];
  let cursor = 0;
  const React = {
    createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = value; }];
    },
    useRef(initial) { const index = cursor++; return states[index] ||= { current: initial }; },
    useId() { return `error-test-${cursor++}`; },
    useEffect(callback) { const index = cursor++; if (!(index in states)) { states[index] = true; effects.push(callback()); } },
  };
  const feedback = createErrorFeedback(React, 'button');
  const props = { t: key => locales[language][key] || key, message: 'Could not read the directory.', code: 'PD-SKILLS-LOAD', operation: 'listSkills' };
  const outer = feedback(props);
  const detailsNode = descendants(outer).find(node => typeof node.type === 'function');
  return {
    props, feedback, outer,
    render() { cursor = 0; return detailsNode.type(detailsNode.props); },
    dispose() { for (const effect of effects) effect?.(); },
  };
}

async function withBrowser(t, clipboard, run) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { __DSH_BOOT__: { release: { version: '0.2.2-rc.1' } } } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard } });
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else Reflect.deleteProperty(globalThis, 'navigator');
  });
  return run();
}

const copyButton = view => descendants(view).find(node => node.props.className === 'power-dsh-error-copy');
const disclosure = view => descendants(view).find(node => node.props.className === 'power-dsh-error-disclosure');
const status = view => descendants(view).find(node => node.props.role === 'status');

test('diagnostic text is bounded and excludes credentials, URLs and Windows/POSIX paths', () => {
  const source = [
    'Authorization: Bearer my-authorization-secret',
    'Cookie=session-secret',
    'api_key="quoted credential value" password=hidden-password token=hidden-token',
    'Request https://host.example/path?key=secret',
    'At C:\\Users\\me\\private.txt and \\\\host\\private\\file',
    'At /Users/me/private/file.json',
    '\u0000'.repeat(10),
  ].join('\n');
  const safe = sanitizeDiagnosticText(source);
  for (const [, value] of source.matchAll(/(?:password|token)=([^\s]+)/g)) assert.ok(!safe.includes(value));
  for (const secret of ['my-authorization-secret', 'session-secret', 'quoted credential value', 'hidden-password', 'hidden-token', 'host.example', 'C:\\Users', '\\\\host', '/Users/me']) assert.ok(!safe.includes(secret), secret);
  assert.ok(safe.includes('[redacted]'));
  assert.ok(safe.includes('[path]'));
  assert.ok(safe.includes('[url]'));
  assert.ok(sanitizeDiagnosticText('x'.repeat(10000)).length <= 2048);
  const truncatedQuote = sanitizeDiagnosticText('password="' + 'private value '.repeat(1000));
  assert.ok(!truncatedQuote.includes('private value'), 'Truncation must not expose a partial quoted credential.');
  const report = diagnosticReport({ code: 'PD-TEST', operation: 'test', message: source, observedAt: '2026-11-09T00:00:00Z', version: '0.2.2-rc.1', config: 'not-selected' });
  assert.ok(!report.includes('not-selected'));
  assert.ok(report.includes('Code: PD-TEST'));
});

test('shared errors expose one alert, associated id, authored code and optional retry without an automatic retry', async () => {
  const app = fixture();
  let retries = 0;
  const view = app.feedback({ ...app.props, id: 'field-error', placement: 'page', disabled: true, retry: () => { retries++; } });
  assert.equal(view.props.role, 'alert');
  assert.equal(view.props.id, 'field-error');
  assert.equal(view.props['data-error-code'], 'PD-SKILLS-LOAD');
  assert.equal(view.props['data-placement'], 'page');
  assert.equal(retries, 0);
  let stopped = false;
  view.props.onClick({ stopPropagation() { stopped = true; } });
  assert.equal(stopped, true, 'Error information must not trigger surrounding card actions.');
  const retry = descendants(view).find(node => node.type === 'button');
  assert.equal(retry.props.disabled, true);
  assert.ok(!descendants(app.outer).some(node => node.type === 'button'));
});

test('error information stays selectable and bilingual; copying writes only the displayed diagnostic', async t => {
  const copies = [];
  await withBrowser(t, { writeText: async text => { copies.push(text); } }, async () => {
    for (const language of ['en', 'zh']) {
      const app = fixture(language);
      let view = app.render();
      const toggle = disclosure(view);
      assert.ok(toggle.props.children.includes(locales[language].errorDetails));
      assert.equal(toggle.props['aria-expanded'], false);
      const panel = descendants(view).find(node => node.props.id === toggle.props['aria-controls']);
      assert.equal(panel.props.hidden, true);
      toggle.props.onClick();
      view = app.render();
      assert.equal(disclosure(view).props['aria-expanded'], true);
      assert.equal(disclosure(view).props['aria-controls'], panel.props.id);
      assert.equal(descendants(view).find(node => node.props.id === panel.props.id).props.hidden, false);
      assert.equal(disclosure(view).props.variant, 'ghost');
      assert.equal(disclosure(view).props.size, 'sm');
      assert.equal(copyButton(view).props.variant, 'outline');
      assert.equal(copyButton(view).props.size, 'sm');
      const report = descendants(view).find(node => node.type === 'pre');
      assert.equal(report.props.tabIndex, 0);
      await copyButton(view).props.onClick();
      assert.equal(copies.at(-1), report.props.children[0]);
      assert.ok(copies.at(-1).includes('DSH: 0.2.2-rc.1'));
      assert.ok(status(app.render()).props.children.includes(locales[language].errorInfoCopied));
      disclosure(app.render()).props.onClick();
      view = app.render();
      assert.equal(disclosure(view).props['aria-expanded'], false);
      assert.equal(descendants(view).find(node => node.props.id === panel.props.id).props.hidden, true);
      disclosure(view).props.onClick();
      assert.equal(descendants(app.render()).find(node => node.type === 'pre').props.children[0], report.props.children[0]);
      app.dispose();
    }
  });
});

test('clipboard absence and rejection retain error details and explain manual copying', async t => {
  for (const clipboard of [undefined, { writeText: async () => { throw new Error('Denied'); } }]) {
    await t.test(clipboard ? 'denied' : 'unavailable', async t => withBrowser(t, clipboard, async () => {
      const app = fixture('zh');
      await copyButton(app.render()).props.onClick();
      const view = app.render();
      assert.ok(status(view).props.children.includes(locales.zh.errorInfoCopyFailed));
      assert.ok(descendants(view).some(node => node.type === 'pre'));
      assert.ok(app.outer.props.children.includes(app.props.message));
      app.dispose();
    }));
  }
});

test('pending copies cannot overlap and completion after disposal cannot update feedback', async t => {
  const gate = Promise.withResolvers();
  let writes = 0;
  await withBrowser(t, { writeText() { writes++; return gate.promise; } }, async () => {
    const app = fixture();
    const button = copyButton(app.render());
    const pending = button.props.onClick();
    await button.props.onClick();
    assert.equal(writes, 1);
    assert.equal(copyButton(app.render()).props.disabled, true);
    app.dispose();
    gate.resolve();
    await pending;
    assert.equal(status(app.render()), undefined);
  });
});
