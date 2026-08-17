/**
 * STALE-RELEASE detector: entries that install cleanly and are no longer alive.
 *
 * WHY THIS EXISTS
 *   Every other sweep in this directory asks "does the install command resolve,
 *   and does it resolve to the repo the page links?" — a link-integrity question.
 *   Five consecutive fires of the keyword slot hit a failure that all of those
 *   pass clean, most recently google-drive (2026-08-16):
 *
 *     github_url  modelcontextprotocol/servers-archived  -> 200, correct repo
 *     install     npx @modelcontextprotocol/server-gdrive -> published, resolves
 *     BUT         repo archived 2025-05-28, last release 2025.1.14
 *
 *   Nothing is broken. A reader pastes the command, it installs, and they are
 *   running software the author abandoned over a year ago. That is the worst
 *   shape of catalog error we have, because it survives every existing check
 *   and it costs the reader real time before they find out.
 *
 *   So this sweep asks the question the others do not: WHEN was this last
 *   shipped, and is anyone still there? It joins three dates that live in
 *   three different places and are never compared:
 *     npm/PyPI  -> latest version + the date that version was published
 *     GitHub    -> `archived`, and `pushed_at`
 *
 * SEVERITIES
 *   critical — repo is ARCHIVED and the package is still published. Installs
 *              cleanly, will never be fixed. The google-drive shape.
 *   high     — no release in >= 24 months AND no push in >= 24 months. Dead in
 *              both places; nobody has said so.
 *   medium   — no release in >= 12 months AND no push in >= 12 months. Dormant.
 *   low      — release drift: the repo is active but the published package is
 *              >= 12 months behind it, so the install command hands the reader
 *              an old build of live software.
 *
 * An entry that is quiet in ONE place only is not reported. Plenty of finished
 * servers get no commits for a year and are perfectly good; plenty of active
 * repos have not cut a release because they ship from source. It takes both
 * signals to mean anything, which is exactly why neither registry alone found
 * these.
 *
 * STRICTLY READ-ONLY. It never edits servers.ts.
 *
 * GitHub calls are authenticated when GH_TOKEN/GITHUB_TOKEN is set (5,000/hr);
 * anonymous is 60/hr and will not get through the catalog, so `--limit` exists.
 *
 * EMITTING THE DATES, NOT JUST THE VERDICT
 *   The first run's findings shipped as prose edits to four descriptions. That
 *   does not scale and it rots: "last pushed 14 months ago" is true on the day
 *   it is written and wrong a month later. `--emit-recency` writes the raw
 *   pushed/published dates for EVERY entry it resolves — not only the flagged
 *   ones — to src/data/repo-recency.json, so /servers/[slug] can compute the
 *   age at build time and say it once, correctly, on every page at once.
 *   Fresh repos are as worth stating as dormant ones: "last commit this month"
 *   is the answer to the same reader question.
 *
 * STRICTLY READ-ONLY with respect to servers.ts. `--emit-recency` writes only
 * the generated recency file.
 *
 * Usage: node scripts/stale-release-sweep.mts [--min critical|high|medium|low]
 *                                             [--only npm|pip] [--limit N] [--json]
 *                                             [--emit-recency]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { servers } from '../src/data/servers.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_FILE = join(__dirname, '.stale-release-report.json');
/** Generated, committed, and imported by the server detail page. */
const RECENCY_FILE = join(__dirname, '..', 'src', 'data', 'repo-recency.json');

const args = process.argv.slice(2);
const argVal = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const asJson = args.includes('--json');
const emitRecency = args.includes('--emit-recency');
const only = argVal('--only');
const limit = Number(argVal('--limit') ?? 0) || 0;

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'] as const;
type Severity = (typeof SEVERITY_ORDER)[number];
const minSeverity = (argVal('--min') as Severity) ?? 'low';
const minRank = SEVERITY_ORDER.indexOf(minSeverity);

const GH_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';

/** Thresholds, in months. Named so the report can explain itself. */
const DORMANT_MONTHS = 12;
const DEAD_MONTHS = 24;

/* ------------------------------------------------------- package extraction */

/**
 * Generic plumbing published by third parties. `npx mcp-remote <url>` and
 * `uvx mcp-proxy <url>` are BRIDGES — their release dates say nothing about
 * the server the page documents. Same list the two link sweeps carry.
 */
const BRIDGES = new Set([
  'mcp-remote', 'mcp-proxy', 'mcpo', 'supergateway', 'uv', 'uvx', 'pip', 'python',
  '@modelcontextprotocol/inspector', '@smithery/cli', 'smithery',
]);
const NOT_A_PACKAGE = new Set([
  'npm', 'npx', 'node', 'run', 'build', 'start', 'setup', 'test', 'dev', 'cd', 'git', 'clone',
]);
/**
 * `npm run <script>` names a package.json SCRIPT, never a registry package —
 * the first run of this sweep reported `prepare@0.0.6` for snyk-mcp, whose
 * command ends `npm install && npm run prepare`. There is a real npm package
 * called `prepare`, so the lookup succeeded and the finding looked plausible.
 */
function namesNoPackage(tokens: string[], runnerIdx: number): boolean {
  return /^(npm|pnpm|yarn|bun)$/.test(tokens[runnerIdx]) && tokens[runnerIdx + 1] === 'run';
}
const BOOLEAN_FLAGS = new Set(['-y', '--yes', '-g', '--global', '-D', '--save-dev', '--silent']);

function normalizeNpm(token: string): string | null {
  const scoped = token.startsWith('@');
  const body = scoped ? token.slice(1) : token;
  const name = (scoped ? '@' : '') + body.split('@')[0];
  if (!/^@?[a-z0-9][a-z0-9._~\-]*(\/[a-z0-9][a-z0-9._~\-]*)?$/i.test(name)) return null;
  if (name.startsWith('.') || name.includes('://')) return null;
  return name;
}

function extractNpm(cmd: string | undefined): string | null {
  if (!cmd) return null;
  for (const segment of cmd.split(/&&|;|\|\|/)) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean);
    const runnerIdx = tokens.findIndex((t) => /^(npx|bunx|pnpm|yarn|npm)$/.test(t.replace(/^.*\//, '')));
    if (runnerIdx < 0) continue;
    if (namesNoPackage(tokens, runnerIdx)) continue;
    let i = runnerIdx + 1;
    while (i < tokens.length && /^(install|i|add|dlx|exec|global)$/.test(tokens[i])) i++;
    for (; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.startsWith('-')) {
        if (!BOOLEAN_FLAGS.has(t) && tokens[i + 1] && !tokens[i + 1].startsWith('-')) i++;
        continue;
      }
      if (t.includes('=') || t.startsWith('$') || t.includes('://')) continue;
      if (NOT_A_PACKAGE.has(t)) continue;
      const name = normalizeNpm(t);
      if (!name) continue;
      if (BRIDGES.has(name)) return null;
      return name;
    }
  }
  return null;
}

function extractPy(cmd: string | undefined): string | null {
  if (!cmd) return null;
  if (/--from\s+git\+|git\+https?:\/\/|https?:\/\/\S+\.whl/.test(cmd)) return null;
  for (const segment of cmd.split(/&&|;|\|\|/)) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean);
    const runnerIdx = tokens.findIndex((t) => /^(uvx|pipx|pip3?|uv|python3?)$/.test(t.replace(/^.*\//, '')));
    if (runnerIdx < 0) continue;
    let i = runnerIdx + 1;
    if (/^uv$/.test(tokens[runnerIdx]) && /^(run|venv|sync|init)$/.test(tokens[i] ?? '')) return null;
    if (/^python3?$/.test(tokens[runnerIdx]) && tokens[i] !== '-m') return null;
    // `uv pip sync requirements.txt` / `pip-compile` resolve a LOCKFILE, not a
    // named distribution — the first run returned `sync@1.0.0` (a real, ancient
    // npm-era package on PyPI) for delinea-mcp because of this.
    if (/^(sync|compile|freeze|uninstall)$/.test(tokens[i + 1] ?? '')) return null;
    while (i < tokens.length && /^(-m|pip|install|tool|run|--)$/.test(tokens[i])) i++;
    if (/^(sync|compile|freeze|uninstall)$/.test(tokens[i] ?? '')) return null;
    for (; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.startsWith('-')) {
        if (/^(-e|-r|--editable|--requirement)$/.test(t)) return null;
        continue;
      }
      if (t.includes('=') || t.startsWith('$')) continue;
      // local/source target
      if (t === '.' || t.startsWith('.') || t.startsWith('/') || t.includes('/') || t.endsWith('.py')) return null;
      const name = t.split(/[@\[<>=!~]/)[0];
      if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name)) continue;
      if (BRIDGES.has(name.toLowerCase())) return null;
      return name;
    }
  }
  return null;
}

/* ------------------------------------------------------------- registries -- */

type Release = { version: string; published: string | null };

/**
 * npm's `time` map is the only place the publish DATE lives — `dist-tags.latest`
 * gives the version and nothing else. Both are read from the abbreviated doc's
 * full form, so this asks for the full document deliberately.
 */
async function npmRelease(pkg: string): Promise<Release | { missing: true } | { error: string }> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${pkg.replace('/', '%2F')}`, {
      headers: { accept: 'application/json' },
    });
    if (res.status === 404) return { missing: true };
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const data = (await res.json()) as any;
    const version = data?.['dist-tags']?.latest;
    if (!version) return { error: 'no dist-tags.latest' };
    return { version, published: data?.time?.[version] ?? null };
  } catch (err) {
    return { error: String(err) };
  }
}

async function pypiRelease(pkg: string): Promise<Release | { missing: true } | { error: string }> {
  try {
    const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`, {
      headers: { accept: 'application/json' },
    });
    if (res.status === 404) return { missing: true };
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const data = (await res.json()) as any;
    const version = data?.info?.version;
    if (!version) return { error: 'no info.version' };
    // PyPI dates the FILES, not the release; the earliest upload of the latest
    // version is the release date. A version with no files (yanked) has none.
    const files: any[] = data?.releases?.[version] ?? [];
    const dates = files.map((f) => f?.upload_time_iso_8601).filter(Boolean).sort();
    return { version, published: dates[0] ?? null };
  } catch (err) {
    return { error: String(err) };
  }
}

/* ----------------------------------------------------------------- GitHub -- */

function ghIdentity(url: string | null | undefined): { owner: string; repo: string } | null {
  if (!url) return null;
  const m = url
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .match(/github\.com[/:]([^/]+)\/([^/#?]+)/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

type RepoState = { archived: boolean; pushedAt: string | null };
const repoCache = new Map<string, RepoState | null>();

async function repoState(owner: string, repo: string): Promise<RepoState | null> {
  const key = `${owner}/${repo}`.toLowerCase();
  if (repoCache.has(key)) return repoCache.get(key)!;
  let out: RepoState | null = null;
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        accept: 'application/vnd.github+json',
        ...(GH_TOKEN ? { authorization: `Bearer ${GH_TOKEN}` } : {}),
      },
    });
    if (res.ok) {
      const d = (await res.json()) as any;
      out = { archived: Boolean(d?.archived), pushedAt: d?.pushed_at ?? null };
    }
  } catch {
    out = null;
  }
  repoCache.set(key, out);
  return out;
}

/* ------------------------------------------------------------------ main -- */

function monthsAgo(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (now - t) / (1000 * 60 * 60 * 24 * 30.44);
}

type Finding = {
  slug: string;
  name: string;
  severity: Severity;
  registry: 'npm' | 'pip';
  package: string;
  version: string;
  publishedAt: string | null;
  releaseAgeMonths: number | null;
  repo: string;
  archived: boolean;
  pushedAt: string | null;
  pushAgeMonths: number | null;
  why: string;
};

/**
 * One record per entry whose repo AND registry both resolved, flagged or not.
 * Deliberately stores DATES and not ages — an age baked into a data file is a
 * fact with an expiry date, and this file is committed.
 */
type Recency = {
  repo: string;
  archived: boolean;
  pushedAt: string | null;
  registry: 'npm' | 'pip';
  package: string;
  version: string;
  publishedAt: string | null;
};

const now = Date.now();
const findings: Finding[] = [];
const recency: Record<string, Recency> = {};

const candidates = servers
  .filter((s: any) => s.install_command && s.github_url)
  .map((s: any) => {
    const npmPkg = only === 'pip' ? null : extractNpm(s.install_command);
    const pyPkg = npmPkg || only === 'npm' ? null : extractPy(s.install_command);
    return { s, npmPkg, pyPkg };
  })
  .filter((c) => c.npmPkg || c.pyPkg);

const work = limit ? candidates.slice(0, limit) : candidates;

if (!asJson) {
  console.log(`stale-release-sweep: ${work.length} installable entries to check` +
    (GH_TOKEN ? '' : ' (no GH_TOKEN — GitHub is 60/hr, expect truncation)'));
}

let checked = 0;
for (const { s, npmPkg, pyPkg } of work) {
  checked++;
  const registry: 'npm' | 'pip' = npmPkg ? 'npm' : 'pip';
  const pkg = (npmPkg ?? pyPkg)!;
  const rel = registry === 'npm' ? await npmRelease(pkg) : await pypiRelease(pkg);
  // A missing package is the *link* sweeps' finding, not this one's.
  if ('missing' in rel || 'error' in rel) continue;

  const id = ghIdentity(s.github_url);
  if (!id) continue;
  const repo = await repoState(id.owner, id.repo);
  if (!repo) continue;

  const relAge = monthsAgo(rel.published, now);
  const pushAge = monthsAgo(repo.pushedAt, now);

  recency[s.slug] = {
    repo: `${id.owner}/${id.repo}`,
    archived: repo.archived,
    pushedAt: repo.pushedAt,
    registry,
    package: pkg,
    version: rel.version,
    publishedAt: rel.published,
  };

  let severity: Severity | null = null;
  let why = '';
  if (repo.archived) {
    severity = 'critical';
    why = `repo is archived; ${pkg}@${rel.version} is still published and installs cleanly`;
  } else if (relAge !== null && pushAge !== null && relAge >= DEAD_MONTHS && pushAge >= DEAD_MONTHS) {
    severity = 'high';
    why = `no release in ${relAge.toFixed(0)}mo and no push in ${pushAge.toFixed(0)}mo`;
  } else if (relAge !== null && pushAge !== null && relAge >= DORMANT_MONTHS && pushAge >= DORMANT_MONTHS) {
    severity = 'medium';
    why = `dormant: last release ${relAge.toFixed(0)}mo ago, last push ${pushAge.toFixed(0)}mo ago`;
  } else if (relAge !== null && pushAge !== null && relAge >= DORMANT_MONTHS && pushAge < DORMANT_MONTHS) {
    severity = 'low';
    why = `release drift: repo pushed ${pushAge.toFixed(1)}mo ago but ${pkg}@${rel.version} is ${relAge.toFixed(0)}mo old`;
  }
  if (!severity) continue;
  if (SEVERITY_ORDER.indexOf(severity) > minRank) continue;

  findings.push({
    slug: s.slug,
    name: s.name,
    severity,
    registry,
    package: pkg,
    version: rel.version,
    publishedAt: rel.published,
    releaseAgeMonths: relAge === null ? null : Number(relAge.toFixed(1)),
    repo: `${id.owner}/${id.repo}`,
    archived: repo.archived,
    pushedAt: repo.pushedAt,
    pushAgeMonths: pushAge === null ? null : Number(pushAge.toFixed(1)),
    why,
  });

  if (!asJson && checked % 100 === 0) {
    console.log(`  … ${checked}/${work.length} checked, ${findings.length} flagged`);
  }
}

findings.sort(
  (a, b) =>
    SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
    (b.releaseAgeMonths ?? 0) - (a.releaseAgeMonths ?? 0),
);

const report = {
  generatedAt: new Date().toISOString(),
  thresholds: { dormantMonths: DORMANT_MONTHS, deadMonths: DEAD_MONTHS },
  checked,
  candidates: candidates.length,
  counts: SEVERITY_ORDER.reduce<Record<string, number>>((acc, sev) => {
    acc[sev] = findings.filter((f) => f.severity === sev).length;
    return acc;
  }, {}),
  findings,
};
writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

if (emitRecency) {
  // A partial run (--limit / --only) would silently delete the slugs it did not
  // visit, and the page would quietly stop showing their dates. Merge instead.
  let previous: Record<string, Recency> = {};
  try {
    previous = JSON.parse(readFileSync(RECENCY_FILE, 'utf8')).entries ?? {};
  } catch {
    previous = {};
  }
  const merged = { ...previous, ...recency };
  writeFileSync(
    RECENCY_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        entries: Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b))),
      },
      null,
      2,
    ) + '\n',
  );
  if (!asJson) {
    console.log(
      `recency: ${Object.keys(recency).length} resolved this run, ${Object.keys(merged).length} total -> ${RECENCY_FILE}`,
    );
  }
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`\nchecked ${checked} · flagged ${findings.length}`);
  for (const sev of SEVERITY_ORDER) console.log(`  ${sev.padEnd(9)} ${report.counts[sev]}`);
  console.log('');
  for (const f of findings.slice(0, 40)) {
    console.log(`[${f.severity}] ${f.slug} — ${f.repo} — ${f.why}`);
  }
  console.log(`\nreport: ${REPORT_FILE}`);
}
