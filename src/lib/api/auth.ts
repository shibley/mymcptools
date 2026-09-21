// Shared API-key auth + per-key rate limiting for the public v1 trust API
// (PRD P0-7 + P2-1 self-serve paid tier). Keys are valid if they appear in
// either the MCPTOOLS_API_KEYS env var (comma-separated, hand-issued) or the
// committed self-serve store (src/data/api-keys.json, issued via Stripe
// checkout — see src/lib/api/key-store.ts for why it's a committed file
// rather than a live DB).
//
// A subset of read-only endpoints (the verified-liveness subset: /v1/status,
// /v1/stats and /v1/servers/<slug>/status) is ALSO reachable with no key at all
// via `authenticateOpen`. That is deliberate: src/data/api-keys.json has never
// held a single key and no self-serve issuance exists, so the "free JSON feed"
// was structurally unreachable and its caller count was guaranteed zero for
// reasons that had nothing to do with demand. An anonymous caller gets a
// tighter per-IP bucket; presenting a valid key still upgrades to the full
// per-key allowance and the gated endpoints.
//
// Rate limiting is a simple in-memory token bucket keyed by API key. This is
// per-server-instance only; on serverless it bounds burst per warm instance,
// which is sufficient for the v1 abuse-prevention goal. A shared store (Redis)
// can replace this without changing call sites.

import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isActiveStoredKey } from "./key-store";
import { checkoutUrl } from "./checkout-entry";

/** Requests allowed per window, per key. */
const RATE_LIMIT_MAX = 120;
/** Requests allowed per window for an anonymous (keyless) caller. */
const ANON_RATE_LIMIT_MAX = 30;
/** Window length in milliseconds. */
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

// ---- upgrade path --------------------------------------------------------
// A 401 that only says "missing key" is a dead end: a developer who curls a
// gated endpoint has no way to learn a key exists, what it costs, or which
// endpoints they could have had for free. Until now that was the entire
// experience of the six key-gated endpoints, while the only priced surface on
// this property (/api/trust-api/checkout, $49/mo) was reachable solely from a
// marketing page nobody arrives on from an API call. Every auth failure now
// carries the buy path in both the body and the headers.
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://mymcptools.com";
/** Where a caller goes to buy or claim a key. */
export const UPGRADE_URL = `${SITE}/developers#pro`;
/** Monthly price of the Pro key, in whole USD. Mirrors PRO_PRICE_CENTS. */
export const PRO_PRICE_USD = 49;
/** Endpoints a caller can have right now with no key at all. */
const FREE_TIER_ENDPOINTS = [
  "/api/v1/status",
  "/api/v1/stats",
  "/api/v1/servers/{slug}/status",
];

/**
 * Where a gate sends the caller to actually pay. `/developers#pro` is an HTML
 * page with a React form — a script that just got a 401 cannot fill one in, so
 * a rejection also carries the direct, followable checkout URL, tagged with the
 * endpoint that denied it (and the free-tier pointer that led there, if any) so
 * the Stripe session records what sold it. See src/lib/api/checkout-entry.ts.
 */
export interface UpgradeContext {
  /** The key-gated endpoint the caller was denied. */
  endpoint?: string | null;
  /** `?via=` carried in from a free-tier pointer URL. */
  via?: string | null;
}

/** The upgrade block embedded in every auth-failure body. */
function upgradeBlock(ctx: UpgradeContext = {}) {
  const buyUrl = checkoutUrl({ endpoint: ctx.endpoint, via: ctx.via });
  return {
    upgrade_url: UPGRADE_URL,
    /** One GET away from Stripe — no form, no page, no browser required. */
    checkout_url: buyUrl,
    docs_url: `${SITE}/developers`,
    plans: [
      {
        name: "Free",
        price_usd_month: 0,
        rate_limit_per_min: ANON_RATE_LIMIT_MAX,
        key_required: false,
        endpoints: FREE_TIER_ENDPOINTS,
      },
      {
        name: "Pro",
        price_usd_month: PRO_PRICE_USD,
        rate_limit_per_min: RATE_LIMIT_MAX,
        key_required: true,
        endpoints: "all",
        checkout_url: buyUrl,
      },
    ],
  };
}

/**
 * Attach the machine-readable buy path to a response. `Link rel="payment"` and
 * X-MCPTools-Checkout name the URL that actually reaches Stripe; the docs page
 * stays on X-MCPTools-Upgrade for a human reading the headers.
 */
export function withUpgradeHeaders(
  res: NextResponse,
  ctx: UpgradeContext = {}
): NextResponse {
  const buyUrl = checkoutUrl({ endpoint: ctx.endpoint, via: ctx.via });
  res.headers.set("Link", `<${buyUrl}>; rel="payment"`);
  res.headers.set("X-MCPTools-Upgrade", UPGRADE_URL);
  res.headers.set("X-MCPTools-Checkout", buyUrl);
  return res;
}

export interface RateLimitState {
  /** Remaining requests in the current window (X-RateLimit-Remaining). */
  remaining: number;
  /** Max requests per window (X-RateLimit-Limit). */
  limit: number;
  /** Unix epoch seconds when the window resets (X-RateLimit-Reset). */
  resetAt: number;
  /** True once the key has exceeded its allowance this window. */
  exceeded: boolean;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Hand-issued keys (MCPTOOLS_API_KEYS env var) plus committed self-serve keys. */
function allowedKeys(): Set<string> {
  const envKeys = (process.env.MCPTOOLS_API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  return new Set(envKeys);
}

// `isActiveStoredKey` is async, so this must be too. It previously was not:
// `envSet.has(key) || isActiveStoredKey(key)` returned the *Promise* whenever the
// env set missed, and a Promise is truthy — which authenticated every gated /v1
// endpoint for any arbitrary string. tsc flagged it (TS2322) but the build does
// not gate on tsc, so it shipped.
async function isAllowed(key: string): Promise<boolean> {
  return allowedKeys().has(key) || (await isActiveStoredKey(key));
}

/** Extract the API key from `Authorization: Bearer` or `x-api-key`. */
function extractKey(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth) {
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (m) return m[1].trim();
  }
  const header = req.headers.get("x-api-key");
  if (header?.trim()) return header.trim();
  return null;
}

/** Record one request against a bucket and return the resulting state. */
function consume(bucketKey: string, max: number = RATE_LIMIT_MAX): RateLimitState {
  const now = Date.now();
  let bucket = buckets.get(bucketKey);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    buckets.set(bucketKey, bucket);
  }
  bucket.count += 1;
  return {
    remaining: Math.max(0, max - bucket.count),
    limit: max,
    resetAt: Math.ceil(bucket.resetAt / 1000),
    exceeded: bucket.count > max,
  };
}

/**
 * Bucket identity for a keyless caller. Serverless gives us no durable client
 * identity, so the edge-supplied IP is the best available; it is hashed with the
 * UTC date so the in-memory key is not a raw address.
 */
function anonBucketKey(req: NextRequest): string {
  const h = req.headers;
  const ip =
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "0.0.0.0";
  return `anon:${createHash("sha256")
    .update(`${ip}|${new Date().toISOString().slice(0, 10)}`)
    .digest("hex")
    .slice(0, 24)}`;
}

/** Apply X-RateLimit-* headers to a response. */
export function withRateLimitHeaders(
  res: NextResponse,
  state: RateLimitState
): NextResponse {
  res.headers.set("X-RateLimit-Limit", String(state.limit));
  res.headers.set("X-RateLimit-Remaining", String(state.remaining));
  res.headers.set("X-RateLimit-Reset", String(state.resetAt));
  return res;
}

/** Which allowance a request was served under. */
export type AuthTier = "key" | "anonymous";

export type AuthResult =
  | { ok: true; key: string; tier: AuthTier; rate: RateLimitState }
  | { ok: false; response: NextResponse };

/**
 * Authenticate + rate-limit a v1 request. On success returns the key and the
 * post-consume rate state (caller must attach headers to its success response
 * via withRateLimitHeaders). On failure returns a ready-to-return JSON error
 * with the appropriate status + rate-limit headers.
 */
export async function authenticate(
  req: NextRequest,
  ctx: UpgradeContext = {}
): Promise<AuthResult> {
  const key = extractKey(req);
  // A gated caller may have arrived via a free-tier pointer; carry the tag on
  // to the buy URL so the Stripe session knows which free endpoint started it.
  const upgradeCtx: UpgradeContext = {
    endpoint: ctx.endpoint,
    via: ctx.via ?? req.nextUrl?.searchParams.get("via") ?? null,
  };

  if (!key || !(await isAllowed(key))) {
    const res = NextResponse.json(
      {
        error: "unauthorized",
        message: key
          ? "That API key is not active. Get a working one at " +
            checkoutUrl({ endpoint: upgradeCtx.endpoint, via: upgradeCtx.via }) +
            "."
          : "This endpoint needs an API key. Pass it as 'Authorization: Bearer <key>' " +
            "or 'x-api-key: <key>' — buy one in one GET at " +
            checkoutUrl({ endpoint: upgradeCtx.endpoint, via: upgradeCtx.via }) +
            ` ($${PRO_PRICE_USD}/mo), or call the free keyless endpoints listed below.`,
        ...upgradeBlock(upgradeCtx),
      },
      { status: 401 }
    );
    res.headers.set("WWW-Authenticate", 'Bearer realm="mymcptools-trust-api"');
    withUpgradeHeaders(res, upgradeCtx);
    return { ok: false, response: res };
  }

  const rate = consume(key);
  if (rate.exceeded) {
    return { ok: false, response: rateLimitedResponse(rate, upgradeCtx) };
  }

  return { ok: true, key, tier: "key", rate };
}

/**
 * Authenticate a request on a free-tier endpoint: a valid key gets the full
 * per-key allowance, and a keyless caller is served anonymously under a tighter
 * per-IP allowance rather than being rejected. An *invalid* key is still an
 * error — silently downgrading a caller who thinks they are authenticated would
 * hide a broken integration behind a 200.
 */
export async function authenticateOpen(req: NextRequest): Promise<AuthResult> {
  const key = extractKey(req);

  if (key) {
    if (!(await isAllowed(key))) {
      const res = NextResponse.json(
        {
          error: "unauthorized",
          message:
            "Invalid API key. Omit the header entirely to use the free anonymous " +
            `tier, or get a working key at ${UPGRADE_URL}.`,
          ...upgradeBlock(),
        },
        { status: 401 }
      );
      res.headers.set("WWW-Authenticate", 'Bearer realm="mymcptools-trust-api"');
      withUpgradeHeaders(res);
      return { ok: false, response: res };
    }
    const rate = consume(key);
    if (rate.exceeded) return { ok: false, response: rateLimitedResponse(rate) };
    return { ok: true, key, tier: "key", rate };
  }

  const rate = consume(anonBucketKey(req), ANON_RATE_LIMIT_MAX);
  if (rate.exceeded) return { ok: false, response: rateLimitedResponse(rate) };
  return { ok: true, key: "", tier: "anonymous", rate };
}

function rateLimitedResponse(
  rate: RateLimitState,
  ctx: UpgradeContext = {}
): NextResponse {
  const res = NextResponse.json(
    {
      error: "rate_limited",
      message:
        `Rate limit exceeded (${rate.limit}/min). Retry later, or raise it to ` +
        `${RATE_LIMIT_MAX}/min with a Pro key: ${checkoutUrl({ endpoint: ctx.endpoint, via: ctx.via })}.`,
      ...upgradeBlock(ctx),
    },
    { status: 429 }
  );
  withRateLimitHeaders(res, rate);
  withUpgradeHeaders(res, ctx);
  res.headers.set(
    "Retry-After",
    String(Math.max(1, rate.resetAt - Math.floor(Date.now() / 1000)))
  );
  return res;
}
