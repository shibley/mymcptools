/**
 * QUEUE-STATUS MAIL — one honest follow-up to the free submitters who were
 * promised a review that never came, carrying the $9 Featured door (entry
 * `queue-status`, src/lib/maker-door.ts).
 *
 * WHY (measured 2026-10-10): the ack-mail door (82cbc16) went live with the
 * 2026-10-09 deploy. In the ~32h since, exactly ONE free submission arrived,
 * from a headless browser — so the door's human exposure is still zero and the
 * meter (rolling 30d $0) could not have moved. Meanwhile 22 acks went out
 * 2026-10-02 → 10-09 alone (Resend log), every one saying "we will review it
 * within 24-48 hours", and of the 40 free submissions since 2026-09-25 one was
 * listed. Those makers are the only self-identified buyers this property has
 * (its one sale ever was a maker buying $9 Featured), they have never seen the
 * $9 tier, and the thing they were told is false. This mail corrects it once
 * and hands them the door, prefilled.
 *
 * Pure: no I/O here. scripts/queue-status-mail.mts does the Resend/Stripe reads,
 * the ledger, and the send (dry-run by default).
 */
import { ackDoorHref, FEATURED_LIVE, FREE_QUEUE, normGithub, type SubmittedFields } from "./maker-door";
import { FEATURED_PRICE } from "./featured-price";

export const QUEUE_STATUS_ENTRY = "queue-status" as const;

/** A free submission, as recovered from the admin notification mail. */
export interface QueuedSubmission extends SubmittedFields {
  email: string;
  submittedAt: string; // ISO
  /** The ack this maker received said "24-48 hours". */
  promisedWindow?: boolean;
  /** The ack this maker received already carried the $9 door. */
  ackHadDoor?: boolean;
}

const unescape = (v: string) =>
  v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const text = (cell: string) => unescape(cell.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

/**
 * Parses the `🟢 New MCP Server Submission` admin mail (buildAdminEmailHtml in
 * src/app/api/submit/route.ts) back into the fields the maker typed. Returns
 * null when the table is not there or a required field is missing.
 */
export function parseAdminSubmission(html: string, submittedAt: string): QueuedSubmission | null {
  const rows = new Map<string, string>();
  for (const m of html.matchAll(/<tr><td[^>]*>([^<]+)<\/td><td[^>]*>([\s\S]*?)<\/td><\/tr>/g)) {
    rows.set(m[1].trim(), text(m[2]));
  }
  const toolName = rows.get("Server Name");
  const email = rows.get("Submitter Email");
  const github = rows.get("GitHub URL");
  if (!toolName || !email || !github) return null;
  return {
    toolName,
    email: email.toLowerCase(),
    github,
    website: rows.get("Website") || "",
    category: rows.get("Category") || "",
    installType: rows.get("Install Type") || "",
    description: rows.get("Description") || "",
    submittedAt,
  };
}

/** Our own walks: the canonical probe identity, the owner, and internal domains. */
export function isInternalAddress(email: string): boolean {
  const e = email.trim().toLowerCase();
  return (
    /^funnel-probe(\+[^@]*)?@apistatuscheck\.com$/.test(e) ||
    e === "shibley@gmail.com" ||
    /@(apistatuscheck|mymcptools|aisotools|ratedwithai|replacedbai|bity)\.(com|ai|app|co)$/.test(e) ||
    /probe/.test(e.split("@")[0])
  );
}

export interface SelectContext {
  /** normGithub() of every repo the catalog already lists — those were not left waiting. */
  listedRepos: Set<string>;
  /**
   * Hosts of every listing's website_url. A hosted server is listed with
   * github_url null (Noveum, 2026-09-25: the submitted repo was its docs repo),
   * so a repo match alone would tell a listed maker they are still queued.
   */
  listedHosts: Set<string>;
  /** Lower-cased emails that have ever completed a mymcptools checkout. */
  paidEmails: Set<string>;
  /** Lower-cased emails whose ack bounced. */
  bounced: Set<string>;
  /** `${email}|${normGithub}` keys already sent a queue-status mail. */
  alreadySent: Set<string>;
  /** Submissions at/after this instant got the ack door already. */
  doorLiveAt: string;
}

export type SkipReason = "internal" | "listed" | "paid" | "bounced" | "already-sent" | "has-door" | "duplicate";

const FREEMAIL = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "icloud.com", "me.com", "proton.me", "protonmail.com", "gmx.com", "agentmail.to"]);

export function hostOf(url: string | null | undefined): string {
  try {
    return new URL(url || "").hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Hosts that identify the submission's own product: its website, and its email domain unless freemail. */
export function submissionHosts(sub: Pick<QueuedSubmission, "email" | "website">): string[] {
  const out = [hostOf(sub.website)];
  const domain = sub.email.split("@")[1]?.toLowerCase() ?? "";
  if (domain && !FREEMAIL.has(domain)) out.push(domain);
  return out.filter(Boolean);
}

export const ledgerKey = (s: Pick<QueuedSubmission, "email" | "github">) =>
  `${s.email.trim().toLowerCase()}|${normGithub(s.github)}`;

/**
 * Who gets the mail: one per maker+repo (latest submission wins), never our own
 * addresses, never a repo we already list, never anyone who has paid, bounced,
 * been sent this before, or already received the ack door.
 */
export function selectRecipients(subs: QueuedSubmission[], ctx: SelectContext) {
  const send: QueuedSubmission[] = [];
  const skipped: { sub: QueuedSubmission; reason: SkipReason }[] = [];
  const seen = new Set<string>();
  const latestFirst = [...subs].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  for (const sub of latestFirst) {
    const key = ledgerKey(sub);
    const reason: SkipReason | null = isInternalAddress(sub.email)
      ? "internal"
      : seen.has(key)
        ? "duplicate"
        : sub.ackHadDoor || sub.submittedAt >= ctx.doorLiveAt
          ? "has-door"
          : ctx.listedRepos.has(normGithub(sub.github)) || submissionHosts(sub).some((h) => ctx.listedHosts.has(h))
            ? "listed"
            : ctx.paidEmails.has(sub.email.toLowerCase())
              ? "paid"
              : ctx.bounced.has(sub.email.toLowerCase())
                ? "bounced"
                : ctx.alreadySent.has(key)
                  ? "already-sent"
                  : null;
    seen.add(key);
    if (reason) skipped.push({ sub, reason });
    else send.push(sub);
  }
  return { send, skipped };
}

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** /submit on Featured with everything they typed, email included. */
export function queueStatusDoorHref(sub: QueuedSubmission): string {
  return ackDoorHref(sub, QUEUE_STATUS_ENTRY);
}

export function queueStatusSubject(sub: QueuedSubmission): string {
  return `${sub.toolName} on MyMCPTools — where your submission stands`;
}

export function queueStatusEmailHtml(sub: QueuedSubmission, siteUrl: string): string {
  const name = esc(sub.toolName);
  const when = new Date(sub.submittedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  const door = esc(`${siteUrl}${queueStatusDoorHref(sub)}`);
  const correction = sub.promisedWindow
    ? `<p style="font-size: 16px; line-height: 1.6;">You submitted ${name} on ${when}, and our confirmation said we'd review it within 24-48 hours. That was wrong, and we're sorry. Free submissions go into a hand-review queue with no set date, and ${name} is still in it.</p>`
    : `<p style="font-size: 16px; line-height: 1.6;">You submitted ${name} on ${when}. Free submissions go into a hand-review queue with no set date, and ${name} is still in it.</p>`;
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 32px; border-radius: 12px;">
      <h1 style="color: #e2e8f0; margin-top: 0; font-size: 22px;">Where ${name} stands</h1>
      ${correction}
      <p style="font-size: 14px; line-height: 1.6; color:#94a3b8;">You don't need to do anything. It stays in the queue either way, and we'll email you if it's listed.</p>
      <div data-maker-door="${QUEUE_STATUS_ENTRY}" style="margin: 24px 0; padding: 20px; border: 1px solid #854d0e; border-radius: 10px; background: #1c1917;">
        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #fde047;">If you'd rather have it live now: ${FEATURED_PRICE} once.</p>
        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #d6d3d1;">Free: ${FREE_QUEUE}. Featured: ${FEATURED_LIVE}, with a Featured badge and a spot at the top of its category. What you submitted is already filled in, so it's one step to checkout.</p>
        <a href="${door}" style="display: inline-block; padding: 10px 18px; background: #ca8a04; color: #0c0a09; font-weight: 700; text-decoration: none; border-radius: 8px;">Feature ${name} — ${FEATURED_PRICE} once</a>
      </div>
      <p style="font-size: 13px; line-height: 1.6; color:#64748b;">This is the only follow-up we'll send about this submission. Reply to this email if anything in it is wrong.</p>
      <p style="color: #94a3b8; font-size: 14px; margin-top: 24px;">— The MyMCPTools Team</p>
    </div>`;
}

/**
 * THE COHORT READ (2026-10-10, judge on 62519d3: "report the 72h read on
 * queue-status arrivals/Stripe conversions before building any more outbound").
 * Stripe metadata.entry=queue-status only exists once 62519d3 deploys, and a
 * maker who opens the door before then pays with the entry silently dropped —
 * so attribution joins on the ledger instead: the session's customer email OR
 * its metadata.github matches a recipient, OR it carries the entry tag, AND it
 * was created after that recipient's mail went out. Pure; the script does I/O.
 */
export interface CohortLedgerRow {
  email: string;
  github: string;
  sentAt: string; // ISO
}
export interface CohortStripeSession {
  id: string;
  created: number; // unix seconds
  status: string; // open | complete | expired
  paymentStatus: string; // paid | unpaid | no_payment_required
  amountTotal: number | null; // cents
  email: string | null;
  github: string | null; // metadata.github
  entry: string | null; // metadata.entry
}
export interface CohortSessionHit extends CohortStripeSession {
  via: "entry" | "email" | "github";
}
export const COHORT_WINDOW_HOURS = 72;

export function readQueueStatusCohort(ledger: CohortLedgerRow[], sessions: CohortStripeSession[], now: Date) {
  const rows = ledger.filter((r) => r.email && !isInternalAddress(r.email));
  const firstSent = rows.reduce((m, r) => Math.min(m, Date.parse(r.sentAt)), Infinity);
  const sentByEmail = new Map<string, number>();
  const sentByRepo = new Map<string, number>();
  for (const r of rows) {
    const t = Date.parse(r.sentAt);
    const e = r.email.trim().toLowerCase();
    sentByEmail.set(e, Math.min(sentByEmail.get(e) ?? Infinity, t));
    const g = normGithub(r.github);
    if (g) sentByRepo.set(g, Math.min(sentByRepo.get(g) ?? Infinity, t));
  }
  const hits: CohortSessionHit[] = [];
  for (const s of sessions) {
    const at = s.created * 1000;
    const email = (s.email || "").trim().toLowerCase();
    if (email && isInternalAddress(email)) continue; // our own walks never count
    const byEmail = sentByEmail.get(email);
    const byRepo = sentByRepo.get(normGithub(s.github));
    let via: CohortSessionHit["via"] | null = null;
    if (s.entry === QUEUE_STATUS_ENTRY && at >= firstSent) via = "entry";
    else if (byEmail !== undefined && at >= byEmail) via = "email";
    else if (byRepo !== undefined && at >= byRepo) via = "github";
    if (via) hits.push({ ...s, via });
  }
  const paid = hits.filter((h) => h.status === "complete" && h.paymentStatus === "paid");
  const checkpointAt = new Date(firstSent + COHORT_WINDOW_HOURS * 3600_000);
  return {
    recipients: rows.length,
    firstSentAt: Number.isFinite(firstSent) ? new Date(firstSent).toISOString() : null,
    checkpointAt: Number.isFinite(firstSent) ? checkpointAt.toISOString() : null,
    hoursElapsed: Number.isFinite(firstSent) ? Math.floor((now.getTime() - firstSent) / 3600_000) : 0,
    due: Number.isFinite(firstSent) && now >= checkpointAt,
    reachedStripe: hits,
    paid,
    cashCents: paid.reduce((n, h) => n + (h.amountTotal ?? 0), 0),
    payers: new Set(paid.map((h) => (h.email || h.github || h.id).toLowerCase())).size,
  };
}
