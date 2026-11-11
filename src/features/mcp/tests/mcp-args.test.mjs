import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redactMcpArgs } from '../mcp-args.ts';

const secret = 'fixture-private-value';

test('ordinary CLI arguments retain their values, order and boundaries', () => {
  const args = ['-y', '@example/mcp-server', '--port', '3000', '--path', '/work/my project', '--mode=stdio', '--monkey', 'visible', ''];
  assert.deepEqual(redactMcpArgs(args), args);
});

test('credential flags hide only their values in separate and inline forms', () => {
  const args = ['-y', 'server', '--api-key', secret, '--accessToken=' + secret, '--password=' + secret, '--port=3000'];
  assert.deepEqual(redactMcpArgs(args), ['-y', 'server', '--api-key', '[REDACTED]', '--accessToken=[REDACTED]', '--password=[REDACTED]', '--port=3000']);
  assert.ok(!JSON.stringify(redactMcpArgs(args)).includes(secret));
});

test('header and environment values retain names without exposing credentials', () => {
  const args = ['-H', 'Authorization: Bearer ' + secret, '--header=X-Api-Key: ' + secret,
    '-e', 'GITHUB_PERSONAL_ACCESS_TOKEN=' + secret, '--env=CLIENT_SECRET=' + secret, '--env=PORT=3000'];
  const projected = redactMcpArgs(args);
  assert.deepEqual(projected, ['-H', 'Authorization: [REDACTED]', '--header=X-Api-Key: [REDACTED]',
    '-e', 'GITHUB_PERSONAL_ACCESS_TOKEN=[REDACTED]', '--env=CLIENT_SECRET=[REDACTED]', '--env=PORT=3000']);
});

test('URL arguments keep public route and options while masking credential fields', () => {
  const args = ['--url=https://user:' + secret + '@example.com/mcp?token=' + secret + '&mode=fast',
    'https://example.com/mcp?mode=fast', 'https://example.com/mcp#api_key=' + secret];
  const projected = redactMcpArgs(args);
  assert.ok(!JSON.stringify(projected).includes(secret));
  assert.ok(projected[0].includes('/mcp?token=[REDACTED]&mode=fast'));
  assert.equal(projected[1], args[1]);
  assert.ok(projected[2].endsWith('#api_key=[REDACTED]'));
});
