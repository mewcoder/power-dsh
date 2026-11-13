import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PluginReleases, releaseCommits } from '../releases.ts';
import { READ_PLUGIN_RELEASE_RPC } from '../rpc.ts';

const repository = 'https://github.com/mewcoder/power-dsh';
const commit = 'a'.repeat(40);
const tag = 'b'.repeat(40);
const listing = `${tag}\trefs/tags/v0.0.6\n${commit}\trefs/tags/v0.0.6^{}\n${'c'.repeat(40)}\trefs/tags/v0.0.99\n`;
function fixture({ output = listing, stderr = '', lossy = false, missingGit = false, service = true, exitCode = 0, request } = {}) {
  const calls = [];
  const requests = [];
  const effects = [];
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
            collected: { stdout: { readFrom(offset) { assert.equal(offset, 0); return { text: output, lossy }; } },
              stderr: { readFrom() { return { text: stderr, lossy: false }; } } },
            terminate() { terminated++; } };
        },
      } : undefined;
    },
  };
  const reader = new PluginReleases(ctx, async (url, init) => {
    requests.push({ url, init });
    if (request) return request(url, init);
    return new Response(null, { status: 302, headers: { location: url.endsWith('/latest')
      ? `${repository}/releases/tag/v0.0.6` : 'https://release-assets.githubusercontent.com/github-production-release-asset/file' } });
  });
  return { reader, calls, requests, effects, terminated: () => terminated };
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

test('missing Git and malformed subprocess output produce safe failures without starting a download', async () => {
  for (const options of [{ missingGit: true }, { service: false }, { lossy: true }, { output: '' }, { exitCode: 1 }]) {
    const f = fixture(options);
    const reply = await f.reader.read();
    assert.equal(reply.status, options.missingGit || options.service === false ? 'git-unavailable' : 'unavailable');
    assert.equal(JSON.stringify(reply).includes('Private'), false);
    f.reader.close();
  }
});

test('Latest must identify a stable known tag and its fixed asset must redirect to the official asset host', async () => {
  for (const target of [`${repository}/releases/tag/v0.0.7`, `${repository}/releases/tag/v0.1.0-beta.1`,
    'https://example.com/releases/tag/v0.0.6']) {
    const f = fixture({ request: () => new Response(null, { status: 302, headers: { location: target } }) });
    const reply = await f.reader.read();
    assert.equal(reply.status, 'unavailable');
    assert.equal(reply.diagnostic.stage, 'release.latest');
    assert.equal(reply.diagnostic.reason, target.endsWith('v0.0.7') ? 'tag-mismatch' : 'invalid-response');
    assert.equal(f.requests.length, 1);
    f.reader.close();
  }
  for (const response of [new Response(null, { status: 404 }),
    new Response(null, { status: 302, headers: { location: 'https://example.com/package.tgz' } })]) {
    const f = fixture({ request: url => url.endsWith('/latest')
      ? new Response(null, { status: 302, headers: { location: `${repository}/releases/tag/v0.0.6` } }) : response });
    const reply = await f.reader.read();
    assert.equal(reply.status, 'unavailable');
    assert.equal(reply.diagnostic.stage, 'release.asset');
    assert.equal(reply.diagnostic.httpStatus, response.status);
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
  const failed = await forbidden.reader.read();
  assert.equal(failed.status, 'unavailable');
  assert.equal(failed.diagnostic.httpStatus, 403);
  assert.equal(failed.diagnostic.reason, 'http');
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
  const failed = await reading;
  assert.equal(failed.status, 'unavailable');
  assert.equal(failed.diagnostic.reason, 'cancelled');
  assert.ok(f.terminated() > 0);
});

test('Host failure evidence preserves the actual step and safe network code through the strict RPC codec', async () => {
  const f = fixture({ request: () => { throw new Error('Private URL and credentials', { cause: { code: 'ENOTFOUND' } }); } });
  const reply = await f.reader.read();
  assert.equal(reply.diagnostic.stage, 'release.latest');
  assert.equal(reply.diagnostic.reason, 'network');
  assert.equal(reply.diagnostic.systemCode, 'ENOTFOUND');
  assert.ok(reply.diagnostic.elapsedMs >= 0);
  const parsed = READ_PLUGIN_RELEASE_RPC.result.create().parse(reply);
  assert.deepEqual(parsed, reply);
  assert.ok(!JSON.stringify(parsed).includes('Private'));
  assert.throws(() => READ_PLUGIN_RELEASE_RPC.result.create().parse({ ...reply,
    diagnostic: { ...reply.diagnostic, systemCode: 'password=private' } }), /Invalid update diagnostic/);
  assert.throws(() => READ_PLUGIN_RELEASE_RPC.result.create().parse({ ...reply,
    diagnostic: { ...reply.diagnostic, stage: 'https://private.example' } }), /Invalid update diagnostic/);
  assert.throws(() => READ_PLUGIN_RELEASE_RPC.result.create().parse({ ...reply,
    diagnostic: { ...reply.diagnostic, httpStatus: 'private' } }), /Invalid update diagnostic/);
  f.reader.close();
  const git = fixture({ exitCode: 128 });
  const failed = await git.reader.read();
  assert.equal(failed.diagnostic.stage, 'git.tags');
  assert.equal(failed.diagnostic.reason, 'process-exit');
  assert.equal(failed.diagnostic.exitCode, 128);
  assert.equal(git.requests.length, 0);
  git.reader.close();
});

test('known Git failure categories retain the reason without returning stderr, hosts or credentials', async () => {
  for (const [stderr, reason] of [
    ["fatal: unable to access 'https://private.example/repo': Could not resolve host: private.example", 'dns'],
    ['Could not resolve proxy: private.proxy', 'proxy'],
    ['SSL certificate problem: private certificate', 'certificate'],
    ['Authentication failed: password=private', 'authentication'],
    ['Failed to connect to private.example', 'connection'],
  ]) {
    const f = fixture({ exitCode: 128, stderr });
    const reply = await f.reader.read();
    assert.equal(reply.diagnostic.stage, 'git.tags');
    assert.equal(reply.diagnostic.reason, reason);
    assert.equal(reply.diagnostic.exitCode, 128);
    assert.ok(!JSON.stringify(reply).includes('private'));
    f.reader.close();
  }
});
