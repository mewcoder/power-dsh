import type { SettingFailure, Translate } from '../../shared/client/types.ts';
import type { AttachmentFailure } from '../../shared/client/background/attachment.ts';
import type { locales } from './locales.ts';

type MessageKey = keyof typeof locales.en;
interface FailureCopy { reason: MessageKey; recovery: MessageKey; }
interface DiagnosticStrategy<R> {
  code: string;
  stage: MessageKey;
  resolve(result: R): FailureCopy;
}

const frameCopy: Record<AttachmentFailure<'frame'>['result'], FailureCopy> = {
  missing: { reason: 'flowingBackgroundFrameMissing', recovery: 'flowingBackgroundRecoveryWait' },
  hidden: { reason: 'flowingBackgroundFrameHidden', recovery: 'flowingBackgroundRecoveryWait' },
  ambiguous: { reason: 'flowingBackgroundFrameAmbiguous', recovery: 'flowingBackgroundRecoveryUpdate' },
  unsupported: { reason: 'flowingBackgroundFrameUnsupported', recovery: 'flowingBackgroundRecoveryUpdate' },
  changed: { reason: 'flowingBackgroundFrameChanged', recovery: 'flowingBackgroundRecoveryRetry' },
};
const resultLabels: Record<AttachmentFailure['result'], MessageKey> = {
  missing: 'flowingBackgroundResultMissing', ambiguous: 'flowingBackgroundResultAmbiguous',
  hidden: 'flowingBackgroundResultHidden', unsupported: 'flowingBackgroundResultUnsupported',
  changed: 'flowingBackgroundResultChanged', failed: 'flowingBackgroundResultFailed',
};

const strategies: { [S in AttachmentFailure['stage']]: DiagnosticStrategy<AttachmentFailure<S>['result']> } = {
  styles: {
    code: 'PD-BACKGROUND-LAYOUT', stage: 'flowingBackgroundStageStyles',
    resolve(result) {
      if (result === 'missing') return { reason: 'flowingBackgroundStylesMissing', recovery: 'flowingBackgroundRecoveryWait' };
      return { reason: 'flowingBackgroundStylesAmbiguous', recovery: 'flowingBackgroundRecoveryUpdate' };
    },
  },
  frame: {
    code: 'PD-BACKGROUND-LAYOUT', stage: 'flowingBackgroundStageFrame',
    resolve: result => frameCopy[result],
  },
  initialization: {
    code: 'PD-BACKGROUND-INIT', stage: 'flowingBackgroundStageInitialization',
    resolve: () => ({ reason: 'flowingBackgroundInitializationFailed', recovery: 'flowingBackgroundRecoveryRetry' }),
  },
  environment: {
    code: 'PD-BACKGROUND-ENVIRONMENT', stage: 'flowingBackgroundStageEnvironment',
    resolve: () => ({ reason: 'flowingBackgroundEnvironmentUnavailable', recovery: 'flowingBackgroundRecoveryUpdate' }),
  },
};

/** Compare only the authored evidence used to identify an observed background fault. */
export function sameFailure(left: AttachmentFailure, right: AttachmentFailure): boolean {
  return left.stage === right.stage && left.check === right.check && left.result === right.result
    && left.expected === right.expected && left.actual === right.actual;
}

/** Select a stage strategy, then assemble localized feedback and stable copyable evidence. */
export function presentFailure<S extends AttachmentFailure['stage']>(issue: AttachmentFailure<S>, observedAt: string, t: Translate): SettingFailure {
  const strategy = strategies[issue.stage];
  const copy = strategy.resolve(issue.result);
  return {
    message: `${t('flowingBackgroundLayoutUnavailable')} ${t(copy.reason)} ${t(copy.recovery)}`,
    code: strategy.code, operation: 'flowing-background.attach', observedAt,
    context: {
      stage: `${issue.stage} (${t(strategy.stage)})`, check: issue.check,
      result: `${issue.result} (${t(resultLabels[issue.result])})`, expected: issue.expected, actual: issue.actual,
      state: t('flowingBackgroundStatePreserved'), recovery: t(copy.recovery),
    },
  };
}
