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
  | "server-page" // the buy button under a /servers/[slug] Trust verdict
  | "direct"; // opened the checkout URL with no attribution

/**
 * A catalog slug as it may travel into Stripe metadata and an analytics tag.
 * Shape-checked, not looked up: this module stays free of the 2,458-row
 * catalog so the self-checks can import it cheaply. Anything else drops.
 */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;
function isSlug(v: string | null): v is string {
  return !!v && SLUG_RE.test(v);
}

/**
 * Whether the caller had SEEN the data before following the buy link. Closed
 * set, orthogonal to `kind`: a sampled caller still reached the checkout from a
 * gated endpoint (`kind: "gate"`), so the trial is its own axis rather than a
 * fifth kind — folding it into `kind` would silently drop it from every
 * `entry in ('gate','pointer')` meter that already exists.
 *
 *   sampled   — followed the link in a capped trial response (it saw rows)
 *   exhausted — followed the link in the trial_exhausted 401 (it saw rows on
 *               an earlier call today, came back, and was capped)
 *
 * Without it the trial's buy link was byte-identical to a bare 401's, so the
 * one question the trial exists to answer — does seeing the data sell it? —
 * could not be read from a checkout row or from Stripe metadata.
 */
export const TRIAL_STAGES = ["sampled", "exhausted"] as const;
export type TrialStage = (typeof TRIAL_STAGES)[number];

export interface CheckoutEntry {
  kind: EntryKind;
  /** Set when the buy link came from a trial response; null for a bare 401. */
  trial: TrialStage | null;
  /** The gated endpoint they were denied, when known. */
  endpoint: GatedEndpoint | null;
  /** The free endpoint whose pointer started the walk, when known. */
  via: PointerSource | null;
  /**
   * The /servers/[slug] page whose buy button was pressed (kind "server-page"
   * only). Optional so every entry built before the server-page door existed
   * keeps its exact shape — in metadata, tags and the intent self-check.
   */
  server?: string | null;
}

function isGated(v: string | null): v is GatedEndpoint {
  return !!v && (GATED_ENDPOINTS as readonly string[]).includes(v);
}
function isVia(v: string | null): v is PointerSource {
  return !!v && (POINTER_SOURCES as readonly string[]).includes(v);
}
function isTrialStage(v: string | null): v is TrialStage {
  return !!v && (TRIAL_STAGES as readonly string[]).includes(v);
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
  trial?: TrialStage | null;
  site?: string;
} = {}): string {
  const u = new URL(CHECKOUT_PATH, opts.site || SITE);
  if (isGated(opts.endpoint ?? null)) u.searchParams.set("endpoint", opts.endpoint as string);
  if (isVia(opts.via ?? null)) u.searchParams.set("via", opts.via as string);
  if (isTrialStage(opts.trial ?? null)) u.searchParams.set("trial", opts.trial as string);
  return u.toString();
}

/** Read the attribution off an inbound checkout request. Unknown values drop. */
export function readCheckoutEntry(url: URL | null | undefined): CheckoutEntry {
  const ep = url?.searchParams.get("endpoint") ?? null;
  const via = url?.searchParams.get("via") ?? null;
  const from = url?.searchParams.get("from") ?? null;
  const t = url?.searchParams.get("trial") ?? null;
  const trial = isTrialStage(t) ? t : null;
  const endpoint = isGated(ep) ? ep : null;
  const source = isVia(via) ? via : null;
  const kind: EntryKind = endpoint
    ? source
      ? "pointer"
      : "gate"
    : from === "developers"
      ? "page"
      : from === "server-page"
        ? "server-page"
        : source
          ? "pointer"
          : "direct";
  const srv = url?.searchParams.get("server") ?? null;
  if (kind === "server-page") {
    return { kind, trial, endpoint, via: source, server: isSlug(srv) ? srv : null };
  }
  return { kind, trial, endpoint, via: source };
}

/**
 * The `referrer_full` value a checkout-start row carries. Same convention as
 * the gated rows' `pointer:<via>` tag, so both meters read with one `like`.
 * The trial stage is APPENDED as a fifth segment only when present, so every
 * row written before it existed still parses as the same four-part tag.
 */
export function entryTag(entry: CheckoutEntry, plan?: "pro" | "pass"): string {
  const base = `entry:${entry.kind}:${entry.endpoint ?? "-"}:${entry.via ?? "-"}`;
  const withTrial = entry.trial ? `${base}:trial-${entry.trial}` : base;
  // `:plan-pass` marks the $9 one-time key (src/lib/api/pass.ts). It sits
  // BEFORE `:server-<slug>` because demand:report reads the slug as the tail.
  const withPlan = plan === "pass" ? `${withTrial}:plan-pass` : withTrial;
  return entry.server ? `${withPlan}:server-${entry.server}` : withPlan;
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
    entry_trial: entry.trial ?? "",
    ...(entry.server ? { entry_server: entry.server } : {}),
  };
}

/**
 * The form action under a server page's Trust verdict. A POST, not a link:
 * 2,458 server pages are crawled daily, and a GET href to a URL that mints a
 * live Stripe session would be followed by every crawler the UA list misses
 * (the FOSSIL_UA fleet minted 8 of 10 sessions/30d that way). Crawlers do not
 * submit forms; a person pressing the button lands on Stripe in one hop.
 */
export function serverPageCheckoutAction(slug: string, plan: "pro" | "pass" = "pro"): string {
  const qs = new URLSearchParams({ from: "server-page" });
  if (isSlug(slug)) qs.set("server", slug);
  if (plan === "pass") qs.set("plan", "pass");
  return `${CHECKOUT_PATH}?${qs.toString()}`;
}
