import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PluginReleases, releaseCommits } from '../releases.ts';
import { READ_PLUGIN_RELEASE_RPC } from '../rpc.ts';

const repository = 'https://github.com/mewcoder/power-dsh';
const commit = 'a'.repeat(40);
const tag = 'b'.repeat(40);
const listing = `${tag}\trefs/tags/v0.0.6\n${commit}\trefs/tags/v0.0.6^{}\n${'c'.repeat(40)}\trefs/tags/v0.0.99\n`;
function fixture({ output = listing, lossy = false, missingGit = false, service = true, exitCode = 0, request } = {}) {
  const calls = [];
  const requests = [];
  const effects = [];
  let enabled = true;
  let terminated = 0;
  const ctx = {
    effect(callback) { effects.push(callback()); },
    get(name) {
      assert.equal(name, 'subprocess');
      return service ? {
        async resolveExecutable(name) { assert.equal(name, 'git'); if (missingGit) throw new Error('Private executable search'); return 'git'; },
        spawn(spec) {
          calls.push(spec);
          return { done: Promise.resolve({ exitCode, signal: null }), async waitForExit() { return true; },
            collected: { stdout: { readFrom(offset) { assert.equal(offset, 0); return { text: output, lossy }; } } },
            terminate() { terminated++; } };
        },
      } : undefined;
    },
  };
  const config = { pluginUpdatesEnabled: { get: () => enabled } };
  const reader = new PluginReleases(ctx, config, async (url, init) => {
    requests.push({ url, init });
    if (request) return request(url, init);
    return new Response(null, { status: 302, headers: { location: url.endsWith('/latest')
      ? `${repository}/releases/tag/v0.0.6` : 'https://release-assets.githubusercontent.com/github-production-release-asset/file' } });
  });
  return { reader, calls, requests, effects, setEnabled(value) { enabled = value; }, terminated: () => terminated };
}

test('Git resolves annotated tags and public Latest, excluding unreleased tags and all REST API calls', async () => {
  const f = fixture();
  assert.equal(f.calls.length, 0);
  assert.equal(f.requests.length, 0);
  assert.deepEqual(await f.reader.read(), { status: 'ready', version: '0.0.6', commit });
  assert.deepEqual(f.calls[0].argv, ['git', '-c', 'credential.helper=', '-c', 'core.askPass=', 'ls-remote', '--tags',
    `${repository}.git`, 'refs/tags/v*']);
  assert.equal(f.calls[0].env.GIT_TERMINAL_PROMPT, '0');
  for (const { url, init } of f.requests) {
    assert.ok(url.startsWith(`${repository}/releases/`));
    assert.equal(init.method, 'HEAD');
    assert.equal(init.redirect, 'manual');
    assert.equal(init.credentials, 'omit');
  }
  assert.equal(f.requests.length, 2);
  assert.equal(READ_PLUGIN_RELEASE_RPC.result.create().parse(await f.reader.read()).commit, commit);
  f.reader.close();
});

test('tag parsing accepts lightweight and peeled annotated tags while rejecting malformed and prerelease identities', () => {
  const values = releaseCommits(`${listing}${commit}\trefs/tags/v0.1.0-beta.1\n${commit}\trefs/tags/v01.0.0\nbad\trefs/tags/v1.0.0\n`);
  assert.equal(values.get('0.0.6'), commit);
  assert.equal(values.get('0.0.99'), 'c'.repeat(40));
  assert.equal(values.size, 2);
});

test('missing Git, disabled controls and malformed subprocess output produce safe failures without starting a download', async () => {
  for (const options of [{ missingGit: true }, { service: false }, { lossy: true }, { output: '' }, { exitCode: 1 }]) {
    const f = fixture(options);
    const reply = await f.reader.read();
    assert.equal(reply.status, options.missingGit || options.service === false ? 'git-unavailable' : 'unavailable');
    assert.equal(JSON.stringify(reply).includes('Private'), false);
    f.reader.close();
  }
  const f = fixture();
  f.setEnabled(false);
  assert.deepEqual(await f.reader.read(), { status: 'unavailable' });
  assert.equal(f.calls.length, 0);
  f.reader.close();
});

test('Latest must identify a stable known tag and its fixed asset must redirect to the official asset host', async () => {
  for (const target of [`${repository}/releases/tag/v0.0.7`, `${repository}/releases/tag/v0.1.0-beta.1`,
    'https://example.com/releases/tag/v0.0.6']) {
    const f = fixture({ request: () => new Response(null, { status: 302, headers: { location: target } }) });
    assert.deepEqual(await f.reader.read(), { status: 'unavailable' });
    assert.equal(f.requests.length, 1);
    f.reader.close();
  }
  for (const response of [new Response(null, { status: 404 }),
    new Response(null, { status: 302, headers: { location: 'https://example.com/package.tgz' } })]) {
    const f = fixture({ request: url => url.endsWith('/latest')
      ? new Response(null, { status: 302, headers: { location: `${repository}/releases/tag/v0.0.6` } }) : response });
    assert.deepEqual(await f.reader.read(), { status: 'unavailable' });
    f.reader.close();
  }
});

test('public-page rate limits retain a deadline, distinguish permission failures and do not retry while cooling down', async () => {
  for (const retry of ['120', new Date(Date.now() + 120_000).toUTCString()]) {
    const f = fixture({ request: () => new Response(null, { status: 429, headers: { 'Retry-After': retry } }) });
    const reply = await f.reader.read();
    assert.equal(reply.status, 'rate-limited');
    assert.ok(reply.retryAt >= Date.now() + 100_000);
    assert.equal((await f.reader.read()).status, 'rate-limited');
    assert.equal(f.calls.length, 1);
    assert.equal(f.requests.length, 1);
    f.reader.close();
  }
  const forbidden = fixture({ request: () => new Response(null, { status: 403 }) });
  assert.deepEqual(await forbidden.reader.read(), { status: 'unavailable' });
  forbidden.reader.close();
});

test('unloading aborts active lookup and a late response never reports a release', async () => {
  const started = Promise.withResolvers();
  const reply = Promise.withResolvers();
  const f = fixture({ request: (_url, init) => { started.resolve(init.signal); return reply.promise; } });
  const reading = f.reader.read();
  const signal = await started.promise;
  f.reader.close();
  assert.equal(signal.aborted, true);
  reply.resolve(new Response(null, { status: 302, headers: { location: `${repository}/releases/tag/v0.0.6` } }));
  assert.deepEqual(await reading, { status: 'unavailable' });
  assert.ok(f.terminated() > 0);
});
