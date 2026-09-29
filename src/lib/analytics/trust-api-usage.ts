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
  consumeAnonymous,
  PRO_PRICE_USD,
  RateLimitState,
  upgradePayload,
  withRateLimitHeaders,
  withUpgradeHeaders,
} from "@/lib/api/auth";
import {
  decideTrial,
  type TrialDenial,
  type TrialGrant,
  TRIAL_CALLS_PER_CALLER_PER_DAY,
  TRIAL_ROW_CAP,
  TRIAL_EVENT_SOURCE,
  TRIAL_EXHAUSTED_TIER,
  TRIAL_TIER,
  type TrialUsage,
} from "@/lib/api/trial";
import { sessionHash as beaconSessionHash } from "@/lib/session-identity";
import { CallerClass, classifyCaller, MCP_SITE } from "./mcp-usage";
import { readVia } from "@/lib/api/pro-pointer";
import {
  CHECKOUT_PATH,
  entryTag,
  type CheckoutEntry,
} from "@/lib/api/checkout-entry";

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
  // The endpoint travels with the rejection so the 401's checkout URL names the
  // gate that produced it — that is what makes a conversion attributable.
  const auth = await authenticate(req, { endpoint });
  const presented = req.headers.get("authorization") || req.headers.get("x-api-key");

  if (auth.ok) {
    await recordGatedAttempt({
      headers: req.headers,
      url: req.nextUrl,
      endpoint,
      tier: "key",
      status: 200,
    });
    return auth;
  }

  // ---- keyless trial ----------------------------------------------------
  // A 401 is the right answer for a bad key and for a crawler. It is the wrong
  // answer for a keyless program evaluating whether $49/mo of this dataset is
  // worth buying, because it is the ONLY answer that surface has ever given:
  // measured 30d to 2026-09-28, 7 non-crawler callers were denied, 4 reached
  // Stripe and 0 paid, having never seen one row. See src/lib/api/trial.ts.
  const trialWanted = auth.response.status === 401 && !presented;
  if (trialWanted) {
    const outcome = await grantTrial(req, endpoint);
    const grantOrNull = outcome.granted ? outcome.grant : null;
    if (grantOrNull) {
      await recordGatedAttempt({
        headers: req.headers,
        url: req.nextUrl,
        endpoint,
        tier: TRIAL_TIER,
        status: 200,
      });
      return {
        ok: true,
        key: "",
        tier: "trial",
        rate: consumeAnonymous(req),
        trial: grantOrNull,
      };
    }
    // Wanted a trial and hit a CAP. Recorded under its own medium so the demand
    // report can separate "never offered a sample" from "used the sample up and
    // still did not buy" — those are opposite findings.
    //
    // A meter we could not READ is deliberately NOT reported as exhausted: the
    // caller's budget is intact and telling them otherwise is a lie on a buyer
    // surface. They get the ordinary 401, which advertises the trial, and the
    // row lands under 'anonymous' so the trial figures stay true.
    if (!outcome.granted && (outcome.reason === "caller_cap" || outcome.reason === "global_cap")) {
      const exhausted = trialExhaustedResponse(endpoint);
      await recordGatedAttempt({
        headers: req.headers,
        url: req.nextUrl,
        endpoint,
        tier: TRIAL_EXHAUSTED_TIER,
        status: exhausted.status,
      });
      return { ok: false, response: exhausted };
    }
  }

  await recordGatedAttempt({
    headers: req.headers,
    url: req.nextUrl,
    endpoint,
    tier: presented ? "key" : "anonymous",
    status: auth.response.status,
  });

  return auth;
}

/**
 * Is this request even in the running for a trial? Keyless, on a trial
 * endpoint, and either a non-crawler OR one of our own `?probe=1` walks.
 *
 * WHY THE PROBE IS ALLOWED IN: the whole reason the old order-summary copy went
 * 0-for-4 unnoticed is that nobody could read the last screen a buyer sees
 * without minting a cart. A trial payload has the same problem, so `?probe=1`
 * must be able to read the real thing in production. Probe rows are still
 * written as `is_bot = true, bot_reason = 'internal-probe'`, every demand query
 * already excludes them, and `trialUsageToday` excludes them from the GLOBAL
 * budget so our own reads cannot burn a real agent's day.
 */
function isTrialCandidate(req: NextRequest, endpoint: string): boolean {
  if (req.headers.get("authorization") || req.headers.get("x-api-key")) return false;
  const { isCrawler, reason } = classifyTrustApiCaller(req.headers, req.nextUrl);
  if (isCrawler && reason !== INTERNAL_PROBE_REASON) return false;
  return decideTrial(endpoint, { caller: 0, global: 0 }).granted;
}

/**
 * The 401 a caller gets once their daily trial is spent. Deliberately NOT the
 * generic "this endpoint needs an API key": that message is true but useless to
 * someone who has already seen the data, and it is the one moment in the funnel
 * where the ask lands on a caller with first-hand knowledge of what it buys.
 */
function trialExhaustedResponse(endpoint: string): NextResponse {
  const ctx = { endpoint, via: null };
  const res = NextResponse.json(
    {
      error: "trial_exhausted",
      message:
        `Your keyless trial of ${endpoint} is spent for today ` +
        `(${TRIAL_CALLS_PER_CALLER_PER_DAY} calls/day, ${TRIAL_ROW_CAP} rows each). ` +
        `It resets at 00:00 UTC. For uncapped rows and ${endpoint} without a cap, ` +
        `a Pro key is $${PRO_PRICE_USD}/mo and one GET away — see checkout_url below.`,
      ...upgradePayload(ctx),
      // Same `trial` block every auth failure carries, plus the two facts only
      // this response knows: it is spent, and when it comes back.
      trial: {
        ...upgradePayload(ctx).trial,
        exhausted: true,
        resets_at: `${new Date(Date.now() + 86_400_000)
          .toISOString()
          .slice(0, 10)}T00:00:00Z`,
      },
    },
    { status: 401 }
  );
  res.headers.set("WWW-Authenticate", 'Bearer realm="mymcptools-trust-api"');
  res.headers.set("X-MCPTools-Trial", "exhausted");
  withUpgradeHeaders(res, ctx);
  return res;
}

/**
 * Today's trial counts for this caller and for everyone, read out of the rows
 * `recordGatedAttempt` already writes. No new table: the meter for the trial is
 * the same warehouse row that proves the trial happened.
 *
 * A warehouse that cannot be read FAILS CLOSED (no trial). The alternative —
 * serving on a read error — turns a transient DB blip into an uncapped free
 * tier, and this endpoint set includes a full 2,440-row bulk export.
 */
const TRIAL_USAGE_SQL = `
select
  count(*) filter (where session_hash = $2)                            as caller,
  count(*) filter (where coalesce(bot_reason, '') <> $5)               as global
from analytics.events
where site = $1
  and utm_source = $3
  and utm_medium = $4
  and ts >= (date_trunc('day', now() at time zone 'utc')) at time zone 'utc'`;

/**
 * TEST SEAM. The granted-trial path cannot be exercised in-process without a
 * warehouse, and a self-check that can only ever observe the fail-closed 401
 * would guard the least interesting half of the feature. This replaces the
 * counter, nothing else — the decision, the caps, the row truncation and the
 * response shape all still run for real.
 *
 * Refused outright in production: a seam that can raise a caller's remaining
 * trial budget is an authorisation bypass if it is ever reachable on the live
 * deployment, so the guard is the absence of the capability rather than the
 * absence of a caller. `npm run trial:selfcheck` asserts this.
 */
type TrialUsageReader = (sessionHash: string) => Promise<TrialUsage | null>;
let usageReaderOverride: TrialUsageReader | null = null;

export function __setTrialUsageReaderForTests(fn: TrialUsageReader | null): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("__setTrialUsageReaderForTests is not available in production");
  }
  usageReaderOverride = fn;
}

export async function trialUsageToday(sessionHash: string): Promise<TrialUsage | null> {
  if (usageReaderOverride && process.env.NODE_ENV !== "production") {
    return usageReaderOverride(sessionHash);
  }
  try {
    const p = getPool();
    if (!p) return null;
    const { rows } = await p.query(TRIAL_USAGE_SQL, [
      MCP_SITE,
      sessionHash,
      TRIAL_EVENT_SOURCE,
      TRIAL_TIER,
      INTERNAL_PROBE_REASON,
    ]);
    const r = rows[0] ?? {};
    return {
      caller: Number(r.caller ?? 0),
      global: Number(r.global ?? 0),
    };
  } catch {
    return null;
  }
}

/**
 * Decide whether this caller gets a trial, and say WHY not when they do not —
 * the reason picks the rejection copy, so "you spent it" can never be printed
 * at someone who did not.
 */
type TrialOutcome =
  | { granted: true; grant: TrialGrant }
  | { granted: false; reason: TrialDenial | "ineligible" | "no_identity" | "no_meter" };

async function grantTrial(req: NextRequest, endpoint: string): Promise<TrialOutcome> {
  if (!isTrialCandidate(req, endpoint)) return { granted: false, reason: "ineligible" };
  // No caller identity means no per-caller cap is enforceable, so there is no
  // trial to give — the cap is the product boundary, not a nicety.
  const hash = beaconSessionHash(req.headers);
  if (!hash) return { granted: false, reason: "no_identity" };
  const usage = await trialUsageToday(hash);
  // Unreadable meter = no trial (fail closed). Serving on a read error would
  // turn a transient DB blip into an uncapped free bulk export.
  if (!usage) return { granted: false, reason: "no_meter" };
  const decision = decideTrial(endpoint, usage);
  return decision.granted
    ? { granted: true, grant: decision.grant }
    : { granted: false, reason: decision.reason };
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

/**
 * Separate source again for CHECKOUT STARTS. A gated 401 says "someone wanted
 * the paid data"; this says "someone followed the buy link". Without it the
 * only record that anyone ever opened checkout lived in Stripe, which holds no
 * row at all for a session that was never completed — so the step between the
 * paywall and the card form was invisible, and "do pointer-attributed callers
 * convert better than direct ones?" was unanswerable for want of a denominator.
 *
 *   utm_source   = 'trustapi-checkout'
 *   utm_medium   = entry kind ('gate' | 'pointer' | 'page' | 'direct')
 *   utm_campaign = '<METHOD>:<status>'
 *   referrer_full= 'entry:<kind>:<endpoint>:<via>'  (src/lib/api/checkout-entry.ts)
 */
export const TRUST_API_CHECKOUT_SOURCE = "trustapi-checkout";

/** Record one checkout start. Fire-and-forget; never fails the request. */
export async function recordCheckoutStart(u: {
  headers: Headers;
  url?: URL | null;
  entry: CheckoutEntry;
  method: string;
  status: number;
}): Promise<void> {
  try {
    const p = getPool();
    if (!p) return;
    const h = u.headers;
    const { isCrawler, reason } = classifyTrustApiCaller(h, u.url ?? null);
    await p.query(GATED_INSERT, [
      MCP_SITE,
      CHECKOUT_PATH,
      TRUST_API_CHECKOUT_SOURCE,
      u.entry.kind,
      `${u.method}:${u.status}`,
      beaconSessionHash(h),
      isCrawler,
      reason,
      trunc(h.get("user-agent"), 512),
      trunc(h.get("x-vercel-ip-country"), 8),
      entryTag(u.entry),
    ]);
  } catch {
    // Never surface a warehouse problem as a checkout failure.
  }
}
