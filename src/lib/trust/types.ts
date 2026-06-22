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
}

/** Top-level shape of the committed probe-status.json store. */
export interface StatusStore {
  generated_at: string;
  /** Counts by verdict across all inventory entries. */
  summary: Record<Verdict, number>;
  statuses: CurrentStatus[];
}
