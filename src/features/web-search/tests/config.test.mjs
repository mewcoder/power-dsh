import assert from 'node:assert/strict';
import { test } from 'node:test';
import z from '@deepseek-ai/schemastery';
import { Config } from '../../../app/config.ts';

test('the full Host schema accepts legacy and instance chains, including its serialized client schema', () => {
  const preferences = { webSearchChain: ['tavily', { id: 'tinyfish-1', provider: 'tinyfish' }],
    webFetchChain: ['tavily', 'firecrawl'] };
  for (const schema of [Config, new z(Config.toJSON())]) {
    const config = schema(structuredClone(preferences));
    assert.deepEqual(config.webSearchChain.get(), preferences.webSearchChain);
    assert.deepEqual(config.webFetchChain.get(), preferences.webFetchChain);
  }
});

test('compatibility does not admit malformed provider instances', () => {
  assert.throws(() => Config({ webSearchChain: [42] }));
  assert.throws(() => Config({ webFetchChain: [{ id: 'broken' }] }));
});
