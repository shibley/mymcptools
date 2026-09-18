/**
 * Repo-join selfcheck for listing freshness dates (thread #262).
 *
 * The "last commit" date on a listing page comes from one of two committed
 * sweeps, keyed only by slug. When the catalog re-points a listing at a
 * different repository the sweep row goes stale and, before this guard, the
 * page kept rendering the OLD repository's activity. Baseline when written
 * (2026-09-17): 46 listings (45 static-signals, 1 repo-recency).
 *
 * This walks every catalog entry through the real accessors and fails if any
 * rendered date was swept from a repository other than the one the listing
 * links. It also prints the raw drift count, which is the backlog a re-sweep
 * (`npm run static:signals`) would clear.
 *
 * Run: npm run signals:selfcheck
 */
import { readFileSync } from "node:fs";
import { servers } from "../src/data/servers";
import { getRepoRecency } from "../src/lib/trust/repo-recency";
import { getStaticSignal } from "../src/lib/trust/static-signals-store";
import { repoKey } from "../src/lib/trust/listing-repo";

const ss = JSON.parse(readFileSync("src/data/static-signals.json", "utf8"));
const rr = JSON.parse(readFileSync("src/data/repo-recency.json", "utf8"));
const ssBy = new Map<string, any>(ss.signals.map((s: any) => [s.slug, s]));

let failures = 0;
let rawDrift = 0;
let rendered = 0;
for (const s of servers) {
  const ours = repoKey(s.github_url);
  const r = rr.entries[s.slug];
  const x = ssBy.get(s.slug);
  // What the pre-guard code would have rendered, and from which repo.
  const rawFrom = r?.pushedAt ? r.repo : x?.last_commit_at ? x.repo_url : null;
  if (rawFrom && repoKey(rawFrom) !== ours) rawDrift++;

  const got = getRepoRecency(s.slug);
  if (!got) continue;
  rendered++;
  const fromRR = r?.pushedAt === got.lastCommitAt && repoKey(r.repo) === ours;
  const fromSS = x?.last_commit_at === got.lastCommitAt && repoKey(x.repo_url) === ours;
  if (!fromRR && !fromSS) {
    failures++;
    if (failures <= 20) console.log(`  FAIL ${s.slug}: renders ${got.lastCommitAt} not swept from ${s.github_url || "(no repo)"}`);
  }
  const sig = getStaticSignal(s.slug);
  if (sig && repoKey(sig.repo_url) !== null && repoKey(sig.repo_url) !== ours) {
    failures++;
    console.log(`  FAIL ${s.slug}: static signal from ${sig.repo_url} still served`);
  }
}

// Named regressions from the baseline.
const named: Array<[string, string]> = [["yfinance-mcp", "modelcontextprotocol/servers"], ["esp32-mcp", "espressif/esp-idf"]];
for (const [slug, wrong] of named) {
  const sig = getStaticSignal(slug);
  if (sig && repoKey(sig.repo_url) === wrong) { failures++; console.log(`  FAIL ${slug} still carries ${wrong}'s signal`); }
}

console.log(`catalog ${servers.length} · dates rendered ${rendered} · raw sweep rows pointing at a different repo ${rawDrift} (re-sweep backlog)`);
if (failures) { console.log(`${failures} CHECK(S) FAILED`); process.exit(1); }
console.log("signal repo-join selfcheck: every rendered date comes from the linked repository");
