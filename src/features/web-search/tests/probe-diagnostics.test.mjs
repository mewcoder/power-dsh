import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BackendError } from '../backends.ts';
import { parseProbeDiagnostic, probeDiagnostic, probeDiagnosticContext, probeFailureMessage } from '../probe-diagnostics.ts';
import { PROBE_WEB_SEARCH_SEARCH_RPC } from '../rpc.ts';
import { diagnosticReport } from '../../../shared/types/diagnostics.ts';
import { locales } from '../locales.ts';

const translate = key => locales.zh[key] ?? key;
const reply = diagnostic => ({ ok: false, resultCount: 0, durationMs: 12, message: 'webSearchProbeFailed', diagnostic });

test('HTTP failures retain their actionable reason through the wire and copied diagnostics', () => {
  for (const [status, reason] of [[401, 'auth'], [403, 'forbidden'], [402, 'quota'], [429, 'rate-limit'], [500, 'http']]) {
    const diagnostic = probeDiagnostic(new BackendError('ignored private payload', status), 'firecrawl', 'keyless');
    assert.equal(diagnostic.reason, reason);
    const result = PROBE_WEB_SEARCH_SEARCH_RPC.result.create().parse(reply(diagnostic));
    const context = probeDiagnosticContext(result, 'search', translate);
    assert.equal(context.stage, 'web-search.search.response');
    assert.equal(context.check, 'firecrawl');
    assert.equal(context.state, 'keyless');
    assert.match(context.actual, new RegExp(`HTTP ${status}`));
    assert.notEqual(probeFailureMessage(result, translate), '测试失败');
    const report = diagnosticReport({ code: 'PD-WEBSEARCH-PROBE', operation: 'probeWebSearchSearch',
      message: probeFailureMessage(result, translate), observedAt: diagnostic.observedAt, context });
    assert.match(report, /firecrawl/);
    assert.doesNotMatch(report, /private payload/);
  }
});

test('network failures expose only allowlisted codes and never the request or error text', () => {
  const error = new TypeError('Authorization: Bearer secret-key https://private.example/config', {
    cause: Object.assign(new Error('/private/config'), { code: 'ECONNRESET', apiKey: 'secret-key' }),
  });
  const diagnostic = probeDiagnostic(error, 'tavily', 'api-key');
  assert.equal(diagnostic.reason, 'network');
  assert.equal(diagnostic.systemCode, 'ECONNRESET');
  assert.equal(diagnostic.auth, 'api-key');
  assert.doesNotMatch(JSON.stringify(diagnostic), /secret-key|private.example|private\/config|Authorization/);
  const unknown = probeDiagnostic(Object.assign(error, { cause: { code: 'secret-key' } }), 'tavily', 'keyless');
  assert.equal(unknown.systemCode, undefined);
});

test('timeout, malformed JSON, empty responses and RPC failures remain distinct', () => {
  assert.equal(probeDiagnostic(new DOMException('timeout', 'TimeoutError'), 'tavily', 'keyless').reason, 'timeout');
  assert.equal(probeDiagnostic(new SyntaxError('bad json'), 'tavily', 'keyless').reason, 'invalid-response');
  assert.equal(probeDiagnostic(new BackendError('empty'), 'tavily', 'keyless').reason, 'empty-response');
  const transport = probeDiagnostic({ cause: { code: 'ECONNRESET' } }, 'unknown', 'unknown', 'rpc');
  assert.equal(transport.stage, 'rpc');
  assert.equal(transport.reason, 'rpc');
  assert.equal(transport.systemCode, 'ECONNRESET');
});

test('legacy replies explicitly report missing Host diagnostics', () => {
  const result = PROBE_WEB_SEARCH_SEARCH_RPC.result.create().parse({ ok: false, resultCount: 0, durationMs: 0, message: 'legacy' });
  assert.equal(result.diagnostic, undefined);
  const context = probeDiagnosticContext(result, 'fetch', translate);
  assert.equal(context.result, '宿主未返回具体失败原因');
  assert.match(context.recovery, /重新加载/);
});

test('the diagnostic codec rejects unknown values and drops unapproved fields', () => {
  const valid = probeDiagnostic(new BackendError('ignored', 403), 'firecrawl', 'keyless');
  for (const invalid of [{ reason: 'secret-key' }, { systemCode: 'secret-key' }, { httpStatus: 700 },
    { observedAt: 'invalid' }, { provider: 'secret-key' }]) {
    assert.throws(() => parseProbeDiagnostic({ ...valid, ...invalid }));
  }
  assert.deepEqual(parseProbeDiagnostic({ ...valid, apiKey: 'secret-key', response: 'private' }), valid);
});
