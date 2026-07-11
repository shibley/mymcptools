import { NextRequest, NextResponse } from "next/server";
import { authenticate, withRateLimitHeaders } from "@/lib/api/auth";
import { getDrifts, latestDriftAt } from "@/lib/trust/drift-store";
import { generatedAt } from "@/lib/trust/status-store";
import type { DriftEvent } from "@/lib/trust/types";

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

// GET /api/v1/drift — paginated feed of tool-schema / protocol-version drift
// events, newest-first (PRD P0-4 exposed via the P0-7 read API). Query params:
//   since=<ISO>   only events at/after this timestamp
//   slug=<slug>   only events for one server
//   filter=schema|protocol   restrict to schema-only or protocol-only drift
//   limit (<=200), cursor|offset
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

  const filter = q.get("filter");
  if (filter && filter !== "schema" && filter !== "protocol") {
    const res = NextResponse.json(
      {
        error: "bad_request",
        message: "filter must be 'schema' or 'protocol'.",
      },
      { status: 400 }
    );
    return withRateLimitHeaders(res, auth.rate);
  }

  let rows: readonly DriftEvent[] = getDrifts({ slug, sinceMs });
  if (filter === "schema") rows = rows.filter((d) => d.schema_changed);
  if (filter === "protocol") rows = rows.filter((d) => d.protocol_version_changed);

  const total = rows.length;
  const page = rows.slice(offset, offset + limit);
  const nextOffset = offset + limit;
  const nextCursor = nextOffset < total ? String(nextOffset) : null;

  const res = NextResponse.json({
    generated_at: generatedAt(),
    latest_drift_at: latestDriftAt(),
    pagination: {
      total,
      limit,
      offset,
      next_cursor: nextCursor,
    },
    drift_events: page,
  });
  return withRateLimitHeaders(res, auth.rate);
}
