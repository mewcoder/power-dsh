import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCleanupDialog } from '../cleanup-client.ts';

for (const available of [true, false]) {
  test(`cleanup loads model choices through scoped services, optional services available=${available}`, async () => {
    const current = { provider: 'configured', model: 'chat', reasoningEffort: 'max' };
    const fallback = { provider: 'configured', model: 'default' };
    const catalog = { models: [{ ...current, label: 'Chat' }, { ...fallback, label: 'Default' }], default: fallback };
    const updates = [];
    const dependencies = [];
    const releases = [];
    const snapshot = { status: 'ready', writable: true, value: { memoryEnabled: true } };
    let loads = 0;
    const sessions = { list: { getSnapshot: () => ({ byId: {
      removed: undefined, active: { retainedBy: { mainView: 1 } },
    } }) } };
    const ctx = {
      get sessions() { throw new Error('Cannot read sessions without declaring the dependency'); },
      inject(names, callback) {
        dependencies.push(...names);
        if (available) callback({
          sessions,
          modelDirectories: { directoryFor: () => ({
            load: async () => { loads++; }, store: { getSnapshot: () => ({ current }) },
          }) },
          effect: operation => releases.push(operation()),
        });
      },
      remote: { powerDsh: { memoryCleanupModels: async () => ({ ok: true, value: catalog }) } },
    };
    const runtime = {
      React: {
        useState: initial => [initial, value => updates.push(value)],
        useRef: initial => ({ current: initial }),
        useEffect: operation => releases.push(operation()),
      },
      h: (type, props, ...children) => ({ type, props, children }),
      useMounted: () => ({ current: true }),
      useSnapshot: () => snapshot,
      loadingFeedback: () => null,
    };
    const Dialog = createCleanupDialog(runtime, { ctx, source: { getSnapshot: () => snapshot } });
    Dialog({ scope: { id: 'global', cwd: '', complete: true, revision: '', entries: [] },
      t: key => key, onClose() {}, async onApplied() {} });
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(dependencies.includes('sessions'));
    assert.ok(dependencies.includes('modelDirectories'));
    assert.ok(updates.includes(catalog));
    assert.ok(updates.includes(JSON.stringify(['configured', available ? 'chat' : 'default'])));
    assert.equal(updates.includes('memoryCleanupFailed'), false);
    assert.equal(loads, available ? 1 : 0);
    for (const release of releases.reverse()) release?.();
  });
}
