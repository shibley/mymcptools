// Catalog-wide aggregate health, derived on read from the committed
// current_status store (PRD P0-7 data layer). Pure + dependency-free so it is
// trivially testable and safe to call on every request; the underlying store is
// a static committed JSON file, so there is no I/O here.

import { allStatuses, generatedAt, summary } from '@/lib/trust/status-store';
import { VERDICTS } from '@/lib/trust/types';
import type {
  CatalogStats,
  CurrentStatus,
  Transport,
  Verdict,
} from '@/lib/trust/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Servers counted as "currently serving" for the headline liveness figure. */
const SERVING: ReadonlySet<Verdict> = new Set<Verdict>(['GOOD', 'WARN']);

/** Round to one decimal place (percentages are reported in 0.1% steps). */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Percent of `part` over `whole`, 0 when `whole` is 0, to 0.1%. */
function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : round1((part / whole) * 100);
}

/**
 * Nearest-rank percentile over an already-sorted ascending numeric array.
 * Returns null for an empty sample.
 */
function percentile(sortedAsc: readonly number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  const rank = Math.ceil((p / 100) * sortedAsc.length);
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, rank - 1));
  return sortedAsc[idx];
}

/**
 * Compute the catalog-wide stats object. `rows` and the reference timestamp are
 * injected so this is a pure function of its inputs (deterministic + testable);
 * `computeCatalogStatsFromStore` wires the committed store in for the route.
 */
export function computeCatalogStats(
  rows: readonly CurrentStatus[],
  generated_at: string,
  verdictCounts: Record<Verdict, number>
): CatalogStats {
  const total = rows.length;

  const verdict_percent = {} as Record<Verdict, number>;
  for (const v of VERDICTS) verdict_percent[v] = pct(verdictCounts[v] ?? 0, total);

  const probeableCount = total - (verdictCounts.UNPROBEABLE ?? 0);
  const serving =
    (verdictCounts.GOOD ?? 0) + (verdictCounts.WARN ?? 0);

  const transports: Record<Transport | 'none', number> = {
    'streamable-http': 0,
    sse: 0,
    none: 0,
  };

  const latencies: number[] = [];
  let toolTotal = 0;
  let servingWithTools = 0;
  let schemaChanged = 0;
  let protocolChanged = 0;
  let probedLast24h = 0;
  let oldest: number | null = null;
  let newest: number | null = null;

  const referenceMs = Date.parse(generated_at);

  for (const s of rows) {
    transports[s.transport ?? 'none'] += 1;

    if (typeof s.latency_ms === 'number' && Number.isFinite(s.latency_ms)) {
      latencies.push(s.latency_ms);
    }

    if (typeof s.tool_count === 'number' && s.tool_count > 0) {
      toolTotal += s.tool_count;
      if (SERVING.has(s.verdict)) servingWithTools += 1;
    }

    if (s.schema_changed) schemaChanged += 1;
    if (s.protocol_version_changed) protocolChanged += 1;

    const checked = Date.parse(s.checked_at);
    if (!Number.isNaN(checked)) {
      if (!Number.isNaN(referenceMs) && referenceMs - checked <= DAY_MS) {
        probedLast24h += 1;
      }
      oldest = oldest === null ? checked : Math.min(oldest, checked);
      newest = newest === null ? checked : Math.max(newest, checked);
    }
  }

  latencies.sort((a, b) => a - b);

  return {
    generated_at,
    total,
    verdicts: verdictCounts,
    verdict_percent,
    probeable: {
      count: probeableCount,
      serving,
      serving_percent: pct(serving, probeableCount),
    },
    transports,
    drift: {
      schema_changed: schemaChanged,
      protocol_changed: protocolChanged,
    },
    latency_ms: {
      sampled: latencies.length,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
    },
    tools: {
      total: toolTotal,
      avg_per_serving:
        servingWithTools === 0
          ? null
          : round1(toolTotal / servingWithTools),
    },
    freshness: {
      probed_last_24h: probedLast24h,
      oldest_checked_at: oldest === null ? null : new Date(oldest).toISOString(),
      newest_checked_at: newest === null ? null : new Date(newest).toISOString(),
    },
  };
}

/** Compute stats from the committed probe-status store. */
export function computeCatalogStatsFromStore(): CatalogStats {
  return computeCatalogStats(allStatuses(), generatedAt(), summary());
}
