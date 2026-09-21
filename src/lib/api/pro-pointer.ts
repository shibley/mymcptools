/**
 * The path from a FREE /api/v1 response to the PAID endpoints.
 *
 * WHY THIS EXISTS: the free tier is the only part of the trust API with real
 * non-crawler callers (10 in the 30 days to 2026-09-19), and the $49/mo buy
 * path only exists on a gated 401. But nothing a free response returned ever
 * named a gated endpoint — /status, /stats and /servers/{slug}/status carried
 * no link to history, incidents, drift or the digest — so a caller who was
 * already pulling our data had no way to reach the paywall except by reading
 * /developers. Measured the same day: 0 non-crawler gated attempts in 30 days.
 * The meter could not move because the road to it did not exist.
 *
 * Every free-tier body now carries a `pro` block of concrete, followable URLs.
 * Each one is tagged `?via=<free endpoint>` so a gated attempt that came from a
 * pointer is attributable (recorded on the gated row as `referrer_full =
 * 'pointer:<via>'`, read by `npm run demand:report`). An agent or script that
 * follows a URL from a JSON body lands on a 401 that already sells the key.
 */
import { PRO_PRICE_USD, UPGRADE_URL } from "./auth";
import { POINTER_SOURCES, type PointerSource } from "./checkout-entry";

export { POINTER_SOURCES };
export type { PointerSource };

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://mymcptools.com";

function tagged(path: string, via: PointerSource): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${SITE}${path}${sep}via=${via}`;
}

/**
 * The `pro` block embedded in a free-tier response body. When `slug` is given
 * (the per-server status endpoint) the URLs are scoped to that server, because
 * "and what happened to THIS server before now?" is the question a single
 * status read leaves open.
 */
export function proPointer(via: PointerSource, slug?: string) {
  const s = slug ? encodeURIComponent(slug) : null;
  const endpoints: Record<string, string> = s
    ? {
        history: tagged(`/api/v1/servers/${s}/history`, via),
        incidents: tagged(`/api/v1/incidents?slug=${s}`, via),
        drift: tagged(`/api/v1/drift?slug=${s}`, via),
      }
    : {
        digest: tagged(`/api/v1/digest?window_hours=24`, via),
        incidents: tagged(`/api/v1/incidents`, via),
        drift: tagged(`/api/v1/drift`, via),
        export: tagged(`/api/v1/export?format=json`, via),
      };
  return {
    tier: "free",
    note: s
      ? "Uptime history, past outages and tool-schema drift for this server are on the Pro key."
      : "What changed in the last 24h, outage history, schema drift and the full export are on the Pro key.",
    price_usd_month: PRO_PRICE_USD,
    upgrade_url: UPGRADE_URL,
    endpoints,
  };
}

/** Read the `?via=` tag off a gated request; anything outside the set is null. */
export function readVia(url: URL | null | undefined): PointerSource | null {
  const v = url?.searchParams.get("via");
  return v && (POINTER_SOURCES as readonly string[]).includes(v) ? (v as PointerSource) : null;
}
