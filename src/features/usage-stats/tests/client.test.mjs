import assert from 'node:assert/strict';
import { test } from 'node:test';
import { descendants, mount, usageSnapshotFixture } from '../../../../tests/helpers/client-fixture.mjs';

async function usagePage(app, language = 'en') {
  app.set({ usageStatsEnabled: true });
  app.renderUsage(language);
  await app.reloadUsage();
  const render = () => descendants(app.renderUsage(language));
  const tabs = () => render().filter(node => node.props.role === 'tab');
  const tab = label => tabs().find(node => [node.props.children].flat(Infinity).includes(label));
  const cells = () => render().filter(node => node.props.className === 'power-dsh-usage-heatmap-cell');
  const tooltips = () => render().filter(node => node.type === 'native-tooltip-fixture'
    && node.props.label?.includes('tokens'));
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
  assert.equal(values.length, 5);
  assert.equal(values[0], '500', 'Total tokens are compacted.');
  assert.equal(values[1], '400', 'The peak day is the highest single day.');
  assert.equal(values[2], '1h 2m', 'The longest session reads in days, hours and minutes.');
  assert.equal(values[3], '1 day');
  assert.equal(values[4], '2 days');
  const labels = page.render().filter(node => node.props.className === 'power-dsh-usage-metric-label').map(node => node.props.children);
  assert.deepEqual(labels.flat(Infinity), ['Total tokens', 'Peak tokens', 'Longest session', 'Current streak', 'Longest streak']);
  app.unmount();
});

test('the heatmap keeps 53 weeks and switches between daily, weekly and cumulative levels', async () => {
  // Three separate weeks of unequal weight: weekly grades each column, cumulative grades the running total.
  const days = ['2026-01-05', '2026-01-06', '2026-01-19', '2026-02-02', '2026-02-03', '2026-02-04']
    .map((date, index) => ({ date, totalTokens: (index + 1) * 100, turnCount: 1, toolCallCount: 0 }));
  const app = await mount({ usageSnapshot: usageSnapshotFixture({ days }) });
  const page = await usagePage(app);
  const columns = page.render().filter(node => node.props.className === 'power-dsh-usage-heatmap-column');
  assert.equal(columns.length, 53, 'The activity grid always shows 53 natural weeks.');
  assert.equal(page.cells().length, 53 * 7);
  const hasUsage = page.cells().filter(node => node.props['data-has-usage'] === true);
  assert.ok(hasUsage.length >= 2);
  const dailyLevels = page.cells().map(node => node.props['data-level']);
  page.tab('Weekly').props.onClick();
  const weeklyLevels = page.cells().map(node => node.props['data-level']);
  assert.notDeepEqual(weeklyLevels, dailyLevels, 'Weekly mode grades the whole column instead of single days.');
  page.tab('Cumulative').props.onClick();
  const cumulativeLevels = page.cells().map(node => node.props['data-level']);
  assert.notDeepEqual(cumulativeLevels, weeklyLevels, 'Cumulative mode grades the running total.');
  assert.equal(page.cells().length, 53 * 7, 'Switching modes never changes the grid.');
  assert.ok(page.tooltips().every(node => node.props.portal === true));
  app.unmount();
});

test('the range switch changes only the trend axis while the summary stays put', async () => {
  const app = await mount({ usageSnapshot: usageSnapshotFixture({ days: Array.from({ length: 40 }, (_, index) => ({
    date: new Date(Date.parse('2026-02-01T00:00:00.000Z') + index * 86_400_000).toISOString().slice(0, 10),
    totalTokens: index * 10, turnCount: 1, toolCallCount: 0,
  })) }) });
  const page = await usagePage(app);
  const points = () => page.render().find(node => node.type === 'polyline').props.points.trim().split(' ').length;
  const sevenDay = points();
  page.tab('Last 30 days').props.onClick();
  const thirtyDay = points();
  assert.equal(sevenDay, 7, 'The 7-day range plots one point per day.');
  assert.equal(thirtyDay, 30, 'The 30-day range plots one point per day.');
  const summary = page.render().filter(node => node.props.className === 'power-dsh-usage-metric-value')
    .map(node => [node.props.children].flat(Infinity).join(''));
  assert.equal(summary[0], '500', 'The lifetime summary ignores the range switch.');
  app.unmount();
});

test('the trend chart draws at most six models and the model list ranks them by tokens', async () => {
  const models = Array.from({ length: 8 }, (_, index) => ({
    modelId: `model-${index}`, provider: 'magpie', totalTokens: 1000 - index * 100, requestCount: 1,
  }));
  const app = await mount({ usageSnapshot: usageSnapshotFixture({
    models,
    dailyModels: models.map(model => ({ date: '2026-03-03', modelId: model.modelId, provider: model.provider, totalTokens: model.totalTokens })),
  }) });
  const page = await usagePage(app);
  const lines = page.render().filter(node => node.type === 'polyline');
  assert.equal(lines.length, 6, 'Only the six largest models are plotted.');
  const legend = page.render().filter(node => node.props.className === 'power-dsh-usage-legend-item');
  assert.deepEqual(legend.map(node => [node.props.children].flat(Infinity).at(-1)),
    models.slice(0, 6).map(model => model.modelId));
  const rows = page.render().filter(node => node.props.className === 'power-dsh-usage-model');
  assert.equal(rows.length, 8, 'Every model keeps a row in the usage list.');
  assert.deepEqual(rows.map(node => [descendants(node).find(child => child.props.className === 'power-dsh-usage-model-name').props.children].flat(Infinity).join('')),
    models.map(model => model.modelId));
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
