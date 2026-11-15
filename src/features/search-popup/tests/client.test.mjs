import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mount, descendants } from '../../../../tests/helpers/client-fixture.mjs';

const node = (tagName, attributes = {}, extra = {}) => ({ tagName, getAttribute: name => attributes[name] ?? null, ...extra });
// The fixture resolves the workspace-locale binding to the raw key, so the
// emulated native search button carries that label.
const searchButton = () => node('BUTTON', { type: 'button', 'aria-label': 'search.sessions.aria' });
const flush = () => new Promise(resolve => setImmediate(resolve));
const monthDay = timestamp => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(timestamp);

function panelOf(view) {
  return descendants(view).find(item => item.props?.className === 'power-dsh-search-popup-panel');
}
function overlayOf(view) {
  return descendants(view).find(item => item.props?.className === 'power-dsh-search-popup-overlay');
}
function isOpen(view) {
  return panelOf(view) !== undefined;
}
function close(view) {
  const overlay = overlayOf(view);
  assert.ok(overlay, 'Expected the open panel to sit on a backdrop.');
  overlay.props.onClick({ target: overlay, currentTarget: overlay });
}
function textOf(node) {
  return [node?.props?.children].flat(Infinity).join('');
}
function popupInput(view) {
  return descendants(view).find(item => item.type === 'input' && item.props.type === 'text');
}
function popupRows(view) {
  return descendants(view).filter(item => item.props?.className === 'power-dsh-search-popup-row');
}
function popupRowWorkspace(row) {
  const chip = descendants(row).find(item => item.props.className === 'power-dsh-search-popup-row-workspace');
  if (chip === undefined) return undefined;
  const label = descendants(chip).find(item => item.type === 'span' && item !== chip && item.props.className === undefined);
  return label === undefined ? undefined : textOf(label);
}
function popupRowDate(row) {
  return textOf(descendants(row).find(item => item.props.className === 'power-dsh-search-popup-date'));
}
function popupRowSnippet(row) {
  const snippet = descendants(row).find(item => item.props.className === 'power-dsh-search-popup-snippet');
  return snippet === undefined ? undefined : deepText(snippet);
}
function popupRowHit(row) {
  return descendants(row).filter(item => item.props.className === 'power-dsh-search-popup-hit').map(textOf);
}
function popupStatus(view) {
  return descendants(view).find(item => item.props?.className === 'power-dsh-search-popup-status');
}
function popupHeadLabel(view) {
  return textOf(descendants(view).find(item => item.props?.className === 'power-dsh-search-popup-head-label'));
}
function popupCount(view) {
  return textOf(descendants(view).find(item => item.props?.className === 'power-dsh-search-popup-count'));
}
function popupWorkspaceButton(view) {
  return descendants(view).find(item => item.props?.className === 'power-dsh-search-popup-workspace');
}
function popupMenu(view) {
  return descendants(view).find(item => item.type === 'native-menu-fixture');
}
function panelIsOpen(view) {
  return isOpen(view);
}
// Highlighted titles nest mark elements; flatten them back to plain text.
function deepText(node) {
  return [node?.props?.children].flat(Infinity)
    .map(child => typeof child === 'string' ? child : deepText(child)).join('');
}
function rowTitle(row) {
  return deepText(descendants(row).find(item => item.props.className === 'power-dsh-search-popup-title'));
}
async function arm(app) {
  const control = () => descendants(app.selectSettingsTab('interface'))
    .find(item => item.props.id === 'settings-test-searchPopupEnabled');
  await control().props.onClick();
  app.set({ searchPopupEnabled: true });
  return control;
}

test('the popup only intercepts the native search gestures while the switch is on', async () => {
  const app = await mount({ featureIds: ['search-popup'] });
  assert.equal(app.clickListeners.size, 0);
  assert.equal(app.keyDownListeners.size, 0);
  assert.equal(app.click([searchButton()]), false);
  const control = await arm(app);
  assert.equal(app.clickListeners.size, 1);
  assert.equal(app.keyDownListeners.size, 1);
  app.set({ searchPopupEnabled: true });
  assert.equal(app.clickListeners.size, 1, 'Repeated config notifications must not duplicate the capture listeners.');
  assert.equal(app.click([node('DIV'), searchButton()]), true, 'The native search click must not reach React.');
  assert.equal(isOpen(app.renderSearchPopup()), true);
  close(app.renderSearchPopup());
  assert.equal(isOpen(app.renderSearchPopup()), false);
  for (const path of [[node('BUTTON', { type: 'button', 'aria-label': 'search.clear' })],
    [node('BUTTON', { type: 'button' })], [node('DIV')], []]) {
    assert.equal(app.click(path), false, 'Unmatched gestures must keep their native behavior.');
  }
  assert.equal(app.click([searchButton()], 2), false, 'A non-primary click must not trigger the popup.');
  await control().props.onClick();
  assert.equal(app.clickListeners.size, 0, 'Turning the switch off must release the listeners.');
  assert.equal(app.keyDownListeners.size, 0);
  assert.equal(isOpen(app.renderSearchPopup()), false, 'Turning the switch off must close the popup.');
  assert.equal(app.click([searchButton()]), false);
  app.set({ searchPopupEnabled: true });
  app.unmount();
  assert.equal(app.clickListeners.size, 0);
  assert.equal(app.keyDownListeners.size, 0);
  assert.equal(app.subscriptions(), 0);
});

test('the popup takes over the platform search shortcut exactly', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  const desktop = app.keyDown({ code: 'KeyK', metaKey: true });
  assert.equal(desktop.stopped, true, 'macOS desktop Cmd+K must not reach the shortcuts service.');
  assert.equal(desktop.prevented, true);
  assert.equal(isOpen(app.renderSearchPopup()), true);
  assert.equal(app.keyDown({ code: 'KeyK', metaKey: true }).stopped, true, 'Repeating the gesture must not close or stack the popup.');
  assert.equal(isOpen(app.renderSearchPopup()), true);
  assert.equal(app.focusedElementId(), 'fixture-object-ref', 'Repeating the gesture returns focus to the input without reopening.');
  assert.equal(app.sessionSearches.length, 0, 'Re-focusing an open panel must not repeat a search request.');
  close(app.renderSearchPopup());
  for (const gesture of [{ code: 'KeyK', ctrlKey: true }, { code: 'KeyK', metaKey: true, altKey: true },
    { code: 'KeyK', metaKey: true, shiftKey: true }, { code: 'KeyN', metaKey: true }, { code: 'KeyK' }]) {
    assert.equal(app.keyDown(gesture).stopped, false, 'Desktop gestures outside the native binding must pass through.');
  }
  const windows = await mount({ featureIds: ['search-popup'], platformMarker: true, windows: true });
  await arm(windows);
  assert.equal(windows.keyDown({ code: 'KeyK', ctrlKey: true }).stopped, true, 'Windows desktop Ctrl+K must be taken over.');
  assert.equal(windows.keyDown({ code: 'KeyK', metaKey: true }).stopped, false);
  const web = await mount({ featureIds: ['search-popup'] });
  await arm(web);
  assert.equal(web.keyDown({ code: 'KeyK', ctrlKey: true, altKey: true }).stopped, true, 'Web Ctrl+Alt+K must be taken over.');
  assert.equal(web.keyDown({ code: 'KeyK', metaKey: true, altKey: true }).stopped, true, 'Web Cmd+Alt+K must be taken over.');
  assert.equal(web.keyDown({ code: 'KeyK', ctrlKey: true }).stopped, false, 'Web plain Ctrl+K is not a native binding.');
  assert.equal(web.keyDown({ code: 'KeyK', ctrlKey: true, altKey: true, shiftKey: true }).stopped, false);
});

test('a missing search service shows the unavailable status instead of results', async () => {
  const app = await mount({ featureIds: ['search-popup'], notificationServices: false });
  await arm(app);
  app.keyDown({ code: 'KeyK', ctrlKey: true, altKey: true });
  const view = app.renderSearchPopup();
  assert.equal(isOpen(view), true);
  assert.equal(textOf(popupStatus(view)), 'searchPopupNoAccess');
  assert.equal(popupRows(view).length, 0);
});

test('the panel mirrors the official layout chrome', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.setSessions([{ id: 's1', displayTitle: '项目审查', cwd: '/work/alpha', updatedAt: Date.parse('2026-11-09T12:00:00Z') }]);
  app.setWorkspaces([{ workspaceId: 'w1', title: 'Project Alpha', path: '/work/alpha', sessionIds: ['s1'] }]);
  app.keyDown({ code: 'KeyK', metaKey: true });
  const view = app.renderSearchPopup();
  assert.equal(descendants(view).find(item => item.type === 'native-modal-fixture'), undefined,
    'The panel is a self-drawn surface, not the native modal chrome.');
  assert.equal(popupHeadLabel(view), 'searchPopupRecent', 'The empty popup labels itself as the recent list.');
  assert.equal(popupCount(view), 'searchPopupCount', 'The fixture renders the raw count key; real locales interpolate {n}.');
  assert.equal(descendants(view).some(item => item.props?.className === 'power-dsh-search-popup-kbd'
    || item.props?.className === 'power-dsh-search-popup-hint'), false, 'No keyboard hints render in the head row.');
  const row = popupRows(view)[0];
  assert.equal(rowTitle(row), '项目审查');
  assert.equal(popupRowWorkspace(row), 'Project Alpha',
    'Line one ends with the session workspace at the right.');
  assert.equal(popupRowDate(row), monthDay(Date.parse('2026-11-09T12:00:00Z')),
    'Line two ends with the localized last-activity date.');
  assert.equal(popupRowSnippet(row), undefined, 'The default view has no snippet line.');
  assert.equal(descendants(view).some(item => item.props?.className === 'power-dsh-search-popup-scope'), false,
    'The foot carries only the count.');
  assert.equal(popupInput(view).props.placeholder, 'searchPopupPlaceholder',
    'The single popup switch includes content matching.');
  popupInput(view).props.onChange({ target: { value: '审查' } });
  const updated = app.renderSearchPopup();
  assert.equal(popupHeadLabel(updated), 'searchPopupResults', 'A query relabels the head row to search results.');
});

test('the workspace filter narrows both default and search rows', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.setSessions([
    { id: 's1', displayTitle: 'Alpha 任务', cwd: '/work/alpha', updatedAt: 30 },
    { id: 's2', displayTitle: 'Beta 任务', cwd: '/work/beta', updatedAt: 20 },
  ]);
  app.setWorkspaces([
    { workspaceId: 'w1', title: 'Project Alpha', path: '/work/alpha', sessionIds: ['s1'] },
    { workspaceId: 'w2', title: 'Project Beta', path: '/work/beta', sessionIds: ['s2'] },
  ]);
  app.keyDown({ code: 'KeyK', metaKey: true });
  let view = app.renderSearchPopup();
  assert.deepEqual(popupRows(view).map(rowTitle), ['Alpha 任务', 'Beta 任务']);
  popupWorkspaceButton(view).props.onClick();
  view = app.renderSearchPopup();
  const menu = popupMenu(view);
  assert.ok(menu, 'The workspace dropdown opens a native menu.');
  const item = descendants(menu).find(entry => entry.props?.role === 'menuitem' && entry.props['data-id'] === 'w1');
  item.props.onClick();
  view = app.renderSearchPopup();
  assert.deepEqual(popupRows(view).map(rowTitle), ['Alpha 任务'], 'A selected workspace narrows the default rows.');
  assert.equal(textOf(descendants(popupWorkspaceButton(view)).find(item => item.props?.className === 'power-dsh-search-popup-workspace-label')),
    'Project Alpha');
  popupInput(view).props.onChange({ target: { value: '任务' } });
  view = app.renderSearchPopup();
  const timer = [...app.timers.values()].at(-1);
  timer.fn();
  await flush();
  await flush();
  view = app.renderSearchPopup();
  assert.deepEqual(popupRows(view).map(rowTitle), ['Alpha 任务'], 'The filter also applies to search rows.');
  popupWorkspaceButton(view).props.onClick();
  view = app.renderSearchPopup();
  const allItem = descendants(popupMenu(view)).find(entry => entry.props?.role === 'menuitem' && entry.props['data-id'] === 'all');
  allItem.props.onClick();
  view = app.renderSearchPopup();
  assert.equal(popupRows(view).length, 0, 'Changing scope waits for its complete result page.');
  [...app.timers.values()].at(-1).fn();
  await flush();
  view = app.renderSearchPopup();
  assert.deepEqual(popupRows(view).map(rowTitle), ['Alpha 任务', 'Beta 任务'], 'Switching back to all workspaces restores every row.');
  popupWorkspaceButton(view).props.onClick();
  view = app.renderSearchPopup();
  close(view);
});

test('the popup asks the Host index after input settles and opens the chosen session', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.keyDown({ code: 'KeyK', metaKey: true });
  let view = app.renderSearchPopup();
  assert.equal(popupRows(view).length, 0);
  app.setSessions([
    { id: 's1', displayTitle: '构建插件' },
    { id: 's2', title: 'review notes' },
    { id: 's3', displayTitle: '另一个会话' },
  ]);
  app.setContentSearch(query => query === '插件'
    ? [{ sessionId: 's3', snippet: '命中 插件 的正文' }] : []);
  let input = popupInput(app.renderSearchPopup());
  input.props.onChange({ target: { value: '插件' } });
  view = app.renderSearchPopup();
  assert.equal(popupStatus(view), undefined, 'The pre-request state shows no status line while loading.');
  assert.deepEqual(popupRows(view), [], 'Title-only matches wait for the content request.');
  const timer = [...app.timers.values()].at(-1);
  assert.equal(timer.ms, 100, 'The incremental cache uses a short input pause.');
  timer.fn();
  await flush();
  await flush();
  view = app.renderSearchPopup();
  assert.deepEqual(app.contentSearches.map(row => row.query), ['插件'],
    'Content search goes to the Host index, not the slow native service.');
  assert.equal(app.sessionSearches.length, 0, 'The native service is not asked while the Host index answers.');
  const rows = popupRows(view);
  assert.deepEqual(rows.map(rowTitle), ['另一个会话', '构建插件'],
    'The content hit leads and the title-only match follows.');
  assert.equal(rows[0].props['data-active'], true, 'The first row is selected by default.');
  assert.equal(popupRowSnippet(rows[0]), '命中 插件 的正文');
  assert.deepEqual(popupRowHit(rows[0]), ['插件'], 'The query highlights inside the snippet.');
  assert.deepEqual(popupRowHit(rows[1]), ['插件'], 'The query highlights inside the matched title.');
  assert.equal(popupRowSnippet(rows[1]), undefined, 'Title-only matches keep the two-line rhythm without a snippet.');
  rows[0].props.onClick();
  assert.deepEqual(app.uiWorkspaceOpens, ['s3'], 'Choosing a result opens the session through the native service.');
  assert.equal(isOpen(app.renderSearchPopup()), false);
  app.keyDown({ code: 'KeyK', metaKey: true });
  input = popupInput(app.renderSearchPopup());
  input.props.onChange({ target: { value: '没有这样的会话' } });
  app.renderSearchPopup();
  const nextTimer = [...app.timers.values()].at(-1);
  nextTimer.fn();
  await flush();
  await flush();
  view = app.renderSearchPopup();
  const empty = descendants(view).find(item => item.props?.className === 'power-dsh-search-popup-empty-title');
  assert.equal(textOf(empty), 'searchPopupNoMatches', 'A settled query without matches shows the empty-state message.');
  assert.equal(textOf(descendants(view).find(item => item.props?.className === 'power-dsh-search-popup-empty-hint')),
    'searchPopupNoMatchesHint');
  assert.equal(popupRows(view).length, 0);
});

test('enhanced search publishes titles, body hits and previews together after loading', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.setSessions([{ id: 's1', displayTitle: '构建插件' }, { id: 's2', displayTitle: '插件工记录' }]);
  let release;
  app.setContentSearch(() => new Promise(resolve => { release = resolve; }),
    { preview: () => [{ sessionId: 's1', snippet: '最新消息预览' }] });
  app.keyDown({ code: 'KeyK', metaKey: true });
  popupInput(app.renderSearchPopup()).props.onChange({ target: { value: '构建' } });
  let view = app.renderSearchPopup();
  assert.deepEqual(popupRows(view), [], 'The first render after input hides title-only matches.');
  const firstPending = descendants(view).find(item => item.props?.className === 'power-dsh-search-popup-skeleton');
  assert.ok(firstPending, 'The debounce window already shows loading.');
  assert.equal(descendants(firstPending).filter(item => item.props?.className === 'power-dsh-search-popup-skeleton-row').length, 2);
  assert.equal(firstPending.props.role, 'status');
  assert.equal(firstPending.props['aria-label'], 'searchPopupSearching');
  [...app.timers.values()].at(-1).fn();
  await flush();
  assert.equal(popupRows(app.renderSearchPopup()).length, 0, 'An unresolved request cannot expose local titles.');
  popupInput(app.renderSearchPopup()).props.onKeyDown({ key: 'Enter', preventDefault() {} });
  assert.deepEqual(app.uiWorkspaceOpens, [], 'Loading does not allow opening an intermediate row.');
  release([{ sessionId: 's2', snippet: '构建正文命中' }]);
  await flush();
  view = app.renderSearchPopup();
  assert.deepEqual(popupRows(view).map(rowTitle), ['插件工记录', '构建插件']);
  assert.deepEqual(popupRows(view).map(popupRowSnippet), ['构建正文命中', '最新消息预览']);
  popupInput(view).props.onChange({ target: { value: '插件工' } });
  view = app.renderSearchPopup();
  assert.deepEqual(popupRows(view), [], 'A new query immediately hides both old results and new local titles.');
  [...app.timers.values()].at(-1).fn();
  await flush();
  release([{ sessionId: 's2', snippet: '第二轮内容命中' }]);
  await flush();
  view = app.renderSearchPopup();
  assert.equal(popupRowSnippet(popupRows(view)[0]), '第二轮内容命中', 'The fresh page replaces the loading state whole.');
  assert.equal(descendants(view).some(item => item.props?.className === 'power-dsh-search-popup-skeleton'), false);
  app.unmount();
});

test('late query responses cannot publish an intermediate title page', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.setSessions([{ id: 's1', displayTitle: 'dsh' }, { id: 's2', displayTitle: 'dsh search' }]);
  const releases = new Map();
  app.setContentSearch(query => new Promise(resolve => releases.set(query, resolve)));
  app.keyDown({ code: 'KeyK', metaKey: true });
  for (const query of ['dsh', 'dsh search']) {
    popupInput(app.renderSearchPopup()).props.onChange({ target: { value: query } });
    assert.deepEqual(popupRows(app.renderSearchPopup()), []);
    [...app.timers.values()].at(-1).fn();
    await flush();
  }
  releases.get('dsh')([{ sessionId: 's1', snippet: 'stale' }]);
  await flush();
  assert.deepEqual(popupRows(app.renderSearchPopup()), [], 'The superseded response leaves the current page loading.');
  releases.get('dsh search')([{ sessionId: 's2', snippet: 'current' }]);
  await flush();
  assert.deepEqual(popupRows(app.renderSearchPopup()).map(popupRowSnippet), ['current']);
  app.unmount();
});

test('a workspace change hides even overlapping ready rows until the new page finishes', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.setSessions([{ id: 's1', displayTitle: 'dsh' }]);
  app.setWorkspaces([{ workspaceId: 'w1', title: 'Alpha', path: '/alpha', sessionIds: ['s1'] }]);
  let release;
  app.setContentSearch(() => new Promise(resolve => { release = resolve; }));
  app.keyDown({ code: 'KeyK', metaKey: true });
  popupInput(app.renderSearchPopup()).props.onChange({ target: { value: 'dsh' } });
  app.renderSearchPopup();
  [...app.timers.values()].at(-1).fn();
  await flush();
  release([{ sessionId: 's1', snippet: 'old scope' }]);
  await flush();
  assert.equal(popupRows(app.renderSearchPopup()).length, 1);
  popupWorkspaceButton(app.renderSearchPopup()).props.onClick();
  popupMenu(app.renderSearchPopup()).props.onSelect('w1');
  assert.deepEqual(popupRows(app.renderSearchPopup()), [], 'Scope identity is checked before the loading effect runs.');
  [...app.timers.values()].at(-1).fn();
  await flush();
  release([{ sessionId: 's1', snippet: 'new scope' }]);
  await flush();
  assert.deepEqual(popupRows(app.renderSearchPopup()).map(popupRowSnippet), ['new scope']);
  app.unmount();
});

test('an empty first page shows skeleton rows instead of a blank panel', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.setSessions([{ id: 's1', displayTitle: 'unrelated' }]);
  app.keyDown({ code: 'KeyK', metaKey: true });
  popupInput(app.renderSearchPopup()).props.onChange({ target: { value: '插件' } });
  app.renderSearchPopup();
  const view = app.renderSearchPopup();
  assert.equal(popupRows(view).length, 0);
  assert.equal(descendants(view).filter(item => item.props?.className === 'power-dsh-search-popup-skeleton-row').length, 2,
    'An enhanced query shows two skeleton rows while the request runs.');
});

test('a long snippet re-windows around the match so the highlight stays visible', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.setSessions([{ id: 's1', displayTitle: '发布记录' }]);
  const prefix = 'Record each externally perceptible breaking change immediately in an [upgrade guide](.agents/skills/';
  app.setContentSearch(() => [{ sessionId: 's1',
    snippet: `…${prefix}dsh-create-upgrade-guide/SKILL.md). Then continue with the rest of an intentionally very long snippet.` }]);
  app.keyDown({ code: 'KeyK', metaKey: true });
  popupInput(app.renderSearchPopup()).props.onChange({ target: { value: 'dsh' } });
  app.renderSearchPopup();
  [...app.timers.values()].at(-1).fn();
  await flush();
  await flush();
  const row = popupRows(app.renderSearchPopup())[0];
  const snippet = popupRowSnippet(row);
  assert.ok(snippet, 'The content hit keeps its snippet.');
  assert.deepEqual(popupRowHit(row), ['dsh'],
    'The highlighted term is part of the visible snippet window, not past the ellipsis.');
  assert.ok(snippet.startsWith('…') && snippet.endsWith('…'), 'The window advertises the trimmed edges.');
});

test('the popup moves the selection, deduplicates and bounds the merged rows', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.setSessions([{ id: 's1', displayTitle: '搜索弹窗记录' }, { id: 's2', displayTitle: '搜索弹窗补充' }, { id: 's3', title: 'unrelated' }]);
  app.setContentSearch(() => [{ sessionId: 's1', snippet: 'a' }, { sessionId: 's1', snippet: 'b' },
    { sessionId: 's2', snippet: 'content hit' }]);
  app.keyDown({ code: 'KeyK', metaKey: true });
  let view = app.renderSearchPopup();
  popupInput(view).props.onChange({ target: { value: '搜索弹窗' } });
  view = app.renderSearchPopup();
  const timer = [...app.timers.values()].at(-1);
  timer.fn();
  await flush();
  await flush();
  view = app.renderSearchPopup();
  const rows = popupRows(view);
  assert.deepEqual(rows.map(rowTitle), ['搜索弹窗记录', '搜索弹窗补充'],
    'Content hits lead, duplicate ids collapse, title matches follow.');
  assert.equal(popupRowSnippet(rows[0]), 'a');
  assert.equal(popupRowSnippet(rows[1]), 'content hit');

  let input = popupInput(view);
  input.props.onKeyDown({ key: 'ArrowDown', preventDefault() {} });
  view = app.renderSearchPopup();
  assert.equal(popupRows(view)[1].props['data-active'], true);
  input = popupInput(view);
  input.props.onKeyDown({ key: 'ArrowUp', preventDefault() {} });
  input.props.onKeyDown({ key: 'ArrowUp', preventDefault() {} });
  view = app.renderSearchPopup();
  assert.equal(popupRows(view)[1].props['data-active'], true, 'The selection wraps around.');
  popupInput(app.renderSearchPopup()).props.onKeyDown({ key: 'Enter', preventDefault() {} });
  assert.deepEqual(app.uiWorkspaceOpens, ['s2']);
  assert.equal(isOpen(app.renderSearchPopup()), false, 'Enter opens the selected session and closes the popup.');
});

test('the result-limit notice appears only for a settled full search page', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  const notice = view => descendants(view).find(item => item.props?.className === 'power-dsh-search-popup-limit');
  app.setSessions(Array.from({ length: 45 }, (_, index) => ({ id: `s${index}`, displayTitle: `needle ${index}` })));
  app.setContentSearch(() => []);
  app.keyDown({ code: 'KeyK', metaKey: true });
  assert.equal(notice(app.renderSearchPopup()), undefined, 'Recent sessions do not show the search limit.');
  popupInput(app.renderSearchPopup()).props.onChange({ target: { value: 'needle' } });
  assert.equal(notice(app.renderSearchPopup()), undefined, 'Loading does not show a settled-page notice.');
  [...app.timers.values()].at(-1).fn();
  await flush();
  let view = app.renderSearchPopup();
  assert.equal(popupRows(view).length, 40);
  assert.equal(textOf(notice(view)), 'searchPopupLimited');
  assert.equal(notice(view).props.title, 'searchPopupLimited');
  popupInput(view).props.onChange({ target: { value: 'needle 44' } });
  assert.equal(notice(app.renderSearchPopup()), undefined);
  [...app.timers.values()].at(-1).fn();
  await flush();
  view = app.renderSearchPopup();
  assert.equal(popupRows(view).length, 1);
  assert.equal(notice(view), undefined);
  app.unmount();
});

test('a title-only match still fills its snippet line with a preview', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.setSessions([
    { id: 's1', displayTitle: '调研 dsh market 插件功能', updatedAt: 300 },
    { id: 's2', displayTitle: '记忆机制实现方案研究', updatedAt: 200 },
  ]);
  // Only s2 has a content hit; s1 matches by title alone and must not render blank.
  app.setContentSearch(() => [{ sessionId: 's2', snippet: '…四款第三方 DSH 记忆插件接线事实调研…' }], {
    preview: ids => ids.map(id => ({ sessionId: id, snippet: `…${id} 的最近消息预览…` })),
  });
  app.keyDown({ code: 'KeyK', metaKey: true });
  popupInput(app.renderSearchPopup()).props.onChange({ target: { value: 'dsh' } });
  app.renderSearchPopup();
  [...app.timers.values()].at(-1).fn();
  await flush();
  await flush();
  const view = app.renderSearchPopup();
  const rows = popupRows(view);
  assert.deepEqual(rows.map(rowTitle), ['调研 dsh market 插件功能', '记忆机制实现方案研究']);
  assert.equal(popupRowSnippet(rows[0]), '…s1 的最近消息预览…',
    'The title-only row shows its newest message instead of an empty line.');
  assert.equal(popupRowSnippet(rows[1]), '…四款第三方 DSH 记忆插件接线事实调研…',
    'A real content hit keeps its own snippet.');
  assert.deepEqual(app.contentSearches.at(-1).previewIds, ['s1'],
    'Only the title-only sessions are asked for a preview.');
});

test('the popup never draws rows the native sidebar hides', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.setSessions([
    { id: 's1', displayTitle: '可见会话', updatedAt: 40 },
    { id: 's2', displayTitle: '子代理会话', origin: 'subagent', updatedAt: 30 },
    { id: 's3', displayTitle: '空白会话', blank: true, updatedAt: 20 },
    { id: 's4', displayTitle: '已归档会话', updatedAt: 10 },
  ]);
  app.setWorkspaces([], ['s4']);
  app.setContentSearch(() => [
    { sessionId: 's2', snippet: 'subagent hit' },
    { sessionId: 's3', snippet: 'blank hit' },
    { sessionId: 's4', snippet: 'archived hit' },
    { sessionId: 's5', snippet: 'unknown hit' },
    { sessionId: 's1', snippet: 'visible hit' },
  ]);
  app.keyDown({ code: 'KeyK', metaKey: true });
  // The default view is the recency list, so hidden rows must be absent there too.
  assert.deepEqual(popupRows(app.renderSearchPopup()).map(rowTitle), ['可见会话']);
  popupInput(app.renderSearchPopup()).props.onChange({ target: { value: '会话' } });
  app.renderSearchPopup();
  [...app.timers.values()].at(-1).fn();
  await flush();
  await flush();
  const rows = popupRows(app.renderSearchPopup());
  assert.deepEqual(rows.map(rowTitle), ['可见会话'],
    'Subagent children, blank placeholders, archived rows and ids outside the list stay hidden like the native browser.');
  assert.equal(popupRowSnippet(rows[0]), 'visible hit', 'The surviving content hit keeps its snippet.');
});

test('a failed search shows the retry status and the next keystroke retries', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.setSessions([{ id: 's1', displayTitle: '插件记录' }]);
  app.setContentSearch(null, { error: 'session search failed' });
  app.keyDown({ code: 'KeyK', metaKey: true });
  popupInput(app.renderSearchPopup()).props.onChange({ target: { value: '插件' } });
  app.renderSearchPopup();
  const timer = [...app.timers.values()].at(-1);
  timer.fn();
  await flush();
  const view = app.renderSearchPopup();
  // The failure uses the shared feedback surface: product summary on screen, the
  // host message behind the details dialog, and a retry action of its own.
  const failed = descendants(view).find(item => item.props?.className?.includes('power-dsh-feedback'));
  assert.ok(failed, 'A failed search renders the shared error feedback.');
  assert.equal(failed.props['data-error-code'], 'PD-SEARCH-POPUP-QUERY');
  assert.equal([failed.props.children].flat(Infinity)[0], 'searchPopupFailed',
    'The panel shows the product summary, not the raw host message.');
  assert.equal(descendants(failed).some(item => item.props?.className === 'power-dsh-error-retry'), true,
    'The failure offers the shared retry action.');
  assert.equal(descendants(view).some(item => textOf(item) === 'session search failed'), false,
    'The raw host message never lands in the panel body.');
  app.setContentSearch(() => [{ sessionId: 's1', snippet: 'x' }]);
  popupInput(app.renderSearchPopup()).props.onChange({ target: { value: '插件工' } });
  app.renderSearchPopup();
  const nextTimer = [...app.timers.values()].at(-1);
  assert.notEqual(nextTimer, timer, 'A superseded query schedules a fresh request.');
  nextTimer.fn();
  await flush();
  await flush();
  const updated = app.renderSearchPopup();
  assert.deepEqual(app.contentSearches.map(row => row.query), ['插件', '插件工']);
  assert.equal(popupRows(updated).length, 1);
  assert.equal(popupStatus(updated), undefined);
  popupInput(app.renderSearchPopup()).props.onKeyDown({ key: 'Escape', preventDefault() {} });
  assert.equal(isOpen(app.renderSearchPopup()), false, 'Escape closes the popup.');
});

test('a disabled full-text index degrades to a quiet note instead of a failure', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.setSessions([{ id: 's1', displayTitle: '确定下一个开发功能' }]);
  app.setContentSearch(null, { unavailable: true });
  app.setSearch(null, 'session search failed: SessionQueryError: session search is disabled: this deployment configures the session-query index with openAt "never"');
  app.keyDown({ code: 'KeyK', metaKey: true });
  popupInput(app.renderSearchPopup()).props.onChange({ target: { value: '确定' } });
  app.renderSearchPopup();
  [...app.timers.values()].at(-1).fn();
  await flush();
  [...app.timers.values()].at(-1).fn();
  await flush();
  const view = app.renderSearchPopup();
  assert.equal(popupInput(view).props.placeholder, 'searchPopupPlaceholderPending',
    'An enabled enhancement with a disabled engine names the pending restart.');
  assert.deepEqual(popupRows(view).map(rowTitle), ['确定下一个开发功能'], 'Title matches still render.');
});

test('the middle state explains the pending restart instead of the off state', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.setSessions([{ id: 's1', displayTitle: '确定下一个开发功能' }]);
  app.setContentSearch(null, { unavailable: true });
  app.setSearch(null, 'session search failed: SessionQueryError: session search is disabled: this deployment configures the session-query index with openAt "never"');
  app.keyDown({ code: 'KeyK', metaKey: true });
  popupInput(app.renderSearchPopup()).props.onChange({ target: { value: '确定' } });
  app.renderSearchPopup();
  [...app.timers.values()].at(-1).fn();
  await flush();
  [...app.timers.values()].at(-1).fn();
  await flush();
  const view = app.renderSearchPopup();
  assert.equal(popupInput(view).props.placeholder, 'searchPopupPlaceholderPending',
    'The middle state names the restart it is waiting for.');
  assert.deepEqual(popupRows(view).map(rowTitle), ['确定下一个开发功能'], 'Title matches still render in the middle state.');
});

test('the empty popup defaults to the newest sessions with the same row interaction', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.setSessions([
    { id: 'a', displayTitle: '旧会话', updatedAt: 10 },
    { id: 'b', displayTitle: '新会话', updatedAt: 30 },
    { id: 'c', title: '中会话', updatedAt: 20 },
    { id: 'd', displayTitle: '空白会话', updatedAt: 40, blank: true },
  ]);
  app.keyDown({ code: 'KeyK', metaKey: true });
  let view = app.renderSearchPopup();
  let rows = popupRows(view);
  assert.deepEqual(rows.map(rowTitle), ['新会话', '中会话', '旧会话'],
    'Recent tasks sort by updatedAt and skip blank rows.');
  assert.equal(rows[0].props['data-active'], true, 'The newest task is selected by default.');
  rows[0].props.onClick();
  assert.deepEqual(app.uiWorkspaceOpens, ['b'], 'The default rows open sessions like search results.');
  assert.equal(isOpen(app.renderSearchPopup()), false);
  app.keyDown({ code: 'KeyK', metaKey: true });
  view = app.renderSearchPopup();
  popupInput(view).props.onKeyDown({ key: 'Enter', preventDefault() {} });
  assert.deepEqual(app.uiWorkspaceOpens, ['b', 'b'], 'Enter opens the selected default row.');
  assert.equal(isOpen(app.renderSearchPopup()), false);
  app.setSessions(Array.from({ length: 14 }, (_, i) => ({ id: `n${i}`, displayTitle: `会话 ${i}`, updatedAt: 100 - i })));
  app.keyDown({ code: 'KeyK', metaKey: true });
  view = app.renderSearchPopup();
  assert.equal(popupRows(view).length, 10, 'The default list is bounded.');
  popupInput(view).props.onChange({ target: { value: '会话 1' } });
  view = app.renderSearchPopup();
  assert.equal(descendants(view).find(item => item.props?.className === 'power-dsh-search-popup-empty-title'), undefined,
    'A matching query hides the empty state.');
});

test('recent sessions show bounded previews without enabling full-text search or changing row order', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.setSessions(Array.from({ length: 14 }, (_, index) => ({
    id: `s${index}`, displayTitle: `task ${index}`, updatedAt: 100 - index,
  })));
  app.setRecentPreviews(ids => ids.map(sessionId => ({ sessionId, snippet: `latest ${sessionId}` })));
  app.keyDown({ code: 'KeyK', metaKey: true });
  let view = app.renderSearchPopup();
  const titles = popupRows(view).map(rowTitle);
  popupInput(view).props.onKeyDown({ key: 'ArrowDown', preventDefault() {} });
  await flush();
  view = app.renderSearchPopup();
  assert.deepEqual(popupRows(view).map(rowTitle), titles);
  assert.equal(popupRows(view)[1].props['data-active'], true);
  assert.equal(popupRowSnippet(popupRows(view)[0]), 'latest s0');
  assert.equal(app.recentPreviewReads.length, 1);
  assert.deepEqual(app.recentPreviewReads[0].sessionIds, Array.from({ length: 10 }, (_, index) => `s${index}`));
  assert.deepEqual(app.recentPreviewReads[0].versions, Array.from({ length: 10 }, (_, index) => String(100 - index)));
  assert.equal(app.contentSearches.length, 0);
  assert.equal(app.sessionSearches.length, 0);
  assert.equal(app.timers.size, 0, 'Recent previews do not install polling or search timers.');
  app.unmount();
});

test('recent previews discard old workspace and query responses', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.setSessions([{ id: 's1', displayTitle: 'alpha' }, { id: 's2', displayTitle: 'beta' }]);
  app.setWorkspaces([{ workspaceId: 'w1', title: 'Alpha', path: '/alpha', sessionIds: ['s1'] }]);
  const releases = [];
  app.setRecentPreviews(() => new Promise(resolve => releases.push(resolve)));
  app.keyDown({ code: 'KeyK', metaKey: true });
  let view = app.renderSearchPopup();
  popupWorkspaceButton(view).props.onClick();
  popupMenu(app.renderSearchPopup()).props.onSelect('w1');
  view = app.renderSearchPopup();
  assert.deepEqual(popupRows(view).map(rowTitle), ['alpha']);
  releases[0]([{ sessionId: 's1', snippet: 'stale scope' }]);
  await flush();
  assert.equal(popupRowSnippet(popupRows(app.renderSearchPopup())[0]), undefined);
  popupInput(app.renderSearchPopup()).props.onChange({ target: { value: 'alpha' } });
  app.renderSearchPopup();
  releases[1]([{ sessionId: 's1', snippet: 'stale recent' }]);
  await flush();
  assert.deepEqual(popupRows(app.renderSearchPopup()), [], 'A recent-preview response cannot replace an enhanced query.');
  app.unmount();
});

test('a recent-preview failure preserves titles and provides retry', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.setSessions([{ id: 's1', displayTitle: 'alpha' }]);
  app.setRecentPreviews(() => [], 'cannot read session');
  app.keyDown({ code: 'KeyK', metaKey: true });
  app.renderSearchPopup();
  await flush();
  let view = app.renderSearchPopup();
  assert.deepEqual(popupRows(view).map(rowTitle), ['alpha']);
  const feedback = descendants(view).find(item => item.props?.['data-error-code'] === 'PD-SEARCH-POPUP-PREVIEW');
  assert.ok(feedback);
  app.setRecentPreviews(() => [{ sessionId: 's1', snippet: 'recovered' }]);
  descendants(feedback).find(item => item.props?.className === 'power-dsh-error-retry').props.onClick();
  app.renderSearchPopup();
  await flush();
  view = app.renderSearchPopup();
  assert.equal(popupRowSnippet(popupRows(view)[0]), 'recovered');
  assert.equal(descendants(view).some(item => item.props?.['data-error-code'] === 'PD-SEARCH-POPUP-PREVIEW'), false);
  app.unmount();
});

test('a failed preference save keeps the native search behavior', async () => {
  const app = await mount({ featureIds: ['search-popup'], rpcError: 'saveFailed' });
  const control = () => descendants(app.selectSettingsTab('interface'))
    .find(item => item.props.id === 'settings-test-searchPopupEnabled');
  await control().props.onClick();
  assert.equal(control().props['aria-checked'], false);
  assert.equal(app.clickListeners.size, 0);
  assert.equal(app.keyDownListeners.size, 0);
  assert.equal(app.click([searchButton()]), false);
  assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes('saveFailed')));
  app.unmount();
});

test('the query is sanitized like the native search wire contract', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.setSessions([{ id: 's1', displayTitle: 'ok 记录' }]);
  app.setContentSearch(null, { unavailable: true });
  app.setSearch(query => query === 'ok'.repeat(250)
    ? { ok: true, value: { items: [{ sessionId: 's1', snippet: '' }], hasMore: false } }
    : { ok: true, value: { items: [], hasMore: false } });
  app.keyDown({ code: 'KeyK', metaKey: true });
  let input = popupInput(app.renderSearchPopup());
  input.props.onChange({ target: { value: 'a\0b' } });
  let view = app.renderSearchPopup();
  assert.equal(popupInput(view).props.value, 'ab', 'NUL characters are stripped before the request.');
  input = popupInput(app.renderSearchPopup());
  input.props.onChange({ target: { value: 'ok'.repeat(300) } });
  app.renderSearchPopup();
  const timer = [...app.timers.values()].at(-1);
  timer.fn();
  await flush();
  [...app.timers.values()].at(-1).fn();
  await flush();
  view = app.renderSearchPopup();
  assert.deepEqual(app.sessionSearches.map(row => row.query), ['ok'.repeat(250)], 'Overlong queries are capped at the wire limit.');
  assert.equal(popupRows(view).length, 1);
});

test('the clear button resets the query without closing the panel', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.keyDown({ code: 'KeyK', metaKey: true });
  let view = app.renderSearchPopup();
  assert.equal(descendants(view).find(item => item.props?.className === 'power-dsh-search-popup-clear'), undefined,
    'The clear affordance only appears with a query.');
  popupInput(view).props.onChange({ target: { value: '插件' } });
  view = app.renderSearchPopup();
  const clearButton = descendants(view).find(item => item.props?.className === 'power-dsh-search-popup-clear');
  clearButton.props.onClick();
  view = app.renderSearchPopup();
  assert.equal(popupInput(view).props.value, '', 'The clear button empties the input.');
  assert.equal(isOpen(view), true, 'Clearing must not close the panel.');
});

test('disabling the popup cancels pending content and restores the native entry', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.setSessions([{ id: 'body', displayTitle: 'unrelated' }, { id: 'title', displayTitle: 'needle title' }]);
  let release;
  app.setContentSearch(() => new Promise(resolve => { release = resolve; }));
  app.keyDown({ code: 'KeyK', metaKey: true });
  popupInput(app.renderSearchPopup()).props.onChange({ target: { value: 'needle' } });
  app.renderSearchPopup();
  [...app.timers.values()].at(-1).fn();
  await flush();
  app.set({ searchPopupEnabled: false });
  app.renderSearchPopup();
  release([{ sessionId: 'body', snippet: 'needle body' }]);
  await flush();
  assert.equal(isOpen(app.renderSearchPopup()), false);
  assert.equal(app.click([searchButton()]), false);
  assert.equal(app.contentSearches.length, 1);
  assert.equal(app.sessionSearches.length, 0);
  app.unmount();
});

test('settings expose one popup switch and ignore the obsolete enhancement preference', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  const switches = descendants(app.selectSettingsTab('interface')).filter(item => item.props?.role === 'switch');
  assert.deepEqual(switches.map(item => item.props.id), ['settings-test-searchPopupEnabled']);
  await arm(app);
  app.set({ searchEnhanceEnabled: false });
  app.setSessions([{ id: 'body', displayTitle: 'unrelated' }]);
  app.setContentSearch(() => [{ sessionId: 'body', snippet: 'needle content' }]);
  app.keyDown({ code: 'KeyK', metaKey: true });
  popupInput(app.renderSearchPopup()).props.onChange({ target: { value: 'needle' } });
  app.renderSearchPopup();
  [...app.timers.values()].at(-1).fn();
  await flush();
  assert.deepEqual(popupRows(app.renderSearchPopup()).map(popupRowSnippet), ['needle content']);
  assert.deepEqual(app.rpcCalls[0], { method: 'setSearchPopupEnabled', blocked: true });
  app.unmount();
});

test('the native fallback is debounced and superseded input never issues a request', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.setContentSearch(null, { unavailable: true });
  app.keyDown({ code: 'KeyK', metaKey: true });
  const timers = [];
  for (const value of ['n', 'ne', 'needle']) {
    popupInput(app.renderSearchPopup()).props.onChange({ target: { value } });
    app.renderSearchPopup();
    timers.push([...app.timers.entries()].at(-1));
  }
  assert.equal(app.contentSearches.length, 0);
  assert.equal(app.sessionSearches.length, 0);
  assert.equal(app.timers.has(timers[0][0]), false);
  assert.equal(app.timers.has(timers[1][0]), false);
  assert.equal(timers[2][1].ms, 100);
  timers[2][1].fn();
  await flush();
  const fallback = [...app.timers.values()].at(-1);
  assert.ok(fallback.ms > 0 && fallback.ms <= 250);
  assert.equal(app.sessionSearches.length, 0);
  fallback.fn();
  await flush();
  assert.deepEqual(app.contentSearches.map(row => row.query), ['needle']);
  assert.deepEqual(app.sessionSearches.map(row => row.query), ['needle']);
  app.unmount();
});

test('the Host receives only visible workspace candidates in activity order', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  app.setSessions([
    { id: 'old', displayTitle: 'old', updatedAt: 10 },
    { id: 'recent', displayTitle: 'recent', updatedAt: 30 },
    { id: 'other', displayTitle: 'other', updatedAt: 40 },
    { id: 'child', displayTitle: 'child', origin: 'subagent', updatedAt: 50 },
    { id: 'archived', displayTitle: 'archived', updatedAt: 60 },
    { id: 'blank', displayTitle: 'blank', blank: true, updatedAt: 70 },
  ]);
  app.setWorkspaces([
    { workspaceId: 'alpha', title: 'Alpha', path: '/alpha', sessionIds: ['old', 'recent', 'child', 'archived', 'blank'] },
    { workspaceId: 'beta', title: 'Beta', path: '/beta', sessionIds: ['other'] },
  ], ['archived']);
  app.keyDown({ code: 'KeyK', metaKey: true });
  popupInput(app.renderSearchPopup()).props.onChange({ target: { value: 'needle' } });
  app.renderSearchPopup();
  [...app.timers.values()].at(-1).fn();
  await flush();
  await flush();
  assert.deepEqual(app.contentSearches.at(-1).sessionIds, ['other', 'recent', 'old']);
  popupWorkspaceButton(app.renderSearchPopup()).props.onClick();
  popupMenu(app.renderSearchPopup()).props.onSelect('alpha');
  app.renderSearchPopup();
  [...app.timers.values()].at(-1).fn();
  await flush();
  await flush();
  assert.deepEqual(app.contentSearches.at(-1).sessionIds, ['recent', 'old']);
  app.unmount();
});

test('workspace filtering precedes the recent-session limit', async () => {
  const app = await mount({ featureIds: ['search-popup'], desktop: true });
  await arm(app);
  const other = Array.from({ length: 12 }, (_, position) => ({ id: `other-${position}`, displayTitle: 'other', updatedAt: 100 + position }));
  app.setSessions([...other, { id: 'wanted', displayTitle: 'wanted', updatedAt: 1 }]);
  app.setWorkspaces([{ workspaceId: 'alpha', title: 'Alpha', path: '/alpha', sessionIds: ['wanted'] }]);
  app.keyDown({ code: 'KeyK', metaKey: true });
  popupWorkspaceButton(app.renderSearchPopup()).props.onClick();
  popupMenu(app.renderSearchPopup()).props.onSelect('alpha');
  assert.deepEqual(popupRows(app.renderSearchPopup()).map(rowTitle), ['wanted']);
  app.unmount();
});
