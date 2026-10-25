import { NextResponse, type NextRequest } from 'next/server';
import { canonicalRedirectFor } from '@/lib/canonical-host';

/**
 * The project's default `*.vercel.app` alias serves the whole site a second
 * time. Measured 2026-10-09 (`vercel logs`, 2,000 production requests): 28% of
 * all requests arrived on mymcptools.vercel.app, and because that host is a
 * separate CDN cache key with almost no warm entries it produced 164 of the
 * 306 PRERENDER reads in the sample — i.e. over half of the project's ISR Read
 * + Fast Origin Transfer bill came from a duplicate host nobody links to.
 *
 * Pages there get a 308 to the canonical host; the redirect has no body and
 * the target is usually already edge-cached on mymcptools.com. /api/* is left
 * alone so anything (webhooks, MCP clients) that was registered against the
 * alias keeps working. Preview deployments use other hostnames and are not
 * affected.
 */

export function middleware(request: NextRequest) {
  // Block Singapore bot traffic
  const country = request.headers.get('x-vercel-ip-country');
  if (country === 'SG') {
    return new NextResponse('Access denied', { status: 403 });
  }

  const target = canonicalRedirectFor(
    request.headers.get('host'),
    request.nextUrl.pathname,
    request.nextUrl.search,
  );
  if (target) return NextResponse.redirect(target, 308);

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|llms.txt|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico).*)'],
};
