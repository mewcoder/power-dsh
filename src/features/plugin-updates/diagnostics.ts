import type { PluginUpdateDiagnostic } from '../../shared/types/wire.ts';
import type { DiagnosticContext } from '../../shared/types/diagnostics.ts';
import type { Translate } from '../../shared/client/types.ts';

const stages = ['release.rpc', 'git.resolve', 'git.tags', 'release.latest', 'release.asset',
  'market.capabilities', 'market.updates', 'market.submit', 'market.operation', 'update.validation', 'update.resume'] as const;
const reasons = ['unavailable', 'not-found', 'process-exit', 'incomplete-output', 'http', 'invalid-response',
  'tag-mismatch', 'timeout', 'cancelled', 'network', 'rate-limited', 'identity-changed', 'unknown-result',
  'dns', 'proxy', 'certificate', 'authentication', 'connection'] as const;
const systemCodes = ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENETUNREACH',
  'EHOSTUNREACH', 'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'SELF_SIGNED_CERT_IN_CHAIN', 'ERR_TLS_CERT_ALTNAME_INVALID', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET'] as const;

export function networkCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return;
  const value = error as { code?: unknown; cause?: { code?: unknown } };
  const code = value.cause?.code ?? value.code;
  return systemCodes.find(known => known === code);
}

export function parseUpdateDiagnostic(value: unknown): PluginUpdateDiagnostic | undefined {
  if (value === undefined) return;
  if (typeof value !== 'object' || value === null) throw new TypeError('Invalid update diagnostic');
  const data = value as Record<string, unknown>;
  const stage = stages.find(item => item === data.stage);
  const reason = reasons.find(item => item === data.reason);
  if (!stage || !reason || typeof data.observedAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(data.observedAt)
    || !Number.isFinite(Date.parse(data.observedAt))) throw new TypeError('Invalid update diagnostic');
  const result: PluginUpdateDiagnostic = { stage, reason, observedAt: data.observedAt };
  for (const [key, minimum, maximum] of [['httpStatus', 100, 599], ['exitCode', -2147483648, 2147483647], ['elapsedMs', 0, 86400000]] as const) {
    if (data[key] === undefined) continue;
    if (!Number.isSafeInteger(data[key]) || Number(data[key]) < minimum || Number(data[key]) > maximum) throw new TypeError('Invalid update diagnostic');
    result[key] = Number(data[key]);
  }
  if (data.systemCode !== undefined) {
    const code = systemCodes.find(item => item === data.systemCode);
    if (!code) throw new TypeError('Invalid update diagnostic');
    result.systemCode = code;
  }
  return result;
}

export class UpdateFailure extends Error {
  diagnostic: PluginUpdateDiagnostic;
  constructor(key: string, diagnostic: PluginUpdateDiagnostic) {
    super(key);
    this.diagnostic = diagnostic;
  }
}

export function updateDiagnosticContext(diagnostic: PluginUpdateDiagnostic | null, version: string, phase: string, t: Translate): DiagnosticContext {
  if (!diagnostic) return { stage: 'release.rpc', result: t('pluginUpdateDiagnosticUnavailable'), state: `PowerDSH ${version}; ${phase}` };
  return {
    stage: `${diagnostic.stage} (${t(`pluginUpdateStage_${diagnostic.stage}`)})`,
    check: diagnostic.stage === 'git.tags' ? 'git.ls-remote --tags'
      : diagnostic.stage.startsWith('release.') && diagnostic.stage !== 'release.rpc' ? 'github.HEAD'
        : diagnostic.stage.startsWith('market.') ? 'dsh-market.update-api.v1' : undefined,
    result: `${diagnostic.reason} (${t(`pluginUpdateReason_${diagnostic.reason}`)})`,
    expected: diagnostic.stage === 'git.tags' ? 'exit 0; complete tag output'
      : diagnostic.stage === 'release.latest' ? 'HTTP 302; stable tag present in Git'
        : diagnostic.stage === 'release.asset' ? 'HTTP 302; official HTTPS asset redirect'
          : diagnostic.stage.startsWith('market.') ? 'HTTP 2xx; dsh-market/update-api/v1' : undefined,
    actual: [diagnostic.httpStatus !== undefined ? `HTTP ${diagnostic.httpStatus}` : '',
      diagnostic.exitCode !== undefined ? `exit ${diagnostic.exitCode}` : '', diagnostic.systemCode,
      diagnostic.elapsedMs !== undefined ? `${diagnostic.elapsedMs} ms` : ''].filter(Boolean).join('; ') || undefined,
    state: `PowerDSH ${version}; ${phase}`,
    recovery: t(diagnostic.reason === 'not-found' ? 'pluginUpdateRecoveryGit'
      : diagnostic.stage.startsWith('market.') ? 'pluginUpdateRecoveryMarket'
        : diagnostic.reason === 'tag-mismatch' || diagnostic.reason === 'invalid-response' ? 'pluginUpdateRecoveryRelease' : 'pluginUpdateRecoveryNetwork'),
  };
}
