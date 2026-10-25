/**
 * WHAT THE $49/mo PRO TIER ACTUALLY DELIVERS — derived from the stores, never
 * typed by hand.
 *
 * THE DEFECT THIS FILE EXISTS TO KILL
 *   The last screen a buyer sees before deciding is the Stripe order summary,
 *   and until now it was a string literal inside the checkout route:
 *
 *     "Self-serve API key for the MCP Trust Data API: live status, uptime,
 *      latency, and drift for every probed MCP server. 120 req/min."
 *
 *   Measured against the committed stores on 2026-09-27, over 2,440 catalog
 *   servers, that sentence named the four THINNEST facts we hold and omitted
 *   the two widest:
 *
 *     uptime          0 rows    — the field is never populated anywhere
 *     live status    44 rows    — 2,396 servers are local/stdio, UNPROBEABLE
 *     latency        44 rows
 *     drift           4 slugs   — 21 events lifetime
 *     ---- not mentioned at all ----
 *     install_signal 1,233 rows — 423 installable, 810 proven phantom
 *     static_signal    915 rows — repo commit/release dates
 *
 *   So the order summary promised a dataset that is 1.8% populated and said
 *   nothing about the half of the catalog we can actually speak to. Worse, the
 *   free tier hands /api/v1/status to anyone: 16 keyless callers pulled it in
 *   the last 30 days and SAW those nulls, and were then quoted $49/mo for the
 *   nulls. Paid checkout reached 4 times in 30 days, paid 0 times.
 *
 *   The fix is not a better sentence. A sentence rots the moment a store moves.
 *   Buyer-facing copy is GENERATED from the counts here, and three rules are
 *   enforced by `npm run offer:selfcheck`:
 *
 *     1. A capability with ZERO rows may never be named to a buyer. This is
 *        what "uptime" was.
 *     2. A capability below MIN_HEADLINE_ROWS may be named only with its own
 *        row count attached — no bare noun that reads as catalog-wide.
 *     3. No unbounded breadth claim ("every ... server"). Breadth is a number.
 *
 * WHY A ROW COUNT IS THE RIGHT UNIT
 *   A machine consumer routing on this catalog is asking "for how many of the
 *   2,440 do you hold this fact?" — coverage, not adjectives. That is also the
 *   only number that makes the honest case: install_signal's 810 proven
 *   phantoms are a hard negative no other MCP index publishes, and a hard
 *   negative is worth more to a router than another null.
 */

import { allStatuses } from "@/lib/trust/status-store";
import { getStaticSignal } from "@/lib/trust/static-signals-store";
import { getInstallCheck } from "@/lib/trust/install-check";
import { getDrifts } from "@/lib/trust/drift-store";
import { getAllEvents } from "@/lib/trust/events-store";
import { computeIncidents } from "@/lib/trust/incidents";

/**
 * At or above this many rows, a capability may be stated as a plain claim.
 * Below it, the claim must carry its count so nobody reads it as catalog-wide.
 */
export const MIN_HEADLINE_ROWS = 100;

export type ProCapabilityId =
  | "install_signal"
  | "static_signal"
  | "incidents"
  | "live_status"
  | "drift"
  | "uptime";

export interface ProCapability {
  id: ProCapabilityId;
  /** Noun phrase used in buyer-facing copy. */
  label: string;
  /** Servers we hold this fact for. The only breadth number we may publish. */
  rows: number;
  /** Servers the rows are drawn from. */
  population: number;
  /** The store the count came from, so a reviewer can re-derive it. */
  source: string;
  /** Endpoints a Pro key unlocks that serve this fact. */
  endpoints: readonly string[];
  /** rows > 0 — below this a capability is unsellable and must stay unnamed. */
  mentionable: boolean;
  /** rows >= MIN_HEADLINE_ROWS — may be claimed without a count attached. */
  headline: boolean;
}

function classify(
  c: Omit<ProCapability, "mentionable" | "headline">
): ProCapability {
  return {
    ...c,
    mentionable: c.rows > 0,
    headline: c.rows >= MIN_HEADLINE_ROWS,
  };
}

/**
 * Every capability the paid tier could speak to, with its live row count.
 * Computed once per process off the committed stores.
 */
let cached: readonly ProCapability[] | null = null;

export function proCapabilities(): readonly ProCapability[] {
  if (cached) return cached;

  const rows = allStatuses();
  const population = rows.length;

  let staticDated = 0;
  let installChecked = 0;
  let installExists = 0;
  let installPhantom = 0;
  let liveLatency = 0;

  for (const r of rows) {
    const ss = getStaticSignal(r.slug);
    if (ss && (ss.last_commit_at || ss.last_release_at)) staticDated += 1;
    const ic = getInstallCheck(r.slug);
    if (ic) {
      installChecked += 1;
      if (ic.exists) installExists += 1;
      else installPhantom += 1;
    }
    if (r.latency_ms != null) liveLatency += 1;
  }

  const driftSlugs = new Set(getDrifts().map((d) => d.slug)).size;

  const incidentRows = computeIncidents(getAllEvents());
  const incidentList = Array.isArray(incidentRows)
    ? incidentRows
    : ((incidentRows as { incidents?: readonly { slug: string }[] }).incidents ??
      []);
  const incidentSlugs = new Set(incidentList.map((i) => i.slug)).size;

  cached = [
    classify({
      id: "install_signal",
      label: `dated install-command verification (${installExists} installable, ${installPhantom} naming a package that does not exist)`,
      rows: installChecked,
      population,
      source: "src/data/install-registry-check.json",
      endpoints: ["/api/v1/export", "/api/v1/status"],
    }),
    classify({
      id: "static_signal",
      label: "last-commit / last-release freshness dates",
      rows: staticDated,
      population,
      source: "src/data/static-signals.json",
      endpoints: ["/api/v1/export", "/api/v1/status"],
    }),
    classify({
      id: "incidents",
      label: "reconstructed outage incidents",
      rows: incidentSlugs,
      population,
      source: "src/data/probe-events.jsonl via computeIncidents()",
      endpoints: ["/api/v1/incidents", "/api/v1/digest"],
    }),
    classify({
      id: "live_status",
      label: "live MCP-handshake status and latency",
      rows: liveLatency,
      population,
      source: "src/data/probe-status.json (latency_ms non-null)",
      endpoints: ["/api/v1/status", "/api/v1/export"],
    }),
    classify({
      id: "drift",
      label: "tool-schema drift events",
      rows: driftSlugs,
      population,
      source: "src/data/probe-events.jsonl (type=drift)",
      endpoints: ["/api/v1/drift"],
    }),
    classify({
      id: "uptime",
      label: "uptime percentage",
      rows: 0, // no store populates this; see the header note
      population,
      source: "none — no store populates uptime",
      endpoints: [],
    }),
  ];

  return cached;
}

/** Capabilities that may appear in buyer-facing copy at all, widest first. */
export function sellableCapabilities(): readonly ProCapability[] {
  return proCapabilities()
    .filter((c) => c.mentionable)
    .slice()
    .sort((a, b) => b.rows - a.rows);
}

/** Capabilities held back because we hold zero rows of them. */
export function suppressedCapabilities(): readonly ProCapability[] {
  return proCapabilities().filter((c) => !c.mentionable);
}

/** Servers in the population the coverage numbers are quoted against. */
export function proPopulation(): number {
  return proCapabilities()[0]?.population ?? 0;
}

/** One capability, for a caller that needs a specific count. */
export function proCapability(id: ProCapabilityId): ProCapability | undefined {
  return proCapabilities().find((c) => c.id === id);
}

/** Name shown on the Stripe order summary. */
export function proProductName(): string {
  return "MyMCPTools Trust Data API — Pro";
}

/**
 * The Stripe order-summary description, generated. A headline capability is
 * stated as "<rows> of <population> servers: <label>"; a below-floor one keeps
 * its count too, so nothing here can be read as catalog-wide. Zero-row
 * capabilities are absent by construction.
 */
export function proProductDescription(): string {
  const pop = proPopulation();
  const parts = sellableCapabilities().map(
    (c) => `${c.rows.toLocaleString("en-US")} ${c.label}`
  );
  return (
    `API key for the MCP Trust Data API. Coverage across ${pop.toLocaleString("en-US")} catalogued MCP servers: ` +
    `${parts.join("; ")}. Most servers are local/stdio and cannot be probed live — ` +
    `the registry and repository signals above are what we hold for them. ` +
    `JSON + CSV, 120 req/min.`
  );
}

/**
 * Machine-readable coverage block for the Pro plan in every 401/429 upgrade
 * body. The buyers here are scripts: a coverage table answers "is this worth
 * $49" in one parse, where prose does not.
 */
export function proCoverageBlock() {
  return {
    servers_catalogued: proPopulation(),
    coverage: sellableCapabilities().map((c) => ({
      signal: c.id,
      servers_covered: c.rows,
      endpoints: c.endpoints,
    })),
    not_available: suppressedCapabilities().map((c) => c.id),
  };
}
