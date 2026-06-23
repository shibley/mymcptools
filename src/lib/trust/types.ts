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

/** Top-level shape of the committed probe-status.json store. */
export interface StatusStore {
  generated_at: string;
  /** Counts by verdict across all inventory entries. */
  summary: Record<Verdict, number>;
  statuses: CurrentStatus[];
}
