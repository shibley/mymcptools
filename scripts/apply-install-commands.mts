/**
 * APPLY the verified install commands produced by
 * `install-command-completeness-sweep.mts` into src/data/servers.ts.
 *
 * WHY THIS EXISTS
 *   The sweep is deliberately read-only, and for fifteen fires that was the
 *   right call: the failure mode this catalog keeps hitting is confident
 *   writes of unverified data. But read-only also meant every fix was applied
 *   by hand, which is why the 2026-08-07 fire landed 16 of them and the
 *   remaining ~1,100 blanks stayed blank. The pipeline was proven and then
 *   throttled by transcription.
 *
 *   This applier removes that throttle WITHOUT lowering the evidence bar. It
 *   refuses to invent anything. Its only input is the sweep's report file, and
 *   it writes only findings the sweep already marked `resolved.executable` —
 *   i.e. the registry confirmed the package belongs to the entry's own repo
 *   AND the package ships a real entry point (npm `bin`, or a
 *   `[console_scripts]` table read out of the PyPI wheel).
 *
 * THE THIRD GATE THIS ADDS: IDENTITY COHERENCE
 *   Registry agreement proves the package matches the entry's `github_url`.
 *   It cannot prove the `github_url` matches the ENTRY. If a row's repo link
 *   is itself mis-linked, agreement holds perfectly and the sweep happily
 *   derives a runnable command for the wrong software — which is worse than a
 *   blank field, because it is confidently wrong.
 *
 *   This is not hypothetical. On the first full run, `thegraph-mcp` ("The
 *   Graph Protocol MCP", blockchain subgraph queries) was linked to
 *   `shaneholloman/mcp-knowledge-graph`, an unrelated local-memory server.
 *   Agreement PASSED and the pipeline was one step from writing
 *   `npx -y mcp-knowledge-graph` onto The Graph's page.
 *
 *   So before writing, every fix must show a token overlap between the entry's
 *   slug/name and its repo path. No overlap => SKIPPED and reported for a human
 *   to look at, never written. That check is cheap and it is the only one that
 *   can catch an upstream mis-link.
 *
 * REPLACING A PHANTOM COMMAND (added 2026-08-18)
 *   The sweep now also reports entries whose command names a package that does
 *   not exist. Those are overwrites, not insertions, and an overwrite can
 *   destroy a good hand fix in a way an insertion cannot. So a replacement
 *   carries the EXACT string it expects to find, and is written only if the
 *   file still contains that string verbatim at that entry. If someone
 *   repaired the row since the sweep ran, the finding is SKIPPED as stale
 *   rather than applied. A replacement whose new command equals the old one is
 *   a no-op and is skipped too.
 *
 * WRITING A COMMAND IS THREE WRITES, NOT ONE
 *   `/servers/[slug]` does not read `install_command` alone. It asks
 *   `installVerdict()`, which prefers the dated row in
 *   `src/data/install-registry-check.json` over the frozen `install_verified`
 *   field. That file is keyed by SLUG and still holds the OLD package name, so
 *   swapping a phantom command without touching it leaves the page rendering a
 *   brand-new, verified command under a banner saying the package does not
 *   exist — the exact false negative the 2026-08-17 fire was written to kill,
 *   reintroduced from the other side.
 *
 *   So every write here updates all three: the command, the row's
 *   `install_verified`/`install_checked`, and the registry-check row (package
 *   name, `exists: true`, today's date). The evidence is the same evidence the
 *   sweep already gathered — the registry was queried this run — so this dates
 *   a check that happened, it does not assert one that did not.
 *
 * Usage:
 *   node --experimental-strip-types scripts/apply-install-commands.mts [--write]
 * Dry-run by default. Re-run the sweep first; a stale report is refused.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_FILE = join(__dirname, '.install-completeness-report.json');
const SERVERS_FILE = join(__dirname, '..', 'src', 'data', 'servers.ts');
const WRITE = process.argv.includes('--write');

interface Finding {
  slug: string;
  name: string;
  github_url: string | null;
  stars: number;
  resolved?: { package: string; registry: string; command: string; executable: boolean };
  /** Present when this entry already carries a command that names a nonexistent package. */
  phantom?: { command: string; package: string; registry: string; checkedAt: string };
}

/** Word-ish tokens, minus the noise every entry in an MCP catalog shares. */
const NOISE = new Set(['mcp', 'server', 'servers', 'api', 'the', 'io', 'js', 'py', 'app', 'co', 'com']);
function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !NOISE.has(t));
}

/**
 * Does the repo path plausibly belong to this entry? One shared meaningful
 * token is enough — the check exists to catch entries pointing at unrelated
 * software, not to enforce naming style.
 *
 * Substring matching is allowed but only for tokens of 6+ characters. Short
 * tokens collide too easily to carry that weight ("graph", "cloud", "data"),
 * so they must match exactly; containment is reserved for tokens long enough
 * that the overlap means something ("nationalparks" contains "national").
 *
 * LIMIT, STATED PLAINLY: this catches repo links pointing at software with a
 * DIFFERENT name. It cannot catch a mis-link that shares a real word with the
 * entry. `thegraph-mcp` ("The Graph Protocol MCP") pointed at
 * `shaneholloman/mcp-knowledge-graph`, an unrelated local-memory server, and
 * both sides legitimately contain "graph" — no token rule distinguishes them.
 * That row was found by eyeballing the sweep's output and repaired by hand
 * (2026-08-08). So: this gate raises the floor, it is not a substitute for
 * reading the ready-fix list before passing --write.
 */
const MIN_SUBSTRING_TOKEN = 6;
function identityCoheres(slug: string, name: string, repoUrl: string): boolean {
  const repo = tokens(repoUrl.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, ''));
  const entry = [...new Set([...tokens(slug), ...tokens(name)])];
  if (!entry.length || !repo.length) return false;
  return entry.some((e) =>
    repo.some((r) => {
      if (r === e) return true;
      const shorter = Math.min(r.length, e.length);
      if (shorter < MIN_SUBSTRING_TOKEN) return false;
      return r.includes(e) || e.includes(r);
    }),
  );
}

const CHECK_FILE = join(__dirname, '..', 'src', 'data', 'install-registry-check.json');
const TODAY = new Date().toISOString().slice(0, 10);

const report = JSON.parse(readFileSync(REPORT_FILE, 'utf8'));
let src = readFileSync(SERVERS_FILE, 'utf8');

/**
 * Re-point the entry's own verification fields at the command we just wrote.
 * Operates on the entry block only, bounded by the next `slug:` line, so it can
 * never write into a neighbour.
 */
function markVerified(source: string, slug: string): string {
  const slugRe = new RegExp(`\\n(\\s*)slug: '${slug.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}',\\n`);
  const m = slugRe.exec(source);
  if (!m) return source;
  const indent = m[1];
  const start = m.index + 1;
  const nextSlug = source.indexOf(`\n${indent}slug: '`, start + 1);
  const end = nextSlug === -1 ? source.length : nextSlug;
  let block = source.slice(start, end);

  if (/^\s*install_verified:/m.test(block)) {
    block = block.replace(/^(\s*)install_verified: (?:true|false),$/m, '$1install_verified: true,');
  } else {
    block = block.replace(/^(\s*)install_command: '[^']*',$/m, `$&\n${indent}install_verified: true,`);
  }
  if (/^\s*install_checked:/m.test(block)) {
    block = block.replace(/^(\s*)install_checked: '[^']*',$/m, `$1install_checked: '${TODAY}',`);
  } else {
    block = block.replace(/^(\s*)install_verified: true,$/m, `$&\n${indent}install_checked: '${TODAY}',`);
  }
  return source.slice(0, start) + block + source.slice(end);
}

const ready: Finding[] = (report.findings as Finding[]).filter((f) => f.resolved?.executable);
const applied: Finding[] = [];
const replaced: Finding[] = [];
const skipped: { f: Finding; why: string }[] = [];

for (const f of ready) {
  if (!f.github_url || !identityCoheres(f.slug, f.name, f.github_url)) {
    skipped.push({ f, why: `identity mismatch — "${f.name}" vs ${f.github_url} (entry repo link is suspect; fix the link first)` });
    continue;
  }

  // Locate this entry's object literal by its slug line, then bound it at the
  // next `slug:` so we can never write into a neighbouring entry.
  const slugRe = new RegExp(`\\n(\\s*)slug: '${f.slug.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}',\\n`);
  const m = slugRe.exec(src);
  if (!m) { skipped.push({ f, why: 'slug line not found in servers.ts' }); continue; }

  const indent = m[1];
  const start = m.index + 1;
  const nextSlug = src.indexOf(`\n${indent}slug: '`, start + 1);
  const end = nextSlug === -1 ? src.length : nextSlug;
  const block = src.slice(start, end);

  const cmd = f.resolved!.command;
  if (cmd.includes("'")) { skipped.push({ f, why: 'command contains a quote; refusing to emit' }); continue; }

  const existing = /^(\s*)install_command: '([^']*)',$/m.exec(block);

  if (f.phantom) {
    // Overwrite path. The expected string is the contract: if the row no
    // longer holds it, someone else already touched this entry and the
    // report is stale for it.
    if (!existing) { skipped.push({ f, why: 'report says phantom but the entry has no install_command line (stale)' }); continue; }
    if (existing[2] !== f.phantom.command) {
      skipped.push({ f, why: `install_command changed since the sweep ran — file has '${existing[2]}', report expected '${f.phantom.command}' (stale; re-run the sweep)` });
      continue;
    }
    if (existing[2] === cmd) { skipped.push({ f, why: 'resolved command is identical to the current one (no-op)' }); continue; }
    const at = start + existing.index;
    src = `${src.slice(0, at)}${existing[1]}install_command: '${cmd}',${src.slice(at + existing[0].length)}`;
    replaced.push(f);
    continue;
  }

  if (existing) {
    skipped.push({ f, why: 'entry already has install_command (report is stale — re-run the sweep)' });
    continue;
  }

  // Anchor on install_type so the new field lands beside the field it qualifies.
  const anchor = /^(\s*)install_type: '[^']*',$/m.exec(block);
  if (!anchor) { skipped.push({ f, why: 'no install_type line to anchor against' }); continue; }

  const insertAt = start + anchor.index + anchor[0].length;
  src = `${src.slice(0, insertAt)}\n${anchor[1]}install_command: '${cmd}',${src.slice(insertAt)}`;
  applied.push(f);
}

console.log(`\nAPPLY INSTALL COMMANDS  (${WRITE ? 'WRITE' : 'dry-run'})`);
console.log(`  verified-ready in report ... ${ready.length}`);
console.log(`  filled (was blank) ......... ${applied.length}`);
console.log(`  replaced (was phantom) ..... ${replaced.length}`);
console.log(`  skipped .................... ${skipped.length}\n`);

for (const f of applied) console.log(`  + ${f.slug.padEnd(28)} ${f.resolved!.command}`);
for (const f of replaced) console.log(`  ~ ${f.slug.padEnd(28)} ${f.phantom!.command}  ->  ${f.resolved!.command}`);
if (skipped.length) {
  console.log(`\nSKIPPED (never written — needs a human):`);
  for (const s of skipped) console.log(`  ! ${s.f.slug.padEnd(28)} ${s.why}`);
}

if (WRITE) {
  for (const f of [...applied, ...replaced]) src = markVerified(src, f.slug);
  writeFileSync(SERVERS_FILE, src);
  console.log(`\nwrote ${SERVERS_FILE}`);

  // The registry-check artifact is what the page actually believes. Leaving the
  // old package name here would put a "does not exist" banner over a command
  // whose package we just confirmed.
  const check = JSON.parse(readFileSync(CHECK_FILE, 'utf8'));
  check.entries ??= {};
  for (const f of [...applied, ...replaced]) {
    check.entries[f.slug] = {
      registry: f.resolved!.registry === 'npm' ? 'npm' : 'pip',
      package: f.resolved!.package,
      exists: true,
      checkedAt: TODAY,
    };
  }
  writeFileSync(CHECK_FILE, `${JSON.stringify(check, null, 2)}\n`);
  console.log(`wrote ${CHECK_FILE} (${applied.length + replaced.length} rows re-dated ${TODAY})`);
} else {
  console.log(`\n(dry-run — pass --write to apply)`);
}
