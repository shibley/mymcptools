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

const report = JSON.parse(readFileSync(REPORT_FILE, 'utf8'));
let src = readFileSync(SERVERS_FILE, 'utf8');

const ready: Finding[] = (report.findings as Finding[]).filter((f) => f.resolved?.executable);
const applied: Finding[] = [];
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

  if (/^\s*install_command:/m.test(block)) {
    skipped.push({ f, why: 'entry already has install_command (report is stale — re-run the sweep)' });
    continue;
  }

  // Anchor on install_type so the new field lands beside the field it qualifies.
  const anchor = /^(\s*)install_type: '[^']*',$/m.exec(block);
  if (!anchor) { skipped.push({ f, why: 'no install_type line to anchor against' }); continue; }

  const cmd = f.resolved!.command;
  if (cmd.includes("'")) { skipped.push({ f, why: 'command contains a quote; refusing to emit' }); continue; }

  const insertAt = start + anchor.index + anchor[0].length;
  src = `${src.slice(0, insertAt)}\n${anchor[1]}install_command: '${cmd}',${src.slice(insertAt)}`;
  applied.push(f);
}

console.log(`\nAPPLY INSTALL COMMANDS  (${WRITE ? 'WRITE' : 'dry-run'})`);
console.log(`  verified-ready in report ... ${ready.length}`);
console.log(`  applied .................... ${applied.length}`);
console.log(`  skipped .................... ${skipped.length}\n`);

for (const f of applied) console.log(`  + ${f.slug.padEnd(28)} ${f.resolved!.command}`);
if (skipped.length) {
  console.log(`\nSKIPPED (never written — needs a human):`);
  for (const s of skipped) console.log(`  ! ${s.f.slug.padEnd(28)} ${s.why}`);
}

if (WRITE) {
  writeFileSync(SERVERS_FILE, src);
  console.log(`\nwrote ${SERVERS_FILE}`);
} else {
  console.log(`\n(dry-run — pass --write to apply)`);
}
