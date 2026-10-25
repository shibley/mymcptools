/**
 * LIVE proof for the $9 one-time 30-day key: mint the exact Checkout Session a
 * server-page press creates, against the LIVE Stripe account, then expire it.
 *
 * A ?probe=1 dry run proves what we WOULD send; only Stripe can say whether it
 * accepts it (mode=payment with these line items, metadata sizes, URLs). The
 * session is created under the probe identity
 * (funnel-probe+trust-layer@apistatuscheck.com, metadata probe=1) and expired
 * before the script exits, so it never reads as a buyer.
 *
 * Run: npm run pass:e2e   (needs WATCHDOG_STRIPE_SECRET_KEY or STRIPE_SECRET_KEY)
 */
import { existsSync, readFileSync } from "node:fs";
import Stripe from "stripe";
import { readCheckoutEntry } from "../src/lib/api/checkout-entry.ts";
import { trustApiSessionParams } from "../src/lib/api/trust-api-session.ts";

function stripeKey(): string {
  if (process.env.STRIPE_SECRET_KEY) return process.env.STRIPE_SECRET_KEY.trim();
  for (const rel of ["../../.credentials.env", "../.credentials.env"]) {
    const f = new URL(rel, import.meta.url);
    if (!existsSync(f)) continue;
    const m = readFileSync(f, "utf8").match(/^WATCHDOG_STRIPE_SECRET_KEY=(.*)$/m);
    if (m) return m[1].replace(/^"|"$/g, "").replace(/\\n/g, "").trim();
  }
  throw new Error("no Stripe key (STRIPE_SECRET_KEY or WATCHDOG_STRIPE_SECRET_KEY)");
}

const PROBE_EMAIL = "funnel-probe+trust-layer@apistatuscheck.com";
const stripe = new Stripe(stripeKey());
const entry = readCheckoutEntry(
  new URL("https://mymcptools.com/api/trust-api/checkout?from=server-page&server=github&plan=pass")
);

let failures = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${msg}`);
  if (!cond) failures += 1;
};

const created = await stripe.checkout.sessions.create(
  trustApiSessionParams({ plan: "pass", entry, email: PROBE_EMAIL, extraMetadata: { probe: "1" } })
);
try {
  const s = await stripe.checkout.sessions.retrieve(created.id, { expand: ["line_items"] });
  console.log(`session ${s.id} (${s.livemode ? "LIVE" : "test"} mode)`);
  ok(s.livemode, "minted on the live account");
  ok(/^https:\/\/checkout\.stripe\.com\//.test(created.url || ""), `hosted page ${created.url?.slice(0, 40)}…`);
  ok(s.mode === "payment", `mode ${s.mode} — one payment, nothing recurs`);
  ok(s.amount_total === 900 && s.currency === "usd", `amount ${s.amount_total} ${s.currency}`);
  const li = s.line_items?.data[0];
  ok(li?.price?.recurring == null, "line item has no recurring interval");
  ok(/30-day key/.test(li?.description || ""), `line item "${li?.description}"`);
  ok(s.metadata?.plan === "pass-30d" && s.metadata?.product === "trust-api", `metadata plan ${s.metadata?.plan}`);
  ok(s.metadata?.entry_kind === "server-page" && s.metadata?.entry_server === "github", "server-page attribution survives to Stripe");
  ok(/\/servers\/github\?checkout=cancelled#trust$/.test(s.cancel_url || ""), `cancel_url ${s.cancel_url}`);
  ok(s.customer_email === PROBE_EMAIL && s.metadata?.probe === "1", "labelled as a probe");
} finally {
  const x = await stripe.checkout.sessions.expire(created.id);
  console.log(`  expired ${x.id}: status=${x.status}`);
}
console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
