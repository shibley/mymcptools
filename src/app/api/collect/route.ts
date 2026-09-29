/**
 * First-party, cookieless analytics collector for the mymcptools WEB surface.
 *
 * Ported from aisotools `src/app/api/collect/route.ts` by thread #220. Before
 * this existed, all 30,832 mymcptools rows in `analytics.events` were written
 * by `/api/mcp` and `/api/v1` — the site had no pageview instrument at all, so
 * the only person who has ever paid mymcptools had no session, no landing path,
 * no referrer and no country.
 *
 * Writes to the shared `analytics.events` warehouse (UsersRated Supabase
 * project) over a direct Postgres pooler connection — NOT the Supabase REST
 * API, so that project's exposed-schema config stays untouched.
 *
 * ⚠️ Rows written here carry `site = 'mymcptools'` and a NON-`/api/` path, and
 * they do NOT set `utm_source = 'mcp'`. Every existing MCP-demand query filters
 * on `utm_source = 'mcp'`, so pageviews cannot contaminate them. Any query that
 * counts `site = 'mymcptools'` WITHOUT that filter now mixes two populations.
 *
 * Privacy: no cookies, no localStorage, no PII. Identity is
 * sha256(ip | ua | utc-date | salt) — see src/lib/session-identity.ts. The raw
 * IP is never stored or logged.
 *
 * This endpoint is fire-and-forget: it always answers 204, even on failure, so
 * a warehouse outage can never surface as a client-side error.
 */
import { Pool } from "pg";
import { sessionHash as beaconSessionHash } from "@/lib/session-identity";
// Bot rules live in a testable module — a Next.js route.ts may only export
// route fields, so they cannot sit here. See scripts/test-analytics-classify.ts.
import { detectBot } from "@/lib/analytics-classify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE = "mymcptools";
const MAX_BODY = 2048;

// Reused across invocations on a warm lambda. max:1 because we sit behind the
// Supavisor transaction pooler, which does the real pooling.
let pool: Pool | null = null;
function getPool(): Pool | null {
  // A trailing newline in a pasted secret is a real and previously-shipped
  // failure mode, so normalise before use.
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
  if (!s) return null;
  return s.slice(0, n);
}

function refHost(full: string | null): string | null {
  if (!full) return null;
  try {
    const h = new URL(full).hostname.toLowerCase();
    return h.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

// Single round-trip: the cadence check (too many pageviews per session in a
// short window) runs as a CTE alongside the insert.
const INSERT = `
with recent as (
  select count(*)::int as c
    from analytics.events
   where session_hash = $8
     and ts > now() - interval '60 seconds'
)
insert into analytics.events
  (site, path, referrer_host, referrer_full, utm_source, utm_medium, utm_campaign,
   session_hash, is_bot, bot_reason, ua, country, screen_w)
select
  $1, $2, $3, $4, $5, $6, $7, $8,
  ($9::bool or recent.c >= 20),
  nullif(concat_ws(',', nullif($10::text, ''), case when recent.c >= 20 then 'cadence' end), ''),
  $11, $12, $13
from recent
returning id, (select c from recent) as recent_count`;

// When a session trips the cadence rule, its EARLIER rows were already written
// unflagged (the counter only looks backwards). Retro-flag the whole session so
// burst traffic isn't counted as ~20 human pageviews.
const RETRO_FLAG = `
update analytics.events
   set is_bot = true,
       bot_reason = nullif(concat_ws(',', nullif(bot_reason, ''), 'cadence'), '')
 where session_hash = $1
   and ts > now() - interval '24 hours'
   and (is_bot = false or bot_reason not like '%cadence%')`;

export async function POST(req: Request): Promise<Response> {
  const noContent = new Response(null, { status: 204 });
  try {
    const p = getPool();
    if (!p) return noContent; // not provisioned — silently no-op

    const raw = await req.text();
    if (!raw || raw.length > MAX_BODY) return noContent;

    let b: Record<string, unknown>;
    try {
      b = JSON.parse(raw);
    } catch {
      return noContent;
    }

    const path = trunc(b.path, 512);
    // The site is fixed server-side: an open collector that trusts a client
    // `site` field lets anyone write rows under any property's name.
    if (!path) return noContent;

    const h = req.headers;
    const ua = trunc(h.get("user-agent"), 512);
    const referrerFull = trunc(b.ref, 1024);

    // Cookieless daily-rotating identity, shared with the MCP and trust-API
    // writers — see src/lib/session-identity.ts. Never inline a second copy.
    const sessionHash = beaconSessionHash(h);
    if (!sessionHash) return noContent;

    const sw = typeof b.sw === "number" ? Math.trunc(b.sw) : null;
    const { isBot, reason } = detectBot(ua, h, b.sw, b.wd, b.hc);

    const res = await p.query(INSERT, [
      SITE,
      path,
      refHost(referrerFull),
      referrerFull,
      trunc(b.utm_source, 128),
      trunc(b.utm_medium, 128),
      trunc(b.utm_campaign, 128),
      sessionHash,
      isBot,
      reason ?? "",
      ua,
      trunc(h.get("x-vercel-ip-country"), 8),
      sw !== null && sw > 0 && sw < 20000 ? sw : null,
    ]);

    if ((res.rows[0]?.recent_count ?? 0) >= 20) {
      await p.query(RETRO_FLAG, [sessionHash]);
    }
    return noContent;
  } catch {
    // Analytics must never surface an error to the page.
    return noContent;
  }
}

export async function GET(): Promise<Response> {
  return new Response(null, { status: 204 });
}
