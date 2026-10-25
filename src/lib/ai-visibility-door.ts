/**
 * AI-VISIBILITY DOOR — a maker who just submitted an MCP server -> a prefilled
 * free AI-visibility scan on aisotools, whose result carries the $19/mo weekly
 * tracking plan (7 days card-free).
 *
 * WHY (offer:monitoring retry, 2026-10-17). aisotools' $19/mo maker tracking had
 * been put in front of every channel it owns or could post to: owned maker lists
 * exhausted 10-16, daily.dev squads closed 10-17 (8 posts, 194 people reached,
 * 0 trial-door arrivals), HN dead, OpenAI forum account gone, Mastodon/Ghost
 * captcha-blocked. The one sizeable maker audience in the portfolio it had never
 * reached is this one: analytics.events, 30d to 2026-10-17, not is_bot —
 * 89 human sessions on /submit and 63 that fired `submit/received` (32 in the
 * week of 10-12, up from 8 in the week of 09-07). Every one of them has just
 * typed the name, category and URL of a tool they make, which is exactly the
 * three fields aisotools' /audit needs to run without the maker typing again.
 *
 * The question the scan answers is the one an MCP maker has and no directory
 * answers: when someone asks ChatGPT for an MCP server in this category, is mine
 * named? The free scan says so once; the $19/mo plan re-asks weekly.
 *
 * Attribution: utm_source=mymcptools, utm_medium=<entry>, utm_campaign=CAMPAIGN
 * — the aisotools beacon keeps utm_*, and its /audit records a prefilled arrival
 * as intake `prefilled`, so `dist-placement-funnel.mjs` reads this ref end to end.
 * Kept separate from the $9 Featured door (maker-door.ts): that one sells this
 * property; this one sends the maker somewhere else and must never replace it.
 */

export const AI_VISIBILITY_CAMPAIGN = "dist-20261017-mymcptools-makers";

export const AI_VISIBILITY_ENTRIES = ["submit-success", "submit-ack"] as const;
export type AiVisibilityEntry = (typeof AI_VISIBILITY_ENTRIES)[number];

/** Category phrasing the scan puts into "best <category>" buyer questions. */
const CATEGORY_PHRASE: Record<string, string> = {
  filesystem: "MCP servers for file systems",
  database: "MCP servers for databases",
  api: "MCP servers for APIs and web",
  search: "MCP servers for search",
  coding: "MCP servers for coding",
  browser: "browser automation MCP servers",
  cloud: "MCP servers for cloud platforms",
  devops: "MCP servers for DevOps and CI/CD",
  ai: "MCP servers for AI and ML",
  communication: "MCP servers for communication tools",
  productivity: "MCP servers for productivity",
  finance: "MCP servers for finance",
  security: "MCP servers for security",
  analytics: "MCP servers for analytics",
  media: "MCP servers for media",
  memory: "MCP servers for memory and knowledge",
};

export function aiVisibilityCategory(category: string | undefined): string {
  return CATEGORY_PHRASE[(category || "").trim()] ?? "MCP servers";
}

/** The maker's own site if they gave one, else the repo; null if neither is a URL. */
export function aiVisibilityWebsite(fields: { website?: string; github?: string }): string | null {
  for (const raw of [fields.website, fields.github]) {
    const v = (raw || "").trim();
    if (/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(v) && v.length <= 300) return v;
  }
  return null;
}

/**
 * Absolute aisotools /audit URL with all three scan fields filled, or null when
 * the submission carried no usable URL (the scan refuses a URL-less request, so
 * a door that lands on an error is worse than no door).
 */
export function aiVisibilityDoorHref(
  fields: { toolName: string; category?: string; website?: string; github?: string },
  entry: AiVisibilityEntry,
): string | null {
  const tool = (fields.toolName || "").trim().slice(0, 120);
  const website = aiVisibilityWebsite(fields);
  if (!tool || !website) return null;
  const sp = new URLSearchParams();
  sp.set("tool", tool);
  sp.set("category", aiVisibilityCategory(fields.category));
  sp.set("website", website);
  sp.set("utm_source", "mymcptools");
  sp.set("utm_medium", entry);
  sp.set("utm_campaign", AI_VISIBILITY_CAMPAIGN);
  sp.set("ref", AI_VISIBILITY_CAMPAIGN);
  return `https://aisotools.com/audit?${sp.toString()}`;
}

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The door as it appears in the free-submission ack mail (entry `submit-ack`),
 * after the $9 Featured block. Transactional mail the maker triggered, so it is
 * not a marketing send. Empty string when the submission carried no usable URL.
 */
export function aiVisibilityEmailBlock(fields: { toolName: string; category?: string; website?: string; github?: string }): string {
  const href = aiVisibilityDoorHref(fields, "submit-ack");
  if (!href) return "";
  const name = escapeHtml(fields.toolName);
  const cat = escapeHtml(aiVisibilityCategory(fields.category));
  return `<div data-ai-visibility-door="submit-ack" style="margin: 24px 0; padding: 20px; border: 1px solid #1e40af; border-radius: 10px; background: #0b1220;">
        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #93c5fd;">When someone asks ChatGPT for ${cat}, is ${name} named?</p>
        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #cbd5e1;">Free check on AISO Tools, our sister site: it asks ChatGPT the questions your users ask and shows who gets named instead. Your details are already filled in. Weekly tracking is $19/mo after a 7-day trial with no card.</p>
        <a href="${escapeHtml(href)}" style="display: inline-block; padding: 10px 18px; background: #2563eb; color: #ffffff; font-weight: 700; text-decoration: none; border-radius: 8px;">Check my AI visibility (free)</a>
      </div>`;
}
