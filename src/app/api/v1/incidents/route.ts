import { NextRequest, NextResponse } from "next/server";
import { authenticate, withRateLimitHeaders } from "@/lib/api/auth";
import { getAllEvents, latestEventAt } from "@/lib/trust/events-store";
import { computeIncidents } from "@/lib/trust/incidents";
import { generatedAt } from "@/lib/trust/status-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function parseOffset(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

// GET /api/v1/incidents — reconstructed outage incidents (contiguous DOWN runs)
// per server from the probe-events history (PRD P0-5 exposed via the P0-7 read
// API). Distinct from /digest (last-N-hours transition buckets) and
// /servers/{slug}/history (raw probe points): each incident is a discrete
// started_at→ended_at outage window with a duration, recovery verdict, and
// failure context — the status-page "past incidents" view. Newest-first.
//
// Query params:
//   slug=<slug>                  only incidents for one server
//   since=<ISO>                  only incidents that started at/after this time
//   status=ongoing|resolved      restrict by resolution state
//   min_duration_seconds=<int>   drop resolved incidents shorter than this
//   limit (<=200), cursor|offset pagination
export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if (!auth.ok) return auth.response;

  const q = req.nextUrl.searchParams;
  const limit = parseLimit(q.get("limit"));
  const offset = parseOffset(q.get("cursor") ?? q.get("offset"));
  const slug = q.get("slug")?.trim() || undefined;

  let sinceMs: number | null = null;
  const sinceRaw = q.get("since");
  if (sinceRaw) {
    const t = Date.parse(sinceRaw);
    if (Number.isNaN(t)) {
      const res = NextResponse.json(
        {
          error: "bad_request",
          message: "since must be an ISO-8601 timestamp.",
        },
        { status: 400 }
      );
      return withRateLimitHeaders(res, auth.rate);
    }
    sinceMs = t;
  }

  const statusRaw = q.get("status");
  if (statusRaw && statusRaw !== "ongoing" && statusRaw !== "resolved") {
    const res = NextResponse.json(
      {
        error: "bad_request",
        message: "status must be 'ongoing' or 'resolved'.",
      },
      { status: 400 }
    );
    return withRateLimitHeaders(res, auth.rate);
  }

  let minDurationSeconds: number | null = null;
  const minRaw = q.get("min_duration_seconds");
  if (minRaw != null) {
    const n = Number.parseInt(minRaw, 10);
    if (!Number.isFinite(n) || n < 0) {
      const res = NextResponse.json(
        {
          error: "bad_request",
          message: "min_duration_seconds must be a non-negative integer.",
        },
        { status: 400 }
      );
      return withRateLimitHeaders(res, auth.rate);
    }
    minDurationSeconds = n;
  }

  const { incidents, summary } = computeIncidents(getAllEvents(), {
    slug,
    sinceMs,
    status: statusRaw as "ongoing" | "resolved" | null,
    minDurationSeconds,
  });

  const total = incidents.length;
  const page = incidents.slice(offset, offset + limit);
  const nextOffset = offset + limit;
  const nextCursor = nextOffset < total ? String(nextOffset) : null;

  const res = NextResponse.json({
    generated_at: generatedAt(),
    latest_event_at: latestEventAt(),
    summary,
    pagination: {
      total,
      limit,
      offset,
      next_cursor: nextCursor,
    },
    incidents: page,
  });
  return withRateLimitHeaders(res, auth.rate);
}
