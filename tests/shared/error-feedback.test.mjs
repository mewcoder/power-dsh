import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createErrorFeedback } from '../../src/shared/client/error-feedback.ts';
import { diagnosticReport, sanitizeDiagnosticText } from '../../src/shared/types/diagnostics.ts';
import { locales } from '../../src/shared/client/locales.ts';

function descendants(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...(node.props.children || []).flat(Infinity).flatMap(descendants), ...descendants(node.props.footer)];
}

function fixture(language = 'en') {
  let states = [];
  let effects = [];
  let cursor = 0;
  const React = {
    createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      const instanceStates = states;
      return [states[index], value => { instanceStates[index] = value; }];
    },
    useRef(initial) { const index = cursor++; return states[index] ||= { current: initial }; },
    useId() { return `error-test-${cursor++}`; },
    useEffect(callback) {
      const index = cursor++;
      if (!(index in states)) { states[index] = true; effects.push({ callback, cleanup: callback() }); }
    },
  };
  const feedback = createErrorFeedback(React, 'button', 'native-modal');
  const props = { t: key => locales[language][key] || key, message: 'Could not read the directory.', code: 'PD-SKILLS-LOAD', operation: 'listSkills' };
  const outer = feedback(props);
  let detailsNode = descendants(outer).find(node => typeof node.type === 'function');
  function dispose() { for (const effect of effects) effect.cleanup?.(); }
  return {
    props, feedback, outer,
    render(nextProps) {
      if (nextProps) {
        const next = descendants(feedback({ ...props, ...nextProps })).find(node => typeof node.type === 'function');
        if (next.props.key !== detailsNode.props.key) { dispose(); states = []; effects = []; }
        detailsNode = next;
      }
      cursor = 0;
      return detailsNode.type(detailsNode.props);
    },
    restartEffects() {
      dispose();
      for (const effect of effects) effect.cleanup = effect.callback();
    },
    dispose,
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
const dialog = view => descendants(view).find(node => node.type === 'native-modal');

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

test('diagnostic context selects explicit bounded sanitized string fields without serializing extra data', () => {
  const report = diagnosticReport({
    code: 'PD-TEST', operation: 'test', message: 'Failed', observedAt: '2026-11-09T00:00:00Z',
    context: {
      stage: 'Loading\u0000 https://private.example/stage',
      check: 'Authorization: Bearer private-check',
      result: 'Failed at /Users/me/private/result.json',
      expected: '1', actual: '0',
      state: 'x'.repeat(10000),
      recovery: 'Retry\npassword=private-recovery',
      config: 'private-extra',
      toJSON() { throw new Error('Arbitrary context must not be serialized'); },
    },
  });
  assert.ok(report.includes('Stage: Loading [url]'));
  assert.ok(report.includes('Check: [redacted]'));
  assert.ok(report.includes('Result: Failed at [path]'));
  assert.ok(report.includes('Expected: 1\nActual: 0'));
  assert.ok(report.includes(`State: ${'x'.repeat(2048)}\nRecovery: Retry\n[redacted]`));
  for (const value of ['\u0000', 'private.example', 'private-check', '/Users/me', 'private-recovery', 'private-extra']) {
    assert.ok(!report.includes(value), value);
  }
  const invalid = diagnosticReport({ code: 'PD-TEST', operation: 'test', message: 'Failed', observedAt: 'now',
    context: { stage: { secret: 'not-a-string' }, check: '', config: 'not-selected' } });
  assert.ok(!invalid.includes('Stage:'));
  assert.ok(invalid.endsWith('Check: '));
  assert.ok(!invalid.includes('not-selected'));
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

test('modal placement groups the summary and recovery actions into one banner', () => {
  const app = fixture();
  let retries = 0;
  const view = app.feedback({ ...app.props, placement: 'modal', retry: () => { retries++; } });
  assert.equal(view.props.role, 'alert');
  assert.equal(view.props['data-placement'], 'modal');
  const actions = descendants(view).find(node => node.props.className === 'power-dsh-error-actions');
  assert.ok(actions, 'The modal banner must group the disclosure and retry actions.');
  assert.ok(descendants(actions).some(node => node.type === 'button'));
  assert.ok(app.outer.props.children.includes(app.props.message));
});

test('error information stays selectable and bilingual; copying writes only the displayed diagnostic', async t => {
  const copies = [];
  await withBrowser(t, { writeText: async text => { copies.push(text); } }, async () => {
    for (const language of ['en', 'zh']) {
      const app = fixture(language);
      let view = app.render();
      const toggle = disclosure(view);
      assert.ok(toggle.props.children.includes(locales[language].errorDetailsAction));
      assert.equal(toggle.props['aria-expanded'], false);
      assert.equal(toggle.props['aria-haspopup'], 'dialog');
      assert.equal(dialog(view).props.open, false);
      toggle.props.onClick();
      view = app.render();
      assert.equal(disclosure(view).props['aria-expanded'], true);
      assert.equal(dialog(view).props.open, true);
      assert.equal(dialog(view).props.title, locales[language].errorDetails);
      assert.equal(disclosure(view).props.variant, 'ghost');
      assert.equal(disclosure(view).props.size, 'sm');
      assert.equal(copyButton(view).props.variant, 'outline');
      assert.equal(copyButton(view).props['data-modal-autofocus'], true);
      const report = descendants(view).find(node => node.type === 'pre');
      assert.equal(report.props.tabIndex, 0);
      await copyButton(view).props.onClick();
      assert.equal(copies.at(-1), report.props.children[0]);
      assert.ok(copies.at(-1).includes('DSH: 0.2.2-rc.1'));
      assert.ok(status(app.render()).props.children.includes(locales[language].errorInfoCopied));
      dialog(app.render()).props.onClose();
      view = app.render();
      assert.equal(disclosure(view).props['aria-expanded'], false);
      assert.equal(dialog(view).props.open, false);
      disclosure(view).props.onClick();
      assert.equal(descendants(app.render()).find(node => node.type === 'pre').props.children[0], report.props.children[0]);
      app.dispose();
    }
  });
});

test('copied reports include only a confirmed platform alongside machine-readable failure evidence', async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); });
  const copies = [];
  await withBrowser(t, { writeText: async text => copies.push(text) }, async () => {
    for (const platform of ['win32', 'darwin', 'linux', 'unknown']) {
      Object.defineProperty(globalThis, 'document', { configurable: true,
        value: { documentElement: { getAttribute: () => platform } } });
      const app = fixture();
      const view = app.render({ code: 'PD-BACKGROUND-LAYOUT', operation: 'flowing-background.attach',
        observedAt: '2026-11-09T11:45:02.966Z', context: { stage: 'styles (样式识别)',
          check: 'layout.frame', result: 'missing (未找到)', expected: '1', actual: '0', state: 'Saved setting unchanged' } });
      await copyButton(view).props.onClick();
      const report = copies.at(-1);
      assert.equal(report.includes('Platform:'), platform !== 'unknown');
      if (platform !== 'unknown') assert.ok(report.includes(`Platform: ${platform}`));
      assert.ok(report.includes('Operation: flowing-background.attach'));
      assert.ok(report.includes('Check: layout.frame\nResult: missing (未找到)\nExpected: 1\nActual: 0'));
      assert.equal(report, descendants(view).find(node => node.type === 'pre').props.children[0]);
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

test('a changed diagnostic resets disclosure and copy state while retaining the supplied observation time', async t => {
  const oldCopy = Promise.withResolvers();
  const writes = [];
  await withBrowser(t, { writeText(text) { writes.push(text); return writes.length === 1 ? oldCopy.promise : Promise.resolve(); } }, async () => {
    const app = fixture();
    const observedAt = '2026-11-09T11:45:02.966Z';
    const first = { observedAt, context: { stage: 'Styles', check: 'layout.frame', result: 'Not found' } };
    let view = app.render(first);
    disclosure(view).props.onClick();
    view = app.render();
    assert.equal(disclosure(view).props['aria-expanded'], true);
    const pending = copyButton(view).props.onClick();
    assert.equal(copyButton(app.render()).props.disabled, true);
    const next = { observedAt, context: { stage: 'Frame', check: 'frame.display', result: 'Unsupported' } };
    view = app.render(next);
    assert.equal(disclosure(view).props['aria-expanded'], false);
    assert.equal(copyButton(view).props.disabled, false);
    oldCopy.resolve(); await pending;
    assert.equal(status(app.render()), undefined, 'The old copy must not mark the new diagnostic as copied.');
    await copyButton(app.render()).props.onClick();
    assert.ok(writes.at(-1).includes(`Observed: ${observedAt}`));
    assert.ok(writes.at(-1).includes('Check: frame.display'));
    assert.ok(!writes.at(-1).includes('Check: layout.frame'));
    disclosure(app.render()).props.onClick();
    const stable = descendants(app.render()).find(node => node.type === 'pre').props.children[0];
    assert.equal(descendants(app.render(next)).find(node => node.type === 'pre').props.children[0], stable);
    assert.equal(disclosure(app.render()).props['aria-expanded'], true);
    app.dispose();
  });
});

test('effect cleanup and restart reject late clipboard completion from the previous effect', async t => {
  const gate = Promise.withResolvers();
  await withBrowser(t, { writeText: () => gate.promise }, async () => {
    const app = fixture();
    const pending = copyButton(app.render()).props.onClick();
    app.restartEffects();
    gate.resolve(); await pending;
    assert.equal(status(app.render()), undefined);
    assert.equal(copyButton(app.render()).props.disabled, false);
    app.dispose();
  });
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
