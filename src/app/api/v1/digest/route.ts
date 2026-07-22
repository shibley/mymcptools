import { NextRequest, NextResponse } from "next/server";
import { authenticate, withRateLimitHeaders } from "@/lib/api/auth";
import { computeDigest, renderDigestMarkdown } from "@/lib/trust/digest";
import { getAllEvents, latestEventAt } from "@/lib/trust/events-store";
import { generatedAt, statusStore } from "@/lib/trust/status-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_WINDOW_HOURS = 24;
const MAX_WINDOW_HOURS = 720; // 30 days

function parseWindowHours(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_WINDOW_HOURS;
  return Math.min(n, MAX_WINDOW_HOURS);
}

// GET /api/v1/digest — the "what changed" feed (PRD P1-1 daily digest, exposed
// via the P0-7 read API). Replays the full probe-events history over a lookback
// window and returns three buckets — servers newly DOWN, servers that drifted
// (tool-schema / protocol), and servers that recovered — the change stream that
// backs the content engine and a DaaS "alert me when a server breaks" consumer,
// distinct from /status (current snapshot) and /drift (drift rows only).
//
// Query params:
//   window_hours=<n>   lookback window (default 24, max 720)
//   as_of=<ISO>        anchor the window END (default: dataset generated_at)
//   format=json|md     response shape (default json; md → text/markdown for the
//                      content engine)
export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if (!auth.ok) return auth.response;

  const q = req.nextUrl.searchParams;
  const windowHours = parseWindowHours(q.get("window_hours"));

  // Anchor defaults to the dataset's generated_at so the digest is deterministic
  // against committed data (not wall-clock, which may sit days past the last
  // probe and yield an empty window). Callers may override with as_of.
  const asOfRaw = q.get("as_of");
  let nowMs: number;
  if (asOfRaw) {
    const t = Date.parse(asOfRaw);
    if (Number.isNaN(t)) {
      const res = NextResponse.json(
        { error: "bad_request", message: "as_of must be an ISO-8601 timestamp." },
        { status: 400 }
      );
      return withRateLimitHeaders(res, auth.rate);
    }
    nowMs = t;
  } else {
    nowMs = Date.parse(generatedAt());
  }

  const format = q.get("format");
  if (format && format !== "json" && format !== "md") {
    const res = NextResponse.json(
      { error: "bad_request", message: "format must be 'json' or 'md'." },
      { status: 400 }
    );
    return withRateLimitHeaders(res, auth.rate);
  }

  const digest = computeDigest([...getAllEvents()], {
    windowHours,
    nowMs,
    status: statusStore(),
  });

  if (format === "md") {
    const res = new NextResponse(renderDigestMarkdown(digest), {
      status: 200,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
    return withRateLimitHeaders(res, auth.rate);
  }

  const res = NextResponse.json({
    dataset_generated_at: generatedAt(),
    latest_event_at: latestEventAt(),
    ...digest,
  });
  return withRateLimitHeaders(res, auth.rate);
}
