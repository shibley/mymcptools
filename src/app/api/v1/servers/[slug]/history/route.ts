import { NextRequest, NextResponse } from "next/server";
import { authenticate, withRateLimitHeaders } from "@/lib/api/auth";
import { getHistory, type HistoryPoint } from "@/lib/trust/history-store";
import { generatedAt, getStatus } from "@/lib/trust/status-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 200;

function parseLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

// p-th percentile of an ascending-sorted numeric array (nearest-rank).
function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  const idx = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[idx];
}

function summarize(points: readonly HistoryPoint[]) {
  // UNPROBEABLE points carry no liveness signal — exclude from uptime math.
  const probed = points.filter((p) => p.verdict !== "UNPROBEABLE");
  const verdictCounts: Record<string, number> = {};
  for (const p of probed) {
    verdictCounts[p.verdict] = (verdictCounts[p.verdict] ?? 0) + 1;
  }

  const healthy = verdictCounts["GOOD"] ?? 0;
  const uptimePct =
    probed.length > 0 ? Math.round((healthy / probed.length) * 1000) / 10 : null;

  const latencies = probed
    .map((p) => p.latency_ms)
    .filter((l): l is number => typeof l === "number")
    .sort((a, b) => a - b);

  return {
    checks: probed.length,
    uptime_pct: uptimePct,
    verdict_counts: verdictCounts,
    latency_p50_ms: percentile(latencies, 50),
    latency_p95_ms: percentile(latencies, 95),
    first_checked_at: probed[0]?.checked_at ?? null,
    last_checked_at: probed[probed.length - 1]?.checked_at ?? null,
  };
}

// GET /api/v1/servers/{slug}/history — trailing probe time-series for one
// server plus a derived uptime/latency summary (PRD P1-2 exposed via the P0-7
// read API). This is the data that backs the on-listing uptime sparkline;
// external consumers get the same points to render their own trend view or
// compute custom SLA windows. Query param: limit (<=200, default 30).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = authenticate(req);
  if (!auth.ok) return auth.response;

  const { slug } = await params;

  // 404 only when the server is unknown to the catalog; a known server with no
  // probe history yet returns 200 with an empty series (summary.checks === 0).
  if (!getStatus(slug)) {
    const res = NextResponse.json(
      { error: "not_found", message: `No server with slug '${slug}'.` },
      { status: 404 }
    );
    return withRateLimitHeaders(res, auth.rate);
  }

  const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
  const history = getHistory(slug, limit);

  const res = NextResponse.json({
    generated_at: generatedAt(),
    slug,
    summary: summarize(history),
    history,
  });
  return withRateLimitHeaders(res, auth.rate);
}
