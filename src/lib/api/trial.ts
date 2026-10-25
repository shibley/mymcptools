/**
 * A KEYLESS, CAPPED TRIAL OF THE KEY-GATED /api/v1 ENDPOINTS.
 *
 * THE MEASURED DEFECT THIS EXISTS TO KILL (npm run demand:report, 30d to
 * 2026-09-28):
 *
 *     7 non-crawler callers hit a key-gated paywall
 *     3 of those 7 followed the buy link        (43% — the road WORKS)
 *     4 checkout sessions reached Stripe
 *     0 paid                                    <- 100% loss, every time
 *
 * Three fires in a row have built the road up to and through that paywall: the
 * 401 carries a price, a one-GET checkout URL, entry attribution, and (since
 * 91888d0) a row-count coverage table so we cannot sell a signal we hold zero
 * rows of. The road is not the problem. What is left is the thing no amount of
 * copy can fix:
 *
 *     NOBODY HAS EVER SEEN A SINGLE ROW OF THE DATA WE CHARGE $49/mo FOR.
 *
 * `src/data/api-keys.json` has never held a key. 100% of traffic to /v1/drift,
 * /v1/export, /v1/digest and /v1/incidents has been a 401 for the entire life
 * of the endpoint. The free tier (/v1/status, /v1/stats,
 * /v1/servers/{slug}/status) deliberately does NOT overlap them — so the
 * sharpest thing a prospect can learn for free is what the paid data is CALLED.
 * A buyer is being asked to pay first and evaluate second, and the buyers here
 * are programs: an agent that cannot evaluate does not buy, it leaves.
 *
 * This is the same structural shape as the keyless free tier (a zero caused by
 * unreachability, not by absent demand) one level up the ladder, and the same
 * fix: make the thing reachable, then read the meter.
 *
 * WHAT THE TRIAL IS
 *   A keyless, non-crawler caller who reaches for a gated endpoint gets the
 *   REAL payload, computed by the real handler off the real stores — truncated
 *   to TRIAL_ROW_CAP rows, TRIAL_CALLS_PER_CALLER_PER_DAY calls per caller per
 *   UTC day, TRIAL_GLOBAL_PER_DAY calls in total per UTC day. No key, no email,
 *   no account, no browser: the whole point is that a discovering agent can
 *   evaluate the dataset without a human leaving the protocol.
 *
 *   Every trial response carries `rows_withheld` and the upgrade path, so the
 *   ask lands on a caller who has just seen the goods rather than on one who
 *   has seen a 401.
 *
 * WHAT IT IS NOT
 *   - Not for crawlers. A census scanner consumes the day's budget and buys
 *     nothing; classified crawlers (and our own ?probe=1) still get the 401
 *     path unless explicitly granted, see `trialEligible`.
 *   - Not an unbounded free tier. TRIAL_ROW_CAP is deliberately far below the
 *     smallest useful working set (2,440 catalog rows on /export, 200-row page
 *     on /drift), so the trial proves the shape and the freshness of the data
 *     and cannot substitute for the product.
 *   - Not a new store. Metering reads the `trustapi-gated` rows that
 *     `authenticateGated` ALREADY writes before the handler runs.
 */
import { GATED_ENDPOINTS, type GatedEndpoint } from "./checkout-entry";

/** Rows any single trial response may return from a collection. */
export const TRIAL_ROW_CAP = 10;
/** Trial calls one caller identity may make per UTC day, across all endpoints. */
export const TRIAL_CALLS_PER_CALLER_PER_DAY = 3;
/** Trial calls served in total per UTC day, across all callers. */
export const TRIAL_GLOBAL_PER_DAY = 300;

/**
 * The `utm_source` the trial meter counts. Deliberately the SAME source the
 * gated 401s already use: a trial call is a gated call, and mixing it into the
 * free-tier `trustapi` figure would inflate the one number on this property
 * that is a real demand measurement. Trial rows are separated from 401s by
 * `utm_medium` (TRIAL_TIER) instead — see TRIAL_EVENT_SOURCE's use in
 * src/lib/analytics/trust-api-usage.ts, and the `trial` block in
 * `npm run demand:report`.
 */
export const TRIAL_EVENT_SOURCE = "trustapi-gated";
/** `utm_medium` on a row the trial actually served. */
export const TRIAL_TIER = "trial";
/** `utm_medium` on a row that wanted a trial and had none left. */
export const TRIAL_EXHAUSTED_TIER = "trial-exhausted";

/** Which gated endpoints the trial serves, and why the rest do not. */
export const TRIAL_ENDPOINTS: readonly GatedEndpoint[] = [
  "/api/v1/drift",
  "/api/v1/export",
  "/api/v1/digest",
  "/api/v1/incidents",
];

/**
 * The two gated endpoints the trial does NOT cover, with the reason, so this is
 * a stated decision rather than an omission. Both are per-slug lookups a caller
 * can only reach by already knowing a slug, and neither was reached by a single
 * non-crawler caller in the 30-day window that motivated the trial — so neither
 * is on the measured loss path, and a truncated single-subject answer is not a
 * sample of anything.
 */
export const TRIAL_EXCLUDED: ReadonlyArray<{ endpoint: string; why: string }> = [
  {
    endpoint: "/api/v1/firewall/check",
    why: "single-subject verdict; a capped verdict is a wrong verdict, not a sample",
  },
  {
    endpoint: "/api/v1/servers/:slug/history",
    why: "per-slug series; 0 non-crawler callers in 30d, not on the loss path",
  },
];

export function isTrialEndpoint(endpoint: string): endpoint is GatedEndpoint {
  return (TRIAL_ENDPOINTS as readonly string[]).includes(endpoint);
}

/** Every trial endpoint must be a real gated endpoint — no drifting strings. */
export function trialEndpointsAreGated(): boolean {
  return TRIAL_ENDPOINTS.every((e) =>
    (GATED_ENDPOINTS as readonly string[]).includes(e)
  );
}

/** Today's trial usage, as counted out of the warehouse. */
export interface TrialUsage {
  /** Trial calls this caller identity has already been served today. */
  caller: number;
  /** Trial calls served to everyone today, excluding our own probes. */
  global: number;
}

export type TrialDenial = "not_trial_endpoint" | "caller_cap" | "global_cap";

/** A granted trial: how much data this response may return, and what is left. */
export interface TrialGrant {
  endpoint: GatedEndpoint;
  rowCap: number;
  /** Calls left for this caller AFTER the one being granted. */
  callsRemainingToday: number;
}

export type TrialDecision =
  | { granted: true; grant: TrialGrant }
  | { granted: false; reason: TrialDenial };

/**
 * Pure policy: given the endpoint and today's counts, may this keyless caller
 * have a trial? Eligibility (keyless, non-crawler) is decided by the caller of
 * this function; this half is the arithmetic, so it is testable without a DB.
 */
export function decideTrial(endpoint: string, usage: TrialUsage): TrialDecision {
  if (!isTrialEndpoint(endpoint)) return { granted: false, reason: "not_trial_endpoint" };
  if (usage.caller >= TRIAL_CALLS_PER_CALLER_PER_DAY)
    return { granted: false, reason: "caller_cap" };
  if (usage.global >= TRIAL_GLOBAL_PER_DAY)
    return { granted: false, reason: "global_cap" };
  return {
    granted: true,
    grant: {
      endpoint,
      rowCap: TRIAL_ROW_CAP,
      callsRemainingToday: Math.max(
        0,
        TRIAL_CALLS_PER_CALLER_PER_DAY - usage.caller - 1
      ),
    },
  };
}

/**
 * Truncate a collection to the grant's row cap and report what was withheld.
 * Routes call this instead of slicing by hand so `rows_withheld` can never
 * disagree with the array actually serialised.
 */
export function capRows<T>(
  rows: readonly T[],
  grant: TrialGrant | null
): { rows: readonly T[]; withheld: number } {
  if (!grant) return { rows, withheld: 0 };
  if (rows.length <= grant.rowCap) return { rows, withheld: 0 };
  return { rows: rows.slice(0, grant.rowCap), withheld: rows.length - grant.rowCap };
}

/**
 * The `trial` block a trial response carries. `rows_withheld` is the ask: it is
 * the only honest way to state what the $49 adds, because it is measured
 * against what this caller just received rather than asserted.
 */
export interface TrialBlockInput {
  grant: TrialGrant;
  rowsReturned: number;
  rowsWithheld: number;
  priceUsdMonth: number;
  checkoutUrl: string;
  upgradeUrl: string;
  coverage: unknown;
}

export function trialBlock(input: TrialBlockInput) {
  const { grant, rowsReturned, rowsWithheld } = input;
  return {
    trial: true,
    message:
      `Keyless trial of ${grant.endpoint}: real data from the live stores, ` +
      `capped at ${grant.rowCap} rows. No key, no account, no browser. ` +
      `${rowsWithheld} more row(s) are behind a Pro key` +
      ` ($${input.priceUsdMonth}/mo, one GET: ${input.checkoutUrl}).`,
    row_cap: grant.rowCap,
    rows_returned: rowsReturned,
    rows_withheld: rowsWithheld,
    calls_remaining_today: grant.callsRemainingToday,
    calls_per_day: TRIAL_CALLS_PER_CALLER_PER_DAY,
    full_access: {
      price_usd_month: input.priceUsdMonth,
      checkout_url: input.checkoutUrl,
      upgrade_url: input.upgradeUrl,
      /** Same generated, count-backed table the 401 carries (pro-offer.ts). */
      coverage: input.coverage,
    },
  };
}
