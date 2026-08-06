/**
 * PyPI / container-registry PACKAGE <-> REPO mis-link detector for the catalog.
 *
 * WHY THIS EXISTS
 *   `npm-repo-link-sweep.mts` (built 2026-08-06) proved the failure shape is
 *   live in this catalog: an entry whose `github_url` resolves 200 and whose
 *   `install_command` is copy-pasteable, but where the two are DIFFERENT
 *   SOFTWARE (`npx sendgrid-mcp` -> deyikong's package, page documents
 *   Garoth's repo). Nine such entries were repaired in that fire.
 *
 *   That sweep only reads the npm registry, so it is structurally blind to the
 *   466 `install_type:'pip'` and 13 `install_type:'docker'` entries — roughly
 *   a fifth of the installable catalog. This is the same check against the
 *   registries those entries actually resolve through:
 *     pip    -> PyPI JSON API      (`info.project_urls` / `info.home_page`)
 *     docker -> OCI registry v2    (`org.opencontainers.image.source` label,
 *                                   read off the image config blob)
 *   Both are anonymous, unauthenticated, and cost no GitHub quota — the same
 *   offline-first discipline as the npm sweep.
 *
 * SEVERITIES (identical semantics to the npm sweep, so the two reports read
 * the same way and can be triaged in one pass)
 *   critical — registry declares a DIFFERENT owner AND repo name. A reader
 *              following the install command gets other software.
 *   high     — same repo name, different owner (package-name collision).
 *   medium   — the package/image does not exist (404). The command is not
 *              copy-pasteable; `install_verified` should be false.
 *   low      — exists but declares no source repo (very common for Docker Hub
 *              images built without OCI labels). Unverifiable, not wrong.
 *
 * A disagreement is re-checked through the GitHub API before it is reported,
 * exactly as the npm sweep does: four of that sweep's seven `high` findings
 * turned out to be owner RENAMES, where both paths are the same repository.
 * The round-trip only fires on entries that already disagree.
 *
 * STRICTLY READ-ONLY. It never edits servers.ts.
 *
 * Usage: node scripts/registry-repo-link-sweep.mts [--min critical|high|medium|low]
 *                                                  [--only pip|docker]
 *                                                  [--limit N] [--json]
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { servers } from '../src/data/servers.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_FILE = join(__dirname, '.registry-repo-link-report.json');

const args = process.argv.slice(2);
const argVal = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const asJson = args.includes('--json');
const only = argVal('--only');
const limit = Number(argVal('--limit') ?? 0) || 0;
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'] as const;
type Severity = (typeof SEVERITY_ORDER)[number];
const minSeverity = (argVal('--min') as Severity) ?? 'low';
const minRank = SEVERITY_ORDER.indexOf(minSeverity);

/* ------------------------------------------------------------------ PyPI -- */

/**
 * Generic MCP plumbing published by third parties — `uvx mcp-proxy <url>` is a
 * BRIDGE, so its repo has nothing to do with the server the page documents.
 * Same rationale as BRIDGE_PACKAGES in the npm sweep.
 */
const PY_BRIDGES = new Set(['mcp-proxy', 'mcpo', 'mcp-remote', 'uv', 'uvx', 'pip', 'python']);

/**
 * Runner-local paths and project-relative installs. `uv run src/server.py` and
 * `uv pip install -e .` are SOURCE builds — there is no published package to
 * compare against, and guessing one would manufacture findings.
 */
function isLocalTarget(tok: string): boolean {
  return (
    tok === '.' ||
    tok.startsWith('.') ||
    tok.startsWith('/') ||
    tok.includes('/') ||
    tok.endsWith('.py') ||
    tok.endsWith('.txt')
  );
}

/** PyPI names normalise per PEP 503: case-insensitive, runs of -_. collapse. */
function normalizePyName(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, '-');
}

/**
 * Pull the PyPI distribution name out of a pip/uv install command.
 *
 * The catalog's pip commands cluster into a few real shapes:
 *   `uvx mcp-server-fetch`                      -> mcp-server-fetch
 *   `uvx awslabs.aws-documentation-mcp@latest`  -> awslabs.aws-documentation-mcp
 *   `pip install elevenlabs-mcp`                -> elevenlabs-mcp
 *   `uvx --from git+https://... server`         -> null (VCS install, no PyPI)
 *   `uv run src/server.py`                      -> null (local source)
 *   `git clone ... && pip install -e .`         -> null (local source)
 */
function extractPyPackage(cmd: string | undefined): string | null {
  if (!cmd) return null;
  // A VCS/direct-URL install never resolves through PyPI.
  if (/--from\s+git\+|git\+https?:\/\/|https?:\/\/\S+\.whl/.test(cmd)) return null;

  // Take the LAST segment that actually invokes an installer/runner, so
  // `git clone X && cd X && pip install -e .` is judged on its `pip install`.
  const segments = cmd.split(/&&|;|\|\|/);
  for (let s = segments.length - 1; s >= 0; s--) {
    const tokens = segments[s].trim().split(/\s+/).filter(Boolean);
    const runnerIdx = tokens.findIndex((t) =>
      /^(uvx|pipx|pip3?|uv|python3?)$/.test(t.replace(/^.*\//, '')),
    );
    if (runnerIdx < 0) continue;

    let i = runnerIdx + 1;
    // `uv run ...` and `uv venv` are not installs of a named distribution.
    if (/^uv$/.test(tokens[runnerIdx]) && /^(run|venv|sync|init)$/.test(tokens[i] ?? '')) return null;
    if (/^python3?$/.test(tokens[runnerIdx]) && tokens[i] !== '-m') return null;
    while (i < tokens.length && /^(-m|pip|install|tool|run|--)$/.test(tokens[i])) {
      if (tokens[i] === 'run' && tokens[runnerIdx] !== 'pipx') return null;
      i++;
    }

    for (; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.startsWith('-')) {
        // `-e .` and `-r requirements.txt` both mark a local install.
        if (/^(-e|-r|--editable|--requirement)$/.test(t)) return null;
        continue;
      }
      if (t.includes('=') || t.startsWith('$')) continue;
      if (isLocalTarget(t)) return null;
      // strip version/extras: `pkg@latest`, `pkg==1.2`, `pkg[all]`
      const name = t.split(/[@\[<>=!~]/)[0];
      if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name)) continue;
      if (PY_BRIDGES.has(normalizePyName(name))) return null;
      return name;
    }
  }
  return null;
}

async function fetchPyPI(pkg: string) {
  try {
    const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`, {
      headers: { accept: 'application/json' },
    });
    if (res.status === 404) return { missing: true as const };
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return { data: (await res.json()) as any };
  } catch (err) {
    return { error: String(err) };
  }
}

/**
 * PyPI has no single canonical "repository" field. Projects declare the source
 * under whatever `project_urls` key they like (Source, Repository, Code, Homepage,
 * GitHub, ...), so every candidate is scanned and the first GitHub URL wins.
 * `home_page` is the pre-PEP-621 fallback.
 */
function pypiDeclaredRepo(info: any): string | null {
  const urls: string[] = [];
  const pu = info?.project_urls;
  if (pu && typeof pu === 'object') urls.push(...Object.values(pu).filter((v): v is string => typeof v === 'string'));
  if (typeof info?.home_page === 'string') urls.push(info.home_page);
  if (typeof info?.download_url === 'string') urls.push(info.download_url);
  return urls.find((u) => /github\.com\//i.test(u)) ?? null;
}

/* -------------------------------------------------------------- containers */

/**
 * Pull the image reference out of a docker command.
 *   `docker run -i --rm -e KEY ghcr.io/o/n:tag`  -> ghcr.io/o/n
 *   `docker pull ghcr.io/o/n:latest`             -> ghcr.io/o/n
 *   `docker compose up -d`                       -> null (no image named)
 *
 * The image is the first non-flag token after the subcommand that is not the
 * VALUE of a flag — same parsing hazard the npm sweep hit with `-y`.
 */
const DOCKER_VALUE_FLAGS = new Set(['-e', '-p', '-v', '-w', '--name', '--network', '--env-file', '--mount', '--pull']);

function extractImage(cmd: string | undefined): string | null {
  if (!cmd) return null;
  for (const segment of cmd.split(/&&|;|\|\|/)) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean);
    const dIdx = tokens.findIndex((t) => t === 'docker' || t === 'podman');
    if (dIdx < 0) continue;
    const sub = tokens[dIdx + 1];
    if (!sub || !/^(run|pull|create)$/.test(sub)) continue; // `docker compose` names no image

    for (let i = dIdx + 2; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.startsWith('-')) {
        if (t.includes('=')) continue;
        if (DOCKER_VALUE_FLAGS.has(t)) i++; // consume its value
        continue;
      }
      // digest/tag stripped; the repository path is what identifies the source
      const ref = t.split('@')[0];
      const lastColon = ref.lastIndexOf(':');
      const lastSlash = ref.lastIndexOf('/');
      const repo = lastColon > lastSlash ? ref.slice(0, lastColon) : ref;
      if (!/^[a-z0-9][a-z0-9._\-/]*$/.test(repo)) continue;
      return repo;
    }
  }
  return null;
}

/**
 * Read `org.opencontainers.image.source` off an image without a docker daemon:
 * anonymous registry token -> manifest -> config blob -> labels. Handles the
 * multi-arch case by descending into the first manifest of an index.
 */
async function imageSourceLabel(
  image: string,
): Promise<{ source: string | null } | { missing: true } | { error: string }> {
  const parts = image.split('/');
  let host = 'registry-1.docker.io';
  let repo = image;
  if (parts.length > 1 && /[.:]/.test(parts[0])) {
    host = parts[0] === 'docker.io' ? 'registry-1.docker.io' : parts[0];
    repo = parts.slice(1).join('/');
  }
  if (host === 'registry-1.docker.io' && !repo.includes('/')) repo = `library/${repo}`;

  const accept = [
    'application/vnd.oci.image.manifest.v1+json',
    'application/vnd.oci.image.index.v1+json',
    'application/vnd.docker.distribution.manifest.v2+json',
    'application/vnd.docker.distribution.manifest.list.v2+json',
  ].join(', ');

  try {
    const authHost = host === 'registry-1.docker.io' ? 'auth.docker.io' : host;
    const service = host === 'registry-1.docker.io' ? 'registry.docker.io' : host;
    const tokRes = await fetch(
      `https://${authHost}/token?service=${service}&scope=repository:${repo}:pull`,
    );
    if (!tokRes.ok) return { error: `token HTTP ${tokRes.status}` };
    const token = (await tokRes.json()).token as string;
    const h = { authorization: `Bearer ${token}`, accept };

    let manRes = await fetch(`https://${host}/v2/${repo}/manifests/latest`, { headers: h });
    if (manRes.status === 404) return { missing: true };
    if (!manRes.ok) return { error: `manifest HTTP ${manRes.status}` };
    let manifest = await manRes.json();

    if (Array.isArray(manifest.manifests) && manifest.manifests.length) {
      const first = manifest.manifests.find((m: any) => m.platform?.os !== 'unknown') ?? manifest.manifests[0];
      manRes = await fetch(`https://${host}/v2/${repo}/manifests/${first.digest}`, { headers: h });
      if (!manRes.ok) return { error: `child manifest HTTP ${manRes.status}` };
      manifest = await manRes.json();
    }

    // OCI annotations can carry the source without a config fetch.
    const annotated = manifest?.annotations?.['org.opencontainers.image.source'];
    if (annotated) return { source: annotated };

    const digest = manifest?.config?.digest;
    if (!digest) return { source: null };
    const blobRes = await fetch(`https://${host}/v2/${repo}/blobs/${digest}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!blobRes.ok) return { error: `blob HTTP ${blobRes.status}` };
    const cfg = await blobRes.json();
    const labels = cfg?.config?.Labels ?? cfg?.container_config?.Labels ?? {};
    return { source: labels['org.opencontainers.image.source'] ?? labels['org.label-schema.vcs-url'] ?? null };
  } catch (err) {
    return { error: String(err) };
  }
}

/* ------------------------------------------------------------- comparison */

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
  } catch {
    /* transient — unknown, never agreement */
  }
  canonCache.set(key, out);
  return out;
}

async function sameRepoAfterRedirects(
  a: { owner: string; repo: string },
  b: { owner: string; repo: string },
): Promise<boolean> {
  const [ca, cb] = await Promise.all([canonicalRepo(a), canonicalRepo(b)]);
  return !!ca && !!cb && ca === cb;
}

/**
 * Real, already-disclosed divergences. Keyed slug -> artifact, so any change to
 * the install_command re-opens the finding. Same contract as the npm sweep's
 * ACKNOWLEDGED map.
 */
const ACKNOWLEDGED: Record<string, { artifact: string; why: string }> = {};

type Finding = {
  slug: string;
  name: string;
  kind: 'pip' | 'docker';
  severity: Severity;
  artifact: string;
  entryRepo: string | null;
  declaredRepo: string | null;
  reason: string;
};

const candidates = servers
  .filter((s) => s.install_command && s.github_url)
  .flatMap((s) => {
    if (s.install_type === 'pip' && only !== 'docker') {
      const pkg = extractPyPackage(s.install_command);
      return pkg ? [{ server: s, kind: 'pip' as const, artifact: pkg }] : [];
    }
    if (s.install_type === 'docker' && only !== 'pip') {
      const img = extractImage(s.install_command);
      return img ? [{ server: s, kind: 'docker' as const, artifact: img }] : [];
    }
    return [];
  });

const scanned = limit ? candidates.slice(0, limit) : candidates;

if (!asJson) {
  console.log(
    `registry<->repo link sweep: ${scanned.length} entries with a resolvable artifact + a github_url ` +
      `(pip=${scanned.filter((c) => c.kind === 'pip').length} docker=${scanned.filter((c) => c.kind === 'docker').length})` +
      (limit ? ` [limited from ${candidates.length}]` : ''),
  );
}

const findings: Finding[] = [];
const CONCURRENCY = 8;
let cursor = 0;
let checked = 0;

async function worker() {
  while (cursor < scanned.length) {
    const { server, kind, artifact } = scanned[cursor++];
    const entryRepo = ghIdentity(server.github_url);
    const entryRepoStr = entryRepo ? `${entryRepo.owner}/${entryRepo.repo}` : null;

    let declared: string | null = null;
    let missing = false;

    if (kind === 'pip') {
      const res = await fetchPyPI(artifact);
      if ('error' in res && res.error) continue; // transient — never assert
      if ('missing' in res) missing = true;
      else declared = pypiDeclaredRepo((res as any).data?.info);
    } else {
      const res = await imageSourceLabel(artifact);
      if ('error' in res) continue;
      if ('missing' in res) missing = true;
      else declared = res.source;
    }

    checked++;
    if (!asJson && checked % 50 === 0) console.log(`  ...${checked}/${scanned.length}`);

    const label = kind === 'pip' ? `PyPI package \`${artifact}\`` : `image \`${artifact}\``;

    if (missing) {
      findings.push({
        slug: server.slug,
        name: server.name,
        kind,
        severity: 'medium',
        artifact,
        entryRepo: entryRepoStr,
        declaredRepo: null,
        reason: `${label} does not exist (404) — install_command is not copy-pasteable`,
      });
      continue;
    }

    const declaredId = ghIdentity(declared);
    if (!declaredId) {
      findings.push({
        slug: server.slug,
        name: server.name,
        kind,
        severity: 'low',
        artifact,
        entryRepo: entryRepoStr,
        declaredRepo: null,
        reason:
          kind === 'pip'
            ? `${label} declares no GitHub project_urls/home_page — link cannot be corroborated from the registry side`
            : `${label} carries no org.opencontainers.image.source label — provenance unverifiable from the registry side`,
      });
      continue;
    }
    if (!entryRepo) continue;
    if (declaredId.owner === entryRepo.owner && declaredId.repo === entryRepo.repo) continue;
    if (await sameRepoAfterRedirects(declaredId, entryRepo)) continue;

    const ack = ACKNOWLEDGED[server.slug];
    if (ack && ack.artifact === artifact) continue;

    const declaredStr = `${declaredId.owner}/${declaredId.repo}`;
    if (declaredId.repo === entryRepo.repo) {
      findings.push({
        slug: server.slug,
        name: server.name,
        kind,
        severity: 'high',
        artifact,
        entryRepo: entryRepoStr,
        declaredRepo: declaredStr,
        reason: `SAME repo name, DIFFERENT owner — classic name collision (the \`sendgrid\` shape)`,
      });
      continue;
    }
    findings.push({
      slug: server.slug,
      name: server.name,
      kind,
      severity: declaredId.owner === entryRepo.owner ? 'low' : 'critical',
      artifact,
      entryRepo: entryRepoStr,
      declaredRepo: declaredStr,
      reason:
        declaredId.owner === entryRepo.owner
          ? `same owner, different repo — likely a monorepo/sibling artifact, verify only if the page claims otherwise`
          : `${label} points at a DIFFERENT owner AND repo than the page links — a reader following the install command gets other software`,
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

writeFileSync(REPORT_FILE, JSON.stringify({ scanned: scanned.length, counts, findings }, null, 2));

if (asJson) {
  console.log(JSON.stringify({ scanned: scanned.length, counts, findings: shown }, null, 2));
} else {
  console.log(
    `\nscanned=${scanned.length}  critical=${counts.critical} high=${counts.high} medium=${counts.medium} low=${counts.low}`,
  );
  for (const f of shown) {
    console.log(`\n[${f.severity.toUpperCase()}] ${f.slug} — ${f.name}  (${f.kind})`);
    console.log(`  artifact: ${f.artifact}`);
    console.log(`  entry:    ${f.entryRepo}`);
    console.log(`  registry: ${f.declaredRepo ?? '(none declared)'}`);
    console.log(`  why:      ${f.reason}`);
  }
  console.log(`\nreport written to ${REPORT_FILE}`);
}
