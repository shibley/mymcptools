/**
 * The number this whole slot exists to produce: does anything actually call the
 * public MCP endpoint?
 *
 * Reads the per-call rows written by src/lib/analytics/mcp-usage.ts out of the
 * shared first-party warehouse and prints distinct callers, call volume, the
 * tools that were actually invoked, and a crawler-vs-consumer split.
 *
 *   node scripts/mcp-demand-report.mts [--days 30]
 *
 * Connection string comes from ANALYTICS_DATABASE_URL, or from ../.credentials.env
 * when run from a local checkout.
 *
 * THE GATE (from the slot spec): >=100 distinct non-crawler consumers in 30 days
 * escalates this to a real signal worth discussing a paid tier for. Below that,
 * the data is real but nothing wants it. A clean zero is a valid finding — it is
 * reported, not hidden.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = 100;

function connectionString(): string {
  const direct = process.env.ANALYTICS_DATABASE_URL?.replace(/\\n/g, "").trim();
  if (direct) return direct;
  for (const rel of ["../../.credentials.env", "../.credentials.env"]) {
    try {
      const raw = readFileSync(join(HERE, rel), "utf8");
      const m = raw.match(/^ANALYTICS_DATABASE_URL=(.*)$/m);
      if (m) return m[1].trim();
    } catch {
      // try the next candidate
    }
  }
  throw new Error("ANALYTICS_DATABASE_URL not set and no .credentials.env found");
}

const daysArg = process.argv.indexOf("--days");
const DAYS = daysArg > -1 ? Number(process.argv[daysArg + 1]) : 30;
if (!Number.isFinite(DAYS) || DAYS <= 0) throw new Error("--days must be a positive number");

const client = new pg.Client({ connectionString: connectionString(), ssl: { rejectUnauthorized: false } });
await client.connect();

// Every MCP row is tagged utm_source='mcp' so it can never be confused with the
// browser pageview rows the same table holds for the other properties.
const WHERE = `site = 'mymcptools' and utm_source = 'mcp' and ts > now() - ($1 || ' days')::interval`;

const totals = await client.query(
  `select
     count(*)::int                                             as calls,
     count(distinct session_hash)::int                         as callers,
     count(*) filter (where is_bot)::int                       as crawler_calls,
     count(distinct session_hash) filter (where not is_bot)::int as consumers,
     min(ts)                                                   as first_seen,
     max(ts)                                                   as last_seen
   from analytics.events where ${WHERE}`,
  [String(DAYS)]
);
const t = totals.rows[0];

console.log(`\n=== MCP demand, last ${DAYS} days (mymcptools.com/api/mcp) ===`);
console.log(`calls                     ${t.calls}`);
console.log(`distinct callers          ${t.callers}`);
console.log(`  crawler-classified      ${t.callers - t.consumers} (${t.crawler_calls} calls)`);
console.log(`  consumer-classified     ${t.consumers}`);
console.log(`first / last seen         ${t.first_seen ?? "—"} / ${t.last_seen ?? "—"}`);

if (t.calls === 0) {
  console.log(
    `\nVERDICT: zero recorded calls. Instrumentation is live, so this is a measured\n` +
      `zero rather than an unanswerable question — but check the row count grows at all\n` +
      `before treating a later zero as demand evidence.`
  );
} else {
  const byPath = await client.query(
    `select path, count(*)::int as calls, count(distinct session_hash)::int as callers
       from analytics.events where ${WHERE} group by 1 order by 2 desc, 1 limit 25`,
    [String(DAYS)]
  );
  console.log(`\n-- what was called --`);
  for (const r of byPath.rows) console.log(`${String(r.callers).padStart(4)} callers  ${String(r.calls).padStart(6)} calls  ${r.path}`);

  const byClient = await client.query(
    `select coalesce(utm_medium, '(anonymous)') as client, count(distinct session_hash)::int as callers, count(*)::int as calls
       from analytics.events where ${WHERE} group by 1 order by 2 desc limit 15`,
    [String(DAYS)]
  );
  console.log(`\n-- self-reported clients --`);
  for (const r of byClient.rows) console.log(`${String(r.callers).padStart(4)} callers  ${String(r.calls).padStart(6)} calls  ${r.client}`);

  // Intra-session pacing: the single best crawler test we have on this data.
  // A human-driven or agent-driven session pauses between calls; a scanner
  // hammers at machine speed. Median inter-call gap per session, then the
  // median of those medians.
  const pacing = await client.query(
    `with gaps as (
       select session_hash,
              extract(epoch from ts - lag(ts) over (partition by session_hash order by ts)) as gap
         from analytics.events where ${WHERE}
     )
     select percentile_cont(0.5) within group (order by med) as median_gap,
            count(*)::int as multi_call_sessions
       from (select session_hash, percentile_cont(0.5) within group (order by gap) as med
               from gaps where gap is not null group by 1) s`,
    [String(DAYS)]
  );
  const p = pacing.rows[0];
  console.log(`\n-- intra-session pacing --`);
  console.log(`sessions with >1 call     ${p.multi_call_sessions}`);
  console.log(`median inter-call gap     ${p.median_gap === null ? "—" : `${Number(p.median_gap).toFixed(1)}s`}`);

  // A consumer that handshakes and lists tools but never CALLS one has not
  // consumed anything — it indexed us. That is the dominant pattern here
  // (mcpbeat, mcpcensusbot, mcpindex-trust, *-probe, *-grader…): other
  // registries and scanners cataloguing the endpoint. They are not crawlers by
  // the JSON-RPC intent test — they do speak the protocol — but counting them
  // toward a 100-consumer escalation gate would escalate on our own category's
  // indexing traffic. So they get their own bucket, and only a caller that
  // actually invoked a tool counts as demand.
  const tooled = await client.query(
    `select
       count(distinct session_hash) filter (where path like '/api/mcp:tools/call:%')::int as tool_callers,
       count(*) filter (where path like '/api/mcp:tools/call:%')::int                     as tool_calls
     from analytics.events where ${WHERE} and not is_bot`,
    [String(DAYS)]
  );
  const registryish = await client.query(
    `select count(distinct session_hash)::int as callers
       from analytics.events where ${WHERE} and not is_bot
        and utm_medium ~* '(probe|scan|census|index|grader|beat|monitor|registry|crawler)'`,
    [String(DAYS)]
  );
  const tc = tooled.rows[0];
  console.log(`\n-- consumer quality --`);
  console.log(`invoked >=1 tool          ${tc.tool_callers} callers (${tc.tool_calls} tool calls)`);
  console.log(`self-named as registry/   ${registryish.rows[0].callers} callers`);
  console.log(`  scanner infrastructure`);
  console.log(`handshake-only            ${t.consumers - tc.tool_callers} callers  <- indexed us, consumed nothing`);

  const verdict =
    tc.tool_callers >= GATE
      ? `ESCALATE: ${tc.tool_callers} distinct callers actually invoked a tool, clearing the ${GATE} gate.`
      : `BELOW GATE: ${tc.tool_callers} distinct callers invoked a tool vs a ${GATE} threshold ` +
        `(${t.consumers} passed the crawler test, but ${t.consumers - tc.tool_callers} of those only handshook). ` +
        `Real data, no demand yet.`;
  console.log(`\nVERDICT: ${verdict}`);
}

// ---- free-tier REST half -------------------------------------------------
// Until 2026-08-18 the /api/v1 endpoints were key-gated with zero keys ever
// issued, so their caller count was structurally zero and told us nothing. The
// verified-liveness subset is now keyless, and these rows are what make that a
// real measurement rather than a second unanswerable question.
const REST_WHERE = `site = 'mymcptools' and utm_source = 'trustapi' and ts > now() - ($1 || ' days')::interval`;
const rest = await client.query(
  `select
     count(*)::int                                               as calls,
     count(distinct session_hash)::int                           as callers,
     count(distinct session_hash) filter (where not is_bot)::int  as consumers,
     count(distinct session_hash) filter (where utm_medium = 'anonymous')::int as anon_callers,
     min(ts) as first_seen, max(ts) as last_seen
   from analytics.events where ${REST_WHERE}`,
  [String(DAYS)]
);
const r0 = rest.rows[0];
console.log(`\n=== Free-tier REST demand, last ${DAYS} days (/api/v1 verified-liveness subset) ===`);
console.log(`calls                     ${r0.calls}`);
console.log(`distinct callers          ${r0.callers}  (${r0.consumers} non-crawler, ${r0.anon_callers} keyless)`);
console.log(`first / last seen         ${r0.first_seen ?? "—"} / ${r0.last_seen ?? "—"}`);
if (r0.calls === 0) {
  console.log(`No free-tier REST calls yet. The endpoints are open as of 2026-08-18, so this is a\nmeasured zero from that date forward, not the old structural zero.`);
} else {
  const byEndpoint = await client.query(
    `select path, count(*)::int as calls, count(distinct session_hash)::int as callers
       from analytics.events where ${REST_WHERE} group by 1 order by 2 desc limit 15`,
    [String(DAYS)]
  );
  console.log(`\n-- what was called --`);
  for (const r of byEndpoint.rows) console.log(`${String(r.callers).padStart(4)} callers  ${String(r.calls).padStart(6)} calls  ${r.path}`);
}

await client.end();
