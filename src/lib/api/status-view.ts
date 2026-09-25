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
import { getInstallCheck, installChecksGeneratedAt } from "@/lib/trust/install-check";
import type { InstallCheck } from "@/lib/trust/install-check";
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

/** A current_status row as served by the v1 API, with both signals joined. */
export type ApiStatusRow = CurrentStatus & {
  static_signal: ApiStaticSignal | null;
  install_signal: ApiInstallSignal | null;
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

/** Join one status row with its static and install signals. */
export function withStaticSignal(status: CurrentStatus): ApiStatusRow {
  const sig = getStaticSignal(status.slug);
  const inst = getInstallCheck(status.slug);
  return {
    ...status,
    static_signal: isDated(sig) ? project(sig) : null,
    install_signal: inst ? projectInstall(inst) : null,
  };
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

/* ---------------------------------------------------------------------------
 * install_signal — "can a machine actually install this, and how old is what
 * it would get?"
 *
 * WHY A SECOND SIGNAL. `static_signal` dates a GITHUB REPOSITORY, so it can
 * only speak for the 1,033 catalog entries that carry a `github_url`. The other
 * 1,424 have none, and no amount of re-sweeping GitHub will ever give them one
 * — they are npm/PyPI packages whose listing never recorded a repo. For those
 * the registry itself is the only source of a date, and it is arguably the
 * better one anyway: it stamps the ARTIFACT the install command fetches rather
 * than a repository that may commit daily and ship yearly.
 *
 * AND THE NEGATIVE IS THE POINT. The registry sweep's dominant finding is not
 * a date, it is that a large share of the install commands in this catalog name
 * a package that does not exist. Serving `exists: false` is strictly more
 * useful to a machine consumer than serving nothing: "do not route here, the
 * command cannot run" is a decision, whereas a null is a shrug. That is why
 * `install_signal` is non-null for every slug the sweep completed a lookup for,
 * including the phantoms — unlike `static_signal`, which is deliberately null
 * when it has no date, because an undated repo row carries no fact at all.
 *
 * IDENTITY IS NOT EXISTENCE. A published name is not proof it is the right
 * product; the sweep's COLLISIONS list emits `exists: false` plus a reason, and
 * a colliding row is never given a `last_published_at` — dating it would attach
 * a real freshness fact to the wrong software.
 * ------------------------------------------------------------------------- */

/** Accepted values of the `installable=` query parameter on /api/v1/status. */
export const INSTALLABLE_FILTERS = ["yes", "no", "unknown"] as const;
export type InstallableFilter = (typeof INSTALLABLE_FILTERS)[number];

/** The `install_signal` object as it appears in a v1 response body. */
export interface ApiInstallSignal {
  registry: "npm" | "pip";
  package: string;
  /** True only when the registry has it AND it is the right product. */
  exists: boolean;
  /** Most recent publish instant, or null when the registry states none. */
  last_published_at: string | null;
  /** Why a published name is nonetheless reported as not existing. */
  collision: string | null;
  /** ISO date (YYYY-MM-DD) the registry lookup ran. */
  checked_at: string;
}

/** Coverage counts for the `install_summary` block. */
export interface InstallSummary {
  /** Rows carrying a registry lookup (existing and phantom alike). */
  covered: number;
  /** Rows whose command names no checkable registry package. */
  uncovered: number;
  /** Rows whose named package is published and is the right product. */
  installable: number;
  /** Rows whose named package is absent, tombstoned, or a known collision. */
  phantom: number;
  /** Rows carrying a publish date. */
  dated: number;
  /** Rows dated by EITHER signal — the honest coverage number for the dataset. */
  dated_by_either_signal: number;
  /** When the registry sweep behind these lookups ran (YYYY-MM-DD). */
  generated_at: string;
}

function projectInstall(c: InstallCheck): ApiInstallSignal {
  return {
    registry: c.registry,
    package: c.packageName,
    exists: c.exists,
    last_published_at: c.lastPublishedAt ?? null,
    collision: c.collision ?? null,
    checked_at: c.checkedAt,
  };
}

/** Parse `installable=`; `null` = absent, `undefined` = invalid. */
export function parseInstallableFilter(
  raw: string | null
): InstallableFilter | null | undefined {
  if (raw === null || raw === "") return null;
  return (INSTALLABLE_FILTERS as readonly string[]).includes(raw)
    ? (raw as InstallableFilter)
    : undefined;
}

/** Does a joined row satisfy an `installable=` filter? */
export function matchesInstallableFilter(
  row: ApiStatusRow,
  filter: InstallableFilter
): boolean {
  if (filter === "unknown") return row.install_signal === null;
  if (filter === "yes") return row.install_signal?.exists === true;
  return row.install_signal?.exists === false;
}

/** Coverage of the registry join across a set of joined rows. */
export function installSummary(rows: readonly ApiStatusRow[]): InstallSummary {
  let covered = 0;
  let installable = 0;
  let phantom = 0;
  let dated = 0;
  let either = 0;
  for (const r of rows) {
    const i = r.install_signal;
    if (i) {
      covered++;
      if (i.exists) installable++;
      else phantom++;
      if (i.last_published_at) dated++;
    }
    if (i?.last_published_at || r.static_signal) either++;
  }
  return {
    covered,
    uncovered: rows.length - covered,
    installable,
    phantom,
    dated,
    dated_by_either_signal: either,
    generated_at: installChecksGeneratedAt(),
  };
}
