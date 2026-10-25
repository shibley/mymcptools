/**
 * Sends the one-time QUEUE-STATUS mail (src/lib/queue-status.ts) to free
 * submitters who were promised a 24-48h review and never got the $9 door.
 *
 * Sources, all read live:
 *   - Resend sent log: the `🟢 New MCP Server Submission` admin mail is the only
 *     place the submitted fields are kept; the `We received your submission`
 *     ack tells us what the maker was promised, whether it carried the door,
 *     and whether it bounced.
 *   - src/data/servers.ts: repos already listed are skipped.
 *   - Stripe: anyone with a completed checkout is skipped.
 *   - Ledger ~/clawd/memory/mymcptools-queue-status-ledger.jsonl (outside the
 *     repo — it holds addresses): nobody is ever mailed twice.
 *
 * Dry-run by default. --live sends; --limit N caps a live run; --since ISO sets
 * the window (default 2026-09-10, the first day of the pageview beacon).
 *
 * Run: npm run queue:mail [-- --live]
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { normGithub } from "../src/lib/maker-door.ts";
import {
  hostOf,
  ledgerKey,
  parseAdminSubmission,
  queueStatusEmailHtml,
  queueStatusSubject,
  selectRecipients,
  type QueuedSubmission,
} from "../src/lib/queue-status.ts";

const argv = process.argv.slice(2);
const arg = (f: string, d: string) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : d);
const LIVE = argv.includes("--live");
const LIMIT = Number(arg("--limit", "1000"));
const SINCE = arg("--since", "2026-09-10T00:00:00Z");
// 82cbc16 (ack door) reached prod in the 2026-10-09 02:02 PDT deploy-batch.
const DOOR_LIVE_AT = arg("--door-live-at", "2026-10-09T09:00:00Z");
const SITE_URL = "https://mymcptools.com";
const FROM = "MyMCPTools <shibley@apistatuscheck.com>";
const LEDGER = `${homedir()}/clawd/memory/mymcptools-queue-status-ledger.jsonl`;

function creds(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(`${homedir()}/clawd/.credentials.env`, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']([\s\S]*)["']$/, "$1").replace(/\\n/g, "").trim();
  }
  return out;
}
const C = creds();
const RESEND = process.env.RESEND_API_KEY || C.RESEND_API_KEY;
const STRIPE = process.env.STRIPE_SECRET_KEY || C.WATCHDOG_STRIPE_SECRET_KEY || C.STRIPE_SECRET_KEY;
if (!RESEND || !STRIPE) throw new Error("RESEND_API_KEY / Stripe key missing");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function resend(path: string, init?: RequestInit) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.resend.com${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    if (res.status === 429 && attempt < 5) { await sleep(1500 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`resend ${path} ${res.status}: ${await res.text()}`);
    await sleep(550); // 2 req/s team limit
    return res.json();
  }
}

type Row = { id: string; to: string[]; subject: string; created_at: string; last_event: string };
const ADMIN = "🟢 New MCP Server Submission: ";
const ACK = "We received your submission: ";
const STATUS_SUBJECT = " on MyMCPTools — where your submission stands";

// 1. Page the sent log back to SINCE.
const admin: Row[] = [];
const acks: Row[] = [];
const statusSent: Row[] = [];
let after = "";
let scanned = 0;
for (;;) {
  const page = await resend(`/emails?limit=100${after ? `&after=${after}` : ""}`);
  const rows: Row[] = page.data || [];
  scanned += rows.length;
  for (const r of rows) {
    const at = r.created_at.replace(" ", "T").replace(/\+00$/, "Z");
    if (at < SINCE) continue;
    if (r.subject.startsWith(ADMIN)) admin.push(r);
    else if (r.subject.startsWith(ACK)) acks.push(r);
    else if (r.subject.endsWith(STATUS_SUBJECT)) statusSent.push(r);
  }
  const oldest = rows.at(-1)?.created_at.replace(" ", "T") ?? "";
  if (!rows.length || !page.has_more || oldest < SINCE) break;
  after = rows.at(-1)!.id;
}
console.log(`resend log: scanned ${scanned}, ${admin.length} admin notifications + ${acks.length} acks since ${SINCE}`);

// 2. Recover the submitted fields, and what each ack said.
const subs: QueuedSubmission[] = [];
for (const r of admin) {
  const full = await resend(`/emails/${r.id}`);
  const sub = parseAdminSubmission(full.html || "", r.created_at.replace(" ", "T").replace(/\+00$/, "Z"));
  if (!sub) { console.log(`  unparsed admin mail ${r.id} (${r.subject})`); continue; }
  const ack = acks.find(
    (a) => a.to[0]?.toLowerCase() === sub.email && a.subject === `${ACK}${sub.toolName}` &&
      Math.abs(Date.parse(a.created_at.replace(" ", "T").replace(/\+00$/, "Z")) - Date.parse(sub.submittedAt)) < 10 * 60_000,
  );
  if (ack) {
    const body = (await resend(`/emails/${ack.id}`)).html || "";
    sub.promisedWindow = /24-48 hours/.test(body);
    sub.ackHadDoor = /data-maker-door=/.test(body);
  }
  subs.push(sub);
}

// 3. Exclusions.
const { servers } = await import("../src/data/servers.ts");
const listedRepos = new Set(servers.map((s: { github_url?: string | null }) => normGithub(s.github_url)).filter(Boolean));
// Code hosts name the platform, not the product — a match there means nothing.
const CODE_HOSTS = new Set(["github.com", "gitlab.com", "npmjs.com", "pypi.org", "smithery.ai", "glama.ai"]);
const listedHosts = new Set(servers.map((s: { website_url?: string | null }) => hostOf(s.website_url)).filter((h: string) => h && !CODE_HOSTS.has(h)));
const bounced = new Set(acks.filter((a) => /bounced|complained/.test(a.last_event)).map((a) => a.to[0].toLowerCase()));

const paidEmails = new Set<string>();
let starting = "";
for (;;) {
  const qs = new URLSearchParams({ limit: "100", status: "complete", "created[gte]": String(Math.floor(Date.parse("2026-06-01") / 1000)) });
  if (starting) qs.set("starting_after", starting);
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions?${qs}`, { headers: { Authorization: `Bearer ${STRIPE}` } });
  const page = await res.json();
  if (!res.ok) throw new Error(`stripe ${res.status}: ${JSON.stringify(page.error)}`);
  for (const s of page.data) {
    const e = s.customer_details?.email || s.customer_email;
    if (e) paidEmails.add(String(e).toLowerCase());
  }
  if (!page.has_more) break;
  starting = page.data.at(-1).id;
}

const ledger = existsSync(LEDGER)
  ? readFileSync(LEDGER, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  : [];
const alreadySent = new Set<string>(ledger.map((l: { key: string }) => l.key));
// Belt and braces: a status mail in the Resend log counts even if the ledger was lost.
for (const r of statusSent) {
  for (const s of subs) if (s.email === r.to[0]?.toLowerCase() && r.subject === `${s.toolName}${STATUS_SUBJECT}`) alreadySent.add(ledgerKey(s));
}

const { send, skipped } = selectRecipients(subs, { listedRepos, listedHosts, paidEmails, bounced, alreadySent, doorLiveAt: DOOR_LIVE_AT });
const tally: Record<string, number> = {};
for (const s of skipped) tally[s.reason] = (tally[s.reason] || 0) + 1;
console.log(`submissions ${subs.length} -> send ${send.length}; skipped ${JSON.stringify(tally)}`);
for (const s of skipped.filter((x) => x.reason === "listed")) console.log(`  listed already: ${s.sub.toolName}`);
console.log(`  promised 24-48h: ${send.filter((s) => s.promisedWindow).length} of ${send.length}`);
for (const s of send) console.log(`  ${s.submittedAt.slice(0, 10)}  ${s.email.replace(/^(.).*(@.*)$/, "$1…$2").padEnd(28)} ${s.toolName}`);

if (!LIVE) {
  console.log("\nDRY RUN — nothing sent. Re-run with --live to send.");
  process.exit(0);
}

// 4. Send, ledger each one as it goes, then read delivery back.
const sentIds: { id: string; sub: QueuedSubmission }[] = [];
for (const sub of send.slice(0, LIMIT)) {
  const r = await resend("/emails", {
    method: "POST",
    body: JSON.stringify({ from: FROM, to: [sub.email], subject: queueStatusSubject(sub), html: queueStatusEmailHtml(sub, SITE_URL) }),
  });
  appendFileSync(LEDGER, JSON.stringify({ key: ledgerKey(sub), email: sub.email, toolName: sub.toolName, github: sub.github, submittedAt: sub.submittedAt, sentAt: new Date().toISOString(), resendId: r.id }) + "\n");
  sentIds.push({ id: r.id, sub });
}
console.log(`\nsent ${sentIds.length}; waiting 60s to read delivery back`);
await sleep(60_000);
const events: Record<string, number> = {};
for (const { id } of sentIds) {
  const e = (await resend(`/emails/${id}`)).last_event || "unknown";
  events[e] = (events[e] || 0) + 1;
}
console.log(`delivery: ${JSON.stringify(events)}`);
