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
 *   npm run tier:selfcheck
 */
import { existsSync, readFileSync } from "node:fs";

const CHECKOUT = "src/app/api/checkout/route.ts";
const SUBMIT = "src/app/submit/page.tsx";

const checkout = readFileSync(CHECKOUT, "utf8");
const submit = readFileSync(SUBMIT, "utf8");

const failures: string[] = [];
const notes: string[] = [];

// --- Rule 1: both paid tiers exist server-side, at different prices ---------
const tierBlock = /export const LISTING_TIERS = \{([\s\S]*?)\} as const;/.exec(checkout);
const prices = new Map<string, number>();
if (!tierBlock) {
  failures.push(`Rule 1: ${CHECKOUT} has no LISTING_TIERS table — the price ladder is not readable.`);
} else {
  for (const m of tierBlock[1].matchAll(/(\w+):\s*\{\s*cents:\s*(\d+)/g)) {
    prices.set(m[1], Number(m[2]));
  }
  if (prices.size < 2) {
    failures.push(
      `Rule 1: LISTING_TIERS has ${prices.size} paid tier(s). The $9 tier is the CONTROL in the ` +
        `elasticity test opened by thread #325 — collapsing the ladder destroys the measurement.`
    );
  }
  if (new Set(prices.values()).size !== prices.size) {
    failures.push(`Rule 1: two tiers share a price — ${JSON.stringify([...prices])}. amount_cents cannot separate them.`);
  }
  notes.push(`tiers: ${[...prices].map(([k, v]) => `${k}=$${(v / 100).toFixed(0)}`).join(", ")}`);
}

// --- Rule 2: every price the page shows is a price the route can charge -----
const shown = new Set<number>();
for (const m of submit.matchAll(/Continue to Checkout — \$(\d+)/g)) shown.add(Number(m[1]) * 100);
if (shown.size === 0) {
  failures.push(`Rule 2: ${SUBMIT} shows no checkout price at all.`);
}
for (const cents of shown) {
  if (![...prices.values()].includes(cents)) {
    failures.push(
      `Rule 2: /submit offers a $${(cents / 100).toFixed(0)} button, but the checkout route charges ` +
        `${[...prices.values()].map((c) => `$${(c / 100).toFixed(0)}`).join("/")}. ` +
        `amount_cents is the only thing separating the tiers in the warehouse, so this read is silently wrong.`
    );
  }
}
for (const cents of prices.values()) {
  if (!shown.has(cents)) {
    failures.push(
      `Rule 2: the route can charge $${(cents / 100).toFixed(0)} but /submit never offers it. ` +
        `A tier with no button takes $0 — that is exactly what /advertise did for 1,148 sessions.`
    );
  }
}
notes.push(`buttons: ${[...shown].map((c) => `$${(c / 100).toFixed(0)}`).join(", ") || "none"}`);

// --- Rule 3: unknown tier values fall back, they do not pass through --------
if (!/function resolveTier\s*\(/.test(checkout)) {
  failures.push(`Rule 3: ${CHECKOUT} has no resolveTier() whitelist — a browser-supplied tier reaches the price map unchecked.`);
} else if (!/resolveTier\(body\.tier\)/.test(checkout)) {
  failures.push(`Rule 3: resolveTier() exists but the request body is not routed through it.`);
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

console.log("LISTING TIER SELF-CHECK — /submit price ladder (thread #325)");
for (const n of notes) console.log("  · " + n);
if (failures.length) {
  console.error("\nFAIL:");
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log("\nPASS — ladder is intact, buttons match the route, tier input is whitelisted.");
