/**
 * PHANTOM LISTING SWEEP — entries that give a reader (or an agent) no path to
 * any artifact at all, and the fabricated popularity numbers riding on them.
 *
 * WHY THIS EXISTS
 *   The install-command sweep answered "which pages render no Installation
 *   section". Its 2026-08-08 full-budget run closed that line of work: every
 *   npm/pip blank that still HAS a repo has now been put through the
 *   registry-agreement resolver, and the ready-to-write queue is empty (361
 *   attempted, 15 repo-agreed, 0 with a proven entry point). The remaining gap
 *   is not resolvable by that pipeline, because those entries have no repo to
 *   resolve against in the first place.
 *
 *   Sorting them by what a visitor can actually DO on the page produces a class
 *   no existing sweep names:
 *
 *     no github_url  AND  no install_command  AND  no website_url
 *
 *   A page like that offers a name, an author, a description and a category —
 *   and no link, no command, no site. There is nothing to click and nothing to
 *   run. Call it a phantom listing.
 *
 * THE PART THAT IS ACTIVELY WRONG, NOT MERELY EMPTY
 *   Most phantoms still carry a `stars` count. Stars are a GitHub metric. An
 *   entry with `github_url: null` and `verification: 'unresolved'` has no
 *   GitHub repository by the catalog's own admission, so a star count on it
 *   cannot have been read from anywhere — it is asserted popularity for
 *   software whose existence the catalog could not confirm.
 *
 *   That number is not cosmetic. `src/lib/mcp/server.ts` serves `stars` over
 *   the MCP API, so an agent asking this catalog which server to use is handed
 *   a fabricated popularity signal as fact — on a property whose entire
 *   positioning is that it verifies rather than ranks by popularity.
 *
 * WHAT THIS SWEEP DOES ABOUT IT
 *   Detects, then tries to REPAIR before it flags. A phantom is not
 *   automatically fictional: PostHog, Appwrite and Storyblok all ship real MCP
 *   servers, and the catalog simply lost the link. So each phantom gets one
 *   more resolution attempt, on evidence this catalog has not tried for these
 *   rows before:
 *
 *     1. npm SEARCH (not just name-guessing): query the registry's search API
 *        for the entry's base name plus "mcp", and accept a package only when
 *        it declares a GitHub repo, its own text mentions MCP, and its name
 *        shares a meaningful token with the entry.
 *     2. GitHub repo SEARCH: same acceptance bar, against repo name and
 *        description.
 *
 *   Every accepted candidate is then confirmed against the GitHub API itself,
 *   which is where the replacement `stars` value comes from. A repaired entry
 *   therefore gets a real link AND a real number in the same step; nothing is
 *   copied over from the fabricated one.
 *
 *   Anything that clears neither bar stays phantom and is reported so the
 *   applier can strip the invented star count. An honest blank beats a
 *   confident number — the same rule the rest of this catalog's tooling runs on.
 *
 * READ-ONLY. `apply-phantom-fixes.mts` does the writing, from this report.
 *
 * Usage:
 *   node --experimental-strip-types scripts/phantom-listing-sweep.mts
 *     [--resolve]      attempt npm/GitHub resolution (network)
 *     [--budget N]     max entries to attempt resolution on (default 500)
 *     [--limit N]      cap the printed listing
 *     [--json]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { servers, type MCPServer } from '../src/data/servers.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_FILE = join(__dirname, '.phantom-listing-report.json');
const STATE_FILE = join(__dirname, '.phantom-resolve-state.json');

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const val = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const RESOLVE = flag('resolve');
const BUDGET = Number(val('budget') ?? '500') || 500;
const LIMIT = Number(val('limit') ?? '0') || 0;
const AS_JSON = flag('json');

/* GitHub search is 30 req/min authenticated — far tighter than the 5,000/hr
   core quota, and the reason this run is paced and checkpointed. */
const SEARCH_GAP_MS = 2_200;
const REPO_GAP_MS = 900;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** No GITHUB_TOKEN lives in this environment; `gh auth token` is the source. */
function githubToken(): string {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execSync('gh auth token', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}
const TOKEN = RESOLVE ? githubToken() : '';

const NOISE = new Set([
  'mcp', 'server', 'servers', 'api', 'the', 'io', 'js', 'py', 'app', 'co', 'com',
  'official', 'tool', 'tools', 'client', 'integration', 'connector',
]);
function tokens(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !NOISE.has(t));
}

const MIN_SUBSTRING_TOKEN = 6;
/** Same bar the install-command applier uses: one shared meaningful token,
 *  with containment allowed only for tokens long enough to mean something. */
function coheres(entryTokens: string[], otherText: string): boolean {
  const other = tokens(otherText);
  if (!entryTokens.length || !other.length) return false;
  return entryTokens.some((e) =>
    other.some((r) => {
      if (r === e) return true;
      if (Math.min(r.length, e.length) < MIN_SUBSTRING_TOKEN) return false;
      return r.includes(e) || e.includes(r);
    }),
  );
}

const mentionsMcp = (s: string) => /\bmcp\b|model[\s-]context[\s-]protocol/i.test(s ?? '');

/**
 * The entry's BRAND token — the first meaningful token of the slug. This is the
 * one word a correct match cannot be missing.
 *
 * The first pass of this resolver did not have this gate and it accepted four
 * matches, all wrong, in the first six attempts:
 *   posthog-mcp          -> PostHog/posthog-js            (the JS SDK)
 *   appwrite-mcp         -> appwrite/sdk-for-cli          (the CLI)
 *   newrelic-mcp         -> newrelic-experimental/preflight
 *   tesla-vehicle-api-mcp-> cyanheads/nhtsa-vehicle-safety-mcp-server
 * The first three are the right ORGANISATION shipping different software; the
 * fourth matched on the shared word "vehicle" while being a different vendor
 * entirely. Generic token overlap is precisely how this catalog acquired its
 * bad URLs in the first place, so the bar is now two-sided: the candidate must
 * carry the brand AND describe itself as an MCP server.
 */
function brandToken(s: MCPServer): string | null {
  const t = tokens(s.slug);
  return t[0] ?? tokens(s.name)[0] ?? null;
}

/** Brand present in the repo path (owner or name), exact or as a long substring. */
function carriesBrand(brand: string, ownerOrName: string): boolean {
  const parts = tokens(ownerOrName);
  return parts.some((p) => p === brand || (Math.min(p.length, brand.length) >= MIN_SUBSTRING_TOKEN && (p.includes(brand) || brand.includes(p))));
}

/**
 * A candidate repo is only this entry's software when BOTH hold:
 *   - the repo itself says it is an MCP server (name/description/topics), and
 *   - the repo path carries the entry's brand token.
 * `PostHog/mcp` passes (owner carries the brand, name says mcp). `PostHog/posthog-js`
 * fails the first test; `cyanheads/nhtsa-...` fails the second.
 */
function repoIsThisEntry(
  brand: string,
  fullName: string,
  description: string,
  topics = '',
  vendorOwned = false,
): boolean {
  const [owner, repoName = ''] = fullName.split('/');
  // The REPO NAME must say MCP — not the description, not the topics. An
  // organisation's main monorepo mentions MCP all over its metadata the moment
  // it ships an MCP server, which is how `PostHog/posthog` (37,563 stars, the
  // whole analytics product) was accepted for `posthog-mcp` on the previous
  // pass. `PostHog/mcp` is the actual server. Requiring the name to carry it
  // separates the two with no judgement call.
  if (!mentionsMcp(repoName)) return false;
  if (!mentionsMcp(`${fullName} ${description} ${topics}`)) return false;
  // Attribution guard: an entry crediting a named vendor may only be linked to
  // a repo under that vendor's own account. A stranger's re-implementation may
  // well be the best MCP server for that product, but publishing it under the
  // vendor's name is a mis-attribution, and `xata-mcp` (author `xataio`) was
  // one step from pointing at an unrelated user's 0-star repo.
  if (vendorOwned) return carriesBrand(brand, owner);
  return carriesBrand(brand, owner) || carriesBrand(brand, repoName);
}

/** `community` is the catalog's placeholder author; anything else names a vendor. */
const isVendorAttributed = (s: MCPServer) => !/^community$/i.test(String(s.author ?? '').trim());

const isBlank = (c?: string) => !c || !String(c).trim();

interface Repaired {
  github_url: string;
  stars: number;
  archived: boolean;
  via: 'npm-search' | 'github-search';
  evidence: string;
}
interface Finding {
  slug: string;
  name: string;
  author: string;
  install_type: MCPServer['install_type'];
  claimedStars: number;
  severity: 'critical' | 'high';
  repaired?: Repaired;
  note: string;
}

async function fetchJSON(url: string, auth = false): Promise<any | null> {
  try {
    const headers: Record<string, string> = { 'user-agent': 'mymcptools-phantom-listing-sweep' };
    if (auth && TOKEN) headers.authorization = `Bearer ${TOKEN}`;
    if (auth) headers.accept = 'application/vnd.github+json';
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function ghIdentity(url: string | null | undefined) {
  const m = String(url ?? '').match(/github\.com[/:]+([^/]+)\/([^/#?]+)/i);
  if (!m) return null;
  return { owner: m[1], name: m[2].replace(/\.git$/i, '').replace(/#.*$/, '') };
}

/** The base a search should look for: the entry name minus MCP boilerplate. */
function searchBase(s: MCPServer): string {
  return s.name
    .replace(/\bmcp\b/gi, ' ')
    .replace(/\bserver\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim() || s.slug.replace(/-mcp$/, '');
}

/** Confirm a candidate repo on the GitHub API — existence, archived state, and
 *  the star count that will replace the fabricated one. */
async function confirmRepo(owner: string, name: string) {
  const doc = await fetchJSON(`https://api.github.com/repos/${owner}/${name}`, true);
  await sleep(REPO_GAP_MS);
  if (!doc || !doc.full_name) return null;
  return {
    url: `https://github.com/${doc.full_name}`,
    stars: Number(doc.stargazers_count ?? 0),
    archived: !!doc.archived,
    description: String(doc.description ?? ''),
    fullName: String(doc.full_name),
  };
}

async function resolveViaNpm(s: MCPServer, brand: string, vendorOwned: boolean): Promise<Repaired | null> {
  const q = encodeURIComponent(`${searchBase(s)} mcp`);
  const doc = await fetchJSON(`https://registry.npmjs.org/-/v1/search?text=${q}&size=10`);
  if (!doc?.objects?.length) return null;

  for (const o of doc.objects) {
    const pkg = o?.package ?? {};
    const pkgName = String(pkg.name ?? '');
    const text = `${pkgName} ${pkg.description ?? ''} ${(pkg.keywords ?? []).join(' ')}`;
    if (!mentionsMcp(text)) continue;
    // The PACKAGE has to carry the brand too — an MCP package for other
    // software is not this entry no matter how well the search ranked it.
    if (!carriesBrand(brand, pkgName)) continue;
    const id = ghIdentity(pkg.links?.repository ?? pkg.repository ?? '');
    if (!id) continue;
    const repo = await confirmRepo(id.owner, id.name);
    if (!repo) continue;
    // A package can declare a monorepo or SDK it merely lives inside, so the
    // repo it points at must independently pass the same two-sided test.
    if (!repoIsThisEntry(brand, repo.fullName, repo.description, '', vendorOwned)) continue;
    return {
      github_url: repo.url,
      stars: repo.stars,
      archived: repo.archived,
      via: 'npm-search',
      evidence: `npm package "${pkgName}" mentions MCP and declares ${repo.fullName}, confirmed live on the GitHub API`,
    };
  }
  return null;
}

async function resolveViaGithubSearch(s: MCPServer, brand: string, vendorOwned: boolean): Promise<Repaired | null> {
  const base = searchBase(s);
  const q = encodeURIComponent(`${base} mcp in:name,description`);
  const doc = await fetchJSON(
    `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=10`,
    true,
  );
  await sleep(SEARCH_GAP_MS);
  if (!doc?.items?.length) return null;

  for (const item of doc.items) {
    const full = String(item.full_name ?? '');
    const desc = String(item.description ?? '');
    const topics = Array.isArray(item.topics) ? item.topics.join(' ') : '';
    if (!repoIsThisEntry(brand, full, desc, topics, vendorOwned)) continue;
    // Awesome-lists and directories rank highly for exactly these queries and
    // are never the server itself.
    if (/\bawesome\b|\bcollection\b|\blist\b|\bdirectory\b/i.test(`${full} ${desc}`)) continue;
    return {
      github_url: `https://github.com/${full}`,
      stars: Number(item.stargazers_count ?? 0),
      archived: !!item.archived,
      via: 'github-search',
      evidence: `GitHub repo ${full} names this entry and describes an MCP server ("${desc.slice(0, 90)}")`,
    };
  }
  return null;
}

async function main() {
  const phantoms = servers.filter(
    (s) => !s.github_url && isBlank(s.install_command) && !s.website_url,
  );

  const state: Record<string, Repaired | { unresolved: true }> = existsSync(STATE_FILE)
    ? JSON.parse(readFileSync(STATE_FILE, 'utf8'))
    : {};

  // Highest claimed stars first: those are the rows asserting the loudest, and
  // the most likely to be a real project whose link was simply lost.
  const ordered = [...phantoms].sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
  const findings: Finding[] = [];
  let attempted = 0;

  for (const s of ordered) {
    const claimedStars = s.stars ?? 0;
    let repaired: Repaired | undefined;

    if (RESOLVE) {
      const cached = state[s.slug];
      if (cached && 'github_url' in cached) {
        repaired = cached;
      } else if (!cached && attempted < BUDGET) {
        attempted++;
        const brand = brandToken(s);
        repaired = !brand
          ? undefined
          : ((await resolveViaNpm(s, brand, isVendorAttributed(s))) ??
             (await resolveViaGithubSearch(s, brand, isVendorAttributed(s))) ??
             undefined);
        state[s.slug] = repaired ?? { unresolved: true };
        writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
      }
    }

    findings.push({
      slug: s.slug,
      name: s.name,
      author: s.author,
      install_type: s.install_type,
      claimedStars,
      severity: claimedStars > 0 ? 'critical' : 'high',
      repaired,
      note: repaired
        ? `REPAIRABLE — ${repaired.evidence}. Real star count is ${repaired.stars}${
            claimedStars ? ` (catalog claims ${claimedStars})` : ''
          }.`
        : claimedStars > 0
          ? `Phantom listing: no repo, no install command, no website — yet the entry asserts ${claimedStars} GitHub stars, a number that cannot have been read from anywhere. Served as fact over the MCP API.`
          : 'Phantom listing: no repo, no install command, no website. The page gives a reader no path to any artifact.',
    });
  }

  const repairable = findings.filter((f) => f.repaired);
  const fabricatedStars = findings.filter((f) => !f.repaired && f.claimedStars > 0);

  const report = {
    generated_at: new Date().toISOString(),
    catalog_entries: servers.length,
    phantom_listings: phantoms.length,
    phantom_pct: Math.round((phantoms.length / servers.length) * 1000) / 10,
    resolve_attempted: attempted,
    repairable: repairable.length,
    fabricated_star_counts: fabricatedStars.length,
    findings,
  };
  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  if (AS_JSON) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\nPHANTOM LISTING SWEEP`);
  console.log(`  catalog entries ............... ${servers.length}`);
  console.log(`  phantom listings .............. ${phantoms.length} (${report.phantom_pct}% — no repo, no command, no site)`);
  console.log(`  ... asserting a star count .... ${findings.filter((f) => f.claimedStars > 0).length}`);
  console.log(`  resolution attempted .......... ${attempted}`);
  console.log(`  REPAIRABLE (real repo found) .. ${repairable.length}`);
  console.log(`  fabricated stars to strip ..... ${fabricatedStars.length}\n`);

  console.log(`REPAIRABLE (${repairable.length}):`);
  for (const f of repairable) {
    console.log(`  ${f.slug.padEnd(28)} ${f.repaired!.github_url}  ${f.claimedStars}★ claimed -> ${f.repaired!.stars}★ real  [${f.repaired!.via}]`);
  }

  console.log(`\nPHANTOM, UNREPAIRED (showing ${LIMIT || 25}):`);
  for (const f of findings.filter((x) => !x.repaired).slice(0, LIMIT || 25)) {
    console.log(`  [${f.severity}] ${f.slug.padEnd(28)} claims ${String(f.claimedStars).padStart(5)}★  by ${f.author}`);
  }
  console.log(`\nreport: ${REPORT_FILE}`);
}

main();
