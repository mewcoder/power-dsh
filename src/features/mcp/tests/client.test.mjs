import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mcpFixture, mcpCatalogFixture, mount, button, descendants, mcpPage } from '../../../../tests/helpers/client-fixture.mjs';

test('MCP loading uses shared feedback and keeps the previous catalog during a compact refresh', async () => {
  let reply = Promise.withResolvers();
  const app = await mount({ featureIds: ['mcp'], mcpList: () => reply.promise });
  app.set({ mcpManagerEnabled: true });
  const render = () => descendants(app.renderMcp());
  const loading = () => render().find(node => node.props.className === 'power-dsh-loading');
  assert.equal(loading().props.role, 'status');
  assert.equal(loading().props['data-compact'], undefined);
  assert.ok(descendants(loading()).some(node => node.type === 'native-state-dot-fixture' && node.props.state === 'ongoing'));
  assert.ok(descendants(loading()).some(node => node.props.children.includes('loading')));
  reply.resolve({ ok: true, value: mcpCatalogFixture() });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(loading(), undefined);
  reply = Promise.withResolvers();
  const refresh = app.reloadMcp();
  assert.equal(loading().props['data-compact'], true);
  assert.ok(render().some(node => node.props['data-mcp'] === 'include:browser'));
  reply.resolve({ ok: true, value: mcpCatalogFixture() });
  await refresh;
  assert.equal(loading(), undefined);
  assert.deepEqual(app.mcpWrites, []);
  app.unmount();
});

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
  page.detail('browser').props.onClick({ stopPropagation() {} });
  await app.tickIntervals();
  assert.equal(app.mcpReads.length, reads + 1, 'background reads never overlap');
  reply.resolve({ ok: true, value: mcpCatalogFixture({ servers: [mcpFixture({ runtimeState: 'failed' })] }) });
  await pending;
  assert.equal(descendants(page.row('browser')).find(node => node.props.className === 'power-dsh-mcp-runtime').props.children[1], 'mcpRuntimeFailed');
  assert.equal(page.control('browser').props['aria-checked'], true, 'A status refresh keeps the switch and the card intact.');
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
      // The card carries no tool disclosure; the last row is count text plus the detail action.
      assert.equal(page.toggle(name), undefined);
      const actions = lines.at(-1);
      assert.equal(actions.props.className, 'power-dsh-mcp-card-actions');
      assert.equal(page.detail(name).props.children[0], language === 'en' ? 'Details' : '详情');
      const filled = actions.props.children.filter(Boolean);
      assert.equal(filled.length, name === 'network-server' ? 1 : 2, 'A closed server shows the action only.');
      if (name !== 'network-server') assert.equal(filled[0].props.className, 'power-dsh-mcp-tools-summary');
      if (name === 'network-server') {
        assert.equal(lines[1].props.children[1].props.children[1], language === 'en' ? 'Disabled' : '已关闭');
      }
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

test('MCP cards preserve full-name tooltips, a count line and read-only reasons without a disclosure', async () => {
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
    const main = contentChildren.find(node => node?.props?.className === 'power-dsh-skill-card-main');
    // No tool disclosure exists any more; the last row is the count plus the detail action.
    assert.equal(page.toggle(name), undefined);
    assert.equal(page.tools(name), undefined);
    assert.ok(!descendants(card).some(node => node.props['data-expandable'] !== undefined));
    assert.ok(!descendants(card).some(node => node.props['aria-expanded'] !== undefined));
    assert.equal(card.props.onClick, undefined);
    assert.ok(!descendants(main).some(node => node.props.className === 'power-dsh-mcp-runtime'));
    const actions = contentChildren.at(-1);
    assert.equal(actions.props.className, 'power-dsh-mcp-card-actions');
    const countNode = descendants(actions).find(node => node.props.className === 'power-dsh-mcp-tools-summary');
    // Every fixture row exposes tools, so the count line is always present.
    const expectedCount = { [longName]: 'mcpToolCount' }[name] ?? 'mcpSingleTool';
    assert.equal(countNode?.props.children[0] ?? '', expectedCount);
    assert.equal(page.detail(name).props.children[0], 'mcpDetail');
    assert.ok(!descendants(card).some(node => ['power-dsh-skill-origin', 'power-dsh-skill-card-meta'].includes(node.props.className)));
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
    assert.equal(page.detail(name).props['aria-describedby'], reason.props.id, 'The detail action carries the read-only reason.');
    if (name !== 'unknown-server') {
      assert.equal(page.control(name).props['aria-describedby'], reason.props.id);
      assert.equal(page.control(name).props.disabled, true);
    }
  }
  assert.equal(page.control('unknown-server'), undefined);
  assert.deepEqual(app.mcpWrites, []);
  app.unmount();
});

test('MCP cards show localized tool counts and leave the full tool list to the detail dialog', async () => {
  const tools = ['generate_image', 'generation_result', 'tool_with_a_very_long_name_that_must_remain_complete', ...Array.from({ length: 10 }, (_, index) => `full_tool_name_${index}`)];
  for (const [language, count, single] of [['en', `${tools.length} tools`, '1 tool'], ['zh', `${tools.length} 个工具`, '1 个工具']]) {
    const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers: [
      mcpFixture({ tools, origin: '@example/image-provider' }),
      mcpFixture({ id: 'include:single', name: 'single', tools: ['navigate'] }),
      mcpFixture({ id: 'include:empty', name: 'unloaded', tools: [] }),
    ] }) });
    const page = await mcpPage(app, language);
    // The count is plain text in the last row; there is no button, region or chevron.
    assert.equal(page.summary('browser').props.children[0], count);
    assert.equal(page.summary('single').props.children[0], single);
    assert.equal(page.summary('unloaded'), undefined, 'A server without tools shows no count.');
    for (const name of ['browser', 'single', 'unloaded']) {
      assert.equal(page.toggle(name), undefined);
      assert.equal(page.tools(name), undefined);
      const card = page.row(name);
      assert.ok(!descendants(card).some(node => node.props.role === 'region'));
      assert.ok(!descendants(card).some(node => node.type.name === 'SkillChevron'));
    }
    // The dialog is the only place that lists tool names.
    const names = descendants(page.detail('browser')).filter(node => node.props.className === 'power-dsh-mcp-tool-name');
    assert.deepEqual(names, []);
    assert.deepEqual(app.mcpWrites, []);
    app.unmount();
  }
});

test('disabled MCP cards hide the tool count and never list cached tools', async () => {
  for (const language of ['en', 'zh']) {
    const servers = [
      mcpFixture({ id: 'include:empty', name: 'empty', enabled: false, tools: [], runtimeState: 'disabled', transport: 'stdio' }),
      mcpFixture({ id: 'include:cached', name: 'cached', enabled: false, tools: ['cached_tool'], runtimeState: 'active' }),
      mcpFixture({ tools: ['navigate'] }),
    ];
    const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers }) });
    const page = await mcpPage(app, language);
    const header = name => page.row(name).props.children.find(node => node?.props?.className === 'power-dsh-skill-card-content');
    const assertOff = name => {
      assert.equal(page.control(name).props['aria-checked'], false);
      assert.equal(page.summary(name), undefined, 'A disabled server shows no tool count.');
      assert.equal(page.toggle(name), undefined);
      assert.equal(page.tools(name), undefined);
      assert.ok(!descendants(page.row(name)).some(node => node.props.className === 'power-dsh-mcp-tool-name'));
      assert.equal(header(name).props.onClick, undefined);
      const status = descendants(page.row(name)).find(node => node.props.className === 'power-dsh-mcp-runtime');
      assert.equal(status.props.children[1], language === 'en' ? 'Disabled' : '已关闭');
      assert.equal(status.props.children[0].props.state, 'idle');
    };
    assertOff('empty');
    assertOff('cached');
    assert.ok(descendants(page.row('empty')).some(node => node.props.className === 'power-dsh-mcp-transport'));
    assert.equal(page.summary('browser').props.children[0], language === 'en' ? '1 tool' : '1 个工具');
    app.setMcpServers(mcpCatalogFixture({ servers: servers.map(server => ({ ...server, enabled: false })) }));
    await app.reloadMcp();
    assertOff('browser');
    app.setMcpServers(mcpCatalogFixture({ servers }));
    await app.reloadMcp();
    assert.equal(page.control('browser').props['aria-checked'], true);
    assert.ok(page.summary('browser'), 'The count returns with the server.');
    // A server with no loaded tools keeps its row but shows no count.
    app.setMcpServers(mcpCatalogFixture({ servers: servers.map(server => server.name === 'browser' ? { ...server, tools: [] } : server) }));
    await app.reloadMcp();
    assert.equal(page.summary('browser'), undefined);
    assert.equal(page.toggle('browser'), undefined);
    assert.ok(page.detail('browser'), 'The detail action stays available without tools.');
    assert.deepEqual(app.mcpWrites, []);
    app.unmount();
  }
});

test('MCP cards expose no expandable header and keep the detail action independent of the switch', async () => {
  const tools = ['generate_image', 'generation_result'];
  const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers: [
    mcpFixture({ tools }), mcpFixture({ id: 'include:other', name: 'other', tools: ['search'] }),
  ] }) });
  const page = await mcpPage(app);
  const header = () => page.row('browser').props.children.find(node => node?.props?.className === 'power-dsh-skill-card-content');
  // The card head is inert: no click handler, no disclosure, no expanded region.
  assert.equal(header().props.onClick, undefined);
  assert.equal(header().props['data-expandable'], undefined);
  assert.equal(page.toggle('browser'), undefined);
  assert.equal(page.tools('browser'), undefined);
  assert.equal(page.row('browser').props['data-open'], undefined);
  // The switch writes without opening anything, and the detail action does not toggle it.
  await page.control('browser').props.onClick();
  assert.deepEqual(app.mcpWrites, [{ id: 'include:browser', enabled: false }]);
  assert.equal(page.summary('browser'), undefined, 'A closed server hides its count.');
  page.detail('browser').props.onClick({ stopPropagation() {} });
  assert.deepEqual(app.mcpWrites, [{ id: 'include:browser', enabled: false }], 'Opening details never changes the server.');
  assert.ok(page.render().find(node => node.type === 'native-modal-fixture'));
  await page.control('browser').props.onClick();
  assert.equal(page.summary('browser').props.children[0], 'mcpToolCount');
  // Tool-name search still finds the server; it never expands anything.
  const reads = app.mcpReads.length;
  page.search().props.onChange({ target: { value: 'GENERATION_RESULT' } });
  assert.ok(page.row('browser'));
  assert.equal(page.row('other'), undefined);
  assert.equal(page.toggle('browser'), undefined);
  page.search().props.onChange({ target: { value: 'search' } });
  assert.ok(page.row('other'));
  assert.equal(page.row('browser'), undefined);
  page.search().props.onChange({ target: { value: '' } });
  page.group('user').props.onClick();
  assert.equal(page.row('browser'), undefined);
  page.group('user').props.onClick();
  assert.ok(page.row('browser'));
  assert.equal(app.mcpReads.length, reads);
  await app.reloadMcp();
  assert.ok(page.summary('browser'));
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
  const descriptors = app.rpcDescriptors.filter(item => ['listMcpServers', 'readMcpServer', 'setMcpServerEnabled'].includes(item.method));
  assert.deepEqual(Array.from(descriptors.find(item => item.method === 'readMcpServer').parameters, item => item.name), ['id']);
  assert.deepEqual(Array.from(descriptors.find(item => item.method === 'readMcpServer').parameters, item => item.codec.typeSymbol), ['string']);
  assert.deepEqual(Array.from(descriptors.find(item => item.method === 'listMcpServers').parameters, item => item.name), []);
  assert.deepEqual(Array.from(descriptors.find(item => item.method === 'setMcpServerEnabled').parameters, item => item.name), ['id', 'enabled']);
  for (const descriptor of descriptors.filter(item => item.method !== 'readMcpServer')) {
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

function textOf(node) {
  if (node === null || node === undefined || node === false) return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(textOf);
  if (typeof node !== 'object' || node.props?.hidden) return [];
  return textOf(node.props?.children);
}

test('MCP detail reads one entry on demand, lists only declared fields and never changes the server', async () => {
  // Exactly the fields `dsh-mcp-client@0.2.2-rc.1` accepts, minus the ones this entry left out.
  const config = {
    transport: 'stdio', serverName: 'browser', command: 'npx', args: ['-y', '@example/browser', '--path', '/work/my project'], cwd: '/work/tools',
    envKeys: ['BROWSER_TOKEN'], headerKeys: [], expressions: [], urlQueryHidden: false,
    reconnect: { enabled: true, initialDelayMs: 500, maxDelayMs: 30000, maxAttempts: 10 },
  };
  const app = await mount({ featureIds: ['mcp'], mcpCatalog: mcpCatalogFixture({ servers: [mcpFixture({ tools: ['navigate', 'snapshot'] })] }), mcpDetail: config });
  const page = await mcpPage(app);
  assert.equal(page.dialog(), undefined);
  assert.equal(app.mcpDetailReads.length, 0, 'The page must not read configuration until asked.');
  page.detail('browser').props.onClick({ stopPropagation() {} });
  await new Promise(resolve => setImmediate(resolve));
  const dialog = () => page.render().find(node => node.type === 'native-modal-fixture');
  assert.ok(dialog());
  assert.equal(dialog().props.title, 'mcpDetailTitle');
  assert.equal(dialog().props.description, 'browser');
  assert.equal(dialog().props.open, true);
  const text = textOf(dialog());
  for (const expected of ['mcpDetailTransport', 'mcpLocalType', 'mcpDetailRuntime', 'mcpRuntimeActive',
    'npx', 'mcpDetailArgs', '-y @example/browser --path "/work/my project"', '/work/tools', 'BROWSER_TOKEN', 'mcpDetailOn · mcpDetailReconnectInitial: 500 ms · mcpDetailReconnectMax: 30000 ms · mcpDetailReconnectAttempts: 10']) {
    assert.ok(text.includes(expected), `Expected the dialog to show ${expected}`);
  }
  // The dialog keeps transport and runtime, but omits duplicate source/switch labels and unsupported fields.
  for (const absent of ['mcpDetailSource', 'mcpDetailEnabled',
    'mcpDetailToolTimeout', 'mcpDetailStartupTimeout', 'mcpDetailCloseTimeout',
    'mcpDetailExpandTemplates', 'mcpDetailFailOnStartup', 'mcpDetailMaxInstruction']) {
    assert.ok(!text.includes(absent), `The dialog must not list ${absent}`);
  }
  assert.equal(descendants(dialog()).filter(node => node.type === 'li').length, 2, 'Tool names are listed inside the dialog.');
  assert.deepEqual(app.mcpDetailReads, [{ id: 'include:browser' }]);
  assert.deepEqual(app.mcpWrites, []);
  assert.equal(page.control('browser').props['aria-checked'], true);
  // Closing is a view change only; the dialog unmounts and the row stays intact.
  const close = descendants(dialog()).find(node => node.props['data-native-button']);
  close.props.onClick();
  assert.equal(page.dialog(), undefined);
  assert.ok(page.row('browser'));
  assert.deepEqual(app.mcpWrites, []);
  app.unmount();
});

test('MCP detail preserves partial reconnect fields through the codec and renders no invented defaults', async () => {
  for (const [reconnect, expected] of [
    [{ enabled: true }, 'mcpDetailOn'],
    [{ maxAttempts: 3 }, 'mcpDetailReconnectAttempts: 3'],
    [{ enabled: false, initialDelayMs: 750 }, 'mcpDetailReconnectOff · mcpDetailReconnectInitial: 750 ms'],
    [{ maxDelayMs: 9000 }, 'mcpDetailReconnectMax: 9000 ms'],
    [{}, undefined],
  ]) {
    const config = { transport: 'stdio', envKeys: [], headerKeys: [], expressions: [], urlQueryHidden: false, reconnect };
    const app = await mount({ featureIds: ['mcp'], mcpDetail: config });
    const descriptor = app.rpcDescriptors.find(row => row.method === 'readMcpServer');
    const codec = descriptor.result.create();
    const parsed = codec.parse({ server: mcpFixture(), config: { ...config, reconnect: { ...reconnect, private: 'secret' } } });
    assert.deepEqual(JSON.parse(JSON.stringify(parsed.config.reconnect)), reconnect);
    for (const invalid of [{ enabled: 'true' }, { maxAttempts: '3' }, { maxDelayMs: Infinity }]) {
      assert.throws(() => codec.parse({ server: mcpFixture(), config: { ...config, reconnect: invalid } }), /Invalid MCP reconnect/);
    }
    const page = await mcpPage(app);
    page.detail('browser').props.onClick({ stopPropagation() {} });
    await new Promise(resolve => setImmediate(resolve));
    const row = descendants(page.dialog()).find(node => node.props.className === 'power-dsh-mcp-detail-row'
      && textOf(node).includes('mcpDetailReconnect'));
    if (expected === undefined) assert.equal(row, undefined);
    else assert.deepEqual(textOf(row), ['mcpDetailReconnect', expected]);
    app.unmount();
  }
});

test('MCP detail shows the same fields whether the server is open or closed', async () => {
  // One app per case: the fixture reuses hook slots across renders of one component.
  const read = async (language, servers, name) => {
    const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers }), mcpDetail: {
      transport: 'stdio', envKeys: [], headerKeys: [], expressions: [], urlQueryHidden: false } });
    const page = await mcpPage(app, language);
    const group = page.group('builtin');
    if (group && group.props['aria-expanded'] === false) group.props.onClick();
    page.detail(name).props.onClick({ stopPropagation() {} });
    await new Promise(resolve => setImmediate(resolve));
    const dialog = page.render().find(node => node.type === 'native-modal-fixture');
    const rows = descendants(dialog).filter(node => node.props.className === 'power-dsh-mcp-detail-row')
      .map(node => node.props.children[0].props.children[0]);
    const text = textOf(dialog);
    app.unmount();
    return { rows, text };
  };
  const labels = {
    en: { runtime: 'Runtime', running: 'Running', off: 'Disabled', noTools: 'No loaded tools', noAvailable: 'No available tools' },
    zh: { runtime: '运行状态', running: '运行中', off: '已关闭', noTools: '暂无已加载工具', noAvailable: '暂无可用工具' },
  };
  for (const language of ['en', 'zh']) {
    const label = labels[language];
    const opened = await read(language, [mcpFixture({ id: 'include:on', name: 'on-server', tools: ['a'] })], 'on-server');
    const closed = await read(language, [mcpFixture({ id: 'include:off', name: 'off-server', enabled: false, tools: ['a'], runtimeState: 'active' })], 'off-server');
    // The field set is identical: opening a server must not change what the dialog lists.
    assert.deepEqual(closed.rows, opened.rows);
    assert.ok(opened.rows.includes(label.runtime));
    // Only the runtime value differs: a closed server reads as closed, not as running.
    assert.ok(opened.text.includes(label.running));
    assert.ok(closed.text.includes(label.off));
    assert.ok(!closed.text.includes(label.running), 'A closed server never reads as running.');
    // The tool section stays, with the wording that fits the switch.
    assert.ok(opened.text.includes(label.noTools) || opened.text.includes('a'));
    assert.ok(closed.text.includes(label.noAvailable), 'A closed server has no available tools.');
    assert.ok(!closed.text.includes('a'), 'Its cached tools are not listed.');
  }
});

test('MCP action row keeps the detail button flush right with or without a tool count', async () => {
  const app = await mount({ mcpCatalog: mcpCatalogFixture({ servers: [
    mcpFixture({ id: 'include:with', name: 'with-tools', tools: ['a', 'b'] }),
    mcpFixture({ id: 'include:without', name: 'no-tools', tools: [] }),
    mcpFixture({ id: 'include:off', name: 'off-server', tools: ['cached'], enabled: false, runtimeState: 'disabled' }),
  ] }) });
  const page = await mcpPage(app);
  const actions = name => page.row(name).props.children.find(node => node?.props?.className === 'power-dsh-skill-card-content')
    .props.children.filter(Boolean).at(-1);
  const parts = name => actions(name).props.children.filter(Boolean)
    .map(node => node.props.className === 'power-dsh-mcp-tools-summary' ? 'count' : node.props['data-detail'] ? 'action' : 'other');
  // The button is always the last child of the row, so it stays flush right.
  assert.deepEqual(parts('with-tools'), ['count', 'action']);
  assert.deepEqual(parts('no-tools'), ['action'], 'Without a count the row holds only the button.');
  assert.deepEqual(parts('off-server'), ['action'], 'A closed server hides its cached count.');
  assert.equal(actions('with-tools').props.children.filter(Boolean).at(-1).props['data-detail'], 'include:with');
  assert.equal(actions('no-tools').props.children.filter(Boolean).at(-1).props['data-detail'], 'include:without');
  assert.equal(page.summary('no-tools'), undefined);
  assert.equal(page.summary('off-server'), undefined);
  for (const name of ['with-tools', 'no-tools', 'off-server']) assert.ok(page.detail(name));
  app.unmount();
});

test('MCP detail never renders a blank row when an older Host projects empty strings', async () => {
  // A Host built before this projection returns '' for fields the entry never declared.
  const app = await mount({
    mcpCatalog: mcpCatalogFixture({ servers: [mcpFixture({ tools: ['web_search'] })] }),
    mcpDetail: { transport: 'stdio', serverName: '', command: '', args: [], cwd: '', url: '',
      envKeys: [], headerKeys: [], expressions: [], urlQueryHidden: false },
  });
  const page = await mcpPage(app);
  page.detail('browser').props.onClick({ stopPropagation() {} });
  await new Promise(resolve => setImmediate(resolve));
  const dialog = page.render().find(node => node.type === 'native-modal-fixture');
  const text = textOf(dialog);
  for (const absent of ['mcpDetailCommand', 'mcpDetailCwd', 'mcpDetailUrl', 'mcpDetailEnv', 'mcpDetailHeaders', 'mcpDetailReconnect']) {
    assert.ok(!text.includes(absent), `An empty value must not produce the ${absent} row`);
  }
  assert.ok(text.includes('mcpDetailArgs'));
  assert.ok(text.includes('mcpDetailNone'), 'An empty argument list explicitly displays None.');
  // Empty labels would show as a bare field name with nothing beside it.
  const rows = descendants(dialog).filter(node => node.props.className === 'power-dsh-mcp-detail-row');
  for (const row of rows) {
    const value = descendants(row).find(node => node.props.className === 'power-dsh-mcp-detail-value');
    assert.ok(value && textOf(value).some(entry => entry.trim() !== ''), 'Every rendered row carries a value.');
  }
  assert.ok(text.includes('mcpTools'), 'Only the tool section remains for an entry with no declared fields.');
  app.unmount();
});

test('an old backend hiding argument contents cannot present them as absent', async () => {
  const app = await mount({ featureIds: ['mcp'],
    mcpCatalog: mcpCatalogFixture({ servers: [mcpFixture()] }),
    mcpDetail: { transport: 'stdio', argsHidden: true, envKeys: [], headerKeys: [], expressions: [], urlQueryHidden: false },
  });
  const page = await mcpPage(app);
  page.detail('browser').props.onClick({ stopPropagation() {} });
  await new Promise(resolve => setImmediate(resolve));
  const text = textOf(page.dialog());
  assert.ok(text.includes('mcpDetailOutdated'), 'The old response requires a backend restart.');
  assert.ok(!text.includes('mcpDetailNone'), 'Hidden arguments do not mean an empty list.');
  app.unmount();
});

test('unknown and expression-backed argument contents are never labelled None', async () => {
  for (const expressions of [[], ['args']]) {
    const app = await mount({ featureIds: ['mcp'],
      mcpCatalog: mcpCatalogFixture({ servers: [mcpFixture()] }),
      mcpDetail: { transport: 'stdio', envKeys: [], headerKeys: [], expressions, urlQueryHidden: false },
    });
    const page = await mcpPage(app);
    page.detail('browser').props.onClick({ stopPropagation() {} });
    await new Promise(resolve => setImmediate(resolve));
    const text = textOf(page.dialog());
    assert.ok(text.includes('mcpDetailUnknown'));
    assert.ok(!text.includes('mcpDetailNone'));
    app.unmount();
  }
});

test('MCP detail falls back to declared transport and lists tools for an open server', async () => {
  const app = await mount({
    mcpCatalog: mcpCatalogFixture({ servers: [mcpFixture({ transport: 'unknown', tools: ['web_search'] })] }),
    mcpDetail: { transport: 'streamable-http', envKeys: [], headerKeys: [], expressions: [], urlQueryHidden: false,
      url: 'https://legacy:fixture-password@mcp.example.com/mcp/fixture-path?key=fixture-query#fixture-fragment',
      args: ['--api-key', 'fixture-argument'] },
  });
  const page = await mcpPage(app);
  page.detail('browser').props.onClick({ stopPropagation() {} });
  await new Promise(resolve => setImmediate(resolve));
  const dialog = page.render().find(node => node.type === 'native-modal-fixture');
  const text = textOf(dialog);
  assert.ok(text.includes('https://mcp.example.com'));
  assert.ok(text.includes('mcpDetailUrlHiddenHint'));
  assert.ok(text.includes('--api-key [REDACTED]'));
  assert.ok(!text.includes('mcpDetailArgsHidden'));
  assert.ok(!text.some(value => value.includes('fixture-') || value.includes('legacy:')));
  assert.ok(text.includes('mcpDetailTransport'));
  assert.ok(text.includes('mcpHttpType'), 'Declared transport fills a missing catalog transport.');
  assert.ok(text.includes('mcpDetailRuntime'));
  for (const absent of ['mcpDetailEnabled', 'mcpDetailSource']) {
    assert.ok(!text.includes(absent), `The dialog must not repeat ${absent}`);
  }
  assert.ok(text.includes('web_search'));
  assert.deepEqual(app.mcpWrites, []);
  app.unmount();
});

test('MCP detail reports an unreadable configuration and a stale entry without inventing values', async () => {
  const app = await mount({
    mcpCatalog: mcpCatalogFixture({ servers: [mcpFixture()] }),
    mcpDetailReply: id => id === 'include:browser' ? { ok: true, value: { server: mcpFixture(), config: null } } : { ok: true, value: null },
  });
  const page = await mcpPage(app);
  const dialog = () => page.render().find(node => node.type === 'native-modal-fixture');
  page.detail('browser').props.onClick({ stopPropagation() {} });
  await new Promise(resolve => setImmediate(resolve));
  const text = textOf(dialog());
  assert.ok(text.includes('mcpTools'), 'The dialog still shows the tool section.');
  assert.ok(!text.some(value => value.includes('mcpDetailCommand')), 'No configuration row is invented.');
  assert.ok(text.includes('navigate'));
  app.unmount();

  const missing = await mount({
    featureIds: ['mcp'],
    mcpCatalog: mcpCatalogFixture({ servers: [mcpFixture()] }),
    mcpDetailReply: () => ({ ok: true, value: null }),
  });
  const missingPage = await mcpPage(missing);
  missingPage.detail('browser').props.onClick({ stopPropagation() {} });
  await new Promise(resolve => setImmediate(resolve));
  const missingDialog = () => missingPage.render().find(node => node.type === 'native-modal-fixture');
  assert.ok(descendants(missingDialog()).some(node => node.props.children.includes('mcpDetailMissing')));
  const missingText = textOf(missingDialog());
  for (const stale of ['navigate', 'mcpTools', 'mcpDetailTransport', 'mcpDetailRuntime']) {
    assert.ok(!missingText.includes(stale), `A missing server must not display stale ${stale}.`);
  }
  assert.equal(missingDialog().props.description, 'browser', 'The trigger name still identifies the missing server.');
  assert.deepEqual(missing.mcpWrites, []);
  missing.unmount();
});

test('MCP detail failure stays inside the dialog and retries the same entry', async () => {
  let attempt = 0;
  const app = await mount({
    mcpCatalog: mcpCatalogFixture({ servers: [mcpFixture()] }),
    mcpDetailReply: () => {
      attempt++;
      return attempt === 1 ? { ok: false, error: { message: 'mcpMetadataLoadFailed' } } : { ok: true, value: { server: mcpFixture(), config: null } };
    },
  });
  const page = await mcpPage(app);
  page.detail('browser').props.onClick({ stopPropagation() {} });
  await new Promise(resolve => setImmediate(resolve));
  const dialog = () => page.render().find(node => node.type === 'native-modal-fixture');
  const failure = descendants(dialog()).find(node => node.props['data-error-code'] === 'PD-MCP-DETAIL');
  assert.ok(failure);
  assert.ok(failure.props.children.includes('mcpMetadataLoadFailed'));
  const retry = descendants(failure).find(node => node.props['data-native-button'] && node.props.children.includes('retry'));
  retry.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.mcpDetailReads.length, 2);
  assert.ok(!descendants(dialog()).some(node => node.props['data-error-code'] === 'PD-MCP-DETAIL'));
  assert.deepEqual(app.mcpWrites, []);
  app.unmount();
});

test('MCP detail ignores a late answer after closing and follows the latest request', async () => {
  const pending = [];
  const app = await mount({
    mcpCatalog: mcpCatalogFixture({ servers: [mcpFixture(), mcpFixture({ id: 'include:files', name: 'files' })] }),
    mcpDetailReply: id => new Promise(resolve => pending.push({ id, resolve })),
  });
  const page = await mcpPage(app);
  page.detail('browser').props.onClick({ stopPropagation() {} });
  const close = page.render().find(node => node.type === 'native-modal-fixture');
  assert.ok(close);
  const loading = descendants(close).find(node => node.props.className === 'power-dsh-loading');
  assert.equal(loading.props.role, 'status');
  assert.equal(loading.props['data-compact'], undefined);
  assert.ok(descendants(loading).some(node => node.props.children.includes('mcpDetailLoading')));
  assert.ok(descendants(loading).some(node => node.type === 'native-state-dot-fixture' && node.props.state === 'ongoing'));
  // Closing before the answer arrives must discard that answer.
  const buttons = descendants(close).filter(node => node.props['data-native-button']);
  buttons.at(-1).props.onClick();
  pending[0].resolve({ ok: true, value: { server: mcpFixture(), config: null } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(page.dialog(), undefined);
  // A second entry replaces the first request instead of interleaving answers.
  page.detail('files').props.onClick({ stopPropagation() {} });
  page.detail('browser').props.onClick({ stopPropagation() {} });
  assert.deepEqual(pending.map(entry => entry.id), ['include:browser', 'include:files', 'include:browser']);
  pending[1].resolve({ ok: true, value: { server: mcpFixture({ id: 'include:files', name: 'files' }), config: null } });
  await new Promise(resolve => setImmediate(resolve));
  pending[2].resolve({ ok: true, value: { server: mcpFixture(), config: null } });
  await new Promise(resolve => setImmediate(resolve));
  const dialog = () => page.render().find(node => node.type === 'native-modal-fixture');
  assert.equal(dialog().props.description, 'browser');
  assert.deepEqual(app.mcpWrites, []);
  app.unmount();
});
