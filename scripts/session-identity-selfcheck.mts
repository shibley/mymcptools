/**
 * Equivalence check for the beacon session-identity join key (thread #224).
 *
 * `analytics.events.session_hash` is a JOIN KEY: `/api/collect` pageview rows,
 * `/api/mcp:*` rows and `/api/v1/*` rows are only comparable to each other if
 * all three derive it byte-for-byte identically. Until this check existed there
 * were three separate copies of the derivation and nothing could tell you if one
 * had drifted — a divergence produces no error, just rows that silently stop
 * joining.
 *
 * LEGACY_* below is the derivation as it was inlined in
 * src/lib/analytics/mcp-usage.ts and src/lib/analytics/trust-api-usage.ts before
 * they were collapsed onto src/lib/session-identity.ts. It is kept verbatim on
 * purpose: it is the reference the canonical module must keep reproducing, so
 * the refactor is provably a no-op and any future edit to the canonical module
 * that changes the wire value fails here.
 *
 * Run: npm run identity:selfcheck
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { sessionHash } from "../src/lib/session-identity.ts";

// ---- the pre-#224 inlined derivation, copied verbatim ----------------------
function legacySalt(): string {
  const explicit = process.env.ANALYTICS_SALT?.trim();
  if (explicit) return explicit;
  const cs = process.env.ANALYTICS_DATABASE_URL || "unsalted";
  return createHash("sha256").update(cs).digest("hex").slice(0, 32);
}
function legacyClientIp(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") || h.get("cf-connecting-ip") || "0.0.0.0";
}
function legacyTrunc(v: unknown, n: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, n) : null;
}
function legacySessionHash(h: Headers): string {
  const ua = legacyTrunc(h.get("user-agent"), 512);
  const utcDate = new Date().toISOString().slice(0, 10);
  return createHash("sha256")
    .update(`${legacyClientIp(h)}|${ua || ""}|${utcDate}|${legacySalt()}`)
    .digest("hex")
    .slice(0, 32);
}
// ---------------------------------------------------------------------------

const LONG_UA = "Mozilla/5.0 " + "x".repeat(900);

const CASES: Array<[string, Record<string, string>]> = [
  ["plain xff + ua", { "x-forwarded-for": "203.0.113.7", "user-agent": "curl/8.7.1" }],
  ["xff list picks first", { "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2", "user-agent": "curl/8.7.1" }],
  ["xff with padding", { "x-forwarded-for": "  203.0.113.7  , 10.0.0.1", "user-agent": "curl/8.7.1" }],
  ["x-real-ip fallback", { "x-real-ip": "198.51.100.4", "user-agent": "python-requests/2.32" }],
  ["cf-connecting-ip fallback", { "cf-connecting-ip": "198.51.100.9", "user-agent": "node-fetch" }],
  ["no ip headers at all", { "user-agent": "ClaudeBot/1.0" }],
  ["no user-agent at all", { "x-forwarded-for": "203.0.113.7" }],
  ["empty user-agent", { "x-forwarded-for": "203.0.113.7", "user-agent": "" }],
  ["whitespace-only user-agent", { "x-forwarded-for": "203.0.113.7", "user-agent": "   " }],
  ["padded user-agent", { "x-forwarded-for": "203.0.113.7", "user-agent": "  Claude-User/1.0  " }],
  ["ua over the 512 truncation", { "x-forwarded-for": "203.0.113.7", "user-agent": LONG_UA }],
  ["high-byte ua (latin-1, the widest a header can carry)", { "x-forwarded-for": "203.0.113.7", "user-agent": "agent/1.0 (caf\u00e9)" }],
  ["pipe in ua (delimiter collision)", { "x-forwarded-for": "203.0.113.7", "user-agent": "a|b|c" }],
  ["empty headers", {}],
];

const SALTS: Array<string | undefined> = [
  undefined,                 // derived from ANALYTICS_DATABASE_URL
  "explicit-salt-value",
  "  padded-salt  ",         // both sides .trim()
];

let checked = 0;
const failures: string[] = [];
const originalSalt = process.env.ANALYTICS_SALT;
process.env.ANALYTICS_DATABASE_URL ||= "postgres://selfcheck/unused";

for (const salt of SALTS) {
  if (salt === undefined) delete process.env.ANALYTICS_SALT;
  else process.env.ANALYTICS_SALT = salt;

  for (const [name, hdrs] of CASES) {
    const h = new Headers(hdrs);
    const want = legacySessionHash(h);
    const got = sessionHash(h);
    checked++;
    if (got !== want) {
      failures.push(`salt=${JSON.stringify(salt)} case="${name}": canonical=${got} legacy=${want}`);
    }
    if (got !== null && !/^[0-9a-f]{32}$/.test(got)) {
      failures.push(`salt=${JSON.stringify(salt)} case="${name}": not 32 hex chars: ${got}`);
    }
  }
}

if (originalSalt === undefined) delete process.env.ANALYTICS_SALT;
else process.env.ANALYTICS_SALT = originalSalt;

// The key must actually discriminate, or "identical" would be trivially true.
const a = sessionHash(new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "curl/8.7.1" }));
const b = sessionHash(new Headers({ "x-forwarded-for": "203.0.113.8", "user-agent": "curl/8.7.1" }));
const c = sessionHash(new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "curl/8.8.0" }));
if (a === b) failures.push("distinct IPs produced the same hash");
if (a === c) failures.push("distinct UAs produced the same hash");
checked += 2;

// Value equivalence is only half of it: the writers must actually CALL the
// canonical module. Re-inlining a copy would pass every check above.
const WRITERS = [
  "src/app/api/collect/route.ts",
  "src/lib/analytics/mcp-usage.ts",
  "src/lib/analytics/trust-api-usage.ts",
];
for (const f of WRITERS) {
  const src = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
  checked++;
  if (!src.includes("lib/session-identity")) failures.push(`${f}: does not import the canonical session identity`);
  checked++;
  if (/createHash\s*\(/.test(src)) failures.push(`${f}: inlines createHash() again — the join key must not be copied`);
}

if (failures.length) {
  console.error(`FAIL session-identity: ${failures.length} divergence(s) across ${checked} checks`);
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`OK session-identity: ${checked}/${checked} checks identical across ${SALTS.length} salt modes x ${CASES.length} header shapes`);
