/**
 * Resolver for catalog entries whose github_url does not resolve.
 *
 * WHY: verify-github-entries.mts (detection) found that a large majority of
 * github_url values 404. This script is the REMEDIATION half: for every broken
 * entry it tries to find the entry's REAL repository, and records either a
 * justified replacement URL or an explicit "unresolved" verdict. It never
 * edits src/data/servers.ts — apply-github-fixes.mts does that from this
 * script's output, so resolution and mutation stay separately reviewable.
 *
 * Evidence ladder (strongest first) — we only accept a match we can justify,
 * because name similarity alone is exactly how the bad URLs got here:
 *   1. npm registry: the entry's install_command names a package; the package
 *      exists and its `repository` field points at a repo that resolves.
 *      Provenance is direct (the publisher declared it), so this auto-accepts.
 *   2. PyPI: same idea via project_urls / home_page.
 *   3. GitHub code search: only accepted when the repo looks like an MCP server
 *      (name/description/topics mention mcp) AND the server name tokens are
 *      substantially present in the repo's own signals. Deliberately strict —
 *      a wrong "fix" is worse than an honest null.
 * Anything that clears none of these is recorded as unresolved so the applier
 * can null the URL and flag the entry.
 *
 * Rate limits: GitHub search is 30 req/min (much tighter than the 5,000/hr
 * core quota), so searches are spaced 2.2s apart and back off on 403/429.
 * Registry lookups (npm/PyPI) are not GitHub-limited and run at 4/s.
 *
 * Resumable: scripts/.resolve-state.json is rewritten after every entry, so an
 * interrupted run loses at most one in-flight lookup.
 *
 * Run: node scripts/resolve-github-urls.mts
 *        [--limit N]        stop after N entries this run
 *        [--phase registry|search|all]   which evidence tiers to attempt
 *        [--slug a,b,c]     restrict to specific slugs
 *        [--recheck]        redo entries already in resolve state
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { servers } from '../src/data/servers.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERIFY_STATE = join(__dirname, '.verify-state.json');
const STATE_FILE = join(__dirname, '.resolve-state.json');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const USER_AGENT = 'mymcptools-resolve-github/0.1.0';
const SEARCH_GAP_MS = 2_200; // GitHub search = 30/min
const REPO_GAP_MS = 1_000;   // core API, same 1/s discipline as the verifier
const REGISTRY_GAP_MS = 250;

const args = process.argv.slice(2);
const argVal = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const limit = Number(argVal('--limit') ?? Infinity);
const phase = (argVal('--phase') ?? 'all') as 'registry' | 'search' | 'all';
const slugFilter = argVal('--slug')?.split(',').map((s) => s.trim());
const recheck = args.includes('--recheck');
// Re-run only the entries that came back unresolved — lets a later, more
// expensive evidence tier (search) run over the registry phase's misses
// without clobbering matches that already have stronger provenance.
const onlyUnresolved = args.includes('--only-unresolved');

type Verdict = 'repaired' | 'unresolved' | 'error';
interface Resolution {
  slug: string;
  name: string;
  oldUrl: string | null;
  verdict: Verdict;
  newUrl?: string;
  repoFullName?: string;
  evidence?: string;       // human-readable justification for the match
  method?: 'npm' | 'pypi' | 'search' | 'redirect';
  candidatesTried?: string[];
  resolvedAt: string;
}
type State = Record<string, Resolution>;

const loadState = (): State =>
  existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
const saveState = (s: State) => writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + '\n');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (GITHUB_TOKEN) h.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

/** Fetch with secondary-rate-limit backoff. Returns null on repeated failure. */
async function ghFetch(url: string, attempts = 4): Promise<{ status: number; body: any } | null> {
  let wait = 5_000;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: ghHeaders() });
      const remaining = Number(res.headers.get('x-ratelimit-remaining') ?? '1');
      if ((res.status === 403 || res.status === 429) && remaining > 0) {
        // Secondary/abuse limit — transient. Back off rather than give up.
        console.warn(`  [backoff] ${res.status} on ${url}; sleeping ${wait / 1000}s`);
        await sleep(wait);
        wait *= 2;
        continue;
      }
      let body: any = null;
      try { body = await res.json(); } catch { /* non-JSON body */ }
      return { status: res.status, body };
    } catch (e) {
      await sleep(2_000);
    }
  }
  return null;
}

// ---- package-name extraction ----------------------------------------------
/** Pull a likely npm package name out of an install_command. */
function npmPackage(cmd: string | undefined): string | null {
  if (!cmd) return null;
  const m =
    cmd.match(/npx\s+(?:-y\s+|--yes\s+)?(@[\w.-]+\/[\w.-]+|[\w.-]+)/) ||
    cmd.match(/npm\s+(?:install|i)\s+(?:-g\s+|--global\s+)?(@[\w.-]+\/[\w.-]+|[\w.-]+)/);
  const pkg = m?.[1];
  if (!pkg || ['install', 'run', 'exec', 'claude', 'node'].includes(pkg)) return null;
  return pkg;
}
/** Pull a likely PyPI distribution name out of an install_command. */
function pypiPackage(cmd: string | undefined): string | null {
  if (!cmd) return null;
  const m =
    cmd.match(/uvx\s+(?:--from\s+)?([\w.-]+)/) ||
    cmd.match(/pip\s+install\s+(?:-U\s+)?([\w.-]+)/) ||
    cmd.match(/uv\s+tool\s+run\s+([\w.-]+)/) ||
    cmd.match(/pipx\s+install\s+([\w.-]+)/);
  const pkg = m?.[1];
  if (!pkg || ['install', 'run'].includes(pkg)) return null;
  return pkg;
}

/** owner/repo out of any github URL-ish string (git+ssh, .git suffix, tree paths). */
function toOwnerRepo(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const m = String(raw).match(/github\.com[/:]([\w.-]+)\/([\w.-]+)/i);
  if (!m) return null;
  const owner = m[1];
  const repo = m[2].replace(/\.git$/, '');
  if (!owner || !repo) return null;
  return `${owner}/${repo}`;
}

// ---- registry lookups ------------------------------------------------------
async function npmRepo(pkg: string): Promise<{ ownerRepo: string; note: string } | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg).replace('%40', '@')}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (res.status !== 200) return null;
    const body: any = await res.json();
    const repoField = body?.repository?.url ?? body?.repository ?? body?.homepage;
    const ownerRepo = toOwnerRepo(typeof repoField === 'string' ? repoField : repoField?.url);
    if (!ownerRepo) return null;
    return { ownerRepo, note: `npm package "${pkg}" exists and declares repository ${ownerRepo}` };
  } catch {
    return null;
  }
}

async function pypiRepo(pkg: string): Promise<{ ownerRepo: string; note: string } | null> {
  try {
    const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (res.status !== 200) return null;
    const body: any = await res.json();
    const urls = Object.values(body?.info?.project_urls ?? {}) as string[];
    for (const u of [...urls, body?.info?.home_page]) {
      const ownerRepo = toOwnerRepo(u);
      if (ownerRepo) return { ownerRepo, note: `PyPI package "${pkg}" exists and links ${ownerRepo}` };
    }
    return null;
  } catch {
    return null;
  }
}

// ---- repo confirmation -----------------------------------------------------
interface RepoInfo { fullName: string; description: string; topics: string[]; archived: boolean }
async function repoInfo(ownerRepo: string): Promise<RepoInfo | null> {
  const r = await ghFetch(`https://api.github.com/repos/${ownerRepo}`);
  await sleep(REPO_GAP_MS);
  if (!r || r.status !== 200 || !r.body?.full_name) return null;
  return {
    fullName: String(r.body.full_name),
    description: String(r.body.description ?? ''),
    topics: Array.isArray(r.body.topics) ? r.body.topics : [],
    archived: !!r.body.archived,
  };
}

// ---- search ---------------------------------------------------------------
const STOP = new Set(['the','a','an','for','and','or','to','of','with','server','servers','mcp','model','context','protocol','tool','tools','api','client','integration','official','unofficial','open','source','com','io']);
function tokens(s: string): string[] {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((t) => t.length >= 3 && !STOP.has(t));
}

/**
 * Repos that keep surfacing in MCP searches but are never the server itself:
 * curated lists, docs sites, course/demo scaffolding.
 */
const JUNK_NAME = /(^|[-_])(awesome|docs?|examples?|tutorials?|templates?|boilerplate|starter|demos?|workshop|course|blog)([-_]|$)/i;

/** Authors that name no specific vendor, so a community repo is a fair match. */
const GENERIC_AUTHORS = new Set(['community', 'unknown', 'various', 'open source', '']);

/**
 * Search GitHub for the entry's real repo.
 *
 * Two deliberate choices, both learned from bad matches on the first pass:
 *   - `in:name` with default (relevance) ranking, NOT sort=stars. Sorting by
 *     stars floats giant curated lists (punkpeye/awesome-mcp-servers,
 *     ComposioHQ/awesome-claude-skills) above the actual server, and one of
 *     those was accepted before this was fixed.
 *   - The repo NAME — not just the description — must carry both an MCP marker
 *     and the entry's distinctive tokens. Descriptions mention MCP casually;
 *     names don't.
 *
 * Vendor-authored entries additionally require the repo owner to match the
 * claimed author. Pointing "Datadog MCP by Datadog" at some third party's
 * repo would recreate exactly the misleading-link problem this is fixing;
 * for those, an honest null is the correct answer.
 */
async function searchRepo(name: string, author: string): Promise<{ ownerRepo: string; note: string } | null> {
  const nameTokens = tokens(name);
  if (nameTokens.length === 0) return null;
  const generic = GENERIC_AUTHORS.has((author || '').trim().toLowerCase());
  const authorTokens = tokens(author);

  const q = `${nameTokens.join(' ')} mcp in:name`;
  const r = await ghFetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=8`);
  await sleep(SEARCH_GAP_MS);
  if (!r || r.status !== 200 || !Array.isArray(r.body?.items)) return null;

  for (const item of r.body.items) {
    if (item.archived || item.fork) continue;
    const full = String(item.full_name);
    const [owner, repoName] = full.split('/');
    const lowerRepo = repoName.toLowerCase();
    if (JUNK_NAME.test(lowerRepo)) continue;
    if (!/(^|[-_.])mcp([-_.]|$)/.test(lowerRepo)) continue;

    const hits = nameTokens.filter((t) => lowerRepo.includes(t)).length;
    if (hits / nameTokens.length < 0.6) continue;

    const ownerMatches =
      authorTokens.length > 0 &&
      authorTokens.some((t) => owner.toLowerCase().includes(t) || t.includes(owner.toLowerCase()));

    if (!generic && !ownerMatches) continue; // vendor-claimed entry, third-party repo → refuse

    return {
      ownerRepo: full,
      note: generic
        ? `GitHub search "${q}": ${full} is an MCP server repo covering ${hits}/${nameTokens.length} name tokens; entry author is generic ("${author}") so a community repo is an acceptable match`
        : `GitHub search "${q}": ${full} is an MCP server repo covering ${hits}/${nameTokens.length} name tokens and is owned by the claimed author "${author}"`,
    };
  }
  return null;
}

// ---- main -----------------------------------------------------------------
async function main() {
  if (!GITHUB_TOKEN) {
    console.error('[resolve] refusing to run unauthenticated — export GITHUB_TOKEN');
    process.exit(1);
  }
  const verify = JSON.parse(readFileSync(VERIFY_STATE, 'utf8')) as Record<string, { status: string }>;
  const state = loadState();

  // Only entries whose URL is genuinely dead. `archived` repos still resolve,
  // so they are left alone here and flagged (not nulled) by the applier.
  // `mismatch` is deliberately excluded: that status means the repo EXISTS but
  // looked unrelated by heuristic, and it is dominated by false positives
  // (the official modelcontextprotocol/servers reference servers, whose
  // /tree/main/src/<name> subpaths carry the real identity). Rewriting those
  // would throw away working, more-specific URLs. The handful of genuine
  // mismatches are handled explicitly rather than by this bulk pass.
  const BROKEN = new Set(['not_found', 'bad_url']);
  const pool = servers.filter((s) => {
    if (slugFilter) return slugFilter.includes(s.slug);
    if (!BROKEN.has(verify[s.slug]?.status ?? '')) return false;
    if (onlyUnresolved) return state[s.slug]?.verdict !== 'repaired';
    if (state[s.slug] && !recheck) return false;
    return true;
  });

  console.log(`[resolve] pool=${pool.length} phase=${phase} done=${Object.keys(state).length}`);

  let n = 0;
  for (const s of pool) {
    if (n >= limit) break;
    n++;
    const rec: Resolution = {
      slug: s.slug, name: s.name, oldUrl: s.github_url,
      verdict: 'unresolved', candidatesTried: [], resolvedAt: new Date().toISOString(),
    };

    try {
      let found: { ownerRepo: string; note: string; method: Resolution['method'] } | null = null;

      if (phase === 'registry' || phase === 'all') {
        const npmPkg = npmPackage(s.install_command);
        if (npmPkg) {
          rec.candidatesTried!.push(`npm:${npmPkg}`);
          const hit = await npmRepo(npmPkg);
          await sleep(REGISTRY_GAP_MS);
          if (hit) found = { ...hit, method: 'npm' };
        }
        if (!found) {
          const pyPkg = pypiPackage(s.install_command);
          if (pyPkg) {
            rec.candidatesTried!.push(`pypi:${pyPkg}`);
            const hit = await pypiRepo(pyPkg);
            await sleep(REGISTRY_GAP_MS);
            if (hit) found = { ...hit, method: 'pypi' };
          }
        }
      }

      if (!found && (phase === 'search' || phase === 'all')) {
        rec.candidatesTried!.push('search');
        const hit = await searchRepo(s.name, s.author);
        if (hit) found = { ...hit, method: 'search' };
      }

      if (found) {
        // Every candidate, however strong its provenance, must actually resolve
        // on GitHub before we write it into the catalog. That check is the
        // whole point of this exercise.
        const info = await repoInfo(found.ownerRepo);
        if (info && !info.archived) {
          rec.verdict = 'repaired';
          rec.method = found.method;
          rec.repoFullName = info.fullName;
          rec.newUrl = `https://github.com/${info.fullName}`;
          rec.evidence = `${found.note}; confirmed live via GitHub API`;
        } else {
          rec.evidence = `candidate ${found.ownerRepo} did not confirm live (${info ? 'archived' : 'not found'})`;
        }
      } else {
        rec.evidence = 'no npm/PyPI provenance and no search result met the acceptance bar';
      }
    } catch (e) {
      rec.verdict = 'error';
      rec.evidence = `error: ${(e as Error).message}`;
    }

    state[s.slug] = rec;
    saveState(state);
    console.log(`  ${rec.verdict.padEnd(10)} ${s.slug} → ${rec.newUrl ?? '(null)'} ${rec.method ? `[${rec.method}]` : ''}`);
  }

  const vals = Object.values(state);
  console.log('\n[resolve] totals:', {
    done: vals.length,
    repaired: vals.filter((r) => r.verdict === 'repaired').length,
    unresolved: vals.filter((r) => r.verdict === 'unresolved').length,
    error: vals.filter((r) => r.verdict === 'error').length,
  });
}

main().catch((e) => { console.error('[resolve] fatal:', e); process.exit(1); });
