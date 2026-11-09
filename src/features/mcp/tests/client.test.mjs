import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mcpFixture, mcpCatalogFixture, mount, button, descendants, mcpPage } from '../../../../tests/helpers/client-fixture.mjs';

test('the MCP preference owns a separate page and icon with independent lifecycle and no server changes', async () => {
  const app = await mount();
  const section = 'settings.section:power-dsh-mcp';
  const icon = 'settings.section.icon:power-dsh-mcp';
  const baseline = app.entries.size;
  const subscriptions = app.subscriptions();
  for (let index = 0; index < 3; index++) {
    assert.ok(!app.entries.has(section));
    app.set({ mcpManagerEnabled: true });
    const entry = app.entries.get(section);
    assert.equal(entry.options.label(), 'mcpTab');
    assert.ok(app.entries.has(icon));
    app.set({ showVersion: true });
    assert.equal(app.entries.get(section), entry);
    assert.equal(app.entries.size, baseline + 2);
    app.set({ mcpManagerEnabled: false });
    assert.ok(!app.entries.has(section));
    assert.ok(!app.entries.has(icon));
    assert.equal(app.entries.size, baseline);
    assert.equal(app.subscriptions(), subscriptions);
  }
  app.set({ mcpManagerEnabled: true, skillManagerEnabled: true });
  assert.ok(app.entries.has('settings.section:power-dsh-skills'));
  app.renderMcp();
  app.renderSkills();
  assert.equal(app.focusSubscriptions(), 3);
  app.unmount();
  assert.ok(!app.entries.has(section));
  assert.ok(!app.entries.has(icon));
  assert.equal(app.focusSubscriptions(), 0);
  assert.equal(app.subscriptions(), 0);
  assert.deepEqual(app.mcpWrites, []);
});

test('MCP lists actual enabled state without inventing server descriptions or connection status', async () => {
  const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers: [
    mcpFixture(),
    mcpFixture({ id: 'include:files', name: 'files', enabled: false }),
    mcpFixture({ id: 'preset:standard/browser', name: 'preset-browser', source: 'preset:standard', group: 'builtin', canToggle: false, reason: 'preset-managed' }),
    mcpFixture({ id: 'include:conditional', name: 'conditional', stateKnown: false, canToggle: true, reason: 'conditional' }),
    mcpFixture({ id: 'include:future', name: 'future', canToggle: true, reason: 'unknown-restriction' }),
  ] }) });
  const page = await mcpPage(app);
  assert.equal(page.group('builtin').props['aria-expanded'], false);
  assert.equal(page.row('preset-browser'), undefined);
  page.group('builtin').props.onClick();
  assert.equal(page.render().filter(node => node.props.role === 'switch').length, 4);
  assert.equal(page.control('browser').props['aria-checked'], true);
  assert.equal(page.control('files').props['aria-checked'], false);
  assert.equal(page.control('preset-browser').props.disabled, true);
  assert.equal(page.control('conditional'), undefined);
  assert.equal(page.control('future').props.disabled, true);
  assert.ok(descendants(page.row('preset-browser')).some(node => node.props.children.includes('mcpPresetManaged')));
  assert.ok(descendants(page.row('conditional')).some(node => node.props.children.includes('mcpStateUnknown')));
  assert.ok(descendants(page.row('future')).some(node => node.props.children.includes('mcpReadOnly')));
  assert.ok(!descendants(page.row('browser')).some(node => node.type === 'p'));
  assert.ok(!page.render().some(node => node.type !== 'style' && node.props.children.some(child => typeof child === 'string' && /connected|online|已连接|在线/i.test(child))));
  for (const name of ['preset-browser', 'future']) await page.control(name).props.onClick();
  assert.deepEqual(app.mcpWrites, []);
  page.search().props.onChange({ target: { value: 'standard' } });
  assert.ok(page.row('preset-browser'));
  assert.equal(page.row('browser'), undefined);
  page.search().props.onChange({ target: { value: '' } });
  assert.ok(page.row('preset-browser'));
  assert.ok(!page.render().some(node => node.type === 'select'));
  page.group('builtin').props.onClick();
  assert.equal(page.row('preset-browser'), undefined);
  assert.equal(page.render().filter(node => node.type === 'li').length, 4);
  app.unmount();
});

test('MCP shows localized runtime state independently of its enable switch without claiming connectivity', async () => {
  const labels = {
    en: { pending: 'Pending', loading: 'Loading', active: 'Running', failed: 'Failed to load', unloading: 'Unloading', inactive: 'Not running' },
    zh: { pending: '等待中', loading: '加载中', active: '运行中', failed: '加载失败', unloading: '卸载中', inactive: '未运行' },
  };
  for (const language of ['en', 'zh']) {
    const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers: [
      ...Object.keys(labels[language]).map(runtimeState => mcpFixture({ id: `state:${runtimeState}`, name: runtimeState, runtimeState })),
      mcpFixture({ id: 'state:disabled', name: 'disabled', enabled: false, runtimeState: 'disabled' }),
      mcpFixture({ id: 'state:unknown', name: 'unknown', runtimeState: 'unknown' }),
      mcpFixture({ id: 'state:active-off', name: 'active-off', enabled: false, runtimeState: 'active' }),
    ] }) });
    const page = await mcpPage(app, language);
    const status = name => descendants(page.row(name)).find(node => node.props.className === 'power-dsh-mcp-runtime');
    for (const [state, label] of Object.entries(labels[language])) {
      const indicator = status(state);
      if (['pending', 'loading', 'unloading'].includes(state)) {
        assert.equal(indicator.props['aria-label'], label);
        assert.equal(indicator.props.children[0].type, 'native-state-dot-fixture');
        assert.equal(indicator.props.children[0].props.state, 'ongoing');
        assert.ok(!indicator.props.children.some(child => typeof child === 'string'));
      } else {
        assert.equal(indicator.props.children[0].type, 'native-state-dot-fixture');
        assert.equal(indicator.props.children[0].props.state, { active: 'done', failed: 'error', inactive: 'idle' }[state]);
        assert.equal(indicator.props.children[1], label);
        assert.equal(indicator.props['aria-label'], undefined);
      }
      assert.equal(status(state).props.role, 'status');
      assert.equal(status(state).props['data-state'], state);
      assert.equal(page.control(state).props['aria-checked'], true);
    }
    assert.equal(status('unknown'), undefined);
    assert.ok(!descendants(page.row('unknown')).some(node => node.props.className === 'power-dsh-mcp-card-meta'));
    for (const name of ['disabled', 'active-off']) {
      assert.equal(status(name).props.children[0].props.state, 'idle');
      assert.equal(status(name).props.children[1], language === 'en' ? 'Disabled' : '已关闭');
      assert.equal(status(name).props['data-state'], 'disabled');
      assert.equal(status(name).props.role, 'status');
      const meta = descendants(page.row(name)).find(node => node.props.className === 'power-dsh-mcp-card-meta');
      assert.ok(meta.props.children.some(child => child?.props?.className === 'power-dsh-mcp-runtime'), 'disabled and running share the same status row');
    }
    assert.equal(page.control('active-off').props['aria-checked'], false);
    assert.ok(!page.render().some(node => node.props.children.some(child => typeof child === 'string' && /online|connected|在线|已连接/.test(child))));
    app.unmount();
    assert.deepEqual(app.intervals(), []);
  }
});

test('MCP polls visible runtime status without blocking tools and releases refreshes on unmount', async () => {
  let reply;
  const app = await mount({ mcpList: () => reply?.promise ?? { ok: true, value: mcpCatalogFixture() } });
  const page = await mcpPage(app);
  const reads = app.mcpReads.length;
  assert.deepEqual(app.intervals(), [2000]);
  await app.tickIntervals();
  assert.equal(app.mcpReads.length, reads, 'hidden pages do not poll');
  app.setDocument({ hidden: false });
  reply = Promise.withResolvers();
  const pending = app.tickIntervals();
  assert.equal(app.mcpReads.length, reads + 1);
  assert.equal(app.mcpProps().mcpSource.getSnapshot().status, 'ready');
  assert.equal(page.control('browser').props.disabled, false);
  page.toggle('browser').props.onClick();
  await app.tickIntervals();
  assert.equal(app.mcpReads.length, reads + 1, 'background reads never overlap');
  reply.resolve({ ok: true, value: mcpCatalogFixture({ servers: [mcpFixture({ runtimeState: 'failed' })] }) });
  await pending;
  assert.equal(descendants(page.row('browser')).find(node => node.props.className === 'power-dsh-mcp-runtime').props.children[1], 'mcpRuntimeFailed');
  assert.equal(page.toggle('browser').props['aria-expanded'], true);
  reply = Promise.withResolvers();
  const late = app.tickIntervals();
  const source = app.mcpProps().mcpSource;
  const before = source.getSnapshot();
  app.unmount();
  assert.deepEqual(app.intervals(), []);
  reply.resolve({ ok: true, value: mcpCatalogFixture() });
  await late;
  assert.equal(source.getSnapshot(), before);
});

test('MCP background state cannot overwrite a switch write and polling skips pending writes', async () => {
  const stale = Promise.withResolvers();
  const write = Promise.withResolvers();
  let deferRead = false;
  const app = await mount({
    mcpList: () => deferRead ? stale.promise : { ok: true, value: mcpCatalogFixture() },
    mcpReply: () => write.promise,
  });
  const page = await mcpPage(app);
  app.setDocument({ hidden: false });
  deferRead = true;
  const background = app.tickIntervals();
  const operation = page.control('browser').props.onClick();
  const reads = app.mcpReads.length;
  await app.tickIntervals();
  assert.equal(app.mcpReads.length, reads);
  write.resolve({ ok: true, value: mcpCatalogFixture({ servers: [mcpFixture({ enabled: false, runtimeState: 'disabled' })] }) });
  await operation;
  stale.resolve({ ok: true, value: mcpCatalogFixture() });
  await background;
  assert.equal(page.control('browser').props['aria-checked'], false);
  assert.equal(app.mcpProps().mcpSource.getSnapshot().value.servers[0].runtimeState, 'disabled');
  app.unmount();
  assert.deepEqual(app.intervals(), []);
});

test('MCP second-row tags use verified local and HTTP transports, omit unknown types and remain searchable', async () => {
  for (const [language, localLabel] of [['en', 'Local'], ['zh', '本地']]) {
    const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers: [
      mcpFixture({ id: 'transport:stdio', name: 'process-server', transport: 'stdio', tools: ['run'] }),
      mcpFixture({ id: 'transport:http', name: 'network-server', transport: 'streamable-http', enabled: false }),
      mcpFixture({ id: 'transport:unknown', name: 'opaque-server', transport: 'unknown' }),
    ] }) });
    const page = await mcpPage(app, language);
    const tag = name => descendants(page.row(name)).find(node => node.props.className === 'power-dsh-mcp-transport');
    for (const [name, label, transport] of [['process-server', localLabel, 'stdio'], ['network-server', 'HTTP', 'streamable-http']]) {
      const badge = tag(name);
      assert.equal(badge.type, 'span');
      assert.equal(badge.props.children[0], label);
      assert.equal(badge.props['data-transport'], transport);
      const content = page.row(name).props.children.find(node => node?.props?.className === 'power-dsh-skill-card-content');
      const lines = content.props.children.filter(Boolean);
      assert.equal(lines[0].props.className, 'power-dsh-skill-card-main');
      assert.equal(lines[1].type, 'div');
      assert.equal(lines[1].props.className, 'power-dsh-mcp-card-meta');
      assert.equal(lines[1].props.children[0].props.id, badge.props.id);
      assert.equal(lines[1].props.children[1].props.className, 'power-dsh-mcp-runtime');
      assert.ok(!descendants(lines[0]).some(node => node.props.className === 'power-dsh-mcp-runtime'));
      assert.equal(lines[1].props.onClick, undefined);
      const toggle = page.toggle(name);
      if (name === 'network-server') {
        assert.equal(toggle, undefined);
        assert.equal(lines.length, 3);
        assert.equal(lines[2].props['data-state'], 'disabled');
        assert.equal(lines[2].props.children[0], language === 'en' ? 'No available tools' : '暂无可用工具');
        assert.equal(lines[2].props.onClick, undefined);
        assert.equal(lines[1].props.children[1].props.children[1], language === 'en' ? 'Disabled' : '已关闭');
        continue;
      }
      assert.equal(lines[2].props.className, toggle.props.className);
      const children = toggle.props.children.filter(Boolean);
      assert.equal(children[0].props.id, page.summary(name).props.id);
      assert.equal(children[1].type.name, 'SkillChevron');
      assert.ok(!descendants(toggle).some(node => node.props.className === 'power-dsh-mcp-transport'));
      assert.equal(toggle.props['aria-labelledby'], `${page.row(name).props['aria-labelledby']} ${page.summary(name).props.id}`);
    }
    assert.equal(tag('opaque-server'), undefined);
    assert.equal(page.control('network-server').props['aria-checked'], false);
    page.search().props.onChange({ target: { value: 'HTTP' } });
    assert.ok(page.row('network-server'));
    assert.equal(page.row('process-server'), undefined);
    assert.equal(page.row('opaque-server'), undefined);
    page.search().props.onChange({ target: { value: localLabel } });
    assert.ok(page.row('process-server'));
    assert.equal(page.row('network-server'), undefined);
    page.toggle('process-server').props.onClick();
    assert.equal(page.tools('process-server').props.hidden, false);
    assert.equal(page.control('process-server').props['aria-checked'], true);
    assert.deepEqual(app.mcpWrites, []);
    app.unmount();
  }
});

test('MCP global groups use explicit membership and restore manual choices after search', async () => {
  const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers: [
    mcpFixture(),
    mcpFixture({ id: 'preset:standard/browser', name: 'mode-browser', source: 'preset:standard', group: 'builtin', canToggle: false, reason: 'preset-managed' }),
    mcpFixture({ id: 'provider:files', name: 'provider-files', source: 'provider:local-files', group: 'user', canToggle: false }),
    mcpFixture({ id: 'include:plugin', name: 'plugin-browser', source: 'profile', origin: '@vendor/mcp-plugin', group: 'builtin' }),
  ] }) });
  const page = await mcpPage(app);
  assert.deepEqual(page.render().filter(node => node.props.id?.includes('-mcp-group-') && node.type === 'button').map(node => node.props.children[1].props.children[0]), [
    'skillPersonalGroup', 'skillPreinstalledGroup',
  ]);
  assert.equal(page.group('user').props['aria-expanded'], true);
  assert.equal(page.group('builtin').props['aria-expanded'], false);
  assert.ok(page.row('browser'));
  assert.ok(page.row('provider-files'));
  assert.equal(page.row('mode-browser'), undefined);
  assert.equal(page.row('plugin-browser'), undefined);
  const reads = app.mcpReads.length;
  page.group('user').props.onClick();
  assert.equal(page.row('browser'), undefined);
  page.search().props.onChange({ target: { value: 'browser' } });
  assert.equal(page.group('user').props['aria-expanded'], true);
  assert.equal(page.group('builtin').props['aria-expanded'], true);
  assert.ok(page.row('mode-browser'));
  page.group('builtin').props.onClick();
  page.search().props.onChange({ target: { value: '' } });
  for (const group of ['user', 'builtin']) assert.equal(page.group(group).props['aria-expanded'], false);
  assert.equal(page.render().filter(node => node.type === 'li').length, 0);
  assert.ok(!page.render().some(node => node.props.children.includes('mcpEmpty')));
  page.group('builtin').props.onClick();
  page.search().props.onChange({ target: { value: '@vendor/mcp-plugin' } });
  assert.ok(page.row('plugin-browser'));
  assert.equal(page.group('user'), undefined);
  page.search().props.onChange({ target: { value: 'missing-server' } });
  assert.ok(page.render().some(node => node.props.children.includes('mcpNoMatches')));
  page.search().props.onChange({ target: { value: '' } });
  assert.equal(page.group('builtin').props['aria-expanded'], true);
  assert.equal(page.group('user').props['aria-expanded'], false);
  assert.ok(page.row('mode-browser'));
  assert.deepEqual(app.mcpWrites, []);
  assert.equal(app.mcpReads.length, reads);
  app.unmount();
});

test('MCP cards preserve full-name tooltips, accessible disclosure controls and read-only reasons', async () => {
  const longName = 'server-with-a-very-long-configuration-instance-name';
  const tools = ['generate_image', 'generation_result'];
  const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers: [
    mcpFixture({ name: longName, tools }),
    mcpFixture({ id: 'preset:mode/browser', name: 'mode-browser', tools: ['navigate'], source: 'preset:mode', group: 'builtin', canToggle: false, reason: 'preset-managed' }),
    mcpFixture({ id: 'provider:files', name: 'provider-files', source: 'provider:files', canToggle: false }),
    mcpFixture({ id: 'include:unknown', name: 'unknown-server', stateKnown: false, reason: 'conditional' }),
  ] }) });
  const page = await mcpPage(app);
  page.group('builtin').props.onClick();
  for (const name of [longName, 'mode-browser', 'provider-files', 'unknown-server']) {
    const card = page.row(name);
    const toggle = page.toggle(name);
    const region = page.tools(name);
    const summary = page.summary(name);
    const title = descendants(card).find(node => node.props.id === card.props['aria-labelledby']);
    const tip = descendants(card).find(node => node.type === 'native-tooltip-fixture' && node.props.label === name);
    assert.ok(tip);
    assert.equal(tip.props.portal, true);
    assert.equal(tip.props.side, 'top');
    assert.equal(tip.props.delayMs, 0);
    assert.equal(tip.props.maxWidth, 400);
    assert.equal(tip.props.children[0].type, 'span');
    assert.equal(tip.props.children[0].props.className, 'power-dsh-skill-card-title');
    assert.equal(tip.props.children[0].props.id, title.props.id);
    assert.equal(tip.props.children[0].props.tabIndex, 0);
    const content = card.props.children.find(node => node?.props?.className === 'power-dsh-skill-card-content');
    const contentChildren = content.props.children.filter(Boolean);
    const mainIndex = contentChildren.findIndex(node => node?.props?.className === 'power-dsh-skill-card-main');
    const main = contentChildren[mainIndex];
    const secondLine = contentChildren[mainIndex + 1];
    const thirdLine = contentChildren[mainIndex + 2];
    assert.equal(secondLine.props.className, 'power-dsh-mcp-card-meta');
    assert.equal(secondLine.props.children.filter(Boolean)[0].props.className, 'power-dsh-mcp-runtime');
    assert.equal(main.props.children.length, 2);
    assert.ok(!descendants(main).some(node => node.props.className === 'power-dsh-mcp-runtime'));
    assert.equal(main.props.children[0].type, 'native-tooltip-fixture');
    assert.ok(descendants(main).some(node => node.props.id === title.props.id));
    assert.ok(!descendants(main).some(node => node.props.className === 'power-dsh-mcp-card-toggle'));
    assert.equal(thirdLine.type, 'button');
    assert.equal(thirdLine.props.className, 'power-dsh-mcp-card-toggle');
    const thirdLineChildren = thirdLine.props.children.filter(Boolean);
    assert.equal(thirdLineChildren[0].props.id, summary.props.id);
    assert.equal(thirdLineChildren[0].props.className, 'power-dsh-mcp-tools-summary');
    assert.equal(thirdLineChildren[1].type.name, 'SkillChevron');
    assert.equal(toggle.type, 'button');
    assert.equal(toggle.props.type, 'button');
    assert.equal(toggle.props['aria-expanded'], false);
    assert.equal(toggle.props['aria-controls'], region.props.id);
    assert.equal(toggle.props['aria-labelledby'], `${title.props.id} ${summary.props.id}`);
    assert.equal(region.props.role, 'region');
    assert.equal(region.props['aria-labelledby'], title.props.id);
    assert.equal(region.props.hidden, true);
    assert.equal(descendants(region).filter(node => node.type === 'li').length, 0);
    assert.ok(title.props.children.includes(name));
    assert.equal(card.props.onClick, undefined);
    assert.ok(!descendants(card).some(node => ['power-dsh-skill-origin', 'power-dsh-skill-card-meta'].includes(node.props.className)));
    assert.ok(!descendants(toggle).some(node => node.props.role === 'switch'));
    if (name !== 'unknown-server') {
      assert.equal(main.props.children[1].props.role, 'switch');
      assert.equal(page.control(name).props['aria-labelledby'], title.props.id);
    }
  }
  assert.ok(!page.render().some(node => node.type === 'native-tooltip-fixture' && node.props.label === tools.join(', ')));
  for (const [name, expected] of [['mode-browser', 'mcpPresetManaged'], ['provider-files', 'mcpReadOnly'], ['unknown-server', 'mcpStateUnknown']]) {
    const card = page.row(name);
    const reason = descendants(card).find(node => node.props.id === card.props['aria-describedby']);
    assert.ok(reason.props.children.includes(expected));
    const title = descendants(card).find(node => node.props.id === card.props['aria-labelledby']);
    assert.equal(title.props['aria-describedby'], reason.props.id);
    page.toggle(name).props.onClick();
    assert.equal(page.toggle(name).props['aria-expanded'], true, 'read-only status does not block reading tools');
    if (name !== 'unknown-server') {
      assert.equal(page.control(name).props['aria-describedby'], reason.props.id);
      assert.equal(page.control(name).props.disabled, true);
    }
  }
  assert.equal(page.control('unknown-server'), undefined);
  assert.deepEqual(app.mcpWrites, []);
  app.unmount();
});

test('MCP tool disclosures show complete individual names, localized counts and a static empty state', async () => {
  const tools = ['generate_image', 'generation_result', 'tool_with_a_very_long_name_that_must_remain_complete_after_expansion', ...Array.from({ length: 10 }, (_, index) => `full_tool_name_${index}`)];
  for (const [language, empty, count, label] of [['en', 'No loaded tools', `${tools.length} tools`, 'Tools'], ['zh', '暂无已加载工具', `${tools.length} 个工具`, '工具']]) {
    const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers: [
      mcpFixture({ tools, origin: '@example/image-provider' }),
      mcpFixture({ id: 'include:single', name: 'single', tools: ['navigate'] }),
      mcpFixture({ id: 'include:empty', name: 'unloaded', tools: [] }),
    ] }) });
    const page = await mcpPage(app, language);
    assert.equal(page.summary('browser').props.children[0], count);
    assert.equal(page.summary('single').props.children[0], language === 'en' ? '1 tool' : '1 个工具');
    const placeholder = () => descendants(page.row('unloaded')).find(node => node.props.className === 'power-dsh-mcp-card-placeholder');
    assert.equal(placeholder().props.children[0], empty);
    assert.equal(placeholder().props['data-state'], 'empty');
    assert.equal(page.toggle('browser').props['aria-expanded'], false);
    assert.equal(page.toggle('unloaded'), undefined);
    assert.equal(descendants(page.tools('browser')).filter(node => node.type === 'li').length, 0);
    const reads = app.mcpReads.length;
    page.toggle('browser').props.onClick();
    const region = page.tools('browser');
    assert.equal(region.props.hidden, false);
    const list = descendants(region).find(node => node.type === 'ul');
    assert.equal(list.props['aria-label'], label);
    const names = descendants(list).filter(node => node.props.className === 'power-dsh-mcp-tool-name');
    assert.deepEqual(names.map(node => node.props.children[0]), tools);
    assert.ok(names.every(node => node.type === 'li'));
    assert.ok(!descendants(region).some(node => node.type === 'native-tooltip-fixture'));
    assert.equal(page.toggle('unloaded'), undefined);
    assert.equal(page.tools('unloaded'), undefined);
    const emptyHeader = page.row('unloaded').props.children.find(node => node?.props?.className === 'power-dsh-skill-card-content');
    assert.equal(emptyHeader.props.onClick, undefined);
    assert.equal(emptyHeader.props['data-expandable'], false);
    assert.equal(placeholder().props.onClick, undefined);
    page.toggle('browser').props.onClick();
    assert.equal(page.tools('browser').props.hidden, true);
    assert.equal(descendants(page.tools('browser')).filter(node => node.type === 'li').length, 0);
    assert.equal(placeholder().props.children[0], empty);
    assert.equal(app.mcpReads.length, reads);
    assert.deepEqual(app.mcpWrites, []);
    app.unmount();
  }
});

test('disabled MCP cards hide all tool UI and collapse after status refresh even with cached tools', async () => {
  for (const language of ['en', 'zh']) {
    const servers = [
      mcpFixture({ id: 'include:empty', name: 'empty', enabled: false, tools: [], runtimeState: 'disabled', transport: 'stdio' }),
      mcpFixture({ id: 'include:cached', name: 'cached', enabled: false, tools: ['cached_tool'], runtimeState: 'active' }),
      mcpFixture({ tools: ['navigate'] }),
    ];
    const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers }) });
    const page = await mcpPage(app, language);
    const header = name => page.row(name).props.children.find(node => node?.props?.className === 'power-dsh-skill-card-content');
    const assertClosed = name => {
      assert.equal(page.control(name).props['aria-checked'], false);
      assert.equal(page.summary(name), undefined);
      assert.equal(page.toggle(name), undefined);
      assert.equal(page.tools(name), undefined);
      assert.equal(page.row(name).props['data-open'], false);
      assert.equal(header(name).props['data-expandable'], false);
      assert.equal(header(name).props.onClick, undefined);
      const placeholder = descendants(page.row(name)).find(node => node.props.className === 'power-dsh-mcp-card-placeholder');
      assert.equal(placeholder.props['data-state'], 'disabled');
      assert.equal(placeholder.props.children[0], language === 'en' ? 'No available tools' : '暂无可用工具');
      assert.equal(placeholder.props.onClick, undefined);
      assert.equal(placeholder.props['aria-hidden'], undefined);
      const status = descendants(page.row(name)).find(node => node.props.className === 'power-dsh-mcp-runtime');
      assert.equal(status.props.children[1], language === 'en' ? 'Disabled' : '已关闭');
      assert.equal(status.props.children[0].props.state, 'idle');
    };
    assertClosed('empty');
    assertClosed('cached');
    assert.ok(descendants(page.row('empty')).some(node => node.props.className === 'power-dsh-mcp-transport'));
    page.toggle('browser').props.onClick();
    assert.equal(page.tools('browser').props.hidden, false);
    const staleToggle = page.toggle('browser').props.onClick;
    app.setMcpServers(mcpCatalogFixture({ servers: servers.map(server => ({ ...server, enabled: false })) }));
    await app.reloadMcp();
    assertClosed('browser');
    staleToggle();
    assertClosed('browser');
    app.setMcpServers(mcpCatalogFixture({ servers }));
    await app.reloadMcp();
    assert.equal(page.toggle('browser').props['aria-expanded'], true, 'a stale handler cannot change expansion while disabled');
    assert.equal(page.control('browser').props['aria-checked'], true);
    app.setMcpServers(mcpCatalogFixture({ servers: servers.map(server => server.name === 'browser' ? { ...server, tools: [] } : server) }));
    await app.reloadMcp();
    assert.equal(page.toggle('browser'), undefined);
    assert.equal(page.tools('browser'), undefined);
    assert.equal(page.row('browser').props['data-open'], false);
    assert.equal(header('browser').props.onClick, undefined);
    staleToggle();
    assert.equal(page.row('browser').props['data-open'], false);
    const emptyState = header('browser').props.children.find(node => node?.props?.['data-state'] === 'empty');
    assert.equal(emptyState.props.children[0], language === 'en' ? 'No loaded tools' : '暂无已加载工具');
    assert.deepEqual(app.mcpWrites, []);
    app.unmount();
  }
});

test('MCP header and button expansion ignore switch bubbling and survive search, group folding and refresh', async () => {
  const tools = ['generate_image', 'generation_result'];
  const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers: [
    mcpFixture({ tools }), mcpFixture({ id: 'include:other', name: 'other', tools: ['search'] }),
  ] }) });
  const page = await mcpPage(app);
  const header = () => page.row('browser').props.children.find(node => node?.props?.className === 'power-dsh-skill-card-content');
  const clickHeader = interactive => header().props.onClick({ target: { closest: () => interactive }, defaultPrevented: false });
  clickHeader(null);
  assert.equal(page.toggle('browser').props['aria-expanded'], true, 'clicking header text or blank space expands the card');
  clickHeader(null);
  assert.equal(page.toggle('browser').props['aria-expanded'], false);
  header().props.onClick({ defaultPrevented: true });
  assert.equal(page.toggle('browser').props['aria-expanded'], false);
  page.toggle('browser').props.onClick();
  clickHeader(page.toggle('browser'));
  assert.equal(page.toggle('browser').props['aria-expanded'], true, 'the button click must not toggle twice when it bubbles');
  assert.equal(page.toggle('other').props['aria-expanded'], false);
  assert.equal(page.tools('browser').props.onClick, undefined);
  assert.equal(page.row('browser').props.onClick, undefined, 'the expanded tool list stays outside the click handler');
  await page.control('browser').props.onClick();
  assert.deepEqual(app.mcpWrites, [{ id: 'include:browser', enabled: false }]);
  assert.equal(header().props.onClick, undefined);
  assert.equal(page.toggle('browser'), undefined);
  assert.equal(page.tools('browser'), undefined);
  assert.equal(page.row('browser').props['data-open'], false);
  await page.control('browser').props.onClick();
  assert.equal(page.toggle('browser').props['aria-expanded'], true);
  assert.equal(page.toggle('other').props['aria-expanded'], false);
  const reads = app.mcpReads.length;
  page.search().props.onChange({ target: { value: 'GENERATION_RESULT' } });
  assert.ok(page.row('browser'));
  assert.equal(page.row('other'), undefined);
  assert.equal(page.toggle('browser').props['aria-expanded'], true);
  page.toggle('browser').props.onClick();
  assert.equal(page.toggle('browser').props['aria-expanded'], false);
  page.search().props.onChange({ target: { value: 'search' } });
  assert.ok(page.row('other'));
  assert.equal(page.toggle('other').props['aria-expanded'], false, 'tool-name search must not expand a card');
  page.search().props.onChange({ target: { value: '' } });
  assert.equal(page.toggle('browser').props['aria-expanded'], false);
  page.toggle('browser').props.onClick();
  page.group('user').props.onClick();
  assert.equal(page.row('browser'), undefined);
  page.group('user').props.onClick();
  assert.equal(page.toggle('browser').props['aria-expanded'], true);
  assert.equal(app.mcpReads.length, reads);
  await app.reloadMcp();
  assert.equal(page.toggle('browser').props['aria-expanded'], true);
  assert.equal(page.toggle('other').props['aria-expanded'], false);
  app.unmount();
});

test('MCP loading errors are localized and never represented as an empty configuration', async () => {
  const knownErrors = ['mcpUnavailable', 'mcpProviderInitFailed', 'mcpPluginsLoadFailed', 'mcpBundlesLoadFailed',
    'mcpPresetsLoadFailed', 'mcpProvidersLoadFailed', 'mcpMetadataLoadFailed'];
  for (const message of [...knownErrors, 'unsafe diagnostic env=SECRET']) {
    const app = await mount({ mcpReadError: message, windows: true });
    const page = await mcpPage(app);
    const visible = page.render().flatMap(node => node.props.children.filter(child => typeof child === 'string'));
    assert.ok(visible.includes(knownErrors.includes(message) ? message : 'mcpLoadFailed'));
    assert.ok(!visible.includes('mcpEmpty'));
    assert.ok(!visible.includes('unsafe diagnostic env=SECRET'));
    assert.ok(page.render().some(node => node.props.role === 'alert'));
    assert.ok(!page.render().some(node => node.props.role === 'switch'));
    app.unmount();
  }
  const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers: [] }) });
  const page = await mcpPage(app);
  assert.ok(page.render().some(node => node.props.children.includes('mcpEmpty')));
  app.unmount();
});

test('MCP stage errors show bilingual guidance and recover through retry on Windows', async () => {
  const stages = {
    mcpProviderInitFailed: 'MCP-INIT', mcpPluginsLoadFailed: 'MCP-PLUGINS',
    mcpBundlesLoadFailed: 'MCP-BUNDLES', mcpPresetsLoadFailed: 'MCP-PRESETS',
    mcpProvidersLoadFailed: 'MCP-PROVIDERS', mcpMetadataLoadFailed: 'MCP-METADATA',
  };
  for (const language of ['en', 'zh']) {
    for (const [message, marker] of Object.entries(stages)) {
      let failed = true;
      const app = await mount({ windows: true, localeLanguage: language, mcpList: () => failed
        ? { ok: false, error: { message } } : { ok: true, value: mcpCatalogFixture() } });
      const page = await mcpPage(app, language);
      const visible = page.render().flatMap(node => node.props.children.filter(child => typeof child === 'string'));
      const guidance = visible.find(text => text.includes(marker));
      assert.ok(guidance, `${language}: ${message}`);
      assert.match(guidance, language === 'zh' ? /无法/ : /Could not/);
      assert.ok(!visible.includes('mcpEmpty'));
      failed = false;
      await page.render().find(node => node.type === 'button'
        && node.props.children.includes(language === 'zh' ? '重试' : 'Retry')).props.onClick();
      assert.equal(page.control('browser').props.disabled, false);
      assert.ok(!page.render().some(node => node.props.role === 'alert'));
      app.unmount();
    }
  }
});

test('incomplete and read-only MCP catalogs cannot be changed', async () => {
  for (const options of [{ mcpCatalog: mcpCatalogFixture({ complete: false }) }, { writable: false }]) {
    const app = await mount(options);
    const page = await mcpPage(app);
    assert.equal(page.control('browser').props.disabled, true);
    await page.control('browser').props.onClick();
    assert.deepEqual(app.mcpWrites, []);
    if (options.mcpCatalog) assert.ok(page.render().some(node => node.props.children.includes('mcpIncomplete')));
    app.unmount();
  }
});

test('slow MCP writes use entry identity, keep accepted state and prevent duplicates and focus reloads', async () => {
  const reply = Promise.withResolvers();
  const app = await mount({ mcpReply: () => reply.promise });
  const page = await mcpPage(app);
  const click = page.control('browser').props.onClick;
  const action = click();
  assert.equal(page.control('browser').props['aria-checked'], true);
  assert.equal(page.control('browser').props['aria-busy'], true);
  assert.equal(page.control('browser').props.disabled, true);
  assert.equal(page.search().props.disabled, true);
  const reads = app.mcpReads.length;
  page.group('user').props.onClick();
  assert.equal(page.row('browser'), undefined);
  page.group('user').props.onClick();
  app.focus();
  await click();
  assert.equal(app.mcpReads.length, reads);
  assert.equal(app.mcpWrites.length, 1);
  reply.resolve({ ok: true, value: mcpCatalogFixture({ servers: [mcpFixture({ enabled: false })] }) });
  await action;
  assert.equal(page.control('browser').props['aria-checked'], false);
  assert.equal(page.control('browser').props.disabled, false);
  assert.equal(page.search().props.disabled, false);
  assert.deepEqual(app.mcpWrites[0], { id: 'include:browser', enabled: false });
  app.unmount();
});

test('MCP write outcomes remain localized and read backend state again even when the operation reports failure', async () => {
  for (const message of ['mcpChangeFailed', 'mcpRestartRequired', 'mcpChangeOverridden', 'mcpChangeUncertain', 'mcpUnavailable', 'unsafe header Authorization=SECRET']) {
    const app = await mount({ mcpReply: async () => {
      app.setMcpServers(mcpCatalogFixture({ servers: [mcpFixture({ enabled: false })] }));
      return { ok: false, error: { message } };
    } });
    const page = await mcpPage(app);
    const reads = app.mcpReads.length;
    await page.control('browser').props.onClick();
    assert.equal(app.mcpReads.length, reads + 1);
    assert.equal(page.control('browser').props['aria-checked'], false);
    const expected = message.startsWith('mcp') ? message : 'mcpChangeFailed';
    const alert = descendants(page.row('browser')).find(node => node.props.role === 'alert' && node.props.children.includes(expected));
    assert.ok(alert);
    assert.ok(page.control('browser').props['aria-describedby'].split(' ').includes(alert.props.id));
    assert.ok(!page.render().some(node => node.props.children.includes('unsafe header Authorization=SECRET')));
    app.unmount();
  }
});

test('MCP catalog generations discard old reads and release effects before late responses settle', async () => {
  const stale = Promise.withResolvers();
  const current = Promise.withResolvers();
  const late = Promise.withResolvers();
  let reads = 0;
  const app = await mount({ mcpList: () => {
    reads++;
    if (reads === 3) return stale.promise;
    if (reads === 4) return current.promise;
    if (reads === 5) return late.promise;
    return { ok: true, value: mcpCatalogFixture() };
  } });
  const page = await mcpPage(app);
  const old = app.reloadMcp();
  const latest = app.reloadMcp();
  current.resolve({ ok: true, value: mcpCatalogFixture({ servers: [mcpFixture({ name: 'current-browser' })] }) });
  await latest;
  stale.resolve({ ok: true, value: mcpCatalogFixture() });
  await old;
  assert.ok(page.row('current-browser'));
  assert.equal(page.row('browser'), undefined);
  const pending = app.reloadMcp();
  const source = app.mcpProps().mcpSource;
  const before = source.getSnapshot();
  app.unmount();
  late.resolve({ ok: true, value: mcpCatalogFixture() });
  await pending;
  assert.equal(source.getSnapshot(), before);
  assert.equal(app.focusSubscriptions(), 0);
});

test('MCP manager config uses its declared control while plugin-owned entries remain read-only', async () => {
  const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers: [
    mcpFixture({ id: 'manager:configured', name: 'managed', source: 'manager', origin: 'native-mcp' }),
    mcpFixture({ id: 'runtime:99', name: 'provided', source: 'plugin', group: 'builtin', origin: '@example/provider', canToggle: false, reason: 'plugin-managed' }),
  ] }) });
  const page = await mcpPage(app);
  assert.equal(page.control('managed').props.disabled, false);
  await page.control('managed').props.onClick();
  assert.deepEqual(app.mcpWrites, [{ id: 'manager:configured', enabled: false }]);
  page.group('builtin').props.onClick();
  assert.equal(page.control('provided').props.disabled, true);
  assert.ok(descendants(page.row('provided')).some(node => node.props.children.includes('mcpPluginManaged')));
  await page.control('provided').props.onClick();
  assert.equal(app.mcpWrites.length, 1);
  app.unmount();
});

test('MCP disabled manager and unloaded context reject previously captured actions', async () => {
  for (const unload of [false, true]) {
    const app = await mount();
    const page = await mcpPage(app);
    const action = page.control('browser').props.onClick;
    const props = app.mcpProps();
    if (unload) app.unmount(); else app.set({ mcpManagerEnabled: false });
    await action();
    await props.setMcpServerEnabled('include:browser', false);
    assert.deepEqual(app.mcpWrites, []);
    if (!unload) app.unmount();
  }
});

test('the MCP preference refreshes the Host mirror and shows rejection without enabling its page', async () => {
  let upgraded = false;
  const writes = [];
  const app = await mount({
    formReply: async (field, value) => { writes.push({ field, value }); return true; },
    formLoad: async () => upgraded ? { mcpManagerEnabled: false } : undefined,
  });
  app.set({ mcpManagerEnabled: undefined });
  app.selectSettingsTab('enhancements');
  const toggle = () => descendants(app.renderSettings()).find(node => node.props.id === 'settings-test-mcpManagerEnabled');
  await toggle().props.onClick();
  assert.deepEqual(writes, []);
  assert.ok(!app.entries.has('settings.section:power-dsh-mcp'));
  assert.ok(descendants(app.renderSettings()).some(node => node.props.role === 'alert' && node.props.children.includes('mcpManagerOutdated')));
  upgraded = true;
  await toggle().props.onClick();
  assert.deepEqual(writes, [{ field: 'mcpManagerEnabled', value: true }]);
  assert.ok(app.entries.has('settings.section:power-dsh-mcp'));
  app.unmount();
});

test('MCP codecs validate every public field and discard credential-bearing metadata', async () => {
  const app = await mount();
  const descriptors = app.rpcDescriptors.filter(item => item.method === 'listMcpServers' || item.method === 'setMcpServerEnabled');
  assert.deepEqual(Array.from(descriptors.find(item => item.method === 'listMcpServers').parameters, item => item.name), []);
  assert.deepEqual(Array.from(descriptors.find(item => item.method === 'setMcpServerEnabled').parameters, item => item.name), ['id', 'enabled']);
  for (const descriptor of descriptors) {
    for (const parameter of descriptor.parameters) assert.throws(() => parameter.codec.create().parse(parameter.name === 'enabled' ? 'false' : false), /boolean|string/);
    const codec = descriptor.result.create();
    const tools = ['generate_image', 'generation_result'];
    const result = codec.parse({ ...mcpCatalogFixture(), rawConfig: 'private', servers: [mcpFixture({ tools, env: { SECRET: 'private' }, headers: { Authorization: 'private' } })] });
    assert.equal('rawConfig' in result, false);
    assert.equal('env' in result.servers[0], false);
    assert.equal('headers' in result.servers[0], false);
    assert.deepEqual(Object.keys(result).sort(), ['complete', 'servers']);
    assert.deepEqual(Object.keys(result.servers[0]).sort(), ['canToggle', 'enabled', 'group', 'id', 'name', 'origin', 'reason', 'runtimeState', 'source', 'stateKnown', 'tools', 'transport']);
    assert.deepEqual(Array.from(result.servers[0].tools), tools);
    assert.notEqual(result.servers[0].tools, tools);
    result.servers[0].tools.push('client_only');
    assert.deepEqual(tools, ['generate_image', 'generation_result']);
    for (const invalid of [{ complete: 'true' }, { servers: null }, { servers: [mcpFixture({ group: 'preset' })] },
      ...[undefined, null, true, 'connected', 'online', 'offline', 'untrusted-secret'].map(runtimeState => ({ servers: [mcpFixture({ runtimeState })] })),
      ...[undefined, null, false, 'http', 'sse', 'local', { url: 'private' }].map(transport => ({ servers: [mcpFixture({ transport })] })),
      ...[undefined, null, 'generate_image', { name: 'generate_image' }, [null], [1], [false], [{ name: 'generate_image', description: 'private', execute() {} }], ['generate_image', { name: 'generation_result' }]].map(tools => ({ servers: [mcpFixture({ tools })] })),
      ...['id', 'name', 'source', 'origin', 'reason'].map(key => ({ servers: [mcpFixture({ [key]: null })] })), ...['enabled', 'stateKnown', 'canToggle'].map(key => ({ servers: [mcpFixture({ [key]: 'true' })] }))]) {
      assert.throws(() => codec.parse({ ...mcpCatalogFixture(), ...invalid }), /Invalid MCP/);
    }
  }
  app.unmount();
});
