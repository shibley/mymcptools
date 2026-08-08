/**
 * INSTALL-COMMAND COMPLETENESS sweep + REGISTRY-VERIFIED resolver
 * for the catalog (src/data/servers.ts).
 *
 * WHY THIS EXISTS
 *   Four mis-link sweeps now cover every install type that HAS a command:
 *     - `npm-repo-link-sweep.mts`          (2026-08-06) — npm
 *     - `pip-docker-repo-link-sweep.mts`   (2026-08-06) — pip + docker
 *     - `source-binary-repo-link-sweep.mts`(2026-08-07) — source + binary
 *   Every one of them starts by parsing `install_command`. So all four are
 *   structurally blind to the entries where that field is EMPTY: there is no
 *   command to parse, so there is no finding, so the defect is invisible to the
 *   whole detector family. The 2026-08-07 fire flagged this as the remaining
 *   coverage hole and estimated it at ~148 source/binary entries.
 *
 *   It is 1,151 entries — 47% of the catalog.
 *
 * WHY IT IS THE MOST USER-VISIBLE DEFECT CLASS IN THE CATALOG
 *   `src/app/servers/[slug]/page.tsx` renders the Installation block behind
 *   `{server.install_command && (…)}`. A blank field does not degrade the page,
 *   it DELETES the section. Half of /servers/* therefore answers the one
 *   question the page exists to answer — "how do I install this MCP server?" —
 *   with nothing at all. The FAQ falls back to "Install X from its GitHub
 *   repository: <url>", which is a link, not a command, and it is the answer
 *   that gets read aloud when an assistant cites the page.
 *
 * THE RESOLVER, AND WHY IT CANNOT FABRICATE
 *   A blank field is only worth detecting if it can be filled. Guessing a
 *   package name from a repo name is exactly the fabrication that fifteen fires
 *   have spent their time undoing, so this resolver never asserts a guess. It
 *   generates candidate package names from the entry's OWN verified
 *   `github_url` (owner/repo), then accepts a candidate ONLY when the registry's
 *   own metadata points back at that same repo:
 *
 *     candidate `foo` is accepted  <=>  registry(foo).repository.url resolves to
 *                                       the same owner/name as entry.github_url
 *
 *   The guess supplies the name; the REGISTRY supplies the proof. A package
 *   that exists but belongs to someone else fails the check and is reported as
 *   a near-miss rather than written. This is the inverse of the sibling sweeps:
 *   they read a command and ask "does the registry agree?"; this one asks the
 *   registry first and only then writes a command. Same evidence standard.
 *
 * THE SECOND GATE: OWNERSHIP IS NOT RUNNABILITY
 *   Repo agreement alone is not enough, and the first run of this sweep proved
 *   it. `ray-distributed-mcp` links `ray-project/ray`; the PyPI package `ray`
 *   declares that exact repo, so agreement PASSED — and `uvx ray` would have
 *   been written into the catalog as an MCP install command. It is the Ray
 *   distributed-computing CLI. Agreement establishes that the package belongs
 *   to the repo; it says nothing about whether the package exposes an
 *   executable at all, let alone an MCP server. Many of these repos publish a
 *   LIBRARY (`langchain-mcp-adapters`, `fastapi_mcp` — imported, not run).
 *   So a candidate must also clear an entry-point check:
 *     npm  — the packument version must declare a `bin`. Hard, automatic, and
 *            exactly what decides whether `npx pkg` runs or errors.
 *     PyPI — the JSON API does not expose console_scripts, so the 2026-08-07
 *            run could not check pip at all and held back EVERY pip candidate.
 *            That was a coverage hole, not a real limit: the console_scripts
 *            table is shipped inside the wheel itself, at
 *            `<dist-info>/entry_points.txt`. This sweep now downloads the
 *            latest wheel (size-capped) and reads that file directly, which is
 *            the same table `uvx` consults at run time. No entry_points.txt or
 *            no `[console_scripts]` section => library => still held back.
 *
 * WHY THE PyPI GATE ALSO CHANGES THE COMMAND
 *   `uvx foo` does not run "the package foo"; it runs the console script NAMED
 *   foo. A package whose only script is `mcp-server-foo` fails under `uvx foo`
 *   with "executable not found". Reading entry_points.txt gives the actual
 *   script names, so the emitted command is `uvx <pkg>` only when a script
 *   matches the package name, and `uvx --from <pkg> <script>` otherwise. A
 *   registry lookup could never have known which of the two to write.
 *
 * SEVERITIES
 *   critical — blank command AND `github_url` is null: the page offers a reader
 *              no path of any kind to the software. Nothing to resolve from.
 *   high     — blank command, real repo, and a candidate package was ACCEPTED
 *              by the registry-agreement rule above: a verified, ready fix.
 *   medium   — blank command, real repo, no candidate accepted: fixable only by
 *              reading the README by hand.
 *   low      — blank command on an install type with no registry to resolve
 *              against (source/binary): install is inherently a repo checkout.
 *
 * STRICTLY READ-ONLY. Never edits servers.ts. `--fixes` emits the accepted
 * candidates as a patch plan for a human to apply one at a time.
 *
 * Usage: node --experimental-strip-types scripts/install-command-completeness-sweep.mts
 *          [--min critical|high|medium|low] [--limit N] [--budget N]
 *          [--resolve] [--fixes] [--json]
 */
import { writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { servers, type MCPServer } from '../src/data/servers.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_FILE = join(__dirname, '.install-completeness-report.json');

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const val = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const MIN = (val('min') ?? 'low') as Severity;
const LIMIT = Number(val('limit') ?? '0') || 0;
const RESOLVE = flag('resolve');
const AS_JSON = flag('json');
const SHOW_FIXES = flag('fixes');

type Severity = 'critical' | 'high' | 'medium' | 'low';
const RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

interface Finding {
  slug: string;
  name: string;
  severity: Severity;
  install_type: MCPServer['install_type'];
  github_url: string | null;
  stars: number;
  descriptionWords: number;
  /** Package name the registry confirmed belongs to this entry's repo. */
  resolved?: {
    package: string;
    registry: 'npm' | 'PyPI';
    command: string;
    declaredRepo: string;
    /** npm: `bin` was declared. PyPI: never true — no automatic check exists. */
    executable: boolean;
    /** True when the package owns the repo but runnability could not be proven. */
    entrypoint_unconfirmed: boolean;
  };
  /** Candidates that exist on the registry but declare a DIFFERENT repo. */
  nearMisses?: { package: string; declaredRepo: string | null }[];
  note: string;
}

/* ------------------------------------------------------------------ *
 * A blank field is not the only way to say nothing. These are commands
 * that occupy the field while still leaving a reader without a command;
 * they render a copy button over text that cannot be run. Treated as
 * blank so the sweep counts the real size of the gap.
 * ------------------------------------------------------------------ */
const PLACEHOLDER_COMMANDS = [
  'tbd', 'n/a', 'na', 'none', 'see docs', 'see documentation', 'see readme',
  'coming soon', 'manual', 'manual install', 'contact vendor', 'varies',
  'npm install', 'pip install', 'docker run', 'git clone',
];

function isEmptyCommand(cmd: string | undefined): boolean {
  if (!cmd) return true;
  const t = cmd.trim();
  if (!t) return true;
  return PLACEHOLDER_COMMANDS.includes(t.toLowerCase().replace(/\s+/g, ' '));
}

function ghIdentity(url: string | null | undefined): { owner: string; name: string } | null {
  if (!url) return null;
  const m = String(url).match(/github\.com[/:]+([^/]+)\/([^/#?]+)/i);
  if (!m) return null;
  return { owner: m[1].toLowerCase(), name: m[2].replace(/\.git$/i, '').toLowerCase() };
}

function sameRepo(a: { owner: string; name: string } | null, b: { owner: string; name: string } | null) {
  return !!a && !!b && a.owner === b.owner && a.name === b.name;
}

/* ------------------------------------------------------------------ *
 * Candidate names are derived ONLY from the entry's own repo path — no
 * vendor-name templating, no "well-known package" table. If the repo is
 * `owner/mcp-server-foo`, the plausible published names are that string,
 * the scoped `@owner/mcp-server-foo`, and the two conventional MCP
 * suffix swaps. Each one still has to be ratified by the registry.
 * ------------------------------------------------------------------ */
function npmCandidates(id: { owner: string; name: string }): string[] {
  const { owner, name } = id;
  const out = new Set<string>([name, `@${owner}/${name}`]);
  // owner/mcp-server-foo  <->  owner/foo-mcp-server are the two conventions
  // the ecosystem actually uses; nothing else is inferred.
  if (name.startsWith('mcp-server-')) {
    const base = name.slice('mcp-server-'.length);
    out.add(`${base}-mcp-server`);
    out.add(`@${owner}/${base}-mcp-server`);
  }
  if (name.endsWith('-mcp-server')) {
    const base = name.slice(0, -'-mcp-server'.length);
    out.add(`mcp-server-${base}`);
    out.add(`@${owner}/mcp-server-${base}`);
  }
  return [...out];
}

function pypiCandidates(id: { owner: string; name: string }): string[] {
  const { name } = id;
  const out = new Set<string>([name, name.replace(/_/g, '-')]);
  if (name.startsWith('mcp-server-')) out.add(`${name.slice('mcp-server-'.length)}-mcp-server`);
  if (name.endsWith('-mcp-server')) out.add(`mcp-server-${name.slice(0, -'-mcp-server'.length)}`);
  return [...out];
}

async function fetchJSON(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'mymcptools-install-completeness-sweep' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function resolveNpm(pkg: string): Promise<{ declaredRepo: string | null; executable: boolean } | null> {
  const doc = await fetchJSON(`https://registry.npmjs.org/${pkg.replace('/', '%2F')}`);
  if (!doc) return null;
  const latest = doc['dist-tags']?.latest;
  const v = latest ? doc.versions?.[latest] : undefined;
  const repo = v?.repository?.url ?? doc.repository?.url ?? v?.homepage ?? doc.homepage ?? null;
  // `bin` is precisely what decides whether `npx pkg` runs something or errors
  // with "could not determine executable to run". A library without it is not
  // an install command no matter who owns it.
  const bin = v?.bin;
  const executable = typeof bin === 'string' ? true : !!bin && Object.keys(bin).length > 0;
  return { declaredRepo: repo ? String(repo) : null, executable };
}

/* ------------------------------------------------------------------ *
 * MINIMAL ZIP READER
 * A wheel is a zip. We need exactly one member out of it
 * (`*.dist-info/entry_points.txt`), so rather than take a dependency we
 * walk the central directory and inflate that one entry. Only the two
 * compression methods wheels actually use are supported: 0 (stored) and
 * 8 (deflate). Anything else is treated as unreadable, which degrades to
 * "unconfirmed" — never to a false positive.
 * ------------------------------------------------------------------ */
function readZipMember(buf: Buffer, match: (name: string) => boolean): string | null {
  // End of Central Directory: scan back from the tail for the signature.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66_000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');

    if (match(name)) {
      // The central directory's name/extra lengths are not necessarily the
      // local header's, so re-read them from the local header before slicing.
      if (buf.readUInt32LE(localOff) !== 0x04034b50) return null;
      const lNameLen = buf.readUInt16LE(localOff + 26);
      const lExtraLen = buf.readUInt16LE(localOff + 28);
      const start = localOff + 30 + lNameLen + lExtraLen;
      const raw = buf.subarray(start, start + compSize);
      try {
        if (method === 0) return raw.toString('utf8');
        if (method === 8) return inflateRawSync(raw).toString('utf8');
      } catch { return null; }
      return null;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

/** console_scripts declared by the wheel — the exact table `uvx` resolves against. */
function parseConsoleScripts(entryPoints: string): string[] {
  const out: string[] = [];
  let inSection = false;
  for (const line of entryPoints.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    if (t.startsWith('[')) { inSection = /^\[console_scripts\]$/i.test(t); continue; }
    if (!inSection) continue;
    const eq = t.indexOf('=');
    if (eq > 0) out.push(t.slice(0, eq).trim());
  }
  return out;
}

/** Hard cap: a wheel this big is a compiled/data package, not an MCP server CLI. */
const MAX_WHEEL_BYTES = 12 * 1024 * 1024;

async function pypiConsoleScripts(doc: any): Promise<string[] | null> {
  const files: any[] = Array.isArray(doc?.urls) ? doc.urls : [];
  // Prefer a pure-python wheel; they are small and always carry the same
  // entry_points.txt as the platform wheels for the same version.
  const wheels = files
    .filter((f) => f?.packagetype === 'bdist_wheel' && typeof f.url === 'string')
    .filter((f) => typeof f.size !== 'number' || f.size <= MAX_WHEEL_BYTES)
    .sort((a, b) => {
      const pa = /-py3-none-any\.whl$/i.test(a.filename ?? '') ? 0 : 1;
      const pb = /-py3-none-any\.whl$/i.test(b.filename ?? '') ? 0 : 1;
      return pa - pb || (a.size ?? 0) - (b.size ?? 0);
    });
  if (!wheels.length) return null; // sdist-only: no built metadata to read.
  try {
    const res = await fetch(wheels[0].url, {
      headers: { 'user-agent': 'mymcptools-install-completeness-sweep' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_WHEEL_BYTES) return null;
    const txt = readZipMember(buf, (n) => /(^|\/)[^/]+\.dist-info\/entry_points\.txt$/i.test(n));
    if (txt === null) return []; // wheel read fine, no entry_points => library
    return parseConsoleScripts(txt);
  } catch {
    return null;
  }
}

async function resolvePypi(
  pkg: string,
): Promise<{ declaredRepo: string | null; doc: any } | null> {
  const doc = await fetchJSON(`https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`);
  if (!doc) return null;
  const urls = doc.info?.project_urls ?? {};
  const candidate =
    Object.values(urls).find((u) => typeof u === 'string' && /github\.com/i.test(u)) ??
    (typeof doc.info?.home_page === 'string' && /github\.com/i.test(doc.info.home_page)
      ? doc.info.home_page
      : null);
  return { declaredRepo: candidate ? String(candidate) : null, doc };
}

async function main() {
  const blanks = servers.filter((s) => isEmptyCommand(s.install_command));
  const findings: Finding[] = [];

  // Highest-star first: these are the pages with the most inbound interest,
  // and the resolver's network budget should go to them before the long tail.
  const ordered = [...blanks].sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
  // `--limit` caps DISPLAY; the resolver gets its own budget so a short report
  // no longer silently shrinks coverage (the 2026-08-07 run resolved 40 of 403
  // resolvable entries for exactly that reason).
  const resolveBudget = RESOLVE ? (Number(val('budget') ?? '0') || 1000) : 0;
  let resolved = 0;

  for (const s of ordered) {
    const id = ghIdentity(s.github_url);
    const words = String(s.description ?? '').trim().split(/\s+/).filter(Boolean).length;

    if (!id) {
      findings.push({
        slug: s.slug, name: s.name, severity: 'critical', install_type: s.install_type,
        github_url: s.github_url ?? null, stars: s.stars ?? 0, descriptionWords: words,
        note: 'No install command AND no repository — the page gives a reader no path to the software at all.',
      });
      continue;
    }

    const registryBacked = s.install_type === 'npm' || s.install_type === 'pip';
    if (!registryBacked) {
      findings.push({
        slug: s.slug, name: s.name, severity: 'low', install_type: s.install_type,
        github_url: s.github_url ?? null, stars: s.stars ?? 0, descriptionWords: words,
        note: `${s.install_type} install has no registry to resolve against; the command must be read out of the repo README.`,
      });
      continue;
    }

    if (resolved >= resolveBudget) {
      findings.push({
        slug: s.slug, name: s.name, severity: 'medium', install_type: s.install_type,
        github_url: s.github_url ?? null, stars: s.stars ?? 0, descriptionWords: words,
        note: 'Not resolved this run (outside --resolve budget).',
      });
      continue;
    }

    resolved++;
    const registry = s.install_type === 'npm' ? 'npm' : 'PyPI';
    const cands = s.install_type === 'npm' ? npmCandidates(id) : pypiCandidates(id);
    const nearMisses: { package: string; declaredRepo: string | null }[] = [];
    let hit: Finding['resolved'] | undefined;

    for (const pkg of cands) {
      const meta = s.install_type === 'npm' ? await resolveNpm(pkg) : await resolvePypi(pkg);
      if (!meta) continue; // 404 on the registry — the guess was simply wrong.
      if (sameRepo(ghIdentity(meta.declaredRepo), id)) {
        let executable: boolean;
        let command: string;
        if (s.install_type === 'npm') {
          executable = (meta as { executable: boolean }).executable;
          command = `npx -y ${pkg}`;
        } else {
          // Read the wheel's own console_scripts table. null = could not read
          // (sdist-only, oversized, unparseable zip) => unconfirmed, held back.
          const scripts = await pypiConsoleScripts((meta as { doc: any }).doc);
          executable = Array.isArray(scripts) && scripts.length > 0;
          // `uvx X` runs the script named X, not the package named X.
          const direct = scripts?.includes(pkg) || scripts?.includes(pkg.replace(/-/g, '_'));
          command = !executable
            ? `uvx ${pkg}`
            : direct
              ? `uvx ${pkg}`
              : `uvx --from ${pkg} ${scripts![0]}`;
        }
        hit = {
          package: pkg,
          registry: registry as 'npm' | 'PyPI',
          command,
          declaredRepo: meta.declaredRepo ?? '',
          executable,
          entrypoint_unconfirmed: !executable,
        };
        break;
      }
      // Exists, but its own metadata points somewhere else. Reporting this is
      // the point: it is the squat/collision shape the npm sweep was built for,
      // and writing it would have been the fabrication we are avoiding.
      nearMisses.push({ package: pkg, declaredRepo: meta.declaredRepo });
    }

    findings.push({
      slug: s.slug, name: s.name,
      // Only an executable-confirmed candidate is a ready fix. Repo agreement
      // without an entry point stays `medium`: it names the right package but
      // cannot promise the command runs.
      severity: hit?.executable ? 'high' : 'medium',
      install_type: s.install_type, github_url: s.github_url ?? null,
      stars: s.stars ?? 0, descriptionWords: words,
      resolved: hit,
      nearMisses: nearMisses.length ? nearMisses : undefined,
      note: hit?.executable
        ? `${registry} package "${hit.package}" declares ${hit.declaredRepo} AND ships a bin — the command is derived and runnable, not guessed.`
        : hit
          ? `${registry} package "${hit.package}" belongs to this repo but ${registry === 'npm' ? 'declares no bin — it is a library, `npx` would error' : 'its wheel declares no [console_scripts] (or no readable wheel exists) — `uvx` would error'}. NOT written.`
        : nearMisses.length
          ? `No ${registry} package declares this repo. ${nearMisses.length} name(s) exist but belong elsewhere — do NOT write them.`
          : `No ${registry} package found under any name derived from the repo path; read the README.`,
    });
  }

  findings.sort((a, b) => RANK[a.severity] - RANK[b.severity] || b.stars - a.stars);
  const shown = findings.filter((f) => RANK[f.severity] <= RANK[MIN]);

  const counts = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1;
    return acc;
  }, {});

  const report = {
    generated_at: new Date().toISOString(),
    catalog_entries: servers.length,
    blank_install_command: blanks.length,
    blank_pct: Math.round((blanks.length / servers.length) * 1000) / 10,
    resolve_attempted: resolved,
    counts,
    findings,
  };
  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  if (AS_JSON) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\nINSTALL-COMMAND COMPLETENESS SWEEP`);
  console.log(`  catalog entries ............ ${servers.length}`);
  console.log(`  blank install_command ...... ${blanks.length} (${report.blank_pct}% — Installation section is not rendered on these pages)`);
  console.log(`  registry resolve attempted . ${resolved}`);
  console.log(`  critical=${counts.critical ?? 0} high=${counts.high ?? 0} medium=${counts.medium ?? 0} low=${counts.low ?? 0}\n`);

  if (SHOW_FIXES) {
    const fixes = findings.filter((f) => f.resolved?.executable);
    const held = findings.filter((f) => f.resolved && !f.resolved.executable);
    console.log(`READY FIXES (repo-agreed AND executable, ${fixes.length}):`);
    for (const f of fixes) {
      console.log(`  ${f.slug.padEnd(30)} ${String(f.stars).padStart(6)}★  ${f.resolved!.command}`);
      console.log(`  ${''.padEnd(30)}         declares ${f.resolved!.declaredRepo}`);
    }
    console.log(`\nHELD BACK — right package, no proven entry point (${held.length}):`);
    for (const f of held) {
      console.log(`  ${f.slug.padEnd(30)} ${String(f.stars).padStart(6)}★  ${f.resolved!.package} (${f.resolved!.registry})`);
    }
    console.log('');
  }

  for (const f of shown.slice(0, LIMIT || shown.length)) {
    console.log(`[${f.severity.toUpperCase()}] ${f.slug} (${f.stars}★, ${f.install_type}, ${f.descriptionWords}w desc)`);
    console.log(`  repo: ${f.github_url ?? '(none)'}`);
    console.log(`  ${f.note}`);
    if (f.nearMisses) for (const n of f.nearMisses) console.log(`    near-miss: ${n.package} -> ${n.declaredRepo ?? '(no repo declared)'}`);
  }
  console.log(`\nreport: ${REPORT_FILE}`);
}

await main();
