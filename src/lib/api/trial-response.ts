/**
 * The response half of the keyless gated trial (policy + arithmetic live in
 * src/lib/api/trial.ts, which stays free of auth/pro-offer so `auth.ts` can
 * import its types without a cycle).
 *
 * One helper per concern so no route can serve a trial that forgets to say it
 * is one, or that quotes a `rows_withheld` its own array disagrees with.
 */
import { NextResponse } from "next/server";
import { PRO_PRICE_USD, UPGRADE_URL, type AuthResult } from "./auth";
import { checkoutUrl } from "./checkout-entry";
import { proCoverageBlock } from "./pro-offer";
import { trialBlock, type TrialGrant } from "./trial";

/** The grant on a successful auth, or null when the caller paid/keyed in. */
export function trialGrant(
  auth: Extract<AuthResult, { ok: true }>
): TrialGrant | null {
  return auth.tier === "trial" ? auth.trial ?? null : null;
}

/**
 * The `trial` block to merge into a trial response body. The ask rides the same
 * one-GET checkout URL the 401 uses, tagged `entry=gate` with the endpoint that
 * served the sample — so a trial-attributed sale is distinguishable in Stripe
 * metadata from one that bounced off a bare 401.
 */
export function trialPayload(
  grant: TrialGrant,
  rowsReturned: number,
  rowsWithheld: number
) {
  return trialBlock({
    grant,
    rowsReturned,
    rowsWithheld,
    priceUsdMonth: PRO_PRICE_USD,
    checkoutUrl: checkoutUrl({ endpoint: grant.endpoint, via: null }),
    upgradeUrl: UPGRADE_URL,
    coverage: proCoverageBlock(),
  });
}

/**
 * Advertise the tier that served the response, and — for a trial — the cap and
 * the buy path in headers too, so a caller that only reads headers (or gets a
 * non-JSON body: `/export?format=csv`, `/digest?format=md`) still learns both.
 */
export function withTrialHeaders(
  res: NextResponse,
  auth: Extract<AuthResult, { ok: true }>
): NextResponse {
  res.headers.set("X-RateLimit-Tier", auth.tier);
  const grant = trialGrant(auth);
  if (!grant) return res;
  res.headers.set("X-MCPTools-Trial", "1");
  res.headers.set("X-MCPTools-Trial-Row-Cap", String(grant.rowCap));
  res.headers.set(
    "X-MCPTools-Trial-Calls-Remaining",
    String(grant.callsRemainingToday)
  );
  const buyUrl = checkoutUrl({ endpoint: grant.endpoint, via: null });
  res.headers.set("Link", `<${buyUrl}>; rel="payment"`);
  res.headers.set("X-MCPTools-Checkout", buyUrl);
  res.headers.set("X-MCPTools-Upgrade", UPGRADE_URL);
  return res;
}
