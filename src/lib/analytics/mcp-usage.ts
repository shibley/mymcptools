/**
 * Per-call usage records for the public MCP endpoint, written to the shared
 * first-party warehouse (`analytics.events` in the UsersRated Supabase project,
 * reached over the Supavisor transaction pooler — not the Supabase REST API, so
 * that project's exposed-schema config stays untouched).
 *
 * WHY THIS EXISTS: `/api/mcp` already logs one structured line per request to
 * stdout, but Vercel's log drain is not queryable to us, so "did any agent ever
 * call this?" has had no answer. That question is the entire point of the MCP
 * trust/demand test — the endpoint is open and free, and the only thing worth
 * knowing is whether anything on the other side actually pulls from it. A count
 * of zero is a valid, useful answer; an unanswerable question is not.
 *
 * Privacy: no cookies, no request bodies, no arguments. Identity is
 * sha256(ip | ua | utc-date | salt), which rotates every UTC day and cannot be
 * reversed to a person. The raw IP is used to derive that hash and discarded.
 * That derivation is the JOIN KEY these rows share with pageview rows, so it
 * lives in `@/lib/session-identity` and is NOT inlined here — three copies of a
 * join key drift silently (thread #224). `npm run identity:selfcheck` pins it.
 *
 * COLUMN MAPPING. The warehouse table was built for browser pageviews and we
 * deliberately do not alter its schema for one caller, so MCP rows reuse the
 * existing columns with a fixed meaning:
 *
 *   site          'mymcptools'
 *   path          '/api/mcp:<jsonrpc-method>[:<tool-or-resource-name>]', or
 *                 '/api/mcp:<HTTP-VERB>' for non-JSON-RPC requests (GET/DELETE)
 *   utm_source    'mcp'  — the discriminator. Every query below filters on this,
 *                 so MCP rows never contaminate pageview metrics for any site.
 *   utm_medium    client's self-reported `clientInfo.name` from `initialize`
 *   utm_campaign  '<HTTP verb>:<status>' e.g. 'POST:200'
 *   is_bot        true when the caller looks like a crawler/scanner rather than
 *                 an agent doing work (see classifyCaller)
 *   ua/country    as sent
 *
 * Fire-and-forget: every failure is swallowed. Recording usage must never be
 * able to fail an MCP request.
 */
import { Pool } from "pg";
import { sessionHash as beaconSessionHash } from "@/lib/session-identity";
import { classifyCaller } from "./caller-class";

export const MCP_SITE = "mymcptools";
export const MCP_SOURCE = "mcp";

// Reused across invocations on a warm lambda. max:1 because the Supavisor
// transaction pooler does the real pooling.
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
  return s ? s.slice(0, n) : null;
}

/**
 * Caller classification lives in `./caller-class` so that a self-check can
 * exercise it without `pg` or the `@/` alias (thread #329, 2026-09-28). The
 * rules and the measurements behind them are documented there.
 */
export {
  CRAWLER_UA,
  CRAWLER_UA_ALLOW,
  PROBE_TOKENS,
  classifyCaller,
  isToolCall,
} from "./caller-class";
export type { CallerClass } from "./caller-class";

const INSERT = `
insert into analytics.events
  (site, path, referrer_host, referrer_full, utm_source, utm_medium, utm_campaign,
   session_hash, is_bot, bot_reason, ua, country, screen_w)
values ($1, $2, null, null, $3, $4, $5, $6, $7, $8, $9, $10, null)`;

export type McpUsage = {
  headers: Headers;
  /** JSON-RPC method, or null for a non-JSON-RPC request. */
  method: string | null;
  /** tools/call `name` or resources/read `uri`. */
  target: string | null;
  /** clientInfo.name from `initialize`. */
  client: string | null;
  http: string;
  status: number;
};

/**
 * Write one usage row. Returns a promise that never rejects; callers may await
 * it (Vercel kills the lambda at response time, so an un-awaited insert on a
 * cold instance can be dropped mid-flight).
 */
export async function recordMcpUsage(u: McpUsage): Promise<void> {
  try {
    const p = getPool();
    if (!p) return; // not provisioned — silently no-op

    const h = u.headers;
    const ua = trunc(h.get("user-agent"), 512);
    const sessionHash = beaconSessionHash(h);

    const method = trunc(u.method, 64);
    const target = trunc(u.target, 120);
    const path = method
      ? `/api/mcp:${method}${target ? `:${target}` : ""}`
      : `/api/mcp:${u.http}`;

    const { isCrawler, reason } = classifyCaller(ua, method, trunc(u.client, 120));

    await p.query(INSERT, [
      MCP_SITE,
      path.slice(0, 512),
      MCP_SOURCE,
      trunc(u.client, 128),
      `${u.http}:${u.status}`,
      sessionHash,
      isCrawler,
      reason,
      ua,
      trunc(h.get("x-vercel-ip-country"), 8),
    ]);
  } catch {
    // Never surface a warehouse problem as an MCP failure.
  }
}
