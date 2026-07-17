import { NextRequest, NextResponse } from "next/server";
import { badgeStateFor, renderBadge } from "@/lib/trust/badge";
import { getStatus } from "@/lib/trust/status-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/servers/{slug}/badge — embeddable live-status SVG badge.
//
// Intentionally UNAUTHENTICATED: badges are embedded via <img> in READMEs and
// docs where no auth header can be sent. This is the read-only "verified live"
// signal (PRD P0-6 surfacing + P2-1 badge upsell foundation). Unknown slugs
// still return a valid gray "unknown" badge with 200 so the <img> never breaks.
//
// Optional query params:
//   ?label=...   override the left-hand label (default "mcp")
//   ?message=... override the right-hand text (default: verdict message)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const status = getStatus(slug);
  const state = badgeStateFor(status?.verdict);

  const { searchParams } = new URL(req.url);
  const label = searchParams.get("label") ?? undefined;
  const message = searchParams.get("message") ?? undefined;

  const svg = renderBadge({ state, label, message });

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Short cache: verdict data refreshes on the probe cadence, and README
      // consumers/proxies (e.g. GitHub Camo) should not pin a stale verdict.
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
