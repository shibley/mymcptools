/**
 * Agent Dependency Firewall — corpus sweeper.
 *
 * Builds src/data/firewall-corpus.json by checking package names against the
 * live npm registry and PyPI JSON API. Every row in the output traces to an
 * HTTP response this script actually received; there is no path in this file
 * that writes a verdict without one.
 *
 * SEED PROVENANCE (read this before adding a source):
 *
 *  1. `mcp-catalog-install-command` — package names parsed out of the install
 *     commands of mymcptools catalog entries (already extracted into
 *     src/data/static-signals.json by scripts/static-signals.mts). These are
 *     names a coding agent would actually run `npx`/`pip install` against after
 *     reading an MCP directory, which makes them the exact surface the product
 *     is about. They are NOT claimed to be LLM hallucinations — the origin of
 *     any individual catalog listing is not established, and the corpus records
 *     only that the name was asserted by a listing.
 *
 *  2. `published-incident` — names printed in published slopsquatting research.
 *     Only names quoted in a citable source belong here, one row per citation.
 *
 * DELIBERATELY ABSENT: the 53 still-unregistered names shared across five
 * frontier models (InfoWorld, Apr 2026; 41 PyPI + 12 npm). The source cited in
 * memory/research-2026-07-25b/02-new-ideas.md reports the *count* but does not
 * enumerate the names, and this corpus does not invent names to hit a number.
 * TODO: obtain that list from the underlying arXiv 2605.17062 artefact and load
 * it with source `published-incident`.
 *
 * OUT OF SCOPE this sprint (tracked, not silently dropped):
 *   TODO: GitHub Action wrapper that fails a PR on NONEXISTENT/SLOPSQUAT_RISK.
 *   TODO: installable CLI + npm/pip pre-install hook.
 *   TODO: nightly corpus farming (prompt N models with M coding tasks, diff the
 *         imports against the registries). That is the actual moat; this sprint
 *         builds the store and the verification path it will write into.
 *
 * Resilience: checkpoints to disk every CHECKPOINT_EVERY completed checks and
 * writes atomically (tmp + rename). Re-running merges onto the existing store
 * and skips rows checked within --max-age-hours, so an interrupted run resumes
 * instead of restarting.
 *
 * Run: node scripts/firewall-sweep.mts [--limit N] [--force]
 *      [--max-age-hours H] [--gap-ms MS]
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  checkPackage,
  isValidPackageName,
  normalizeName,
} from '../src/lib/firewall/registry.ts';
import type {
  CorpusEntry,
  CorpusSource,
  CorpusStore,
  Ecosystem,
  PackageVerdict,
} from '../src/lib/firewall/types.ts';
import { PACKAGE_VERDICTS } from '../src/lib/firewall/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'src', 'data');
const SIGNALS = join(DATA, 'static-signals.json');
const OUT = join(DATA, 'firewall-corpus.json');

const args = process.argv.slice(2);
const argVal = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const limit = argVal('--limit') ? Number(argVal('--limit')) : undefined;
const force = args.includes('--force');
const maxAgeHours = Number(argVal('--max-age-hours') ?? 168);
// npm and PyPI publish no hard rate limit for anonymous metadata reads; 120ms
// (~8 req/s) is polite and keeps a full 1,153-name sweep inside ~6 minutes.
const GAP_MS = Number(argVal('--gap-ms') ?? 120);
const CHECKPOINT_EVERY = 50;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Names quoted in published slopsquatting reporting. Each entry must carry a
 * citation. Do not add a name here that you cannot point at in a source.
 */
const INCIDENT_SEEDS: { name: string; ecosystem: Ecosystem; citation: string }[] = [
  {
    name: 'react-codeshift',
    ecosystem: 'npm',
    citation:
      'Xygeni, "Slopsquatting evolution" (Jan 2026): hallucinated npm package propagated to 237 repositories via forked agent instructions, with agents still attempting daily installs. https://xygeni.io/blog/slopsquatting-evolution/',
  },
];

interface StaticSignalRow {
  slug: string;
  package_registry?: string | null;
  package_name?: string | null;
}

/**
 * The catalog's install-command parser leaves version specifiers attached to
 * some names ("@upstash/mcp-server@latest"). Strip a trailing specifier without
 * eating the leading @ of an npm scope, then let isValidPackageName reject
 * whatever is still not a package name. A seed we cannot address to a registry
 * is dropped, not stored as UNKNOWN — UNKNOWN is for names we asked about and
 * got no trustworthy answer, not for strings that were never names.
 */
function stripVersionSpec(raw: string): string {
  let s = raw.trim().replace(/\s*(?:[=<>!~]=?|===).*$/, '');
  const at = s.lastIndexOf('@');
  if (at > 0) s = s.slice(0, at);
  return s.trim();
}

/** Build the deduplicated work list: (ecosystem, name) -> provenance. */
function buildSeeds(): CorpusEntry[] {
  const seeds = new Map<string, CorpusEntry>();
  const now = new Date().toISOString();

  const add = (
    rawName: string,
    ecosystem: Ecosystem,
    source: CorpusSource,
    sourceDetail: string
  ) => {
    const name = normalizeName(stripVersionSpec(rawName), ecosystem);
    if (!isValidPackageName(name, ecosystem)) return;
    const key = `${ecosystem}:${name}`;
    if (seeds.has(key)) return;
    seeds.set(key, {
      name,
      ecosystem,
      verdict: 'UNKNOWN',
      markers: [],
      evidence: {
        registry_url: '',
        http_status: null,
        checked_at: now,
        first_published_at: null,
        last_published_at: null,
        version_count: null,
        latest_version: null,
        weekly_downloads: null,
        repository_url: null,
        description: null,
        error: 'not yet checked',
      },
      source,
      source_detail: sourceDetail,
      first_seen: now,
      last_checked: now,
    });
  };

  for (const seed of INCIDENT_SEEDS) {
    add(seed.name, seed.ecosystem, 'published-incident', seed.citation);
  }

  const signals = JSON.parse(readFileSync(SIGNALS, 'utf8')) as {
    signals: StaticSignalRow[];
  };
  for (const row of signals.signals) {
    if (!row.package_name) continue;
    // static-signals labels the Python registry "pip"; the corpus calls the
    // registry by its own name.
    const ecosystem: Ecosystem | null =
      row.package_registry === 'npm' ? 'npm' : row.package_registry === 'pip' ? 'pypi' : null;
    if (!ecosystem) continue;
    add(row.package_name, ecosystem, 'mcp-catalog-install-command', `catalog:${row.slug}`);
  }

  return [...seeds.values()];
}

function summarize(entries: CorpusEntry[]): Record<PackageVerdict, number> {
  const summary = Object.fromEntries(PACKAGE_VERDICTS.map((v) => [v, 0])) as Record<
    PackageVerdict,
    number
  >;
  for (const e of entries) summary[e.verdict] += 1;
  return summary;
}

/** Atomic write: serialize to a tmp file, then rename over the target. */
function writeStore(entries: CorpusEntry[]): Record<PackageVerdict, number> {
  // Drop rows that are not addressable package names at all (older sweeps stored
  // a few install-command fragments). Keeps the corpus a corpus of names.
  const sorted = entries
    .filter((e) => isValidPackageName(e.name, e.ecosystem))
    .sort((a, b) =>
    a.ecosystem === b.ecosystem
      ? a.name.localeCompare(b.name)
      : a.ecosystem.localeCompare(b.ecosystem)
  );
  const summary = summarize(sorted);
  const store: CorpusStore = {
    generated_at: new Date().toISOString(),
    summary,
    entries: sorted,
  };
  const tmp = `${OUT}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`);
  renameSync(tmp, OUT);
  return summary;
}

async function main() {
  const prior = existsSync(OUT)
    ? (JSON.parse(readFileSync(OUT, 'utf8')) as CorpusStore)
    : { generated_at: '', summary: summarize([]), entries: [] };
  const priorByKey = new Map(prior.entries.map((e) => [`${e.ecosystem}:${e.name}`, e]));

  const seeds = buildSeeds();
  console.log(`[firewall] seeds=${seeds.length} prior=${prior.entries.length}`);

  const freshCutoff = Date.now() - maxAgeHours * 3600_000;
  const results: CorpusEntry[] = [];
  let checked = 0;
  let skipped = 0;

  const work = limit ? seeds.slice(0, limit) : seeds;

  for (const seed of work) {
    const key = `${seed.ecosystem}:${seed.name}`;
    const prev = priorByKey.get(key);

    // Idempotent resume: a row checked recently, with a real response behind it,
    // is left alone. "not yet checked" rows always re-run.
    if (
      !force &&
      prev &&
      prev.evidence.http_status !== null &&
      Date.parse(prev.last_checked) > freshCutoff
    ) {
      results.push(prev);
      priorByKey.delete(key);
      skipped++;
      continue;
    }

    const live = await checkPackage(seed.name, seed.ecosystem);
    checked++;

    results.push({
      name: live.name,
      ecosystem: live.ecosystem,
      verdict: live.verdict,
      markers: live.markers,
      evidence: live.evidence,
      // Provenance is sticky: the first source that introduced a name owns it.
      source: prev?.source ?? seed.source,
      source_detail: prev?.source_detail ?? seed.source_detail,
      first_seen: prev?.first_seen ?? seed.first_seen,
      last_checked: live.evidence.checked_at,
    });
    priorByKey.delete(key);

    if (checked % CHECKPOINT_EVERY === 0) {
      // Carry forward everything not yet visited so a checkpoint is never a
      // truncation of the store.
      writeStore([...results, ...priorByKey.values()]);
      console.log(`[firewall] checkpoint · checked=${checked}/${work.length}`);
    }

    await sleep(GAP_MS);
  }

  // Any prior row whose seed was not in this run (e.g. --limit) is preserved.
  const summary = writeStore([...results, ...priorByKey.values()]);

  console.log(
    `[firewall] checked=${checked} skipped(fresh)=${skipped} · ` +
      PACKAGE_VERDICTS.map((v) => `${v}=${summary[v]}`).join(' ')
  );
  console.log(`[firewall] wrote ${OUT}`);
}

main().catch((e) => {
  console.error('[firewall] fatal:', e);
  process.exit(1);
});
