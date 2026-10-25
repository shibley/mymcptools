import { NextResponse } from "next/server";
import { getPaidCatalogSlugs } from "@/lib/paid-listings";
import { SERVER_SLUG_RE } from "@/lib/maker-door";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Is this catalog listing paid-Featured? Read by the server page's badge
 * island: /servers/[slug] is prerendered, so a maker-door order (which needs
 * no deploy to land) can only reach the page's badge from the client. Cached
 * at the edge for a minute; the overlay itself is cached 60s per lambda.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const featured = SERVER_SLUG_RE.test(slug) && (await getPaidCatalogSlugs()).has(slug);
  return NextResponse.json(
    { featured },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
