/**
 * Per-call usage records for the free-tier /api/v1 endpoints, written to the
 * same first-party warehouse as the MCP records (src/lib/analytics/mcp-usage.ts,
 * which documents the column mapping and the privacy model in full).
 *
 * WHY THIS EXISTS: opening the verified-liveness endpoints to keyless callers is
 * only half a demand test — the other half is being able to answer "did anyone
 * pull them?". `src/data/api-keys.json` never held a key, so until now the REST
 * half of the trust API had a caller count of zero for reasons that had nothing
 * to do with demand. These rows are what turn that into a real measurement.
 *
 * Rows are discriminated by `utm_source = 'trustapi'` so they never mix into
 * either the MCP number (`utm_source = 'mcp'`) or any site's pageview metrics.
 * `utm_medium` carries the tier ('anonymous' | 'key') rather than a client name,
 * because a REST caller has no `initialize` handshake to identify itself with.
 *
 * Crawler classification is the UA list from mcp-usage: on a plain JSON GET
 * there is no protocol-level intent signal to read, so an indexer UA is all we
 * have. That makes the consumer count here a ceiling, not a floor — an
 * unidentified scanner counts as a consumer until its pacing says otherwise.
 *
 * Fire-and-forget: every failure is swallowed. Recording usage must never be
 * able to fail an API request.
 */
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import {
  authenticate,
  AuthResult,
  AuthTier,
  RateLimitState,
  withRateLimitHeaders,
} from "@/lib/api/auth";
import { sessionHash as beaconSessionHash } from "@/lib/session-identity";
import { CallerClass, classifyCaller, MCP_SITE } from "./mcp-usage";
import { readVia } from "@/lib/api/pro-pointer";

export const TRUST_API_SOURCE = "trustapi";
/**
 * Separate source for the KEY-GATED endpoints. Deliberately not `trustapi`:
 * the free-tier number in `npm run demand:report` must keep meaning "calls we
 * actually served", and a gated 401 is the opposite of a served call. Mixing
 * them would inflate the one figure this property has that is a real demand
 * measurement.
 */
export const TRUST_API_GATED_SOURCE = "trustapi-gated";

let pool: Pool | null = null;
function getPool(): Pool | null {
  const cs = process.env.ANALYTICS_DATABASE_URL?.replace(/\\n/g, "").trim();
  if (!cs) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: cs,
      ssl: { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 5_000,
    });
    pool.on("error", () => {});
  }
  return pool;
}

function trunc(v: unknown, n: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, n) : null;
}

const INSERT = `
insert into analytics.events
  (site, path, referrer_host, referrer_full, utm_source, utm_medium, utm_campaign,
   session_hash, is_bot, bot_reason, ua, country, screen_w)
values ($1, $2, null, null, $3, $4, $5, $6, $7, $8, $9, $10, null)`;

/**
 * Our own checks against the trust API, marked so they never read as demand.
 *
 * WHY: on 2026-09-18 a sprint fire curl'd /api/v1/digest to confirm the gated
 * meter records in production. It did — as `is_bot = false`, i.e. one
 * "non-crawler caller who wanted the paid data", the exact signal the $49/mo
 * buy-intent alert fires on. A REST caller is a program, so no UA or pacing
 * rule can tell our curl from a prospect's; only a marker we set ourselves can.
 * Same convention as the portfolio's `?probe=1` (replacedbai
 * lib/analytics-probe.ts): the query param for a walk that can only set a URL,
 * plus an `X-Probe: 1` header for scripts that would rather not alter it.
 * Probe rows are still WRITTEN — they prove the recorder is alive — but as
 * `is_bot = true, bot_reason = 'internal-probe'`, which every demand query
 * already excludes.
 */
export const INTERNAL_PROBE_REASON = "internal-probe";

export function isInternalProbe(headers: Headers, url: URL | null): boolean {
  if (headers.get("x-probe") === "1") return true;
  return url?.searchParams.get("probe") === "1";
}

/** Classify a trust-API caller: our own probe first, then the UA list. */
export function classifyTrustApiCaller(headers: Headers, url: URL | null): CallerClass {
  if (isInternalProbe(headers, url)) return { isCrawler: true, reason: INTERNAL_PROBE_REASON };
  // No JSON-RPC on this surface: pass a method so the MCP-specific
  // "bare URL fetch" and "anonymous discovery" rules stay out of it and only
  // the UA list applies.
  return classifyCaller(trunc(headers.get("user-agent"), 512), "GET", null);
}

export type TrustApiUsage = {
  headers: Headers;
  /** Request URL, read only for the `?probe=1` marker. */
  url?: URL | null;
  /** Route identity, e.g. '/api/v1/status' or '/api/v1/servers/:slug/status'. */
  endpoint: string;
  /** 'anonymous' when served keyless, 'key' when a valid key was presented. */
  tier: string;
  status: number;
};

/**
 * Write one usage row. Returns a promise that never rejects; callers should
 * await it, because Vercel freezes the lambda at response time and an
 * un-awaited insert on a cold instance can be dropped mid-flight.
 */
export async function recordTrustApiUsage(u: TrustApiUsage): Promise<void> {
  try {
    const p = getPool();
    if (!p) return; // not provisioned — silently no-op

    const h = u.headers;
    const ua = trunc(h.get("user-agent"), 512);
    const sessionHash = beaconSessionHash(h);

    const { isCrawler, reason } = classifyTrustApiCaller(h, u.url ?? null);

    await p.query(INSERT, [
      MCP_SITE,
      u.endpoint.slice(0, 512),
      TRUST_API_SOURCE,
      trunc(u.tier, 128),
      `GET:${u.status}`,
      sessionHash,
      isCrawler,
      reason,
      ua,
      trunc(h.get("x-vercel-ip-country"), 8),
    ]);
  } catch {
    // Never surface a warehouse problem as an API failure.
  }
}

/**
 * Finish a free-tier response: attach the rate-limit headers, advertise which
 * tier served it, and record the call. One helper so no route can accidentally
 * return a free-tier response that the demand report never sees.
 */
export async function finishFreeTier(
  req: NextRequest,
  endpoint: string,
  auth: { tier: AuthTier; rate: RateLimitState },
  res: NextResponse
): Promise<NextResponse> {
  withRateLimitHeaders(res, auth.rate);
  res.headers.set("X-RateLimit-Tier", auth.tier);
  await recordTrustApiUsage({
    headers: req.headers,
    url: req.nextUrl,
    endpoint,
    tier: auth.tier,
    status: res.status,
  });
  return res;
}

/**
 * Authenticate a KEY-GATED /api/v1 request and record the attempt — including
 * the rejections.
 *
 * WHY THIS EXISTS: the six key-gated endpoints (digest, drift, export,
 * incidents, firewall/check, servers/:slug/history) recorded nothing at all. A
 * caller who wanted exactly the data we charge $49/mo for got a bare 401 and
 * vanished from every log we can query, so "does anyone want the paid tier?"
 * had no answer — the same structural zero that keylessness fixed on the free
 * half. `src/data/api-keys.json` has never held a key, so historically 100% of
 * traffic here was a 401 nobody counted. These rows are the buy-intent meter
 * for /api/trust-api/checkout.
 *
 * Column mapping (analytics.events, same warehouse as the free tier):
 *   utm_source  = 'trustapi-gated'   never mixes into the free-tier figure
 *   utm_medium  = 'anonymous' | 'key'   what the caller presented
 *   utm_campaign= 'GET:<status>'      401 = wanted it, had no key
 *
 * `status` is the AUTH outcome, not the final response status: a request that
 * authenticates and then 400s on a bad param is recorded here as 200. That is
 * intentional — this meter is about who reached for the gate, not about
 * downstream parameter validation.
 *
 * Awaited, never throws: recording is wrapped by recordTrustApiUsage, which
 * swallows everything.
 */
export async function authenticateGated(
  req: NextRequest,
  endpoint: string
): Promise<AuthResult> {
  const auth = await authenticate(req);
  const presented = req.headers.get("authorization") || req.headers.get("x-api-key");

  await recordGatedAttempt({
    headers: req.headers,
    url: req.nextUrl,
    endpoint,
    tier: presented ? "key" : "anonymous",
    status: auth.ok ? 200 : auth.response.status,
  });

  return auth;
}

/**
 * Same columns as INSERT, plus `referrer_full`: 'pointer:<via>' when the caller
 * followed a URL from a free-tier response's `pro` block (src/lib/api/
 * pro-pointer.ts), null otherwise. That is the attribution for whether the
 * free tier's pointer is what walks callers to the paywall.
 */
const GATED_INSERT = `
insert into analytics.events
  (site, path, referrer_host, referrer_full, utm_source, utm_medium, utm_campaign,
   session_hash, is_bot, bot_reason, ua, country, screen_w)
values ($1, $2, null, $11, $3, $4, $5, $6, $7, $8, $9, $10, null)`;

/** The referrer_full value a gated row carries, or null for a direct attempt. */
export function gatedPointerTag(url: URL | null | undefined): string | null {
  const via = readVia(url);
  return via ? `pointer:${via}` : null;
}

/** Write one gated-attempt row. Same insert, different source discriminator. */
async function recordGatedAttempt(u: TrustApiUsage): Promise<void> {
  try {
    const p = getPool();
    if (!p) return;

    const h = u.headers;
    const ua = trunc(h.get("user-agent"), 512);
    const { isCrawler, reason } = classifyTrustApiCaller(h, u.url ?? null);

    await p.query(GATED_INSERT, [
      MCP_SITE,
      u.endpoint.slice(0, 512),
      TRUST_API_GATED_SOURCE,
      trunc(u.tier, 128),
      `GET:${u.status}`,
      beaconSessionHash(h),
      isCrawler,
      reason,
      ua,
      trunc(h.get("x-vercel-ip-country"), 8),
      gatedPointerTag(u.url),
    ]);
  } catch {
    // Never surface a warehouse problem as an API failure.
  }
}
