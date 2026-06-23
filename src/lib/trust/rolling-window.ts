// Rolling-window failure logic (PRD P0-3).
//
// A server must not flip to DOWN on a single failed probe — a transient blip
// (a timeout, one bad deploy minute, a flaky network hop) should not nuke a
// listing's status. We require N consecutive failed probes (default 3) before
// the derived current_status verdict flips to DOWN, and we only stamp
// status_changed_at at the moment of an actual flip. A pass mid-window resets
// the counter; a recovery after being DOWN also stamps status_changed_at.
//
// The consecutive-failure counter is persisted in the status store so the
// window survives across runs (each run sees only one probe per server).

import type { Verdict } from './types.ts';

/** Consecutive failed probes required before flipping a server to DOWN. */
export const DEFAULT_FAIL_THRESHOLD = 3;

/**
 * A "failure" for rolling-window purposes is a hard DOWN (handshake failed /
 * dead endpoint). GOOD, WARN and AUTH_REQUIRED all mean the server answered in
 * an MCP-meaningful way, so they count as a pass and reset the window.
 */
export function isFailureVerdict(v: Verdict): boolean {
  return v === 'DOWN';
}

export interface RollingWindowPrev {
  verdict?: Verdict;
  consecutive_failures?: number;
  status_changed_at?: string | null;
}

export interface RollingWindowState {
  /** Effective (sticky) verdict after applying the window. */
  verdict: Verdict;
  /** Running count of consecutive DOWN probes; 0 after any pass. */
  consecutive_failures: number;
  /** ISO-8601 timestamp the effective verdict last changed. */
  status_changed_at: string;
  /** True when the effective verdict changed on this run. */
  flipped: boolean;
}

/**
 * Apply rolling-window failure logic for one server given its prior derived
 * state and the raw verdict observed on this run.
 *
 * Below the threshold a failing probe holds the prior (non-DOWN) verdict
 * instead of flipping — so one fail then a pass produces no flip. Only the
 * Nth consecutive failure flips the effective verdict to DOWN and stamps
 * status_changed_at. A pass resets the counter; a pass after DOWN is a
 * recovery and also stamps status_changed_at.
 */
export function applyRollingWindow(
  prev: RollingWindowPrev | undefined,
  rawVerdict: Verdict,
  checkedAt: string,
  threshold: number = DEFAULT_FAIL_THRESHOLD,
): RollingWindowState {
  const prevVerdict = prev?.verdict;
  const prevConsec = prev?.consecutive_failures ?? 0;
  const prevChangedAt = prev?.status_changed_at ?? null;

  let verdict: Verdict;
  let consecutive_failures: number;

  if (isFailureVerdict(rawVerdict)) {
    consecutive_failures = prevConsec + 1;
    const hadProtectableState =
      prevVerdict !== undefined && prevVerdict !== 'UNPROBEABLE';
    if (
      consecutive_failures >= threshold ||
      prevVerdict === 'DOWN' ||
      !hadProtectableState
    ) {
      // Threshold reached, already down, or no prior good state to protect.
      verdict = 'DOWN';
    } else {
      // Inside the window: hold the last confirmed (non-DOWN) verdict.
      verdict = prevVerdict;
    }
  } else {
    // Any non-DOWN probe is a pass: take it verbatim and reset the window.
    consecutive_failures = 0;
    verdict = rawVerdict;
  }

  const flipped = prevVerdict === undefined ? true : verdict !== prevVerdict;
  const status_changed_at = flipped ? checkedAt : (prevChangedAt ?? checkedAt);

  return { verdict, consecutive_failures, status_changed_at, flipped };
}
