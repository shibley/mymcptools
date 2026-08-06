/**
 * npm PACKAGE <-> REPO mis-link detector for the catalog (src/data/servers.ts).
 *
 * WHY THIS EXISTS (and why neither existing sweep can do it):
 *   - `verify-github-entries.mts` asks "does github_url resolve 200?" — both
 *     halves of this failure resolve 200, so it is structurally blind to it.
 *   - `mislink-sweep.mts` compares {slug + name} against {owner + repo path}.
 *     It never looks at `install_command` at all, so a page whose repo link is
 *     right and whose install command belongs to somebody else scores clean.
 *
 * THE FAILURE SHAPE, caught live on 2026-08-05 while enriching `sendgrid`:
 *   github_url  -> Garoth/sendgrid-mcp        (29*, TypeScript, real)
 *   npm         -> `sendgrid-mcp` 1.0.4       ... whose `repository` field
 *                  resolves to deyikong/sendgrid-mcp (3*, ISC) — a DIFFERENT
 *                  project with a colliding package name.
 * Publishing `npx -y sendgrid-mcp` on a page documenting Garoth's tool surface
 * tells a reader to install software that is not the software described. It is
 * the aws-s3 / remote-mcp failure one layer down: entry<->repo was fine,
 * package<->repo was not.
 *
 * WHAT THIS DOES
 *   1. Extracts the npm package specifier from `install_command` for every
 *      `install_type: 'npm'` entry (handles `npx -y pkg@latest`, `claude mcp
 *      add x -e K=v -- npx -y pkg`, `npm i -g pkg`, scoped names, flags).
 *   2. Fetches ONLY the npm registry (no GitHub API, no auth, no quota) and
 *      reads `repository.url` / `homepage` off the packument.
 *   3. Compares the package's declared repo to the entry's `github_url` as
 *      owner/name identity. Disagreement is the finding.
 *
 * SEVERITIES
 *   critical — package declares a repo and it is a DIFFERENT owner AND a
 *              different repo name. Someone will install the wrong software.
 *   high     — same repo name, different owner (the classic name-collision
 *              fork/squat shape — sendgrid is exactly this).
 *   medium   — package does not exist on npm at all (404). The command is not
 *              copy-pasteable; `install_verified` should be false.
 *   low      — package exists but declares no repository field. Not wrong,
 *              just unverifiable from this side; recorded, not actionable.
 *
 * Entries with `github_url: null` are SKIPPED, not flagged — a deliberate
 * `unresolved` is the honest state this catalog has spent fifteen fires
 * establishing, and there is nothing to disagree with.
 *
 * STRICTLY READ-ONLY. It never edits servers.ts. Remediation is manual, one
 * entry at a time, with the package page actually opened — same discipline as
 * the fabricated-URL and mislink cleanups.
 *
 * Usage: node scripts/npm-repo-link-sweep.mts [--min critical|high|medium|low]
 *                                             [--limit N] [--json]
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { servers } from '../src/data/servers.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_FILE = join(__dirname, '.npm-repo-link-report.json');

const args = process.argv.slice(2);
const argVal = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const asJson = args.includes('--json');
const limit = Number(argVal('--limit') ?? 0) || 0;
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'] as const;
type Severity = (typeof SEVERITY_ORDER)[number];
const minSeverity = (argVal('--min') as Severity) ?? 'low';
const minRank = SEVERITY_ORDER.indexOf(minSeverity);

/**
 * Pull the package specifier out of an install command.
 *
 * The catalog's commands are not uniform — they range from a bare
 * `npx -y foo` to `claude mcp add name -e KEY=... -- npx -y @scope/foo@latest`.
 * The rule that survives all of them: take the LAST `--` separated segment
 * (which is the actual exec line in `claude mcp add` form), find the runner
 * token (npx / npm / pnpm / yarn / bunx), then take the first following token
 * that is not a flag and not a flag's value.
 */
/**
 * Generic MCP plumbing published by third parties. `npx mcp-remote <url>` is a
 * BRIDGE — the package is geelen's by design and has nothing to do with the
 * server the page documents, so comparing it to `github_url` would flag every
 * hosted-remote server in the catalog. Same for the installer CLIs, which take
 * the real package as an argument rather than being it.
 */
const BRIDGE_PACKAGES = new Set([
  'mcp-remote',
  'mcp-proxy',
  'supergateway',
  'add-mcp',
  'mcp-proxy-for-aws',
]);
/** Installer CLIs whose FIRST non-flag argument after their subcommand is the real package. */
const INSTALLER_CLIS = new Set(['@smithery/cli', 'smithery', '@modelcontextprotocol/inspector']);
/** npx/npm flags that are boolean — the token after them is NOT their value. */
const BOOLEAN_FLAGS = new Set(['-y', '--yes', '-g', '--global', '-D', '--save-dev', '--silent']);

function normalizePkg(token: string): string | null {
  const scoped = token.startsWith('@');
  const body = scoped ? token.slice(1) : token;
  const name = (scoped ? '@' : '') + body.split('@')[0];
  if (!/^@?[a-z0-9][a-z0-9._~\-]*(\/[a-z0-9][a-z0-9._~\-]*)?$/i.test(name)) return null;
  if (name.startsWith('.') || name.includes('://')) return null;
  return name;
}

/**
 * Tokens that are shell/tooling nouns, never the package being installed.
 * `git clone <repo> && npm install && npm run build` is a SOURCE build whose
 * `npm install` has no argument at all — without this guard the parser walked
 * on and returned `npm` (which is a real package: npm/cli).
 */
const NOT_A_PACKAGE = new Set([
  'npm', 'npx', 'node', 'run', 'build', 'start', 'setup', 'test', 'dev', 'cd', 'git', 'clone',
]);

function parseSegment(line: string): string | null {
  const tokens = line.trim().split(/\s+/);

  const runnerIdx = tokens.findIndex((t) =>
    /^(npx|bunx|pnpm|yarn|npm)$/.test(t.replace(/^.*\//, '')),
  );
  if (runnerIdx < 0) return null;

  let i = runnerIdx + 1;
  // skip npm/pnpm/yarn subcommands
  while (i < tokens.length && /^(install|i|add|dlx|exec|global)$/.test(tokens[i])) i++;

  const words: string[] = [];
  for (; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith('-')) {
      // Only a small whitelist actually consumes the next token. `-y` does not —
      // treating it as if it did was silently returning `stdio` (the value of a
      // later `--transport`) as the package name for `@brave/...`.
      if (!BOOLEAN_FLAGS.has(t) && tokens[i + 1] && !tokens[i + 1].startsWith('-')) i++;
      continue;
    }
    if (t.includes('=') || t.startsWith('$') || t.includes('://')) continue;
    words.push(t);
  }

  for (let w = 0; w < words.length; w++) {
    if (NOT_A_PACKAGE.has(words[w])) continue;
    const name = normalizePkg(words[w]);
    if (!name) continue;
    if (BRIDGE_PACKAGES.has(name)) return null; // generic bridge, not this server's package
    if (INSTALLER_CLIS.has(name)) {
      // `npx -y @smithery/cli install @author/pkg --client claude`
      for (let k = w + 1; k < words.length; k++) {
        if (/^(install|run|inspect)$/.test(words[k])) continue;
        const inner = normalizePkg(words[k]);
        if (inner) return inner;
      }
      return null;
    }
    return name;
  }
  return null;
}

function extractPackage(cmd: string | undefined): string | null {
  if (!cmd) return null;
  const sepIdx = cmd.lastIndexOf(' -- ');
  if (sepIdx < 0) return parseSegment(cmd);
  // Two commands share the ` -- ` shape and mean opposite things:
  //   `claude mcp add x -e K=v -- npx -y pkg`      → the package is in the TAIL
  //   `npx mcp-proxy --port 8080 -- npx -y demo`   → the package is in the HEAD,
  //                                                  the tail is a demo child server
  // Deciding by "does the head itself invoke a runner" separates them cleanly.
  const head = cmd.slice(0, sepIdx);
  if (/(^|\s)(npx|bunx|pnpm|yarn|npm)(\s|$)/.test(head)) return parseSegment(head);
  return parseSegment(cmd.slice(sepIdx + 4));
}

/** owner/name out of any github URL shape the registry emits. */
function ghIdentity(url: string | null | undefined): { owner: string; repo: string } | null {
  if (!url) return null;
  const m = url
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/\.git$/, '')
    .match(/github\.com[/:]([^/]+)\/([^/#?]+)/i);
  if (!m) return null;
  return { owner: m[1].toLowerCase(), repo: m[2].toLowerCase() };
}

/**
 * GitHub CANONICALISATION — added 2026-08-06 after the first full run.
 *
 * Four of the seven `high` findings in that run were not mis-links at all,
 * they were RENAMES. GitHub keeps redirecting the old path forever, so both
 * `evalstate/hf-mcp-server` (npm's declared repo) and `huggingface/hf-mcp-server`
 * (the page's link) are the same repository — the project was transferred to
 * the org and npm's metadata still carries the author's original path. Same
 * story for `jemgold` -> `jem-computer` and `matmax-worldwide` -> `disruption-hub`.
 *
 * A string compare cannot see this. Resolving each disputed path through the
 * API and comparing the canonical `full_name` can, and it only costs a request
 * on entries that ALREADY disagree — the 300+ agreeing entries never hit it.
 * Uses GITHUB_TOKEN when present (`gh auth token`), works unauthenticated at
 * 60/hr otherwise, which is well above the disagreement count.
 */
const GH_TOKEN = process.env.GITHUB_TOKEN || '';
const canonCache = new Map<string, string | null>();

async function canonicalRepo(id: { owner: string; repo: string }): Promise<string | null> {
  const key = `${id.owner}/${id.repo}`;
  if (canonCache.has(key)) return canonCache.get(key)!;
  let out: string | null = null;
  try {
    const res = await fetch(`https://api.github.com/repos/${key}`, {
      headers: {
        accept: 'application/vnd.github+json',
        ...(GH_TOKEN ? { authorization: `Bearer ${GH_TOKEN}` } : {}),
      },
    });
    if (res.ok) out = String((await res.json()).full_name ?? '').toLowerCase() || null;
    // 404 -> out stays null, which is itself a signal: the declared repo is gone.
  } catch {
    /* transient — treat as unknown, never as agreement */
  }
  canonCache.set(key, out);
  return out;
}

/** true only when BOTH paths resolve and land on the same canonical repo. */
async function sameRepoAfterRedirects(
  a: { owner: string; repo: string },
  b: { owner: string; repo: string },
): Promise<boolean> {
  const [ca, cb] = await Promise.all([canonicalRepo(a), canonicalRepo(b)]);
  return !!ca && !!cb && ca === cb;
}

/**
 * Disagreements that are REAL but already disclosed on the page itself, so
 * re-reporting them every run is noise. Keyed by slug -> the npm package the
 * exception covers, so a future install_command change re-opens the finding.
 */
const ACKNOWLEDGED: Record<string, { pkg: string; why: string }> = {
  'spotdraft-mcp': {
    pkg: '@spotdraft/spotdraft-mcp',
    why: "SpotDraft publishes the package under its own scope but its declared repo `spotdraft/spotdraft-mcp` is not public (404); the page links the public mirror MattDavisRV/spotdraft-mcp and says so explicitly in its description",
  },
};

type Finding = {
  slug: string;
  name: string;
  severity: Severity;
  pkg: string;
  entryRepo: string | null;
  pkgRepo: string | null;
  reason: string;
};

async function fetchPackument(pkg: string) {
  const url = `https://registry.npmjs.org/${pkg.replace('/', '%2f')}`;
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (res.status === 404) return { missing: true as const };
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return { data: (await res.json()) as any };
  } catch (err) {
    return { error: String(err) };
  }
}

const candidates = servers
  .filter((s) => s.install_type === 'npm' && s.install_command && s.github_url)
  .map((s) => ({ server: s, pkg: extractPackage(s.install_command) }))
  .filter((c): c is { server: (typeof servers)[number]; pkg: string } => !!c.pkg);

const scanned = limit ? candidates.slice(0, limit) : candidates;

if (!asJson) {
  console.log(
    `npm<->repo link sweep: ${scanned.length} npm entries with a parseable package + a github_url` +
      (limit ? ` (limited from ${candidates.length})` : ''),
  );
}

const findings: Finding[] = [];
const CONCURRENCY = 8;
let cursor = 0;
let checked = 0;

async function worker() {
  while (cursor < scanned.length) {
    const { server, pkg } = scanned[cursor++];
    const result = await fetchPackument(pkg);
    checked++;
    if (!asJson && checked % 100 === 0) console.log(`  ...${checked}/${scanned.length}`);
    if ('error' in result && result.error) continue; // transient — do not assert a finding
    const entryRepo = ghIdentity(server.github_url);
    const entryRepoStr = entryRepo ? `${entryRepo.owner}/${entryRepo.repo}` : null;

    if ('missing' in result) {
      findings.push({
        slug: server.slug,
        name: server.name,
        severity: 'medium',
        pkg,
        entryRepo: entryRepoStr,
        pkgRepo: null,
        reason: `npm package \`${pkg}\` does not exist (404) — install_command is not copy-pasteable`,
      });
      continue;
    }

    const data = (result as any).data;
    const declared =
      (typeof data?.repository === 'string' ? data.repository : data?.repository?.url) ??
      data?.homepage ??
      null;
    const pkgRepo = ghIdentity(declared);

    if (!pkgRepo) {
      findings.push({
        slug: server.slug,
        name: server.name,
        severity: 'low',
        pkg,
        entryRepo: entryRepoStr,
        pkgRepo: null,
        reason: `npm package \`${pkg}\` declares no GitHub repository — link cannot be corroborated from the registry side`,
      });
      continue;
    }
    if (!entryRepo) continue;

    if (pkgRepo.owner === entryRepo.owner && pkgRepo.repo === entryRepo.repo) continue; // agree

    // Only now, on an actual disagreement, is it worth a GitHub round-trip:
    // a rename/transfer makes two different-looking paths the same repository.
    if (await sameRepoAfterRedirects(pkgRepo, entryRepo)) continue;

    const ack = ACKNOWLEDGED[server.slug];
    if (ack && ack.pkg === pkg) continue;

    if (pkgRepo.repo === entryRepo.repo) {
      findings.push({
        slug: server.slug,
        name: server.name,
        severity: 'high',
        pkg,
        entryRepo: entryRepoStr,
        pkgRepo: `${pkgRepo.owner}/${pkgRepo.repo}`,
        reason: `SAME repo name, DIFFERENT owner — classic package-name collision (the \`sendgrid\` shape)`,
      });
      continue;
    }
    // Monorepos legitimately publish many packages; an owner match makes a
    // different repo name much weaker evidence, so it is not critical.
    findings.push({
      slug: server.slug,
      name: server.name,
      severity: pkgRepo.owner === entryRepo.owner ? 'low' : 'critical',
      pkg,
      entryRepo: entryRepoStr,
      pkgRepo: `${pkgRepo.owner}/${pkgRepo.repo}`,
      reason:
        pkgRepo.owner === entryRepo.owner
          ? `same owner, different repo — likely a monorepo/sibling package, verify only if the page claims otherwise`
          : `package points at a DIFFERENT owner AND repo than the page links — a reader following the install command gets other software`,
    });
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

findings.sort(
  (a, b) =>
    SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
    a.slug.localeCompare(b.slug),
);

const shown = findings.filter((f) => SEVERITY_ORDER.indexOf(f.severity) <= minRank);
const counts = Object.fromEntries(
  SEVERITY_ORDER.map((s) => [s, findings.filter((f) => f.severity === s).length]),
);

writeFileSync(
  REPORT_FILE,
  JSON.stringify({ scanned: scanned.length, counts, findings }, null, 2),
);

if (asJson) {
  console.log(JSON.stringify({ scanned: scanned.length, counts, findings: shown }, null, 2));
} else {
  console.log(
    `\nscanned=${scanned.length}  critical=${counts.critical} high=${counts.high} medium=${counts.medium} low=${counts.low}`,
  );
  for (const f of shown) {
    console.log(`\n[${f.severity.toUpperCase()}] ${f.slug} — ${f.name}`);
    console.log(`  pkg:   ${f.pkg}`);
    console.log(`  entry: ${f.entryRepo}`);
    console.log(`  npm:   ${f.pkgRepo ?? '(none declared)'}`);
    console.log(`  why:   ${f.reason}`);
  }
  console.log(`\nreport written to ${REPORT_FILE}`);
}
