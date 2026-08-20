# MCP trust/demand test — running record

This slot exists to produce a number, then kill or escalate the idea. It is not
a build-out slot. Everything below is measured, not estimated.

- The number: `npm run demand:report` (reads per-call rows out of
  `analytics.events`, not the counters — those overstate ~25×).
- The listings: `npm run listings:check` (asserts presence *and* speaks MCP to
  whatever endpoint each registry advertises).

**The gate:** ≥100 distinct non-crawler consumers in 30 days → escalate and only
then discuss a paid tier. Below that, the data is real but nothing wants it.

---

## 2026-08-20 late (4th reading) — the gate is now arithmetically out of reach

`node scripts/mcp-demand-report.mts --days 30`, 63h of data.

- **3,654 calls** from **148 sessions** = **100 distinct agents** by
  client-name+UA identity (2,964 / 130 / 96 six hours earlier).
- **0 qualified consumers.** Fourth consecutive reading at zero, across a
  window in which call volume grew 23×.
- 7 callers invoked a real tool (53 calls); all 7 self-identify as scanner
  infrastructure in either the MCP client name or the UA, so none qualify.
  116 of the 123 non-crawler callers handshook and read `tools/list` only.
- Median inter-call gap still 0.4s across 119 multi-call sessions.

**New this reading: the report now answers reachability, not just the total.**
Three flat readings had established "not yet"; what a kill decision actually
turns on is whether the arrival curve *could* still deliver 100 qualified
consumers by 2026-09-16. The report now fits the day-over-day new-agent ratio
on complete days only (the partial tail day would read as a collapse and
flatter the case for killing early) and extrapolates the geometric tail.

```
day           calls  agents  new  qualified
2026-08-18     1000      54   54          0
2026-08-19     1315      68   31          0
2026-08-20     1342      71   15          0  (partial, ~23h UTC)

day-over-day new-agent ratio   0.58x  (54 -> 31)
days to decision               27
projected further arrivals     42
projected total agents ever    142  (100 today)
reachable only if 70% of all 142 agents ever seen qualify
  (observed rate so far: 0.0%, 100 more needed)
```

**Verdict: BELOW GATE, and the gate is no longer reachable on trend.** New
arrivals are decaying at 0.58× per day while call volume rises — the registries
that were going to find us are finishing finding us, and the ones already here
re-poll on a schedule. Even granting every one of the 42 projected future
arrivals, the ceiling is 142 agents ever; clearing the gate would require 70%
of them to be qualified consumers against an observed rate of 0.0% sustained
over 100 agents. There is no arrival trend that reaches 100 qualified consumers
by 2026-09-16.

This does not close the slot early — the decision date stands and the record
keeps accruing — but the remaining fires should be read as confirming a known
answer, not as a live test. Nothing should be built on the assumption that
demand arrives.

**/api/v1 free tier:** 0 calls, 0 callers, fourth consecutive reading.

---

## 2026-08-20 (3rd reading) — the audience is saturating, and 130 "callers" is really 96 agents

`node scripts/mcp-demand-report.mts --days 30`, 51h of data.

- **2,964 calls** from **130 sessions** (2,240 / 92 at the 2nd reading — volume
  up 32% in 27h)
- **0 qualified consumers.** Unchanged across all three readings.
- 5 sessions invoked a real tool (41 tool calls); all 5 are scanner-named.
- 101 of the 106 non-crawler sessions handshook and left.
- 55 sessions self-name as registry/scanner infrastructure.
- median inter-call gap 0.4s across 106 multi-call sessions

**Two corrections to how the number was being read.**

*`session_hash` counts sessions, not agents.* Not one hash in the window spans
two days — it rotates per connection. Identity that survives a reconnect is the
self-reported client name plus the UA, and by that measure the 130 "distinct
callers" are **96 distinct agents**. `SentinelOracle/0.1` alone holds 794 calls
across 41 hashes. The report now prints both, labelled.

*The population is closing, not growing.* 55 of the 96 agents appear on more
than one day — this is a standing set of graders re-polling on a schedule, not
a stream of arrivals:

| day | calls | agents | new agents | qualified |
| --- | --- | --- | --- | --- |
| 2026-08-18 | 1,000 | 54 | 54 | 0 |
| 2026-08-19 | 1,315 | 68 | 31 | 0 |
| 2026-08-20 | 649 | 54 | 11 | 0 (partial, ~11h UTC) |

Day 1 is definitionally all-new, so the comparison that carries information is
08-18 → 08-19: **new agents fell 43% while calls rose 32%.** Day 3 is a third of
a day and is not comparable. The same machines are calling more often; almost
no new ones are finding us.

That matters for 2026-09-16. The gate is 100 qualified consumers, and the
qualified column has been flat at zero for every hour of instrumented history
while the discovery funnel that feeds it is already narrowing. There is no
arrival trend that reaches 100 by the decision date — the remaining question is
only whether a single genuine consumer ever shows up, not whether a hundred do.

**/api/v1 free tier:** 0 calls, 0 callers, third consecutive reading.

---

## 2026-08-19 (2nd reading) — the 6 tool-invokers were all scanners; the real number is 0

Window: 30 days, ~63 hours of real data. Re-ran the report and then looked at
who the six tool-invoking callers from the earlier reading actually were. All
six are grading infrastructure:

| session client | UA | tool calls | what it called |
| --- | --- | --- | --- |
| `agentstatus-probe` ×3 | `python-requests/2.31.0`, `2.32.5` | 30 | the same six tools in the same order each time |
| `mcp-reputation-scanner` | `mcp-reputation-scanner/1.0 (+github.com/cyeragit/mcp-reputation/…/bounded-invocation-of-hosted-endpoints)` | 5 | five read tools, whole session spanning 1 second |
| `verifymcp-probe` ×2 | `Go-http-client/2.0` | 2 | `__verifymcp_auth_probe_<hex>__` — a tool name we do not serve, called only to see which error we return |

Two corrections to the report follow from this, both now in
`scripts/mcp-demand-report.mts`:

1. **Synthetic tool names do not count.** A `tools/call` for
   `__verifymcp_auth_probe_…__` is an auth-behaviour probe, not a tool
   invocation. Calls to `__`-prefixed names are excluded.
2. **Scanner self-identification disqualifies the session.** The name test now
   also reads the UA (the cyeragit scanner announces itself there, not in the
   MCP client name) and adds `reputation` to the pattern. A session that
   identifies as scanner infrastructure cannot also be counted as a consumer of
   it.

The report now prints a **QUALIFIED consumers** line and the verdict is keyed to
it, so grading traffic can never push this slot over its escalation gate.

**/api/mcp (open, no auth), 63h**

- 2,240 calls from 92 distinct callers — volume up ~34% in 27 hours
- 76 passed the crawler test; **72 of those were handshake-only**
- 4 callers invoked a tool we actually serve; **all 4 self-identify as scanner
  infrastructure**
- **QUALIFIED consumers: 0** (0 tool calls)
- 42 callers self-name as registry/scanner infrastructure

**Verdict: BELOW GATE — 0, not 6.** The earlier 6 was an overcount, and the
direction of the error is the informative part: the callers most likely to
invoke a tool are precisely the ones grading us, because invoking is how a
grader checks the endpoint answers. Tool invocation is therefore a *weaker*
demand signal than it looked. Every additional registry listing adds callers to
the numerator of the wrong metric.

Volume grew 34% in a day and qualified consumption stayed at zero. Nothing here
argues for more discoverability work.

**/api/v1 free tier (keyless since 2026-08-18):** still 0 calls, 0 callers.

---

## 2026-08-19 (1st reading) — first reading with a full instrumented day

Window: 30 days, but instrumentation only landed 2026-08-17, so this is really
~36 hours of data (first row 2026-08-18 00:13 PT). The 30-day clock ends
2026-09-16.

**/api/mcp (open, no auth)**

- 1,670 calls from 80 distinct callers
- 15 callers classified as crawlers (895 calls); 65 passed the crawler test
- **6 callers invoked at least one tool** (37 tool calls total)
- **61 of the 65 non-crawler callers were handshake-only** — `initialize`,
  `tools/list`, `notifications/initialized`, then nothing
- 35 callers self-identify as registry/scanner infrastructure by name
  (`glama`, `mcpbeat`, `glimind-probe`, `aisec-registry-probe`,
  `agentstatus-probe`, `mcp-ledger-probe`, `verifymcp-probe`, …)
- median inter-call gap 0.4s across 67 multi-call sessions — machine pacing,
  nowhere near the ~14s that reads as human

**Verdict: BELOW GATE.** 6 tool-invoking callers against a threshold of 100.

The shape of the miss matters more than the miss. Volume is not the problem —
1,670 calls in 36 hours is not a discovery failure. Essentially all of it is
*other registries indexing us*: the traffic is scanner infrastructure reading
our tool list to populate their own catalogs. We are being catalogued, not
consumed. Raising discoverability further would raise the number that is
already high and leave the number that matters at 6.

The only surface 61 of 65 callers ever read is the `tools/list` payload. That
payload — tool names, descriptions, schemas — is the entire product for the
majority of arrivals.

**/api/v1 free tier (verified-liveness subset, opened keyless 2026-08-18)**

- 0 calls, 0 callers.

This is now a *measured* zero rather than the old structural one (before the
keyless tier, `api-keys.json` was `{"keys": []}`, so a zero proved nothing but
that no key existed).

---

## Registry listings — verified 2026-08-19

Presence and liveness are checked separately, because they fail independently:
a registry can hold a stale remote long after our own endpoint is healthy, and
every agent arriving via that listing would hit the dead URL.

| registry | state | notes |
| --- | --- | --- |
| registry.modelcontextprotocol.io | **LISTED, handshake LIVE** | `io.github.shibley/mymcptools` v0.1.1, status `active`, published 2026-07-30; advertises `https://mymcptools.com/api/mcp`, which answers `initialize` as `mymcptools @ 2025-06-18` |
| glama.ai | **LISTED, handshake LIVE** | `@shibley/mymcptools-mcp-server`, `hosting:hybrid` — auto-indexed from the public repo |
| smithery.ai | **NOT LISTED** | Smithery answers a search miss with unrelated filler rather than an empty set, so a non-empty response is not presence; the name check is what decides |
| pulsemcp.com | **INDETERMINATE** | v0beta is gone (410); the replacement v0.1 API is gated behind `X-API-Key` and we hold no key. Set `PULSEMCP_API_KEY` to resolve |

Two of the four carry a verified-live listing. Given that the measured traffic
is already dominated by registry scanners rather than consumers, closing the
Smithery gap is unlikely to move the tool-invocation number — it would add
another indexer.

The official registry entry is at v0.1.1 (2026-07-30) and its description
predates the current 8-tool surface. Republishing needs the `mcp-publisher` CLI
with an interactive GitHub auth flow, so it is not something an unattended fire
can do.

---

## Next reading

Re-run both commands each fire and append. The decision point is 2026-09-16:
≥100 **qualified** consumers → escalate; otherwise state plainly that the data
is real and nothing wants it, and hand the slot back for reallocation. Qualified
means it invoked a tool we serve and neither its client name nor its UA
identifies it as scanner infrastructure — raw tool-invoker counts run high for
the wrong reason.
