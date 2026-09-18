/**
 * The repository a listing points at TODAY, as an `owner/repo` join key.
 *
 * WHY THIS EXISTS (thread #262, 2026-09-17). Two committed sweeps attach a
 * last-commit date to a listing by slug: `static-signals.json` (generated
 * 2026-07-25) and `repo-recency.json` (2026-08-17). Neither records which
 * repository the listing pointed at when it was swept, and neither read path
 * checked. Catalog corrections since then (yfinance-mcp was moved off a
 * non-existent `modelcontextprotocol/servers` subpath on 2026-08-04; dozens of
 * others were re-pointed or had a wrong repo removed) left the sweep rows
 * behind: measured 2026-09-17, **46 listings rendered a "last commit" date
 * taken from a repository the page does not link to** (45 via static-signals,
 * 1 via repo-recency) — e.g. esp32-mcp showing espressif/esp-idf's activity,
 * apollo-io-mcp showing apollographql's.
 *
 * A date that belongs to a different project is worse than no date, so both
 * accessors now drop a record whose repository does not match this key.
 */
import { servers } from "@/data/servers";

/** `owner/repo` (lower-case) for a github.com URL or `owner/repo` string; null otherwise. */
export function repoKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  const m = v.match(/github\.com\/([^/\s]+)\/([^/#?\s]+)/i) ?? v.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!m) return null;
  return `${m[1]}/${m[2].replace(/\.git$/i, "")}`.toLowerCase();
}

const current = new Map<string, string | null>(servers.map((s) => [s.slug, repoKey(s.github_url)]));

/** The listing's current repo key; null when it links no repository; undefined for an unknown slug. */
export function listingRepoKey(slug: string): string | null | undefined {
  return current.has(slug) ? current.get(slug)! : undefined;
}

/**
 * True when a sweep record swept from `recordRepo` may speak for `slug` today.
 * A record with no repository of its own claims nothing and is kept (it can
 * still carry package metadata); a record naming a repo must match the one
 * the listing links, and a listing that links none gets no repo-derived date.
 */
export function sweepMatchesListing(slug: string, recordRepo: string | null | undefined): boolean {
  const theirs = repoKey(recordRepo);
  if (theirs === null) return true;
  const ours = listingRepoKey(slug);
  if (ours === undefined) return true; // slug outside the static catalog (e.g. a paid overlay row)
  return ours === theirs;
}
