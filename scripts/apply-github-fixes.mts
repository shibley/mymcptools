/**
 * Applies the verify + resolve verdicts to src/data/servers.ts.
 *
 * WHY this is a separate script: detection (verify-github-entries.mts) and
 * resolution (resolve-github-urls.mts) are read-only and re-runnable. This is
 * the only step that mutates the catalog, so it stays small, deterministic and
 * reviewable on its own — you can diff its output without re-hitting any API.
 *
 * Rules, in priority order, per entry:
 *   - explicit override (see OVERRIDES)      → hand-adjudicated result
 *   - resolve verdict "repaired"             → new URL, verification "live"
 *   - resolve verdict "unresolved"           → github_url null, "unresolved"
 *   - verify status ok / ok_low_overlap      → keep URL, verification "live"
 *   - verify status archived                 → keep URL, verification "archived"
 * The invariant it enforces: after this runs, no github_url in the catalog is
 * a URL we know to be dead. Every entry either has a link confirmed live by
 * the GitHub API, or an explicit null plus source_verified:false so downstream
 * trust code can exclude it instead of scoring a phantom.
 *
 * A non-GitHub URL that was sitting in github_url (docs page, npm page — these
 * are usually closed-source remote MCP servers with no public repo) is moved
 * to website_url rather than discarded: it is a real, useful link, it was just
 * in the wrong field.
 *
 * Run: node scripts/apply-github-fixes.mts [--dry-run]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVERS_FILE = join(__dirname, '..', 'src', 'data', 'servers.ts');
const VERIFY_STATE = join(__dirname, '.verify-state.json');
const RESOLVE_STATE = join(__dirname, '.resolve-state.json');

const dryRun = process.argv.includes('--dry-run');

/**
 * Hand-adjudicated entries. The heuristic classifier flagged 10 "mismatch"
 * entries (repo resolves but looks unrelated); 7 of those are false positives
 * — the official modelcontextprotocol/servers reference servers, whose
 * /tree/main/src/<name> subpath is the real identity and which the classifier
 * can't see. The remaining 3 point at a genuinely unrelated repo and are the
 * most actively misleading rows in the catalog, so they are nulled unless a
 * correct repo was confirmed by hand.
 */
const OVERRIDES: Record<string, { url: string | null; verification: string; note: string }> = {
  'feishu-lark-mcp': { url: null, verification: 'unresolved', note: 'pointed at larksuite/oapi-sdk-python — an SDK, not this MCP server' },
  boostsecurity: { url: null, verification: 'unresolved', note: 'pointed at boost-community/boost-mcp — unrelated to BoostSecurity' },
};

const verify = JSON.parse(readFileSync(VERIFY_STATE, 'utf8')) as Record<string, { status: string; github_url: string }>;
const resolve = JSON.parse(readFileSync(RESOLVE_STATE, 'utf8')) as Record<
  string,
  { verdict: string; newUrl?: string; oldUrl: string }
>;

type Decision = { url: string | null; verification: 'live' | 'archived' | 'unresolved'; moveToWebsite?: string };

function decide(slug: string, currentUrl: string): Decision | null {
  // A confirmed replacement always wins: it is stronger evidence than the
  // hand-adjudication below, which exists only to catch entries the automated
  // pass cannot fix.
  const r = resolve[slug];
  if (r?.verdict === 'repaired' && r.newUrl) return { url: r.newUrl, verification: 'live' };

  const ov = OVERRIDES[slug];
  if (ov) return { url: ov.url, verification: ov.verification as Decision['verification'] };

  if (r && r.verdict !== 'repaired') {
    // Dead link with no confirmed replacement. If what was there is a real
    // non-GitHub URL, preserve it as website_url — it is still a valid pointer.
    const keepAsSite = /^https?:\/\//.test(currentUrl) && !/github\.com/i.test(currentUrl) ? currentUrl : undefined;
    return { url: null, verification: 'unresolved', moveToWebsite: keepAsSite };
  }

  const v = verify[slug];
  if (!v) return null;
  if (v.status === 'ok' || v.status === 'ok_low_overlap' || v.status === 'mismatch') return { url: currentUrl, verification: 'live' };
  if (v.status === 'archived') return { url: currentUrl, verification: 'archived' };
  if (v.status === 'disabled' || v.status === 'not_found' || v.status === 'bad_url') {
    const keepAsSite = /^https?:\/\//.test(currentUrl) && !/github\.com/i.test(currentUrl) ? currentUrl : undefined;
    return { url: null, verification: 'unresolved', moveToWebsite: keepAsSite };
  }
  return null;
}

// ---- rewrite ---------------------------------------------------------------
// Line-oriented rather than AST-based: the file is ~34k lines of object
// literals in a stable one-field-per-line shape, and a line pass keeps the
// diff minimal (only the github_url line changes) instead of reformatting the
// entire catalog.
const lines = readFileSync(SERVERS_FILE, 'utf8').split('\n');
const out: string[] = [];
let currentSlug: string | null = null;
const websiteSlugs = new Set<string>();
const stats = { repaired: 0, nulled: 0, live: 0, archived: 0, untouched: 0, websiteMoved: 0 };

// A slug's entry may declare website_url before or after github_url, so
// pre-scan which slugs already have one to avoid emitting a duplicate key.
{
  let s: string | null = null;
  for (const line of lines) {
    const m = line.match(/^\s*slug: '([^']+)',/);
    if (m) s = m[1];
    if (s && /^\s*website_url:/.test(line)) websiteSlugs.add(s);
  }
}

for (const line of lines) {
  const slugMatch = line.match(/^\s*slug: '([^']+)',/);
  if (slugMatch) currentSlug = slugMatch[1];

  const ghMatch = line.match(/^(\s*)github_url: '([^']*)',\s*$/);
  if (ghMatch && currentSlug) {
    const [, indent, url] = ghMatch;
    const d = decide(currentSlug, url);
    if (!d) {
      stats.untouched++;
      out.push(line);
      continue;
    }
    if (d.url === null) {
      out.push(`${indent}github_url: null,`);
      out.push(`${indent}source_verified: false,`);
      out.push(`${indent}verification: 'unresolved',`);
      if (d.moveToWebsite && !websiteSlugs.has(currentSlug)) {
        out.push(`${indent}website_url: '${d.moveToWebsite}',`);
        stats.websiteMoved++;
      }
      stats.nulled++;
    } else {
      out.push(`${indent}github_url: '${d.url}',`);
      out.push(`${indent}source_verified: true,`);
      out.push(`${indent}verification: '${d.verification}',`);
      if (d.url !== url) stats.repaired++;
      else if (d.verification === 'archived') stats.archived++;
      else stats.live++;
    }
    continue;
  }
  out.push(line);
}

const result = out.join('\n');
console.log('[apply]', stats);
if (dryRun) {
  console.log('[apply] dry run — no write');
} else {
  writeFileSync(SERVERS_FILE, result);
  console.log('[apply] wrote', SERVERS_FILE);
}
