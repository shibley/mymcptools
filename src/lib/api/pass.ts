/**
 * THE $9 ONE-TIME 30-DAY KEY — the second price on the server-page door.
 *
 * WHY A ONE-TIME TIER EXISTS (2026-10-05, retry of bf6b825). The $49/mo
 * subscription is the only way to buy a key, and it has 0 payers lifetime:
 * 0 of 2,422 non-crawler callers who reached a key gate in 30 days, and 0 of
 * 33 human sessions exposed to the server-page button since 2026-10-03. The
 * only stranger who has ever paid this property anything paid $9, once
 * (2026-09-03, a Featured listing) — not a subscription. Shib's standing
 * pricing rule for tool-type properties is credit/one-time over subscriptions
 * ("seasonal usage, no cancel guilt"). A reader of a server page who wants to
 * screen a batch of servers this week has no way to buy a week of data
 * without signing up for a recurring bill; this is that way.
 *
 * Same key, same endpoints, same 120 req/min — it simply stops opening the
 * gated endpoints 30 days after purchase. Nothing renews, nothing to cancel.
 * $49/mo stays live next to it: the two are read against each other in
 * `npm run demand:report` (door block, presses by plan).
 */

export type TrustApiPlan = "pro" | "pass";

/** Stored on the key record and in Stripe metadata (`plan`). */
export const PASS_PLAN_ID = "pass-30d";
export const PASS_PRICE_CENTS = 900;
export const PASS_PRICE_USD = PASS_PRICE_CENTS / 100;
export const PASS_DAYS = 30;

/** `?plan=pass` selects the one-time key; anything else is the $49/mo plan. */
export function readPlan(url: URL | null | undefined): TrustApiPlan {
  return url?.searchParams.get("plan") === "pass" ? "pass" : "pro";
}

export function passExpiresAt(createdAt: string | Date): Date {
  const t = new Date(createdAt).getTime();
  return new Date(t + PASS_DAYS * 86_400_000);
}

/**
 * Whether a stored key opens the gated endpoints right now. A subscription key
 * is live while active; a pass key is live while active AND inside its window.
 */
export function keyIsLive(
  rec: { plan?: string; status?: string; created_at?: string },
  now: Date = new Date()
): boolean {
  if (rec.status !== "active") return false;
  if (rec.plan !== PASS_PLAN_ID) return true;
  if (!rec.created_at) return false;
  return passExpiresAt(rec.created_at).getTime() > now.getTime();
}

/** SQL predicate twin of keyIsLive() for analytics.mcpt_api_keys. */
export const LIVE_KEY_SQL = `status = 'active' AND (plan IS DISTINCT FROM '${PASS_PLAN_ID}' OR created_at > now() - interval '${PASS_DAYS} days')`;
