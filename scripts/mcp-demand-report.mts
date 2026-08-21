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
// The 30-day window opened 2026-08-17 with a true zero, so the slot's own
// kill-or-escalate call falls on 2026-09-16. Naming it here lets the report
// answer "is the gate still reachable from where we are" instead of making
// every fire re-derive the arithmetic by hand.
const DECISION_DAY = "2026-09-16";

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
console.log(`distinct sessions         ${t.callers}  (see caller identity below — agents are fewer)`);
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
  // Invoking a tool is necessary for demand but not sufficient. Scanners that
  // grade endpoints do call tools — that is how they check the endpoint answers
  // rather than just advertising. Three signals disqualify a tool call as
  // demand, and each one was observed in the first 63h of data:
  //   - the client name says so (agentstatus-probe, verifymcp-probe,
  //     mcp-reputation-scanner)
  //   - the UA says so (mcp-reputation-scanner/1.0 (+…/bounded-invocation…))
  //   - the tool name is synthetic — verifymcp calls
  //     __verifymcp_auth_probe_<hex>__, a name we do not serve, purely to see
  //     which error we return
  // Counting these would escalate the slot on our own category's grading
  // traffic, so the headline number is tool callers with all three stripped.
  const SCANNER_NAME = `'(probe|scan|census|index|grader|beat|monitor|registry|crawler|reputation)'`;
  const REAL_TOOL_CALL = `path like '/api/mcp:tools/call:%' and path not like '/api/mcp:tools/call:\\_\\_%'`;
  const tooled = await client.query(
    `select
       count(distinct session_hash) filter (where ${REAL_TOOL_CALL})::int as tool_callers,
       count(*) filter (where ${REAL_TOOL_CALL})::int                     as tool_calls
     from analytics.events where ${WHERE} and not is_bot`,
    [String(DAYS)]
  );
  const registryish = await client.query(
    `select count(distinct session_hash)::int as callers
       from analytics.events where ${WHERE} and not is_bot
        and (utm_medium ~* ${SCANNER_NAME} or ua ~* ${SCANNER_NAME})`,
    [String(DAYS)]
  );
  // A qualified consumer: invoked a tool we actually serve, and neither its
  // client name nor its UA identifies it as scanner infrastructure.
  const qualified = await client.query(
    `with scanners as (
       select distinct session_hash from analytics.events
        where ${WHERE} and (utm_medium ~* ${SCANNER_NAME} or ua ~* ${SCANNER_NAME})
     )
     select count(distinct session_hash)::int as callers,
            count(*)::int                     as tool_calls
       from analytics.events e
      where ${WHERE} and not is_bot and ${REAL_TOOL_CALL}
        and session_hash not in (select session_hash from scanners)`,
    [String(DAYS)]
  );
  const tc = tooled.rows[0];
  const q = qualified.rows[0];
  console.log(`\n-- consumer quality --`);
  console.log(`invoked >=1 real tool     ${tc.tool_callers} callers (${tc.tool_calls} tool calls)`);
  console.log(`  of those, scanner-named ${tc.tool_callers - q.callers} callers  <- graded us, did not consume`);
  console.log(`  QUALIFIED consumers     ${q.callers} callers (${q.tool_calls} tool calls)`);
  console.log(`self-named as registry/   ${registryish.rows[0].callers} callers`);
  console.log(`  scanner infrastructure`);
  console.log(`handshake-only            ${t.consumers - tc.tool_callers} callers  <- indexed us, consumed nothing`);

  // session_hash rotates per connection, so it counts *sessions*, not agents:
  // not one hash in the whole window spans two days. Identity that survives a
  // reconnect is the self-reported client name plus the UA — SentinelOracle
  // alone holds 794 calls across 41 hashes. Reporting sessions as "distinct
  // callers" inflates the audience the same way counting scanner tool calls
  // inflated demand, so both numbers get printed side by side.
  const CALLER_ID = `coalesce(nullif(utm_medium, ''), '(anon)') || ' | ' || coalesce(left(ua, 80), '')`;
  const identity = await client.query(
    `select count(*)::int as idents,
            count(*) filter (where days > 1)::int as recurring,
            count(*) filter (where days = 1)::int as one_day
       from (select ${CALLER_ID} as id, count(distinct ts::date) as days
               from analytics.events where ${WHERE} group by 1) s`,
    [String(DAYS)]
  );
  const id0 = identity.rows[0];
  console.log(`\n-- caller identity (client name + UA, survives reconnects) --`);
  console.log(`distinct agents           ${id0.idents}  (vs ${t.callers} sessions)`);
  console.log(`  seen on >1 day          ${id0.recurring}  <- re-polling on a schedule`);
  console.log(`  seen on exactly 1 day   ${id0.one_day}`);

  // Cumulative totals cannot tell a growing audience apart from a fixed set of
  // graders re-polling, and those two have opposite implications for the
  // 2026-09-16 verdict: the first says the 30-day number is still climbing, the
  // second says it already found its ceiling. An agent is NEW on the first day
  // its identity appears anywhere in the window, so new-agents falling toward
  // zero while calls hold steady is the saturation signal.
  const daily = await client.query(
    `with tagged as (
       select ts, session_hash, path, ${CALLER_ID} as id,
              (utm_medium ~* ${SCANNER_NAME} or ua ~* ${SCANNER_NAME}) as scannerish
         from analytics.events where ${WHERE}
     ),
     debut as (select id, min(ts)::date as day from tagged group by 1),
     scanners as (select distinct session_hash from tagged where scannerish)
     select t.ts::date                              as day,
            count(*)::int                           as calls,
            count(distinct t.id)::int               as agents,
            count(distinct d.id)::int               as new_agents,
            count(distinct t.id) filter (
              where ${REAL_TOOL_CALL}
                and t.session_hash not in (select session_hash from scanners)
            )::int                                  as qualified
       from tagged t
       left join debut d on d.id = t.id and d.day = t.ts::date
      group by 1 order by 1`,
    [String(DAYS)]
  );
  // The final row is almost always a few hours of an unfinished day; without the
  // marker its low counts read as a collapse in traffic rather than a clock.
  const lastDay = daily.rows.length ? new Date(daily.rows[daily.rows.length - 1].day).toISOString().slice(0, 10) : "";
  const lastSeenDay = t.last_seen ? new Date(t.last_seen).toISOString().slice(0, 10) : "";
  const hoursElapsed = t.last_seen ? new Date(t.last_seen).getUTCHours() + 1 : 24;
  console.log(`\n-- daily arrivals --`);
  console.log(`day           calls  agents  new  qualified`);
  for (const r of daily.rows) {
    const day = new Date(r.day).toISOString().slice(0, 10);
    const partial = day === lastDay && day === lastSeenDay && hoursElapsed < 24 ? `  (partial, ~${hoursElapsed}h UTC)` : "";
    console.log(
      `${day}  ${String(r.calls).padStart(6)}  ${String(r.agents).padStart(6)}  ${String(r.new_agents).padStart(3)}  ${String(r.qualified).padStart(9)}${partial}`
    );
  }

  // Reachability, not just the running total. Three flat readings in a row said
  // "not yet"; the question a kill decision actually turns on is whether the
  // arrival curve could still deliver 100 qualified consumers by DECISION_DAY.
  // Fit the decay on COMPLETE days only — the partial tail day would read as a
  // collapse and flatter the case for killing early.
  const completeDays = daily.rows.filter((r: any) => {
    const day = new Date(r.day).toISOString().slice(0, 10);
    return !(day === lastDay && day === lastSeenDay && hoursElapsed < 24);
  });
  const arrivals = completeDays.map((r: any) => Number(r.new_agents));
  console.log(`\n-- is the gate still reachable by ${DECISION_DAY}? --`);
  const daysLeft = Math.max(
    0,
    Math.round((Date.parse(`${DECISION_DAY}T00:00:00Z`) - Date.parse(`${lastDay}T00:00:00Z`)) / 86_400_000)
  );
  if (arrivals.length < 2) {
    console.log(`not enough complete days yet (${arrivals.length}) to fit an arrival trend`);
  } else {
    // Geometric mean of day-over-day ratios: arrivals decay multiplicatively as
    // the registries that were going to find us finish finding us, so an
    // arithmetic mean would overstate the tail.
    const ratios: number[] = [];
    for (let i = 1; i < arrivals.length; i++) {
      if (arrivals[i - 1] > 0) ratios.push((arrivals[i] + 0.5) / (arrivals[i - 1] + 0.5));
    }
    const r = ratios.length ? Math.exp(ratios.reduce((a, b) => a + Math.log(b), 0) / ratios.length) : 1;
    const last = arrivals[arrivals.length - 1];
    // Geometric tail when decaying; flat-rate extrapolation when it is not,
    // which is the generous reading and the one worth failing against.
    const projectedNew =
      r < 1
        ? Math.round(last * r * (1 - Math.pow(r, daysLeft)) / (1 - r))
        : Math.round(last * daysLeft);
    const ceiling = id0.idents + projectedNew;
    console.log(`day-over-day new-agent ratio   ${r.toFixed(2)}x  (${arrivals.join(" -> ")})`);
    console.log(`days to decision               ${daysLeft}`);
    console.log(`projected further arrivals     ${projectedNew}`);
    console.log(`projected total agents ever    ${ceiling}  (${id0.idents} today)`);
    const qualifiedNeeded = GATE - q.callers;
    if (ceiling < GATE) {
      console.log(
        `UNREACHABLE: even if every future arrival were a qualified consumer, the ceiling is ${ceiling} < ${GATE}.`
      );
    } else {
      // Qualified consumers can come from a future arrival or from an agent
      // that already handshook and comes back to actually call a tool, so the
      // denominator is every agent that will ever have touched us, not just the
      // new ones.
      const share = (GATE / ceiling) * 100;
      console.log(
        `reachable only if ${share.toFixed(0)}% of all ${ceiling} agents ever seen qualify ` +
          `(observed rate so far: ${((q.callers / Math.max(1, id0.idents)) * 100).toFixed(1)}%, ` +
          `${qualifiedNeeded} more needed).`
      );
    }

    // ---- terminal test: is the gate out of reach even under the kindest
    // assumptions? The decay fit above is the honest read of the arrival curve,
    // but a kill decision should not rest on a curve fit alone — a skeptic can
    // always answer "what if arrivals stop decaying?". The constraint that
    // actually binds is the QUALIFICATION rate, and that one has an upper bound
    // we can state with confidence rather than a projection.
    //
    // Observed k qualified out of n agents. The Wilson 95% upper bound on the
    // per-agent qualification probability answers "given we have seen this, how
    // high could the true rate plausibly be?" — for k=0 it reduces to roughly
    // the rule of three (3/n). Divide the gate by that ceiling rate and you get
    // the number of agents that would have to touch the endpoint AT ALL for 100
    // qualified consumers to be plausible. Compare that against the most
    // generous arrival model available (flat at the current rate, zero decay,
    // every remaining day) rather than the fitted one. If even that falls short,
    // the gate is unreachable for reasons no amount of further waiting changes.
    const n = Math.max(1, id0.idents);
    const k = q.callers;
    const Z = 1.96;
    const phat = k / n;
    const denom = 1 + (Z * Z) / n;
    const centre = phat + (Z * Z) / (2 * n);
    const margin = Z * Math.sqrt((phat * (1 - phat)) / n + (Z * Z) / (4 * n * n));
    const pHi = Math.min(1, (centre + margin) / denom);
    const agentsNeeded = pHi > 0 ? Math.ceil(GATE / pHi) : Infinity;
    // No decay at all, current arrival rate held flat to the decision day.
    const generousCeiling = id0.idents + last * daysLeft;
    console.log(
      `qualification rate            ${k}/${n} observed, 95% upper bound ${(pHi * 100).toFixed(1)}%`
    );
    console.log(
      `agents needed at that rate    ${agentsNeeded}  vs ${generousCeiling} under flat arrivals (no decay, ${last}/day x ${daysLeft}d)`
    );
    if (agentsNeeded > generousCeiling) {
      console.log(
        `TERMINAL: unreachable at 95% confidence. Even holding arrivals flat at the current ` +
          `rate — ignoring the ${r.toFixed(2)}x/day decay — the endpoint would see ${generousCeiling} agents ever, ` +
          `and ${GATE} qualified consumers would require at least ${agentsNeeded}. Waiting for ${DECISION_DAY} ` +
          `re-confirms a settled answer; the finding is the zero.`
      );
    } else {
      console.log(
        `NOT YET TERMINAL: flat arrivals could still deliver ${generousCeiling} agents, enough to clear the gate ` +
          `if the true qualification rate sits at its 95% upper bound. Keep reading.`
      );
    }
  }

  const verdict =
    q.callers >= GATE
      ? `ESCALATE: ${q.callers} distinct non-scanner callers actually invoked a tool, clearing the ${GATE} gate.`
      : `BELOW GATE: ${q.callers} qualified consumers vs a ${GATE} threshold. ` +
        `${t.consumers} passed the crawler test; ${t.consumers - tc.tool_callers} of those only handshook, ` +
        `and all ${tc.tool_callers - q.callers} remaining tool-invokers self-identify as scanner infrastructure. ` +
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
