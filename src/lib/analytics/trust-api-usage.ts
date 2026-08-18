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
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { AuthTier, RateLimitState, withRateLimitHeaders } from "@/lib/api/auth";
import { classifyCaller, MCP_SITE } from "./mcp-usage";

export const TRUST_API_SOURCE = "trustapi";

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

function salt(): string {
  const explicit = process.env.ANALYTICS_SALT?.trim();
  if (explicit) return explicit;
  const cs = process.env.ANALYTICS_DATABASE_URL || "unsalted";
  return createHash("sha256").update(cs).digest("hex").slice(0, 32);
}

function clientIp(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") || h.get("cf-connecting-ip") || "0.0.0.0";
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

export type TrustApiUsage = {
  headers: Headers;
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
    const utcDate = new Date().toISOString().slice(0, 10);
    const sessionHash = createHash("sha256")
      .update(`${clientIp(h)}|${ua || ""}|${utcDate}|${salt()}`)
      .digest("hex")
      .slice(0, 32);

    // No JSON-RPC on this surface: pass a method so the MCP-specific
    // "bare URL fetch" and "anonymous discovery" rules stay out of it and only
    // the UA list applies.
    const { isCrawler, reason } = classifyCaller(ua, "GET", null);

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
    endpoint,
    tier: auth.tier,
    status: res.status,
  });
  return res;
}
