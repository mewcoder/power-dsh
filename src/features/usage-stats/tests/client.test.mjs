import assert from 'node:assert/strict';
import { test } from 'node:test';
import { descendants, mount as mountClient, usageSnapshotFixture } from '../../../../tests/helpers/client-fixture.mjs';
import { smoothPath } from '../client.ts';
import { styles } from '../styles.ts';

// Exercise the current source via the fixture's in-memory composition bundle.
const mount = options => mountClient({ featureIds: ['usage-stats'], ...options });

async function usagePage(app, language = 'en', fullHistory = true) {
  app.set({ usageStatsEnabled: true });
  app.renderUsage(language);
  await app.reloadUsage();
  const render = () => descendants(app.renderUsage(language));
  const tabs = () => render().filter(node => node.props.role === 'tab');
  const tab = label => tabs().find(node => [node.props.children].flat(Infinity).includes(label));
  // The legend reuses the cell class, so grid cells are the ones carrying an activity flag.
  const cells = () => render().filter(node => node.props.className === 'power-dsh-usage-heatmap-cell'
    && node.props['data-has-usage'] !== undefined);
  const tooltips = () => render().filter(node => node.type === 'native-tooltip-fixture'
    && node.props.label?.includes('tokens'));
  // Existing chart cases inspect the full history; the selector itself defaults to Today.
  if (fullHistory) render().find(node => node.props['data-period'] === 'all').props.onClick();
  return { render, tabs, tab, cells, tooltips };
}

test('the usage switch owns its own page and icon without extra subscriptions', async () => {
  const app = await mount();
  const section = 'settings.section:power-dsh-usage';
  const icon = 'settings.section.icon:power-dsh-usage';
  const baseline = app.entries.size;
  const subscriptions = app.subscriptions();
  for (let index = 0; index < 3; index++) {
    assert.ok(!app.entries.has(section));
    app.set({ usageStatsEnabled: true });
    const entry = app.entries.get(section);
    assert.equal(entry.options.label(), 'usageTab');
    assert.ok(app.entries.has(icon));
    app.set({ showVersion: true });
    assert.equal(app.entries.get(section), entry);
    assert.equal(app.entries.size, baseline + 2);
    app.set({ usageStatsEnabled: false });
    assert.ok(!app.entries.has(section));
    assert.ok(!app.entries.has(icon));
    assert.equal(app.entries.size, baseline);
    assert.equal(app.subscriptions(), subscriptions);
  }
  app.unmount();
  assert.equal(app.focusSubscriptions(), 0);
  assert.deepEqual(app.usageReads, []);
});

test('the page reads the browser zone once and renders the lifetime summary', async () => {
  const app = await mount();
  const page = await usagePage(app);
  assert.ok(app.usageReads.length >= 1);
  assert.ok(app.usageReads.every(read => read.timeZone === Intl.DateTimeFormat().resolvedOptions().timeZone));
  const values = page.render().filter(node => node.props.className === 'power-dsh-usage-metric-value').map(node => [node.props.children].flat(Infinity).join(''));
  assert.deepEqual(values, ['500', '40', '1']);
  const labels = page.render().filter(node => node.props.className === 'power-dsh-usage-metric-label').map(node => node.props.children);
  assert.deepEqual(labels.flat(Infinity), ['Total tokens', 'Cached tokens', 'Sessions']);
  const details = page.render().filter(node => node.props.className === 'power-dsh-usage-metric-detail')
    .map(node => descendants(node).filter(child => child.type === 'span').flatMap(child => child.props.children));
  assert.deepEqual(details, [['Input 420', 'Output 80'], ['Cache hit rate 9.5%'], ['Duration 1h 30m']]);
  assert.ok(!page.render().some(node => node.props.className === 'power-dsh-usage-composition'), 'There is no extra composition strip.');
  const hints = page.render().filter(node => node.type === 'native-tooltip-fixture' && node.props.label?.includes('Concurrent sessions'));
  assert.equal(hints.length, 1, 'Runtime explains idle time, waits and concurrent sessions.');
  app.unmount();
});

test('the activity heatmap keeps 53 weeks and grades each day on its own', async () => {
  const days = ['2026-01-05', '2026-01-06', '2026-01-19', '2026-02-02', '2026-02-03', '2026-02-04']
    .map((date, index) => ({ date, totalTokens: (index + 1) * 100, turnCount: 1, toolCallCount: 0 }));
  const app = await mount({ usageSnapshot: {
    ...usageSnapshotFixture({ days }), generatedAt: Date.parse('2026-02-04T12:00:00Z'),
  } });
  const page = await usagePage(app);
  const columns = new Set(page.cells().map(node => node.props.style.gridColumn));
  assert.equal(columns.size, 53, 'The activity grid always shows 53 natural weeks.');
  assert.equal(page.cells().length, 53 * 7);
  assert.equal(page.render().filter(node => node.props.className === 'power-dsh-usage-heatmap-legend').length, 0,
    'The card carries no legend.');
  assert.equal(page.render().filter(node => node.props.className === 'power-dsh-usage-card-note').length, 0,
    'The activity card carries no extra note.');
  const hasUsage = page.cells().filter(node => node.props['data-has-usage'] === true);
  assert.equal(hasUsage.length, 6);
  assert.equal(page.render().filter(node => node.props.role === 'tab' && node.props.className === 'power-dsh-usage-tab'
    && ['Weekly', 'Cumulative'].includes([node.props.children].flat(Infinity).join(''))).length, 0,
  'The heatmap has no weekly or cumulative mode.');
  const levels = page.cells().map(node => node.props['data-level']);
  assert.equal(levels.filter(level => level > 0).length, 6, 'Each day is graded against the busiest day.');
  assert.ok(page.tooltips().every(node => node.props.portal === true));
  assert.equal(page.render().filter(node => node.props.className === 'power-dsh-usage-heatmap-weekday').length, 0,
    'The grid carries no weekday column.');
  const months = page.render().filter(node => node.props.className === 'power-dsh-usage-heatmap-month');
  assert.ok(months.length >= 2, 'Each month gets one label anchored above its first week.');
  assert.ok(months.every(node => node.props.style.gridColumn.includes('span')),
    'A month label spans the weeks that belong to it.');
  const monthNames = months.map(node => [node.props.children].flat(Infinity).join(''));
  // The grid opens mid-month, so the first label names the next month that actually starts inside it.
  assert.equal(monthNames[0], 'Mar', 'The leading partial month began before the grid, so it is not named.');
  assert.equal(months[0].props.style.gridColumn, '4 / span 5', 'Its label starts at the week that owns the 1st.');
  assert.deepEqual(monthNames.slice(0, 3), ['Mar', 'Apr', 'May'], 'Every following month keeps its own label.');
  assert.ok(monthNames.every(name => name !== ''), 'Every labelled month keeps its text.');
  assert.ok(monthNames.every(name => !/\d{4}/.test(name)), 'Month labels carry no year.');
  assert.ok(page.tooltips().some(node => node.props.label === '2026-02-04: 600 tokens'),
    'The tooltip names the date and the token count only.');
  assert.equal(page.cells().filter(node => node.props.tabIndex === 0).length, 1, 'Only one cell is in the tab order.');
  app.unmount();
});

test('heatmap uses the report day and grades only usage visible through that day', async () => {
  const day = (date, totalTokens) => ({ date, totalTokens, turnCount: 1, toolCallCount: 0 });
  const outside = [day('2025-03-02', 900_000), day('2026-03-05', 800_000), day('2026-04-04', 700_000)];
  const app = await mount({ usageSnapshot: {
    ...usageSnapshotFixture({ days: [outside[0], day('2026-02-28', 20), ...outside.slice(1)] }),
    generatedAt: Date.parse('2026-03-02T17:00:00Z'), timeZone: 'Asia/Shanghai',
  } });
  const page = await usagePage(app);
  assert.equal(page.cells().length, 53 * 7);
  assert.equal(page.cells()[0].props['aria-label'], '2025-03-03: 0 tokens');
  assert.equal(page.cells().find(node => node.props.tabIndex === 0).props['aria-label'], '2026-03-03: 0 tokens');
  assert.equal(page.cells().find(node => node.props['data-today']).props.style.gridColumn, 53);
  assert.deepEqual(page.cells().filter(node => node.props['data-level'] > 0).map(node =>
    [node.props['aria-label'], node.props['data-level']]), [['2026-02-28: 20 tokens', 4]]);
  app.unmount();

  const empty = await mount({ usageSnapshot: usageSnapshotFixture({ days: outside }) });
  const emptyPage = await usagePage(empty);
  assert.equal(emptyPage.cells().length, 0, 'Usage outside the window does not trigger an empty grid.');
  empty.unmount();
});

test('every heatmap cell is filled, including days that have not happened yet', async () => {
  const days = ['2026-03-01', '2026-03-02', '2026-03-03'].map(date => ({ date, totalTokens: 100, turnCount: 1, toolCallCount: 0 }));
  const app = await mount({ usageSnapshot: usageSnapshotFixture({ days }) });
  const page = await usagePage(app);
  const future = page.cells().filter(node => node.props['data-future'] === true);
  assert.ok(future.length > 0, 'The fixture leaves part of the current week in the future.');
  assert.equal(page.cells().length, 53 * 7, 'The grid is a full rectangle.');
  // A future day keeps the empty-day level so the neutral fill shows through.
  assert.ok(future.every(node => node.props['data-level'] === 0), 'A future day carries no usage level.');
  assert.doesNotMatch(styles, /data-future\]\s*\{[^}]*background/, 'No rule blanks out future cells.');
  const empty = styles.match(/\.power-dsh-usage-heatmap-cell \{([^}]*)\}/)?.[1] ?? '';
  assert.match(empty, /background:color-mix\(in srgb,var\(--dsw-alias-label-tertiary\) 16%,transparent\)/,
    'Empty and future days share the same neutral fill.');
  app.unmount();
});

test('heatmap arrow keys walk one day and one week from a single tab stop', async () => {
  const days = ['2026-03-01', '2026-03-02', '2026-03-03'].map(date => ({ date, totalTokens: 100, turnCount: 1, toolCallCount: 0 }));
  const app = await mount({ usageSnapshot: usageSnapshotFixture({ days }) });
  const page = await usagePage(app);
  const focusable = () => page.cells().find(node => node.props.tabIndex === 0);
  const start = focusable();
  assert.equal(start.props['aria-label'].slice(0, 10), '2026-03-03');
  const press = (node, key) => {
    let prevented = false;
    node.props.onKeyDown({ key, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    return focusable();
  };
  assert.equal(press(start, 'ArrowLeft').props['aria-label'].slice(0, 10), '2026-03-02');
  assert.equal(press(focusable(), 'ArrowUp').props['aria-label'].slice(0, 10), '2026-02-23');
  assert.equal(page.cells().filter(node => node.props.tabIndex === 0).length, 1, 'Roving focus keeps one tab stop.');
  const future = page.cells().filter(node => node.props['data-future'] === true);
  assert.equal(future.length, 5, 'The rest of the current week is still in the future.');
  assert.ok(future.every(node => node.props.tabIndex === undefined && node.props['aria-hidden'] === true),
    'Future placeholders are hidden from assistive technology and cannot take focus.');
  assert.equal(press(focusable(), 'ArrowDown').props['aria-label'].slice(0, 10), '2026-03-02');
  assert.equal(press(focusable(), 'End').props['aria-label'].slice(0, 10), '2026-03-03');
  assert.equal(press(focusable(), 'ArrowRight').props['aria-label'].slice(0, 10), '2026-03-03');
  assert.equal(press(focusable(), 'ArrowDown').props['aria-label'].slice(0, 10), '2026-03-03');
  assert.equal(page.cells().filter(node => node.props.tabIndex === 0).length, 1);
  assert.equal(page.tooltips().filter(node => node.props.label?.startsWith('2026-03-0')).length, 3,
    'Days after today carry no tooltip.');
  app.unmount();
});

test('the trend keeps its own 7/30-day zoom regardless of the page period', async () => {
  const days = Array.from({ length: 40 }, (_, index) => ({
    date: new Date(Date.parse('2026-02-01T00:00:00.000Z') + index * 86_400_000).toISOString().slice(0, 10),
    totalTokens: index * 10, turnCount: 1, toolCallCount: 0,
    inputTokens: index * 8, outputTokens: index * 2, cacheReadTokens: 0, cacheWriteTokens: 0, requestCount: 1,
  }));
  const app = await mount({ usageSnapshot: usageSnapshotFixture({ days }) });
  const page = await selector(app);
  const points = () => (page.render().find(node => node.type === 'path' && node.props.d?.startsWith('M '))?.props.d ?? '')
    .match(/[MLC] /g)?.length ?? 0;
  const rangeTab = id => page.render().find(node => node.props['data-range'] === id);
  assert.deepEqual(page.render().filter(node => node.props['data-range']).map(node => node.props['data-range']),
    ['7d', '30d'], 'The trend offers its own 7 and 30 day zoom.');
  assert.equal(rangeTab('7d').props['aria-selected'], true);
  page.period('all').props.onClick();
  assert.equal(points(), 7, 'All keeps the 7-day trend zoom.');
  rangeTab('30d').props.onClick();
  assert.equal(points(), 30, 'Thirty days plots one point per day.');
  page.period('today').props.onClick();
  assert.equal(points(), 30, 'A one-day page period still leaves the trend a full axis.');
  assert.equal(page.render().filter(node => node.type === 'path' && node.props.d?.startsWith('M ')).length > 0, true,
    'The chart stays visible instead of collapsing to a single point.');
  app.unmount();
});

test('the page groups the filtered sections apart from the full-history ones', async () => {
  const app = await mount({ usageSnapshot: usageSnapshotFixture() });
  const page = await usagePage(app);
  const groups = page.render().filter(node => node.props.className === 'power-dsh-usage-group');
  assert.equal(groups.length, 2, 'The page separates range-bound sections from history-wide ones.');
  const contents = groups.map(group => {
    const nodes = descendants(group);
    return {
      title: [nodes.find(node => node.props.className === 'power-dsh-usage-group-title').props.children].flat(Infinity).join(''),
      cards: nodes.filter(node => node.props.className === 'power-dsh-usage-metric').length,
      models: nodes.some(node => node.props.className === 'power-dsh-usage-models'),
      heatmap: nodes.some(node => node.props.className === 'power-dsh-usage-heatmap'),
      chart: nodes.some(node => node.props.className === 'power-dsh-usage-chart-svg'),
    };
  });
  assert.deepEqual(contents, [
    { title: 'In the selected range', cards: 3, models: true, heatmap: false, chart: false },
    { title: 'Full history', cards: 0, models: false, heatmap: true, chart: true },
  ], 'Cards and the model list sit under the range; the heatmap and trend do not.');
  app.unmount();
});

test('the model list follows the page period while the trend keeps its own zoom', async () => {
  const app = await mount({ usageSnapshot: usageSnapshotFixture() });
  const page = await selector(app);
  const names = () => page.render().filter(node => node.props.className === 'power-dsh-usage-model')
    .map(node => [descendants(node).find(child => child.props.className === 'power-dsh-usage-model-name').props.children].flat(Infinity).join(''));
  assert.deepEqual(names(), ['group/flash', 'group/sol'], 'Today lists only the models used today.');
  page.period('today').props.onClick();
  assert.deepEqual(names().length, 2, 'A one-day period still lists every model used that day.');
  page.period('all').props.onClick();
  const all = page.render().filter(node => node.props.className === 'power-dsh-usage-model-value')
    .map(node => [node.props.children].flat(Infinity).join(''));
  assert.deepEqual(all, ['400', '100'], 'All sums the whole history, including the earlier day.');
  assert.equal(page.render().filter(node => node.props['data-range']).length, 2,
    'The trend keeps its own 7/30-day control.');
  app.unmount();
});

test('the trend chart draws at most six models and the model list ranks them by tokens', async () => {
  const models = Array.from({ length: 8 }, (_, index) => ({
    modelId: `model-${index}`, provider: 'magpie', totalTokens: 1000 - index * 100, requestCount: 1,
  }));
  const app = await mount({ usageSnapshot: usageSnapshotFixture({
    models,
    dailyModels: models.map(model => ({ date: '2026-03-03', modelId: model.modelId, provider: model.provider,
      totalTokens: model.totalTokens, requestCount: 2 })),
  }) });
  const page = await usagePage(app);
  const lines = page.render().filter(node => node.type === 'path' && node.props.d?.startsWith('M '));
  assert.equal(lines.length, 6, 'Only the six largest models are plotted.');
  const legend = page.render().filter(node => node.props.className === 'power-dsh-usage-legend-item');
  assert.deepEqual(legend.map(node => [node.props.children].flat(Infinity).at(-1)),
    models.slice(0, 6).map(model => model.modelId));
  const rows = page.render().filter(node => node.props.className === 'power-dsh-usage-model');
  assert.equal(rows.length, 8, 'Every model keeps a row in the usage list.');
  assert.deepEqual(rows.map(node => [descendants(node).find(child => child.props.className === 'power-dsh-usage-model-name').props.children].flat(Infinity).join('')),
    models.map(model => model.modelId), 'Each row shows its route model name.');
  assert.deepEqual(rows.map(node => [descendants(node).find(child => child.props.className === 'power-dsh-usage-model-share').props.children].flat(Infinity).join('')),
    ['19%', '17%', '15%', '13%', '12%', '10%', '8%', '6%'], 'Each row shows its share of the period total.');
  assert.ok(rows.every(node => node.props.title.includes('2 requests')),
    'The hover title carries the summed per-day request count.');
  assert.ok(rows.every(node => descendants(node).some(child => child.props.className === 'power-dsh-usage-model-bar')),
    'Each row draws its share as a bar under the name.');
  app.unmount();
});

test('a history without activity shows one empty notice instead of an empty grid', async () => {
  const app = await mount({ usageSnapshot: usageSnapshotFixture({ days: [], models: [], dailyModels: [] }) });
  const page = await usagePage(app);
  assert.equal(page.cells().length, 0, 'No grid is rendered without any recorded token.');
  assert.equal(page.render().filter(node => node.props.className === 'power-dsh-usage-heatmap-legend').length, 0);
  assert.ok(page.render().some(node => node.props.className === 'power-dsh-usage-empty'));
  app.unmount();
});

test('load failures stay recoverable and incomplete reads are labelled', async () => {
  const failing = await mount({ localeLanguage: 'en', usageReadError: 'usageUnavailable' });
  const page = await usagePage(failing);
  const failure = page.render().find(node => node.props.role === 'alert');
  assert.ok(failure, 'A failed read shows the shared error feedback.');
  assert.equal(failure.props['data-error-code'], 'PD-USAGE-LOAD');
  assert.ok([failure.props.children].flat(Infinity).includes('Usage statistics are unavailable in this Host.'),
    'The unavailable message is localized, not the raw Host error.');
  failing.unmount();

  const partial = await mount({ localeLanguage: 'en', usageSnapshot: usageSnapshotFixture({ complete: false }) });
  const partialPage = await usagePage(partial);
  assert.ok(partialPage.render().some(node => node.props.role === 'status'
    && [node.props.children].flat(Infinity).join('').startsWith('Some session logs could not be read')));
  partial.unmount();
});

async function selector(app, language = 'en') {
  const page = await usagePage(app, language, false);
  const period = id => page.render().find(node => node.props['data-period'] === id);
  const dialog = () => page.render().find(node => node.type === 'native-modal-fixture');
  const shortcut = id => page.render().find(node => node.props['data-period-shortcut'] === id);
  const apply = () => page.render().find(node => node.props['data-native-button'] && node.props.variant === 'primary');
  const range = () => ['data-calendar-start', 'data-calendar-end'].map(key => page.render().find(node => node.props[key]).props.children.join(''));
  const day = date => page.render().find(node => node.props['data-calendar-day'] === date);
  const navigate = direction => page.render().find(node => node.props['data-calendar-month'] === direction).props.onClick();
  return { ...page, period, dialog, shortcut, apply, range, day, navigate };
}

test('the time selector has five calendar choices with local midnight bounds', async () => {
  const value = { ...usageSnapshotFixture(), generatedAt: Date.parse('2026-03-03T20:00:00Z'), timeZone: 'Asia/Shanghai' };
  const app = await mount({ usageSnapshot: value });
  const page = await selector(app);
  assert.deepEqual(page.render().filter(node => node.props['data-period']).map(node => node.props['data-period']),
    ['today', 'week', 'month', 'all', 'custom']);
  assert.equal(page.period('today').props['aria-pressed'], true);
  const reads = app.usageReads.length;
  for (const [id, bounds] of [
    ['today', ['2026-03-04', '2026-03-04']],
    ['week', ['2026-03-02', '2026-03-04']],
    ['month', ['2026-03-01', '2026-03-04']],
    ['all', ['2026-03-01', '2026-03-04']],
  ]) {
    page.period(id).props.onClick();
    page.period('custom').props.onClick();
    assert.deepEqual(page.range(), bounds, id);
    assert.equal(page.period(id).props['aria-pressed'], true);
    page.dialog().props.onClose();
  }
  assert.equal(app.usageReads.length, reads);
  app.unmount();
});

test('calendar shortcuts fill a draft and cancel preserves the current selection', async () => {
  const app = await mount();
  const page = await selector(app);
  const cells = page.cells().length;
  page.period('custom').props.onClick();
  for (const [id, bounds] of [
    ['d7', ['2026-02-25', '2026-03-03']],
    ['d30', ['2026-02-02', '2026-03-03']],
  ]) {
    page.shortcut(id).props.onClick();
    assert.deepEqual(page.range(), bounds);
    assert.equal(page.period('today').props['aria-pressed'], true);
  }
  page.dialog().props.onClose();
  page.period('custom').props.onClick();
  assert.deepEqual(page.range(), ['2026-03-03', '2026-03-03']);
  page.shortcut('d7').props.onClick();
  page.apply().props.onClick();
  assert.equal(page.dialog(), undefined);
  assert.equal(page.period('custom').props['aria-pressed'], true);
  assert.equal(page.cells().length, cells);
  page.period('custom').props.onClick();
  assert.deepEqual(page.range(), ['2026-02-25', '2026-03-03']);
  app.unmount();
});

test('the range calendar previews, reverses and completes date selections without native date inputs', async () => {
  const app = await mount();
  const page = await selector(app);
  page.period('custom').props.onClick();
  assert.equal(descendants(page.dialog()).filter(node => node.type === 'input').length, 0);
  page.day('2026-03-05').props.onClick();
  assert.equal(page.apply().props.disabled, true, 'The first click requires an end date.');
  page.day('2026-03-10').props.onMouseEnter();
  const selected = () => descendants(page.dialog()).filter(node => node.props.role === 'gridcell' && node.props['aria-selected']);
  assert.equal(selected().length, 6, 'Hover previews every date between both endpoints.');
  page.day('2026-03-01').props.onClick();
  assert.deepEqual(page.range(), ['2026-03-01', '2026-03-05'], 'Reverse clicks are sorted.');
  assert.equal(page.apply().props.disabled, false);
  page.day('2026-03-03').props.onClick();
  page.day('2026-03-03').props.onClick();
  assert.deepEqual(page.range(), ['2026-03-03', '2026-03-03'], 'A one-day interval is valid.');
  page.apply().props.onClick();
  assert.equal(page.period('custom').props['aria-pressed'], true);
  app.unmount();
});

test('the range calendar selects across months and supports keyboard navigation with one tab stop', async () => {
  const app = await mount();
  const page = await selector(app);
  page.period('custom').props.onClick();
  const key = (date, key) => {
    let prevented = false;
    page.day(date).props.onKeyDown({ key, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    return page.render().find(node => node.props['data-calendar-day'] && node.props.tabIndex === 0);
  };
  assert.equal(key('2026-03-01', 'ArrowLeft').props['data-calendar-day'], '2026-02-28');
  assert.equal(key('2026-02-28', 'PageDown').props['data-calendar-day'], '2026-03-28');
  assert.equal(page.render().filter(node => node.props['data-calendar-day'] && node.props.tabIndex === 0).length, 1);
  page.navigate(-1);
  page.day('2026-02-24').props.onClick();
  page.navigate(1);
  page.day('2026-03-03').props.onClick();
  assert.deepEqual(page.range(), ['2026-02-24', '2026-03-03']);
  assert.equal(page.apply().props.disabled, false, 'Intervals without recorded activity are valid.');
  app.unmount();
});

test('the calendar stays usable with empty history in both languages', async () => {
  for (const language of ['zh', 'en']) {
    const app = await mount({ usageSnapshot: usageSnapshotFixture({ days: [], models: [], dailyModels: [] }) });
    const page = await selector(app, language);
    page.period('custom').props.onClick();
    assert.equal(page.dialog().props.title, language === 'zh' ? '自定义时间范围' : 'Custom range');
    page.shortcut('d7').props.onClick();
    assert.deepEqual(page.range(), ['2026-02-25', '2026-03-03']);
    assert.equal(page.apply().props.disabled, false);
    assert.equal(page.render().filter(node => node.props['data-calendar-day']).length, 42);
    app.unmount();
  }
});

test('the three cards follow calendar ranges and count each session once across days', async () => {
  const app = await mount({ usageSnapshot: usageSnapshotFixture({
    sessionDays: [['2026-03-01', '2026-03-03'], ['2026-03-01'], ['2026-03-03']],
  }) });
  const page = await selector(app);
  const values = () => page.render().filter(node => node.props.className === 'power-dsh-usage-metric-value').map(node => node.props.children.join(''));
  const cells = page.cells().length;
  const reads = app.usageReads.length;
  assert.deepEqual(values(), ['400', '40', '2']);
  page.period('all').props.onClick();
  assert.deepEqual(values(), ['500', '40', '3']);
  page.period('custom').props.onClick();
  page.day('2026-03-01').props.onClick();
  page.day('2026-03-01').props.onClick();
  page.apply().props.onClick();
  assert.deepEqual(values(), ['100', '0', '2']);
  assert.equal(app.usageReads.length, reads);
  assert.equal(page.cells().length, cells);
  app.unmount();
});

test('cache hit rate includes cache writes in input and empty cards remain numeric in both languages', async () => {
  const app = await mount({ usageSnapshot: usageSnapshotFixture({ days: [{
    date: '2026-03-03', totalTokens: 200, inputTokens: 80, outputTokens: 20, cacheReadTokens: 60, cacheWriteTokens: 40,
    turnCount: 1, toolCallCount: 0, requestCount: 2, activeMs: 60_000,
  }] }) });
  const page = await selector(app);
  const details = () => page.render().filter(node => node.props.className === 'power-dsh-usage-metric-detail')
    .map(node => descendants(node).filter(child => child.type === 'span').flatMap(child => child.props.children));
  assert.deepEqual(details().slice(0, 3), [['Input 180', 'Output 20'], ['Cache hit rate 33.3%'], ['Duration 1m']]);
  app.unmount();
  for (const language of ['en', 'zh']) {
    const empty = await mount({ usageSnapshot: usageSnapshotFixture({ days: [], models: [], dailyModels: [] }) });
    const page = await selector(empty, language);
    assert.deepEqual(page.render().filter(node => node.props.className === 'power-dsh-usage-metric-value')
      .map(node => node.props.children.join('')), ['0', '0', '0']);
    const text = page.render().filter(node => node.type === 'span').flatMap(node => node.props.children).join(' ');
    assert.ok(text.includes(language === 'zh' ? '缓存率 0%' : 'Cache hit rate 0%'));
    assert.ok(text.includes(language === 'zh' ? '时长 0 分钟' : 'Duration 0m'));
    assert.ok(!/NaN|Infinity/.test(text));
    empty.unmount();
  }
});

test('the trend curve passes through every point and smooths the segments between them', () => {
  const points = [{ x: 0, y: 80 }, { x: 50, y: 20 }, { x: 100, y: 70 }];
  const path = smoothPath(points);
  assert.ok(path.startsWith('M 0 80'), 'The curve starts on the first day.');
  assert.equal((path.match(/C /g) ?? []).length, 2, 'Each gap becomes one cubic segment.');
  assert.ok(path.endsWith('100 70'), 'The curve ends on the last day.');
  assert.equal(smoothPath([{ x: 0, y: 50 }]), 'M 0 50', 'A single point stays a move command.');
  assert.equal(smoothPath([]), '', 'No points draw nothing.');
});
