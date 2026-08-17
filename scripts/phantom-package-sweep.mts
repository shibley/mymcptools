/**
 * PHANTOM-PACKAGE sweep for the catalog (src/data/servers.ts).
 *
 * WHY THIS EXISTS
 *   `stale-release-sweep.mts` resolves every installable entry against npm/PyPI
 *   and then, at the top of its loop, does this:
 *
 *       // A missing package is the *link* sweeps' finding, not this one's.
 *       if ('missing' in rel || 'error' in rel) continue;
 *
 *   That comment was true when it was written and is no longer sufficient. The
 *   two link sweeps DO classify a 404 as `medium`, but each one only walks its
 *   own `install_type` bucket (`npm-repo-link-sweep` reads npm entries;
 *   `pip-docker-repo-link-sweep` reads pip + docker), and each one ALSO needs a
 *   resolvable `github_url` to do its real job. So an entry whose command names
 *   a package that does not exist, but whose declared install_type points at a
 *   different bucket than the command's actual runner, is checked by nobody.
 *   The 2026-08-17 stale run made the hole measurable: 509 installable
 *   candidates in, 326 recency records out — 183 entries silently dropped, and
 *   "the registry does not have this package" is one of the two reasons an
 *   entry lands in that gap.
 *
 * WHAT IT REPORTS, AND WHY THAT IS THE WORST ERROR SHAPE IN THE CATALOG
 *   A page whose Installation block is empty is unhelpful. A page whose
 *   Installation block hands over `npx -y some-package-that-was-never-published`
 *   is worse: it looks authoritative, it is copy-pasteable, and the reader finds
 *   out it is fiction only after running it. That is the same failure mode the
 *   archived-repo and dormant-repo fires fixed at the *maintenance* layer; this
 *   is the layer below, where the artifact does not exist at all.
 *
 * EVIDENCE STANDARD
 *   A finding is a registry 404 and nothing else. A network error, a 5xx, or a
 *   rate-limited response is NOT a finding — it is recorded as `unchecked` so a
 *   flaky run can never be mistaken for a fabrication. Package extraction reuses
 *   the same runner/bridge/not-a-package rules the stale sweep proved out, so a
 *   `npm run prepare` or a `uv pip sync requirements.txt` cannot be mistaken for
 *   a distribution name.
 *
 *   Registry-only: it never calls GitHub, so it has no 60/hr ceiling and can
 *   walk the whole catalog in one pass.
 *
 * STRICTLY READ-ONLY with respect to servers.ts. It writes one report file.
 *
 * USAGE: node scripts/phantom-package-sweep.mts [--only npm|pip] [--limit N] [--json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { servers } from '../src/data/servers.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_FILE = join(__dirname, '.phantom-package-report.json');
/** Generated, committed, and imported by the server detail page. */
const CHECK_FILE = join(__dirname, '..', 'src', 'data', 'install-registry-check.json');

/**
 * Package names that exist but belong to a DIFFERENT product than the entry
 * documents. Registry existence is not identity, and this sweep's `revived`
 * verdict would otherwise hand the reader someone else's software.
 *
 * `slab-mcp` is the case that forced this: the catalog entry is Slab, the team
 * knowledge base; the npm package `slab-mcp` (dev-jeb/slab-community) is an MCP
 * server for a trading-card grading API. Same name, unrelated product. Flipping
 * that entry to "verified" on a 200 would be exactly the fabrication this sprint
 * exists to undo.
 */
const COLLISIONS: Record<string, string> = {
  'slab-mcp':
    'npm `slab-mcp` is published but belongs to dev-jeb/slab-community, an MCP server for a trading-card grading API — not Slab the team knowledge base this entry documents',
};

const args = process.argv.slice(2);
const argVal = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const asJson = args.includes('--json');
const emit = args.includes('--emit');
const only = argVal('--only');
const limit = Number(argVal('--limit') ?? 0) || 0;

/* ------------------------------------------------------- package extraction */
/* Same rules as stale-release-sweep.mts — see the comments there for the
 * specific false positives each guard was added to kill. */

const BRIDGES = new Set([
  'mcp-remote', 'mcp-proxy', 'mcpo', 'supergateway', 'uv', 'uvx', 'pip', 'python',
  '@modelcontextprotocol/inspector', '@smithery/cli', 'smithery',
]);
const NOT_A_PACKAGE = new Set([
  'npm', 'npx', 'node', 'run', 'build', 'start', 'setup', 'test', 'dev', 'cd', 'git', 'clone',
]);
const BOOLEAN_FLAGS = new Set(['-y', '--yes', '-g', '--global', '-D', '--save-dev', '--silent']);
/** pip/uv flags that take a separate argument — that argument is never a package. */
const PY_VALUE_FLAGS = new Set([
  '-p', '--python', '--index-url', '-i', '--extra-index-url', '--find-links', '-f',
  '--target', '-t', '--prefix', '--with', '--constraint', '-c', '--upgrade-package',
]);

function namesNoPackage(tokens: string[], runnerIdx: number): boolean {
  return /^(npm|pnpm|yarn|bun)$/.test(tokens[runnerIdx]) && tokens[runnerIdx + 1] === 'run';
}

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
    if (/^(sync|compile|freeze|uninstall)$/.test(tokens[i + 1] ?? '')) return null;
    while (i < tokens.length && /^(-m|pip|install|tool|run|--)$/.test(tokens[i])) i++;
    if (/^(sync|compile|freeze|uninstall)$/.test(tokens[i] ?? '')) return null;
    for (; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.startsWith('-')) {
        if (/^(-e|-r|--editable|--requirement)$/.test(t)) return null;
        /**
         * The stale sweep's pip path never consumed a flag's VALUE, so
         * `uv tool install -p 3.13 serena-agent` extracted `3.13` — which PyPI
         * 404s, producing a confident phantom finding for an entry whose real
         * package (`serena-agent`) is published and fine. Value-taking flags
         * have to eat their argument the way the npm path already does.
         */
        if (PY_VALUE_FLAGS.has(t) && tokens[i + 1] && !tokens[i + 1].startsWith('-')) i++;
        continue;
      }
      if (t.includes('=') || t.startsWith('$')) continue;
      if (t === '.' || t.startsWith('.') || t.startsWith('/') || t.includes('/') || t.endsWith('.py')) return null;
      const name = t.split(/[@\[<>=!~]/)[0];
      if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name)) continue;
      if (BRIDGES.has(name.toLowerCase())) return null;
      return name;
    }
  }
  return null;
}

/* ----------------------------------------------------------------- lookups */

type Lookup = { exists: true } | { missing: true } | { error: string };

async function npmExists(pkg: string): Promise<Lookup> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${pkg.replace('/', '%2F')}`, {
      headers: { accept: 'application/vnd.npm.install-v1+json' },
    });
    if (res.status === 404) return { missing: true };
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const data = (await res.json()) as any;
    // An unpublished-then-tombstoned package answers 200 with no versions.
    if (!data?.versions || Object.keys(data.versions).length === 0) return { missing: true };
    return { exists: true };
  } catch (err) {
    return { error: String(err) };
  }
}

async function pypiExists(pkg: string): Promise<Lookup> {
  try {
    const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`, {
      headers: { accept: 'application/json' },
    });
    if (res.status === 404) return { missing: true };
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return { exists: true };
  } catch (err) {
    return { error: String(err) };
  }
}

/* ------------------------------------------------------------------ main -- */

/**
 * Three verdicts, and the last two are the point of running this again.
 *   phantom  — package 404s and the entry does NOT say so. The page hands over
 *              a copy-pasteable command that cannot run.
 *   revived  — the entry says `install_verified: false` and the package EXISTS
 *              today. A registry 404 is only true as of the date it was checked
 *              and the registry only ever grows, so a stale negative is a claim
 *              that rots into a lie. The page strikes the command through and
 *              removes the copy button, which is the worse direction to be
 *              wrong in: it withholds a working install.
 *   unnamed  — the entry says `install_verified: false` but the command names
 *              no registry package at all (git clone, a remote `mcp add` URL,
 *              a Docker one-liner). "Not published to npm" is not false of
 *              these so much as meaningless, and the page's fallback picks the
 *              first bare token, so it prints things like
 *              "This command will fail: `git` is not published to npm".
 */
type Verdict = 'phantom' | 'revived' | 'unnamed';
type Finding = {
  slug: string;
  name: string;
  verdict: Verdict;
  install_type: string | null;
  registry: 'npm' | 'pip' | null;
  package: string | null;
  install_command: string | null;
  install_checked: string | null;
  github_url: string | null;
  why: string;
};

const findings: Finding[] = [];
const unchecked: { slug: string; package: string; registry: string; error: string }[] = [];

/**
 * One record per entry whose command names a registry package and whose lookup
 * completed — the outcome, not a verdict. This is what the page reads, so that
 * a re-run heals a stale `install_verified` instead of requiring 60 hand edits.
 * Stores the CHECK DATE, never an age.
 */
type Check = {
  registry: 'npm' | 'pip';
  package: string;
  exists: boolean;
  checkedAt: string;
  collision?: string;
};
const checks: Record<string, Check> = {};
const TODAY = new Date().toISOString().slice(0, 10);

const candidates = (servers as any[])
  .filter((s) => s.install_command || s.install_verified === false)
  .map((s) => {
    const npmPkg = only === 'pip' ? null : extractNpm(s.install_command);
    const pyPkg = npmPkg || only === 'npm' ? null : extractPy(s.install_command);
    return { s, npmPkg, pyPkg };
  })
  .filter((c) => c.npmPkg || c.pyPkg || c.s.install_verified === false);

const work = limit ? candidates.slice(0, limit) : candidates;

if (!asJson) {
  console.log(`phantom-package-sweep: ${work.length} entries to check`);
}

let checked = 0;
for (const { s, npmPkg, pyPkg } of work) {
  checked++;
  const claimedDead = s.install_verified === false;
  const registry: 'npm' | 'pip' | null = npmPkg ? 'npm' : pyPkg ? 'pip' : null;
  const pkg = npmPkg ?? pyPkg ?? null;

  if (!registry || !pkg) {
    if (claimedDead) {
      findings.push({
        slug: s.slug, name: s.name, verdict: 'unnamed',
        install_type: s.install_type ?? null, registry: null, package: null,
        install_command: s.install_command ?? null,
        install_checked: s.install_checked ?? null,
        github_url: s.github_url ?? null,
        why: `marked install_verified:false but the command names no registry package — the "not published" notice on /servers/${s.slug} is unsupportable`,
      });
    }
    continue;
  }

  const res = registry === 'npm' ? await npmExists(pkg) : await pypiExists(pkg);
  const label = registry === 'npm' ? 'npm' : 'PyPI';

  if (!('error' in res)) {
    checks[s.slug] = {
      registry,
      package: pkg,
      exists: 'exists' in res && !COLLISIONS[s.slug],
      checkedAt: TODAY,
      ...(COLLISIONS[s.slug] ? { collision: COLLISIONS[s.slug] } : {}),
    };
  }

  if ('error' in res) {
    unchecked.push({ slug: s.slug, package: pkg, registry, error: res.error });
  } else if ('exists' in res && COLLISIONS[s.slug]) {
    // Not a finding — a known, deliberate hold. Recorded so a run cannot
    // silently "fix" it back into the catalog.
    continue;
  } else if ('missing' in res && !claimedDead) {
    findings.push({
      slug: s.slug, name: s.name, verdict: 'phantom',
      install_type: s.install_type ?? null, registry, package: pkg,
      install_command: s.install_command, install_checked: s.install_checked ?? null,
      github_url: s.github_url ?? null,
      why: `${label} package \`${pkg}\` does not exist — the install command on /servers/${s.slug} cannot run, and the page does not say so`,
    });
  } else if ('exists' in res && claimedDead) {
    findings.push({
      slug: s.slug, name: s.name, verdict: 'revived',
      install_type: s.install_type ?? null, registry, package: pkg,
      install_command: s.install_command, install_checked: s.install_checked ?? null,
      github_url: s.github_url ?? null,
      why: `${label} package \`${pkg}\` IS published today, but /servers/${s.slug} strikes the command through and says it will fail (checked ${s.install_checked ?? 'unknown'})`,
    });
  }

  if (!asJson && checked % 200 === 0) {
    console.log(`  … ${checked}/${work.length} checked, ${findings.length} flagged`);
  }
}

const ORDER: Verdict[] = ['revived', 'unnamed', 'phantom'];
findings.sort(
  (a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict) || a.slug.localeCompare(b.slug),
);

const report = {
  generatedAt: new Date().toISOString(),
  checked,
  candidates: candidates.length,
  counts: ORDER.reduce<Record<string, number>>((acc, v) => {
    acc[v] = findings.filter((f) => f.verdict === v).length;
    return acc;
  }, {}),
  unchecked: unchecked.length,
  findings,
  uncheckedEntries: unchecked,
};
writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

if (emit) {
  // A partial run (--limit / --only) would otherwise delete the slugs it did
  // not visit and the page would quietly fall back to the stale inline field.
  let previous: Record<string, Check> = {};
  try {
    previous = JSON.parse(readFileSync(CHECK_FILE, 'utf8')).entries ?? {};
  } catch {
    previous = {};
  }
  const merged = { ...previous, ...checks };
  const sorted = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(CHECK_FILE, `${JSON.stringify({ generatedAt: TODAY, entries: sorted }, null, 2)}\n`);
  if (!asJson) {
    console.log(`\nwrote ${Object.keys(sorted).length} registry checks → ${CHECK_FILE}`);
  }
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `\n${report.counts.revived} revived · ${report.counts.unnamed} unnamed · ` +
      `${report.counts.phantom} newly phantom · ${unchecked.length} unchecked (network/5xx)`,
  );
  for (const f of findings) {
    console.log(`  [${f.verdict}] ${f.slug} — ${f.package ?? '(no package)'}\n      ${f.install_command}`);
  }
  console.log(`\nreport → ${REPORT_FILE}`);
}
