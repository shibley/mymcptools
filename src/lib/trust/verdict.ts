// Trust verdict model — the scoring layer behind /trust (PRD "Trust Registry").
//
// Everything else in src/lib/trust answers "what did we observe?". This file
// answers the only question a user actually has: "should I rely on this
// server?" — and, just as importantly, "on what evidence?".
//
// Three rules shape the whole design:
//
//   1. EXPLAINABLE. A score with no reasons is a number someone made up. Every
//      verdict carries the full list of signals that fed it, each with the
//      weight it contributed and what was actually measured. The UI renders
//      that list verbatim; there is no hidden term.
//
//   2. UNKNOWN IS NOT ZERO. A signal we could not measure contributes nothing
//      and lowers confidence — it never silently penalises. Scores are a
//      weighted mean over *measured* signals only. A server we know nothing
//      about scores `null`, not 50.
//
//   3. UNVERIFIED SOURCE IS NEVER SCORED. 1,438 of the 2,444 catalog entries
//      have no repository that resolves against the live GitHub API
//      (`source_verified !== true`). Scoring those would be inventing trust for
//      software we cannot even confirm exists. They short-circuit to
//      UNVERIFIABLE with a null score and are excluded from every ranking.
//
// ⚠️ MONOREPO RULE — do not remove. Seven of the official
// `modelcontextprotocol/servers` reference servers (everything, fetch,
// filesystem, git, memory, sequentialthinking, time) live at
// `/tree/main/src/<name>` inside one shared repo, as do the archived ones under
// `modelcontextprotocol/servers-archived`. Any heuristic that compares the
// *repo* name against the *listing* name flags these — the most trustworthy
// entries in the catalog — as suspicious. The catalog-repair pass proved it:
// scripts/.verify-state.json records `sequential-thinking` as status
// "mismatch" (overlap 0.00) purely because the repo is called "servers". So
// `parseRepoRef` reads the monorepo subpath as the effective repo name, and
// `repo_link` treats a subpath match as positive evidence, never a penalty.
//
// This module is PURE: no I/O, no wall clock (the caller passes `now`), no
// dependency on the stores. verdict-store.ts does the joining.

import type { CurrentStatus, StaticSignal, Verdict } from './types.ts';

// ---------------------------------------------------------------------------
// Public shapes
// ---------------------------------------------------------------------------

/**
 * Letter grade for a *measured* server, or one of the two honest non-grades.
 *
 *   A–E          — scored from real evidence.
 *   UNMEASURED   — repository confirmed, but nothing about its behaviour has
 *                  been measured yet (no live endpoint, no repo freshness).
 *   UNVERIFIABLE — no repository resolves; we decline to score it at all.
 */
export type TrustTier = 'A' | 'B' | 'C' | 'D' | 'E' | 'UNMEASURED' | 'UNVERIFIABLE';

/** How much evidence stands behind a score. Derived, never asserted. */
export type TrustConfidence = 'high' | 'medium' | 'low' | 'none';

/** Direction a signal pushed the verdict, for UI colour only. */
export type SignalPolarity = 'positive' | 'neutral' | 'negative' | 'unknown';

/** One explainable contribution to a verdict. */
export interface TrustSignal {
  /** Stable id, safe to use as a filter/anchor key. */
  id: TrustSignalId;
  /** Short human label, e.g. "Live MCP handshake". */
  label: string;
  /** What was actually observed, in plain English. Rendered as-is. */
  detail: string;
  polarity: SignalPolarity;
  /** 0..100 for this signal alone, or null when it could not be measured. */
  score: number | null;
  /** Weight applied to `score` in the mean. 0 when unmeasured. */
  weight: number;
  /**
   * True when this signal required an actual measurement (a probe, a repo
   * fetch) rather than being readable straight off the catalog row. Only these
   * count toward confidence.
   */
  measured: boolean;
}

export type TrustSignalId =
  | 'source'
  | 'protocol'
  | 'uptime'
  | 'schema_stability'
  | 'maintenance'
  | 'provenance'
  | 'repo_link';

export interface TrustVerdict {
  slug: string;
  tier: TrustTier;
  /**
   * 0..100 weighted mean over measured signals. `null` for UNVERIFIABLE (no
   * confirmed source) and UNMEASURED (nothing observed) — deliberately not 0
   * and not a placeholder, so a null can never be mistaken for a bad score.
   */
  score: number | null;
  confidence: TrustConfidence;
  /** Every signal considered, measured or not, in display order. */
  signals: TrustSignal[];
  /** Count of signals in `signals` with `measured && score !== null`. */
  evidenceCount: number;
  /** True when a live MCP handshake result contributed. Drives the ranking. */
  liveMeasured: boolean;
  /** One-line plain-English summary, safe to render alone. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** Trailing uptime over the probe history window. */
export interface UptimeWindow {
  /** Probes that answered the handshake in any MCP-meaningful way. */
  up: number;
  /** Total probes with a real verdict (UNPROBEABLE rows excluded). */
  total: number;
}

/**
 * Everything the model needs about one server. Assembled by verdict-store from
 * the catalog + the four committed stores; kept flat so the scorer stays pure
 * and unit-testable without touching disk.
 */
export interface TrustInputs {
  slug: string;
  name: string;
  /** Catalog `source_verified` — did the repo URL resolve on the live API? */
  sourceVerified: boolean;
  /** Catalog `verification`. 'unresolved' (or absent) means no real repo. */
  verification: 'live' | 'archived' | 'unresolved' | undefined;
  githubUrl: string | null;
  official: boolean;
  /** Latest probe row, when the server has ever been probed. */
  status?: CurrentStatus;
  /** Trailing uptime; omit when fewer than MIN_UPTIME_PROBES points exist. */
  uptime?: UptimeWindow;
  /** Probe rows recorded for this server (any verdict). */
  probeCount: number;
  /** Drift events recorded within the trailing window. */
  driftCount: number;
  /** GitHub freshness signal, when one has been fetched for this repo. */
  staticSignal?: StaticSignal;
}

// ---------------------------------------------------------------------------
// Tuning constants — every magic number in the model lives here.
// ---------------------------------------------------------------------------

/** Weights. Deliberately front-load *observed behaviour* over provenance. */
const WEIGHTS: Record<TrustSignalId, number> = {
  protocol: 30,
  source: 25,
  uptime: 20,
  maintenance: 20,
  schema_stability: 15,
  provenance: 10,
  repo_link: 5,
};

/** Minimum probe rows before an uptime percentage means anything. */
export const MIN_UPTIME_PROBES = 3;
/** Minimum probe rows before "no drift observed" is a claim worth making. */
export const MIN_STABILITY_PROBES = 2;
/** Trailing window for drift counting, in days. */
export const DRIFT_WINDOW_DAYS = 90;
/** Each drift event inside the window costs this much of the stability score. */
const DRIFT_PENALTY = 30;

/** Score floors for each letter grade, highest first. */
const TIER_FLOORS: { tier: Exclude<TrustTier, 'UNMEASURED' | 'UNVERIFIABLE'>; min: number }[] = [
  { tier: 'A', min: 85 },
  { tier: 'B', min: 70 },
  { tier: 'C', min: 55 },
  { tier: 'D', min: 40 },
  { tier: 'E', min: 0 },
];

export const TIER_LABELS: Record<TrustTier, string> = {
  A: 'Reliable',
  B: 'Solid',
  C: 'Mixed',
  D: 'Weak',
  E: 'At risk',
  UNMEASURED: 'Not yet measured',
  UNVERIFIABLE: 'Unverifiable',
};

export const TIER_DESCRIPTIONS: Record<TrustTier, string> = {
  A: 'Measured evidence is strong across the board — answering, stable, and maintained.',
  B: 'Measured evidence is good, with one soft spot.',
  C: 'Mixed evidence — something measurable is not going well.',
  D: 'Weak evidence — multiple measured signals are poor.',
  E: 'At risk — the measured signals say do not depend on this without testing it yourself.',
  UNMEASURED:
    'The repository is confirmed to exist, but nothing about this server has been measured yet — no remote endpoint to handshake and no repository-freshness signal collected. Absence of evidence, not evidence of a problem.',
  UNVERIFIABLE:
    'No repository for this entry resolves against the live GitHub API, so there is nothing to verify. It is deliberately left unscored rather than given a number we cannot stand behind.',
};

// ---------------------------------------------------------------------------
// Monorepo-aware repository parsing (see the ⚠️ note at the top of the file)
// ---------------------------------------------------------------------------

export interface RepoRef {
  owner: string;
  repo: string;
  /** Path inside the repo when the URL is a /tree/<ref>/<path> link. */
  subpath: string | null;
  /**
   * The name a listing should be compared against: the last segment of the
   * monorepo subpath when there is one, otherwise the repo name. This is the
   * single line that keeps the official reference servers from being flagged.
   */
  effectiveName: string;
  /** True when the URL points inside a monorepo rather than at its root. */
  isMonorepoSubpath: boolean;
}

/**
 * The official MCP reference implementations, pinned by exact monorepo subpath.
 *
 * Pinning rather than trusting the owner is deliberate. The catalog contains at
 * least one entry (`yfinance-mcp`) that claims
 * `modelcontextprotocol/servers/tree/main/src/yfinance` — a path that returns
 * 404. The repair pass confirmed the *repository* resolves, which is all a
 * repo-level check can confirm; it says nothing about the subpath. Trusting the
 * owner alone would hand a false "official reference implementation" badge to
 * anything that points at the right repo with the wrong path, which is exactly
 * the kind of unearned trust this registry exists to stop.
 *
 * Verified against the GitHub contents API on 2026-07-25. A subpath not on this
 * list is not penalised — it simply gets no provenance boost and is matched on
 * name like any other repository.
 */
const REFERENCE_SUBPATHS: Record<string, ReadonlySet<string>> = {
  'modelcontextprotocol/servers': new Set([
    'src/everything',
    'src/fetch',
    'src/filesystem',
    'src/git',
    'src/memory',
    'src/sequentialthinking',
    'src/time',
  ]),
  // Retired reference servers. Still officially-authored provenance; the
  // archived penalty is applied separately by the source/maintenance signals.
  'modelcontextprotocol/servers-archived': new Set([
    'src/aws-kb-retrieval-server',
    'src/gdrive',
    'src/postgres',
    'src/puppeteer',
    'src/redis',
    'src/sqlite',
  ]),
};

/**
 * Parse a github.com URL into owner / repo / monorepo subpath. Returns null for
 * anything that is not a recognisable GitHub repository URL (including null
 * input — 1,438 catalog rows carry `github_url: null` by design).
 */
export function parseRepoRef(url: string | null | undefined): RepoRef | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)github\.com$/i.test(parsed.hostname)) return null;

  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length < 2) return null;

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');

  // .../tree/<ref>/<...path> — the monorepo case. Everything after the ref is
  // the path to the actual server inside the repo.
  let subpath: string | null = null;
  if (parts[2] === 'tree' && parts.length >= 5) {
    subpath = parts.slice(4).join('/');
  }

  const lastSegment = subpath ? subpath.split('/').filter(Boolean).pop() ?? null : null;

  return {
    owner,
    repo,
    subpath,
    effectiveName: lastSegment ?? repo,
    isMonorepoSubpath: Boolean(subpath),
  };
}

/**
 * True only when the URL points at a *confirmed* official reference server —
 * right repository AND a subpath known to exist. See REFERENCE_SUBPATHS.
 */
export function isReferenceMonorepo(ref: RepoRef | null): boolean {
  if (!ref || !ref.isMonorepoSubpath || !ref.subpath) return false;
  const known = REFERENCE_SUBPATHS[`${ref.owner.toLowerCase()}/${ref.repo.toLowerCase()}`];
  return Boolean(known?.has(ref.subpath));
}

/** Lowercase alphanumeric tokens, for tolerant name comparison. */
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length > 1 && !STOP_TOKENS.has(t));
}

const STOP_TOKENS = new Set(['mcp', 'server', 'servers', 'the', 'for', 'and', 'api']);

/**
 * Does the linked repository plausibly correspond to the listing? Compares the
 * *effective* name (monorepo subpath aware) and the owner against the listing
 * name. This can only ever produce "matched" or "not obviously matched" — the
 * unmatched case is informational and costs a small, capped amount, because a
 * confirmed-live repo with an unrelated name is a reason to look twice, not a
 * reason to call a server untrustworthy.
 */
export function repoNameMatches(name: string, ref: RepoRef): boolean {
  const nameTokens = new Set(tokenize(name));
  if (nameTokens.size === 0) return true; // nothing to compare against

  const candidates = [...tokenize(ref.effectiveName), ...tokenize(ref.owner)];
  if (candidates.some((t) => nameTokens.has(t))) return true;

  // Compact forms: "sequential-thinking" vs subpath "sequentialthinking".
  const compactName = [...nameTokens].join('');
  const compactRepo = ref.effectiveName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!compactName || !compactRepo) return false;
  return compactName.includes(compactRepo) || compactRepo.includes(compactName);
}

// ---------------------------------------------------------------------------
// Signal builders
// ---------------------------------------------------------------------------

function unknownSignal(
  id: TrustSignalId,
  label: string,
  detail: string
): TrustSignal {
  return { id, label, detail, polarity: 'unknown', score: null, weight: 0, measured: true };
}

function sourceSignal(input: TrustInputs): TrustSignal {
  const base = { id: 'source' as const, label: 'Source verification', weight: WEIGHTS.source, measured: false };
  if (input.verification === 'archived') {
    return {
      ...base,
      detail:
        'The repository resolves, but its owner has archived it. Archived means read-only: no fixes, no releases, no response to issues.',
      polarity: 'negative',
      score: 15,
    };
  }
  return {
    ...base,
    detail:
      'The repository URL was confirmed to resolve against the live GitHub API and is not archived.',
    polarity: 'positive',
    score: 100,
  };
}

const PROTOCOL_SCORES: Partial<Record<Verdict, { score: number; polarity: SignalPolarity; detail: string }>> = {
  GOOD: {
    score: 100,
    polarity: 'positive',
    detail:
      'Completed a full Model Context Protocol handshake on the last check and returned a tool list.',
  },
  AUTH_REQUIRED: {
    score: 85,
    polarity: 'positive',
    detail:
      'Answered with an OAuth/Bearer challenge — the endpoint is alive and speaking MCP, it just requires credentials before it will list tools.',
  },
  WARN: {
    score: 45,
    polarity: 'negative',
    detail:
      'Speaks MCP but returned no tools, or only a partial tool list. An agent that connects will find nothing useful to call.',
  },
  DOWN: {
    score: 0,
    polarity: 'negative',
    detail:
      'Failed the MCP handshake on several consecutive checks. A plain HTTP 200 from a proxy does not count as up.',
  },
};

function protocolSignal(input: TrustInputs): TrustSignal {
  const label = 'Live MCP handshake';
  const verdict = input.status?.verdict;

  if (!verdict || verdict === 'UNPROBEABLE') {
    return unknownSignal(
      'protocol',
      label,
      'No remote endpoint to handshake — this server installs and runs locally over stdio, so there is nothing to probe from the outside.'
    );
  }

  const mapped = PROTOCOL_SCORES[verdict];
  if (!mapped) {
    return unknownSignal('protocol', label, 'The recorded probe verdict is not one this model scores.');
  }

  const extras: string[] = [];
  if (input.status?.tool_count != null) extras.push(`${input.status.tool_count} tools exposed`);
  if (input.status?.latency_ms != null) extras.push(`${input.status.latency_ms} ms handshake`);
  if (input.status?.negotiated_protocol_version) {
    extras.push(`protocol ${input.status.negotiated_protocol_version}`);
  }

  return {
    id: 'protocol',
    label,
    detail: extras.length > 0 ? `${mapped.detail} (${extras.join(', ')})` : mapped.detail,
    polarity: mapped.polarity,
    score: mapped.score,
    weight: WEIGHTS.protocol,
    measured: true,
  };
}

function uptimeSignal(input: TrustInputs): TrustSignal {
  const label = 'Measured uptime';
  const w = input.uptime;
  if (!w || w.total < MIN_UPTIME_PROBES) {
    return unknownSignal(
      'uptime',
      label,
      w
        ? `Only ${w.total} recorded ${w.total === 1 ? 'check' : 'checks'} — fewer than the ${MIN_UPTIME_PROBES} needed before an uptime percentage means anything.`
        : 'No probe history recorded for this server yet.'
    );
  }

  const pct = (w.up / w.total) * 100;
  const rounded = Math.round(pct * 10) / 10;
  const polarity: SignalPolarity = pct >= 99 ? 'positive' : pct >= 95 ? 'neutral' : 'negative';

  return {
    id: 'uptime',
    label,
    detail: `Answered ${w.up} of ${w.total} recorded checks (${rounded}%). A check counts as answered when the server completed the MCP handshake in any form, including an auth challenge.`,
    polarity,
    score: Math.round(pct),
    weight: WEIGHTS.uptime,
    measured: true,
  };
}

function stabilitySignal(input: TrustInputs): TrustSignal {
  const label = 'Tool-schema stability';
  if (input.probeCount < MIN_STABILITY_PROBES) {
    return unknownSignal(
      'schema_stability',
      label,
      `Drift is a difference between two successive checks, and this server has ${input.probeCount === 0 ? 'none' : `only ${input.probeCount}`} recorded.`
    );
  }

  const drifts = input.driftCount;
  const score = Math.max(0, 100 - DRIFT_PENALTY * drifts);
  return {
    id: 'schema_stability',
    label,
    detail:
      drifts === 0
        ? `No tool-schema or protocol-version drift across ${input.probeCount} recorded checks. Tools an agent bound to last week are still the tools it will find today.`
        : `${drifts} schema or protocol change${drifts === 1 ? '' : 's'} recorded in the last ${DRIFT_WINDOW_DAYS} days. Tools appearing, vanishing or changing shape underneath a running agent is the single largest preventable class of MCP failure.`,
    polarity: drifts === 0 ? 'positive' : 'negative',
    score,
    weight: WEIGHTS.schema_stability,
    measured: true,
  };
}

const FRESHNESS_SCORES: Record<
  NonNullable<StaticSignal['freshness']>,
  { score: number; polarity: SignalPolarity; detail: string } | null
> = {
  active: {
    score: 100,
    polarity: 'positive',
    detail: 'The repository has been pushed to or released within the last six months.',
  },
  aging: {
    score: 55,
    polarity: 'neutral',
    detail: 'The last push or release is between six and eighteen months old.',
  },
  stale: {
    score: 15,
    polarity: 'negative',
    detail:
      'No push or release in over eighteen months. Nobody is patching this if the upstream API it wraps changes.',
  },
  unknown: null,
};

function maintenanceSignal(input: TrustInputs): TrustSignal {
  const label = 'Repository maintenance';
  const signal = input.staticSignal;

  if (input.verification === 'archived') {
    return {
      id: 'maintenance',
      label,
      detail: 'The repository is archived by its owner, so it is by definition no longer maintained.',
      polarity: 'negative',
      score: 0,
      weight: WEIGHTS.maintenance,
      measured: true,
    };
  }

  if (!signal || !signal.freshness || signal.freshness === 'unknown') {
    return unknownSignal(
      'maintenance',
      label,
      signal?.error
        ? `Repository freshness could not be read: ${signal.error}`
        : 'No repository-freshness reading has been collected for this server yet.'
    );
  }

  const mapped = FRESHNESS_SCORES[signal.freshness];
  if (!mapped) {
    return unknownSignal('maintenance', label, 'No repository-freshness reading has been collected for this server yet.');
  }

  const dates: string[] = [];
  if (signal.last_commit_at) dates.push(`last push ${signal.last_commit_at.slice(0, 10)}`);
  if (signal.last_release_at) {
    dates.push(
      `last release ${signal.last_release_at.slice(0, 10)}${signal.last_release_tag ? ` (${signal.last_release_tag})` : ''}`
    );
  }

  return {
    id: 'maintenance',
    label,
    detail: dates.length > 0 ? `${mapped.detail} — ${dates.join(', ')}.` : mapped.detail,
    polarity: mapped.polarity,
    score: mapped.score,
    weight: WEIGHTS.maintenance,
    measured: true,
  };
}

function provenanceSignal(input: TrustInputs, ref: RepoRef | null): TrustSignal {
  const base = { id: 'provenance' as const, label: 'Provenance', weight: WEIGHTS.provenance, measured: false };

  if (isReferenceMonorepo(ref) && ref) {
    return {
      ...base,
      detail: `Official Model Context Protocol reference implementation, published by ${ref.owner} at ${ref.repo}/${ref.subpath}.`,
      polarity: 'positive',
      score: 100,
    };
  }
  if (input.official) {
    return {
      ...base,
      detail: 'Published and maintained by the vendor of the service it connects to, rather than by a third party.',
      polarity: 'positive',
      score: 90,
    };
  }
  return {
    ...base,
    detail:
      'Community-built. That is not a mark against it — most of the ecosystem is community-built — but there is no vendor accountable for keeping it working.',
    polarity: 'neutral',
    score: 65,
  };
}

function repoLinkSignal(input: TrustInputs, ref: RepoRef | null): TrustSignal {
  const base = { id: 'repo_link' as const, label: 'Listing ↔ repository match', weight: WEIGHTS.repo_link, measured: false };

  if (!ref) {
    return unknownSignal('repo_link', base.label, 'No repository URL to compare against this listing.');
  }

  // ⚠️ MONOREPO RULE. The subpath *is* the server. Comparing this listing
  // against the repository name ("servers") is what wrongly flagged the
  // official reference implementations as mismatches.
  if (ref.isMonorepoSubpath) {
    if (isReferenceMonorepo(ref)) {
      return {
        ...base,
        detail: `The link points at ${ref.subpath} inside the ${ref.owner}/${ref.repo} monorepo — a confirmed official reference implementation. Monorepo subpaths are read as the server name, never compared against the repository name.`,
        polarity: 'positive',
        score: 100,
      };
    }
    if (repoNameMatches(input.name, ref)) {
      return {
        ...base,
        detail: `The link points at ${ref.subpath} inside the ${ref.owner}/${ref.repo} monorepo, and that subpath matches this listing. Monorepo subpaths are read as the server name, never compared against the repository name.`,
        polarity: 'positive',
        score: 100,
      };
    }
    return {
      ...base,
      detail: `The link points at ${ref.subpath} inside the ${ref.owner}/${ref.repo} monorepo, but that subpath does not correspond to this listing. Verification confirmed the repository exists; it cannot confirm a path inside it. Open the link before trusting the mapping.`,
      polarity: 'neutral',
      score: 70,
    };
  }

  if (repoNameMatches(input.name, ref)) {
    return {
      ...base,
      detail: `The listing name lines up with the linked repository ${ref.owner}/${ref.repo}.`,
      polarity: 'positive',
      score: 100,
    };
  }

  return {
    ...base,
    detail: `The linked repository ${ref.owner}/${ref.repo} was confirmed to exist, but its name does not obviously correspond to this listing. Worth opening the repo before you trust the mapping.`,
    polarity: 'neutral',
    score: 70,
  };
}

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

/** Signals whose presence indicates something was actually observed. */
const EVIDENCE_SIGNALS: TrustSignalId[] = ['protocol', 'uptime', 'schema_stability', 'maintenance'];

function tierForScore(score: number): TrustTier {
  for (const { tier, min } of TIER_FLOORS) {
    if (score >= min) return tier;
  }
  return 'E';
}

function confidenceForEvidence(count: number): TrustConfidence {
  if (count >= 3) return 'high';
  if (count === 2) return 'medium';
  if (count === 1) return 'low';
  return 'none';
}

/**
 * Compute a server's trust verdict. Pure — same inputs always give the same
 * output, so the result can be cached, exported, or diffed across runs.
 */
export function computeTrustVerdict(input: TrustInputs): TrustVerdict {
  // Rule 3: an entry with no repository that resolves is never scored.
  if (!input.sourceVerified || input.verification === 'unresolved' || !input.githubUrl) {
    return {
      slug: input.slug,
      tier: 'UNVERIFIABLE',
      score: null,
      confidence: 'none',
      signals: [
        {
          id: 'source',
          label: 'Source verification',
          detail:
            'No repository for this entry resolves against the live GitHub API. Without a confirmed source there is nothing to inspect, so this entry is excluded from trust scoring entirely rather than scored on catalog metadata alone.',
          polarity: 'negative',
          score: null,
          weight: 0,
          measured: false,
        },
      ],
      evidenceCount: 0,
      liveMeasured: false,
      summary: TIER_DESCRIPTIONS.UNVERIFIABLE,
    };
  }

  const ref = parseRepoRef(input.githubUrl);

  const signals: TrustSignal[] = [
    protocolSignal(input),
    uptimeSignal(input),
    stabilitySignal(input),
    maintenanceSignal(input),
    sourceSignal(input),
    provenanceSignal(input, ref),
    repoLinkSignal(input, ref),
  ];

  const evidenceCount = signals.filter(
    (s) => EVIDENCE_SIGNALS.includes(s.id) && s.score !== null
  ).length;
  const liveMeasured = signals.some((s) => s.id === 'protocol' && s.score !== null);
  const confidence = confidenceForEvidence(evidenceCount);

  // Rule 2: nothing observed → no score. Not zero, not a default.
  if (evidenceCount === 0) {
    return {
      slug: input.slug,
      tier: 'UNMEASURED',
      score: null,
      confidence: 'none',
      signals,
      evidenceCount: 0,
      liveMeasured: false,
      summary: TIER_DESCRIPTIONS.UNMEASURED,
    };
  }

  let weighted = 0;
  let totalWeight = 0;
  for (const s of signals) {
    if (s.score === null || s.weight === 0) continue;
    weighted += s.score * s.weight;
    totalWeight += s.weight;
  }

  const score = Math.round(weighted / totalWeight);
  const tier = tierForScore(score);

  return {
    slug: input.slug,
    tier,
    score,
    confidence,
    signals,
    evidenceCount,
    liveMeasured,
    summary: summarize(tier, score, confidence, evidenceCount, liveMeasured),
  };
}

function summarize(
  tier: TrustTier,
  score: number,
  confidence: TrustConfidence,
  evidenceCount: number,
  liveMeasured: boolean
): string {
  const basis = liveMeasured
    ? 'live MCP handshakes'
    : 'repository evidence';
  const hedge =
    confidence === 'high'
      ? ''
      : confidence === 'medium'
        ? ' Two independent signals stand behind it; a third would firm it up.'
        : ' Only one signal stands behind it, so treat the grade as provisional.';
  return `Grade ${tier} (${score}/100, ${TIER_LABELS[tier].toLowerCase()}) from ${evidenceCount} measured ${evidenceCount === 1 ? 'signal' : 'signals'}, based on ${basis}.${hedge}`;
}

/**
 * Ranking comparator for the registry. Measured beats unmeasured, live beats
 * repository-only, then score, then evidence depth. Deterministic on slug so
 * the ordering is stable across builds.
 */
export function compareTrustVerdicts(a: TrustVerdict, b: TrustVerdict): number {
  const aScored = a.score !== null;
  const bScored = b.score !== null;
  if (aScored !== bScored) return aScored ? -1 : 1;
  if (aScored && bScored) {
    if (a.liveMeasured !== b.liveMeasured) return a.liveMeasured ? -1 : 1;
    if (b.score! !== a.score!) return b.score! - a.score!;
    if (b.evidenceCount !== a.evidenceCount) return b.evidenceCount - a.evidenceCount;
  }
  return a.slug.localeCompare(b.slug);
}
