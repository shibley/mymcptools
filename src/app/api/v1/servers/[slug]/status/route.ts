import { NextRequest, NextResponse } from "next/server";
import { authenticate, withRateLimitHeaders } from "@/lib/api/auth";
import { generatedAt, getStatus } from "@/lib/trust/status-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/servers/{slug}/status — current_status for one server (PRD P0-7).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = authenticate(req);
  if (!auth.ok) return auth.response;

  const { slug } = await params;
  const status = getStatus(slug);

  if (!status) {
    const res = NextResponse.json(
      { error: "not_found", message: `No server with slug '${slug}'.` },
      { status: 404 }
    );
    return withRateLimitHeaders(res, auth.rate);
  }

  const res = NextResponse.json({
    generated_at: generatedAt(),
    status,
  });
  return withRateLimitHeaders(res, auth.rate);
}
