// Outage-incident reconstruction (PRD P0-5 history exposed via the P0-7 read
// API). Pure + JSON-serializable.
//
// The digest (/digest) reports the last-N-hours *transitions* in three buckets,
// and /servers/{slug}/history returns the raw probe points, but neither gives a
// caller the thing a status page actually shows: discrete OUTAGE INCIDENTS —
// "server X was down from A to B for 3h27m, recovered into GOOD". This module
// replays the append-only probe-events timeline per server and collapses each
// contiguous run of DOWN probes into a single incident object with a start, an
// end (or ongoing), a duration, and the failure context.
//
// All probe data is untrusted input: every row's shape is validated before use,
// timestamps that fail to parse drop the row, and a slug's timeline is sorted by
// checked_at so out-of-order append lines can't fabricate an incident.
//
// Definition of an incident (v1, deliberately narrow to match the digest's
// "newly_dead" semantics):
//   - started_at   = checked_at of the FIRST DOWN probe in a contiguous DOWN run
//                    that was preceded by a live probe (GOOD/WARN/AUTH_REQUIRED)
//                    OR by nothing (history opens on a DOWN state).
//   - ended_at     = checked_at of the FIRST subsequent non-DOWN probe (the
//                    recovery observation); null when the run is still DOWN at
//                    the end of the known history (ongoing).
//   - duration_seconds = (ended_at - started_at) in whole seconds; null when
//                    ongoing. This is the observed outage span between the first
//                    failing probe and the recovery probe — an honest read of
//                    probe data, not an interpolated exact-failure moment.
// A DOWN run that follows an UNPROBEABLE/unknown predecessor still counts (a
// server that has only ever been seen DOWN is a real, reportable outage).

import type { ProbeResult, Verdict } from './types.ts';
import type { ProbeEventRow } from './digest.ts';

const KNOWN_VERDICTS = new Set<Verdict>([
  'GOOD',
  'WARN',
  'AUTH_REQUIRED',
  'DOWN',
  'UNPROBEABLE',
]);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Parse an ISO-8601 timestamp to epoch ms; null when invalid/missing. */
function toMs(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/** Type guard: a well-formed ProbeResult row (no drift discriminator). */
function isProbeRow(row: unknown): row is ProbeResult {
  return (
    isObject(row) &&
    row.type === undefined &&
    typeof row.slug === 'string' &&
    typeof row.verdict === 'string' &&
    KNOWN_VERDICTS.has(row.verdict as Verdict) &&
    typeof row.checked_at === 'string' &&
    toMs(row.checked_at) !== null
  );
}

/** A single reconstructed outage incident for one server. */
export interface Incident {
  slug: string;
  /** ISO-8601 of the first DOWN probe in the run. */
  started_at: string;
  /** ISO-8601 of the recovery probe, or null when the outage is ongoing. */
  ended_at: string | null;
  /** Whole-seconds span started_at→ended_at; null when ongoing. */
  duration_seconds: number | null;
  /** True when the server has recovered (a non-DOWN probe followed the run). */
  resolved: boolean;
  /** Verdict the server recovered INTO (GOOD/WARN/AUTH_REQUIRED); null ongoing. */
  recovery_verdict: Verdict | null;
  /** Number of DOWN probes observed inside this incident. */
  probe_count: number;
  /** failure_reason from the first DOWN probe, when recorded. */
  first_failure_reason: string | null;
  /** failure_reason from the most recent DOWN probe, when recorded. */
  last_failure_reason: string | null;
  /** ISO-8601 of the last GOOD probe strictly before the outage, when known. */
  last_seen_good_at: string | null;
}

/** Summary rollup across the returned incidents. */
export interface IncidentSummary {
  total: number;
  ongoing: number;
  resolved: number;
  /** Sum of duration_seconds over resolved incidents. */
  total_downtime_seconds: number;
  /** Mean duration_seconds over resolved incidents (0 when none resolved). */
  mean_time_to_recovery_seconds: number;
  /** Longest resolved incident's duration_seconds (0 when none resolved). */
  longest_downtime_seconds: number;
}

export interface ComputeIncidentsOptions {
  /** Only incidents for this server slug. */
  slug?: string;
  /** Only incidents whose started_at is at/after this epoch-ms bound. */
  sinceMs?: number | null;
  /** 'ongoing' | 'resolved' — restrict by resolution state. */
  status?: 'ongoing' | 'resolved' | null;
  /** Drop resolved incidents shorter than this many seconds (noise floor). */
  minDurationSeconds?: number | null;
}

interface ComputeIncidentsResult {
  incidents: Incident[];
  summary: IncidentSummary;
}

/**
 * Reconstruct outage incidents from the probe-events history.
 *
 * @param events probe-events rows (ProbeResult | DriftEvent), any order. Drift
 *   rows and malformed rows are ignored.
 * @param opts   filtering options (slug / since / status / minDuration).
 * @returns incidents newest-first (by started_at desc, slug asc tiebreak) plus a
 *   summary rollup computed over the RETURNED (post-filter) set.
 */
export function computeIncidents(
  events: readonly ProbeEventRow[],
  opts: ComputeIncidentsOptions = {},
): ComputeIncidentsResult {
  const wantSlug = opts.slug?.trim() || undefined;

  // Group valid probe rows by slug.
  const bySlug = new Map<string, ProbeResult[]>();
  for (const row of events) {
    if (!isProbeRow(row)) continue;
    if (wantSlug && row.slug !== wantSlug) continue;
    const list = bySlug.get(row.slug);
    if (list) list.push(row);
    else bySlug.set(row.slug, [row]);
  }

  const all: Incident[] = [];

  for (const [slug, rows] of bySlug) {
    // Stable chronological sort by checked_at.
    const sorted = rows
      .map((r) => ({ r, ms: toMs(r.checked_at) as number }))
      .sort((a, b) => (a.ms === b.ms ? 0 : a.ms < b.ms ? -1 : 1))
      .map((x) => x.r);

    let lastGoodAt: string | null = null;
    let open: {
      started_at: string;
      probe_count: number;
      first_failure_reason: string | null;
      last_failure_reason: string | null;
      last_seen_good_at: string | null;
    } | null = null;

    const closeOpen = (endedAt: string | null, recovery: Verdict | null) => {
      if (!open) return;
      const startMs = toMs(open.started_at) as number;
      const endMs = endedAt ? toMs(endedAt) : null;
      const duration =
        endMs !== null ? Math.max(0, Math.round((endMs - startMs) / 1000)) : null;
      all.push({
        slug,
        started_at: open.started_at,
        ended_at: endedAt,
        duration_seconds: duration,
        resolved: endedAt !== null,
        recovery_verdict: recovery,
        probe_count: open.probe_count,
        first_failure_reason: open.first_failure_reason,
        last_failure_reason: open.last_failure_reason,
        last_seen_good_at: open.last_seen_good_at,
      });
      open = null;
    };

    for (const r of sorted) {
      if (r.verdict === 'DOWN') {
        if (open) {
          open.probe_count += 1;
          open.last_failure_reason = r.failure_reason ?? open.last_failure_reason;
        } else {
          open = {
            started_at: r.checked_at,
            probe_count: 1,
            first_failure_reason: r.failure_reason ?? null,
            last_failure_reason: r.failure_reason ?? null,
            last_seen_good_at: lastGoodAt,
          };
        }
      } else {
        // Any non-DOWN observation ends an open incident (recovery point).
        if (open) closeOpen(r.checked_at, r.verdict);
        if (r.verdict === 'GOOD') lastGoodAt = r.checked_at;
      }
    }
    // A run still open at the end of history is an ongoing incident.
    if (open) closeOpen(null, null);
  }

  // Apply since / status / minDuration filters.
  let filtered = all;
  if (opts.sinceMs != null) {
    const bound = opts.sinceMs;
    filtered = filtered.filter((i) => {
      const s = toMs(i.started_at);
      return s !== null && s >= bound;
    });
  }
  if (opts.status === 'ongoing') filtered = filtered.filter((i) => !i.resolved);
  if (opts.status === 'resolved') filtered = filtered.filter((i) => i.resolved);
  if (opts.minDurationSeconds != null) {
    const floor = opts.minDurationSeconds;
    // Ongoing incidents have no measured duration yet — never floor them out.
    filtered = filtered.filter(
      (i) => !i.resolved || (i.duration_seconds ?? 0) >= floor,
    );
  }

  // Newest incident first; slug asc as a stable tiebreak.
  filtered.sort((a, b) =>
    a.started_at > b.started_at
      ? -1
      : a.started_at < b.started_at
        ? 1
        : a.slug < b.slug
          ? -1
          : a.slug > b.slug
            ? 1
            : 0,
  );

  const resolved = filtered.filter((i) => i.resolved);
  const totalDowntime = resolved.reduce(
    (sum, i) => sum + (i.duration_seconds ?? 0),
    0,
  );
  const longest = resolved.reduce(
    (max, i) => Math.max(max, i.duration_seconds ?? 0),
    0,
  );
  const summary: IncidentSummary = {
    total: filtered.length,
    ongoing: filtered.length - resolved.length,
    resolved: resolved.length,
    total_downtime_seconds: totalDowntime,
    mean_time_to_recovery_seconds:
      resolved.length > 0 ? Math.round(totalDowntime / resolved.length) : 0,
    longest_downtime_seconds: longest,
  };

  return { incidents: filtered, summary };
}
