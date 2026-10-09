/**
 * MAKER DOOR — server page -> prefilled $9 Featured checkout on /submit.
 *
 * WHY (measured 2026-10-07, demand:report, 30d): 798 human sessions read
 * /servers/[slug]; 95 were exposed to the $49/mo Trust API button and the $9
 * 30-day key since 2026-10-03, and 0 pressed either. Server-page readers came
 * for install help, not for data. The property's only sale ever (Coinrule, $9
 * Featured, 2026-09-03) was a MAKER buying placement on /submit — a page with
 * ~59 human sessions a month and no link from any server page. This puts the
 * maker offer on the 13x larger surface, addressed to the one reader of each
 * page who can buy it: whoever maintains that server.
 *
 * The href carries the listing's own catalog fields so /submit opens on the
 * Featured tier with the form already filled; the checkout route forwards
 * `server` into Stripe metadata and the webhook files the order under the
 * catalog slug (see `resolveListingSlug`), so delivery lands on this page.
 */
import type { MCPServer } from "@/data/servers";

export const MAKER_DOOR_FROM = "server-page";

/**
 * TIER TRUTH — the one difference between Free and Featured, stated the same
 * way on every surface (tier cards, success screen, ack mail).
 *
 * Measured 2026-10-08 (analytics.events server-submit rows vs servers.ts): 40
 * free submissions since 2026-09-25, 1 listed. Free review is a hand queue with
 * no clock. Featured is delivered by the webhook (recordPaidListing) the moment
 * Stripe confirms, no human in the loop. The copy had both backwards — free
 * "reviewed within a day or two", Featured sold as a faster review — so a
 * maker comparing tiers saw a day's difference for $9 instead of "never on a
 * date" vs "now".
 */
export const FREE_QUEUE = "Hand-review queue, no set date";
export const FEATURED_LIVE = "Live the minute payment clears";

/**
 * Every surface that hands a maker the $9 Featured offer. The value rides the
 * door href as `from` and `utm_medium`, and lands in Stripe metadata.entry.
 *
 * WHY THE ACK DOORS (measured 2026-10-07, analytics.events, 48h after the
 * server-page door deployed): 0 /submit arrivals came from a server page, but 4
 * human sessions walked / -> /search -> /submit and sent a FREE submission
 * (~46 acks/month). Those are the makers — self-identified, with an email we
 * already mail — and neither the ack mail nor the success screen ever named
 * the $9 tier. `submit-ack` is the link in that mail; `submit-success` is the
 * button on the screen they see right after pressing submit.
 */
export const MAKER_DOOR_ENTRIES = [MAKER_DOOR_FROM, "submit-ack", "submit-success"] as const;
export type MakerDoorEntry = (typeof MAKER_DOOR_ENTRIES)[number];

export function cleanDoorEntry(raw: unknown): MakerDoorEntry | undefined {
  return (MAKER_DOOR_ENTRIES as readonly unknown[]).includes(raw) ? (raw as MakerDoorEntry) : undefined;
}

/**
 * The pageview beacon stores the PATH only, so `from` was invisible: a door
 * arrival on /submit read as an untagged pageview. The beacon does keep utm_*,
 * so every door href carries them — utm_source=maker-door, utm_medium=<entry>,
 * utm_campaign=<catalog slug, else the server name>.
 */
function tagDoor(sp: URLSearchParams, entry: MakerDoorEntry, campaign: string) {
  sp.set("utm_source", "maker-door");
  sp.set("utm_medium", entry);
  sp.set("utm_campaign", campaign.slice(0, 80));
}

/** Catalog slugs are ASCII words joined by hyphens (one legacy slug, bushelFarm-mcp, has capitals). */
export const SERVER_SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,79}$/;

/** /submit category values the form offers; a listing with none of them leaves the select for the maker. */
export const SUBMIT_CATEGORIES = [
  "filesystem", "database", "api", "search", "coding", "browser", "cloud", "devops",
  "ai", "communication", "productivity", "finance", "security", "analytics", "media", "memory",
] as const;

/** /submit install values the form offers. */
const SUBMIT_INSTALLS = new Set(["npm", "pip", "docker", "binary", "source", "remote"]);

export function makerDoorHref(server: Pick<MCPServer, "slug" | "name" | "description" | "github_url" | "website_url" | "categories" | "install_type">): string {
  const sp = new URLSearchParams();
  sp.set("tier", "featured");
  sp.set("server", server.slug);
  sp.set("from", MAKER_DOOR_FROM);
  sp.set("name", server.name);
  if (server.description) sp.set("description", server.description.slice(0, 300));
  if (server.github_url) sp.set("github", server.github_url);
  if (server.website_url) sp.set("website", server.website_url);
  const cat = server.categories.find((c) => (SUBMIT_CATEGORIES as readonly string[]).includes(c));
  if (cat) sp.set("category", cat);
  if (SUBMIT_INSTALLS.has(server.install_type)) sp.set("install", server.install_type);
  tagDoor(sp, MAKER_DOOR_FROM, server.slug);
  return `/submit?${sp.toString()}#form`;
}

/** What a free submitter already typed; the ack doors hand it straight back. */
export interface SubmittedFields {
  toolName: string;
  description?: string;
  github?: string;
  website?: string;
  category?: string;
  installType?: string;
  email?: string;
}

/**
 * The door for a maker who just sent a FREE submission: /submit on Featured
 * with every field they typed (email included), so the upgrade is one press.
 * `server` is set only when their repo is already a catalog listing, so the
 * order is delivered onto that page (resolveListingSlug) instead of a twin.
 */
export function ackDoorHref(
  fields: SubmittedFields,
  entry: Exclude<MakerDoorEntry, typeof MAKER_DOOR_FROM>,
  server?: string,
): string {
  const sp = new URLSearchParams();
  sp.set("tier", "featured");
  const slug = cleanServerSlug(server);
  if (slug) sp.set("server", slug);
  sp.set("from", entry);
  sp.set("name", fields.toolName.slice(0, 200));
  if (fields.description) sp.set("description", fields.description.slice(0, 300));
  if (fields.github) sp.set("github", fields.github.slice(0, 300));
  if (fields.website) sp.set("website", fields.website.slice(0, 300));
  if (fields.category && (SUBMIT_CATEGORIES as readonly string[]).includes(fields.category)) sp.set("category", fields.category);
  if (fields.installType && SUBMIT_INSTALLS.has(fields.installType)) sp.set("install", fields.installType);
  if (fields.email) sp.set("email", fields.email.slice(0, 255));
  tagDoor(sp, entry, slug ?? fields.toolName);
  return `/submit?${sp.toString()}#form`;
}

/** Normalised github URL for matching a submission against the catalog. */
export function normGithub(url: string | null | undefined): string {
  return (url || "").trim().toLowerCase().replace(/\.git$/, "").replace(/\/+$/, "").replace(/^http:/, "https:").replace("://www.", "://");
}

/** Whitelist for the `server` value that arrives in the checkout POST body. */
export function cleanServerSlug(raw: unknown): string | undefined {
  return typeof raw === "string" && SERVER_SLUG_RE.test(raw) ? raw : undefined;
}

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The maker door as it appears in the free-submission ack mail (entry
 * `submit-ack`). Every free submitter receives this mail, and until 2026-10-07
 * it never named the $9 tier.
 */
export function ackDoorEmailBlock(fields: SubmittedFields, siteUrl: string, server?: string): string {
  const name = escapeHtml(fields.toolName);
  const door = escapeHtml(`${siteUrl}${ackDoorHref(fields, "submit-ack", server)}`);
  return `<div data-maker-door="submit-ack" style="margin: 24px 0; padding: 20px; border: 1px solid #854d0e; border-radius: 10px; background: #1c1917;">
        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #fde047;">Want ${name} featured? $9 once.</p>
        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #d6d3d1;">Free — ${FREE_QUEUE}. Featured — ${FEATURED_LIVE}, with a Featured badge on the listing and the top of its category. Your details are already filled in, one step to checkout.</p>
        <a href="${door}" style="display: inline-block; padding: 10px 18px; background: #ca8a04; color: #0c0a09; font-weight: 700; text-decoration: none; border-radius: 8px;">Feature it — $9 once</a>
      </div>`;
}
