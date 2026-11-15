import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EnhancePolicy } from '../enhance-policy.ts';

const MODULE = 'session-query-sqlite';
const ENGINE = '@deepseek-ai/dsh-session-query-sqlite';
const HOME = '/test/profile';
const ENABLED_CONFIG = { path: `${HOME}/power-dsh/session-query-index.sqlite3`, openAt: 'first-search' };
const DISABLED_CONFIG = { path: ':memory:', openAt: 'never' };

function fixture({ enhanced = false, entryConfig = DISABLED_CONFIG, withEntry = true, entryDisabled = false } = {}) {
  const entries = withEntry ? [{ disabled: entryDisabled, options: { id: MODULE, name: ENGINE, config: structuredClone(entryConfig) } }] : [];
  const ownConfig = { searchPopupEnabled: enhanced, searchEnhanceEnabled: false };
  const ownEntry = { options: { id: 'power-dsh', config: ownConfig } };
  const writes = [];
  const owner = {
    profileContext: { home: HOME },
    fiber: { entry: ownEntry },
    configEditor: {
      entries: () => [ownEntry, ...entries],
      async edit(entry, change) {
        entry.options.config = change(structuredClone(entry.options.config));
        writes.push(entry.options.id);
      },
    },
  };
  // The real LivePreferences read the persisted entry document, so the fake
  // accessor must read the entry that the fake ConfigEditor mutates.
  const config = { searchPopupEnabled: { get: () => ownEntry.options.config.searchPopupEnabled } };
  let guard = 0;
  const policy = new EnhancePolicy(owner, config, { ensureActive: () => { guard++; } });
  return { policy, entries, ownEntry, writes, owner, guard: () => guard };
}

test('enabling writes a durable index path and reads the entry back before persisting the preference', async () => {
  const app = fixture();
  const result = await app.policy.setEnabled(true);
  assert.deepEqual(result, { enabled: true });
  assert.equal(app.entries[0].options.config.openAt, 'first-search');
  assert.equal(app.entries[0].options.config.path, ENABLED_CONFIG.path);
  assert.deepEqual(app.writes, [MODULE, 'power-dsh']);
  assert.equal(app.ownEntry.options.config.searchPopupEnabled, true);
  assert.equal('searchEnhanceEnabled' in app.ownEntry.options.config, false);
  assert.ok(app.guard() > 0, 'Long edits re-check the owner activity.');
});

test('disabling restores the shipped in-memory default and the entry state decides the note', async () => {
  const app = fixture({ enhanced: true, entryConfig: ENABLED_CONFIG });
  const result = await app.policy.setEnabled(false);
  assert.deepEqual(result, { enabled: false });
  assert.deepEqual(app.entries[0].options.config, DISABLED_CONFIG);
  assert.deepEqual(app.writes, [MODULE, 'power-dsh']);
  assert.equal(app.ownEntry.options.config.searchPopupEnabled, false);
});

test('an already matching entry skips the engine write and still persists the preference', async () => {
  const app = fixture({ entryConfig: ENABLED_CONFIG });
  await app.policy.setEnabled(true);
  assert.deepEqual(app.writes, ['power-dsh'], 'Only the own preference entry is written.');
  assert.equal(app.ownEntry.options.config.searchPopupEnabled, true);
});

test('a missing or disabled engine entry fails before any write', async () => {
  for (const options of [{ withEntry: false }, { entryDisabled: true }]) {
    const app = fixture(options);
    await assert.rejects(app.policy.setEnabled(true), /No session-query index entry/);
    assert.deepEqual(app.writes, []);
    assert.equal(app.ownEntry.options.config.searchPopupEnabled, false);
  }
});

test('a read-back mismatch fails loudly instead of reporting success', async () => {
  const app = fixture();
  app.owner.configEditor.edit = async (entry, change) => {
    if (entry.options.id === MODULE) entry.options.config = { path: ':memory:', openAt: 'never' };
    else app.ownEntry.options.config.searchPopupEnabled = true;
    app.writes.push(entry.options.id);
  };
  await assert.rejects(app.policy.setEnabled(true), /did not match the requested value/);
  assert.equal(app.ownEntry.options.config.searchPopupEnabled, false, 'The preference is not persisted after a failed read-back.');
});

test('a preference read-back mismatch fails loudly', async () => {
  const app = fixture();
  app.owner.configEditor.edit = async (entry, change) => {
    if (entry.options.id === 'power-dsh') return;
    entry.options.config = change(structuredClone(entry.options.config));
    app.writes.push(entry.options.id);
  };
  await assert.rejects(app.policy.setEnabled(true), /setting did not match/);
  assert.deepEqual(app.entries[0].options.config, ENABLED_CONFIG);
  assert.equal(app.ownEntry.options.config.searchPopupEnabled, false);
});

test('non-boolean input fails before touching the configuration', async () => {
  const app = fixture();
  await assert.rejects(app.policy.setEnabled('yes'), /must be boolean/);
  assert.deepEqual(app.writes, []);
});

test('an existing enabled popup prepares content search without another preference or repeated engine writes', async () => {
  const app = fixture({ enhanced: true });
  await app.policy.configureEngine(true);
  await app.policy.configureEngine(true);
  assert.deepEqual(app.writes, [MODULE]);
  assert.equal(app.policy.enhanced(), true);
  assert.deepEqual(app.entries[0].options.config, ENABLED_CONFIG);
});
