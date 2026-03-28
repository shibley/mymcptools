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

  return (
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
  );
}
