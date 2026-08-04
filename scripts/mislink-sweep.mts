/**
 * Offline MIS-LINK detector for the catalog (src/data/servers.ts).
 *
 * WHY THIS EXISTS (and why verify-github-entries.mts cannot do it):
 * The 2026-08-03 fire found two entries whose `github_url` resolved 200 to a
 * real, well-known repo that had nothing to do with the product on the page —
 * and each had inherited that repo's star count as if it were its own traction
 * signal:
 *
 *   slug `remote-mcp`  ("Remote.com HR MCP")  ->  geelen/mcp-remote
 *   slug `aws-s3`      ("AWS S3")             ->  aws/mcp-proxy-for-aws
 *
 * Neither would ever fail a 404 sweep. Worse, the existing verifier scored
 * `aws-s3` a clean **'ok'** despite an overlapScore of 0.06, because its
 * `authorMatch` test ("aws-samples" ~ owner "aws") rescues the entry, and
 * because it folds the *repo description* into the comparison — "AWS MCP Proxy
 * Server" happens to contain "aws". `remote-mcp` landed in 'ok_low_overlap',
 * which is a 307-entry bucket nobody triages. So the signal existed and was
 * structurally unable to surface.
 *
 * WHAT THIS DOES DIFFERENTLY
 *   1. OFFLINE. No GitHub API, no rate limit, no resume state — it reads
 *      servers.ts and finishes in under a second over all entries. The
 *      verifier has managed 1,010 of ~2,470 since July and is quota-bound;
 *      a correctness check should not be gated on that.
 *   2. Compares IDENTITY only: {slug + name} vs {owner + repo path}. The repo
 *      description is deliberately excluded — that is the channel that let
 *      aws-s3 pass.
 *   3. `authorMatch` DOWNGRADES severity but never clears a finding. A vendor
 *      owning the repo says nothing about whether it is *this* product's repo;
 *      vendors publish many repos. That is precisely the aws-s3 shape.
 *   4. Ranks by severity so the top of the list is worth a human minute:
 *        critical — zero identity overlap AND the repo path carries a
 *                   distinctive token that belongs to a DIFFERENT catalog
 *                   entry (i.e. we can name the product it actually is)
 *        high     — zero identity overlap, owner does not match author
 *        medium   — zero identity overlap but owner matches author
 *        low      — partial overlap below threshold
 *
 * STRICTLY READ-ONLY. It never edits servers.ts. Remediation is manual, one
 * entry at a time, with the repo actually opened — the same discipline the
 * fabricated-URL cleanup uses.
 *
 * Usage: node scripts/mislink-sweep.mts [--min critical|high|medium|low]
 *                                       [--limit N] [--json]
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { servers } from '../src/data/servers.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_FILE = join(__dirname, '.mislink-report.json');

const args = process.argv.slice(2);
const argVal = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const asJson = args.includes('--json');
const limit = Number(argVal('--limit') ?? 60);
const minSeverity = (argVal('--min') ?? 'medium') as Severity;

type Severity = 'critical' | 'high' | 'medium' | 'low';
const RANK: Record<Severity, number> = { critical: 3, high: 2, medium: 1, low: 0 };

/**
 * Tokens that carry no identity. Anything ecosystem-generic goes here: if
 * "mcp" counted as a match every entry in the catalog would look fine, since
 * roughly every repo in it is named `*-mcp` or `mcp-*`.
 */
const NOISE = new Set([
  'mcp', 'mcps', 'model', 'context', 'protocol', 'server', 'servers', 'serve',
  'client', 'tool', 'tools', 'toolkit', 'api', 'apis', 'sdk', 'integration',
  'integrations', 'official', 'unofficial', 'open', 'source', 'app', 'plugin',
  'connector', 'bridge', 'proxy', 'gateway', 'service', 'core', 'main', 'dev',
  'com', 'www', 'github', 'the', 'and', 'for', 'with', 'ai', 'llm', 'agent',
  'agents', 'claude', 'anthropic', 'python', 'typescript', 'node', 'js', 'ts',
  'labs', 'inc', 'io', 'co', 'samples', 'sample', 'example', 'examples',
  'awesome', 'community', 'contrib', 'public', 'org', 'project', 'lib',
]);

function tokens(s: string): string[] {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 3 && !NOISE.has(t));
}

/** owner/repo out of a github URL, or null if it isn't one. */
function ownerRepo(url: string | null | undefined): { owner: string; repo: string } | null {
  if (!url) return null;
  const m = url.match(/github\.com\/([^/#?]+)\/([^/#?]+)/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, '') };
}

/**
 * Fuzzy containment, so `postgres` vs `postgresql` and `notion` vs `notionhq`
 * are matches rather than findings. Substring in either direction on tokens of
 * 4+ chars; exact otherwise (short tokens like `s3` or `gcp` substring-match
 * far too eagerly).
 */
function related(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4) return a.includes(b) || b.includes(a);
  return false;
}
function anyRelated(claim: string[], repo: string[]): boolean {
  return claim.some((c) => repo.some((r) => related(c, r)));
}

// ---- Build a token -> owning-slug index so we can NAME the other product ---
// If an entry's repo path carries a distinctive token that is the identity of
// a *different* catalog entry, the mis-link is nameable and therefore worth
// looking at first. `aws-s3 -> aws/mcp-proxy-for-aws` is exactly this shape.
const tokenOwners = new Map<string, string[]>();
for (const s of servers as any[]) {
  for (const t of new Set(tokens(s.slug))) {
    if (!tokenOwners.has(t)) tokenOwners.set(t, []);
    tokenOwners.get(t)!.push(s.slug);
  }
}

interface Finding {
  slug: string;
  name: string;
  author: string | null;
  github_url: string;
  ownerRepo: string;
  severity: Severity;
  overlap: number;
  authorMatchesOwner: boolean;
  looksLike: string[];
  stars: number | null;
  reason: string;
}

const findings: Finding[] = [];
let scanned = 0;
let noUrl = 0;
let unparseable = 0;

for (const s of servers as any[]) {
  const or = ownerRepo(s.github_url);
  if (!s.github_url) { noUrl++; continue; }
  if (!or) { unparseable++; continue; }
  scanned++;

  const claim = [...new Set([...tokens(s.slug), ...tokens(s.name)])];
  const repoTok = [...new Set([...tokens(or.owner), ...tokens(or.repo)])];

  // Nothing distinctive on either side — can't judge, don't cry wolf.
  if (claim.length === 0 || repoTok.length === 0) continue;

  const hits = claim.filter((c) => repoTok.some((r) => related(c, r))).length;
  const overlap = Number((hits / claim.length).toFixed(2));
  if (overlap >= 0.34) continue; // a third of the identity matched — fine

  const authorMatchesOwner = !!s.author && anyRelated(tokens(s.author), tokens(or.owner));

  // Which OTHER catalog entries does this repo path look like?
  const looksLike = [
    ...new Set(
      repoTok.flatMap((t) => tokenOwners.get(t) ?? []).filter((other) => other !== s.slug),
    ),
  ].slice(0, 4);

  let severity: Severity;
  let reason: string;
  if (overlap === 0 && looksLike.length > 0) {
    severity = 'critical';
    reason = `repo path "${or.owner}/${or.repo}" shares no token with "${s.slug}"/"${s.name}" but matches other catalog entries: ${looksLike.join(', ')}`;
  } else if (overlap === 0 && !authorMatchesOwner) {
    severity = 'high';
    reason = `repo path "${or.owner}/${or.repo}" shares no token with "${s.slug}"/"${s.name}" and owner does not match author "${s.author}"`;
  } else if (overlap === 0) {
    severity = 'medium';
    reason = `no identity overlap with "${or.owner}/${or.repo}"; owner matches author "${s.author}" — vendor-owned but possibly the WRONG repo of that vendor (the aws-s3 shape)`;
  } else {
    severity = 'low';
    reason = `weak identity overlap (${overlap}) with "${or.owner}/${or.repo}"`;
  }

  findings.push({
    slug: s.slug,
    name: s.name,
    author: s.author ?? null,
    github_url: s.github_url,
    ownerRepo: `${or.owner}/${or.repo}`,
    severity,
    overlap,
    authorMatchesOwner,
    looksLike,
    stars: typeof s.stars === 'number' ? s.stars : null,
    reason,
  });
}

findings.sort(
  (a, b) => RANK[b.severity] - RANK[a.severity] || (b.stars ?? 0) - (a.stars ?? 0),
);

const counts = findings.reduce<Record<string, number>>((acc, f) => {
  acc[f.severity] = (acc[f.severity] ?? 0) + 1;
  return acc;
}, {});

/**
 * SECOND DETECTOR — repos claimed by several entries with DIFFERENT star counts.
 *
 * Found while triaging the first detector's output and it turned out to be the
 * larger problem: 55 repos were claimed by 2-5 entries each, and those entries
 * disagreed with each other about how many stars the SAME repo had — n8n-mcp
 * was listed as both 1,100 and 2,340 (really 22,587), netlify-mcp as 1,876
 * (really 53), calendly-mcp as 723 (really 9).
 *
 * Two entries pointing at one repo can be legitimate (a monorepo like
 * microsoft/mcp or modelcontextprotocol/servers genuinely hosts many servers).
 * Two entries DISAGREEING about that repo's star count cannot be — at most one
 * is right, and it proves the numbers were not read from GitHub. It needs no
 * network call to detect, which is the whole point: it is a pure internal
 * consistency check the API-bound verifier would never think to run.
 */
interface DupeFinding {
  repo: string;
  entries: { slug: string; stars: number | null }[];
  distinctStarClaims: number[];
}
const byRepo = new Map<string, { slug: string; stars: number | null }[]>();
for (const s of servers as any[]) {
  const or = ownerRepo(s.github_url);
  if (!or) continue;
  const key = `${or.owner}/${or.repo}`.toLowerCase();
  if (!byRepo.has(key)) byRepo.set(key, []);
  byRepo.get(key)!.push({ slug: s.slug, stars: typeof s.stars === 'number' ? s.stars : null });
}
const starConflicts: DupeFinding[] = [];
for (const [repo, list] of byRepo) {
  const claims = [...new Set(list.map((e) => e.stars).filter((v): v is number => v != null))];
  if (claims.length > 1) {
    starConflicts.push({ repo, entries: list, distinctStarClaims: claims.sort((a, b) => a - b) });
  }
}
starConflicts.sort((a, b) => b.entries.length - a.entries.length);

const report = {
  generatedAt: new Date().toISOString(),
  totalEntries: (servers as any[]).length,
  scanned,
  withoutGithubUrl: noUrl,
  unparseableUrl: unparseable,
  counts,
  findings,
  starConflicts,
};
writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2) + '\n');

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`\n[mislink] ${(servers as any[]).length} entries · ${scanned} with a parseable github_url · ${noUrl} without one`);
  console.log(`[mislink] critical=${counts.critical ?? 0} high=${counts.high ?? 0} medium=${counts.medium ?? 0} low=${counts.low ?? 0}`);
  console.log(`[mislink] report -> ${REPORT_FILE}\n`);
  const shown = findings.filter((f) => RANK[f.severity] >= RANK[minSeverity]).slice(0, limit);
  for (const f of shown) {
    console.log(`${f.severity.toUpperCase().padEnd(8)} ${f.slug}  (${f.name})`);
    console.log(`         -> ${f.ownerRepo}${f.stars != null ? `  ${f.stars}★` : ''}`);
    console.log(`         ${f.reason}`);
  }
  const hidden = findings.filter((f) => RANK[f.severity] >= RANK[minSeverity]).length - shown.length;
  if (hidden > 0) console.log(`\n[mislink] +${hidden} more at or above "${minSeverity}" (raise --limit)`);

  console.log(`\n[mislink] STAR CONFLICTS: ${starConflicts.length} repo(s) claimed by multiple entries that disagree on the star count`);
  for (const c of starConflicts.slice(0, limit)) {
    console.log(`  ${c.repo}  claims=[${c.distinctStarClaims.join(', ')}]`);
    console.log(`    ${c.entries.map((e) => `${e.slug}=${e.stars ?? 'null'}`).join('  ')}`);
  }
}
