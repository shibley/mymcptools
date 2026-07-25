/**
 * Second-opinion audit over search-derived repairs only.
 *
 * WHY: search matches on repo NAME, which is enough to be confident the repo
 * is *an MCP server named after this thing* but not that it is *this thing*.
 * Name collisions slip through — "Plaid MCP" (the fintech) matched
 * PLAID-lib/plaid-mcp-server (a physics dataset library that happens to be
 * called PLAID). npm/PyPI-derived repairs are NOT audited: those came from the
 * package the catalog entry itself tells users to install, so provenance is
 * direct and a description mismatch doesn't make them wrong.
 *
 * The audit pulls the repo's own description + topics and requires them to
 * share vocabulary with the catalog entry's description. Failures are demoted
 * back to unresolved, so the applier nulls them.
 *
 * Run: node scripts/audit-search-matches.mts [--dry-run]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { servers } from '../src/data/servers.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '.resolve-state.json');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const dryRun = process.argv.includes('--dry-run');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const STOP = new Set(['the','a','an','for','and','or','to','of','with','server','servers','mcp','model','context','protocol','tool','tools','api','client','integration','official','unofficial','open','source','via','your','via','that','this','from','into','using','use','all','get','set','you','can','are','its','it','support','supports']);
const toks = (s: string) =>
  new Set((s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((t) => t.length >= 4 && !STOP.has(t)));

const state = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as Record<string, any>;
const byslug = new Map(servers.map((s) => [s.slug, s]));

const targets = Object.values(state).filter((r: any) => r.verdict === 'repaired' && r.method === 'search');
console.log(`[audit] auditing ${targets.length} search-derived repairs`);

let demoted = 0, kept = 0;
for (const r of targets as any[]) {
  const entry = byslug.get(r.slug);
  if (!entry) continue;
  // Owner-matched repairs are exempt. If the repo is owned by the account the
  // entry already names as author (calcom/cal-mcp for Cal.com), that is the
  // strongest evidence available and a thin or empty repo description must not
  // override it — vocabulary overlap is a proxy for identity, ownership IS
  // identity. Only community matches are audited, which is where the name
  // collisions live.
  if (typeof r.evidence === 'string' && r.evidence.includes('owned by the claimed author')) {
    kept++;
    continue;
  }
  const res = await fetch(`https://api.github.com/repos/${r.repoFullName}`, {
    headers: {
      'User-Agent': 'mymcptools-audit/0.1.0',
      Accept: 'application/vnd.github+json',
      ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
    },
  });
  await sleep(1000);
  const body: any = res.status === 200 ? await res.json() : null;
  const repoText = `${body?.description ?? ''} ${(body?.topics ?? []).join(' ')}`;

  const claim = toks(entry.description);
  const repo = toks(repoText);
  let shared = 0;
  for (const t of claim) if (repo.has(t)) shared++;

  // A repo with no description at all can't be audited this way; the name
  // match already cleared the (strict) search bar, so it is left alone rather
  // than punished for missing metadata.
  const auditable = repoText.trim().length > 0;
  if (auditable && shared === 0) {
    r.verdict = 'unresolved';
    r.auditNote = `demoted: repo "${r.repoFullName}" description shares no vocabulary with the catalog entry — likely a name collision`;
    delete r.newUrl;
    demoted++;
    console.log(`  demote  ${r.slug} → ${r.repoFullName}`);
  } else {
    kept++;
  }
}

console.log('[audit]', { kept, demoted });
if (!dryRun) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
  console.log('[audit] wrote', STATE_FILE);
}
