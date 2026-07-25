// Live package-registry verification for the Agent Dependency Firewall.
//
// STRICTLY READ-ONLY. Issues GET requests to the public npm registry, the npm
// downloads API, and the PyPI JSON API. All three are free and unauthenticated.
// It never installs, executes, or resolves a package — it reads metadata only,
// and treats every field as untrusted (scalars are validated and truncated).
//
// This module is deliberately free of Next.js imports so the sweeper script and
// the API routes share exactly one implementation. If the checker in the script
// and the checker in the API could disagree, the corpus would be unfalsifiable.
//
// The one rule that matters: a verdict may only be produced from a completed
// HTTP response. Any failure path returns UNKNOWN with the error recorded.

import type {
  Ecosystem,
  PackageEvidence,
  PackageVerdict,
  RiskMarker,
} from './types.ts';

const USER_AGENT = 'mymcptools-firewall/0.1.0 (+https://mymcptools.com/firewall)';
const FETCH_TIMEOUT_MS = 12_000;

/** A package first published within this window is "young". */
export const YOUNG_PACKAGE_DAYS = 90;
/** npm weekly downloads at or below this are "near zero". */
export const NEAR_ZERO_DOWNLOADS = 50;
/**
 * Version count at or above which we stop asking questions: a package with this
 * many releases has a publication history no hallucination-registration has.
 */
export const ESTABLISHED_VERSION_COUNT = 5;

/** Self-declared defensive-placeholder wording, matched against the description. */
const PLACEHOLDER_RE =
  /\b(placeholder|dependency[- ]confusion|slop ?squat|typo ?squat|squatt?ing|reserved (this )?name|do not use this package)\b/i;

// ---------------------------------------------------------------------------
// Name validation — a rejected name must never reach the network.
// ---------------------------------------------------------------------------

/** npm: optional @scope/, lowercase, url-safe, <=214 chars. */
const NPM_NAME_RE = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/;
/** PyPI (PEP 508 name grammar). */
const PYPI_NAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;

export function isValidPackageName(name: string, ecosystem: Ecosystem): boolean {
  if (!name || name.length > 214) return false;
  return ecosystem === 'npm' ? NPM_NAME_RE.test(name) : PYPI_NAME_RE.test(name);
}

/**
 * PyPI normalises names per PEP 503 (runs of -_. collapse to a single -, and the
 * name is lowercased). We query the normalised form so that `Foo_Bar` and
 * `foo-bar` do not produce two different verdicts for one package.
 */
export function normalizeName(name: string, ecosystem: Ecosystem): string {
  return ecosystem === 'pypi'
    ? name.trim().replace(/[-_.]+/g, '-').toLowerCase()
    : name.trim();
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

function emptyEvidence(url: string): PackageEvidence {
  return {
    registry_url: url,
    http_status: null,
    checked_at: new Date().toISOString(),
    first_published_at: null,
    last_published_at: null,
    version_count: null,
    latest_version: null,
    weekly_downloads: null,
    repository_url: null,
    description: null,
    error: null,
  };
}

/** Coerce an untrusted value to a bounded string, or null. */
function str(v: unknown, max = 300): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

async function getJson(
  url: string,
  accept?: string
): Promise<{ status: number | null; body: unknown; error: string | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: accept ?? 'application/json',
      },
    });
    // A 404 is a real, meaningful answer — parse nothing, report the status.
    if (res.status === 404) return { status: 404, body: null, error: null };
    if (!res.ok) {
      return { status: res.status, body: null, error: `HTTP ${res.status}` };
    }
    return { status: res.status, body: await res.json(), error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: null, body: null, error: msg.slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// npm
// ---------------------------------------------------------------------------

/**
 * npm existence + metadata.
 *
 * Two-step on purpose. The abbreviated packument (the `install-v1` accept
 * header) is small and answers existence plus version count. Only when the
 * version count is below ESTABLISHED_VERSION_COUNT do we fetch the full
 * document for `time.created` — which is the only place npm exposes a first
 * publish date, and which for popular packages is megabytes of payload we have
 * no reason to download. Packages with many versions are established by
 * definition, so the date cannot change the verdict.
 */
async function checkNpm(name: string): Promise<PackageEvidence> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name).replace('%40', '@')}`;
  const ev = emptyEvidence(url);

  const abbreviated = await getJson(url, 'application/vnd.npm.install-v1+json');
  ev.http_status = abbreviated.status;
  ev.error = abbreviated.error;
  if (abbreviated.status !== 200 || !abbreviated.body) return ev;

  const doc = abbreviated.body as Record<string, unknown>;
  const versions = (doc.versions ?? {}) as Record<string, unknown>;
  const versionKeys = Object.keys(versions);
  ev.version_count = versionKeys.length;
  const distTags = (doc['dist-tags'] ?? {}) as Record<string, unknown>;
  ev.latest_version = str(distTags.latest, 60);

  // Full document, only when the abbreviated one leaves the question open.
  if (versionKeys.length < ESTABLISHED_VERSION_COUNT) {
    const full = await getJson(url);
    if (full.status === 200 && full.body) {
      const fdoc = full.body as Record<string, unknown>;
      const time = (fdoc.time ?? {}) as Record<string, unknown>;
      ev.first_published_at = str(time.created, 40);
      ev.last_published_at = str(time.modified, 40);
      ev.description = str(fdoc.description);
      const latest = ev.latest_version
        ? ((fdoc.versions as Record<string, unknown> | undefined)?.[ev.latest_version] as
            | Record<string, unknown>
            | undefined)
        : undefined;
      const repo = (latest?.repository ?? fdoc.repository) as
        | Record<string, unknown>
        | string
        | undefined;
      ev.repository_url =
        typeof repo === 'string' ? str(repo, 300) : str(repo?.url, 300);
    }
  }

  // Weekly downloads. A miss here is not an error for the package — it just
  // leaves the marker unmeasurable, so it stays null rather than becoming 0.
  const dl = await getJson(
    `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name).replace('%40', '@')}`
  );
  if (dl.status === 200 && dl.body) {
    const n = (dl.body as Record<string, unknown>).downloads;
    if (typeof n === 'number' && Number.isFinite(n)) ev.weekly_downloads = n;
  }

  return ev;
}

// ---------------------------------------------------------------------------
// PyPI
// ---------------------------------------------------------------------------

/**
 * PyPI existence + metadata from the JSON API.
 *
 * Note a real gap, recorded rather than papered over: PyPI does not serve
 * download counts on this endpoint, and pypistats.org rate-limited this host on
 * first contact. `weekly_downloads` is therefore always null for PyPI, and the
 * near_zero_downloads marker is npm-only. The page and the API say so.
 */
async function checkPypi(name: string): Promise<PackageEvidence> {
  const url = `https://pypi.org/pypi/${encodeURIComponent(name)}/json`;
  const ev = emptyEvidence(url);

  const res = await getJson(url);
  ev.http_status = res.status;
  ev.error = res.error;
  if (res.status !== 200 || !res.body) return ev;

  const doc = res.body as Record<string, unknown>;
  const info = (doc.info ?? {}) as Record<string, unknown>;
  ev.latest_version = str(info.version, 60);
  ev.description = str(info.summary);

  const projectUrls = (info.project_urls ?? {}) as Record<string, unknown>;
  ev.repository_url =
    str(info.home_page, 300) ??
    str(projectUrls.Source, 300) ??
    str(projectUrls.Repository, 300) ??
    str(projectUrls.Homepage, 300);

  const releases = (doc.releases ?? {}) as Record<string, unknown>;
  const releaseKeys = Object.keys(releases);
  ev.version_count = releaseKeys.length;

  // Earliest and latest upload times across every file of every release.
  const times: number[] = [];
  for (const key of releaseKeys) {
    const files = releases[key];
    if (!Array.isArray(files)) continue;
    for (const f of files) {
      const t = (f as Record<string, unknown>)?.upload_time_iso_8601;
      if (typeof t === 'string') {
        const ms = Date.parse(t);
        if (!Number.isNaN(ms)) times.push(ms);
      }
    }
  }
  if (times.length) {
    ev.first_published_at = new Date(Math.min(...times)).toISOString();
    ev.last_published_at = new Date(Math.max(...times)).toISOString();
  }

  return ev;
}

// ---------------------------------------------------------------------------
// Verdict derivation — pure, so the selfcheck can assert on it directly.
// ---------------------------------------------------------------------------

/**
 * Derive markers from evidence. Each marker names the number it came from; a
 * marker is only emitted when the underlying value was actually measured, so a
 * null reading can never masquerade as a bad reading.
 */
export function deriveMarkers(
  ev: PackageEvidence,
  now: number = Date.now()
): RiskMarker[] {
  const markers: RiskMarker[] = [];
  if (ev.http_status !== 200) return markers;

  if (ev.description && PLACEHOLDER_RE.test(ev.description)) {
    markers.push({
      id: 'self_declared_placeholder',
      detail: `The registry description self-identifies as a placeholder or anti-squatting reservation: "${ev.description}"`,
    });
  }

  if (ev.first_published_at) {
    const ageDays = (now - Date.parse(ev.first_published_at)) / 86_400_000;
    if (Number.isFinite(ageDays) && ageDays < YOUNG_PACKAGE_DAYS) {
      markers.push({
        id: 'young_package',
        detail: `First published ${Math.max(0, Math.round(ageDays))} days ago (under the ${YOUNG_PACKAGE_DAYS}-day threshold).`,
      });
    }
  }

  if (ev.weekly_downloads !== null && ev.weekly_downloads <= NEAR_ZERO_DOWNLOADS) {
    markers.push({
      id: 'near_zero_downloads',
      detail: `${ev.weekly_downloads} downloads in the trailing week (at or below ${NEAR_ZERO_DOWNLOADS}).`,
    });
  }

  if (ev.version_count !== null && ev.version_count <= 1) {
    markers.push({
      id: 'single_release',
      detail: `Only ${ev.version_count} published version.`,
    });
  }

  if (!ev.repository_url) {
    markers.push({
      id: 'no_repository_link',
      detail: 'The registry record declares no source repository.',
    });
  }

  return markers;
}

/**
 * Map evidence + markers to a verdict.
 *
 *   404                     -> NONEXISTENT   (a real answer, not a failure)
 *   no completed response   -> UNKNOWN       (never guessed)
 *   200 + placeholder       -> SLOPSQUAT_RISK
 *   200 + >=2 markers       -> SLOPSQUAT_RISK
 *   200 otherwise           -> EXISTS
 *
 * The two-marker floor is deliberate. Any single marker fires on ordinary
 * healthy packages — every good package is young once, and plenty of fine
 * packages omit a repository link. Requiring two independent markers is what
 * keeps SLOPSQUAT_RISK from becoming the noise that makes security scanners
 * unusable.
 */
export function deriveVerdict(
  ev: PackageEvidence,
  markers: RiskMarker[]
): PackageVerdict {
  if (ev.http_status === 404) return 'NONEXISTENT';
  if (ev.http_status !== 200) return 'UNKNOWN';
  if (markers.some((m) => m.id === 'self_declared_placeholder')) return 'SLOPSQUAT_RISK';
  if (
    ev.version_count !== null &&
    ev.version_count >= ESTABLISHED_VERSION_COUNT &&
    !markers.some((m) => m.id === 'near_zero_downloads')
  ) {
    return 'EXISTS';
  }
  return markers.length >= 2 ? 'SLOPSQUAT_RISK' : 'EXISTS';
}

export interface LivePackageCheck {
  name: string;
  ecosystem: Ecosystem;
  verdict: PackageVerdict;
  markers: RiskMarker[];
  evidence: PackageEvidence;
}

/**
 * Check one package name against its live registry and derive a verdict.
 * Never throws: transport failures come back as UNKNOWN with `evidence.error`.
 */
export async function checkPackage(
  rawName: string,
  ecosystem: Ecosystem
): Promise<LivePackageCheck> {
  const name = normalizeName(rawName, ecosystem);

  if (!isValidPackageName(name, ecosystem)) {
    const ev = emptyEvidence('');
    ev.error = `"${rawName.slice(0, 60)}" is not a valid ${ecosystem} package name`;
    return { name: rawName.slice(0, 214), ecosystem, verdict: 'UNKNOWN', markers: [], evidence: ev };
  }

  const evidence = ecosystem === 'npm' ? await checkNpm(name) : await checkPypi(name);
  const markers = deriveMarkers(evidence);
  return { name, ecosystem, verdict: deriveVerdict(evidence, markers), markers, evidence };
}
