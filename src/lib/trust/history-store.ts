// Read-side accessor for the append-only probe-events.jsonl history (PRD P0-5
// probe_events). Unlike probe-status.json this is JSONL, so it cannot be a
// static import — it is read once at build time via fs and grouped by slug.
// Drift rows (type === "drift") are interleaved in the same file and skipped
// here; only ProbeResult rows carry a verdict for the uptime sparkline (P1-2).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Verdict } from "@/lib/trust/types";

/** One point in a server's trailing uptime history. */
export interface HistoryPoint {
  checked_at: string;
  verdict: Verdict;
  latency_ms: number | null;
}

const EVENTS_PATH = join(process.cwd(), "src", "data", "probe-events.jsonl");

function loadHistory(): Map<string, HistoryPoint[]> {
  const bySlug = new Map<string, HistoryPoint[]>();

  let raw: string;
  try {
    raw = readFileSync(EVENTS_PATH, "utf8");
  } catch {
    return bySlug; // no history file yet — sparkline degrades to nothing
  }

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let row: unknown;
    try {
      row = JSON.parse(trimmed);
    } catch {
      continue; // tolerate a partially-written / malformed line
    }

    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    if (r.type === "drift") continue; // drift events carry no verdict
    if (typeof r.slug !== "string" || typeof r.verdict !== "string") continue;
    if (typeof r.checked_at !== "string") continue;

    const point: HistoryPoint = {
      checked_at: r.checked_at,
      verdict: r.verdict as Verdict,
      latency_ms: typeof r.latency_ms === "number" ? r.latency_ms : null,
    };
    const list = bySlug.get(r.slug);
    if (list) list.push(point);
    else bySlug.set(r.slug, [point]);
  }

  // JSONL is append-only chronological, but sort defensively (oldest→newest).
  for (const list of bySlug.values()) {
    list.sort((a, b) => a.checked_at.localeCompare(b.checked_at));
  }
  return bySlug;
}

const historyBySlug = loadHistory();

/**
 * Trailing probe history for one server, oldest→newest. Returns at most `limit`
 * most-recent points. Empty array when the slug has never been probed.
 */
export function getHistory(slug: string, limit = 30): readonly HistoryPoint[] {
  const list = historyBySlug.get(slug);
  if (!list || list.length === 0) return [];
  return list.length > limit ? list.slice(list.length - limit) : list;
}
