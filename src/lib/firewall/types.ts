// Agent Dependency Firewall — corpus types.
//
// The product thesis: LLM coding agents cite package names that do not exist,
// and attackers register those names ("slopsquatting"). The defensible asset is
// not the checker — it is the *corpus* of names that have been observed being
// recommended, each carrying a verdict that traces back to a real registry
// response.
//
// Every field here is either (a) copied verbatim from a registry response, or
// (b) derived by a rule stated in src/lib/firewall/verdict.ts. Nothing in this
// schema is allowed to hold an assertion we did not measure. UNKNOWN exists
// precisely so that "we could not check" never has to be rounded to a verdict.
//
// Schema is flat + JSON-serializable so the committed JSON store can migrate to
// Postgres without reshaping, matching the trust-layer convention.

/** Package registries the firewall can verify against. */
export type Ecosystem = 'npm' | 'pypi';

export const ECOSYSTEMS: Ecosystem[] = ['npm', 'pypi'];

/**
 * Verdict for one package name in one ecosystem.
 *
 *  - EXISTS          — the registry served a record for this exact name and the
 *                      package shows established-package markers.
 *  - NONEXISTENT     — the registry returned 404 for this exact name. An agent
 *                      that writes this import produces a build that cannot
 *                      install, and the name is an open registration target.
 *  - SLOPSQUAT_RISK  — the registry served a record, but the package carries at
 *                      least two independent unestablished-package markers, or
 *                      self-declares as a defensive placeholder. This is NOT an
 *                      accusation of malice; it means "this name resolves to
 *                      something, but not to an established package — verify it
 *                      by hand before an agent installs it."
 *  - UNKNOWN         — we could not obtain a trustworthy registry answer
 *                      (network failure, timeout, 5xx, rate limit). Honest
 *                      absence of evidence. Never inferred from anything.
 */
export type PackageVerdict = 'EXISTS' | 'NONEXISTENT' | 'SLOPSQUAT_RISK' | 'UNKNOWN';

export const PACKAGE_VERDICTS: PackageVerdict[] = [
  'EXISTS',
  'NONEXISTENT',
  'SLOPSQUAT_RISK',
  'UNKNOWN',
];

/**
 * A single measured, named reason. Markers are the only thing allowed to move a
 * verdict, and each one records the number it was derived from so a reader can
 * disagree with our thresholds without having to trust our conclusion.
 */
export interface RiskMarker {
  id:
    | 'young_package'
    | 'near_zero_downloads'
    | 'single_release'
    | 'no_repository_link'
    | 'self_declared_placeholder';
  /** Human-readable statement of what was measured. */
  detail: string;
}

/**
 * Raw, quotable evidence from the registry. Everything here came off the wire;
 * nothing is inferred. `http_status` is the status of the metadata request for
 * the exact package name, and it is the sole basis for EXISTS-vs-NONEXISTENT.
 */
export interface PackageEvidence {
  /** URL that was requested. A reader can curl this and get the same answer. */
  registry_url: string;
  /** HTTP status of that request, or null if the request never completed. */
  http_status: number | null;
  /** ISO timestamp of the request. */
  checked_at: string;
  /** Earliest publish time across all versions, when the registry exposes it. */
  first_published_at: string | null;
  /** Most recent publish time, when the registry exposes it. */
  last_published_at: string | null;
  /** Number of published versions, when countable. */
  version_count: number | null;
  /** Latest version string as reported by the registry. */
  latest_version: string | null;
  /** Downloads in the trailing week. npm only — PyPI does not serve this. */
  weekly_downloads: number | null;
  /** Registry-declared repository URL, if any. */
  repository_url: string | null;
  /** Registry-declared description, truncated. Quoted, never paraphrased. */
  description: string | null;
  /** Transport/parse error message when the check could not be completed. */
  error: string | null;
}

/** Where a name entered the corpus. Provenance is a first-class field: a name's
 *  origin is a claim, and claims must be attributable. */
export type CorpusSource =
  /** Parsed from an install command in the mymcptools MCP catalog. */
  | 'mcp-catalog-install-command'
  /** Named in published slopsquatting research/incident reporting. */
  | 'published-incident'
  /** Submitted to the public scanner by a visitor. */
  | 'user-submission';

/** One corpus row: a name, an ecosystem, and a verdict that traces to evidence. */
export interface CorpusEntry {
  /** Exact package name as it would be written in an import/manifest. */
  name: string;
  ecosystem: Ecosystem;
  verdict: PackageVerdict;
  /** Measured markers behind a SLOPSQUAT_RISK verdict. Empty otherwise. */
  markers: RiskMarker[];
  evidence: PackageEvidence;
  /** How this name entered the corpus. */
  source: CorpusSource;
  /**
   * Free-text provenance detail — e.g. the catalog slug the name came from, or
   * the citation for a published incident. Never a conclusion, only a pointer.
   */
  source_detail: string | null;
  /** ISO timestamp this name was first recorded. */
  first_seen: string;
  /** ISO timestamp of the most recent completed registry check. */
  last_checked: string;
}

/** The committed corpus file (src/data/firewall-corpus.json). */
export interface CorpusStore {
  generated_at: string;
  /** Counts by verdict, recomputed on write — never hand-maintained. */
  summary: Record<PackageVerdict, number>;
  entries: CorpusEntry[];
}

/** One result row returned by the check/scan APIs. */
export interface CheckResult {
  name: string;
  ecosystem: Ecosystem;
  verdict: PackageVerdict;
  markers: RiskMarker[];
  evidence: PackageEvidence;
  /** True when this verdict was served from the committed corpus, not re-checked. */
  from_corpus: boolean;
}
