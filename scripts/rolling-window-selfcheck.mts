/**
 * Self-check for rolling-window failure logic (PRD P0-3 acceptance:
 * "one fail then pass => no flip; 3 consecutive fails => DOWN +
 * status_changed_at updates").
 *
 * Runs the pure applyRollingWindow reducer over scripted probe sequences and
 * asserts the effective verdict, consecutive-failure counter, and
 * status_changed_at behave per spec — no network required.
 *
 * Run: node scripts/rolling-window-selfcheck.mts
 */
import assert from 'node:assert/strict';
import {
  applyRollingWindow,
  isFailureVerdict,
  DEFAULT_FAIL_THRESHOLD,
  type RollingWindowPrev,
} from '../src/lib/trust/rolling-window.ts';
import type { Verdict } from '../src/lib/trust/types.ts';

assert.equal(DEFAULT_FAIL_THRESHOLD, 3, 'default threshold should be 3');
assert.ok(isFailureVerdict('DOWN'));
assert.ok(!isFailureVerdict('GOOD'));
assert.ok(!isFailureVerdict('WARN'));
assert.ok(!isFailureVerdict('AUTH_REQUIRED'));

let t = 0;
const at = () => `2026-06-22T00:0${t++}:00.000Z`;

/** Fold a sequence of raw verdicts starting from a GOOD baseline. */
function fold(seq: Verdict[], baselineAt: string, threshold = DEFAULT_FAIL_THRESHOLD) {
  let prev: RollingWindowPrev = {
    verdict: 'GOOD',
    consecutive_failures: 0,
    status_changed_at: baselineAt,
  };
  const steps = seq.map((raw) => {
    const s = applyRollingWindow(prev, raw, at(), threshold);
    prev = s;
    return s;
  });
  return steps;
}

// 1. One fail then a pass => NO flip (verdict stays GOOD, status_changed_at unchanged).
{
  const baseline = at();
  const [f1, p1] = fold(['DOWN', 'GOOD'], baseline);
  assert.equal(f1.verdict, 'GOOD', 'single failure must not flip to DOWN');
  assert.equal(f1.consecutive_failures, 1);
  assert.equal(f1.flipped, false);
  assert.equal(f1.status_changed_at, baseline, 'status_changed_at must not move on a held failure');
  assert.equal(p1.verdict, 'GOOD');
  assert.equal(p1.consecutive_failures, 0, 'a pass resets the counter');
  assert.equal(p1.status_changed_at, baseline);
}

// 2. Three consecutive fails => DOWN at the 3rd, status_changed_at stamped then.
{
  const baseline = at();
  const [f1, f2, f3] = fold(['DOWN', 'DOWN', 'DOWN'], baseline);
  assert.equal(f1.verdict, 'GOOD');
  assert.equal(f2.verdict, 'GOOD', '2 fails still inside the window');
  assert.equal(f2.consecutive_failures, 2);
  assert.equal(f3.verdict, 'DOWN', '3rd consecutive fail flips to DOWN');
  assert.equal(f3.consecutive_failures, 3);
  assert.equal(f3.flipped, true);
  assert.notEqual(f3.status_changed_at, baseline, 'flip stamps a new status_changed_at');
}

// 3. Recovery after DOWN stamps status_changed_at and resets the counter.
{
  const steps = fold(['DOWN', 'DOWN', 'DOWN', 'DOWN', 'GOOD'], at());
  const down = steps[2];
  const stillDown = steps[3];
  const recovered = steps[4];
  assert.equal(stillDown.verdict, 'DOWN');
  assert.equal(stillDown.consecutive_failures, 4);
  assert.equal(recovered.verdict, 'GOOD', 'a pass after DOWN recovers');
  assert.equal(recovered.consecutive_failures, 0);
  assert.equal(recovered.flipped, true);
  assert.equal(recovered.status_changed_at, recovered.status_changed_at);
  assert.notEqual(recovered.status_changed_at, down.status_changed_at, 'recovery re-stamps');
}

// 4. WARN / AUTH_REQUIRED count as passes (reset the window, taken verbatim).
{
  const [f1, warn] = fold(['DOWN', 'WARN'], at());
  assert.equal(f1.consecutive_failures, 1);
  assert.equal(warn.verdict, 'WARN');
  assert.equal(warn.consecutive_failures, 0, 'WARN resets the window');
}

// 5. Configurable threshold: N=1 flips on the first failure.
{
  const baseline = at();
  const [f1] = fold(['DOWN'], baseline, 1);
  assert.equal(f1.verdict, 'DOWN', 'threshold=1 flips immediately');
  assert.equal(f1.flipped, true);
  assert.notEqual(f1.status_changed_at, baseline);
}

// 6. Never-seen server (no prior) with a first DOWN has no good state to protect.
{
  const s = applyRollingWindow(undefined, 'DOWN', at(), DEFAULT_FAIL_THRESHOLD);
  assert.equal(s.verdict, 'DOWN', 'no prior good state => report observed DOWN');
  assert.equal(s.consecutive_failures, 1);
  assert.equal(s.flipped, true);
}

// 7. Already-DOWN stays DOWN on continued failure without re-stamping.
{
  const baseline = at();
  const steps = fold(['DOWN', 'DOWN', 'DOWN'], baseline);
  const flipAt = steps[2].status_changed_at;
  const more = applyRollingWindow(steps[2], 'DOWN', at(), DEFAULT_FAIL_THRESHOLD);
  assert.equal(more.verdict, 'DOWN');
  assert.equal(more.flipped, false);
  assert.equal(more.status_changed_at, flipAt, 'continued DOWN must not re-stamp');
}

console.log('[rolling-window-selfcheck] OK — all assertions passed');
