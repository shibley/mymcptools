// Trust-layer types for mymcptools live verification.
// Schema is intentionally flat + JSON-serializable so the JSON-file store used
// in Phase 1 can migrate to Postgres/Supabase (PRD P0-5/P2) without reshaping.

/** Probe outcome for a single server, per PRD P0-2. */
export type Verdict =
  | 'GOOD' // speaks MCP, handshake succeeded, >=1 tool exposed
  | 'WARN' // speaks MCP but exposes zero tools / partial tools/list
  | 'AUTH_REQUIRED' // 401 + WWW-Authenticate: Bearer (OAuth-gated)
  | 'DOWN' // handshake failed, connection error, or 200-with-HTML proxy
  | 'UNPROBEABLE'; // no derivable remote endpoint (local stdio/npm/pip install)

export const VERDICTS: Verdict[] = [
  'GOOD',
  'WARN',
  'AUTH_REQUIRED',
  'DOWN',
  'UNPROBEABLE',
];

/** Wire transport used for a remote probe. */
export type Transport = 'streamable-http' | 'sse';

/** How a server is consumed — drives remote-vs-local classification. */
export type DeliveryKind = 'remote' | 'local';

/**
 * One inventory record — the probe target list the prober consumes (PRD P0-1).
 * Built by joining the catalog (src/data/servers.ts) against the curated
 * remote-endpoints registry. Local servers carry no endpoint and an
 * `unprobeable_reason`.
 */
export interface InventoryEntry {
  slug: string;
  name: string;
  delivery: DeliveryKind;
  /** Present only when delivery === 'remote'. */
  remote_endpoint?: string;
  transport?: Transport;
  /** Why a local server cannot be probed (e.g. "local stdio install"). */
  unprobeable_reason?: string;
  /** Provenance of the endpoint mapping, for auditability. */
  endpoint_source?: string;
  /** Editorially featured in the catalog — part of the hot-set probe (P0-3). */
  featured?: boolean;
  /** Paid sponsored placement — part of the hot-set probe (P0-3). */
  sponsored?: boolean;
}

/**
 * Result of a single probe attempt — append-only history row (PRD P0-5
 * probe_events). One of these is emitted per server per run.
 */
export interface ProbeResult {
  slug: string;
  verdict: Verdict;
  /** Round-trip latency of the handshake in ms; null when not measured. */
  latency_ms: number | null;
  /** Protocol version the server negotiated during initialize. */
  negotiated_protocol_version: string | null;
  /** Number of tools returned by tools/list; null when not reached. */
  tool_count: number | null;
  remote_endpoint?: string;
  transport?: Transport;
  /** serverInfo.name / version captured at initialize, when available. */
  server_name?: string;
  server_version?: string;
  /** OAuth authorization-server / resource-metadata URL for AUTH_REQUIRED. */
  auth_server_url?: string;
  /** Raw human-readable failure reason for WARN/DOWN/AUTH_REQUIRED. */
  failure_reason?: string;
  /** ISO-8601 timestamp the probe completed. */
  checked_at: string;
  /**
   * Per-tool input-schema hashes (tool name -> sha256) captured from
   * tools/list, present only when a list succeeded (GOOD/WARN-with-list).
   * Carried so the next run can diff added/removed/changed tools (PRD P0-4).
   */
  tool_hashes?: Record<string, string>;
  /** Order-independent sha256 over the whole tool-set; null when no list. */
  tool_schema_hash?: string | null;
}

/**
 * Difference between two tool-sets (PRD P0-4). `changed` = same tool name but a
 * different input-schema hash. Name arrays are sorted for stable output.
 */
export interface ToolSetDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

/**
 * Drift detected between two successive successful probes of a server (PRD
 * P0-4). Append-only alongside ProbeResult in probe_events; the `type`
 * discriminator distinguishes it from plain probe rows (which carry no type).
 */
export interface DriftEvent {
  type: 'drift';
  slug: string;
  /** ISO-8601 timestamp the drift was observed. */
  changed_at: string;
  schema_changed: boolean;
  prev_schema_hash: string | null;
  schema_hash: string | null;
  /** Tool-level diff; null when only the protocol version changed. */
  tool_diff: ToolSetDiff | null;
  protocol_version_changed: boolean;
  prev_protocol_version: string | null;
  negotiated_protocol_version: string | null;
}

/**
 * Derived per-server status row optimized for read speed (PRD P0-5
 * current_status). Phase 1 carries the latest verdict; trailing-window
 * aggregates (uptime %, p50/p95) land in Phase 2 once history accumulates.
 */
export interface CurrentStatus {
  slug: string;
  verdict: Verdict;
  tool_count: number | null;
  latency_ms: number | null;
  negotiated_protocol_version: string | null;
  remote_endpoint?: string;
  transport?: Transport;
  /** Last time this server was observed GOOD; null if never. */
  last_seen_good_at: string | null;
  /** Most recent probe timestamp. */
  checked_at: string;
  failure_reason?: string;
  auth_server_url?: string;
  /**
   * Raw verdict observed on the latest probe, before rolling-window smoothing
   * (PRD P0-3). May differ from `verdict` while a server is inside the failure
   * window (e.g. raw_verdict DOWN but verdict still GOOD until N fails).
   */
  raw_verdict?: Verdict;
  /**
   * Consecutive failed (DOWN) probes observed (PRD P0-3). Persisted so the
   * rolling window survives across runs; reset to 0 on any passing probe.
   */
  consecutive_failures?: number;
  /** ISO-8601 timestamp the effective `verdict` last changed (PRD P0-3). */
  status_changed_at?: string | null;
  /** Order-independent sha256 of the latest tools/list schema (PRD P0-4). */
  schema_hash?: string | null;
  /** True when the latest probe's schema_hash differs from the prior one. */
  schema_changed?: boolean;
  /** ISO-8601 timestamp the tool-schema last changed; null if never. */
  schema_changed_at?: string | null;
  /** Per-tool input-schema hashes; carried to diff the next run. */
  tool_hashes?: Record<string, string>;
  /** Protocol version observed on the latest successful probe. */
  last_protocol_version?: string | null;
  /** True when last_protocol_version differs from the prior probe. */
  protocol_version_changed?: boolean;
}

/**
 * Which events a webhook subscription cares about (PRD P1-4). `status_change`
 * fires when a server's effective verdict flips; `drift` fires when a
 * tool-schema or protocol-version drift event is recorded; `both` covers both.
 */
export type WebhookEventFilter = 'status_change' | 'drift' | 'both';

/**
 * A single webhook subscription (PRD P1-4 "Webhook on status change/drift").
 * Stored as a flat JSON list in src/data/webhook-subscriptions.json; an absent
 * file is treated as an empty list (the feature is fully opt-in). Every field
 * is validated before dispatch — subscriptions are untrusted config.
 */
export interface WebhookSubscription {
  /** Stable identifier, surfaced in delivery logs. */
  id: string;
  /** Target URL the POST is delivered to (must be http(s)). */
  url: string;
  /** Optional shared secret; when present, requests carry an HMAC signature. */
  secret?: string;
  /** Which event kinds to deliver (default 'both' when omitted). */
  events?: WebhookEventFilter;
  /**
   * Server slug scope: 'all' (or omitted) delivers every server; otherwise an
   * allow-list of slugs this subscription is interested in.
   */
  scope?: 'all' | string[];
  /** Disabled subscriptions are skipped entirely (default enabled). */
  enabled?: boolean;
}

/** Discriminator for the two webhook payload shapes (PRD P1-4). */
export type WebhookEventType = 'status_change' | 'drift';

/**
 * Payload delivered when a server's effective verdict transitions (PRD P1-4).
 * Carries the old + new verdict and the full current_status snapshot so a
 * consumer can act without a follow-up read.
 */
export interface StatusChangeWebhookPayload {
  event: 'status_change';
  slug: string;
  name?: string;
  /** Verdict before the flip; null on the first-ever observation. */
  old_verdict: Verdict | null;
  /** Verdict after the flip. */
  new_verdict: Verdict;
  /** ISO-8601 timestamp the effective verdict changed. */
  status_changed_at: string;
  /** ISO-8601 timestamp of the probe that drove the change. */
  checked_at: string;
  /** The current_status row as of this change. */
  current_status: CurrentStatus;
}

/**
 * Payload delivered when a drift event is recorded (PRD P1-4). Summarizes the
 * underlying DriftEvent (tool diff and/or protocol-version change).
 */
export interface DriftWebhookPayload {
  event: 'drift';
  slug: string;
  name?: string;
  /** ISO-8601 timestamp the drift was observed. */
  changed_at: string;
  schema_changed: boolean;
  protocol_version_changed: boolean;
  /** Tool-level diff; null when only the protocol version changed. */
  tool_diff: ToolSetDiff | null;
  prev_schema_hash: string | null;
  schema_hash: string | null;
  prev_protocol_version: string | null;
  negotiated_protocol_version: string | null;
  /** The current_status row as of this drift, when available. */
  current_status?: CurrentStatus;
}

/** Either webhook payload shape, distinguished by `event` (PRD P1-4). */
export type WebhookPayload = StatusChangeWebhookPayload | DriftWebhookPayload;

/** Outcome of one delivery attempt to one subscription (PRD P1-4). */
export interface WebhookDeliveryResult {
  subscription_id: string;
  url: string;
  event: WebhookEventType;
  slug: string;
  /** True when the target returned a 2xx within the retry budget. */
  ok: boolean;
  /** Final HTTP status, or null on a network/timeout failure. */
  status: number | null;
  /** Number of attempts made (1 + retries). */
  attempts: number;
  /** Human-readable failure reason when !ok. */
  error?: string;
}

/** Top-level shape of the committed probe-status.json store. */
export interface StatusStore {
  generated_at: string;
  /** Counts by verdict across all inventory entries. */
  summary: Record<Verdict, number>;
  statuses: CurrentStatus[];
}

/**
 * Catalog-wide aggregate health, derived on read from the committed
 * current_status store and served by GET /api/v1/stats (PRD P0-7 data layer).
 * A single headline object so a buyer/dashboard can answer "how healthy is the
 * MCP population right now?" without paginating every status row. All figures
 * are computed relative to `generated_at` (the dataset timestamp), so the
 * response is deterministic for a given committed store.
 */
export interface CatalogStats {
  /** When the underlying probe-status dataset was generated. */
  generated_at: string;
  /** Total inventory entries (probeable + unprobeable). */
  total: number;
  /** Raw verdict counts across the whole inventory. */
  verdicts: Record<Verdict, number>;
  /** Verdict counts as a share of `total`, rounded to 0.1%. */
  verdict_percent: Record<Verdict, number>;
  /**
   * Remotely probeable servers (everything except UNPROBEABLE) and how many of
   * those are currently serving (GOOD or WARN), with the serving share of the
   * probeable pool — the headline "X% of live MCP servers actually work" number.
   */
  probeable: {
    count: number;
    serving: number;
    /** serving / count as a percent (0 when nothing is probeable), 0.1% steps. */
    serving_percent: number;
  };
  /** Transport mix across servers that carry one (remote entries). */
  transports: Record<Transport | 'none', number>;
  /** Tool-schema / protocol drift observed on the latest probe. */
  drift: {
    /** Servers whose tool schema changed on the latest probe. */
    schema_changed: number;
    /** Servers whose negotiated protocol version changed on the latest probe. */
    protocol_changed: number;
  };
  /** Handshake latency percentiles (ms) over servers with a measured latency. */
  latency_ms: {
    sampled: number;
    p50: number | null;
    p95: number | null;
  };
  /** Tool-count aggregates over servers that returned a tools/list. */
  tools: {
    /** Sum of exposed tools across all servers with a tool_count. */
    total: number;
    /** Mean tools per server that exposed at least one, or null when none. */
    avg_per_serving: number | null;
  };
  /** Probe recency relative to `generated_at`. */
  freshness: {
    /** Servers probed within 24h of `generated_at`. */
    probed_last_24h: number;
    /** Oldest / newest `checked_at` across the inventory (null when empty). */
    oldest_checked_at: string | null;
    newest_checked_at: string | null;
  };
}

/**
 * Static (non-handshake) health signal for a local/stdio server (PRD P1-3).
 *
 * Local servers (npm/pip/binary/source/container) carry no remote endpoint and
 * cannot be MCP-probed, so instead of a live verdict they surface *static*
 * freshness derived from their GitHub repo: last commit (push) and last
 * release. This is a best-effort signal from untrusted external data — every
 * field is nullable and a fetch error degrades to `error` without crashing.
 * Persisted in src/data/static-signals.json and read at build time alongside
 * the probe-status store.
 */
export interface StaticSignal {
  slug: string;
  /** Canonical repo URL the signal was derived from. */
  repo_url: string;
  /** Parsed GitHub owner / repo, when the URL was a github.com repo. */
  owner: string | null;
  repo: string | null;
  /** ISO-8601 of the repo's last push (proxy for last commit); null if unknown. */
  last_commit_at: string | null;
  /** ISO-8601 of the latest GitHub release; null when none / unknown. */
  last_release_at: string | null;
  /** Tag of the latest release (e.g. "v1.2.3"); null when none. */
  last_release_tag: string | null;
  /** Package registry the server installs from (npm/pip/docker/binary/source). */
  package_registry?: string;
  /** Best-effort package/image name parsed from the install command. */
  package_name?: string;
  /** ISO-8601 timestamp this signal was last refreshed. */
  checked_at: string;
  /**
   * Coarse freshness derived from last_commit_at/last_release_at, computed at
   * build time for badge styling: `active` (<6mo), `aging` (6–18mo),
   * `stale` (>18mo), `unknown` (no date). Not persisted — derived on read.
   */
  freshness?: 'active' | 'aging' | 'stale' | 'unknown';
  /** Human-readable reason the fetch could not complete; absent on success. */
  error?: string;
}

/** Top-level shape of the committed static-signals.json store (PRD P1-3). */
export interface StaticSignalStore {
  generated_at: string;
  summary: {
    total: number;
    with_repo: number;
    with_commit: number;
    with_release: number;
    errors: number;
  };
  signals: StaticSignal[];
}

/**
 * One server's appearance in a digest bucket (PRD P1-1 "daily digest →
 * content engine"). Flat + JSON-serializable like the rest of the schema so it
 * can be handed straight to the content engine or persisted.
 */
export interface DigestEntry {
  slug: string;
  /** Verdict before the transition (null for first-ever observation). */
  from_verdict: Verdict | null;
  /** Verdict after the transition. */
  to_verdict: Verdict;
  /** ISO-8601 timestamp the transition was observed (within the window). */
  changed_at: string;
  /** Human-readable failure reason carried from the probe, when present. */
  failure_reason?: string;
  /** Last time this server was observed GOOD before going DOWN; null if never. */
  last_seen_good_at?: string | null;
}

/**
 * One server's drift appearance in a digest (PRD P1-1). Summarizes the
 * underlying DriftEvent(s) for content-engine consumption.
 */
export interface DigestDriftEntry {
  slug: string;
  /** ISO-8601 timestamp the drift was observed (within the window). */
  changed_at: string;
  schema_changed: boolean;
  protocol_version_changed: boolean;
  /** Tool-level diff summary; null when only the protocol version changed. */
  tool_diff: ToolSetDiff | null;
  prev_protocol_version: string | null;
  negotiated_protocol_version: string | null;
}

/**
 * A computed daily digest over a lookback window (PRD P1-1). Three buckets:
 * servers that newly went DOWN, servers that drifted, and servers that
 * recovered from DOWN — pure and JSON-serializable for the content engine.
 */
export interface DigestDay {
  /** ISO-8601 timestamp the digest was generated. */
  generated_at: string;
  /** Lookback window in hours used to compute the buckets. */
  window_hours: number;
  /** Inclusive lower bound of the window (ISO-8601). */
  window_start: string;
  /** Upper bound of the window (ISO-8601) — typically generated_at. */
  window_end: string;
  /** Servers whose verdict transitioned GOOD/WARN/AUTH → DOWN in the window. */
  newly_dead: DigestEntry[];
  /** Servers with schema/protocol drift events in the window. */
  drifted: DigestDriftEntry[];
  /** Servers whose verdict transitioned DOWN → GOOD in the window. */
  recovered: DigestEntry[];
  /** Per-bucket counts, for quick consumption. */
  counts: {
    newly_dead: number;
    drifted: number;
    recovered: number;
  };
}
