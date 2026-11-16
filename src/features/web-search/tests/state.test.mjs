import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backendOf } from '../backends.ts';
import { credentialKeyOf, readSlotRows, resolveKey, writeKey } from '../state.ts';

/** A credentials double recording every call the feature makes. */
function credentials({ records = new Map(), writable = true } = {}) {
  const calls = [];
  return {
    calls, records,
    async describeRecord(key) { calls.push(['describe', key]); return { configured: records.has(key), writable }; },
    async readRecord(key) { calls.push(['read', key]); return records.get(key); },
    async modifyRecord(key, mutate) { calls.push(['modify', key]); const next = await mutate(records.get(key)); if (next !== undefined) records.set(key, next); return next; },
    async deleteRecord(key) { calls.push(['delete', key]); records.delete(key); },
  };
}

const slot = (id, provider = id.replace(/-\d+$/, '')) => ({ id, provider });

test('credential keys are scoped to this plugin and the instance, not the vendor', () => {
  assert.equal(credentialKeyOf('tavily-1'), 'power-dsh/tavily-1');
  assert.equal(credentialKeyOf('tavily-2'), 'power-dsh/tavily-2');
});

test('two instances of one vendor are two independent records', async () => {
  const store = credentials();
  await writeKey(store, 'tavily-1', 'first');
  await writeKey(store, 'tavily-2', 'second');
  assert.equal(store.records.get('power-dsh/tavily-1').key, 'first');
  assert.equal(store.records.get('power-dsh/tavily-2').key, 'second');
  const rows = await readSlotRows(store, [slot('tavily-1'), slot('tavily-2')]);
  assert.deepEqual(rows.map(row => row.hasKey), [true, true]);
});

test('a stored key reads as configured and resolves to its value', async () => {
  const store = credentials();
  await writeKey(store, 'tinyfish-1', 'tf-1');
  assert.equal(store.records.get('power-dsh/tinyfish-1').key, 'tf-1');
  assert.equal(await resolveKey(store, 'tinyfish-1'), 'tf-1');
  const rows = await readSlotRows(store, [slot('tinyfish-1', 'tinyfish')]);
  assert.deepEqual(rows, [{ id: 'tinyfish-1', provider: 'tinyfish', configured: true, writable: true, hasKey: true }]);
});

test('an empty value removes the record instead of storing a blank key', async () => {
  const store = credentials();
  await writeKey(store, 'tinyfish-1', 'tf-1');
  await writeKey(store, 'tinyfish-1', '');
  assert.equal(store.records.has('power-dsh/tinyfish-1'), false);
  assert.equal(await resolveKey(store, 'tinyfish-1'), '');
});

test('Tavily stays unconfigured without a key', async () => {
  const store = credentials();
  const rows = await readSlotRows(store, [slot('tavily-1')]);
  assert.deepEqual(rows, [{ id: 'tavily-1', provider: 'tavily', configured: false, writable: true, hasKey: false }]);
});

test('a key-required vendor stays unconfigured without a key', async () => {
  const store = credentials();
  const rows = await readSlotRows(store, [slot('tinyfish-1', 'tinyfish')]);
  assert.deepEqual(rows, [{ id: 'tinyfish-1', provider: 'tinyfish', configured: false, writable: true, hasKey: false }]);
});

test('a missing credentials service reports unconfigured and unwritable rather than throwing', async () => {
  const rows = await readSlotRows(undefined, [slot('tavily-1'), slot('tinyfish-1', 'tinyfish')]);
  assert.deepEqual(rows, [
    { id: 'tavily-1', provider: 'tavily', configured: false, writable: false, hasKey: false },
    { id: 'tinyfish-1', provider: 'tinyfish', configured: false, writable: false, hasKey: false },
  ]);
  assert.equal(await resolveKey(undefined, 'tinyfish-1'), '');
  await assert.rejects(writeKey(undefined, 'tinyfish-1', 'x'), /webSearchCredentialsUnavailable/);
});

test('a failing credentials read degrades to an empty key instead of breaking the chain', async () => {
  const broken = {
    async describeRecord() { throw new Error('vault locked'); },
    async readRecord() { throw new Error('vault locked'); },
    async modifyRecord() { throw new Error('vault locked'); },
    async deleteRecord() { throw new Error('vault locked'); },
  };
  const rows = await readSlotRows(broken, [slot('tinyfish-1', 'tinyfish')]);
  assert.deepEqual(rows, [{ id: 'tinyfish-1', provider: 'tinyfish', configured: false, writable: false, hasKey: false }]);
  assert.equal(await resolveKey(broken, 'tinyfish-1'), '');
});

test('an instance naming a vendor this build no longer ships is dropped from the rows', async () => {
  const store = credentials();
  const rows = await readSlotRows(store, [slot('retired-1', 'retired-vendor')]);
  assert.deepEqual(rows, []);
});

test('every shipped vendor still resolves for key lookup', () => {
  assert.ok(backendOf('tavily') && backendOf('firecrawl') && backendOf('tinyfish'));
});
