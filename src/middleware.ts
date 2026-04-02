import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Block Singapore bot traffic
  const country = request.headers.get('x-vercel-ip-country');
  if (country === 'SG') {
    return new NextResponse('Access denied', { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|llms.txt|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico).*)'],
};
