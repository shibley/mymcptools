/**
 * The join that makes the public status dataset cover the catalog.
 *
 * WHY THIS EXISTS: the v1 API served `CurrentStatus` rows verbatim. Measured
 * 2026-09-22 against the committed store: of 2,440 servers, 2,396 are
 * `UNPROBEABLE` — local/stdio packages with no remote endpoint — and every one
 * of those rows is all-null (tool_count, latency_ms, last_seen_good_at,
 * negotiated_protocol_version). So a machine consumer pulling /api/v1/status
 * got a signal on 44 rows, 1.8% of the catalog, and nothing at all on the rest.
 * That is not a dataset anyone routes on, and it is not a dataset anyone pays
 * $49/mo to see the *drift* of: gate -> checkout has been 0 for its whole life.
 *
 * PRD P1-3 already answers this for the HTML listings — local/stdio servers get
 * a *static* freshness signal (last commit, last release, registry) swept from
 * their repository by `scripts/static-signals.mts`. That store was rendered on
 * `/servers/[slug]` and the cards, and was invisible to every API caller.
 *
 * This module joins it in. 915 of the previously all-null rows carry a dated
 * static signal (549 active, 332 aging, 34 stale), taking the API from 44 rows
 * with a usable signal to 959 — and it gives a caller a `signal=` filter so
 * "only servers whose repo moved in the last six months" is one request.
 *
 * The join is deliberately conservative: a signal with no date at all (the
 * sweep errored, or the listing has no repo) is reported as `null`, not as an
 * object full of nulls, so `static_signal !== null` means "we know something".
 * Repo-join correctness is enforced upstream in `static-signals-store` (a row
 * swept from a repository the listing no longer links is dropped, thread #262).
 */
import { getStaticSignal, staticSignalsGeneratedAt } from "@/lib/trust/static-signals-store";
import type { CurrentStatus, StaticSignal } from "@/lib/trust/types";

/** Freshness buckets, as served. Mirrors StaticSignal['freshness']. */
export const FRESHNESS = ["active", "aging", "stale", "unknown"] as const;
export type Freshness = (typeof FRESHNESS)[number];

/** Accepted values of the `signal=` query parameter on /api/v1/status. */
export const SIGNAL_FILTERS = [...FRESHNESS, "any", "none"] as const;
export type SignalFilter = (typeof SIGNAL_FILTERS)[number];

/** The `static_signal` object as it appears in a v1 response body. */
export interface ApiStaticSignal {
  repo_url: string | null;
  last_commit_at: string | null;
  last_release_at: string | null;
  last_release_tag: string | null;
  freshness: Freshness;
  package_registry: string | null;
  package_name: string | null;
  checked_at: string;
}

/** A current_status row as served by the v1 API, with its static signal joined. */
export type ApiStatusRow = CurrentStatus & {
  static_signal: ApiStaticSignal | null;
};

/** Coverage counts for the `signal_summary` block. */
export interface SignalSummary {
  /** Rows carrying a dated static signal. */
  covered: number;
  /** Rows with no dated static signal (remote-probed ones included). */
  uncovered: number;
  active: number;
  aging: number;
  stale: number;
  /** When the static-signal sweep that produced these dates was generated. */
  generated_at: string;
}

/** A signal is only worth serving when it actually carries a date. */
function isDated(sig: StaticSignal | undefined): sig is StaticSignal {
  return Boolean(sig && (sig.last_commit_at || sig.last_release_at));
}

function project(sig: StaticSignal): ApiStaticSignal {
  return {
    repo_url: sig.repo_url || null,
    last_commit_at: sig.last_commit_at,
    last_release_at: sig.last_release_at,
    last_release_tag: sig.last_release_tag,
    freshness: (sig.freshness ?? "unknown") as Freshness,
    package_registry: sig.package_registry ?? null,
    package_name: sig.package_name ?? null,
    checked_at: sig.checked_at,
  };
}

/** Join one status row with its static signal. */
export function withStaticSignal(status: CurrentStatus): ApiStatusRow {
  const sig = getStaticSignal(status.slug);
  return { ...status, static_signal: isDated(sig) ? project(sig) : null };
}

/** Join a whole page/list of status rows. */
export function withStaticSignals(
  rows: readonly CurrentStatus[]
): readonly ApiStatusRow[] {
  return rows.map(withStaticSignal);
}

/** Parse `signal=`; `null` means the param was absent, `undefined` means invalid. */
export function parseSignalFilter(raw: string | null): SignalFilter | null | undefined {
  if (raw === null || raw === "") return null;
  return (SIGNAL_FILTERS as readonly string[]).includes(raw)
    ? (raw as SignalFilter)
    : undefined;
}

/** Does a joined row satisfy a `signal=` filter? */
export function matchesSignalFilter(row: ApiStatusRow, filter: SignalFilter): boolean {
  if (filter === "any") return row.static_signal !== null;
  if (filter === "none") return row.static_signal === null;
  return row.static_signal?.freshness === filter;
}

/** Coverage of the static-signal join across a set of joined rows. */
export function signalSummary(rows: readonly ApiStatusRow[]): SignalSummary {
  let covered = 0;
  let active = 0;
  let aging = 0;
  let stale = 0;
  for (const r of rows) {
    if (!r.static_signal) continue;
    covered++;
    if (r.static_signal.freshness === "active") active++;
    else if (r.static_signal.freshness === "aging") aging++;
    else if (r.static_signal.freshness === "stale") stale++;
  }
  return {
    covered,
    uncovered: rows.length - covered,
    active,
    aging,
    stale,
    generated_at: staticSignalsGeneratedAt(),
  };
}
