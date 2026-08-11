/**
 * refresh-stars.mts — make `stars` in servers.ts mean something.
 *
 * Two failure modes this fixes, both of which the /servers pages render as a
 * trust signal:
 *
 *   1. FABRICATED — `stars` set on an entry whose `github_url` is null. There is
 *      no repository, so there is no star count; the number was invented by an
 *      earlier bulk-generation pass. These are deleted, not zeroed: absent is
 *      honest, `stars: 0` reads as "nobody starred it".
 *   2. STALE/WRONG — `stars` set on an entry with a real, verified repo but
 *      diverging from the live GitHub count, often by an order of magnitude
 *      (alchemy-mcp claimed 420 against a real 88; resend-mcp 920 against 559).
 *
 * Same rule as `source_verified` and `install_verified`: a number we present as
 * fact has to be one the GitHub API confirmed.
 *
 * Deliberately paced at ~4 req/s. An earlier sweep at 80ms tripped GitHub's
 * *secondary* rate limit, which is not the 5,000/hr primary quota and is not
 * reported by `x-ratelimit-remaining`.
 *
 *   GH_TOKEN=$(gh auth token) node scripts/refresh-stars.mts [--dry-run] [--limit N]
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SERVERS = new URL('../src/data/servers.ts', import.meta.url).pathname;
const DRY = process.argv.includes('--dry-run');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

const token = process.env.GH_TOKEN;
if (!token) {
  console.error('GH_TOKEN is required — run with GH_TOKEN=$(gh auth token).');
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** owner/repo out of a github.com URL, including deep /tree/... monorepo links. */
function ownerRepo(url: string): string | null {
  const m = url.match(/github\.com\/([^/#?]+)\/([^/#?]+)/);
  if (!m) return null;
  return `${m[1]}/${m[2].replace(/\.git$/, '')}`;
}

type Entry = { slug: string; block: string; start: number; end: number };

function parseEntries(src: string): Entry[] {
  const out: Entry[] = [];
  const re = /\n  \{\n    slug: '([^']+)',/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    // Entry blocks are uniformly indented; the terminator is a 2-space `},`.
    const end = src.indexOf('\n  },\n', m.index);
    if (end === -1) continue;
    out.push({ slug: m[1], block: src.slice(m.index, end), start: m.index, end });
  }
  return out;
}

const src = readFileSync(SERVERS, 'utf8');
const entries = parseEntries(src);
console.log(`Parsed ${entries.length} entries from servers.ts`);

// Pass 1 — fabricated stars (no repo behind them). No network needed.
const fabricated: string[] = [];
// Pass 2 — entries with a real repo, to be checked against the live API.
const checkable: { slug: string; repo: string; claimed: number | null }[] = [];

for (const e of entries) {
  const starsM = e.block.match(/\n    stars: (\d+),/);
  const urlM = e.block.match(/\n    github_url: (?:'([^']+)'|null),/);
  const url = urlM?.[1] ?? null;
  if (!url) {
    if (starsM) fabricated.push(e.slug);
    continue;
  }
  const repo = ownerRepo(url);
  if (repo) checkable.push({ slug: e.slug, repo, claimed: starsM ? Number(starsM[1]) : null });
}

console.log(`  ${fabricated.length} entries carry stars with github_url: null (fabricated)`);
console.log(`  ${checkable.length} entries have a repo to check`);

const corrections = new Map<string, number>();
const gone: string[] = [];
let checked = 0;

for (const c of checkable.slice(0, LIMIT === Infinity ? undefined : LIMIT)) {
  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${c.repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'mymcptools-star-refresh',
      },
      // Never follow renames silently — a stale name resolving 200 against the
      // new repo is exactly how wrong owners survive a verification pass.
      redirect: 'manual',
    });
  } catch {
    continue;
  }
  checked++;
  if (res.status === 403 || res.status === 429) {
    console.warn(`  rate limited at ${checked} — stopping early, rerun to continue`);
    break;
  }
  if (res.status === 404) {
    gone.push(c.slug);
    await sleep(250);
    continue;
  }
  if (res.status >= 300 && res.status < 400) {
    // Renamed. verify-github-entries.mts owns that repair; don't guess here.
    await sleep(250);
    continue;
  }
  if (!res.ok) {
    await sleep(250);
    continue;
  }
  const json = (await res.json()) as { stargazers_count?: number };
  const real = json.stargazers_count;
  // Only correct counts that already exist. Adding one where there was none
  // would stamp the parent repo's total onto every monorepo sub-entry — all
  // seven `modelcontextprotocol/servers` children would claim 89k stars each.
  if (typeof real === 'number' && c.claimed !== null && real !== c.claimed) {
    corrections.set(c.slug, real);
  }
  await sleep(250);
}

console.log(`\nChecked ${checked}; ${corrections.size} star counts wrong; ${gone.length} now 404.`);
for (const [slug, real] of [...corrections].slice(0, 25)) {
  const claimed = checkable.find((c) => c.slug === slug)?.claimed;
  console.log(`  ${slug}: ${claimed ?? '(none)'} -> ${real}`);
}
if (corrections.size > 25) console.log(`  ... and ${corrections.size - 25} more`);

if (DRY) {
  console.log('\n--dry-run: servers.ts not written.');
  process.exit(0);
}

// Rewrite back-to-front so earlier offsets stay valid.
let out = src;
const fabricatedSet = new Set(fabricated);
for (const e of [...entries].reverse()) {
  let block = e.block;
  if (fabricatedSet.has(e.slug)) {
    block = block.replace(/\n    stars: \d+,/, '');
  } else if (corrections.has(e.slug)) {
    block = block.replace(/\n    stars: \d+,/, `\n    stars: ${corrections.get(e.slug)},`);
  } else continue;
  out = out.slice(0, e.start) + block + out.slice(e.end);
}

writeFileSync(SERVERS, out);
console.log(
  `\nWrote servers.ts — ${fabricated.length} fabricated star counts removed, ${corrections.size} corrected.`,
);
