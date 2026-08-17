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
import { createHash } from "node:crypto";
import { Pool } from "pg";

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

/**
 * User agents that are scanning, not consuming. Deliberately NOT the browser
 * bot list: `python-requests`, `axios`, `curl` and friends are how an agent or a
 * developer's integration legitimately speaks to an MCP endpoint, so treating
 * them as bots here would zero out exactly the signal we are trying to measure.
 * Only agents that identify as indexers/scanners/preview-fetchers count.
 */
const CRAWLER_UA = [
  "bot",
  "crawl",
  "spider",
  "slurp",
  "scrap",
  "fetcher",
  "monitor",
  "preview",
  "ahrefs",
  "semrush",
  "mj12",
  "dotbot",
  "dataforseo",
  "petalbot",
  "censys",
  "shodan",
  "zgrab",
  "masscan",
  "expanse",
  "internet-measurement",
  "paloaltonetworks",
  "lighthouse",
  "pagespeed",
  "facebookexternalhit",
  "embedly",
  "headless",
];

// `bot` as a substring would otherwise swallow real MCP clients that carry it
// legitimately in their product name.
const CRAWLER_UA_ALLOW = ["claudebot", "gptbot", "chatgpt-user", "oai-searchbot", "perplexitybot"];

export type CallerClass = { isCrawler: boolean; reason: string | null };

/**
 * Classify a caller as crawler-ish or agent-ish.
 *
 * Every caller here is a program, so the browser heuristics (screen size,
 * navigator.webdriver) are meaningless. What separates a crawler from a consumer
 * on this endpoint is intent, and JSON-RPC exposes it: a real MCP client
 * handshakes with `initialize` and then calls tools; a scanner pokes the URL
 * once with no method, no client identity, and an indexer UA.
 *
 * Known-AI-crawler UAs (ClaudeBot, GPTBot, PerplexityBot…) are deliberately NOT
 * counted as crawlers when they speak JSON-RPC — an AI vendor's fetcher issuing
 * `tools/call` is precisely the consumer this test is looking for.
 */
export function classifyCaller(ua: string | null, method: string | null, client: string | null): CallerClass {
  const lc = (ua || "").toLowerCase();
  const reasons: string[] = [];

  const aiVendor = CRAWLER_UA_ALLOW.find((a) => lc.includes(a));
  if (aiVendor && method) {
    // Speaking the protocol outweighs the UA.
    return { isCrawler: false, reason: null };
  }

  const hit = CRAWLER_UA.find((b) => lc.includes(b));
  if (hit) reasons.push(`ua:${hit}`);

  // No JSON-RPC method at all means this was a bare URL fetch, not a client.
  if (!method) reasons.push("no-jsonrpc");

  // A client that never introduces itself and never gets past discovery is
  // indistinguishable from a scanner walking a directory listing.
  if (!client && method === "tools/list") reasons.push("anonymous-discovery");

  return { isCrawler: reasons.length > 0, reason: reasons.length ? reasons.join(",") : null };
}

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
    const utcDate = new Date().toISOString().slice(0, 10);
    const sessionHash = createHash("sha256")
      .update(`${clientIp(h)}|${ua || ""}|${utcDate}|${salt()}`)
      .digest("hex")
      .slice(0, 32);

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
