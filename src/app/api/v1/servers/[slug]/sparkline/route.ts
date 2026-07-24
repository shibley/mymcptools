import { NextRequest, NextResponse } from "next/server";
import {
  computeUptimeSparkline,
  renderUptimeSparkline,
} from "@/lib/trust/sparkline";
import { getHistory } from "@/lib/trust/history-store";
import { generatedAt } from "@/lib/trust/status-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/servers/{slug}/sparkline — embeddable uptime-history SVG (PRD P1-2).
//
// The historical companion to /badge: the badge shows the CURRENT verdict, this
// shows day-by-day uptime as a row of colored bars + an overall uptime %.
//
// Intentionally UNAUTHENTICATED, like /badge: sparklines are embedded via <img>
// in READMEs and docs where no auth header can be sent. An unknown/never-probed
// slug still returns a valid, correctly-sized "no data" SVG with 200 so the
// <img> never breaks.
//
// Optional query params:
//   ?days=N    window width in days (default 14, clamped 1..90)
//   ?label=... override the left-hand chip label (default "uptime")
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { searchParams } = new URL(req.url);

  const daysRaw = Number.parseInt(searchParams.get("days") ?? "", 10);
  const days = Number.isFinite(daysRaw) ? daysRaw : 14;
  const label = searchParams.get("label") ?? undefined;

  // Pull enough trailing points to cover the widest window at a dense cadence.
  const points = getHistory(slug, 5000);
  const sparkline = computeUptimeSparkline(points, days, generatedAt());

  const svg = renderUptimeSparkline({ sparkline, label });

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Short cache: uptime data refreshes on the probe cadence, and README
      // consumers/proxies (e.g. GitHub Camo) should not pin a stale sparkline.
      "Cache-Control":
        "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
