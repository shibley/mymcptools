/**
 * Self-check for MACHINE-CALLER CLASSIFICATION (thread #329, 2026-09-28).
 *
 * THE DEFECT THIS GUARDS. #325 read mymcptools' 30-day beacon as "an agent
 * cohort of 1,579 `/api/mcp` sessions, larger than the entire human web
 * audience (1,148), and growing" and opened #329 to ask whether that cohort
 * could be sold to. It cannot, because it is not an audience:
 *
 *   233 distinct UAs, 216 of which open exactly one session per calendar day
 *   102 of the 233 carry a contact URL and call themselves a health/census probe
 *   257 distinct self-reported clientInfo names — 0 of them ever called a tool
 *   119 of 2,191 sessions (5.43%) ever called a tool; 96 of the 119 are collectors
 *   0 of 2,191 MCP sessions ever loaded an HTML page in the same session
 *
 * The classifier's only name-based rule was `anonymous-discovery`
 * (`!client && method === "tools/list"`), so a probe that INTRODUCES ITSELF —
 * `verifymcp-probe`, `catalog-health`, `mcphq-probe`, `x402-observatory` —
 * was written `is_bot = false`. That was 358 sessions/30d, and it is the
 * residue #325 quoted. A hand read of its top 25 UAs found 25 of 25 to be
 * named census probes.
 *
 * THE RULES:
 *
 *   1. A caller that names itself a probe/census/monitor is a crawler. The
 *      token list is matched against BOTH `clientInfo.name` and the UA,
 *      because roughly half of these callers fill in only one of the two.
 *   2. A `tools/call` OUTWEIGHS rule 1's name match. A liveness probe by
 *      definition does not invoke tools, so the one act that proves consumption
 *      must never be classified away by a NEW rule — this is the same escape
 *      the AI-vendor UAs already get for speaking JSON-RPC, and it is what
 *      stops rule 1 zeroing the signal. It deliberately does NOT extend to the
 *      long-standing CRAWLER_UA list: loosening that would silently restate
 *      every demand number read before 2026-09-28.
 *   3. Generic HTTP libraries stay UNFLAGGED on their UA alone. `node`,
 *      `python-httpx`, `curl`, `Go-http-client` are how a real integration
 *      speaks to an MCP endpoint; flagging them would delete the measurement.
 *
 * WHY IT IS A GUARD AND NOT A ONE-OFF EDIT: the demand question this property
 * exists to answer is "did anything actually call a tool". Every future read of
 * that number divides by this classifier, and the failure mode is silent — a
 * too-loose classifier inflates the audience (what happened), a too-tight one
 * erases the only buyers. Both directions are asserted below.
 *
 *   npm run caller:selfcheck
 */
import { readFileSync } from "node:fs";
import { classifyCaller, PROBE_TOKENS } from "../src/lib/analytics/caller-class.ts";

const failures: string[] = [];
const notes: string[] = [];

type Case = {
  what: string;
  ua: string | null;
  method: string | null;
  client: string | null;
  crawler: boolean;
};

/**
 * Every UA/client pair below is a VERBATIM row from `analytics.events`
 * (site='mymcptools', 30d to 2026-09-28), not an invented string.
 */
const CASES: Case[] = [
  // --- Rule 1: self-identified probes that reached tools/list -------------
  { what: "verifymcp probe", ua: "io.verifymcp/probe", method: "tools/list", client: "verifymcp-probe", crawler: true },
  { what: "catalog-health", ua: "catalog-health/0.1 (+sun.security)", method: "tools/list", client: "catalog-health", crawler: true },
  { what: "mcphq probe", ua: "mcphq-probe/0.1 (+https://mcphq.ai)", method: "initialize", client: "mcphq-probe", crawler: true },
  { what: "aisec registry", ua: "aisec-registry/0.2 (+https://sec.sqrx.io)", method: "tools/list", client: "aisec-registry-probe", crawler: true },
  { what: "x402 observatory", ua: "x402-observatory/0.2 (+research collector; contact: 300tsb@gmail.com)", method: "initialize", client: "x402-observatory", crawler: true },
  { what: "mcp.market uptime", ua: "mcp.market uptime check (+https://mcp.market/docs/rubric)", method: "tools/list", client: "mcp.market-uptime", crawler: true },
  { what: "AIVE discover (no client name)", ua: "AIVE-MCP-Discover/1.0 (+https://aive.global/mcp-trust/census; one server/discover POST per endpoint, no auth attempted)", method: "server/discover", client: null, crawler: true },
  { what: "probe named only in clientInfo", ua: "Python-urllib/3.11", method: "tools/list", client: "agentstatus-probe", crawler: true },
  { what: "bare 'test' client", ua: "python-httpx/0.28.1", method: "initialize", client: "test", crawler: true },

  // --- Rule 2: a tools/call outweighs the name ----------------------------
  { what: "probe-named caller that CALLS A TOOL", ua: "Vouch-Census/0.1 (+mailto:probing@vouch.tools; read-only census probe; see https://vouch.tools/probing-standard)", method: "tools/call", client: null, crawler: false },
  // The escape covers the NEW probe-identity rule only. A caller whose UA hits
  // the long-standing CRAWLER_UA list stays flagged even when it calls a tool,
  // so every demand read taken before 2026-09-28 stays comparable with the ones
  // taken after. `rokmcp-collector` carries "/bot" in its contact URL.
  { what: "CRAWLER_UA still wins over a tools/call", ua: "rokmcp-collector/0.2 (+https://rokmcp.com/bot)", method: "tools/call", client: "rokmcp-collector", crawler: true },
  { what: "AI vendor UA speaking JSON-RPC", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)", method: "tools/call", client: null, crawler: false },

  // --- Rule 3: generic libraries are not bots on their UA alone -----------
  { what: "curl calling a tool", ua: "curl/8.14.1", method: "tools/call", client: null, crawler: false },
  { what: "node client after introducing itself", ua: "node", method: "tools/list", client: "mcp-client", crawler: false },
  { what: "python-httpx calling a tool", ua: "python-httpx/0.28.1", method: "tools/call", client: null, crawler: false },
  { what: "Claude-User calling a tool", ua: "Claude-User", method: "tools/call", client: null, crawler: false },

  // --- pre-existing rules must survive the refactor ------------------------
  { what: "bare URL fetch, no JSON-RPC", ua: "402explorer/0.1 (+https://discover.paygent.net/about)", method: null, client: null, crawler: true },
  { what: "anonymous discovery", ua: "node", method: "tools/list", client: null, crawler: true },
];

for (const c of CASES) {
  const got = classifyCaller(c.ua, c.method, c.client);
  if (got.isCrawler !== c.crawler) {
    failures.push(
      `${c.what}: expected isCrawler=${c.crawler}, got ${got.isCrawler} (reason=${got.reason ?? "null"})\n` +
        `      ua=${JSON.stringify(c.ua)} method=${JSON.stringify(c.method)} client=${JSON.stringify(c.client)}`,
    );
  }
}
notes.push(`${CASES.length} verbatim production caller shapes asserted`);

// --- Structural: rule 2 must be implemented as an escape, not a token gap --
const SRC = "src/lib/analytics/caller-class.ts";
const src = readFileSync(SRC, "utf8");
if (!/isToolCall\(method\)/.test(src)) {
  failures.push(
    `Rule 2: ${SRC} does not gate the probe-identity rule on isToolCall(method). ` +
      `Without that escape a future token addition can silently classify away the only ` +
      `act that proves consumption, and the demand read would go to zero with no error.`,
  );
}
if (PROBE_TOKENS.length < 10) {
  failures.push(`Rule 1: PROBE_TOKENS has ${PROBE_TOKENS.length} entries; the measured cohort needs the full list.`);
}

// --- Structural: the token list must not swallow ordinary browser UAs -----
const BROWSERS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
];
for (const ua of BROWSERS) {
  const got = classifyCaller(ua, "GET", null);
  if (got.isCrawler) {
    failures.push(`Rule 3: a plain browser UA was flagged (${got.reason}) — classifyTrustApiCaller shares this list and would drop real buyers.\n      ${ua}`);
  }
}
notes.push(`${BROWSERS.length} browser UAs asserted unflagged (classifyTrustApiCaller shares the list)`);

if (failures.length) {
  console.error(`\ncaller-class-selfcheck: ${failures.length} FAILURE(S)\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error("");
  process.exit(1);
}
console.log("caller-class-selfcheck: OK");
for (const n of notes) console.log(`  · ${n}`);
