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
  return `/submit?${sp.toString()}#form`;
}

/** Whitelist for the `server` value that arrives in the checkout POST body. */
export function cleanServerSlug(raw: unknown): string | undefined {
  return typeof raw === "string" && SERVER_SLUG_RE.test(raw) ? raw : undefined;
}
