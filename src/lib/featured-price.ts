/**
 * The Featured listing price — the one paid listing SKU on mymcptools.
 *
 * $49 one-time since 2026-10-22 (was $9; Shib approved move #1 of
 * memory/research-maker-visibility-pricing-2026-10-22.md). The $9-vs-$49
 * elasticity ladder of thread #325 is closed: lifetime paid listings were one
 * $9 order (Coinrule) and zero at $49, and "Pro" was the same deliverable, so
 * it is folded in here. Charged on a stored Stripe Price so the amount lives in
 * one place a dashboard reader can see.
 *
 * GRANDFATHER. Two makers were quoted $9 by the inbound desk on 2026-10-22
 * (memory/inbound-vendor-desk.md): Arcmira (zeal@arcmira.com) and 10ML
 * (contact@10ml.com). They keep $9 for 14 days, matched server-side on the
 * checkout email's domain — no promo-code box on Stripe's page for everyone
 * else. Expires at the end of 2026-11-05 Pacific; delete the rows after that.
 *
 * Import-free so scripts/listing-tier-selfcheck.mts runs it under plain Node.
 */

export const FEATURED_CENTS = 4900;
export const FEATURED_PRICE = "$49";
/** Product prod_VUViQlx7pscjrz, lookup_key mcpt_featured_49_once. */
export const FEATURED_STRIPE_PRICE_ID = "price_1UTWgtF0z7MFxZQhCxAjGgdL";

export const FEATURED_GRANDFATHER: ReadonlyArray<{ domain: string; cents: number; until: string; why: string }> = [
  { domain: "arcmira.com", cents: 900, until: "2026-11-06T08:00:00Z", why: "quoted $9 by the inbound desk 2026-10-22" },
  { domain: "10ml.com", cents: 900, until: "2026-11-06T08:00:00Z", why: "quoted $9 by the inbound desk 2026-10-22" },
];

export type FeaturedCharge = { cents: number; priceId: string | null; grandfathered: string | null };

/** What a Featured checkout for this email charges at `now`. */
export function featuredCharge(email: string | null | undefined, now: Date = new Date()): FeaturedCharge {
  const domain = String(email || "").trim().toLowerCase().split("@")[1] || "";
  const g = FEATURED_GRANDFATHER.find((row) => row.domain === domain && now.getTime() < Date.parse(row.until));
  if (g) return { cents: g.cents, priceId: null, grandfathered: g.domain };
  return { cents: FEATURED_CENTS, priceId: FEATURED_STRIPE_PRICE_ID, grandfathered: null };
}
