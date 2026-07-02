import type { Transport } from '@/lib/trust/types';

/**
 * Curated registry of PUBLICLY-DOCUMENTED remote MCP endpoints.
 *
 * The catalog (servers.ts) stores no remote endpoint URLs — every entry is a
 * local install command (npm/pip/binary/docker/source). This registry is the
 * honest bridge: it maps a small set of catalog slugs to the streamable-HTTP /
 * SSE endpoints their authors publish for hosted use.
 *
 * Rules for adding an entry:
 *  - The endpoint must be a documented, first-party hosted MCP endpoint.
 *  - Never fabricate a URL. If a server has no published remote endpoint, it
 *    stays out of here and is classified UNPROBEABLE by the inventory builder.
 *  - The prober reports the REAL verdict; an entry here is a probe target, not
 *    a claim of health. A wrong/aspirational path simply surfaces as DOWN.
 */
export interface RemoteEndpoint {
  /** Catalog slug in src/data/servers.ts. */
  slug: string;
  url: string;
  transport: Transport;
  /** Whether the author documents this endpoint as OAuth-gated. */
  expected_auth: boolean;
  /** Provenance note for auditability. */
  source: string;
}

export const remoteEndpoints: RemoteEndpoint[] = [
  // --- Public, no-auth (expected GOOD/WARN) ---
  {
    slug: 'globalping',
    url: 'https://mcp.globalping.dev/sse',
    transport: 'sse',
    expected_auth: false,
    source: 'globalping.io MCP docs',
  },
  {
    slug: 'huggingface',
    url: 'https://huggingface.co/mcp',
    transport: 'streamable-http',
    expected_auth: false,
    source: 'huggingface.co/settings/mcp',
  },

  // --- OAuth-gated first-party hosted endpoints (expected AUTH_REQUIRED) ---
  {
    slug: 'linear',
    url: 'https://mcp.linear.app/mcp',
    transport: 'streamable-http',
    expected_auth: true,
    source: 'linear.app/docs/mcp',
  },
  {
    slug: 'sentry',
    url: 'https://mcp.sentry.dev/mcp',
    transport: 'streamable-http',
    expected_auth: true,
    source: 'docs.sentry.io/product/sentry-mcp',
  },
  {
    slug: 'stripe',
    url: 'https://mcp.stripe.com',
    transport: 'streamable-http',
    expected_auth: true,
    source: 'docs.stripe.com/mcp',
  },
  {
    slug: 'github',
    url: 'https://api.githubcopilot.com/mcp/',
    transport: 'streamable-http',
    expected_auth: true,
    source: 'github.com/github/github-mcp-server (remote)',
  },
  {
    slug: 'notion',
    url: 'https://mcp.notion.com/mcp',
    transport: 'streamable-http',
    expected_auth: true,
    source: 'developers.notion.com/docs/mcp',
  },
  {
    slug: 'asana',
    url: 'https://mcp.asana.com/sse',
    transport: 'sse',
    expected_auth: true,
    source: 'developers.asana.com MCP docs',
  },
  {
    slug: 'paypal',
    url: 'https://mcp.paypal.com/mcp',
    transport: 'streamable-http',
    expected_auth: true,
    source: 'developer.paypal.com MCP docs',
  },
  {
    slug: 'intercom',
    url: 'https://mcp.intercom.com/mcp',
    transport: 'streamable-http',
    expected_auth: true,
    source: 'developers.intercom.com MCP docs',
  },
  {
    slug: 'webflow',
    url: 'https://mcp.webflow.com/sse',
    transport: 'sse',
    expected_auth: true,
    source: 'developers.webflow.com/data/docs/ai-tools',
  },
  {
    slug: 'neon',
    url: 'https://mcp.neon.tech/sse',
    transport: 'sse',
    expected_auth: true,
    source: 'neon.tech/docs/ai/neon-mcp-server',
  },
  {
    slug: 'vercel',
    url: 'https://mcp.vercel.com',
    transport: 'streamable-http',
    expected_auth: true,
    source: 'vercel.com/docs/mcp',
  },
  {
    slug: 'semgrep',
    url: 'https://mcp.semgrep.ai/mcp',
    transport: 'streamable-http',
    expected_auth: true,
    source: 'semgrep.dev MCP (mcp.semgrep.ai)',
  },
  {
    slug: 'airtable',
    url: 'https://mcp.airtable.com/mcp',
    transport: 'streamable-http',
    expected_auth: true,
    source: 'official MCP registry (com.airtable/mcp)',
  },
  {
    slug: 'apify',
    url: 'https://mcp.apify.com/',
    transport: 'streamable-http',
    expected_auth: true,
    source: 'docs.apify.com/platform/integrations/mcp',
  },
  {
    slug: 'jira',
    url: 'https://mcp.atlassian.com/v1/mcp',
    transport: 'streamable-http',
    expected_auth: true,
    source: 'support.atlassian.com Rovo MCP (com.atlassian/atlassian-mcp-server)',
  },
  {
    slug: 'cloudflare',
    url: 'https://docs.mcp.cloudflare.com/mcp',
    transport: 'streamable-http',
    expected_auth: false,
    source: 'developers.cloudflare.com/agents/model-context-protocol (docs server)',
  },
  {
    slug: 'figma',
    url: 'https://mcp.figma.com/mcp',
    transport: 'streamable-http',
    expected_auth: true,
    source: 'official MCP registry (com.figma.mcp/mcp)',
  },
  {
    slug: 'make',
    url: 'https://mcp.make.com',
    transport: 'streamable-http',
    expected_auth: true,
    source: 'developers.make.com MCP (com.make/mcp-server)',
  },
  {
    slug: 'monday',
    url: 'https://mcp.monday.com/mcp',
    transport: 'streamable-http',
    expected_auth: true,
    source: 'developer.monday.com MCP (com.monday/monday.com)',
  },
  {
    slug: 'supabase',
    url: 'https://mcp.supabase.com/mcp',
    transport: 'streamable-http',
    expected_auth: true,
    source: 'supabase.com/docs/guides/getting-started/mcp',
  },
  {
    slug: 'exa',
    url: 'https://mcp.exa.ai/mcp',
    transport: 'streamable-http',
    expected_auth: false,
    source: 'docs.exa.ai MCP (ai.exa/exa)',
  },
  {
    slug: 'canva',
    url: 'https://mcp.canva.com/mcp',
    transport: 'streamable-http',
    expected_auth: true,
    source: 'canva.dev/docs/mcp',
  },
  {
    slug: 'square',
    url: 'https://mcp.squareup.com/sse',
    transport: 'sse',
    expected_auth: true,
    source: 'developer.squareup.com/docs/mcp',
  },
  {
    slug: 'dropbox',
    url: 'https://mcp.dropbox.com/mcp',
    transport: 'streamable-http',
    expected_auth: true,
    source: 'help.dropbox.com/integrations/connect-dropbox-mcp-server',
  },
];

export const remoteEndpointBySlug: Map<string, RemoteEndpoint> = new Map(
  remoteEndpoints.map((e) => [e.slug, e]),
);
