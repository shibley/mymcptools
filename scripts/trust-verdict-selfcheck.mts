/**
 * Selfcheck for the trust verdict model (src/lib/trust/verdict.ts).
 *
 * Pure assertions against the scorer plus a live pass over the real catalog.
 * The most important cases here are the MONOREPO ones: seven official
 * modelcontextprotocol/servers reference implementations live at
 * /tree/main/src/<name>, and the catalog-repair pass proved that a naive
 * repo-name-vs-listing-name heuristic marks them as mismatches
 * (scripts/.verify-state.json has sequential-thinking as status "mismatch",
 * overlap 0.00). If this file ever fails, the registry is about to defame its
 * most trustworthy entries.
 *
 * Run: node scripts/trust-verdict-selfcheck.mts
 */
import {
  computeTrustVerdict,
  parseRepoRef,
  repoNameMatches,
  isReferenceMonorepo,
  type TrustInputs,
} from '../src/lib/trust/verdict.ts';
import { servers } from '../src/data/servers.ts';

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${name}${extra !== undefined ? ` — ${JSON.stringify(extra)}` : ''}`);
  }
}

function baseInputs(over: Partial<TrustInputs> = {}): TrustInputs {
  return {
    slug: 'x',
    name: 'X',
    sourceVerified: true,
    verification: 'live',
    githubUrl: 'https://github.com/acme/x',
    official: false,
    probeCount: 0,
    driftCount: 0,
    ...over,
  };
}

console.log('\n# parseRepoRef');
{
  const plain = parseRepoRef('https://github.com/acme/widget');
  check('plain repo parses', plain?.owner === 'acme' && plain?.repo === 'widget');
  check('plain repo has no subpath', plain?.isMonorepoSubpath === false);
  check('plain effectiveName is the repo', plain?.effectiveName === 'widget');

  const mono = parseRepoRef('https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking');
  check('monorepo owner/repo', mono?.owner === 'modelcontextprotocol' && mono?.repo === 'servers');
  check('monorepo subpath read', mono?.subpath === 'src/sequentialthinking');
  check('monorepo effectiveName is the SUBPATH leaf', mono?.effectiveName === 'sequentialthinking', mono?.effectiveName);
  check('monorepo flagged', mono?.isMonorepoSubpath === true);
  check('reference monorepo recognised', isReferenceMonorepo(mono));

  // A subpath that does NOT exist upstream must not inherit official status
  // just because the repository does. src/yfinance 404s (checked 2026-07-25).
  const fake = parseRepoRef('https://github.com/modelcontextprotocol/servers/tree/main/src/yfinance');
  check('unknown subpath in the official repo is NOT a reference impl', !isReferenceMonorepo(fake));
  check('archived reference subpath IS recognised', isReferenceMonorepo(parseRepoRef('https://github.com/modelcontextprotocol/servers-archived/tree/main/src/gdrive')));

  check('null url -> null ref', parseRepoRef(null) === null);
  check('non-github url -> null ref', parseRepoRef('https://gitlab.com/a/b') === null);
  check('garbage url -> null ref', parseRepoRef('not a url') === null);
  check('.git suffix stripped', parseRepoRef('https://github.com/acme/widget.git')?.repo === 'widget');
}

console.log('\n# repoNameMatches — the monorepo trap');
{
  const mono = parseRepoRef('https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking')!;
  check('"Sequential Thinking" matches subpath sequentialthinking', repoNameMatches('Sequential Thinking', mono));

  const filesystem = parseRepoRef('https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem')!;
  check('"Filesystem" matches subpath filesystem', repoNameMatches('Filesystem', filesystem));

  // The failure mode we are guarding against: matching against `repo` instead
  // of `effectiveName` would compare "Sequential Thinking" against "servers".
  check(
    'repo name "servers" alone would NOT have matched (the bug we avoid)',
    !repoNameMatches('Sequential Thinking', { ...mono, effectiveName: 'servers', isMonorepoSubpath: false })
  );
}

console.log('\n# unverified source is never scored');
{
  const v = computeTrustVerdict(
    baseInputs({ sourceVerified: false, verification: 'unresolved', githubUrl: null })
  );
  check('tier UNVERIFIABLE', v.tier === 'UNVERIFIABLE');
  check('score is null, not 0', v.score === null);
  check('confidence none', v.confidence === 'none');
  check('carries an explanation', v.signals.length > 0 && v.signals[0].detail.length > 20);
}

console.log('\n# unknown is not zero');
{
  const v = computeTrustVerdict(baseInputs());
  check('no evidence -> UNMEASURED', v.tier === 'UNMEASURED');
  check('no evidence -> null score', v.score === null);
  check('every signal still rendered', v.signals.length === 7, v.signals.length);
  check(
    'unmeasurable signals report unknown',
    v.signals.filter((s) => s.score === null).every((s) => s.polarity === 'unknown' && s.weight === 0)
  );
}

console.log('\n# a healthy live server grades well');
{
  const v = computeTrustVerdict(
    baseInputs({
      status: {
        slug: 'x',
        verdict: 'GOOD',
        tool_count: 12,
        latency_ms: 210,
        negotiated_protocol_version: '2025-06-18',
        last_seen_good_at: '2026-07-25T00:00:00.000Z',
        checked_at: '2026-07-25T00:00:00.000Z',
      },
      uptime: { up: 30, total: 30 },
      probeCount: 30,
      driftCount: 0,
      official: true,
    })
  );
  check('tier A', v.tier === 'A', { tier: v.tier, score: v.score });
  check('high confidence', v.confidence === 'high', v.confidence);
  check('liveMeasured', v.liveMeasured);
  check('3 measured evidence signals', v.evidenceCount === 3, v.evidenceCount);
}

console.log('\n# a dead server grades badly');
{
  const v = computeTrustVerdict(
    baseInputs({
      status: {
        slug: 'x',
        verdict: 'DOWN',
        tool_count: null,
        latency_ms: null,
        negotiated_protocol_version: null,
        last_seen_good_at: null,
        checked_at: '2026-07-25T00:00:00.000Z',
      },
      uptime: { up: 2, total: 30 },
      probeCount: 30,
      driftCount: 3,
    })
  );
  check('tier E', v.tier === 'E', { tier: v.tier, score: v.score });
  check('has negative signals', v.signals.some((s) => s.polarity === 'negative'));
}

console.log('\n# archived repos are penalised, not hidden');
{
  const v = computeTrustVerdict(baseInputs({ verification: 'archived' }));
  check('archived produces a score', v.score !== null, v.score);
  check('archived is measured via maintenance', v.evidenceCount >= 1);
  check(
    'archived maintenance signal is negative',
    v.signals.find((s) => s.id === 'maintenance')?.polarity === 'negative'
  );
  check('archived grades D or E', v.tier === 'D' || v.tier === 'E', { tier: v.tier, score: v.score });
}

console.log('\n# uptime below the minimum sample is unknown, not bad');
{
  const v = computeTrustVerdict(baseInputs({ uptime: { up: 1, total: 2 }, probeCount: 2 }));
  const uptime = v.signals.find((s) => s.id === 'uptime')!;
  check('too few probes -> unknown uptime', uptime.score === null && uptime.polarity === 'unknown');
}

console.log('\n# live catalog pass');
{
  // The probe stores are Next-only (path aliases + JSON imports), so this pass
  // scores straight off the catalog. It is exactly the input shape a
  // never-probed server gets in production, which is the case the monorepo rule
  // has to survive.
  const catalogVerdicts = servers.map((s) =>
    computeTrustVerdict(
      baseInputs({
        slug: s.slug,
        name: s.name,
        sourceVerified: s.source_verified === true,
        verification: s.verification,
        githubUrl: s.github_url,
        official: s.official === true,
      })
    )
  );

  const unverifiable = catalogVerdicts.filter((v) => v.tier === 'UNVERIFIABLE').length;
  console.log(`  catalog: ${servers.length} entries, ${unverifiable} unverifiable, ${servers.length - unverifiable} verifiable`);

  check(
    'unverifiable count matches catalog',
    unverifiable === servers.filter((s) => s.source_verified !== true || !s.github_url).length,
    unverifiable
  );
  check('no unverifiable entry carries a score', catalogVerdicts.every((v) => v.tier !== 'UNVERIFIABLE' || v.score === null));

  // ⚠️ The load-bearing assertion. Every official reference server must come
  // out with a positive listing↔repository signal.
  const REFERENCE = ['everything', 'fetch', 'filesystem', 'git', 'memory', 'sequential-thinking', 'time'];
  const referenceSlugs = servers
    .filter((s) => (s.github_url ?? '').startsWith('https://github.com/modelcontextprotocol/servers/tree/'))
    .filter((s) => REFERENCE.includes(s.slug))
    .map((s) => s.slug);
  check('found all 7 reference monorepo servers', referenceSlugs.length === 7, referenceSlugs);

  // The known bad claim: right repo, non-existent subpath. It must be graded
  // as an ordinary community server, not as an official reference impl.
  const yf = catalogVerdicts.find((v) => v.slug === 'yfinance-mcp');
  if (yf) {
    check('yfinance-mcp gets no official-reference provenance', yf.signals.find((s) => s.id === 'provenance')?.score !== 100);
    check('yfinance-mcp repo_link is flagged for review, not trusted', yf.signals.find((s) => s.id === 'repo_link')?.polarity === 'neutral');
  }

  for (const slug of referenceSlugs) {
    const v = catalogVerdicts.find((x) => x.slug === slug)!;
    const link = v.signals.find((s) => s.id === 'repo_link');
    check(`${slug}: repo_link is positive (not flagged)`, link?.polarity === 'positive', link?.detail);
    const prov = v.signals.find((s) => s.id === 'provenance');
    check(`${slug}: provenance is the reference implementation`, prov?.score === 100, prov?.score);
  }

  // The archived reference servers live in a sibling monorepo and must be
  // graded down for being archived — never for the subpath.
  const archivedRefs = servers.filter(
    (s) => (s.github_url ?? '').includes('/servers-archived/tree/') && s.verification === 'archived'
  );
  check('found archived reference servers', archivedRefs.length > 0, archivedRefs.length);
  for (const s of archivedRefs) {
    const v = catalogVerdicts.find((x) => x.slug === s.slug)!;
    check(`${s.slug}: archived, but repo_link still positive`, v.signals.find((x) => x.id === 'repo_link')?.polarity === 'positive');
    check(`${s.slug}: graded down for being archived`, v.tier === 'D' || v.tier === 'E', v.tier);
  }
}

console.log(failures === 0 ? '\nALL CHECKS PASSED\n' : `\n${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
