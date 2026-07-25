/**
 * Selfcheck for the Agent Dependency Firewall.
 *
 * This repo has already shipped ~1,944 fabricated GitHub URLs once and spent
 * hours repairing them. A product whose entire claim is "we detect fabricated
 * dependencies" cannot survive shipping a fabricated corpus, so the honesty
 * rules are asserted here in code rather than left to reviewer discipline.
 *
 * Two halves:
 *   1. Pure assertions on the verdict rules (thresholds, marker logic, the
 *      never-guess paths).
 *   2. A pass over the real committed corpus asserting that every row traces to
 *      a real registry response.
 *
 * Run: node scripts/firewall-selfcheck.mts
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  deriveMarkers,
  deriveVerdict,
  isValidPackageName,
  normalizeName,
  ESTABLISHED_VERSION_COUNT,
  NEAR_ZERO_DOWNLOADS,
  YOUNG_PACKAGE_DAYS,
} from '../src/lib/firewall/registry.ts';
import { parsePackageInput } from '../src/lib/firewall/parse.ts';
import { PACKAGE_VERDICTS } from '../src/lib/firewall/types.ts';
import type { CorpusStore, PackageEvidence } from '../src/lib/firewall/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(__dirname, '..', 'src', 'data', 'firewall-corpus.json');

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.error(
      `  FAIL ${name}${extra !== undefined ? ` — ${JSON.stringify(extra)}` : ''}`
    );
  }
}

function ev(over: Partial<PackageEvidence> = {}): PackageEvidence {
  return {
    registry_url: 'https://registry.npmjs.org/x',
    http_status: 200,
    checked_at: new Date().toISOString(),
    first_published_at: '2020-01-01T00:00:00.000Z',
    last_published_at: '2026-01-01T00:00:00.000Z',
    version_count: 40,
    latest_version: '1.0.0',
    weekly_downloads: 100_000,
    repository_url: 'https://github.com/acme/x',
    description: 'A real package',
    error: null,
    ...over,
  };
}

// ---------------------------------------------------------------------------
console.log('\n# verdict rules — the never-guess paths');
{
  const notFound = ev({ http_status: 404 });
  check('404 is NONEXISTENT', deriveVerdict(notFound, deriveMarkers(notFound)) === 'NONEXISTENT');

  const timedOut = ev({ http_status: null, error: 'aborted' });
  check(
    'no completed response is UNKNOWN, never EXISTS',
    deriveVerdict(timedOut, deriveMarkers(timedOut)) === 'UNKNOWN'
  );

  const serverError = ev({ http_status: 503, error: 'HTTP 503' });
  check(
    'a 5xx is UNKNOWN, never NONEXISTENT',
    deriveVerdict(serverError, deriveMarkers(serverError)) === 'UNKNOWN',
    deriveVerdict(serverError, deriveMarkers(serverError))
  );

  check('no markers are derived from a non-200', deriveMarkers(notFound).length === 0);
  check('no markers are derived from a failed request', deriveMarkers(timedOut).length === 0);
}

console.log('\n# markers only fire on values that were measured');
{
  const noDownloadData = ev({ weekly_downloads: null });
  check(
    'a null download count does not become a near-zero marker',
    !deriveMarkers(noDownloadData).some((m) => m.id === 'near_zero_downloads')
  );

  const noDateData = ev({ first_published_at: null });
  check(
    'a null publish date does not become a young-package marker',
    !deriveMarkers(noDateData).some((m) => m.id === 'young_package')
  );

  const noVersionData = ev({ version_count: null });
  check(
    'a null version count does not become a single-release marker',
    !deriveMarkers(noVersionData).some((m) => m.id === 'single_release')
  );

  const zeroDl = ev({ weekly_downloads: NEAR_ZERO_DOWNLOADS });
  check(
    'the download threshold is inclusive at the boundary',
    deriveMarkers(zeroDl).some((m) => m.id === 'near_zero_downloads')
  );
}

console.log('\n# SLOPSQUAT_RISK requires two independent markers');
{
  // A healthy but brand-new package: one marker only. Must not be flagged —
  // this is the false-positive case that makes scanners get switched off.
  const youngButHealthy = ev({
    first_published_at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    version_count: 12,
    weekly_downloads: 9_000,
    repository_url: 'https://github.com/acme/new',
  });
  const m1 = deriveMarkers(youngButHealthy);
  check('a young, popular, well-released package has exactly one marker', m1.length === 1, m1);
  check(
    'one marker alone does not produce SLOPSQUAT_RISK',
    deriveVerdict(youngButHealthy, m1) === 'EXISTS'
  );

  // Two independent markers: flagged.
  const youngAndDead = ev({
    first_published_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    version_count: 1,
    weekly_downloads: 2,
    repository_url: null,
  });
  const m2 = deriveMarkers(youngAndDead);
  check('a young, unused, single-release package has multiple markers', m2.length >= 2, m2.length);
  check(
    'two or more markers produce SLOPSQUAT_RISK',
    deriveVerdict(youngAndDead, m2) === 'SLOPSQUAT_RISK'
  );

  // A self-declared defensive placeholder is flagged on its own say-so alone.
  const placeholder = ev({
    description: '🚫 Placeholder to prevent dependency confusion.',
    version_count: 40,
    weekly_downloads: 100_000,
  });
  const m3 = deriveMarkers(placeholder);
  check(
    'a self-declared placeholder is detected',
    m3.some((m) => m.id === 'self_declared_placeholder')
  );
  check(
    'a self-declared placeholder is SLOPSQUAT_RISK even when otherwise established',
    deriveVerdict(placeholder, m3) === 'SLOPSQUAT_RISK'
  );

  // An established package with no repo link is still EXISTS.
  const establishedNoRepo = ev({ repository_url: null, version_count: ESTABLISHED_VERSION_COUNT });
  check(
    'an established package missing only a repo link stays EXISTS',
    deriveVerdict(establishedNoRepo, deriveMarkers(establishedNoRepo)) === 'EXISTS'
  );
}

console.log('\n# name handling');
{
  check('npm scoped names are valid', isValidPackageName('@scope/pkg', 'npm'));
  check('npm rejects uppercase', !isValidPackageName('React', 'npm'));
  check('npm rejects a version suffix', !isValidPackageName('@scope/pkg@latest', 'npm'));
  check('pypi normalises separators and case', normalizeName('Foo_Bar.Baz', 'pypi') === 'foo-bar-baz');
  check('npm names are not lowercased by normalise', normalizeName('@Scope/Pkg', 'npm') === '@Scope/Pkg');
  check('an empty name is invalid', !isValidPackageName('', 'npm'));
}

console.log('\n# input parsing invents nothing');
{
  const pkgJson = parsePackageInput(
    '{"dependencies":{"express":"^4.0.0","@scope/x":"1.0.0"},"devDependencies":{"jest":"^29"}}',
    'npm'
  );
  check('package.json deps are read', pkgJson.includes('express') && pkgJson.includes('jest'));
  check('scoped deps survive parsing', pkgJson.includes('@scope/x'), pkgJson);
  check('package.json yields no extra names', pkgJson.length === 3, pkgJson);

  const reqs = parsePackageInput(
    '# a comment\nrequests==2.31.0\nlangchain>=0.1.0\n-e .\nhttps://example.com/x.whl\nfoo[extra]',
    'pypi'
  );
  check('requirements versions are stripped', reqs.includes('requests') && reqs.includes('langchain'));
  check('pip extras are stripped', reqs.includes('foo'), reqs);
  check('comments, -e and URLs are dropped', reqs.length === 3, reqs);

  check('empty input yields nothing', parsePackageInput('   ', 'npm').length === 0);
  check(
    'duplicate names are collapsed',
    parsePackageInput('express\nexpress\nexpress', 'npm').length === 1
  );
}

// ---------------------------------------------------------------------------
console.log('\n# the committed corpus');
{
  const store = JSON.parse(readFileSync(CORPUS, 'utf8')) as CorpusStore;
  const entries = store.entries;

  check('corpus is non-empty', entries.length > 0, entries.length);

  // THE central rule: no verdict without a real HTTP response behind it.
  const noResponse = entries.filter(
    (e) => e.evidence.http_status === null && e.verdict !== 'UNKNOWN'
  );
  check(
    'every non-UNKNOWN row has a real HTTP status behind it',
    noResponse.length === 0,
    noResponse.slice(0, 5).map((e) => e.name)
  );

  const badNonexistent = entries.filter(
    (e) => e.verdict === 'NONEXISTENT' && e.evidence.http_status !== 404
  );
  check(
    'every NONEXISTENT row is backed by a 404',
    badNonexistent.length === 0,
    badNonexistent.slice(0, 5).map((e) => e.name)
  );

  const badExists = entries.filter(
    (e) =>
      (e.verdict === 'EXISTS' || e.verdict === 'SLOPSQUAT_RISK') &&
      e.evidence.http_status !== 200
  );
  check(
    'every EXISTS / SLOPSQUAT_RISK row is backed by a 200',
    badExists.length === 0,
    badExists.slice(0, 5).map((e) => e.name)
  );

  const noUrl = entries.filter((e) => !e.evidence.registry_url);
  check(
    'every row records the registry URL a reader can re-check',
    noUrl.length === 0,
    noUrl.slice(0, 5).map((e) => e.name)
  );

  const unflaggedMarkers = entries.filter(
    (e) => e.verdict !== 'SLOPSQUAT_RISK' && e.markers.length > 0 && e.evidence.http_status !== 200
  );
  check('markers never appear on a row with no 200', unflaggedMarkers.length === 0);

  const riskWithoutCause = entries.filter(
    (e) =>
      e.verdict === 'SLOPSQUAT_RISK' &&
      e.markers.length < 2 &&
      !e.markers.some((m) => m.id === 'self_declared_placeholder')
  );
  check(
    'every SLOPSQUAT_RISK row has two markers or a self-declared placeholder',
    riskWithoutCause.length === 0,
    riskWithoutCause.slice(0, 5).map((e) => e.name)
  );

  const noProvenance = entries.filter((e) => !e.source);
  check('every row records where the name came from', noProvenance.length === 0);

  const incidents = entries.filter((e) => e.source === 'published-incident');
  const uncited = incidents.filter(
    (e) => !e.source_detail || e.source_detail.length < 30 || !/https?:\/\//.test(e.source_detail)
  );
  check(
    'every published-incident row carries a citation with a URL',
    uncited.length === 0,
    uncited.map((e) => e.name)
  );

  const invalidNames = entries.filter((e) => !isValidPackageName(e.name, e.ecosystem));
  check(
    'every row is an addressable package name',
    invalidNames.length === 0,
    invalidNames.slice(0, 5).map((e) => e.name)
  );

  const dupes = new Set<string>();
  const seen = new Set<string>();
  for (const e of entries) {
    const key = `${e.ecosystem}:${e.name}`;
    if (seen.has(key)) dupes.add(key);
    seen.add(key);
  }
  check('no duplicate (ecosystem, name) rows', dupes.size === 0, [...dupes].slice(0, 5));

  // The summary must be recomputed, never hand-maintained.
  const recomputed = Object.fromEntries(PACKAGE_VERDICTS.map((v) => [v, 0])) as Record<
    string,
    number
  >;
  for (const e of entries) recomputed[e.verdict] += 1;
  check(
    'the stored summary matches a recount of the rows',
    PACKAGE_VERDICTS.every((v) => store.summary[v] === recomputed[v]),
    { stored: store.summary, recomputed }
  );

  const badTimestamps = entries.filter(
    (e) => Number.isNaN(Date.parse(e.first_seen)) || Number.isNaN(Date.parse(e.last_checked))
  );
  check('every row has parseable timestamps', badTimestamps.length === 0);

  const future = entries.filter((e) => Date.parse(e.last_checked) > Date.now() + 60_000);
  check('no row claims to have been checked in the future', future.length === 0);

  console.log(
    `\n  corpus: ${entries.length} rows · ` +
      PACKAGE_VERDICTS.map((v) => `${v}=${store.summary[v]}`).join(' ')
  );
  console.log(
    `  thresholds: young<${YOUNG_PACKAGE_DAYS}d · downloads<=${NEAR_ZERO_DOWNLOADS} · established>=${ESTABLISHED_VERSION_COUNT} versions`
  );
}

console.log(
  failures === 0
    ? '\nfirewall selfcheck: all assertions passed\n'
    : `\nfirewall selfcheck: ${failures} FAILURE(S)\n`
);
process.exit(failures === 0 ? 0 : 1);
