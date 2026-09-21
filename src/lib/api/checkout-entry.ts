/**
 * The last missing link in the $49/mo path: a checkout URL a PROGRAM can follow,
 * and attribution that survives from the 401 to the Stripe session.
 *
 * WHERE THE PATH BROKE (measured 2026-09-21). Two fires already built the road
 * up to the paywall: every key-gated 401 now carries a price and a URL
 * (src/lib/api/auth.ts) and every free-tier body points at the gated endpoints
 * (src/lib/api/pro-pointer.ts). But every one of those URLs landed on
 * `/developers#pro` — an HTML marketing page whose buy button is a React form
 * that POSTs JSON. The caller receiving the 401 is a script or an agent: it
 * cannot fill in a form, and `GET /api/trust-api/checkout` was a 405. So the
 * entire machine-facing funnel terminated one click short of Stripe.
 *
 * And nothing downstream of the 401 was measured at all. No row was written
 * when anyone opened checkout, and the Stripe session carried no record of
 * which endpoint or pointer sent them, so "do pointer-attributed callers
 * convert better than direct ones?" had no answer for the same structural
 * reason the gated 401s had none before they were recorded: the data was never
 * written, not absent because demand was zero.
 *
 * This module is the pure half of the fix — URL construction, entry parsing and
 * the Stripe metadata shape — kept free of Stripe and Next so the self-check
 * can exercise it without minting a live checkout session.
 */
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://mymcptools.com";

/**
 * The attribution vocabulary also lives here rather than in pro-pointer.ts, so
 * that the dependency graph stays a DAG: auth.ts and pro-pointer.ts both need
 * it, and pro-pointer.ts already depends on auth.ts.
 *
 * Free endpoints that emit a pointer into the paid tier. Closed set: `via` is
 * never free text.
 */
export const POINTER_SOURCES = ["status", "stats", "server-status"] as const;
export type PointerSource = (typeof POINTER_SOURCES)[number];

/** The one priced surface on this property. */
export const CHECKOUT_PATH = "/api/trust-api/checkout";

/**
 * Closed set of key-gated endpoints, mirroring the `authenticateGated(req, ...)`
 * call sites. Closed because `endpoint` travels into Stripe metadata and into
 * an analytics column: free text from a caller-controlled query string has no
 * business in either.
 */
export const GATED_ENDPOINTS = [
  "/api/v1/digest",
  "/api/v1/drift",
  "/api/v1/export",
  "/api/v1/incidents",
  "/api/v1/firewall/check",
  "/api/v1/servers/:slug/history",
] as const;
export type GatedEndpoint = (typeof GATED_ENDPOINTS)[number];

/** How a buyer arrived at checkout. */
export type EntryKind =
  | "gate" // bounced off a key-gated 401/429
  | "pointer" // followed a free-tier `pro` URL into a gate, then the gate's buy link
  | "page" // the /developers marketing page form
  | "direct"; // opened the checkout URL with no attribution

export interface CheckoutEntry {
  kind: EntryKind;
  /** The gated endpoint they were denied, when known. */
  endpoint: GatedEndpoint | null;
  /** The free endpoint whose pointer started the walk, when known. */
  via: PointerSource | null;
}

function isGated(v: string | null): v is GatedEndpoint {
  return !!v && (GATED_ENDPOINTS as readonly string[]).includes(v);
}
function isVia(v: string | null): v is PointerSource {
  return !!v && (POINTER_SOURCES as readonly string[]).includes(v);
}

/**
 * The followable buy URL handed to a machine caller. `endpoint` is the gate it
 * just bounced off; `via` is carried through from the free-tier pointer that
 * walked it there, so a three-hop path (free body -> gated 401 -> checkout)
 * stays attributable end to end.
 */
export function checkoutUrl(opts: {
  endpoint?: string | null;
  via?: string | null;
  site?: string;
} = {}): string {
  const u = new URL(CHECKOUT_PATH, opts.site || SITE);
  if (isGated(opts.endpoint ?? null)) u.searchParams.set("endpoint", opts.endpoint as string);
  if (isVia(opts.via ?? null)) u.searchParams.set("via", opts.via as string);
  return u.toString();
}

/** Read the attribution off an inbound checkout request. Unknown values drop. */
export function readCheckoutEntry(url: URL | null | undefined): CheckoutEntry {
  const ep = url?.searchParams.get("endpoint") ?? null;
  const via = url?.searchParams.get("via") ?? null;
  const from = url?.searchParams.get("from") ?? null;
  const endpoint = isGated(ep) ? ep : null;
  const source = isVia(via) ? via : null;
  const kind: EntryKind = endpoint
    ? source
      ? "pointer"
      : "gate"
    : from === "developers"
      ? "page"
      : source
        ? "pointer"
        : "direct";
  return { kind, endpoint, via: source };
}

/**
 * The `referrer_full` value a checkout-start row carries. Same convention as
 * the gated rows' `pointer:<via>` tag, so both meters read with one `like`.
 */
export function entryTag(entry: CheckoutEntry): string {
  return `entry:${entry.kind}:${entry.endpoint ?? "-"}:${entry.via ?? "-"}`;
}

/**
 * Attribution written onto the Stripe Checkout Session. Stripe metadata is the
 * only store that survives to the paid event — the webhook reads it, so a
 * subscription that actually converts can be traced back to the endpoint whose
 * 401 sold it. All values are strings (Stripe rejects anything else).
 */
export function stripeEntryMetadata(entry: CheckoutEntry): Record<string, string> {
  return {
    entry_kind: entry.kind,
    entry_endpoint: entry.endpoint ?? "",
    entry_via: entry.via ?? "",
  };
}
