import { MetadataRoute } from 'next';
import { servers, categories, integrations, generateComparisons } from '@/data/servers';
import { blogPosts } from '@/data/blog';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://mymcptools.com';
  const now = new Date();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/category`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/integration`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/compare`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/submit`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/developers`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/status`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/trust`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/firewall`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    // Hub / head-term landing pages. These shipped 2026-06-29 (marketplace, claude-mcp-servers)
    // and 2026-08-02 (gateway) but were never listed here, so they were orphaned from the
    // sitemap entirely — which is the likeliest reason none of them ever ranked.
    {
      url: `${baseUrl}/mcp-gateway`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/mcp-proxy`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/mcp-marketplace`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/mcp-registry`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/claude-mcp-servers`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    // Hub for the hand-written per-server setup guides. The guides themselves
    // live on /servers/[slug]; this is the only page that links to all of them.
    {
      url: `${baseUrl}/guides`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    // Category landing page for "database mcp server" — compares the five
    // database guides rather than repeating them.
    {
      url: `${baseUrl}/guides/databases`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    // Same shape for "devops mcp server" / "deployment mcp server" — the five
    // infrastructure guides compared on blast radius rather than tool count.
    {
      url: `${baseUrl}/guides/devops`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    // And for "browser mcp server" / "coding mcp server" — the six code-bucket
    // guides compared on what each server attaches to and what it inherits.
    {
      url: `${baseUrl}/guides/code`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    // And for "workspace mcp server" / "productivity mcp server" — the ten
    // docs-and-tickets guides compared on what the auth step actually grants
    // and why each one connects and then returns nothing.
    {
      url: `${baseUrl}/guides/workspace`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    // Definition page for the "mcp server means" / "what does mcp server mean"
    // family — 3,600 SV at SD 19, the highest-volume lowest-difficulty term the
    // keyword mining has turned up. Informational intent, so no /servers/[slug]
    // page can win it; it needs its own explainer URL.
    {
      url: `${baseUrl}/what-is-an-mcp-server`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/mcp-server`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];

  // Server pages
  const serverPages: MetadataRoute.Sitemap = servers.map((server) => ({
    url: `${baseUrl}/servers/${server.slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Pricing pages
  const pricingPages: MetadataRoute.Sitemap = servers.map((server) => ({
    url: `${baseUrl}/pricing/${server.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Alternatives pages
  const alternativesPages: MetadataRoute.Sitemap = servers.map((server) => ({
    url: `${baseUrl}/alternatives/${server.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Category pages
  const categoryPages: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${baseUrl}/category/${category.slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Integration pages
  const integrationPages: MetadataRoute.Sitemap = integrations.map((integration) => ({
    url: `${baseUrl}/integration/${integration.slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Comparison pages
  const comparisons = generateComparisons();
  const comparisonPages: MetadataRoute.Sitemap = comparisons.map((comparison) => ({
    url: `${baseUrl}/compare/${comparison.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Blog post pages
  const blogPages: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  return [
    ...staticPages,
    ...serverPages,
    ...pricingPages,
    ...alternativesPages,
    ...categoryPages,
    ...integrationPages,
    ...comparisonPages,
    ...blogPages,
  ];
}
