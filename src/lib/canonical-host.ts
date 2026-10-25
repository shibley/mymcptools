/** Hosts that serve a duplicate copy of the site (see src/middleware.ts). */
export const DUPLICATE_HOSTS = new Set(['mymcptools.vercel.app']);
export const CANONICAL_ORIGIN = 'https://mymcptools.com';

/**
 * Where a page request on a duplicate host should 308 to, or null to serve it.
 * /api/* is never redirected: webhook senders and MCP clients don't reliably
 * follow redirects on POST.
 */
export function canonicalRedirectFor(host: string | null, pathname: string, search: string): string | null {
  if (!DUPLICATE_HOSTS.has((host ?? '').toLowerCase().replace(/:\d+$/, ''))) return null;
  if (pathname === '/api' || pathname.startsWith('/api/')) return null;
  return `${CANONICAL_ORIGIN}${pathname}${search}`;
}
