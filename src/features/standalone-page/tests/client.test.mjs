import assert from 'node:assert/strict';
import { test } from 'node:test';
import { descendants, mount } from '../../../../tests/helpers/client-fixture.mjs';

function label(tab) { return descendants(tab).find(node => node.props.className === 'power-dsh-standalone-tab-text').props.children[0]; }
function tabs(app) { return descendants(app.renderStandalone()).filter(node => node.props.role === 'tab'); }
function selected(app) { return tabs(app).find(tab => tab.props['aria-selected']); }
function iconOf(node) {
  const labelNode = descendants(node).find(item => item.props.className === 'power-dsh-standalone-tab-label');
  const icon = labelNode.props.children[0];
  return icon.type(icon.props);
}

test('the sidebar page switch owns the main panel and sidebar row and returns to the conversation when disabled', async () => {
  const app = await mount({ featureIds: ['standalone-page'] });
  try {
    assert.ok(!app.entries.has('main:power-dsh'));
    assert.ok(!app.entries.has('sidebar.panellist:power-dsh'));
    app.set({ standalonePageEnabled: true });
    assert.ok(app.entries.has('main:power-dsh'));
    assert.ok(app.entries.has('sidebar.panellist:power-dsh'));
    app.selectPanel('power-dsh');
    app.set({ standalonePageEnabled: false });
    assert.equal(app.activePanelId(), null);
    assert.ok(!app.entries.has('main:power-dsh'));
    assert.ok(!app.entries.has('sidebar.panellist:power-dsh'));
  } finally {
    app.unmount();
  }
});

test('the standalone page contains only enabled feature pages in the agreed order', async () => {
  const app = await mount({ featureIds: ['standalone-page', 'wallpaper', 'personalization', 'memory', 'skills', 'mcp', 'projects', 'archive', 'usage-stats'] });
  try {
    app.set({
      wallpaperEnabled: true, personalizationEnabled: true,
      skillManagerEnabled: true, mcpManagerEnabled: true, projectManagerEnabled: true,
      archiveManagerEnabled: true, usageStatsEnabled: true, memoryEnabled: true,
    });
    const sectionOrder = () => [...app.entries.entries()]
      .filter(([key]) => key.startsWith('settings.section:power-dsh-') && key !== 'settings.section:power-dsh-wallpaper')
      .sort(([, first], [, second]) => first.options.order - second.options.order)
      .map(([, entry]) => entry.options.label());
    const expected = ['personalizationTab', 'memoryTab', 'skillsTab', 'mcpTab', 'projectsTab', 'archiveTab', 'usageTab'];
    assert.deepEqual(sectionOrder(), expected);
    app.set({ standalonePageEnabled: true });
    assert.deepEqual(tabs(app).map(label), expected);
    for (const tab of tabs(app)) {
      const icon = iconOf(tab);
      assert.ok(icon, `${label(tab)} has a navigation icon`);
      assert.equal(icon.props.width, 16);
      assert.equal(icon.props['aria-hidden'], true);
      assert.equal(icon.props.focusable, false);
    }
    assert.equal(label(selected(app)), 'personalizationTab');
    assert.equal(app.renderStandalone().props['data-page'], 'personalization');
    tabs(app)[2].props.onClick();
    const skillsNode = descendants(app.renderStandalone()).find(node => node.type.name === 'SkillsPage');
    assert.equal(app.renderComponent(skillsNode).props.className, 'power-dsh-page power-dsh-skills-page');
    tabs(app)[6].props.onClick();
    assert.equal(label(selected(app)), 'usageTab');
    assert.equal(app.renderStandalone().props['data-page'], 'usage');
    const usageNode = descendants(app.renderStandalone()).find(node => node.type.name === 'UsagePage');
    assert.ok(usageNode);
    assert.ok(!descendants(app.renderStandalone()).some(node => node.props.embedded || node.props.role === 'dialog'));
    app.set({ standalonePageEnabled: false });
    assert.deepEqual(sectionOrder(), expected);
  } finally {
    app.unmount();
  }
});

test('standalone pages suppress duplicate settings entries while wallpaper and all switches stay available', async () => {
  const app = await mount({ featureIds: ['standalone-page', 'wallpaper', 'usage-stats'] });
  try {
    app.set({ wallpaperEnabled: true, usageStatsEnabled: true });
    app.set({ standalonePageEnabled: true });
    assert.ok(app.entries.has('settings.section:power-dsh-wallpaper'));
    assert.ok(app.entries.has('settings.section.icon:power-dsh-wallpaper'));
    assert.ok(!app.entries.has('settings.section:power-dsh-usage'));
    assert.ok(!app.entries.has('settings.section.icon:power-dsh-usage'));
    const featureView = descendants(app.selectSettingsTab('enhancements'));
    assert.deepEqual(featureView.filter(node => node.props.role === 'switch').map(node => node.props.id),
      ['settings-test-standalonePageEnabled', 'settings-test-usageStatsEnabled']);
    assert.ok(!descendants(app.selectSettingsTab('interface')).some(node => node.props.id === 'settings-test-standalonePageEnabled'));
    assert.ok(descendants(app.renderSettings()).some(node => node.props.id === 'settings-test-wallpaperEnabled'));
    app.set({ standalonePageEnabled: false });
    assert.ok(app.entries.has('settings.section:power-dsh-usage'));
    assert.ok(app.entries.has('settings.section:power-dsh-wallpaper'));
  } finally {
    app.unmount();
  }
});

test('standalone tabs wrap with arrow keys and keep one tab stop', async () => {
  const app = await mount({ featureIds: ['standalone-page', 'skills', 'usage-stats'] });
  try {
    app.set({ standalonePageEnabled: true, skillManagerEnabled: true, usageStatsEnabled: true });
    let prevented = false;
    tabs(app)[0].props.onKeyDown({ key: 'ArrowLeft', preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(label(selected(app)), 'usageTab');
    assert.equal(tabs(app).filter(tab => tab.props.tabIndex === 0).length, 1);
    selected(app).props.onKeyDown({ key: 'Home', preventDefault() {} });
    assert.equal(label(selected(app)), 'skillsTab');
    selected(app).props.onKeyDown({ key: 'End', preventDefault() {} });
    assert.equal(label(selected(app)), 'usageTab');
  } finally {
    app.unmount();
  }
});

test('the native segmented tabs receive controlled selection and scroll within the owned strip', async () => {
  function NativeSegmentedTabs() { return null; }
  const app = await mount({ featureIds: ['standalone-page', 'skills', 'usage-stats'], segmentedTabs: NativeSegmentedTabs });
  try {
    app.set({ standalonePageEnabled: true, skillManagerEnabled: true, usageStatsEnabled: true });
    const render = () => descendants(app.renderStandalone());
    const nodes = render();
    const segmented = nodes.find(node => node.type === NativeSegmentedTabs);
    assert.deepEqual(Array.from(segmented.props.items, item => item.value), ['skills', 'usage']);
    for (const item of segmented.props.items) {
      assert.equal(iconOf(item.label).type, 'svg');
      assert.equal(descendants(item.label).filter(node => node.props.className === 'power-dsh-standalone-tab-text').length, 1);
    }
    assert.equal(segmented.props.value, 'skills');
    const scrollCalls = [];
    nodes.find(node => node.props.className === 'power-dsh-standalone-tab-strip').props.ref.current = {
      querySelector(selector) {
        assert.equal(selector, '[role="tab"][aria-selected="true"]');
        return { scrollIntoView: options => scrollCalls.push({ ...options }) };
      },
    };
    segmented.props.onChange('usage');
    const next = render();
    assert.equal(next.find(node => node.type === NativeSegmentedTabs).props.value, 'usage');
    assert.ok(next.some(node => node.props.role === 'tabpanel' && node.props.id === 'settings-test-panel-usage'));
    assert.deepEqual(scrollCalls, [{ block: 'nearest', inline: 'nearest' }]);
  } finally {
    app.unmount();
  }
});

test('memory moves between settings and standalone with the same brain icon and preserves its configuration', async () => {
  function NativeSegmentedTabs() { return null; }
  const app = await mount({ featureIds: ['standalone-page', 'memory', 'usage-stats'], segmentedTabs: NativeSegmentedTabs });
  try {
    app.set({ memoryEnabled: true, memoryGlobalEnabled: false, memoryWorkspaceEnabled: true, usageStatsEnabled: true });
    const settingsIcon = app.entries.get('settings.section.icon:power-dsh-memory');
    const originalIcon = settingsIcon.component({ size: 16 });
    const paths = icon => descendants(icon).filter(node => node.type === 'path').map(node => node.props.d);
    assert.equal(originalIcon.props.viewBox, '0 0 24 24');
    assert.deepEqual(paths(originalIcon).slice(0, 2), ['M12 18V5', 'M15 13a4.17 4.17 0 01-3-4 4.17 4.17 0 01-3 4']);
    app.set({ standalonePageEnabled: true });
    assert.equal(app.entries.has('settings.section:power-dsh-memory'), false);
    assert.equal(app.entries.has('settings.section.icon:power-dsh-memory'), false);
    let view = app.renderStandalone();
    const native = descendants(view).find(node => node.type === NativeSegmentedTabs);
    assert.deepEqual(Array.from(native.props.items, item => item.value), ['memory', 'usage']);
    const memoryItem = native.props.items[0];
    const icon = iconOf(memoryItem.label);
    assert.deepEqual(paths(icon), paths(originalIcon));
    const page = descendants(view).find(node => node.type.name === 'MemoryPage');
    assert.ok(page);
    const switches = descendants(app.renderComponent(page)).filter(node => node.props.role === 'switch');
    assert.deepEqual(switches.map(node => node.props['aria-checked']), [true, false, true]);
    app.resizeElement(view.props.ref.current, 960);
    view = app.renderStandalone();
    assert.equal(view.props['data-navigation'], 'side');
    const memoryTab = tabs(app).find(tab => label(tab) === 'memoryTab');
    assert.deepEqual(paths(iconOf(memoryTab)), paths(originalIcon));
    app.set({ memoryEnabled: false });
    assert.equal(app.renderStandalone().props['data-page'], 'usage');
    assert.equal(tabs(app).some(tab => label(tab) === 'memoryTab'), false);
    app.set({ memoryEnabled: true, standalonePageEnabled: false });
    assert.ok(app.entries.has('settings.section:power-dsh-memory'));
    assert.ok(app.entries.has('settings.section.icon:power-dsh-memory'));
    const restored = descendants(app.renderMemory()).filter(node => node.props.role === 'switch');
    assert.deepEqual(restored.map(node => node.props['aria-checked']), [true, false, true]);
  } finally {
    app.unmount();
  }
});

test('panel width switches navigation while preserving the active page, scroll and keyboard access', async () => {
  function NativeSegmentedTabs() { return null; }
  const app = await mount({ featureIds: ['standalone-page', 'skills', 'usage-stats'], segmentedTabs: NativeSegmentedTabs });
  try {
    app.set({ standalonePageEnabled: true, skillManagerEnabled: true, usageStatsEnabled: true });
    let view = app.renderStandalone();
    const root = view.props.ref.current;
    descendants(view).find(node => node.type === NativeSegmentedTabs).props.onChange('usage');
    view = app.renderStandalone();
    const scroll = { scrollTop: 180 };
    descendants(view).find(node => node.props.className === 'power-dsh-standalone-scroll').props.ref.current = scroll;
    app.resizeElement(root, 960);
    view = app.renderStandalone();
    assert.equal(view.props['data-navigation'], 'side');
    assert.ok(!descendants(view).some(node => node.type === NativeSegmentedTabs));
    assert.equal(descendants(view).find(node => node.props.role === 'tablist').props['aria-orientation'], 'vertical');
    assert.equal(label(selected(app)), 'usageTab');
    assert.equal(scroll.scrollTop, 180);
    selected(app).props.onKeyDown({ key: 'ArrowDown', preventDefault() {} });
    assert.equal(label(selected(app)), 'skillsTab');
    selected(app).props.onKeyDown({ key: 'ArrowUp', preventDefault() {} });
    assert.equal(label(selected(app)), 'usageTab');
    app.resizeElement(root, 959);
    view = app.renderStandalone();
    assert.equal(view.props['data-navigation'], 'top');
    assert.equal(descendants(view).find(node => node.type === NativeSegmentedTabs).props.value, 'usage');
    const component = app.entries.get('main:power-dsh').component({ t: key => key });
    const before = app.geometry().disconnectCount;
    app.disposeComponent(component.type);
    assert.equal(app.geometry().disconnectCount, before + 1);
  } finally {
    app.unmount();
  }
});

test('switching pages resets only content scroll and brings the selected tab into view', async () => {
  const app = await mount({ featureIds: ['standalone-page', 'skills', 'usage-stats'] });
  try {
    app.set({ standalonePageEnabled: true, skillManagerEnabled: true, usageStatsEnabled: true });
    const nodes = descendants(app.renderStandalone());
    const scrollElement = { scrollTop: 320 };
    nodes.find(node => node.props.className === 'power-dsh-standalone-scroll').props.ref.current = scrollElement;
    const navigation = nodes.find(node => node.props.className?.includes('power-dsh-standalone-navigation'));
    assert.ok(!descendants(navigation).some(node => node.props.role === 'tabpanel'));
    const usageTab = nodes.find(node => node.props.role === 'tab' && label(node) === 'usageTab');
    const scrollCalls = [];
    usageTab.props.ref({ focus() {}, scrollIntoView: options => scrollCalls.push({ ...options }) });
    usageTab.props.onKeyDown({ key: 'End', preventDefault() {} });
    app.renderStandalone();
    assert.equal(scrollElement.scrollTop, 0);
    assert.deepEqual(scrollCalls, [{ block: 'nearest', inline: 'nearest' }]);
    scrollElement.scrollTop = 180;
    app.renderStandalone();
    assert.equal(scrollElement.scrollTop, 180);
  } finally {
    app.unmount();
  }
});

test('closing the active feature immediately selects an available page and remembers valid selection across remounts', async () => {
  const app = await mount({ featureIds: ['standalone-page', 'skills', 'usage-stats'] });
  try {
    app.set({ standalonePageEnabled: true, skillManagerEnabled: true, usageStatsEnabled: true });
    tabs(app)[1].props.onClick();
    app.renderStandalone();
    const component = app.entries.get('main:power-dsh').component({ t: key => key });
    app.disposeComponent(component.type);
    assert.equal(label(selected(app)), 'usageTab');
    app.set({ usageStatsEnabled: false });
    assert.equal(label(selected(app)), 'skillsTab');
    assert.equal(tabs(app).length, 1);
    app.set({ skillManagerEnabled: false });
    assert.equal(tabs(app).length, 0);
    assert.ok(descendants(app.renderStandalone()).some(node => node.type === 'p' && node.props.children.includes('standaloneEmpty')));
  } finally {
    app.unmount();
  }
});

test('the standalone page omits the plugin heading and settings controls, including in its empty state', async () => {
  const app = await mount({ featureIds: ['standalone-page', 'skills'] });
  try {
    app.set({ standalonePageEnabled: true });
    const render = () => descendants(app.renderStandalone());
    assert.ok(!render().some(node => node.type === 'header' || node.type === 'h2' || node.props.role === 'dialog' || node.type === 'button'));
    assert.ok(render().some(node => node.type === 'p' && node.props.children.includes('standaloneEmptyHint')));
    app.set({ skillManagerEnabled: true });
    assert.equal(tabs(app).length, 1);
    assert.equal(render().filter(node => node.type === 'button').length, 1);
    assert.ok(!render().some(node => node.props['aria-haspopup'] === 'dialog' || node.type === 'header'));
  } finally {
    app.unmount();
  }
});

test('the settings switch keeps the shared save and return-to-conversation behavior', async () => {
  const app = await mount({ featureIds: ['standalone-page'] });
  try {
    app.set({ standalonePageEnabled: true });
    app.selectPanel('power-dsh');
    const control = descendants(app.selectSettingsTab('enhancements')).find(node => node.props.role === 'switch');
    await control.props.onClick();
    assert.equal(app.activePanelId(), null);
    assert.equal(app.entries.has('main:power-dsh'), false);
  } finally {
    app.unmount();
  }
});

test('a rejected standalone switch save preserves the panel and reports the error beside the switch', async () => {
  const app = await mount({ featureIds: ['standalone-page'], formReply: async () => false });
  try {
    app.set({ standalonePageEnabled: true });
    app.selectPanel('power-dsh');
    app.selectSettingsTab('enhancements');
    const render = () => descendants(app.renderSettings());
    await render().find(node => node.props.role === 'switch').props.onClick();
    assert.equal(render().find(node => node.props.role === 'switch').props['aria-checked'], true);
    assert.ok(render().some(node => node.props.role === 'alert'));
    assert.equal(app.activePanelId(), 'power-dsh');
    assert.ok(app.entries.has('main:power-dsh'));
  } finally {
    app.unmount();
  }
});
