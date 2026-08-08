/**
 * APPLY the phantom-listing sweep's two verdicts to src/data/servers.ts.
 *
 * REPAIRED — a real MCP-server repository was found for the entry and
 *   confirmed on the GitHub API. Writes `github_url`, flips
 *   `source_verified` to true and `verification` to live/archived, and
 *   replaces the fabricated `stars` value with the count the API returned.
 *
 * STILL PHANTOM — nothing was found. Strips the `stars` line.
 *   This is the whole point and it is worth being explicit about: the entry
 *   claims a GitHub popularity number while the catalog itself records
 *   `github_url: null, verification: 'unresolved'`. There is no repository the
 *   number could have come from, so it is not a stale figure to refresh — it
 *   is an assertion with no source. `src/lib/mcp/server.ts` serves it to agents
 *   as `stars`, and `MCPServer.stars` is optional precisely so an entry can
 *   decline to claim one. Removing the line is how the catalog says "unknown".
 *
 * Nothing here invents a value. Every number written came from
 * api.github.com/repos in this run; every number removed had no source at all.
 *
 * Usage: node --experimental-strip-types scripts/apply-phantom-fixes.mts [--write]
 * Dry-run by default.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_FILE = join(__dirname, '.phantom-listing-report.json');
const SERVERS_FILE = join(__dirname, '..', 'src', 'data', 'servers.ts');
const WRITE = process.argv.includes('--write');

interface Finding {
  slug: string;
  name: string;
  claimedStars: number;
  repaired?: { github_url: string; stars: number; archived: boolean; via: string; evidence: string };
}

const report = JSON.parse(readFileSync(REPORT_FILE, 'utf8'));
let src = readFileSync(SERVERS_FILE, 'utf8');

/** Bound an entry's object literal by its slug line and the next one, so an
 *  edit can never leak into a neighbouring entry. */
function entryBlock(slug: string) {
  const re = new RegExp(`\\n(\\s*)slug: '${slug.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}',\\n`);
  const m = re.exec(src);
  if (!m) return null;
  const indent = m[1];
  const start = m.index + 1;
  const nextSlug = src.indexOf(`\n${indent}slug: '`, start + 1);
  return { indent, start, end: nextSlug === -1 ? src.length : nextSlug };
}

const repairedOk: string[] = [];
const strippedOk: string[] = [];
const skipped: { slug: string; why: string }[] = [];

for (const f of report.findings as Finding[]) {
  const b = entryBlock(f.slug);
  if (!b) { skipped.push({ slug: f.slug, why: 'slug line not found' }); continue; }
  let block = src.slice(b.start, b.end);

  if (f.repaired) {
    const { github_url, stars, archived } = f.repaired;
    if (github_url.includes("'")) { skipped.push({ slug: f.slug, why: 'url contains a quote' }); continue; }
    if (!/^\s*github_url: null,$/m.test(block)) {
      skipped.push({ slug: f.slug, why: 'github_url is no longer null — report is stale' });
      continue;
    }
    block = block.replace(/^(\s*)github_url: null,$/m, `$1github_url: '${github_url}',`);
    block = /^\s*source_verified:/m.test(block)
      ? block.replace(/^(\s*)source_verified: .*,$/m, '$1source_verified: true,')
      : block.replace(/^(\s*)github_url: .*,$/m, `$&\n$1source_verified: true,`);
    const verification = archived ? 'archived' : 'live';
    block = /^\s*verification:/m.test(block)
      ? block.replace(/^(\s*)verification: .*,$/m, `$1verification: '${verification}',`)
      : block.replace(/^(\s*)source_verified: .*,$/m, `$&\n$1verification: '${verification}',`);
    block = /^\s*stars:/m.test(block)
      ? block.replace(/^(\s*)stars: .*,$/m, `$1stars: ${stars},`)
      : block;
    repairedOk.push(`${f.slug} -> ${github_url} (${f.claimedStars}★ claimed, ${stars}★ real)`);
  } else {
    if (!/^\s*stars: \d+,$/m.test(block)) continue; // nothing claimed; nothing to strip
    block = block.replace(/^\s*stars: \d+,\n/m, '');
    strippedOk.push(`${f.slug} (was ${f.claimedStars}★)`);
  }

  src = src.slice(0, b.start) + block + src.slice(b.end);
}

console.log(`\nAPPLY PHANTOM FIXES  (${WRITE ? 'WRITE' : 'dry-run'})`);
console.log(`  phantom listings in report ... ${report.phantom_listings}`);
console.log(`  repaired (real repo written) . ${repairedOk.length}`);
console.log(`  fabricated stars stripped .... ${strippedOk.length}`);
console.log(`  skipped ...................... ${skipped.length}\n`);
for (const r of repairedOk) console.log(`  + ${r}`);
if (skipped.length) {
  console.log(`\nSKIPPED (never written):`);
  for (const s of skipped) console.log(`  ! ${s.slug.padEnd(28)} ${s.why}`);
}

if (WRITE) {
  writeFileSync(SERVERS_FILE, src);
  console.log(`\nwrote ${SERVERS_FILE}`);
} else {
  console.log(`\n(dry-run — pass --write to apply)`);
}
