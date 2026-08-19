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
