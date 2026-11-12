import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { clientBundleUrl } from '../helpers/client-fixture.mjs';

const require = createRequire(import.meta.resolve('@deepseek-ai/dsh-tools'));
const { Context, Service } = await import(pathToFileURL(require.resolve('@deepseek-ai/cordis')).href);

test('Mod settings survive startup with real Cordis dependency enforcement, independently of connection availability', async t => {
  for (const connected of [true, false]) {
    for (const legacyId of ['dsh-x-mod', 'dsh-mod']) {
      await t.test(`${connected ? 'connection available' : 'connection unavailable'}; managed legacy ${legacyId}`, async t => {
        const root = new Context();
        t.after(() => root.fiber.dispose());
        const entries = new Map();
        const listeners = new Set();
        const writes = [];
        const forms = new Map();
        for (const id of ['power-dsh', 'dsh-x-mod', 'dsh-mod']) {
          const subscriptions = new Set();
          let snapshot = { status: 'loading', writable: false, value: undefined };
          forms.set(id, {
            getSnapshot: () => snapshot,
            subscribe(listener) { subscriptions.add(listener); return () => subscriptions.delete(listener); },
            async set(field, value) { writes.push({ id, field, value }); return true; },
            publish(status, value) {
              snapshot = { status, writable: status === 'ready', value };
              subscriptions.forEach(listener => listener());
            },
            subscriptions,
          });
        }
        class Slots extends Service {
          constructor(ctx) { super(ctx, 'slots'); }
          inject(_name, fn) { return this.ctx.effect(fn); }
          register(options, component) {
            const key = `${options.name}:${options.id}`;
            entries.set(key, component);
            return () => entries.delete(key);
          }
        }
        class Remote extends Service {
          constructor(ctx) { super(ctx, 'remote'); }
          async $mount() { this.ctx.provide('remote.powerDsh', {}); }
        }
        await root.plugin({ name: 'client-services', apply(ctx) {
          new Slots(ctx);
          new Remote(ctx);
          ctx.provide('locale', { register: () => () => {}, bind: () => key => key });
          ctx.provide('configForms', { get: id => {
            assert.ok(forms.has(id), `Unexpected namespace: ${id}`);
            return forms.get(id);
          } });
          ctx.provide('typert', {});
        } });
        if (connected) await root.plugin({ name: 'client-connection', apply(ctx) {
          ctx.provide('connection', { state: { getSnapshot: () => 'connected', subscribe: () => () => {} } });
        } });
        let plugin;
        const sandbox = vm.createContext({ URL, document: { baseURI: 'https://dsh.example/' }, window: {
          __ModuleLoader__: { load(definition) { plugin = definition.factory(specifier => {
            if (specifier === 'react') return { createElement: (type, props) => ({ type, props }) };
            assert.equal(specifier, '@deepseek-ai/dsh-client-ui-primitives');
            return {};
          }); } },
          __DSH_BOOT__: { release: { version: '0.2.2-rc.1' } },
          addEventListener(_name, listener) { listeners.add(listener); },
          removeEventListener(_name, listener) { listeners.delete(listener); },
          setTimeout, clearTimeout,
        } });
        vm.runInContext(await readFile(clientBundleUrl, 'utf8'), sandbox);
        const fiber = await root.plugin(plugin);
        await new Promise(setImmediate);
        assert.ok(entries.has('settings.section:power-dsh'), 'The settings entry must survive auxiliary connection initialization.');
        assert.ok(entries.has('settings.section.icon:power-dsh'));
        const canonical = forms.get('power-dsh');
        const legacy = forms.get(legacyId); // Compatibility with either existing managed entry.
        const recentLegacy = forms.get('dsh-x-mod');
        const oldestLegacy = forms.get('dsh-mod');
        const { form } = entries.get('settings.section:power-dsh')({ t: key => key }).props;
        const changed = [];
        const unsubscribe = form.subscribe(() => changed.push(form.getSnapshot()));
        for (const candidate of forms.values()) assert.ok(candidate.subscriptions.size > 0);
        for (const [id, candidate] of forms) {
          if (id !== 'power-dsh' && id !== legacyId) candidate.publish('unavailable');
        }
        legacy.publish('ready', { showVersion: true });
        assert.equal(form.getSnapshot(), canonical.getSnapshot(), 'A loading canonical form must not select legacy preferences.');
        canonical.publish('unavailable');
        assert.equal(form.getSnapshot(), legacy.getSnapshot());
        assert.equal(writes.length, 0, 'Reading legacy preferences must not migrate or save them.');
        await form.set('showVersion', false);
        assert.deepEqual(writes.pop(), { id: legacyId, field: 'showVersion', value: false });
        oldestLegacy.publish('ready', { showVersion: false });
        recentLegacy.publish('loading');
        assert.equal(form.getSnapshot(), recentLegacy.getSnapshot(), 'The first available legacy form wins even while loading.');
        recentLegacy.publish('ready', { showVersion: true });
        assert.equal(form.getSnapshot(), recentLegacy.getSnapshot(), 'dsh-x-mod takes precedence over dsh-mod.');
        await form.set('showVersion', false);
        assert.deepEqual(writes.pop(), { id: 'dsh-x-mod', field: 'showVersion', value: false });
        recentLegacy.publish('unavailable');
        assert.equal(form.getSnapshot(), oldestLegacy.getSnapshot(), 'Unavailable cached controllers must not hide older settings.');
        await form.set('showVersion', true);
        assert.deepEqual(writes.pop(), { id: 'dsh-mod', field: 'showVersion', value: true });
        canonical.publish('loading');
        assert.equal(form.getSnapshot(), canonical.getSnapshot(), 'Canonical loading takes precedence over ready legacy forms.');
        canonical.publish('ready', { showVersion: false });
        assert.equal(form.getSnapshot(), canonical.getSnapshot(), 'Canonical preferences win when all namespaces are served.');
        await form.set('showVersion', true);
        assert.deepEqual(writes.pop(), { id: 'power-dsh', field: 'showVersion', value: true });
        recentLegacy.publish('ready', { showVersion: true });
        assert.equal(form.getSnapshot(), canonical.getSnapshot());
        canonical.publish('unavailable');
        recentLegacy.publish('unavailable');
        oldestLegacy.publish('unavailable');
        assert.equal(form.getSnapshot().status, 'unavailable');
        assert.equal(writes.length, 0, 'Form availability changes must not migrate or save preferences.');
        assert.ok(changed.length > 0);
        unsubscribe();
        await fiber.dispose();
        assert.equal(entries.size, 0);
        assert.equal(listeners.size, 0);
        for (const candidate of forms.values()) assert.equal(candidate.subscriptions.size, 0);
      });
    }
  }
});
