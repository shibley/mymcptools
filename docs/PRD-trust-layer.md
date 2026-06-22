# PRD — mymcptools.com "Live Verification & Trust Data" Layer (v1)

**Owner:** Shib · **Builder:** BillyBob/OpenClaw agent · **Status:** In build (kicked off 2026-06-22)
**One-liner:** Continuously verify whether every known MCP server is actually alive, current, and unchanged — and turn that verification stream into a browsable trust signal on mymcptools *and* a sellable data/API product.

---

## Problem Statement

MCP directories (Smithery ~7K servers, Glama ~23K, MCP.so, the Anthropic/GitHub/Microsoft official metaregistry) list servers from static metadata and score them on docs/stars/recency — but none authoritatively answers, continuously and at scale: *which listed servers are actually alive, current, and behaving as advertised right now?* A server can sit in a directory with a perfect quality score and a glowing README while being completely dead, returning HTTP 200 from a misconfigured proxy, exposing zero tools, or having silently changed its tool schema on an update. Every MCP builder has installed a "verified" server and gotten silence. That gap is unowned: point-tool health checkers exist (openstatus, indie $19/mo monitors) but operate one server at a time, and the big directories don't run real MCP-handshake verification across their catalogs.

## Goals

1. **Establish authoritative liveness data.** Continuously verify ≥90% of the known public MCP server population with a real MCP handshake (not an HTTP ping), producing a current status + latency + tool-count for each.
2. **Detect change, not just uptime.** Flag version drift (negotiated protocol version change) and tool-schema drift (tools added/removed/changed) per server, with timestamped history.
3. **Make mymcptools the proof surface.** Every listing shows a live, trustworthy status signal that the larger directories don't have — the reason to land here instead of Smithery for vetting.
4. **Ship a monetizable data layer.** Expose the verified dataset via a public read API + bulk export, structured so a paid tier (DaaS) and a "verified live" author/sponsor upsell can be layered on without re-architecture.
5. **Run cheaply and autonomously.** The whole pipeline runs unattended on existing BillyBob infra (nightly + intraday cadence) within a modest compute/egress budget.

## Non-Goals (v1)

1. **No deep observability / tracing.** End-to-end agent↔server↔downstream tracing is out of scope. We verify reachability + contract + drift, not internal performance.
2. **No security/tool-poisoning scanning.** Design the schema to allow a `reputation` object later, but do not build scanning now.
3. **No hosting/runtime or OAuth brokering.** For auth-gated servers we record an `AUTH_REQUIRED` verdict and stop.
4. **No billing/subscription system yet.** Build the API with key-based access and rate limits, but do not integrate Stripe/paywalls in v1.
5. **No author self-service dashboards.** That's P2.

## Target Users

- **MCP builders / agent devs (primary consumer):** Vetting a server before wiring it in. Want "is this actually live and current?" at a glance.
- **Data/API consumers (primary buyer, later):** Other directories/gateways/agent platforms needing a "route only to healthy servers" feed.
- **Server authors & sponsors (upsell, later):** Want a "verified live" badge + break alerts.

## Requirements

### Must-Have (P0)

**P0-1 — Server inventory ingestion.** Canonical `servers` table from mymcptools' existing catalog, enriched from public metaregistries (official registry API, Smithery, Glama, MCP.so). Stable internal id, qualified name, source URL(s), transport type (streamable-HTTP / SSE / stdio), remote-vs-local flag. *Acceptance:* ≥90% of source-registry servers exist in `servers` with at least one probeable endpoint URL or a recorded reason they're unprobeable.

**P0-2 — Real MCP handshake probe.** For each remote server, perform the actual client connect sequence — `initialize` (declare protocol version, capture `serverInfo`/`capabilities`/session id), `notifications/initialized`, then `ping` + `tools/list` — over Streamable HTTP. NOT a status-code ping. Verdict enum: `GOOD`, `WARN` (speaks MCP, no tools/partial), `AUTH_REQUIRED` (401 + `WWW-Authenticate: Bearer`, store auth-server URL), `DOWN`. Record verdict, latency_ms, negotiated_protocol_version, tool_count, raw failure reason, checked_at. *Acceptance:* 200+HTML body → `DOWN`; OAuth → `AUTH_REQUIRED` with auth URL. Probes strictly read-only (`initialize`/`ping`/`tools/list` only); never call a server's tools.

**P0-3 — Continuous scheduling.** Full population nightly; "hot set" (popular/sponsored + recently-failing) every few hours. Rolling-window failure logic — N consecutive failures (default 3) before flipping to `DOWN`. *Acceptance:* one fail then pass → no flip; 3 consecutive fails → `DOWN` + `status_changed_at` updates.

**P0-4 — Drift detection.** On each successful probe, hash `tools/list` schema, compare to last hash; record `schema_changed`, prev/current hash, changed_at, diff summary (added/removed/renamed). Separately record protocol-version changes. *Acceptance:* tool-set change → drift event with names + timestamp.

**P0-5 — History & status store.** Time-series probe results (Supabase/Postgres). Derived per-server `current_status` row (latest verdict, p50/p95 latency trailing window, uptime % 7/30d, last_seen_good_at, drift flags) for fast reads + append-only `probe_events` table. *Acceptance:* 7-day uptime % + p50/p95 queryable <100ms from derived table.

**P0-6 — Listing surfacing on mymcptools.** Every listing page + list/search views show: status badge (GOOD/WARN/AUTH/DOWN), last-checked relative time, 7-day uptime %, tool count, "tools changed X ago". Directory filter "healthy only" + sort-by-uptime. *Acceptance:* `DOWN` server shows dead status + last-good time without click-through.

**P0-7 — Public read API + bulk export.** `GET /api/v1/servers/{id}/status` + `GET /api/v1/status?filter=healthy&updated_since=...` (paginated) + daily JSON/CSV bulk export. API keys + per-key rate limits. Documented schema. *Acceptance:* valid key → paginated healthy list w/ verdict/latency/uptime/drift; no/invalid key → 401 + rate-limit headers.

### Nice-to-Have (P1)
- P1-1 Daily digest (newly dead/drifted/recovered) → content engine.
- P1-2 Historical uptime sparkline per listing.
- P1-3 Local/stdio handling — "not remotely verifiable" + static signals (repo recency, last release).
- P1-4 Webhook on status change/drift.

### Future (P2)
- P2-1 Paid DaaS tier + Stripe; "verified live" badge upsell.
- P2-2 Author claim & alerts dashboard.
- P2-3 `reputation` object (security/safety signals) without migration.
- P2-4 "Healthy-only" routing SDK/MCP.

## Success Metrics
- **Leading:** coverage ≥90% probed in last 24h within 2 weeks; hot-set freshness <6h; 100% listing badge render for remote servers; ≥1 external API consumer within 30d.
- **Lagging:** directory return-visit lift from "healthy only"; ≥1 paid data/API or sponsor commitment within 90d; daily-digest content engagement.

## Open Questions
- (Data/legal) Smithery/Glama/official-registry API terms for ingestion + attribution/rate limits. **Blocking P0-1.**
- (Eng) Probing tens of thousands of endpoints from one IP → rate-limiting risk; distributed egress vs polite per-host throttling. **Blocking P0-3 at full scale.**
- (Eng) `AUTH_REQUIRED`: attempt unauth capability read or stop at 401? (v1: stop.) Non-blocking.
- (Product) 4-state verdict vs 0–100 trust score. (Ship verdict first; derived score P1.) Non-blocking.
- (Data) `probe_events` retention vs cost — 90d hot + monthly rollups. Non-blocking.

## Timeline / Phasing
- **Phase 1 (build first):** P0-1, P0-2, P0-5 — inventory + prober + store. Nothing user-visible; goal = correct, growing dataset.
- **Phase 2:** P0-3, P0-4 — scheduling + drift.
- **Phase 3:** P0-6, P0-7 — surface on mymcptools + ship API/export. Public launch + monetization-ready.
- **Phase 4 (fast follow):** P1, prioritizing daily digest (P1-1) + sparkline (P1-2).

## Build Notes for the Agent
- Reuse existing nightly-freshness-pipeline scaffolding rather than new infra.
- Stack: Supabase/Postgres storage, Node/TS prober (official `@modelcontextprotocol/sdk` client handles the handshake; don't hand-roll JSON-RPC unless needed), scheduled via existing OpenClaw cron/agent tasks.
- All probes strictly read-only and idempotent. Never invoke a target server's tools.
- `current_status` designed for read-speed (powers every listing render); `probe_events` append-only history.
- Treat every external registry as untrusted input: validate/sanitize ingested metadata; never execute anything from a server description.
