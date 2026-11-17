import type { WebSearchProbe, WebSearchProbeDiagnostic } from '../../shared/types/wire.ts';
import type { DiagnosticContext } from '../../shared/types/diagnostics.ts';
import type { Translate } from '../../shared/client/types.ts';

const providers = ['tavily', 'firecrawl', 'tinyfish', 'exa', 'unknown'] as const;
const stages = ['credentials', 'request', 'response', 'rpc'] as const;
const reasons = ['key-missing', 'auth', 'forbidden', 'quota', 'rate-limit', 'http', 'network', 'timeout', 'invalid-response', 'empty-response', 'rpc', 'unknown'] as const;
const modes = ['keyless', 'missing', 'api-key', 'unknown'] as const;
const systemCodes = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENETUNREACH',
  'EHOSTUNREACH', 'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'SELF_SIGNED_CERT_IN_CHAIN', 'ERR_TLS_CERT_ALTNAME_INVALID', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET']);

export function parseProbeDiagnostic(value: unknown): WebSearchProbeDiagnostic {
  if (typeof value !== 'object' || value === null) throw new TypeError('Invalid web probe diagnostic');
  const data = value as Record<string, unknown>;
  const provider = providers.find(candidate => candidate === data.provider);
  const stage = stages.find(candidate => candidate === data.stage);
  const reason = reasons.find(candidate => candidate === data.reason);
  const auth = modes.find(candidate => candidate === data.auth);
  if (!provider || !stage || !reason || !auth || typeof data.observedAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(data.observedAt)
    || !Number.isFinite(Date.parse(data.observedAt))) throw new TypeError('Invalid web probe diagnostic');
  const result: WebSearchProbeDiagnostic = { provider, stage, reason, auth, observedAt: data.observedAt };
  if (data.httpStatus !== undefined) {
    if (typeof data.httpStatus !== 'number' || !Number.isInteger(data.httpStatus) || data.httpStatus < 100 || data.httpStatus > 599) {
      throw new TypeError('Invalid web probe HTTP status');
    }
    result.httpStatus = data.httpStatus;
  }
  if (data.systemCode !== undefined) {
    if (typeof data.systemCode !== 'string' || !systemCodes.has(data.systemCode)) throw new TypeError('Invalid web probe system code');
    result.systemCode = data.systemCode;
  }
  return result;
}

export function probeDiagnostic(error: unknown, provider: string, auth: WebSearchProbeDiagnostic['auth'], stage: WebSearchProbeDiagnostic['stage'] = 'request'): WebSearchProbeDiagnostic {
  let current: unknown = error;
  let systemCode: string | undefined;
  for (let depth = 0; depth < 4 && typeof current === 'object' && current !== null; depth++) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === 'string' && systemCodes.has(candidate.code)) { systemCode = candidate.code; break; }
    current = candidate.cause;
  }
  const data = typeof error === 'object' && error !== null ? error as { status?: unknown; name?: unknown } : {};
  const httpStatus = typeof data.status === 'number' && Number.isInteger(data.status) && data.status >= 100 && data.status <= 599 ? data.status : undefined;
  const reason: WebSearchProbeDiagnostic['reason'] = stage === 'rpc' ? 'rpc'
    : httpStatus === 401 ? 'auth' : httpStatus === 403 ? 'forbidden' : httpStatus === 402 ? 'quota'
      : httpStatus === 429 ? 'rate-limit' : httpStatus !== undefined ? 'http'
        : data.name === 'TimeoutError' || data.name === 'AbortError' || systemCode?.includes('TIMEOUT') || systemCode === 'ETIMEDOUT' ? 'timeout'
          : systemCode ? 'network' : data.name === 'SyntaxError' ? 'invalid-response'
            : data.name === 'BackendError' ? 'empty-response' : 'unknown';
  return {
    provider: providers.find(candidate => candidate === provider) ?? 'unknown',
    stage: httpStatus !== undefined || reason === 'invalid-response' || reason === 'empty-response' ? 'response' : stage,
    reason, auth, observedAt: new Date().toISOString(),
    ...(httpStatus === undefined ? {} : { httpStatus }), ...(systemCode === undefined ? {} : { systemCode }),
  };
}

export function probeFailureMessage(probe: WebSearchProbe, t: Translate): string {
  const reason = probe.diagnostic?.reason;
  return reason ? t(`webSearchProbeReason_${reason}`) : t('webSearchProbeFailed');
}

export function probeDiagnosticContext(probe: WebSearchProbe, capability: 'search' | 'fetch', t: Translate): DiagnosticContext {
  const diagnostic = probe.diagnostic;
  if (!diagnostic) return { stage: `web-search.${capability}`, result: t('webSearchProbeDiagnosticMissing'), recovery: t('webSearchProbeRecoveryReload') };
  return {
    stage: `web-search.${capability}.${diagnostic.stage}`,
    check: diagnostic.provider,
    result: `${diagnostic.reason}; ${probeFailureMessage(probe, t)}`,
    state: diagnostic.auth,
    actual: [diagnostic.httpStatus === undefined ? '' : `HTTP ${String(diagnostic.httpStatus)}`,
      diagnostic.systemCode, `${String(probe.durationMs)} ms`].filter(Boolean).join('; '),
    recovery: t(diagnostic.reason === 'rpc' ? 'webSearchProbeRecoveryReload'
      : ['auth', 'key-missing', 'forbidden'].includes(diagnostic.reason) ? 'webSearchProbeRecoveryKey'
        : ['quota', 'rate-limit'].includes(diagnostic.reason) ? 'webSearchProbeRecoveryQuota' : 'webSearchProbeRecoveryNetwork'),
  };
}
