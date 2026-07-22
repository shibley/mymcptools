// Read-side accessor for the FULL append-only probe-events.jsonl history
// (PRD P0-5 probe_events) — every row, both ProbeResult probes and DriftEvent
// drift rows, in one chronological stream. history-store keeps only per-slug
// probe verdicts (for the sparkline) and drift-store keeps only drift rows;
// the daily digest (PRD P1-1) needs BOTH interleaved to replay each server's
// verdict timeline and detect DOWN/recover transitions, so it reads here.
//
// Like the sibling stores the JSONL is read once at module load and cached.
// Rows are parsed but NOT semantically validated here — computeDigest does its
// own strict shape-check on every row and silently drops anything malformed.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProbeEventRow } from "@/lib/trust/digest";

const EVENTS_PATH = join(process.cwd(), "src", "data", "probe-events.jsonl");

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function loadEvents(): ProbeEventRow[] {
  let raw: string;
  try {
    raw = readFileSync(EVENTS_PATH, "utf8");
  } catch {
    return []; // no history file yet — empty digest input
  }

  const rows: ProbeEventRow[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let row: unknown;
    try {
      row = JSON.parse(trimmed);
    } catch {
      continue; // tolerate a partially-written / malformed line
    }
    // Keep any object; computeDigest validates probe-vs-drift shape itself.
    if (isObject(row)) rows.push(row as ProbeEventRow);
  }
  return rows;
}

const allEvents = loadEvents();

/** Every probe-events row (probes + drift), load order (do not mutate). */
export function getAllEvents(): readonly ProbeEventRow[] {
  return allEvents;
}

/**
 * ISO-8601 timestamp of the most recent event in the history, or null when the
 * history is empty. Considers both probe rows (`checked_at`) and drift rows
 * (`changed_at`) so the digest can anchor its window to the freshest data.
 */
export function latestEventAt(): string | null {
  let latest: string | null = null;
  for (const row of allEvents) {
    const r = row as Record<string, unknown>;
    const ts =
      typeof r.checked_at === "string"
        ? r.checked_at
        : typeof r.changed_at === "string"
          ? r.changed_at
          : null;
    if (ts && (latest === null || ts > latest)) latest = ts;
  }
  return latest;
}
