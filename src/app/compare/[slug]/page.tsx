import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { generateComparisons, categories, integrations } from "@/data/servers";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const comparisons = generateComparisons();
  return comparisons.map((comp) => ({
    slug: comp.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const comparisons = generateComparisons();
  const comparison = comparisons.find(c => c.slug === slug);
  
  if (!comparison) {
    return { title: "Comparison Not Found | MyMCPTools" };
  }

  return {
    title: `${comparison.serverA.name} vs ${comparison.serverB.name} — MCP Server Comparison | MyMCPTools`,
    description: `Compare ${comparison.serverA.name} and ${comparison.serverB.name} MCP servers. See features, categories, and integrations side by side.`,
    openGraph: {
      title: `${comparison.serverA.name} vs ${comparison.serverB.name} | MyMCPTools`,
      description: `Compare these two MCP servers side by side.`,
    },
  };
}

export default async function ComparisonPage({ params }: Props) {
  const { slug } = await params;
  const comparisons = generateComparisons();
  const comparison = comparisons.find(c => c.slug === slug);

  if (!comparison) {
    notFound();
  }

  const { serverA, serverB } = comparison;

  const getCategoryEmoji = (catSlug: string) => {
    const cat = categories.find(c => c.slug === catSlug);
    return cat?.emoji || "📦";
  };

  const getIntegrationIcon = (intSlug: string) => {
    const int = integrations.find(i => i.slug === intSlug);
    return int?.icon || "🔌";
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://mymcptools.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Compare",
        item: "https://mymcptools.com/compare",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `${serverA.name} vs ${serverB.name}`,
        item: `https://mymcptools.com/compare/${slug}`,
      },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        "name": `What is the difference between ${serverA.name} and ${serverB.name}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `${serverA.name} and ${serverB.name} are both MCP servers but differ in their categories and capabilities. ${serverA.name} (${serverA.categories.join(', ')}) is ${serverA.description} while ${serverB.name} (${serverB.categories.join(', ')}) is ${serverB.description}`,
        },
      },
      {
        "@type": "Question",
        "name": `Which MCP server should I choose: ${serverA.name} or ${serverB.name}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Choose ${serverA.name} if you need ${serverA.categories[0]} capabilities and prefer ${serverA.install_type} installation. Choose ${serverB.name} if you need ${serverB.categories[0]} capabilities and prefer ${serverB.install_type} installation. Consider your specific use case and integration requirements.`,
        },
      },
      {
        "@type": "Question",
        "name": `Can I use both ${serverA.name} and ${serverB.name} together?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Yes, you can use multiple MCP servers together in Claude Desktop, Cursor, VS Code, and other MCP-compatible clients. ${serverA.name} and ${serverB.name} can complement each other if their capabilities don't overlap.`,
        },
      },
    ],
  };

  const softwareAJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": serverA.name,
    "description": serverA.description,
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "Any",
    "author": {
      "@type": "Organization",
      "name": serverA.author
    },
    "url": serverA.website_url || serverA.github_url,
    "downloadUrl": serverA.github_url,
  };

  const softwareBJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": serverB.name,
    "description": serverB.description,
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "Any",
    "author": {
      "@type": "Organization",
      "name": serverB.author
    },
    "url": serverB.website_url || serverB.github_url,
    "downloadUrl": serverB.github_url,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareBJsonLd) }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="mb-8">
        <ol className="flex items-center space-x-2 text-sm text-gray-500">
          <li><Link href="/" className="hover:text-white transition">Home</Link></li>
          <li>/</li>
          <li><Link href="/compare" className="hover:text-white transition">Compare</Link></li>
          <li>/</li>
          <li className="text-white">{serverA.name} vs {serverB.name}</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-white mb-4">
          {serverA.name} <span className="text-gray-600">vs</span> {serverB.name}
        </h1>
        <p className="text-gray-400">
          Compare these two MCP servers to find which one fits your needs best.
        </p>
      </div>

      {/* Comparison Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-3 border-b border-gray-800">
          <div className="p-4 bg-gray-800/50"></div>
          <div className="p-6 text-center border-l border-gray-800">
            <Link href={`/servers/${serverA.slug}`} className="text-xl font-semibold text-white hover:text-blue-400 transition">
              {serverA.name}
            </Link>
            <p className="text-sm text-gray-500 mt-1">by {serverA.author}</p>
            {serverA.official && (
              <span className="inline-block mt-2 px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-full">
                ✓ Official
              </span>
            )}
          </div>
          <div className="p-6 text-center border-l border-gray-800">
            <Link href={`/servers/${serverB.slug}`} className="text-xl font-semibold text-white hover:text-blue-400 transition">
              {serverB.name}
            </Link>
            <p className="text-sm text-gray-500 mt-1">by {serverB.author}</p>
            {serverB.official && (
              <span className="inline-block mt-2 px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-full">
                ✓ Official
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="grid grid-cols-3 border-b border-gray-800">
          <div className="p-4 bg-gray-800/50 text-sm font-medium text-gray-400">Description</div>
          <div className="p-4 text-sm text-gray-400 border-l border-gray-800">{serverA.description}</div>
          <div className="p-4 text-sm text-gray-400 border-l border-gray-800">{serverB.description}</div>
        </div>

        {/* Install Type */}
        <div className="grid grid-cols-3 border-b border-gray-800">
          <div className="p-4 bg-gray-800/50 text-sm font-medium text-gray-400">Install Type</div>
          <div className="p-4 text-sm text-gray-300 border-l border-gray-800 capitalize">{serverA.install_type}</div>
          <div className="p-4 text-sm text-gray-300 border-l border-gray-800 capitalize">{serverB.install_type}</div>
        </div>

        {/* Categories */}
        <div className="grid grid-cols-3 border-b border-gray-800">
          <div className="p-4 bg-gray-800/50 text-sm font-medium text-gray-400">Categories</div>
          <div className="p-4 border-l border-gray-800">
            <div className="flex flex-wrap gap-2">
              {serverA.categories.map(cat => (
                <span key={cat} className="inline-flex items-center text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                  {getCategoryEmoji(cat)} {cat}
                </span>
              ))}
            </div>
          </div>
          <div className="p-4 border-l border-gray-800">
            <div className="flex flex-wrap gap-2">
              {serverB.categories.map(cat => (
                <span key={cat} className="inline-flex items-center text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                  {getCategoryEmoji(cat)} {cat}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Integrations */}
        <div className="grid grid-cols-3 border-b border-gray-800">
          <div className="p-4 bg-gray-800/50 text-sm font-medium text-gray-400">Integrations</div>
          <div className="p-4 border-l border-gray-800">
            <div className="flex flex-wrap gap-2">
              {serverA.integrations.map(int => (
                <span key={int} className="inline-flex items-center text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                  {getIntegrationIcon(int)} {int}
                </span>
              ))}
            </div>
          </div>
          <div className="p-4 border-l border-gray-800">
            <div className="flex flex-wrap gap-2">
              {serverB.integrations.map(int => (
                <span key={int} className="inline-flex items-center text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                  {getIntegrationIcon(int)} {int}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="grid grid-cols-3">
          <div className="p-4 bg-gray-800/50 text-sm font-medium text-gray-400">Links</div>
          <div className="p-4 border-l border-gray-800">
            <a href={serverA.github_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm transition">
              View on GitHub →
            </a>
          </div>
          <div className="p-4 border-l border-gray-800">
            <a href={serverB.github_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm transition">
              View on GitHub →
            </a>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mt-12 bg-gray-900 border border-gray-800 rounded-xl p-8">
        <h2 className="text-2xl font-semibold text-white mb-6">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <details className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden group" open>
            <summary className="px-6 py-4 cursor-pointer text-white font-medium hover:bg-gray-700/50 transition">
              What is the difference between {serverA.name} and {serverB.name}?
            </summary>
            <div className="px-6 pb-4 text-gray-400">
              {serverA.name} and {serverB.name} are both MCP servers but differ in their categories and capabilities.{' '}
              {serverA.name} ({serverA.categories.join(', ')}) is {serverA.description} while {serverB.name} ({serverB.categories.join(', ')}) is {serverB.description}.
            </div>
          </details>
          <details className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden group">
            <summary className="px-6 py-4 cursor-pointer text-white font-medium hover:bg-gray-700/50 transition">
              Which MCP server should I choose: {serverA.name} or {serverB.name}?
            </summary>
            <div className="px-6 pb-4 text-gray-400">
              Choose {serverA.name} if you need {serverA.categories[0]} capabilities and prefer {serverA.install_type} installation.
              Choose {serverB.name} if you need {serverB.categories[0]} capabilities and prefer {serverB.install_type} installation.
              Consider your specific use case and integration requirements.
            </div>
          </details>
          <details className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden group">
            <summary className="px-6 py-4 cursor-pointer text-white font-medium hover:bg-gray-700/50 transition">
              Can I use both {serverA.name} and {serverB.name} together?
            </summary>
            <div className="px-6 pb-4 text-gray-400">
              Yes, you can use multiple MCP servers together in Claude Desktop, Cursor, VS Code, and other MCP-compatible clients.
              {serverA.name} and {serverB.name} can complement each other if their capabilities don&apos;t overlap.
            </div>
          </details>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-12 text-center">
        <Link
          href="/compare"
          className="text-blue-400 hover:text-blue-300 transition"
        >
          ← Compare other servers
        </Link>
      </div>
    </div>
    </>
  );
}
