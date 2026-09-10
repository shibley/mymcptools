/**
 * The one definition of a beacon session identity for mymcptools.
 *
 * Three writers put rows into `analytics.events` under `site = 'mymcptools'`:
 * `/api/collect` (browser pageviews), `src/lib/analytics/mcp-usage.ts`
 * (`/api/mcp:*` rows) and `src/lib/analytics/trust-api-usage.ts` (`/api/v1/*`).
 * They can only be joined to each other if all three derive the identity
 * byte-for-byte the same way, so the derivation lives here and nowhere else.
 *
 * Ported from aisotools `src/lib/session-identity.ts` (thread #220). The two
 * properties intentionally use the SAME algorithm but are separated by the
 * `site` column, not by the hash.
 *
 * Privacy: sha256(ip | ua | utc-date | salt), truncated to 32 hex chars,
 * rotating every UTC day. The raw IP is used to derive the hash and discarded —
 * it is never stored or logged.
 *
 * ⚠️ Any change here changes ALL writers. Do not inline a copy of this.
 */
import { createHash } from "node:crypto";

/** Header precedence shared by every writer. Keep the order. */
export function clientIp(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") || h.get("cf-connecting-ip") || "0.0.0.0";
}

/** The truncation applied to the UA before hashing. */
function uaForHash(h: Headers): string {
  const raw = h.get("user-agent");
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  return s ? s.slice(0, 512) : "";
}

export function analyticsSalt(): string {
  const explicit = process.env.ANALYTICS_SALT?.trim();
  if (explicit) return explicit;
  // Derived from the connection string so the salt is never empty even if
  // ANALYTICS_SALT was not provisioned. Matches mcp-usage.ts / trust-api-usage.ts.
  const cs = process.env.ANALYTICS_DATABASE_URL || "unsalted";
  return createHash("sha256").update(cs).digest("hex").slice(0, 32);
}

/**
 * The cookieless daily-rotating session identity written to
 * `analytics.events.session_hash`.
 *
 * Returns null when no salt material exists at all, so a misconfigured
 * environment writes nothing rather than a hash that silently collides with
 * everyone else's.
 */
export function sessionHash(h: Headers): string | null {
  const salt = analyticsSalt();
  if (!salt) return null;
  const utcDate = new Date().toISOString().slice(0, 10);
  return createHash("sha256")
    .update(`${clientIp(h)}|${uaForHash(h)}|${utcDate}|${salt}`)
    .digest("hex")
    .slice(0, 32);
}
