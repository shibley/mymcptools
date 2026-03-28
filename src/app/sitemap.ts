import { MetadataRoute } from 'next';
import { servers, categories, integrations, generateComparisons } from '@/data/servers';

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

  return [
    ...staticPages,
    ...serverPages,
    ...pricingPages,
    ...alternativesPages,
    ...categoryPages,
    ...integrationPages,
    ...comparisonPages,
  ];
}
