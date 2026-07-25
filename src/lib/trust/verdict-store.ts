// Read-side accessor for computed trust verdicts (the /trust registry).
//
// verdict.ts is pure and knows nothing about disk. This module does the
// joining: for every catalog entry it assembles a TrustInputs from the four
// committed stores (probe status, probe history, drift events, static repo
// signals) and computes the verdict once, at module load.
//
// Computing on load matters: /servers/[slug] is statically generated for 2,444
// slugs, and re-deriving the whole catalog per page would be quadratic. One
// Map, built once, read everywhere.

import { servers, type MCPServer } from '@/data/servers';
import { getStatus } from '@/lib/trust/status-store';
import { getStaticSignal } from '@/lib/trust/static-signals-store';
import { getHistory } from '@/lib/trust/history-store';
import { getDrifts } from '@/lib/trust/drift-store';
import {
  computeTrustVerdict,
  compareTrustVerdicts,
  DRIFT_WINDOW_DAYS,
  MIN_UPTIME_PROBES,
  type TrustInputs,
  type TrustTier,
  type TrustVerdict,
  type UptimeWindow,
} from '@/lib/trust/verdict';

/** How far back probe history is read when computing trailing uptime. */
const HISTORY_LIMIT = 200;

const DRIFT_WINDOW_MS = DRIFT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * Anchor timestamp for every window in this build. Captured once so that all
 * verdicts in a single render are computed against the same instant — two
 * servers can never disagree about where the 90-day boundary is.
 */
const NOW = Date.now();

/** Trailing uptime from probe history. UNPROBEABLE rows carry no signal. */
function uptimeFor(slug: string): { window?: UptimeWindow; probeCount: number } {
  const history = getHistory(slug, HISTORY_LIMIT);
  const real = history.filter((p) => p.verdict !== 'UNPROBEABLE');
  if (real.length === 0) return { probeCount: 0 };

  const up = real.filter((p) => p.verdict !== 'DOWN').length;
  const window: UptimeWindow = { up, total: real.length };
  return {
    window: real.length >= MIN_UPTIME_PROBES ? window : undefined,
    probeCount: real.length,
  };
}

function inputsFor(server: MCPServer): TrustInputs {
  const { window, probeCount } = uptimeFor(server.slug);
  const drifts = getDrifts({ slug: server.slug, sinceMs: NOW - DRIFT_WINDOW_MS });

  return {
    slug: server.slug,
    name: server.name,
    sourceVerified: server.source_verified === true,
    verification: server.verification,
    githubUrl: server.github_url,
    official: server.official === true,
    status: getStatus(server.slug),
    uptime: window,
    probeCount,
    driftCount: drifts.length,
    staticSignal: getStaticSignal(server.slug),
  };
}

const verdicts = new Map<string, TrustVerdict>(
  servers.map((s) => [s.slug, computeTrustVerdict(inputsFor(s))])
);

/** One server's trust verdict, or undefined for a slug not in the catalog. */
export function getTrustVerdict(slug: string): TrustVerdict | undefined {
  return verdicts.get(slug);
}

/** Every verdict, in catalog order (do not mutate). */
export function allTrustVerdicts(): readonly TrustVerdict[] {
  return [...verdicts.values()];
}

/**
 * Every *scored* verdict, best-measured first — the registry ranking. Servers
 * with no confirmed source (UNVERIFIABLE) and none with any measurement
 * (UNMEASURED) are excluded by construction: both carry a null score.
 */
export function rankedTrustVerdicts(): TrustVerdict[] {
  return allTrustVerdicts()
    .filter((v) => v.score !== null)
    .sort(compareTrustVerdicts);
}

export interface TrustRegistryStats {
  /** Every catalog entry. */
  total: number;
  /** Entries with a confirmed, resolving repository. */
  verifiable: number;
  /** Entries excluded from scoring for want of a confirmed repository. */
  unverifiable: number;
  /** Verifiable entries with nothing measured yet. */
  unmeasured: number;
  /** Entries that received a letter grade. */
  scored: number;
  /** Scored entries whose grade includes a live MCP handshake. */
  liveMeasured: number;
  /** Scored-entry counts per letter grade. */
  tiers: Record<TrustTier, number>;
  /** Mean score across scored entries, or null when none are scored. */
  averageScore: number | null;
}

/** Headline registry counts, derived from the same verdicts the page renders. */
export function trustRegistryStats(): TrustRegistryStats {
  const all = allTrustVerdicts();
  const tiers: Record<TrustTier, number> = {
    A: 0, B: 0, C: 0, D: 0, E: 0, UNMEASURED: 0, UNVERIFIABLE: 0,
  };
  let scoreSum = 0;
  let scored = 0;
  let liveMeasured = 0;

  for (const v of all) {
    tiers[v.tier] += 1;
    if (v.score !== null) {
      scored += 1;
      scoreSum += v.score;
      if (v.liveMeasured) liveMeasured += 1;
    }
  }

  return {
    total: all.length,
    verifiable: all.length - tiers.UNVERIFIABLE,
    unverifiable: tiers.UNVERIFIABLE,
    unmeasured: tiers.UNMEASURED,
    scored,
    liveMeasured,
    tiers,
    averageScore: scored > 0 ? Math.round(scoreSum / scored) : null,
  };
}

/** The instant every window in this build was measured against. */
export function trustGeneratedAt(): string {
  return new Date(NOW).toISOString();
}
