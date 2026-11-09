import assert from 'node:assert/strict';
import { test } from 'node:test';
import { presentFailure } from '../diagnostics.ts';
import { locales } from '../locales.ts';

const observedAt = '2026-11-09T11:45:02.966Z';

test('environment failures suggest an update rather than waiting for a watcher that cannot start', () => {
  for (const language of ['en', 'zh']) {
    const t = key => locales[language][key];
    const feedback = presentFailure({ state: 'unavailable', stage: 'environment', check: 'mutation-observer',
      result: 'unsupported', expected: 'available', actual: 'missing' }, observedAt, t);
    assert.equal(feedback.code, 'PD-BACKGROUND-ENVIRONMENT');
    assert.equal(feedback.context.recovery, t('flowingBackgroundRecoveryUpdate'));
    assert.ok(!feedback.message.includes(t('flowingBackgroundRecoveryWait')));
    assert.equal(feedback.context.check, 'mutation-observer');
    assert.equal(feedback.context.expected, 'available');
    assert.equal(feedback.context.actual, 'missing');
    assert.equal(feedback.observedAt, observedAt);
  }
});

test('initialization failures retain a distinct operation and offer a bounded user retry', () => {
  for (const language of ['en', 'zh']) {
    const t = key => locales[language][key];
    const feedback = presentFailure({ state: 'unavailable', stage: 'initialization', check: 'attachment.initialize',
      result: 'failed', expected: 'completed', actual: 'exception' }, observedAt, t);
    assert.equal(feedback.code, 'PD-BACKGROUND-INIT');
    assert.equal(feedback.operation, 'flowing-background.attach');
    assert.equal(feedback.context.recovery, t('flowingBackgroundRecoveryRetry'));
    assert.equal(feedback.context.state, t('flowingBackgroundStatePreserved'));
    assert.ok(feedback.context.stage.startsWith('initialization ('));
    assert.ok(feedback.context.result.startsWith('failed ('));
    assert.ok(feedback.message.includes(t('flowingBackgroundInitializationFailed')));
  }
});
