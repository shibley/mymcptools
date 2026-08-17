/**
 * Read-side accessor for repo recency: WHEN was this server last touched.
 *
 * WHY THIS EXISTS SEPARATELY FROM static-signals-store
 *   `static-signals-store` answers the same question but is consumed in exactly
 *   one place — the sidebar `LocalSignalBadge`, and only for local/stdio
 *   servers. That leaves the reader of a dormant *remote* entry with no signal
 *   at all, and even for a local one the signal is a small orange pill in the
 *   right rail while the first paragraph of the page still says the server is
 *   "community-built" and the install block still hands over a copy-paste
 *   command. The sweep that produced `repo-recency.json` (2026-08-16) found 25
 *   entries dormant 12+ months whose package is still published and installs
 *   cleanly — the same failure shape as the archived bucket, one tier down:
 *   nothing looks broken, so the reader finds out after building on it.
 *
 *   So this module exists to put the date in the MAIN column, for any server we
 *   know it for, local or remote. It merges two committed datasets:
 *     repo-recency.json    — GitHub pushed_at + npm/PyPI publish date, for
 *                            every entry with a resolvable install command
 *     static-signals.json  — last_commit_at, which covers a different (larger,
 *                            older) slice including entries with no install
 *                            command at all
 *   repo-recency wins where both exist; it is the fresher of the two sweeps and
 *   carries the registry half that static-signals does not.
 */

import rawRecency from "@/data/repo-recency.json";
import { getStaticSignal } from "@/lib/trust/static-signals-store";

type RecencyRecord = {
  repo: string;
  archived: boolean;
  pushedAt: string | null;
  registry: "npm" | "pip";
  package: string;
  version: string;
  publishedAt: string | null;
};

type RecencyFile = { generatedAt: string; entries: Record<string, RecencyRecord> };

const store = rawRecency as RecencyFile;

/**
 * Same threshold the sweep uses for `medium`. Twelve months is deliberately
 * generous: plenty of finished servers get no commits for a year and are
 * perfectly good, which is why this reports a DATE and lets the reader judge,
 * rather than asserting the project is dead.
 */
export const DORMANT_MONTHS = 12;
const MONTH_MS = 1000 * 60 * 60 * 24 * 30.44;

export type RepoRecency = {
  /** ISO date of the most recent commit we could confirm. */
  lastCommitAt: string;
  /** Whole months since that commit, at build time. */
  monthsSinceCommit: number;
  /** True once past DORMANT_MONTHS. Archived is a separate, louder state. */
  dormant: boolean;
  /** Latest published package version, when the entry has one. */
  version?: string;
  packageName?: string;
  registry?: "npm" | "pip";
  /** ISO publish date of `version`. */
  publishedAt?: string;
};

function monthsSince(iso: string): number {
  return Math.floor((Date.now() - Date.parse(iso)) / MONTH_MS);
}

function isUsableDate(value: string | null | undefined): value is string {
  return Boolean(value) && !Number.isNaN(Date.parse(value as string));
}

/**
 * Recency for one server, or undefined when neither dataset knows a commit
 * date. Undefined is the honest answer and callers must render nothing for it —
 * an absent date must never degrade into an implied "recent".
 */
export function getRepoRecency(slug: string): RepoRecency | undefined {
  const record = store.entries[slug];
  if (record && isUsableDate(record.pushedAt)) {
    return {
      lastCommitAt: record.pushedAt,
      monthsSinceCommit: monthsSince(record.pushedAt),
      dormant: monthsSince(record.pushedAt) >= DORMANT_MONTHS,
      version: record.version,
      packageName: record.package,
      registry: record.registry,
      publishedAt: isUsableDate(record.publishedAt) ? record.publishedAt : undefined,
    };
  }

  const signal = getStaticSignal(slug);
  if (signal && isUsableDate(signal.last_commit_at)) {
    return {
      lastCommitAt: signal.last_commit_at,
      monthsSinceCommit: monthsSince(signal.last_commit_at),
      dormant: monthsSince(signal.last_commit_at) >= DORMANT_MONTHS,
    };
  }

  return undefined;
}

/** "August 2026" — a month is as precise as a last-commit date deserves. */
export function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "14 months ago" / "1 month ago" / "this month". */
export function formatMonthsAgo(months: number): string {
  if (months <= 0) return "this month";
  if (months === 1) return "1 month ago";
  return `${months} months ago`;
}

/** When the committed recency dataset was generated. */
export function repoRecencyGeneratedAt(): string {
  return store.generatedAt;
}
