// Shared scan engine behind both firewall endpoints:
//   POST /api/v1/firewall/check  (authenticated Trust Data API)
//   POST /api/firewall/scan      (public, powers the /firewall page)
//
// Resolution order for one name:
//   1. committed corpus, if the row is younger than CORPUS_MAX_AGE_MS
//   2. in-process cache of live checks
//   3. a live registry request
//
// Step 1 is what makes the corpus an asset rather than a cache: a name already
// swept answers instantly and without touching npm/PyPI. Step 3 is what keeps
// it honest — a name we have never seen gets a real answer, not a shrug.

import { checkPackage, normalizeName } from '@/lib/firewall/registry';
import { MAX_PACKAGES_PER_REQUEST, parsePackageInput } from '@/lib/firewall/parse';
import { getCorpusEntry } from '@/lib/firewall/corpus-store';
import type { CheckResult, Ecosystem } from '@/lib/firewall/types';

/** Corpus rows older than this are re-checked live. A NONEXISTENT name can be
 *  registered by an attacker at any time, so a stale "safe to ignore" is the
 *  one error this product cannot afford. */
export const CORPUS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Re-exported so callers have one import site for the scan surface.
export { MAX_PACKAGES_PER_REQUEST, parsePackageInput };

const LIVE_CACHE_TTL_MS = 60 * 60 * 1000;
const liveCache = new Map<string, { at: number; result: CheckResult }>();

/** Bound the in-process cache so a long-lived instance cannot grow unbounded. */
const LIVE_CACHE_MAX = 5_000;

function cacheGet(key: string): CheckResult | null {
  const hit = liveCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > LIVE_CACHE_TTL_MS) {
    liveCache.delete(key);
    return null;
  }
  return hit.result;
}

function cacheSet(key: string, result: CheckResult) {
  if (liveCache.size >= LIVE_CACHE_MAX) {
    // Cheapest sufficient eviction: drop the oldest insertion.
    const oldest = liveCache.keys().next().value;
    if (oldest) liveCache.delete(oldest);
  }
  liveCache.set(key, { at: Date.now(), result });
}

/** Resolve one name through corpus -> cache -> live registry. */
async function resolveOne(rawName: string, ecosystem: Ecosystem): Promise<CheckResult> {
  const name = normalizeName(rawName, ecosystem);
  const key = `${ecosystem}:${name}`;

  const corpus = getCorpusEntry(name, ecosystem);
  if (
    corpus &&
    corpus.evidence.http_status !== null &&
    Date.now() - Date.parse(corpus.last_checked) < CORPUS_MAX_AGE_MS
  ) {
    return {
      name: corpus.name,
      ecosystem: corpus.ecosystem,
      verdict: corpus.verdict,
      markers: corpus.markers,
      evidence: corpus.evidence,
      from_corpus: true,
    };
  }

  const cached = cacheGet(key);
  if (cached) return cached;

  const live = await checkPackage(name, ecosystem);
  const result: CheckResult = { ...live, from_corpus: false };
  // Never cache a failed lookup — UNKNOWN must stay retryable.
  if (result.verdict !== 'UNKNOWN') cacheSet(key, result);
  return result;
}

export interface ScanSummary {
  total: number;
  exists: number;
  nonexistent: number;
  slopsquat_risk: number;
  unknown: number;
  /** True when at least one name did not resolve to an established package. */
  blocked: boolean;
}

export interface ScanResponse {
  ecosystem: Ecosystem;
  summary: ScanSummary;
  results: CheckResult[];
}

/**
 * Scan a list of names. Runs with bounded concurrency: a 100-name package.json
 * would otherwise open 100+ sockets to npm at once, which is how a well-meaning
 * scanner gets its IP blocked.
 */
export async function scanPackages(
  names: string[],
  ecosystem: Ecosystem,
  concurrency = 8
): Promise<ScanResponse> {
  const results: CheckResult[] = new Array(names.length);
  let cursor = 0;

  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= names.length) return;
      results[i] = await resolveOne(names[i], ecosystem);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, names.length) }, worker)
  );

  const summary: ScanSummary = {
    total: results.length,
    exists: results.filter((r) => r.verdict === 'EXISTS').length,
    nonexistent: results.filter((r) => r.verdict === 'NONEXISTENT').length,
    slopsquat_risk: results.filter((r) => r.verdict === 'SLOPSQUAT_RISK').length,
    unknown: results.filter((r) => r.verdict === 'UNKNOWN').length,
    blocked: false,
  };
  summary.blocked = summary.nonexistent > 0 || summary.slopsquat_risk > 0;

  return { ecosystem, summary, results };
}
