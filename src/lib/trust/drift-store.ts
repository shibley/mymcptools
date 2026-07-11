// Read-side accessor for DriftEvent rows in the append-only probe-events.jsonl
// history (PRD P0-4 drift). The digest and webhooks already consume drift rows
// internally; this store exposes them for the public read API (a queryable
// drift feed — the "did this server's tool schema change?" signal a DaaS
// consumer routes on). Like history-store, the JSONL is read once at module
// load and cached; probe rows (no `type` discriminator) are skipped here.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DriftEvent } from "@/lib/trust/types";

const EVENTS_PATH = join(process.cwd(), "src", "data", "probe-events.jsonl");

function isDriftRow(row: unknown): row is DriftEvent {
  if (typeof row !== "object" || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    r.type === "drift" &&
    typeof r.slug === "string" &&
    typeof r.changed_at === "string"
  );
}

function loadDrifts(): DriftEvent[] {
  let raw: string;
  try {
    raw = readFileSync(EVENTS_PATH, "utf8");
  } catch {
    return []; // no history file yet — empty feed
  }

  const drifts: DriftEvent[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let row: unknown;
    try {
      row = JSON.parse(trimmed);
    } catch {
      continue; // tolerate a partially-written / malformed line
    }
    if (isDriftRow(row)) drifts.push(row);
  }

  // Newest-first: the feed's default consumer wants the latest changes on top.
  drifts.sort((a, b) => b.changed_at.localeCompare(a.changed_at));
  return drifts;
}

const allDrifts = loadDrifts();

/** ISO-8601 timestamp of the most recent drift event, or null when none. */
export function latestDriftAt(): string | null {
  return allDrifts.length > 0 ? allDrifts[0].changed_at : null;
}

/**
 * All recorded drift events, newest-first (do not mutate). Optionally filtered
 * to a single server (`slug`) and/or to events at or after `sinceMs`
 * (epoch ms). Both filters are applied when supplied.
 */
export function getDrifts(opts: {
  slug?: string;
  sinceMs?: number | null;
} = {}): readonly DriftEvent[] {
  let rows: readonly DriftEvent[] = allDrifts;
  if (opts.slug) rows = rows.filter((d) => d.slug === opts.slug);
  if (typeof opts.sinceMs === "number") {
    rows = rows.filter((d) => {
      const t = Date.parse(d.changed_at);
      return !Number.isNaN(t) && t >= opts.sinceMs!;
    });
  }
  return rows;
}
