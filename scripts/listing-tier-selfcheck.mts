/**
 * Self-check for the /submit LISTING-TIER LADDER (thread #325, 2026-09-27).
 *
 * THE DEFECT THIS GUARDS. Measured 2026-08-30 -> 2026-09-27 from the Resend
 * send log: 52 submission acks (45 distinct servers) against $9.00 of cash =
 * $0.1731 of cash per free submission, versus aisotools' measured constant of
 * $0.1877 — 92.2%. mymcptools was never converting badly. It was priced at $9
 * where the comparable SKU is $79, and $0.1877/submission x 53.8/mo caps the
 * whole property at $10.10/mo however well it converts.
 *
 * The $49 price already existed, on /advertise, selling the same deliverable —
 * and /advertise had been seen by **0 of 1,148** human web sessions in the
 * beacon's entire lifetime (vs /pricing 208, /blog 220, /submit 35). It is a
 * yellow header link on a property whose median session is 1.46 pageviews.
 * The buyer was on /submit; the price was on a page nobody opens.
 *
 * THE RULES, and why each one is structural rather than editorial:
 *
 *   1. BOTH PAID TIERS MUST EXIST AND MUST DIFFER IN PRICE. $9 is the CONTROL
 *      in a price-elasticity test, not legacy to be tidied away. A future fire
 *      that "simplifies" the ladder to one tier destroys the measurement, and
 *      the measurement is the entire point of the change.
 *   2. THE PRICE ON THE BUTTON MUST BE THE PRICE STRIPE CHARGES. The ladder is
 *      read back off `analytics.mcpt_paid_listings.amount_cents` — there is no
 *      tier column, by design, because the deliverable is identical. If the
 *      page says $49 and the route charges 900, the elasticity read is silently
 *      wrong and nothing else in the stack would notice.
 *   3. THE TIER MUST BE WHITELISTED SERVER-SIDE. `tier` arrives in a POST body
 *      from the browser. An unknown value must fall back to the $9 tier, never
 *      to a free or arbitrary amount.
 *
 * GATE THIS SERVES: >= 1.02 $49 sales/month clears the $50/mo additive bar at
 * the measured 53.8 submissions/mo. Verdict date 2026-11-27. Below that, the
 * price lever is falsified and the cap stands at the $0.1877 constant.
 *
 * 2026-10-22 — LADDER CLOSED BY OWNER DECISION. Shib approved Featured $9 -> $49
 * one-time (move #1 of memory/research-maker-visibility-pricing-2026-10-22.md:
 * mcp.so sells $699-1,299/mo rails, Glama $200/mo/category; $9 priced the
 * property as junk). The elasticity read above ended early with its answer
 * on the table: lifetime analytics.mcpt_paid_listings = 1 row (Coinrule, 900),
 * the $49 "Pro" arm 0 sales since 2026-09-27. Pro was the same deliverable at
 * the same price now, and promised a "dofollow link" that lib/outbound-rel.ts
 * (rightly) never renders for a paid row — so it is folded into Featured.
 * Rules 1-3 are rewritten for one tier; Rule 4 stands.
 *
 *   1. ONE PAID TIER, $49, ON A STORED STRIPE PRICE (lib/featured-price.ts).
 *   2. EVERY PRINTED FEATURED PRICE IS $49 — /submit, the server-page door,
 *      the submit-ack and queue-status mails. A $9 button that charges $49 is
 *      worse than either price.
 *   3. TIER INPUT IS WHITELISTED ("pro" and unknown values -> featured), and
 *      the only sub-$49 charge is the 14-day grandfather for the two makers
 *      quoted $9 on 2026-10-22 (Arcmira, 10ML — memory/inbound-vendor-desk.md),
 *      matched server-side on their email domain, expiring 2026-11-05 PT.
 *
 *   npm run tier:selfcheck
 */
import { existsSync, readFileSync } from "node:fs";

const CHECKOUT = "src/app/api/checkout/route.ts";
const SUBMIT = "src/app/submit/page.tsx";
const PRICE_LIB = "src/lib/featured-price.ts";
const read = (f: string) => (existsSync(f) ? readFileSync(f, "utf8") : "");

const checkout = read(CHECKOUT);
const submit = read(SUBMIT);

const failures: string[] = [];
const notes: string[] = [];

// --- Rule 1: one paid tier, $49, on a stored Stripe Price --------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lib: any = existsSync(PRICE_LIB) ? await import(`../${PRICE_LIB}`) : {};
if (lib.FEATURED_CENTS !== 4900 || lib.FEATURED_PRICE !== "$49") {
  failures.push(`Rule 1: ${PRICE_LIB} must export FEATURED_CENTS=4900 and FEATURED_PRICE="$49" (got ${lib.FEATURED_CENTS}/${lib.FEATURED_PRICE}).`);
}
if (!/^price_[A-Za-z0-9]+$/.test(String(lib.FEATURED_STRIPE_PRICE_ID || ""))) {
  failures.push(`Rule 1: ${PRICE_LIB} has no FEATURED_STRIPE_PRICE_ID — the $49 must be a stored Stripe Price, not inline price_data.`);
}
if (!/featuredCharge\(/.test(checkout)) {
  failures.push(`Rule 1: ${CHECKOUT} does not price through featuredCharge() — the route can drift from the lib.`);
}
if (/cents:\s*900\b|unit_amount:\s*900\b/.test(checkout)) {
  failures.push(`Rule 1: ${CHECKOUT} still carries a literal 900 — the $9 tier is closed.`);
}
notes.push(`featured: ${lib.FEATURED_PRICE} (${lib.FEATURED_CENTS}c) ${lib.FEATURED_STRIPE_PRICE_ID}`);

// --- Rule 2: every printed Featured price is $49 -----------------------------
const SURFACES = [SUBMIT, "src/app/servers/[slug]/page.tsx", "src/lib/maker-door.ts", "src/lib/queue-status.ts"];
const STALE = [/Continue to Checkout — \$9\b/, /Feature (it|\$\{name\}) — \$9 once/, /featured\? \$9 once/i, /live now: \$9 once/, />\s*\$9 <span/];
for (const f of SURFACES) {
  const src = read(f);
  if (!src) {
    failures.push(`Rule 2: ${f} is missing.`);
    continue;
  }
  for (const re of STALE) if (re.test(src)) failures.push(`Rule 2: ${f} still prints the $9 Featured price (${re}).`);
}
const shown = new Set<string>();
for (const m of submit.matchAll(/Continue to Checkout — (\$\d+|\$\{FEATURED_PRICE\})/g)) shown.add(m[1]);
if (shown.size === 0) failures.push(`Rule 2: ${SUBMIT} shows no checkout price at all.`);
for (const v of shown) if (v !== "$49" && v !== "${FEATURED_PRICE}") failures.push(`Rule 2: /submit offers a ${v} button; the route charges $49.`);
if (/tier === "pro"|setTier\("pro"\)/.test(submit)) failures.push(`Rule 2: ${SUBMIT} still renders the Pro tier, folded into Featured on 2026-10-22.`);
if (/[Dd]ofollow/.test(submit)) failures.push(`Rule 2: ${SUBMIT} promises a dofollow link; paid rows render rel="sponsored" (lib/outbound-rel.ts).`);
notes.push(`buttons: ${[...shown].join(", ") || "none"}`);

// --- Rule 3: whitelisted tier; the only discount is the dated grandfather ----
if (!/function resolveTier\s*\(/.test(checkout) || !/resolveTier\(body\.tier\)/.test(checkout)) {
  failures.push(`Rule 3: ${CHECKOUT} must route body.tier through resolveTier().`);
}
if (typeof lib.featuredCharge !== "function") {
  failures.push(`Rule 3: ${PRICE_LIB} has no featuredCharge().`);
} else {
  const inTerm = new Date("2026-10-23T12:00:00Z");
  const lastDayPT = new Date("2026-11-06T07:59:00Z"); // 2026-11-05 23:59 PT
  const after = new Date("2026-11-06T08:00:00Z");
  const cases: Array<[string, Date, number, boolean]> = [
    ["zeal@arcmira.com", inTerm, 900, false],
    ["Contact@10ML.com", inTerm, 900, false],
    ["team@arcmira.com", lastDayPT, 900, false],
    ["zeal@arcmira.com", after, 4900, true],
    ["contact@10ml.com", after, 4900, true],
    ["maker@example.com", inTerm, 4900, true],
    ["evil@notarcmira.com", inTerm, 4900, true],
    ["", inTerm, 4900, true],
  ];
  for (const [email, at, cents, stored] of cases) {
    const c = lib.featuredCharge(email, at);
    if (c?.cents !== cents || Boolean(c?.priceId) !== stored) {
      failures.push(`Rule 3: featuredCharge(${JSON.stringify(email)}, ${at.toISOString()}) = ${JSON.stringify(c)}, want ${cents}c${stored ? " on the stored Price" : " inline"}.`);
    }
  }
  const gf = (lib.FEATURED_GRANDFATHER || []).map((g: { domain: string }) => g.domain).sort().join(",");
  if (gf !== "10ml.com,arcmira.com") failures.push(`Rule 3: grandfather list must be exactly arcmira.com + 10ml.com (got ${gf}).`);
  notes.push(`grandfather: ${gf} until ${(lib.FEATURED_GRANDFATHER || [])[0]?.until}`);
}

// --- Rule 4: /submit is the ONLY surface that sells a listing (thread #330) -
// /advertise sold the same badge at $49/$99/$199 beside /submit's $9/$49 and
// took 0 of 1,532 human web sessions and 0 non-test checkouts, lifetime
// (beacon 2026-08-18 -> 2026-10-03; Stripe since 2026-03-01). A second page
// quoting a different price for the same deliverable makes #325's elasticity
// read ambiguous. It now 301s to /submit; this keeps it from growing back.
for (const dead of ["src/app/advertise", "src/app/api/advertise"]) {
  if (existsSync(dead)) {
    failures.push(`Rule 4: ${dead} exists — a second listing price surface beside /submit (thread #330).`);
  }
}
const header = readFileSync("src/components/Header.tsx", "utf8");
if (/href="\/advertise"/.test(header)) {
  failures.push(`Rule 4: the header still links /advertise — send listing buyers to /submit.`);
}
const nextConfig = readFileSync("next.config.ts", "utf8");
if (!/source:\s*"\/advertise",\s*destination:\s*"\/submit",\s*permanent:\s*true/.test(nextConfig)) {
  failures.push(`Rule 4: next.config.ts has no permanent /advertise -> /submit redirect; old links would 404.`);
}

console.log("LISTING TIER SELF-CHECK — /submit Featured $49 (thread #325, closed 2026-10-22)");
for (const n of notes) console.log("  · " + n);
if (failures.length) {
  console.error("\nFAIL:");
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log("\nPASS — one $49 Featured tier on a stored Price, every printed price matches, tier input whitelisted, grandfather dated.");
