import { NextRequest, NextResponse } from "next/server";
import { authenticate, withRateLimitHeaders } from "@/lib/api/auth";
import { computeCatalogStatsFromStore } from "@/lib/trust/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/stats — catalog-wide aggregate health in one object (PRD P0-7
// data layer): verdict mix + percentages, the serving share of the probeable
// pool, transport mix, drift counts, latency p50/p95, tool totals, and probe
// freshness. Lets a buyer/dashboard read the population health headline without
// paginating every current_status row. No query params.
export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if (!auth.ok) return auth.response;

  const stats = computeCatalogStatsFromStore();
  const res = NextResponse.json(stats);
  return withRateLimitHeaders(res, auth.rate);
}
