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

  const verdict =
    t.consumers >= GATE
      ? `ESCALATE: ${t.consumers} distinct non-crawler consumers clears the ${GATE} gate.`
      : `BELOW GATE: ${t.consumers} distinct non-crawler consumers vs a ${GATE} threshold. Real data, no demand yet.`;
  console.log(`\nVERDICT: ${verdict}`);
}

await client.end();
