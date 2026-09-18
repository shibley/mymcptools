/**
 * rel for an anchor that points at a LISTING's own property (its website or
 * its repository).
 *
 * WHY THIS EXISTS (thread #262, 2026-09-17). Every listing page rendered
 * "Visit Website" and "View on GitHub" with `rel="noopener noreferrer"` — a
 * followed link — for free and paid rows alike. The property has exactly one
 * paid listing (Coinrule, $9 Featured, Stripe-confirmed 2026-09-09), and
 * /servers/coinrule served a followed link to coinrule.com: 1 of 1 paid units
 * was a paid link without a paid-link qualifier. Search engines treat that as
 * a link scheme; the qualifier is `sponsored`. Free editorial listings keep a
 * followed link — that is an editorial citation and is the point of listing.
 *
 * `paid_placement` is set only from a Stripe line item and `sponsored` only
 * from the sponsored SKU, so money taken is the whole test. Never key this on
 * `featured`: 56 of 57 featured rows are free editorial grants.
 */
type PaidFlags = { paid_placement?: boolean; sponsored?: boolean };

export function isPaidListing(s: PaidFlags): boolean {
  return Boolean(s.paid_placement || s.sponsored);
}

export function listingOutboundRel(s: PaidFlags): string {
  return isPaidListing(s) ? "sponsored noopener noreferrer" : "noopener noreferrer";
}
