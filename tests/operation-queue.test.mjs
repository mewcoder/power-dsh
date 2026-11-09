import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OperationQueue } from '../src/operation-queue.js';

test('operations serialize and an error does not poison following work', async () => {
  const queue = new OperationQueue();
  const order = [];
  const one = queue.run(async () => { order.push(1); throw new Error('first failed'); });
  const two = queue.run(async () => { order.push(2); return 'done'; });
  await assert.rejects(one, /first failed/);
  assert.equal(await two, 'done');
  assert.deepEqual(order, [1, 2]);
});

test('close returns immediately while queued work rejects instead of waiting on unload locks', async () => {
  const queue = new OperationQueue();
  const release = Promise.withResolvers();
  const started = Promise.withResolvers();
  const first = queue.run(async () => { started.resolve(); await release.promise; queue.ensureActive(); });
  const second = queue.run(() => assert.fail('queued operation ran after unload'));
  await started.promise;
  assert.equal(queue.close(), undefined);
  release.resolve();
  await assert.rejects(first, /unloaded/);
  await assert.rejects(second, /unloaded/);
});
