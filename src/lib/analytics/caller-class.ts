/**
 * How a caller on the machine-facing surfaces (`/api/mcp`, `/api/trust-api/*`)
 * is classified as crawler-ish or agent-ish.
 *
 * Extracted from `mcp-usage.ts` by thread #329 (2026-09-28) so the rules can be
 * exercised by a self-check without dragging in `pg` and the `@/` alias.
 *
 * WHY THE RULES CHANGED. #325 read the 30-day beacon as "an agent cohort of
 * 1,579 sessions, larger than the entire human web audience, and growing" and
 * opened #329 to ask whether it could be sold to. #329 measured the cohort and
 * it is not an audience at all:
 *
 *   - 2,191 `/api/mcp` sessions / 30d come from **233 distinct user agents**,
 *     and **216 of those 233 open exactly one session per calendar day** —
 *     they are daily crons, so `session_hash` (which rotates every UTC day)
 *     inflates the client count ~9.4x.
 *   - **102 of the 233 UAs carry a contact URL and describe themselves**:
 *     `ProofBench … MCP registry health probe`, `mcpbeat … liveness check`,
 *     `SentinelOracle … liveness-only, never invokes tools`,
 *     `AIVE-MCP-Discover … no auth attempted`. Of the 257 self-reported
 *     `clientInfo.name` values, every single one is a probe, and **none of them
 *     ever called a tool.**
 *   - 1,632 sessions read `tools/list`; **119 (5.43%) ever call a tool**, and
 *     96 of those 119 carry a named collector UA.
 *   - **0 of 2,191** MCP sessions ever loaded an HTML page in the same session.
 *
 * The classifier already caught most of this, but only via `anonymous-discovery`
 * (`!client && method === "tools/list"`). A probe that politely introduces
 * itself as `verifymcp-probe` / `catalog-health` / `mcphq-probe` and then reads
 * `tools/list` was written `is_bot = false` — **358 sessions/30d**, of which a
 * hand read of the top 25 UAs found **25 of 25 to be named census probes.**
 * That is the residue #325 quoted as an agent audience.
 *
 * THE RULE ADDED: a caller whose self-reported client name or UA contains a
 * probe/census/monitoring token is a crawler — UNLESS it calls a tool. A
 * `tools/call` is the one act a liveness probe by definition does not perform,
 * so it outweighs the name, exactly as speaking JSON-RPC already outweighs an
 * AI vendor's crawler UA. Backtested on 30 days: **305 of the 358 unflagged
 * sessions reclassify, and 0 tool-calling sessions are touched.**
 */

/**
 * User agents that are scanning, not consuming. Deliberately NOT the browser
 * bot list: `python-requests`, `axios`, `curl` and friends are how an agent or a
 * developer's integration legitimately speaks to an MCP endpoint, so treating
 * them as bots here would zero out exactly the signal we are trying to measure.
 * Only agents that identify as indexers/scanners/preview-fetchers count.
 */
export const CRAWLER_UA = [
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

/**
 * Exact browser UAs that are a bot fleet, not a browser. A token list cannot
 * catch these — they ARE a real Safari string, just one frozen in 2019.
 *
 * iOS 13.2.3 / Safari 13.0.3: in the 30 days to 2026-10-01 it sent 27 rows to
 * mymcptools from 26 sessions in 7 countries (US, HK, DE, BR...), one request
 * per session, walking /v1/status -> every gated endpoint -> the buy link
 * minutes apart. It was 8 of the 9 "non-crawler" checkout starts and all 5
 * "sampled" trial callers, so the trust funnel's whole buyer cohort was this
 * one crawler. The four sister properties whose beacon reads a screen width
 * already flag it 406 of 406 (`implausible-screen`, a 1px screen); the API
 * surface has no screen to read, so only the string itself can.
 */
export const FOSSIL_UA = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1",
];

export function isFossilUa(ua: string | null): boolean {
  return !!ua && FOSSIL_UA.includes(ua.trim());
}

/**
 * Tokens that a caller only puts in its OWN name when it is surveying the
 * endpoint rather than using it. Every one of these was observed in the 30-day
 * window as a self-description by a caller that never issued a `tools/call`.
 * Matched against `clientInfo.name` and the UA.
 */
export const PROBE_TOKENS = [
  "probe",
  "census",
  "health",
  "liveness",
  "uptime",
  "observator",
  "registry",
  "scan",
  "check",
  "audit",
  "watch",
  "research",
  "bench",
  "meter",
  "ledger",
  "discover",
  "survey",
  "harvest",
  "verifier",
  "collector",
  "catalog",
  "index",
  "test",
  "demo",
  "example",
];

// `bot` as a substring would otherwise swallow real MCP clients that carry it
// legitimately in their product name.
export const CRAWLER_UA_ALLOW = [
  "claudebot",
  "gptbot",
  "chatgpt-user",
  "oai-searchbot",
  "perplexitybot",
];

export type CallerClass = { isCrawler: boolean; reason: string | null };

/** A `tools/call:<name>` is work; everything else on this endpoint is discovery. */
export function isToolCall(method: string | null): boolean {
  return !!method && method.startsWith("tools/call");
}

/**
 * Classify a caller as crawler-ish or agent-ish.
 *
 * Every caller here is a program, so the browser heuristics (screen size,
 * navigator.webdriver) are meaningless. What separates a crawler from a consumer
 * on this endpoint is intent, and JSON-RPC exposes it: a real MCP client
 * handshakes with `initialize` and then calls tools; a scanner pokes the URL
 * once with no method, no client identity, and an indexer UA — or announces
 * itself as a health probe and never gets past `tools/list`.
 *
 * Known-AI-crawler UAs (ClaudeBot, GPTBot, PerplexityBot…) are deliberately NOT
 * counted as crawlers when they speak JSON-RPC — an AI vendor's fetcher issuing
 * `tools/call` is precisely the consumer this test is looking for.
 */
export function classifyCaller(
  ua: string | null,
  method: string | null,
  client: string | null,
): CallerClass {
  const lc = (ua || "").toLowerCase();
  const cl = (client || "").toLowerCase();
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

  // A caller that names itself a probe/census/monitor IS one — unless it does
  // the one thing a probe does not do, which is call a tool. #329: of 257
  // self-reported client names in 30 days, 0 ever issued a `tools/call`.
  if (!isToolCall(method)) {
    const probe = PROBE_TOKENS.find((t) => cl.includes(t) || lc.includes(t));
    if (probe) reasons.push(`probe-identity:${probe}`);
  }

  return { isCrawler: reasons.length > 0, reason: reasons.length ? reasons.join(",") : null };
}
