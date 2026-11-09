import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mount } from '../helpers/client-fixture.mjs';
import { MOD_RPC } from '../../src/app/rpc.ts';

test('Client descriptors match the Host methods, modes and strict wire codecs', async () => {
  const app = await mount();
  const wire = descriptor => JSON.parse(JSON.stringify(descriptor));
  assert.deepEqual(wire(app.rpcDescriptors), wire(MOD_RPC));
  for (const descriptor of app.rpcDescriptors) {
    const codec = descriptor.parameters[0]?.codec;
    if (codec?.typeSymbol === 'boolean') assert.throws(() => codec.create().parse('true'), /boolean/);
    if (codec?.typeSymbol === 'string') assert.throws(() => codec.create().parse(true), /string/);
  }
  app.unmount();
});
