import { MetadataRoute } from 'next';

/**
 * Action endpoints no crawler should fetch. Robots groups do NOT inherit from
 * `*`: a named group that says only `Allow: /` re-opens everything `*` closed.
 * Until 2026-10-05 every named group below did, and bingbot spent its crawl of
 * our server pages GETting the $49 buy form's action URL (33 checkout rows in
 * a day, all bingbot). /api/v1 and /api/mcp stay open to named crawlers.
 * Guarded by `npm run robots:selfcheck`.
 */
export const ACTION_PATHS = [
  '/api/trust-api/',
  '/api/checkout',
  '/api/submit',
  '/api/webhook',
  '/api/collect',
  '/admin/',
];

const NAMED_CRAWLERS = [
  'Googlebot',
  'Bingbot',
  'GPTBot',
  'ChatGPT-User',
  'Claude-Web',
  'Anthropic-AI',
  'ClaudeBot',
  'PerplexityBot',
  'Google-Extended',
  'Bytespider',
  'CCBot',
  'Applebot-Extended',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/'],
      },
      ...NAMED_CRAWLERS.map((userAgent) => ({ userAgent, allow: '/', disallow: ACTION_PATHS })),
    ],
    sitemap: 'https://mymcptools.com/sitemap.xml',
    host: 'https://mymcptools.com',
  };
}
