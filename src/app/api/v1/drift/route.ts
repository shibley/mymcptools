import { NextRequest, NextResponse } from "next/server";
import { withRateLimitHeaders } from "@/lib/api/auth";
import {
  trialGrant,
  trialPayload,
  withTrialHeaders,
} from "@/lib/api/trial-response";
import { authenticateGated } from "@/lib/analytics/trust-api-usage";
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
  const auth = await authenticateGated(req, "/api/v1/drift");
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
  // A trial is capped at the FIRST rowCap rows and cannot page past them —
  // otherwise three calls a day would walk the whole feed. `next_cursor` is
  // therefore null on a trial: the cursor a trial caller wants is the key.
  const grant = trialGrant(auth);
  const effLimit = grant ? Math.min(limit, grant.rowCap) : limit;
  const effOffset = grant ? 0 : offset;
  const page = rows.slice(effOffset, effOffset + effLimit);
  const nextOffset = effOffset + effLimit;
  const nextCursor = !grant && nextOffset < total ? String(nextOffset) : null;

  const res = NextResponse.json({
    generated_at: generatedAt(),
    latest_drift_at: latestDriftAt(),
    pagination: {
      total,
      limit: effLimit,
      offset: effOffset,
      next_cursor: nextCursor,
    },
    drift_events: page,
    ...(grant
      ? {
          trial: trialPayload(grant, page.length, Math.max(0, total - page.length)),
        }
      : {}),
  });
  return withTrialHeaders(withRateLimitHeaders(res, auth.rate), auth);
}
