# 🚀 MyMCPTools.com - SHIPPED!

**Live URL:** https://mymcptools.com

## What Was Built

A programmatic SEO directory of 272+ MCP (Model Context Protocol) servers.

### Pages Created

1. **Homepage** (`/`)
   - Hero with stats (272+ servers, 16 categories, 7 integrations, 103 official)
   - Featured servers grid
   - Category browser
   - Integration showcase
   - Official servers section

2. **Server Detail Pages** (`/servers/[slug]`)
   - 272 individual server pages
   - GitHub links, install commands, categories
   - Schema.org SoftwareApplication markup
   - Related servers sidebar

3. **Category Pages** (`/category/[slug]`)
   - 16 category listing pages
   - filesystem, database, api, search, coding, browser, cloud, devops, ai, communication, etc.

4. **Integration Pages** (`/integration/[slug]`)
   - 7 platform pages
   - Claude Desktop, Cursor, VS Code, Windsurf, Cline, Continue, Zed

5. **Compare Pages** (`/compare/[slug]`)
   - 50 top comparison pages (e.g., "filesystem-vs-postgres")

6. **Supporting Pages**
   - `/search` - Search with filters
   - `/submit` - Server submission form
   - `/blog` - Blog placeholder
   - `/category` - All categories index
   - `/compare` - All comparisons index
   - `/integration` - All integrations index

### SEO Features

- ✅ Dynamic sitemap.xml (1000+ URLs)
- ✅ robots.txt
- ✅ OpenGraph + Twitter cards per page
- ✅ JSON-LD schema markup (SoftwareApplication)
- ✅ Internal cross-linking
- ✅ SEO-optimized meta titles/descriptions

### Data Sources

- Scraped from awesome-mcp-servers (83K+ stars)
- Scraped from Anthropic's official servers repo
- 272 servers total (103 official, 169 community)

### Tech Stack

- Next.js 14+ (App Router)
- TypeScript (strict mode)
- Tailwind CSS (dark mode)
- Deployed on Vercel

### DNS Configuration (Namecheap)

- A Record: `@` → `76.76.21.21`
- CNAME Record: `www` → `cname.vercel-dns.com`

---

## Trust Layer — Live Verification (PRD: docs/PRD-trust-layer.md)

Continuous MCP-handshake verification of every known server. Probes are
strictly read-only (`initialize` / `ping` / `tools/list` only — a target's own
tools are never invoked).

### Scheduling cadence (P0-3)

Two probe modes, both driven by npm scripts so they reuse the existing
OpenClaw cron/agent scheduling rather than new infra:

- **`npm run probe:full`** — probe the entire remote population. Intended
  **nightly** (e.g. ~03:00). Refreshes every server's status + drift baseline.
- **`npm run probe:hot`** — probe only the **hot set**: featured/sponsored
  servers plus any whose last verdict was non-GOOD (failing / warning /
  auth-gated / never-probed). Intended **every few hours** (e.g. every 4h) to
  keep at-risk and high-value listings fresh (<6h target). Servers outside the
  hot set keep their prior status (carried forward, not re-probed).

Wire these into OpenClaw cron as two jobs (nightly `probe:full`, 4-hourly
`probe:hot`). `npm run inventory` rebuilds the probe target list from the
catalog when servers/endpoints change.

### Rolling-window failure logic (P0-3)

A server does **not** flip to DOWN on a single failed probe. It must fail
`PROBE_FAIL_THRESHOLD` consecutive probes (default **3**, configurable via the
env var or `--fail-threshold N`) before `current_status.verdict` flips to DOWN
and `status_changed_at` is stamped. One fail then a pass → no flip. A recovery
after DOWN re-stamps `status_changed_at` and resets the counter. The
consecutive-failure counter is persisted in `probe-status.json` so the window
survives across runs. Logic lives in `src/lib/trust/rolling-window.ts`;
`npm run probe:selfcheck` asserts the acceptance criteria.

---

### Phase 4 P1-3 — local/stdio static signals

~2700 of the catalog's servers are local/stdio installs (npm/pip/binary/source/
container) with **no remote endpoint** — the handshake prober can't verify them,
so they showed only a neutral "Local install" with no real signal. P1-3 gives
them a **static** trust signal derived from their source repo instead:

- **`npm run static:signals`** — for every local inventory entry with a GitHub
  repo, fetches **last commit (push)** + **latest release** from the GitHub REST
  API. Strictly read-only (GET repo + releases only; never installs/runs a
  server or its tools). Uses `GITHUB_TOKEN` when present (5000 req/h) and
  **degrades gracefully** unauthenticated (60 req/h): on rate-limit it stops and
  **preserves prior data** rather than wiping it. Idempotent — merges onto the
  existing `src/data/static-signals.json`, skips repos refreshed within
  `--max-age-hours` (default 72), and processes featured/sponsored first so a
  bounded run spends its budget on the most valuable listings. Flags:
  `--limit N`, `--slug a,b`, `--force`, `--max-age-hours H`.
- **Surfacing:** listing cards (`ServerCard`) and the server detail page show a
  freshness badge distinct from the live GOOD/WARN/AUTH/DOWN palette —
  *Actively maintained* (<6mo) / *Maintained* (6–18mo) / *Quiet repo* (>18mo) /
  *Local install* (unknown) — plus last commit, last release (tag + date), and
  package registry/name. Raw fetch errors are never shown to users. The
  "healthy only" filter is unaffected: local servers stay `UNPROBEABLE` (not
  GOOD, never DOWN), so they're excluded from healthy-only without being
  mislabelled dead.

Read path: `src/lib/trust/static-signals-store.ts` (`getStaticSignal(slug)`,
freshness derived at read time). Types in `src/lib/trust/types.ts`
(`StaticSignal` / `StaticSignalStore`). Wire `static:signals` into OpenClaw cron
(daily, after `inventory`); with a `GITHUB_TOKEN` it backfills the full local
population over successive runs.

---

### Phase 4 P1-4 — status/drift webhooks

Operators (and, later, claimed authors) want a **push** signal the moment a
server breaks, recovers, or drifts — not a poll. P1-4 fires a signed HTTP POST
to subscribed URLs whenever a server's effective verdict **flips**
(GOOD↔DOWN, →AUTH_REQUIRED, →WARN, recovered) or a **drift event** is recorded
(tool-schema or protocol-version change).

- **Dispatch module:** `src/lib/trust/webhooks.ts`. Wired into the prober at the
  two real transition points — where the rolling window finalizes a status flip
  and where a drift event is recorded — so a webhook only fires on an **actual
  change** (a first-ever baseline observation and steady state never fire).
- **Subscriptions:** `src/data/webhook-subscriptions.json` — a flat JSON list,
  each entry `{ id, url, secret?, events: status_change|drift|both,
  scope: 'all'|[slugs], enabled }`. **Fully opt-in:** an absent/empty/invalid
  file means no-op; untrusted config is validated/sanitized (http(s) only,
  scope membership, enabled flag) before any request.
- **Payload:** JSON carrying the event type, slug/name, old + new verdict (for
  status) or tool diff / prev↔current protocol version (for drift), timestamps,
  and the relevant `current_status` snapshot so a consumer can act without a
  follow-up read.
- **Security:** each request is signed `X-Signature: sha256=<hex>` — HMAC-SHA256
  over the raw body using the subscription secret. **Strictly read-only toward
  MCP servers** — only operator-configured webhook URLs are ever contacted.
- **Reliability:** bounded concurrency, per-request timeout, retries with
  backoff on 5xx/network errors (4xx not retried), and **graceful
  degradation** — `dispatchNotices` never throws, so a failing/timeout webhook
  can never break probing or drift recording. Every delivery outcome is logged.
- **`npm run webhooks:selfcheck`** (`scripts/webhooks-selfcheck.mts`) asserts
  the acceptance criteria with **no real network calls**: a flip + a drift fire
  with a valid HMAC against a local loopback sink; steady state fires nothing;
  failing/timeout/garbage targets don't throw to the caller; scope/event
  filters and subscription loading behave. Exits non-zero on failure.

Types in `src/lib/trust/types.ts` (`WebhookSubscription`, `WebhookPayload`,
`WebhookDeliveryResult`, …). Configure subscriptions and the existing
`probe:full` / `probe:hot` cron jobs deliver them automatically.

---

**Deployed:** March 28, 2026
**Build Time:** ~45 minutes from concept to live
