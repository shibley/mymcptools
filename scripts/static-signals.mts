/**
 * Static health-signal builder for local/stdio servers (PRD P1-3).
 *
 * The MCP-handshake prober (scripts/mcp-probe.mts) can only verify *remote*
 * servers. The vast majority of the catalog is local/stdio (npm/pip/binary/
 * source/container) with no remote endpoint — those are recorded UNPROBEABLE
 * and have no live verdict to show. This script gives them a meaningful
 * *static* signal instead: repo recency (last push ≈ last commit) and last
 * GitHub release, plus the package registry/name parsed from the install
 * command.
 *
 * STRICTLY READ-ONLY against external sources. It only issues GET requests to
 * the GitHub REST API (repo + latest-release). It never installs, runs, or
 * invokes any server or its tools. All external data is treated as untrusted:
 * only specific scalar fields are read, validated, and persisted.
 *
 * Resilience:
 *   - Uses GITHUB_TOKEN when present (5000 req/h) and degrades gracefully to
 *     unauthenticated (60 req/h) — on rate-limit it stops fetching new repos
 *     and preserves prior data rather than wiping it.
 *   - Idempotent: merges onto the existing static-signals.json, so a partial
 *     run (limit/sample/rate-limit) keeps previously-fetched signals intact.
 *   - A single repo's fetch failure is recorded as `error` and never aborts.
 *
 * Output: src/data/static-signals.json (StaticSignalStore).
 *
 * Run: node scripts/static-signals.mts [--limit N] [--slug s1,s2] [--force]
 *      [--max-age-hours H]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { servers } from '../src/data/servers.ts';
import type {
  InventoryEntry,
  StaticSignal,
  StaticSignalStore,
} from '../src/lib/trust/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'src', 'data');
const INVENTORY = join(DATA, 'probe-inventory.json');
const OUT = join(DATA, 'static-signals.json');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const USER_AGENT = 'mymcptools-static-signals/0.1.0';
const FETCH_TIMEOUT_MS = 12_000;
const REQUEST_GAP_MS = GITHUB_TOKEN ? 80 : 1200; // polite throttle; slower unauth

// ---- CLI args -------------------------------------------------------------
const args = process.argv.slice(2);
function argVal(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}
const limit = argVal('--limit') ? Number(argVal('--limit')) : undefined;
const slugFilter = argVal('--slug')?.split(',').map((s) => s.trim());
const force = args.includes('--force');
// Skip repos refreshed within this window unless --force (idempotent re-runs).
const maxAgeHours = Number(argVal('--max-age-hours') ?? 72);

// ---- helpers --------------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Parse github.com owner/repo from a catalog URL. Tolerates /tree/... paths. */
function parseRepo(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)github\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, '');
    if (!owner || !repo) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}

/** Best-effort package name from an install command (untrusted; scalar only). */
function parsePackageName(installType: string, cmd: string | undefined): string | undefined {
  if (!cmd) return undefined;
  const tokens = cmd.trim().split(/\s+/);
  if (installType === 'npm') {
    // npx <pkg> / npm i -g <pkg>
    for (const t of tokens) {
      if (t.startsWith('@') || (/^[a-z0-9][\w.-]*$/i.test(t) && !['npx', 'npm', '-y', 'install', 'i', '-g', '--yes', '--package'].includes(t))) {
        if (t === 'npx' || t === 'npm') continue;
        return t.slice(0, 120);
      }
    }
  } else if (installType === 'pip') {
    for (const t of tokens) {
      if (/^[a-z0-9][\w.-]*$/i.test(t) && !['pip', 'pip3', 'install', 'uvx', 'uv', 'python', '-m', 'run'].includes(t)) {
        return t.slice(0, 120);
      }
    }
  } else if (installType === 'docker') {
    const i = tokens.findIndex((t) => t === 'run' || t === 'pull');
    if (i >= 0) {
      const img = tokens.slice(i + 1).find((t) => !t.startsWith('-'));
      if (img) return img.slice(0, 160);
    }
  }
  return undefined;
}

interface GhResult {
  last_commit_at: string | null;
  last_release_at: string | null;
  last_release_tag: string | null;
  error?: string;
  rateLimited?: boolean;
}

async function ghFetch(path: string): Promise<{ ok: boolean; status: number; json: unknown; rateLimited: boolean }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': USER_AGENT,
        'x-github-api-version': '2022-11-28',
        ...(GITHUB_TOKEN ? { authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
      },
      signal: ctrl.signal,
    });
    const remaining = res.headers.get('x-ratelimit-remaining');
    const rateLimited =
      (res.status === 403 || res.status === 429) && remaining === '0';
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json, rateLimited };
  } catch (e) {
    return { ok: false, status: 0, json: { message: e instanceof Error ? e.message : String(e) }, rateLimited: false };
  } finally {
    clearTimeout(t);
  }
}

/** Read only specific scalar fields; never trust/execute the response body. */
function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 && v.length < 200 ? v : null;
}

async function fetchSignals(owner: string, repo: string): Promise<GhResult> {
  const repoRes = await ghFetch(`/repos/${owner}/${repo}`);
  if (repoRes.rateLimited) {
    return { last_commit_at: null, last_release_at: null, last_release_tag: null, rateLimited: true, error: 'github rate limit reached' };
  }
  if (!repoRes.ok) {
    const msg = (repoRes.json as { message?: string } | null)?.message ?? `HTTP ${repoRes.status}`;
    return { last_commit_at: null, last_release_at: null, last_release_tag: null, error: `repo: ${msg}` };
  }
  const repoObj = repoRes.json as Record<string, unknown>;
  const last_commit_at = asString(repoObj.pushed_at);

  await sleep(REQUEST_GAP_MS);

  let last_release_at: string | null = null;
  let last_release_tag: string | null = null;
  const relRes = await ghFetch(`/repos/${owner}/${repo}/releases/latest`);
  if (relRes.rateLimited) {
    return { last_commit_at, last_release_at: null, last_release_tag: null, rateLimited: true };
  }
  if (relRes.ok) {
    const rel = relRes.json as Record<string, unknown>;
    last_release_at = asString(rel.published_at);
    last_release_tag = asString(rel.tag_name);
  }
  // 404 = no releases published — not an error, just no release signal.
  return { last_commit_at, last_release_at, last_release_tag };
}

// ---- main -----------------------------------------------------------------
function loadPrev(): Map<string, StaticSignal> {
  try {
    const prev = JSON.parse(readFileSync(OUT, 'utf8')) as StaticSignalStore;
    return new Map(prev.signals.map((s) => [s.slug, s]));
  } catch {
    return new Map();
  }
}

function isFresh(prev: StaticSignal | undefined): boolean {
  if (!prev || prev.error) return false;
  const t = new Date(prev.checked_at).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < maxAgeHours * 3600_000;
}

async function main() {
  const inventory: InventoryEntry[] = JSON.parse(readFileSync(INVENTORY, 'utf8'));
  const serverBySlug = new Map(servers.map((s) => [s.slug, s]));
  const prev = loadPrev();

  let locals = inventory.filter((e) => e.delivery === 'local');
  if (slugFilter) locals = locals.filter((e) => slugFilter.includes(e.slug));
  // Featured/sponsored first so a bounded (limited / rate-limited) run spends
  // its budget on the most valuable listings before the long tail.
  locals.sort((a, b) => {
    const rank = (e: InventoryEntry) => (e.featured ? 0 : e.sponsored ? 1 : 2);
    return rank(a) - rank(b) || a.slug.localeCompare(b.slug);
  });
  if (limit) locals = locals.slice(0, limit);

  console.log(
    `[static] ${locals.length} local servers · token=${GITHUB_TOKEN ? 'yes' : 'no'} ` +
    `· gap=${REQUEST_GAP_MS}ms · max-age=${maxAgeHours}h${force ? ' (force)' : ''}`,
  );

  const signals: StaticSignal[] = [];
  let stopped = false;
  let fetched = 0;
  let skipped = 0;

  for (const entry of locals) {
    const server = serverBySlug.get(entry.slug);
    const repo_url = server?.github_url ?? '';
    const parsed = repo_url ? parseRepo(repo_url) : null;
    const package_registry = server?.install_type;
    const package_name = parsePackageName(server?.install_type ?? '', server?.install_command);

    const prior = prev.get(entry.slug);

    // Idempotent: keep recently-fetched good signals; refresh only stale ones.
    if (!force && !stopped && isFresh(prior) && prior) {
      signals.push({ ...prior, package_registry, package_name, repo_url: repo_url || prior.repo_url });
      skipped++;
      continue;
    }

    if (!parsed) {
      signals.push({
        slug: entry.slug,
        repo_url,
        owner: null,
        repo: null,
        last_commit_at: null,
        last_release_at: null,
        last_release_tag: null,
        package_registry,
        package_name,
        checked_at: new Date().toISOString(),
        error: repo_url ? 'non-github repo URL' : 'no repo URL',
      });
      continue;
    }

    // Once rate-limited, stop hitting the API but still emit a row, preferring
    // any prior good data so we never regress the dataset.
    if (stopped) {
      if (prior) signals.push({ ...prior, package_registry, package_name });
      else
        signals.push({
          slug: entry.slug, repo_url, owner: parsed.owner, repo: parsed.repo,
          last_commit_at: null, last_release_at: null, last_release_tag: null,
          package_registry, package_name,
          checked_at: new Date().toISOString(), error: 'skipped (rate limited)',
        });
      continue;
    }

    const res = await fetchSignals(parsed.owner, parsed.repo);
    fetched++;

    if (res.rateLimited) {
      stopped = true;
      // Preserve prior data for this slug if we had it; else record the limit.
      if (prior && !prior.error) {
        signals.push({ ...prior, package_registry, package_name });
      } else {
        signals.push({
          slug: entry.slug, repo_url, owner: parsed.owner, repo: parsed.repo,
          last_commit_at: res.last_commit_at, last_release_at: null, last_release_tag: null,
          package_registry, package_name,
          checked_at: new Date().toISOString(), error: 'github rate limit reached',
        });
      }
      console.warn('[static] github rate limit reached — preserving prior data for remaining repos');
      continue;
    }

    signals.push({
      slug: entry.slug,
      repo_url,
      owner: parsed.owner,
      repo: parsed.repo,
      last_commit_at: res.last_commit_at,
      last_release_at: res.last_release_at,
      last_release_tag: res.last_release_tag,
      package_registry,
      package_name,
      checked_at: new Date().toISOString(),
      ...(res.error ? { error: res.error } : {}),
    });

    await sleep(REQUEST_GAP_MS);
  }

  // Carry forward signals for any local slugs not in this run's selection
  // (e.g. when --limit/--slug was used) so the committed store stays complete.
  const selected = new Set(locals.map((e) => e.slug));
  for (const [slug, sig] of prev) {
    if (!selected.has(slug)) signals.push(sig);
  }
  signals.sort((a, b) => a.slug.localeCompare(b.slug));

  const summary = {
    total: signals.length,
    with_repo: signals.filter((s) => s.owner != null).length,
    with_commit: signals.filter((s) => s.last_commit_at != null).length,
    with_release: signals.filter((s) => s.last_release_at != null).length,
    errors: signals.filter((s) => s.error != null).length,
  };

  const store: StaticSignalStore = {
    generated_at: new Date().toISOString(),
    summary,
    signals,
  };
  writeFileSync(OUT, JSON.stringify(store, null, 2) + '\n');

  console.log(
    `[static] fetched=${fetched} skipped(fresh)=${skipped} ` +
    `· repos=${summary.with_repo} commit=${summary.with_commit} ` +
    `release=${summary.with_release} errors=${summary.errors}`,
  );
  console.log(`[static] wrote ${OUT}`);
}

main().catch((e) => {
  console.error('[static] fatal:', e);
  process.exit(1);
});
