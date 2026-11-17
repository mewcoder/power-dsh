import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mount, descendants } from '../../../../tests/helpers/client-fixture.mjs';
import { LOCAL_FETCH } from '../chain.ts';

const flush = () => new Promise(resolve => setImmediate(resolve));
const slot = (id, provider = 'tavily') => ({ id, provider, keyUrl: 'https://example.com/keys',
  configured: true, hasKey: true, writable: true });
const text = node => [node?.props?.children].flat(Infinity).filter(value => typeof value === 'string').join('');
const button = (view, label) => descendants(view).find(node => node.type === 'button' && text(node) === label);
const input = view => descendants(view).find(node => node.type === 'input');

async function fixture(context, overrides = {}, mountOptions = {}) {
  const app = await mount({ featureIds: ['web-search'], rpcError: 'Test request failed', ...mountOptions });
  context.after(() => app.unmount());
  app.set({ webSearchEnabled: true });
  const wrapped = app.entries.get('settings.section:power-dsh-web-search').component({
    t: key => app.dictionaries.get('en')?.[key] ?? key,
  });
  let snapshot = { status: 'ready', error: '', value: { enabled: true, available: true,
    slots: [slot('search-1'), slot('fetch-1')], search: { ids: ['search-1'] }, fetch: { ids: ['fetch-1'] } } };
  Object.assign(wrapped.props, {
    catalogSource: { getSnapshot: () => snapshot, subscribe: () => () => {} },
    loadCatalog: async () => {}, addSlot: async () => {}, removeSlot: async () => {},
    saveKey: async () => {}, reorderChain: async () => {},
    readQuota: async () => ({ status: 'unsupported' }), ...overrides,
  });
  return { app, render: () => app.renderComponent(wrapped),
    setSnapshot: next => { snapshot = next; } };
}

test('web search keeps a failed key draft open and prevents cancel during submission', async context => {
  let rejectSave;
  const pending = new Promise((_resolve, reject) => { rejectSave = reject; });
  const { render } = await fixture(context, { saveKey: () => pending });
  button(render(), 'Edit').props.onClick();
  input(render()).props.onChange({ target: { value: 'draft-key' } });
  button(render(), 'Save').props.onClick();
  assert.equal(button(render(), 'Cancel').props.disabled, true);
  assert.equal(input(render()).props.disabled, true);
  rejectSave(new Error('Could not save the key'));
  await flush();
  assert.equal(input(render()).props.value, 'draft-key');
  assert.equal(input(render()).props['aria-invalid'], true);
  assert.match(input(render()).props['aria-describedby'], /-error$/);
  assert.ok(descendants(render()).some(node => node.props['data-error-code'] === 'PD-WEBSEARCH-SAVE'));
  button(render(), 'Cancel').props.onClick();
  button(render(), 'Edit').props.onClick();
  assert.equal(input(render()).props.value, '');
});

test('web search reports add and remove failures at their visible controls', async context => {
  const { render } = await fixture(context, {
    addSlot: async () => { throw new Error('Could not add provider'); },
    removeSlot: async () => { throw new Error('Could not remove provider'); },
  });
  const menu = descendants(render()).find(node => node.type === 'native-menu-fixture');
  menu.props.onSelect('tavily');
  await flush();
  assert.ok(descendants(render()).some(node => node.props['data-error-code'] === 'PD-WEBSEARCH-SAVE'));
  button(render(), 'Remove').props.onClick();
  await flush();
  assert.equal(input(render()), undefined);
  assert.ok(descendants(render()).some(node => node.props['data-error-code'] === 'PD-WEBSEARCH-SAVE'));
});

test('web search retains the catalog but blocks writes when refresh fails', async context => {
  const { render, setSnapshot } = await fixture(context);
  setSnapshot({ status: 'error', error: 'Could not load', value: { enabled: true, available: true,
    slots: [slot('search-1')], search: { ids: ['search-1'] }, fetch: { ids: [] } } });
  assert.equal(button(render(), 'Edit').props.disabled, true);
  assert.equal(button(render(), 'Add').props.disabled, true);
  assert.ok(descendants(render()).some(node => node.props['data-slot'] === 'search-1'));
});

test('configured instances read and display actual quota units while refresh failures keep the last value and editors usable', async context => {
  const calls = [];
  let failing = false;
  const { render } = await fixture(context, { readQuota: async id => {
    calls.push(id);
    return failing ? { status: 'error', durationMs: 2, diagnostic: { provider: 'tavily', stage: 'response',
      reason: 'rate-limit', auth: 'api-key', httpStatus: 429, observedAt: new Date().toISOString() } }
      : { status: 'ready', observedAt: new Date().toISOString(), data: id === 'search-1'
        ? { kind: 'credits', scope: 'account', used: 80, limit: 1000, remaining: 920, paygoRemaining: 26 }
        : { kind: 'balance', currency: 'USD', balance: '-0.012345' } };
  } });
  render();
  await flush();
  const textContent = descendants(render()).map(text).join(' ');
  assert.match(textContent, /Account · Used 80 \/ 1000 credits · 26 pay-as-you-go credits left/);
  assert.match(textContent, /Balance USD -0\.012345/);
  assert.deepEqual(calls, ['search-1', 'fetch-1']);
  failing = true;
  const refresh = () => descendants(render()).find(node => node.props['aria-label'] === 'Refresh: Tavily #1');
  refresh().props.onClick();
  assert.equal(refresh().props.disabled, true);
  await flush();
  assert.match(descendants(render()).map(text).join(' '), /Used 80 \/ 1000 credits.*Last read/);
  assert.ok(descendants(render()).some(node => node.props['data-error-code'] === 'PD-WEBSEARCH-QUOTA'));
  assert.equal(button(render(), 'Edit').props.disabled, false);
});

test('missing keys never read quotas and late reads cannot overwrite a changed credential state', async context => {
  const pending = [];
  const { render, setSnapshot } = await fixture(context, { readQuota: id => new Promise(resolve => { pending.push({ id, resolve }); }) });
  render();
  assert.equal(pending.length, 2);
  setSnapshot({ status: 'ready', error: '', value: { enabled: true, available: true,
    slots: [{ ...slot('search-1'), configured: false, hasKey: false }], search: { ids: ['search-1'] }, fetch: { ids: [] } } });
  render();
  for (const request of pending) request.resolve({ status: 'ready', observedAt: new Date().toISOString(),
    data: { kind: 'credits', scope: 'key', used: 999, limit: 1000, remaining: 1 } });
  await flush();
  assert.equal(pending.length, 2);
  assert.doesNotMatch(descendants(render()).filter(node => node.type !== 'style').map(text).join(' '), /999|credits|Refresh/);
});

test('both add menus offer Exa, its editor uses the official key link, and unsupported quotas have no refresh row', async context => {
  const { render, setSnapshot } = await fixture(context);
  const menus = descendants(render()).filter(node => node.type === 'native-menu-fixture');
  assert.equal(menus.length, 2);
  assert.ok(menus.every(menu => menu.props.items.some(item => item.id === 'exa' && item.label === 'Exa')));
  setSnapshot({ status: 'ready', error: '', value: { enabled: true, available: true,
    slots: [{ ...slot('exa-1', 'exa'), keyUrl: 'https://dashboard.exa.ai/api-keys' }],
    search: { ids: ['exa-1'] }, fetch: { ids: [] } } });
  render();
  await flush();
  button(render(), 'Edit').props.onClick();
  const keyLink = descendants(render()).find(node => node.type === 'a' && text(node) === 'Get a key');
  assert.equal(keyLink.props.href, 'https://dashboard.exa.ai/api-keys');
  assert.equal(keyLink.props.rel, 'noopener noreferrer');
  assert.ok(descendants(render()).some(node => node.props['aria-label'] === 'Test search: Exa #1'));
  assert.equal(descendants(render()).some(node => node.props.className === 'power-dsh-web-quota'), false);
  assert.equal(descendants(render()).some(node => node.props['aria-label'] === 'Refresh: Exa #1'), false);
});

test('a successful key replacement requests its new quota after clearing the old value', async context => {
  let replaced = false;
  const { render } = await fixture(context, { saveKey: async () => { replaced = true; }, readQuota: async () => ({
    status: 'ready', observedAt: new Date().toISOString(),
    data: { kind: 'credits', scope: 'key', used: replaced ? 12 : 7, limit: 100, remaining: replaced ? 88 : 93 },
  }) });
  render();
  await flush();
  button(render(), 'Edit').props.onClick();
  input(render()).props.onChange({ target: { value: 'new-key' } });
  button(render(), 'Save').props.onClick();
  await flush();
  const searchRow = descendants(render()).find(node => node.props['data-slot'] === 'search-1');
  assert.match(descendants(searchRow).map(text).join(' '), /Used 12 \/ 100 credits/);
});

test('web fetch editor announces its actual position and clears a successful draft', async context => {
  const writes = [];
  const { render } = await fixture(context, { saveKey: async (...args) => { writes.push(args); } });
  const edit = descendants(render()).find(node => node.props['aria-label'] === 'Edit: Tavily #2');
  edit.props.onClick();
  input(render()).props.onChange({ target: { value: 'new-key' } });
  button(render(), 'Save').props.onClick();
  await flush();
  assert.deepEqual(writes, [['fetch-1', 'new-key']]);
  assert.equal(input(render()), undefined);
  descendants(render()).find(node => node.props['aria-label'] === 'Edit: Tavily #2').props.onClick();
  assert.equal(input(render()).props.value, '');
});

test('row test icons target their own capability without opening or submitting the editor', async context => {
  const probes = [];
  const { render } = await fixture(context, { probeBackend: async (...args) => { probes.push(args); } });
  const searchProbe = descendants(render()).find(node => node.props['aria-label'] === 'Test search: Tavily #1');
  const fetchProbe = descendants(render()).find(node => node.props['aria-label'] === 'Test fetch: Tavily #2');
  assert.equal(searchProbe.props.disabled, false);
  searchProbe.props.onClick();
  fetchProbe.props.onClick();
  assert.deepEqual(probes, [['search', 'search-1'], ['fetch', 'fetch-1']]);
  assert.equal(input(render()), undefined);
  button(render(), 'Edit').props.onClick();
  assert.equal(descendants(render()).filter(node => node.props['aria-label'] === 'Test search: Tavily #1').length, 1);
});

test('row test icons show busy state and preserve failure feedback with the editor collapsed', async context => {
  const { render } = await fixture(context);
  const probe = () => descendants(render()).find(node => node.props['aria-label'] === 'Test search: Tavily #1');
  probe().props.onClick();
  assert.equal(probe().props['aria-busy'], true);
  assert.equal(probe().props.disabled, true);
  assert.ok(descendants(probe()).some(node => node.type === 'native-state-dot-fixture'));
  await flush();
  assert.equal(probe().props.disabled, false);
  assert.equal(input(render()), undefined);
  assert.ok(descendants(render()).some(node => node.props['data-error-code'] === 'PD-WEBSEARCH-PROBE'));
  assert.match(probe().props['aria-describedby'], /probe-result$/);
});

for (const ok of [true, false]) {
  test(`a completed ${ok ? 'successful' : 'failed'} probe disappears after five seconds and older timers cannot clear a newer result`, async context => {
    const { app, render } = await fixture(context, {}, {
      rpcReply: { ok: true, value: { ok, resultCount: ok ? 5 : 0, durationMs: 20, message: ok ? '' : 'Test failed' } },
    });
    const probe = () => descendants(render()).find(node => node.props['aria-label'] === 'Test search: Tavily #1');
    probe().props.onClick();
    assert.equal([...app.timers.values()].filter(timer => timer.ms === 5000).length, 0);
    await flush();
    assert.match(probe().props['aria-describedby'], /probe-result$/);
    const older = [...app.timers.values()].find(timer => timer.ms === 5000);
    probe().props.onClick();
    await flush();
    older.fn();
    assert.match(probe().props['aria-describedby'], /probe-result$/);
    const current = [...app.timers.values()].find(timer => timer.ms === 5000);
    current.fn();
    assert.equal(probe().props['aria-describedby'], undefined);
    assert.equal(descendants(render()).some(node => node.props['data-error-code'] === 'PD-WEBSEARCH-PROBE'), false);
  });
}

test('interacting with failed probe details stops dismissal and unload clears the next timer', async context => {
  const { app, render } = await fixture(context);
  const probe = () => descendants(render()).find(node => node.props['aria-label'] === 'Test search: Tavily #1');
  probe().props.onClick();
  await flush();
  const feedback = descendants(render()).find(node => node.props.className === 'power-dsh-web-probe-result');
  feedback.props.onClickCapture();
  assert.equal([...app.timers.values()].filter(timer => timer.ms === 5000).length, 0);
  assert.match(probe().props['aria-describedby'], /probe-result$/);
  probe().props.onClick();
  await flush();
  assert.equal([...app.timers.values()].filter(timer => timer.ms === 5000).length, 1);
  app.unmount();
  assert.equal([...app.timers.values()].filter(timer => timer.ms === 5000).length, 0);
});

test('unconfigured rows expose their status through the dot and disable probing', async context => {
  const { render, setSnapshot } = await fixture(context);
  setSnapshot({ status: 'ready', error: '', value: { enabled: true, available: true,
    slots: [{ ...slot('search-1'), configured: false, hasKey: false }], search: { ids: ['search-1'] }, fetch: { ids: [] } } });
  const dot = descendants(render()).find(node => node.props.role === 'img' && node.props['data-state'] === 'missing');
  assert.equal(dot.props['aria-label'], 'Not configured');
  assert.equal(dot.props.title, 'Not configured');
  assert.equal(descendants(render()).some(node => text(node) === 'Not configured'), false);
  assert.equal(descendants(render()).find(node => node.props['aria-label'] === 'Test search: Tavily #1').props.disabled, true);
});

test('a failed addition retains the open editor and its draft', async context => {
  const { render } = await fixture(context, { addSlot: async () => { throw new Error('Could not add provider'); } });
  button(render(), 'Edit').props.onClick();
  input(render()).props.onChange({ target: { value: 'keep-draft' } });
  descendants(render()).find(node => node.type === 'native-menu-fixture').props.onSelect('tavily');
  await flush();
  assert.equal(input(render()).props.value, 'keep-draft');
  assert.ok(descendants(render()).some(node => node.props['data-error-code'] === 'PD-WEBSEARCH-SAVE'));
});

for (const capability of ['search', 'fetch']) {
  test(`adding a ${capability} instance opens its key editor after the addition completes`, async context => {
    let finishAdd;
    const pending = new Promise(resolve => { finishAdd = resolve; });
    const { render, setSnapshot } = await fixture(context, { addSlot: () => pending });
    button(render(), 'Edit').props.onClick();
    input(render()).props.onChange({ target: { value: 'keep-draft' } });
    const menus = descendants(render()).filter(node => node.type === 'native-menu-fixture');
    menus[capability === 'search' ? 0 : 1].props.onSelect('tavily');
    assert.equal(input(render()).props.value, 'keep-draft');
    const added = { ...slot('new-instance'), configured: false, hasKey: false };
    setSnapshot({ status: 'ready', error: '', value: { enabled: true, available: true,
      slots: [slot('search-1'), slot('fetch-1'), added],
      search: { ids: capability === 'search' ? ['search-1', added.id] : ['search-1'] },
      fetch: { ids: capability === 'fetch' ? ['fetch-1', added.id] : ['fetch-1'] } } });
    finishAdd(added.id);
    await flush();
    const row = descendants(render()).find(node => node.props['data-slot'] === added.id);
    assert.equal(input(row).props.value, '');
    assert.equal(descendants(render()).filter(node => node.type === 'input').length, 1);
    assert.equal(button(row, 'Save').props.disabled, true);
    assert.ok(descendants(row).some(node => node.type === 'a' && text(node) === 'Get a key'));
  });
}

test('local fetch is sortable without credential actions and reports failed saves on its row', async context => {
  const writes = [];
  const { render, setSnapshot } = await fixture(context, { reorderChain: async (...args) => {
    writes.push(args); throw new Error('Could not save order');
  } });
  const local = () => descendants(render()).find(node => node.props['data-local']);
  assert.equal(local().props.draggable, true);
  assert.equal(descendants(local()).some(node => node.type === 'button' || node.type === 'input'), false);
  assert.match(descendants(local()).map(text).join(' '), /#1/);
  local().props.onKeyDown({ altKey: true, key: 'ArrowDown', preventDefault() {} });
  await flush();
  assert.deepEqual(structuredClone(writes), [['fetch', ['fetch-1', LOCAL_FETCH.id]]]);
  assert.ok(descendants(local()).some(node => node.props['data-error-code'] === 'PD-WEBSEARCH-SAVE'));
  setSnapshot({ status: 'ready', error: '', value: { enabled: true, available: true,
    slots: [slot('fetch-1')], search: { ids: [] }, fetch: { ids: ['fetch-1', LOCAL_FETCH.id] } } });
  const rows = descendants(render()).filter(node => node.type === 'li' && node.props['data-capability'] === 'fetch');
  assert.deepEqual(rows.map(node => node.props['data-slot']), ['fetch-1', LOCAL_FETCH.id]);
  assert.match(descendants(local()).map(text).join(' '), /#2/);
  assert.ok(descendants(render()).some(node => node.props['aria-label'] === 'Test fetch: Tavily #1'));
});

test('dragging local below a remote persists the complete fetch order only', async context => {
  const writes = [];
  const { render } = await fixture(context, { reorderChain: async (...args) => { writes.push(args); } });
  const local = () => descendants(render()).find(node => node.props['data-local']);
  const remote = () => descendants(render()).find(node => node.props['data-slot'] === 'fetch-1');
  const dataTransfer = { effectAllowed: '', dropEffect: '', setData() {} };
  local().props.onDragStart({ dataTransfer, preventDefault() {} });
  remote().props.onDragOver({ dataTransfer, clientY: 25, preventDefault() {},
    currentTarget: { getBoundingClientRect: () => ({ top: 0, height: 30 }) } });
  assert.equal(remote().props['data-drop'], 'after');
  remote().props.onDrop({ preventDefault() {} });
  await flush();
  assert.deepEqual(structuredClone(writes), [['fetch', ['fetch-1', LOCAL_FETCH.id]]]);
});

test('unavailable settings block local keyboard and drag ordering', async context => {
  const writes = [];
  const { render, setSnapshot } = await fixture(context, { reorderChain: async (...args) => { writes.push(args); } });
  setSnapshot({ status: 'error', error: 'Could not load', value: { enabled: true, available: true,
    slots: [slot('fetch-1')], search: { ids: [] }, fetch: { ids: [LOCAL_FETCH.id, 'fetch-1'] } } });
  const local = descendants(render()).find(node => node.props['data-local']);
  assert.equal(local.props.draggable, false);
  local.props.onKeyDown({ altKey: true, key: 'ArrowDown', preventDefault() {} });
  let prevented = false;
  local.props.onDragStart({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  await flush();
  assert.deepEqual(writes, []);
});
