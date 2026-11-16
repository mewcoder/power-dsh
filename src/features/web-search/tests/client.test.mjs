import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mount, descendants } from '../../../../tests/helpers/client-fixture.mjs';

const flush = () => new Promise(resolve => setImmediate(resolve));
const slot = (id, provider = 'tavily') => ({ id, provider, keyUrl: 'https://example.com/keys',
  configured: true, hasKey: true, writable: true });
const text = node => [node?.props?.children].flat(Infinity).filter(value => typeof value === 'string').join('');
const button = (view, label) => descendants(view).find(node => node.type === 'button' && text(node) === label);
const input = view => descendants(view).find(node => node.type === 'input');

async function fixture(context, overrides = {}) {
  const app = await mount({ featureIds: ['web-search'], rpcError: 'Test request failed' });
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
    saveKey: async () => {}, reorderChain: async () => {}, ...overrides,
  });
  return { render: () => app.renderComponent(wrapped),
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
