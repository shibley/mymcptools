// Daily digest computation (PRD P1-1: "Daily digest (newly dead/drifted/
// recovered) → content engine").
//
// Pure + JSON-serializable. Given the append-only probe-events history (a mix
// of ProbeResult and DriftEvent rows) and a lookback window, it derives three
// buckets:
//   - newly_dead: a server's effective verdict transitioned GOOD/WARN/AUTH →
//     DOWN within the window.
//   - drifted:    a server emitted a DriftEvent (schema or protocol) within
//     the window.
//   - recovered:  a server's effective verdict transitioned DOWN → GOOD within
//     the window.
//
// Transitions are reconstructed by replaying each server's ProbeResult rows in
// timestamp order: we look at the verdict carried on each probe row and detect
// where it crosses into / out of DOWN. The full event stream (not just the
// latest StatusStore) is the authoritative history, so the digest works even
// when several transitions happened inside one window. The StatusStore is
// accepted as an optional corroborating input (e.g. last_seen_good_at).
//
// All probe data is untrusted input: we validate the shape of every row and
// silently skip anything malformed; nothing is ever executed.

import type {
  DigestDay,
  DigestEntry,
  DigestDriftEntry,
  DriftEvent,
  ProbeResult,
  StatusStore,
  Verdict,
} from './types.ts';

/** A history row is either a ProbeResult (no `type`) or a DriftEvent. */
export type ProbeEventRow = ProbeResult | DriftEvent;

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

/** Type guard: a well-formed DriftEvent row. */
function isDriftRow(row: unknown): row is DriftEvent {
  return (
    isObject(row) &&
    row.type === 'drift' &&
    typeof row.slug === 'string' &&
    typeof row.changed_at === 'string'
  );
}

/** Type guard: a well-formed ProbeResult row (no drift discriminator). */
function isProbeRow(row: unknown): row is ProbeResult {
  return (
    isObject(row) &&
    row.type === undefined &&
    typeof row.slug === 'string' &&
    typeof row.verdict === 'string' &&
    KNOWN_VERDICTS.has(row.verdict as Verdict) &&
    typeof row.checked_at === 'string'
  );
}

/** A probe verdict counts as "alive" (a recovery target) only when GOOD. */
function isGood(v: Verdict): boolean {
  return v === 'GOOD';
}

/**
 * A verdict the digest treats as a "live" predecessor for a DOWN transition.
 * Going DOWN is only newsworthy when the server was previously answering in an
 * MCP-meaningful way (GOOD/WARN/AUTH_REQUIRED) — not from UNPROBEABLE/unknown.
 */
function isLive(v: Verdict): boolean {
  return v === 'GOOD' || v === 'WARN' || v === 'AUTH_REQUIRED';
}

interface ComputeOptions {
  /** Lookback window in hours (default 24). */
  windowHours?: number;
  /** Upper bound of the window as epoch ms (default Date.now()). */
  nowMs?: number;
  /** Optional StatusStore for corroborating fields (last_seen_good_at). */
  status?: StatusStore | null;
}

/**
 * Compute a daily digest from probe-events history.
 *
 * @param events  parsed probe-events rows (ProbeResult | DriftEvent), any order
 * @param opts    window + clock + optional StatusStore
 */
export function computeDigest(
  events: ProbeEventRow[],
  opts: ComputeOptions = {},
): DigestDay {
  const windowHours =
    typeof opts.windowHours === 'number' && opts.windowHours > 0
      ? opts.windowHours
      : 24;
  const nowMs = typeof opts.nowMs === 'number' ? opts.nowMs : Date.now();
  const windowStartMs = nowMs - windowHours * 3_600_000;

  // last-good lookup from the StatusStore, if provided.
  const lastGoodBySlug = new Map<string, string | null>();
  if (opts.status && Array.isArray(opts.status.statuses)) {
    for (const s of opts.status.statuses) {
      if (isObject(s) && typeof s.slug === 'string') {
        lastGoodBySlug.set(s.slug, s.last_seen_good_at ?? null);
      }
    }
  }

  // Split + validate untrusted rows.
  const probesBySlug = new Map<string, ProbeResult[]>();
  const drifts: DriftEvent[] = [];
  for (const row of events) {
    if (isDriftRow(row)) {
      drifts.push(row);
    } else if (isProbeRow(row)) {
      const list = probesBySlug.get(row.slug);
      if (list) list.push(row);
      else probesBySlug.set(row.slug, [row]);
    }
    // anything else is malformed/untrusted and dropped.
  }

  const newly_dead: DigestEntry[] = [];
  const recovered: DigestEntry[] = [];

  // Replay each server's probe timeline to find DOWN crossings in the window.
  for (const [slug, rows] of probesBySlug) {
    // stable sort by checked_at (rows with bad timestamps already excluded by
    // isProbeRow only checking string-ness — guard again here).
    const ordered = rows
      .map((r) => ({ r, ms: toMs(r.checked_at) }))
      .filter((x): x is { r: ProbeResult; ms: number } => x.ms !== null)
      .sort((a, b) => a.ms - b.ms);

    let prevVerdict: Verdict | null = null;
    for (const { r, ms } of ordered) {
      const v = r.verdict;
      if (prevVerdict !== null && v !== prevVerdict) {
        const inWindow = ms >= windowStartMs && ms <= nowMs;
        if (inWindow) {
          // GOOD/WARN/AUTH → DOWN.
          if (v === 'DOWN' && isLive(prevVerdict)) {
            newly_dead.push({
              slug,
              from_verdict: prevVerdict,
              to_verdict: 'DOWN',
              changed_at: r.checked_at,
              failure_reason: r.failure_reason,
              last_seen_good_at: lastGoodBySlug.get(slug) ?? null,
            });
          }
          // DOWN → GOOD.
          if (prevVerdict === 'DOWN' && isGood(v)) {
            recovered.push({
              slug,
              from_verdict: 'DOWN',
              to_verdict: 'GOOD',
              changed_at: r.checked_at,
              last_seen_good_at: lastGoodBySlug.get(slug) ?? null,
            });
          }
        }
      }
      prevVerdict = v;
    }
  }

  // Drift bucket: DriftEvents whose changed_at falls inside the window.
  const drifted: DigestDriftEntry[] = [];
  for (const d of drifts) {
    const ms = toMs(d.changed_at);
    if (ms === null || ms < windowStartMs || ms > nowMs) continue;
    drifted.push({
      slug: d.slug,
      changed_at: d.changed_at,
      schema_changed: Boolean(d.schema_changed),
      protocol_version_changed: Boolean(d.protocol_version_changed),
      tool_diff: d.tool_diff ?? null,
      prev_protocol_version: d.prev_protocol_version ?? null,
      negotiated_protocol_version: d.negotiated_protocol_version ?? null,
    });
  }

  // Deterministic ordering for stable output/diffing.
  const bySlugThenTime = (a: { slug: string; changed_at: string }, b: { slug: string; changed_at: string }) =>
    a.changed_at < b.changed_at ? -1 : a.changed_at > b.changed_at ? 1 : a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  newly_dead.sort(bySlugThenTime);
  recovered.sort(bySlugThenTime);
  drifted.sort(bySlugThenTime);

  return {
    generated_at: new Date(nowMs).toISOString(),
    window_hours: windowHours,
    window_start: new Date(windowStartMs).toISOString(),
    window_end: new Date(nowMs).toISOString(),
    newly_dead,
    drifted,
    recovered,
    counts: {
      newly_dead: newly_dead.length,
      drifted: drifted.length,
      recovered: recovered.length,
    },
  };
}

/**
 * Render a digest as Markdown for the content engine. Pure (no IO). Empty
 * buckets are stated explicitly so the output is self-describing.
 */
export function renderDigestMarkdown(digest: DigestDay): string {
  const lines: string[] = [];
  const day = digest.window_end.slice(0, 10);
  lines.push(`# MCP server trust digest — ${day}`);
  lines.push('');
  lines.push(
    `Window: last ${digest.window_hours}h ` +
      `(${digest.window_start} → ${digest.window_end})`,
  );
  lines.push('');
  lines.push(
    `**${digest.counts.newly_dead} newly dead · ` +
      `${digest.counts.drifted} drifted · ` +
      `${digest.counts.recovered} recovered**`,
  );
  lines.push('');

  lines.push('## Newly dead');
  if (digest.newly_dead.length === 0) {
    lines.push('_None._');
  } else {
    for (const e of digest.newly_dead) {
      const last = e.last_seen_good_at ? `, last good ${e.last_seen_good_at}` : '';
      const reason = e.failure_reason ? ` — ${e.failure_reason}` : '';
      lines.push(
        `- **${e.slug}**: ${e.from_verdict} → DOWN at ${e.changed_at}${last}${reason}`,
      );
    }
  }
  lines.push('');

  lines.push('## Drifted');
  if (digest.drifted.length === 0) {
    lines.push('_None._');
  } else {
    for (const d of digest.drifted) {
      const parts: string[] = [];
      if (d.tool_diff) {
        const { added, removed, changed } = d.tool_diff;
        const sub: string[] = [];
        if (added.length) sub.push(`+[${added.join(', ')}]`);
        if (removed.length) sub.push(`-[${removed.join(', ')}]`);
        if (changed.length) sub.push(`~[${changed.join(', ')}]`);
        if (sub.length) parts.push(`tools ${sub.join(' ')}`);
      }
      if (d.protocol_version_changed) {
        parts.push(
          `protocol ${d.prev_protocol_version ?? '?'} → ${d.negotiated_protocol_version ?? '?'}`,
        );
      }
      const detail = parts.length ? parts.join('; ') : 'schema changed';
      lines.push(`- **${d.slug}**: ${detail} (at ${d.changed_at})`);
    }
  }
  lines.push('');

  lines.push('## Recovered');
  if (digest.recovered.length === 0) {
    lines.push('_None._');
  } else {
    for (const e of digest.recovered) {
      lines.push(`- **${e.slug}**: DOWN → GOOD at ${e.changed_at}`);
    }
  }
  lines.push('');

  return lines.join('\n');
}
