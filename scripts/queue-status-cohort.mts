/**
 * QUEUE-STATUS COHORT READ — the instrument for the 72h checkpoint on the
 * 2026-10-10 queue-status mail (62519d3). Read-only: Resend delivery, beacon
 * arrivals, Stripe sessions joined to the ledger (readQueueStatusCohort).
 *
 * Run: npm run queue:cohort   (prints T+h; the verdict is only final once `due`)
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import pg from "pg";
import { readQueueStatusCohort, type CohortStripeSession } from "../src/lib/queue-status.ts";

const LEDGER = `${homedir()}/clawd/memory/mymcptools-queue-status-ledger.jsonl`;
const C: Record<string, string> = {};
for (const line of readFileSync(`${homedir()}/clawd/.credentials.env`, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) C[m[1]] = m[2].replace(/^["']([\s\S]*)["']$/, "$1").replace(/\\n/g, "").trim();
}
const RESEND = process.env.RESEND_API_KEY || C.RESEND_API_KEY;
const STRIPE = process.env.STRIPE_SECRET_KEY || C.WATCHDOG_STRIPE_SECRET_KEY || C.STRIPE_SECRET_KEY;
const DB = process.env.ANALYTICS_DATABASE_URL || C.ANALYTICS_DATABASE_URL;
if (!RESEND || !STRIPE || !DB) throw new Error("RESEND_API_KEY / Stripe key / ANALYTICS_DATABASE_URL missing");

const ledger = readFileSync(LEDGER, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const firstSent = Math.min(...ledger.map((l: { sentAt: string }) => Date.parse(l.sentAt)));

// 1. Delivery, read back per message (not the send response).
const events: Record<string, number> = {};
for (const l of ledger) {
  const res = await fetch(`https://api.resend.com/emails/${l.resendId}`, { headers: { Authorization: `Bearer ${RESEND}` } });
  const e = res.ok ? ((await res.json()).last_event ?? "?") : `http-${res.status}`;
  events[e] = (events[e] ?? 0) + 1;
  await new Promise((r) => setTimeout(r, 550)); // Resend: 2 req/s
}

// 2. Arrivals: the door href carries utm_source=maker-door&utm_medium=queue-status.
const db = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await db.connect();
const arr = await db.query(
  `select count(distinct session_hash)::int as sessions,
          count(distinct session_hash) filter (where not is_bot)::int as human,
          count(distinct session_hash) filter (where bot_reason = 'internal-probe')::int as probes
     from analytics.events
    where site = 'mymcptools' and utm_source = 'maker-door' and utm_medium = 'queue-status'
      and ts >= to_timestamp($1)`,
  [Math.floor(firstSent / 1000)]
);
await db.end();

// 3. Stripe: every session since the first send, joined to the ledger.
const sessions: CohortStripeSession[] = [];
for (let starting = ""; ; ) {
  const qs = new URLSearchParams({ limit: "100", "created[gte]": String(Math.floor(firstSent / 1000)) });
  if (starting) qs.set("starting_after", starting);
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions?${qs}`, { headers: { Authorization: `Bearer ${STRIPE}` } });
  const page = await res.json();
  if (!res.ok) throw new Error(`stripe ${res.status}: ${JSON.stringify(page.error)}`);
  for (const s of page.data)
    sessions.push({
      id: s.id, created: s.created, status: s.status, paymentStatus: s.payment_status, amountTotal: s.amount_total,
      email: s.customer_details?.email || s.customer_email || s.metadata?.email || null,
      github: s.metadata?.github || null, entry: s.metadata?.entry || null,
    });
  if (!page.has_more) break;
  starting = page.data.at(-1).id;
}

const r = readQueueStatusCohort(ledger, sessions, new Date());
console.log(`-- QUEUE-STATUS cohort (62519d3), T+${r.hoursElapsed}h of 72h — checkpoint ${r.checkpointAt}${r.due ? " (DUE: this is the verdict)" : " (not due: provisional)"} --`);
console.log(`recipients              ${r.recipients}  (first sent ${r.firstSentAt})`);
console.log(`delivery (read back)    ${Object.entries(events).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`door arrivals           ${arr.rows[0].human} human session(s)  (${arr.rows[0].sessions} incl. bots, ${arr.rows[0].probes} probe)`);
console.log(`Stripe sessions scanned ${sessions.length} since first send`);
console.log(`reached Stripe          ${r.reachedStripe.length}${r.reachedStripe.map((h) => `\n  ${h.id} ${h.status}/${h.paymentStatus} $${((h.amountTotal ?? 0) / 100).toFixed(2)} via ${h.via}`).join("")}`);
console.log(`paid                    ${r.paid.length} session(s), ${r.payers} payer(s), $${(r.cashCents / 100).toFixed(2)}`);
