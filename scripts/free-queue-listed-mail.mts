/**
 * Tells the free-queue makers that their listing is live. These are the makers
 * who got the 2026-10-10 queue-status mail (62519d3) and were approved in the
 * 2026-10-10 queue review (6d00365).
 *
 * Inputs (outside the repo, because they hold addresses):
 *   ~/clawd/memory/mymcptools-free-queue-review-2026-10-10.jsonl  (decision + url per submission)
 *   ~/clawd/memory/mymcptools-queue-status-ledger.jsonl           (who got the 10-10 mail)
 * Output ledger: ~/clawd/memory/mymcptools-listed-mail-ledger.jsonl. Nobody is mailed twice.
 *
 * GATE: a maker is mailed only when their /servers/<slug> page returns 200 on
 * production and names their server. Until the commit is deployed, every row is
 * skipped as "not live". The mail says "live", so it must be true before it goes.
 *
 * Kallax.io replied to the 10-10 mail. They get an in-thread apology
 * (In-Reply-To/References = their message_id) in place of the one-liner.
 *
 * Dry-run by default. --live sends. No BCC.
 * Run: npx tsx scripts/free-queue-listed-mail.mts [--live]
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { normGithub } from "../src/lib/maker-door.ts";
import { servers } from "../src/data/servers.ts";

const LIVE = process.argv.includes("--live");
const MEM = `${homedir()}/clawd/memory`;
const REVIEW = `${MEM}/mymcptools-free-queue-review-2026-10-10.jsonl`;
const STATUS_LEDGER = `${MEM}/mymcptools-queue-status-ledger.jsonl`;
const OUT = `${MEM}/mymcptools-listed-mail-ledger.jsonl`;
const FROM = "MyMCPTools <shibley@apistatuscheck.com>";

const KALLAX = {
  to: "schmidtgit@protonmail.com",
  repo: normGithub("https://github.com/schmidtgit/BoardGameResources"),
  inReplyTo:
    "<5Tog3xK6BXimWp-ZeZ3yqL-KKx0RGOXdAMLYo_1ft1ASZ6PsZsEsAwEGXL641UHFfj2UISp7GMNjv4RQc1VAVpZSYX4qoD9fwUk36KzLLLE=@protonmail.com>",
  subject: "Re: Kallax.io on MyMCPTools — where your submission stands",
};

function creds(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(`${homedir()}/clawd/.credentials.env`, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']([\s\S]*)["']$/, "$1").replace(/\\n/g, "").trim();
  }
  return out;
}
const RESEND = process.env.RESEND_API_KEY || creds().RESEND_API_KEY;
if (!RESEND) throw new Error("RESEND_API_KEY missing");

const jsonl = (p: string) =>
  existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Review = { decision: string; email: string; toolName: string; github: string; slug: string | null; url: string | null };
const approvedByRepo = new Map<string, Review>();
for (const r of jsonl(REVIEW) as Review[]) if (r.decision === "approved" && r.url) approvedByRepo.set(normGithub(r.github), r);

const sentKeys = new Set(jsonl(OUT).map((r: { key: string }) => r.key));

type Job = { key: string; to: string; name: string; url: string; subject: string; text: string; headers?: Record<string, string> };
const jobs: Job[] = [];
const skipped: string[] = [];
const seen = new Set<string>();
for (const l of jsonl(STATUS_LEDGER) as { email: string; toolName: string; github: string }[]) {
  const repo = normGithub(l.github);
  const rev = approvedByRepo.get(repo);
  if (!rev) { skipped.push(`not approved: ${l.toolName}`); continue; }
  if (repo === KALLAX.repo) {
    jobs.push({
      key: `kallax-reply|${KALLAX.to}`,
      to: KALLAX.to,
      name: rev.toolName,
      url: rev.url!,
      subject: KALLAX.subject,
      headers: { "In-Reply-To": KALLAX.inReplyTo, References: KALLAX.inReplyTo },
      text: [
        "You're right, and I'm sorry.",
        "",
        "Our confirmation said we'd review Kallax.io within 24-48 hours. We didn't, and then our follow-up asked you for $9 before we'd done the free review we promised.",
        "",
        `Kallax.io is now listed, free: ${rev.url}`,
        "",
        "The paid option is optional. It changes nothing about the free listing, which stays up either way.",
        "",
        "— MyMCPTools",
      ].join("\n"),
    });
    continue;
  }
  const key = `listed|${l.email.toLowerCase()}|${repo}`;
  // One mail per listing: a maker who submitted the same repo from two addresses gets one.
  if (seen.has(repo)) { skipped.push(`second address for ${l.toolName}`); continue; }
  seen.add(repo);
  jobs.push({
    key,
    to: l.email,
    name: rev.toolName,
    url: rev.url!,
    subject: `${rev.toolName} is listed on MyMCPTools`,
    text: `Your free listing for ${rev.toolName} is live: ${rev.url}\n\n— MyMCPTools`,
  });
}

jobs.sort((a, b) => Number(b.key.startsWith("kallax-reply")) - Number(a.key.startsWith("kallax-reply")));
console.log(`${jobs.length} approved recipients from today's mail; ${skipped.length} skipped (no mail)`);
for (const s of skipped) console.log(`  skip  ${s}`);
let sent = 0;
for (const j of jobs) {
  if (sentKeys.has(j.key)) { console.log(`  already sent  ${j.name}`); continue; }
  // The gate: the page must be live in production and name the server.
  const res = await fetch(j.url, { headers: { "User-Agent": "Mozilla/5.0 (mymcptools listed-mail gate)" } });
  const html = res.ok ? await res.text() : "";
  const catalogName = servers.find((s) => j.url.endsWith(`/servers/${s.slug}`))?.name ?? j.name;
  if (!res.ok || !html.includes(esc(catalogName))) {
    console.log(`  NOT LIVE (${res.status})  ${j.name}  ${j.url}`);
    continue;
  }
  if (!LIVE) { console.log(`  would send  ${j.to.replace(/^(.).*(@.*)$/, "$1…$2").padEnd(28)} ${j.subject}`); continue; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [j.to],
      subject: j.subject,
      text: j.text,
      html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.6">${esc(j.text)
        .replace(esc(j.url), `<a href="${j.url}">${esc(j.url)}</a>`)
        .replace(/\n/g, "<br>")}</div>`,
      ...(j.headers ? { headers: j.headers } : {}),
    }),
  });
  const body = await r.json();
  if (!r.ok) { console.log(`  FAILED ${r.status} ${j.name}: ${JSON.stringify(body)}`); continue; }
  appendFileSync(OUT, JSON.stringify({ key: j.key, email: j.to, toolName: j.name, url: j.url, sentAt: new Date().toISOString(), resendId: body.id }) + "\n");
  console.log(`  sent ${body.id}  ${j.name}`);
  sent++;
  await sleep(600); // Resend 2 req/s
}
console.log(LIVE ? `sent ${sent}` : "DRY RUN — nothing sent. Re-run with --live.");
