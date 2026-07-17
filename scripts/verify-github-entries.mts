/**
 * Bulk GitHub-existence verifier for the catalog (src/data/servers.ts).
 *
 * WHY: A large chunk of catalog entries are suspected "fabricated" — the
 * github_url 404s, points at an archived/dead repo, or points at a repo that
 * has nothing to do with the claimed tool (squatted / wrong repo / never a
 * real MCP server). Manual spot-checks (~5/sprint) can't clear the backlog,
 * so this does a BULK, RESUMABLE pass over every entry and flags the bad ones.
 *
 * STRICTLY READ-ONLY + DETECTION ONLY. It issues GET requests to the GitHub
 * REST API (repos/{owner}/{repo}) and writes two local files. It NEVER edits
 * servers.ts. Remediation (deleting/fixing entries) is a separate follow-up.
 *
 * Rate limits (the whole reason this is checkpointed):
 *   - Unauthenticated GitHub REST = 60 req/hour. There is no GITHUB_TOKEN in
 *     this environment, so a full pass (~2,444 entries) takes many runs.
 *   - If GITHUB_TOKEN (or GH_TOKEN) is set, we auto-use it (5,000 req/hour)
 *     via `Authorization: Bearer <token>` — no flag needed, just add it to
 *     .credentials.env / env and re-run.
 *   - We read `X-RateLimit-Remaining` after every call and STOP CLEANLY when
 *     it approaches 0 (configurable floor), and on a 403 rate-limit response
 *     we stop rather than error.
 *
 * Resume mechanism:
 *   - scripts/.verify-state.json is a map keyed by slug. Every checked entry
 *     is persisted immediately (append-safe: we re-write after each check so a
 *     crash/kill loses at most one in-flight check). On re-run we skip any
 *     slug already present (unless --force / --recheck), so successive sprint
 *     fires pick up exactly where the last left off and never waste the scarce
 *     60/hr budget re-checking known-good entries.
 *
 * Output:
 *   - scripts/.verify-state.json  — full per-slug results (the checkpoint)
 *   - scripts/.verify-report.json — failures grouped by reason, with counts,
 *     plus overall progress (checked / total / remaining).
 *
 * Run: node scripts/verify-github-entries.mts
 *        [--max-requests N]   cap API calls this run (default 57 unauth)
 *        [--floor N]          stop when X-RateLimit-Remaining <= N (default 2)
 *        [--recheck]          re-check entries already in state
 *        [--recheck-failed]   re-check only previously-failed entries
 *        [--slug a,b,c]       restrict to specific slugs
 *        [--report-only]      rebuild the report from state, make no API calls
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { servers } from '../src/data/servers.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '.verify-state.json');
const REPORT_FILE = join(__dirname, '.verify-report.json');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const USER_AGENT = 'mymcptools-verify-github/0.1.0';
const FETCH_TIMEOUT_MS = 12_000;
const REQUEST_GAP_MS = GITHUB_TOKEN ? 80 : 1500; // polite throttle

// ---- CLI ------------------------------------------------------------------
const args = process.argv.slice(2);
function argVal(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}
const maxRequests = Number(argVal('--max-requests') ?? (GITHUB_TOKEN ? 4000 : 57));
const floor = Number(argVal('--floor') ?? 2);
const recheckAll = args.includes('--recheck');
const recheckFailed = args.includes('--recheck-failed');
const reportOnly = args.includes('--report-only');
const slugFilter = argVal('--slug')?.split(',').map((s) => s.trim());

// ---- Result types ---------------------------------------------------------
type Status =
  | 'ok'              // repo exists, active, name/desc overlaps the claim
  | 'ok_low_overlap'  // repo exists+active but heuristic overlap is weak (soft flag)
  | 'not_found'       // 404 — repo does not exist
  | 'archived'        // repo exists but archived
  | 'disabled'        // repo exists but disabled
  | 'mismatch'        // repo exists+active but looks like a different tool
  | 'bad_url'         // github_url not parseable to owner/repo
  | 'error';          // transient fetch/parse error (safe to re-check)

interface VerifyResult {
  slug: string;
  name: string;
  author: string;
  github_url: string;
  ownerRepo: string | null;
  status: Status;
  httpStatus?: number;
  archived?: boolean;
  disabled?: boolean;
  repoFullName?: string;
  repoDescription?: string;
  overlapScore?: number;   // 0..1 token overlap of claim vs repo signals
  authorMatch?: boolean;   // does github owner ~ claimed author
  reason?: string;
  checkedAt: string;
}

type State = Record<string, VerifyResult>;

// ---- State load -----------------------------------------------------------
function loadState(): State {
  if (!existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as State;
  } catch {
    console.warn('[verify] state file unreadable, starting fresh');
    return {};
  }
}
function saveState(state: State): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

// ---- Helpers --------------------------------------------------------------
/** Parse an owner/repo pair out of a github_url. Returns null if not a repo URL. */
function parseOwnerRepo(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== 'github.com' && u.hostname !== 'www.github.com') return null;
    const parts = u.pathname.replace(/^\/+/, '').split('/');
    if (parts.length < 2) return null;
    const owner = parts[0];
    let repo = parts[1];
    if (!owner || !repo) return null;
    repo = repo.replace(/\.git$/, '');
    // Reserved GitHub routes that are never a real repo.
    const reserved = new Set(['orgs', 'sponsors', 'topics', 'marketplace', 'apps', 'features']);
    if (reserved.has(owner.toLowerCase())) return null;
    return `${owner}/${repo}`;
  } catch {
    return null;
  }
}

const STOP = new Set([
  'the', 'a', 'an', 'for', 'and', 'or', 'to', 'of', 'with', 'server', 'servers',
  'mcp', 'model', 'context', 'protocol', 'tool', 'tools', 'api', 'client',
  'integration', 'official', 'unofficial', 'open', 'source',
]);
function tokenize(s: string): Set<string> {
  return new Set(
    (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((t) => t.length >= 3 && !STOP.has(t)),
  );
}
/** Jaccard-ish: fraction of claim tokens that appear in the repo signal tokens. */
function overlap(claim: Set<string>, repo: Set<string>): number {
  if (claim.size === 0) return 1; // nothing meaningful to compare → don't punish
  let hit = 0;
  for (const t of claim) if (repo.has(t)) hit++;
  return hit / claim.size;
}

async function ghGet(ownerRepo: string): Promise<{
  httpStatus: number;
  remaining: number | null;
  body: any | null;
  rateLimited: boolean;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    const res = await fetch(`https://api.github.com/repos/${ownerRepo}`, {
      headers,
      signal: controller.signal,
    });
    const remainingHdr = res.headers.get('x-ratelimit-remaining');
    const remaining = remainingHdr != null ? Number(remainingHdr) : null;
    const rateLimited =
      res.status === 403 &&
      (remaining === 0 || (res.headers.get('x-ratelimit-remaining') === '0'));
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { httpStatus: res.status, remaining, body, rateLimited };
  } finally {
    clearTimeout(timer);
  }
}

function classify(
  s: (typeof servers)[number],
  ownerRepo: string,
  http: number,
  body: any,
): VerifyResult {
  const base: VerifyResult = {
    slug: s.slug,
    name: s.name,
    author: s.author,
    github_url: s.github_url,
    ownerRepo,
    status: 'error',
    httpStatus: http,
    checkedAt: new Date().toISOString(),
  };

  if (http === 404) return { ...base, status: 'not_found', reason: 'GitHub returned 404 — repo does not exist' };
  if (http === 451) return { ...base, status: 'not_found', reason: 'GitHub 451 — repo unavailable (DMCA/legal)' };
  if (http !== 200 || !body || typeof body !== 'object') {
    return { ...base, status: 'error', reason: `unexpected HTTP ${http}` };
  }

  const archived = !!body.archived;
  const disabled = !!body.disabled;
  const repoFullName: string = String(body.full_name ?? ownerRepo);
  const repoDescription: string = String(body.description ?? '');
  const ghOwner = repoFullName.split('/')[0]?.toLowerCase() ?? '';

  // Heuristic relatedness: claim tokens (name + our short description) vs repo
  // signals (full_name + repo description + topics).
  const claimTokens = tokenize(`${s.name} ${s.description}`);
  const repoTopics = Array.isArray(body.topics) ? body.topics.join(' ') : '';
  // Many legit entries point at a subpath of a shared monorepo (e.g.
  // github.com/modelcontextprotocol/servers/tree/main/src/fetch). The repo
  // name alone ("servers") won't overlap the claim, but the subpath ("fetch")
  // is the real identifier — fold it into the repo signal to avoid flagging
  // official reference servers as mismatches.
  const subpath = s.github_url.replace(/^.*\/(?:tree|blob)\/[^/]+\//, ' ');
  const repoTokens = tokenize(`${repoFullName} ${repoDescription} ${repoTopics} ${subpath}`);
  const overlapScore = Number(overlap(claimTokens, repoTokens).toFixed(2));

  const authorTokens = tokenize(s.author);
  const authorMatch =
    ghOwner.length > 0 &&
    (authorTokens.has(ghOwner) ||
      [...authorTokens].some((t) => ghOwner.includes(t) || t.includes(ghOwner)) ||
      // repo name/desc mentioning the claimed author also counts
      overlap(authorTokens, repoTokens) > 0);

  const result: VerifyResult = {
    ...base,
    status: 'ok',
    archived,
    disabled,
    repoFullName,
    repoDescription,
    overlapScore,
    authorMatch,
  };

  if (disabled) return { ...result, status: 'disabled', reason: 'repo exists but is disabled' };
  if (archived) return { ...result, status: 'archived', reason: 'repo exists but is archived' };

  // Mismatch: essentially no token overlap AND the owner doesn't match the
  // claimed author → strong signal this URL points at an unrelated repo.
  if (overlapScore === 0 && !authorMatch) {
    return { ...result, status: 'mismatch', reason: `no name/desc overlap with claim and owner "${ghOwner}" != author "${s.author}"` };
  }
  // Soft flag: weak overlap but not zero — worth a human glance, not a hard fail.
  if (overlapScore < 0.2 && !authorMatch) {
    return { ...result, status: 'ok_low_overlap', reason: `weak overlap (${overlapScore}) — review` };
  }
  return result;
}

// ---- Report ---------------------------------------------------------------
const HARD_FAIL: Status[] = ['not_found', 'archived', 'disabled', 'mismatch', 'bad_url'];
function buildReport(state: State) {
  const total = servers.length;
  const byStatus: Record<string, number> = {};
  const groups: Record<string, VerifyResult[]> = {};
  for (const r of Object.values(state)) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    if (HARD_FAIL.includes(r.status) || r.status === 'ok_low_overlap') {
      (groups[r.status] ??= []).push(r);
    }
  }
  const checked = Object.keys(state).length;
  const report = {
    generatedAt: new Date().toISOString(),
    authenticated: !!GITHUB_TOKEN,
    progress: { total, checked, remaining: total - checked, percent: Number(((checked / total) * 100).toFixed(1)) },
    countsByStatus: byStatus,
    failureCounts: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])),
    failures: Object.fromEntries(
      Object.entries(groups).map(([k, v]) => [
        k,
        v
          .map((r) => ({ slug: r.slug, name: r.name, author: r.author, github_url: r.github_url, ownerRepo: r.ownerRepo, overlapScore: r.overlapScore, reason: r.reason }))
          .sort((a, b) => a.slug.localeCompare(b.slug)),
      ]),
    ),
  };
  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2) + '\n');
  return report;
}

// ---- Main -----------------------------------------------------------------
async function main() {
  const state = loadState();

  if (reportOnly) {
    const rep = buildReport(state);
    console.log('[verify] report-only. progress:', rep.progress, 'failures:', rep.failureCounts);
    return;
  }

  let pool = servers.filter((s) => {
    if (slugFilter && !slugFilter.includes(s.slug)) return false;
    const prior = state[s.slug];
    if (!prior) return true;
    if (recheckAll) return true;
    if (recheckFailed && HARD_FAIL.includes(prior.status)) return true;
    if (prior.status === 'error') return true; // always retry transient errors
    return false;
  });

  console.log(
    `[verify] auth=${GITHUB_TOKEN ? 'token' : 'unauth(60/hr)'} ` +
      `candidates=${pool.length} maxRequests=${maxRequests} floor=${floor} ` +
      `alreadyChecked=${Object.keys(state).length}/${servers.length}`,
  );

  let apiCalls = 0;
  let stopReason = 'exhausted candidate pool';

  for (const s of pool) {
    if (apiCalls >= maxRequests) { stopReason = `hit --max-requests (${maxRequests})`; break; }

    const ownerRepo = parseOwnerRepo(s.github_url);
    if (!ownerRepo) {
      // No API call needed — record and continue.
      state[s.slug] = {
        slug: s.slug, name: s.name, author: s.author, github_url: s.github_url,
        ownerRepo: null, status: 'bad_url',
        reason: `github_url not parseable to owner/repo: ${s.github_url}`,
        checkedAt: new Date().toISOString(),
      };
      saveState(state);
      continue;
    }

    let res;
    try {
      res = await ghGet(ownerRepo);
    } catch (e) {
      state[s.slug] = {
        slug: s.slug, name: s.name, author: s.author, github_url: s.github_url,
        ownerRepo, status: 'error', reason: `fetch failed: ${(e as Error).message}`,
        checkedAt: new Date().toISOString(),
      };
      saveState(state);
      continue;
    }
    apiCalls++;

    if (res.rateLimited) {
      stopReason = 'GitHub rate limit reached (403, remaining=0) — stopping cleanly';
      break;
    }

    state[s.slug] = classify(s, ownerRepo, res.httpStatus, res.body);
    saveState(state);

    const r = state[s.slug];
    console.log(
      `  ${r.status.padEnd(14)} ${s.slug}  →  ${ownerRepo}` +
        (r.overlapScore != null ? `  overlap=${r.overlapScore}` : '') +
        (res.remaining != null ? `  [rl:${res.remaining}]` : ''),
    );

    if (res.remaining != null && res.remaining <= floor) {
      stopReason = `X-RateLimit-Remaining=${res.remaining} <= floor(${floor}) — stopping cleanly`;
      break;
    }

    if (REQUEST_GAP_MS > 0) await new Promise((r) => setTimeout(r, REQUEST_GAP_MS));
  }

  const report = buildReport(state);
  console.log('\n[verify] stop:', stopReason);
  console.log('[verify] api calls this run:', apiCalls);
  console.log('[verify] progress:', report.progress);
  console.log('[verify] counts by status:', report.countsByStatus);
  console.log('[verify] failure counts:', report.failureCounts);
}

main().catch((e) => {
  console.error('[verify] fatal:', e);
  process.exit(1);
});
