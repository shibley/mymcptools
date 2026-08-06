/**
 * PyPI / Docker PACKAGE <-> REPO mis-link detector for the catalog
 * (src/data/servers.ts).
 *
 * WHY THIS EXISTS
 *   `npm-repo-link-sweep.mts` (2026-08-06) proved the failure shape is live in
 *   the catalog: an entry's `github_url` can be right while its `install_command`
 *   installs a DIFFERENT project that happens to share a package name. That sweep
 *   only covers `install_type: 'npm'`. The 2026-08-06 judge next_focus (scored
 *   2/3) asked to run the same logic across the remaining install types — 464
 *   `pip` entries and 13 `docker` entries are entirely unchecked. This is the
 *   sibling that closes that gap with the same offline-first, registry-metadata-
 *   only discipline (no GitHub quota except to canonicalise an actual
 *   disagreement through a rename/transfer redirect).
 *
 * THE FAILURE SHAPE, translated to each ecosystem
 *   pip    — `uvx foo-mcp` where PyPI `foo-mcp`'s declared project_urls/home_page
 *            point at owner-B/repo, but the page links owner-A/repo. A reader
 *            following the command installs owner-B's software.
 *   docker — `docker run ghcr.io/owner-B/img` on a page linking owner-A/repo, or
 *            a Docker Hub image whose `org.opencontainers.image.source` label
 *            (the OCI analog of npm `repository.url`) resolves elsewhere.
 *
 * WHAT THIS DOES
 *   pip:
 *     1. Extract the PyPI distribution name from `install_command` (handles
 *        `uvx pkg [args]`, `pip install pkg`, `uv pip install pkg`, `pipx run pkg`;
 *        skips `-e .` source builds, `git clone`, and generic runners like mcpo).
 *     2. Fetch ONLY `https://pypi.org/pypi/<pkg>/json` (no auth, no quota) and
 *        read `info.project_urls` + `info.home_page` for a github.com URL.
 *     3. Compare that repo to the entry's `github_url` as owner/name identity.
 *   docker:
 *     1. Extract the image ref from `docker run`/`docker pull` (skip flags + their
 *        values + trailing subcommands like `stdio`).
 *     2. For ghcr.io images the OWNER segment is itself a github identity — the
 *        cheapest possible signal. For Docker Hub / third-party registries, pull
 *        the `org.opencontainers.image.source` OCI label via the anonymous v2
 *        registry API (token -> manifest [-> index child] -> config blob).
 *     3. Compare the resolved source repo to the entry's `github_url`.
 *
 * SEVERITIES (identical meaning to the npm sweep)
 *   critical — registry declares a repo: DIFFERENT owner AND different repo name.
 *   high     — same repo name, different owner (name-collision / squat shape).
 *   medium   — package/image does not exist (404). Command is not copy-pasteable.
 *   low      — exists but declares no source repo, or same-owner different-repo
 *              (monorepo/sibling) — recorded, not asserted as wrong.
 *
 * Entries with `github_url: null` are SKIPPED, not flagged — a deliberate
 * `unresolved` is the honest state, and there is nothing to disagree with.
 *
 * STRICTLY READ-ONLY. Never edits servers.ts. Remediation is manual, one entry at
 * a time, with the package/image page actually opened.
 *
 * Usage: node scripts/pip-docker-repo-link-sweep.mts
 *          [--only pip|docker] [--min critical|high|medium|low] [--limit N] [--json]
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { servers } from '../src/data/servers.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_FILE = join(__dirname, '.pip-docker-repo-link-report.json');

const args = process.argv.slice(2);
const argVal = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const asJson = args.includes('--json');
const only = argVal('--only'); // pip | docker | undefined(both)
const limit = Number(argVal('--limit') ?? 0) || 0;
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'] as const;
type Severity = (typeof SEVERITY_ORDER)[number];
const minSeverity = (argVal('--min') as Severity) ?? 'low';
const minRank = SEVERITY_ORDER.indexOf(minSeverity);

// ---------------------------------------------------------------------------
// Shared: github identity + rename/transfer canonicalisation (from npm sweep)
// ---------------------------------------------------------------------------
/**
 * Placeholder owners that packagers leave in `setup.py`/`pyproject.toml` and never
 * update. A declared repo of `yourusername/foo` is not a real disagreement with the
 * page's link — it is unfilled metadata. Treated as "no declared repo" (low), not
 * as a collision (high). Seen live on blender-mcp + hubstaff-mcp on the first run.
 */
const PLACEHOLDER_OWNERS = new Set([
  'yourusername', 'your-username', 'youruser', 'your_org', 'your-org', 'yourorg',
  'username', 'example', 'example-org', 'org', 'owner', 'user', 'me', 'change-me', 'changeme',
]);

function ghIdentity(url: string | null | undefined): { owner: string; repo: string } | null {
  if (!url) return null;
  const m = url
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/\.git$/, '')
    .match(/github\.com[/:]([^/]+)\/([^/#?]+)/i);
  if (!m) return null;
  const owner = m[1].toLowerCase();
  if (PLACEHOLDER_OWNERS.has(owner)) return null; // unfilled metadata, not a real repo
  return { owner, repo: m[2].toLowerCase() };
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
    /* transient — treat as unknown, never as agreement */
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

// ---------------------------------------------------------------------------
// pip: parse the PyPI distribution name out of an install command
// ---------------------------------------------------------------------------
/** uvx/pipx plumbing that takes the REAL package as an argument rather than being it. */
const PIP_BRIDGE = new Set(['mcpo', 'mcp-proxy', 'mcp-proxy-for-aws', 'fastmcp']);
const PIP_BOOLEAN_FLAGS = new Set([
  '-y', '--yes', '-U', '--upgrade', '-e', '--editable', '--user', '-q', '--quiet', '--no-cache-dir',
]);
const NOT_A_PIP_PKG = new Set([
  'pip', 'pip3', 'uv', 'uvx', 'pipx', 'python', 'python3', 'run', 'install', 'add', 'git', 'clone',
  'cd', '.', '-e', 'tool',
]);

/** PyPI names normalise to lowercase, with runs of [-_.] collapsed to a single '-'. */
function normalizePyPI(token: string): string | null {
  // Strip uv/pipx `pkg@version` pins FIRST, then PEP 508 version specifiers + extras.
  const name = token.split('@')[0].split(/[<>=!~[]/)[0];
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name)) return null;
  if (name === '.' || name.includes('/') || name.includes('://')) return null;
  return name.toLowerCase();
}
function pypiCanonical(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, '-');
}

function extractPyPI(cmd: string | undefined): string | null {
  if (!cmd) return null;
  // `git clone ... && cd x && uv sync|uv pip install -e .|pip install .` is a SOURCE
  // build off the cloned tree, not an install of a published distribution. The repo
  // is already the github_url; there is no PyPI package to disagree with it.
  if (/\bgit\s+clone\b/.test(cmd)) return null;
  // A `-- ` tail on a pip command is a child-server arg (mcpo pattern), never the pkg.
  const head = cmd.split(' -- ')[0];
  const tokens = head.trim().split(/\s+/);

  const runnerIdx = tokens.findIndex((t) => /^(uvx|pipx|uv|pip|pip3)$/.test(t.replace(/^.*\//, '')));
  if (runnerIdx < 0) return null;

  let i = runnerIdx + 1;
  // `uv sync` / `uv lock` install from the local project, not a named package.
  if (tokens[i] && /^(sync|lock)$/.test(tokens[i])) return null;
  // consume subcommands: `uv pip install`, `pip install`, `pipx run`, `uvx` (none), `uv tool install`
  while (i < tokens.length && /^(pip|tool|install|run|add|exec)$/.test(tokens[i])) i++;

  for (; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith('-')) {
      if (!PIP_BOOLEAN_FLAGS.has(t) && tokens[i + 1] && !tokens[i + 1].startsWith('-')) i++;
      continue;
    }
    if (t.includes('=') || t.startsWith('$') || t.includes('://')) continue;
    if (NOT_A_PIP_PKG.has(t)) continue;
    const name = normalizePyPI(t);
    if (!name) continue;
    if (PIP_BRIDGE.has(pypiCanonical(name))) return null;
    return name;
  }
  return null;
}

async function fetchPyPI(pkg: string): Promise<{ missing?: true; error?: string; repo?: string | null }> {
  try {
    const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`, {
      headers: { accept: 'application/json' },
    });
    if (res.status === 404) return { missing: true };
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const info = ((await res.json()) as any)?.info ?? {};
    const urls: string[] = [];
    if (info.project_urls && typeof info.project_urls === 'object') {
      // Prefer explicit source/repo keys, but any github url in the set is usable.
      const pref = ['source', 'source code', 'repository', 'code', 'github', 'homepage'];
      const entries = Object.entries(info.project_urls as Record<string, string>);
      entries.sort((a, b) => {
        const ra = pref.indexOf(a[0].toLowerCase());
        const rb = pref.indexOf(b[0].toLowerCase());
        return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
      });
      for (const [, v] of entries) if (v) urls.push(v);
    }
    if (info.home_page) urls.push(info.home_page);
    for (const u of urls) if (ghIdentity(u)) return { repo: u };
    return { repo: null };
  } catch (err) {
    return { error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// docker: parse image ref, then resolve source repo (ghcr owner or OCI label)
// ---------------------------------------------------------------------------
const DOCKER_VALUE_FLAGS = new Set(['-e', '-p', '-v', '--name', '--env', '--publish', '--volume', '-w', '--workdir', '--network', '--user', '-u']);
function extractImage(cmd: string | undefined): string | null {
  if (!cmd) return null;
  // Only look at the docker run/pull segment; skip `git clone ... && docker compose`.
  const seg = cmd.split('&&').find((s) => /\bdocker\s+(run|pull)\b/.test(s));
  if (!seg) return null;
  const tokens = seg.trim().split(/\s+/);
  const runnerIdx = tokens.findIndex((t, k) => t === 'docker' && /^(run|pull)$/.test(tokens[k + 1] ?? ''));
  if (runnerIdx < 0) return null;
  let i = runnerIdx + 2;
  for (; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith('-')) {
      if (t.includes('=')) continue; // --pull=always
      if (DOCKER_VALUE_FLAGS.has(t)) i++; // consumes its value (incl. bare `-e VAR`)
      continue;
    }
    if (t.includes('=') || t.startsWith('$')) continue;
    // The image is the first bare token with a registry/namespace slash.
    if (t.includes('/')) return t;
    // A single-segment official image (e.g. `senzing/...` always has a slash;
    // bare `redis` would land here) — accept only if it looks like an image name.
    if (/^[a-z0-9][a-z0-9._-]*(:[\w.-]+)?$/.test(t)) return t;
  }
  return null;
}

type ParsedImage = { registry: string; repository: string; tag: string };
function parseImageRef(ref: string): ParsedImage {
  let rest = ref;
  let registry = 'docker.io';
  const firstSlash = rest.indexOf('/');
  const firstSeg = firstSlash >= 0 ? rest.slice(0, firstSlash) : '';
  if (firstSeg.includes('.') || firstSeg.includes(':') || firstSeg === 'localhost') {
    registry = firstSeg;
    rest = rest.slice(firstSlash + 1);
  }
  let tag = 'latest';
  const at = rest.indexOf('@');
  if (at >= 0) rest = rest.slice(0, at); // ignore digest pin for tag purposes
  const colon = rest.lastIndexOf(':');
  if (colon >= 0 && !rest.slice(colon).includes('/')) {
    tag = rest.slice(colon + 1);
    rest = rest.slice(0, colon);
  }
  // Docker Hub official images have an implicit `library/` namespace.
  let repository = rest;
  if (registry === 'docker.io' && !repository.includes('/')) repository = `library/${repository}`;
  return { registry, repository, tag };
}

async function registryToken(registry: string, repository: string): Promise<string | null> {
  try {
    if (registry === 'docker.io') {
      const r = await fetch(
        `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repository}:pull`,
      );
      if (r.ok) return ((await r.json()) as any).token ?? null;
    } else if (registry === 'ghcr.io') {
      const r = await fetch(`https://ghcr.io/token?scope=repository:${repository}:pull`);
      if (r.ok) return ((await r.json()) as any).token ?? null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

const MANIFEST_ACCEPT = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(', ');

/** Resolve the `org.opencontainers.image.source` label for a Docker Hub / OCI image. */
async function ociSourceLabel(img: ParsedImage): Promise<{ missing?: true; source?: string | null }> {
  const base =
    img.registry === 'docker.io'
      ? 'https://registry-1.docker.io'
      : `https://${img.registry}`;
  const token = await registryToken(img.registry, img.repository);
  const auth = token ? { authorization: `Bearer ${token}` } : {};
  const getManifest = async (refr: string) => {
    const r = await fetch(`${base}/v2/${img.repository}/manifests/${refr}`, {
      headers: { accept: MANIFEST_ACCEPT, ...auth },
    });
    if (r.status === 404) return { status: 404 as const };
    if (!r.ok) return { status: r.status };
    return { status: 200 as const, json: (await r.json()) as any };
  };
  try {
    let m = await getManifest(img.tag);
    if ('status' in m && m.status === 404) return { missing: true };
    if (!('json' in m)) return { source: null };
    let manifest = m.json;
    // Multi-arch index → descend into the first child manifest.
    if (Array.isArray(manifest.manifests) && manifest.manifests.length) {
      const child = manifest.manifests.find((x: any) => x?.platform?.os !== 'unknown') ?? manifest.manifests[0];
      const cm = await getManifest(child.digest);
      if (!('json' in cm)) return { source: null };
      manifest = cm.json;
    }
    const configDigest = manifest?.config?.digest;
    if (!configDigest) return { source: null };
    const cr = await fetch(`${base}/v2/${img.repository}/blobs/${configDigest}`, {
      headers: { accept: 'application/json', ...auth },
    });
    if (!cr.ok) return { source: null };
    const cfg = (await cr.json()) as any;
    const labels = cfg?.config?.Labels ?? cfg?.container_config?.Labels ?? {};
    const src =
      labels['org.opencontainers.image.source'] ||
      labels['org.label-schema.vcs-url'] ||
      null;
    return { source: src };
  } catch {
    return { source: null };
  }
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------
type Finding = {
  slug: string;
  name: string;
  kind: 'pip' | 'docker';
  severity: Severity;
  ref: string; // pkg or image
  entryRepo: string | null;
  declaredRepo: string | null;
  reason: string;
};
const findings: Finding[] = [];

async function classify(
  server: (typeof servers)[number],
  kind: 'pip' | 'docker',
  ref: string,
  declaredUrl: string | null,
  missing: boolean,
): Promise<void> {
  const entryRepo = ghIdentity(server.github_url);
  const entryRepoStr = entryRepo ? `${entryRepo.owner}/${entryRepo.repo}` : null;

  if (missing) {
    findings.push({
      slug: server.slug, name: server.name, kind, severity: 'medium', ref,
      entryRepo: entryRepoStr, declaredRepo: null,
      reason: kind === 'pip'
        ? `PyPI package \`${ref}\` does not exist (404) — install_command is not copy-pasteable`
        : `image \`${ref}\` not found in its registry (404) — install_command is not runnable`,
    });
    return;
  }

  const declRepo = ghIdentity(declaredUrl);
  if (!declRepo) {
    findings.push({
      slug: server.slug, name: server.name, kind, severity: 'low', ref,
      entryRepo: entryRepoStr, declaredRepo: null,
      reason: kind === 'pip'
        ? `PyPI package \`${ref}\` declares no GitHub source URL — link cannot be corroborated from the registry side`
        : `image \`${ref}\` exposes no org.opencontainers.image.source label — link cannot be corroborated from the registry side`,
    });
    return;
  }
  if (!entryRepo) return;
  if (declRepo.owner === entryRepo.owner && declRepo.repo === entryRepo.repo) return; // agree
  if (await sameRepoAfterRedirects(declRepo, entryRepo)) return; // rename/transfer

  const declStr = `${declRepo.owner}/${declRepo.repo}`;
  if (declRepo.repo === entryRepo.repo) {
    findings.push({
      slug: server.slug, name: server.name, kind, severity: 'high', ref,
      entryRepo: entryRepoStr, declaredRepo: declStr,
      reason: `SAME repo name, DIFFERENT owner — package-name collision shape`,
    });
    return;
  }
  findings.push({
    slug: server.slug, name: server.name, kind,
    severity: declRepo.owner === entryRepo.owner ? 'low' : 'critical',
    ref, entryRepo: entryRepoStr, declaredRepo: declStr,
    reason: declRepo.owner === entryRepo.owner
      ? `same owner, different repo — likely a monorepo/sibling package, verify only if the page claims otherwise`
      : `${kind === 'pip' ? 'package' : 'image'} points at a DIFFERENT owner AND repo than the page links — a reader following the install command gets other software`,
  });
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const doPip = only !== 'docker';
const doDocker = only !== 'pip';

const pipCandidates = doPip
  ? servers
      .filter((s) => s.install_type === 'pip' && s.install_command && s.github_url)
      .map((s) => ({ server: s, pkg: extractPyPI(s.install_command) }))
      .filter((c): c is { server: (typeof servers)[number]; pkg: string } => !!c.pkg)
  : [];
const dockerCandidates = doDocker
  ? servers
      .filter((s) => s.install_type === 'docker' && s.install_command && s.github_url)
      .map((s) => ({ server: s, image: extractImage(s.install_command) }))
      .filter((c): c is { server: (typeof servers)[number]; image: string } => !!c.image)
  : [];

const pipScan = limit ? pipCandidates.slice(0, limit) : pipCandidates;
const dockerScan = limit ? dockerCandidates.slice(0, limit) : dockerCandidates;

if (!asJson) {
  console.log(
    `pip<->repo: ${pipScan.length} pip entries with a parseable package + github_url\n` +
      `docker<->repo: ${dockerScan.length} docker entries with a parseable image + github_url`,
  );
}

// pip: concurrent PyPI fetches
{
  const CONCURRENCY = 8;
  let cursor = 0;
  let checked = 0;
  async function worker() {
    while (cursor < pipScan.length) {
      const { server, pkg } = pipScan[cursor++];
      const res = await fetchPyPI(pkg);
      checked++;
      if (!asJson && checked % 100 === 0) console.log(`  pip ...${checked}/${pipScan.length}`);
      if (res.error) continue; // transient — never assert a finding
      await classify(server, 'pip', pkg, res.repo ?? null, !!res.missing);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

// docker: fewer entries, registry API is heavier — lower concurrency
{
  const CONCURRENCY = 4;
  let cursor = 0;
  async function worker() {
    while (cursor < dockerScan.length) {
      const { server, image } = dockerScan[cursor++];
      const img = parseImageRef(image);
      // ghcr.io owner IS a github identity — cheapest, most reliable signal, and it
      // is PUBLISHER-controlled. The OCI `source` label is NOT reliable on ghcr: it
      // is frequently inherited from a base image (obot's image carries
      // chainguard-images/images), so trusting it over the owner path invents
      // disagreements. Use the owner path; only fall back to the label when the
      // repository has too few segments to form an identity.
      if (img.registry === 'ghcr.io') {
        const parts = img.repository.split('/');
        const declaredUrl = parts.length >= 2 ? `https://github.com/${parts[0]}/${parts[1]}` : null;
        const label = await ociSourceLabel(img); // still confirm the image exists (404 → missing)
        if (label.missing) {
          await classify(server, 'docker', image, null, true);
        } else {
          await classify(server, 'docker', image, declaredUrl ?? label.source ?? null, false);
        }
        continue;
      }
      const label = await ociSourceLabel(img);
      await classify(server, 'docker', image, label.source ?? null, !!label.missing);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

findings.sort(
  (a, b) =>
    SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
    a.kind.localeCompare(b.kind) ||
    a.slug.localeCompare(b.slug),
);

const shown = findings.filter((f) => SEVERITY_ORDER.indexOf(f.severity) <= minRank);
const counts = Object.fromEntries(
  SEVERITY_ORDER.map((s) => [s, findings.filter((f) => f.severity === s).length]),
);

writeFileSync(
  REPORT_FILE,
  JSON.stringify(
    { pipScanned: pipScan.length, dockerScanned: dockerScan.length, counts, findings },
    null,
    2,
  ),
);

if (asJson) {
  console.log(JSON.stringify({ counts, findings: shown }, null, 2));
} else {
  console.log(
    `\npip=${pipScan.length} docker=${dockerScan.length}  ` +
      `critical=${counts.critical} high=${counts.high} medium=${counts.medium} low=${counts.low}`,
  );
  for (const f of shown) {
    console.log(`\n[${f.severity.toUpperCase()}] (${f.kind}) ${f.slug} — ${f.name}`);
    console.log(`  ref:   ${f.ref}`);
    console.log(`  entry: ${f.entryRepo}`);
    console.log(`  decl:  ${f.declaredRepo ?? '(none declared)'}`);
    console.log(`  why:   ${f.reason}`);
  }
  console.log(`\nreport written to ${REPORT_FILE}`);
}
