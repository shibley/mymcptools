import { NextRequest, NextResponse } from "next/server";
import { authenticate, withRateLimitHeaders } from "@/lib/api/auth";
import { allStatuses, generatedAt, summary } from "@/lib/trust/status-store";
import type { CurrentStatus, Verdict } from "@/lib/trust/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** filter=healthy keeps only servers currently serving (GOOD or WARN). */
const HEALTHY: ReadonlySet<Verdict> = new Set<Verdict>(["GOOD", "WARN"]);

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

// GET /api/v1/status — paginated current_status list (PRD P0-7).
// Query params: filter=healthy, updated_since=<ISO>, limit (<=200), cursor|offset.
export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if (!auth.ok) return auth.response;

  const q = req.nextUrl.searchParams;
  const limit = parseLimit(q.get("limit"));
  // `cursor` is an opaque offset; accept either name for ergonomics.
  const offset = parseOffset(q.get("cursor") ?? q.get("offset"));

  const filterHealthy = q.get("filter") === "healthy";

  let updatedSince: number | null = null;
  const updatedSinceRaw = q.get("updated_since");
  if (updatedSinceRaw) {
    const t = Date.parse(updatedSinceRaw);
    if (Number.isNaN(t)) {
      const res = NextResponse.json(
        {
          error: "bad_request",
          message: "updated_since must be an ISO-8601 timestamp.",
        },
        { status: 400 }
      );
      return withRateLimitHeaders(res, auth.rate);
    }
    updatedSince = t;
  }

  let rows: readonly CurrentStatus[] = allStatuses();
  if (filterHealthy) rows = rows.filter((s) => HEALTHY.has(s.verdict));
  if (updatedSince !== null) {
    rows = rows.filter((s) => {
      const checked = Date.parse(s.checked_at);
      return !Number.isNaN(checked) && checked >= updatedSince!;
    });
  }

  const total = rows.length;
  const page = rows.slice(offset, offset + limit);
  const nextOffset = offset + limit;
  const nextCursor = nextOffset < total ? String(nextOffset) : null;

  const res = NextResponse.json({
    generated_at: generatedAt(),
    summary: summary(),
    pagination: {
      total,
      limit,
      offset,
      next_cursor: nextCursor,
    },
    statuses: page,
  });
  return withRateLimitHeaders(res, auth.rate);
}
