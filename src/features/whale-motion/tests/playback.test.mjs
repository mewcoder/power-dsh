import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attachLoopPlayback } from '../playback.ts';

class Target extends EventTarget {
  listeners = 0;
  addEventListener(...args) { this.listeners++; super.addEventListener(...args); }
  removeEventListener(...args) { this.listeners--; super.removeEventListener(...args); }
}
function fixture({ hidden = false, reduced = false } = {}) {
  const doc = Object.assign(new Target(), { hidden });
  const motion = Object.assign(new Target(), { matches: reduced });
  const svg = {
    paused: true, time: 1.25,
    pauseAnimations() { this.paused = true; },
    unpauseAnimations() { this.paused = false; },
  };
  const dispose = attachLoopPlayback(svg, doc, motion);
  return { doc, motion, svg, dispose };
}

test('loop starts without hover, pauses while hidden and resumes without restarting the timeline', () => {
  const { doc, motion, svg, dispose } = fixture();
  assert.equal(svg.paused, false);
  doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(svg.paused, true);
  doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(svg.paused, false);
  assert.equal(svg.time, 1.25, 'Visibility never resets the animation phase.');
  dispose();
  assert.equal(svg.paused, true);
  assert.equal(doc.listeners, 0);
  assert.equal(motion.listeners, 0);
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(svg.paused, true);
});

test('reduced motion and an initially hidden page remain paused until both permit animation', () => {
  const { doc, motion, svg, dispose } = fixture({ hidden: true, reduced: true });
  assert.equal(svg.paused, true);
  doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(svg.paused, true);
  motion.matches = false; motion.dispatchEvent(new Event('change'));
  assert.equal(svg.paused, false);
  motion.matches = true; motion.dispatchEvent(new Event('change'));
  assert.equal(svg.paused, true);
  assert.equal(svg.time, 1.25);
  dispose();
});
