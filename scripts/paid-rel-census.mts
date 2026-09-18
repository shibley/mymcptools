/**
 * Paid-link rel census (thread #262).
 *
 * Asserts, offline, that no anchor pointing at a listing's own website or
 * repository can render as a FOLLOWED link on a paid listing. Two halves:
 *
 *   1. Source census: every `<a href={server.website_url}>` /
 *      `href={server.github_url}` in src/app and src/components must take its
 *      rel from `listingOutboundRel()`. A hard-coded rel string on one of
 *      these anchors is a failure — that is exactly how the defect shipped.
 *   2. Helper behaviour: every paid row in the static catalog resolves to a
 *      rel containing `sponsored`, and free rows (incl. the 56 free
 *      `featured` grants) do not.
 *
 * Baseline when written (2026-09-17): 3 listing anchors, 3 hard-coded,
 * 1 of 1 paid listings (coinrule) served a followed link to its own domain.
 *
 * Run: npm run rel:census
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { listingOutboundRel } from "../src/lib/outbound-rel.ts";

let failures = 0;
const fail = (msg: string) => { failures++; console.log(`  FAIL ${msg}`); };
const ok = (msg: string) => console.log(`  ok   ${msg}`);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

// ---- 1. source census -------------------------------------------------------
console.log("# listing anchors in source");
const ANCHOR = /<a\b[^>]*?href=\{\s*(?:server|s|listing)\.(website_url|github_url)\s*\}[^>]*>/g;
let anchors = 0;
for (const file of [...walk("src/app"), ...walk("src/components")]) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(ANCHOR)) {
    anchors++;
    const tag = m[0];
    const line = text.slice(0, m.index).split("\n").length;
    const where = `${file}:${line} (${m[1]})`;
    if (/rel=\{\s*listingOutboundRel\(/.test(tag)) ok(where);
    else fail(`${where} hard-codes its rel — use listingOutboundRel(server)`);
  }
}
if (anchors === 0) fail("found 0 listing anchors — the census pattern no longer matches the source");

// ---- 2. helper behaviour over the real catalog ------------------------------
console.log("\n# helper over the static catalog");
const mod = await import("../src/data/servers.ts");
const servers = mod.servers as unknown as Array<{ slug: string; paid_placement?: boolean; sponsored?: boolean; featured?: boolean }>;
const paid = servers.filter((s) => s.paid_placement || s.sponsored);
const freeFeatured = servers.filter((s) => s.featured && !s.paid_placement && !s.sponsored);
for (const s of paid) {
  if (listingOutboundRel(s).split(" ").includes("sponsored")) ok(`${s.slug}: paid -> sponsored`);
  else fail(`${s.slug}: paid listing renders a followed link`);
}
const leaked = freeFeatured.filter((s) => listingOutboundRel(s).includes("sponsored"));
if (leaked.length) fail(`${leaked.length} free featured rows marked sponsored: ${leaked.map((s) => s.slug).join(", ")}`);
else ok(`${freeFeatured.length} free featured rows stay followed`);
if (!listingOutboundRel({ paid_placement: true }).includes("sponsored")) fail("overlay-shaped paid row not sponsored");
else ok("overlay-shaped paid row (paid_placement: true) -> sponsored");

console.log(`\n${anchors} listing anchors · ${paid.length} paid static rows · ${freeFeatured.length} free featured`);
if (failures) { console.log(`${failures} CHECK(S) FAILED`); process.exit(1); }
console.log("paid-rel census: all assertions passed");
