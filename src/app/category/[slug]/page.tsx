import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ServerCard } from "@/components/ServerCard";
import { AffiliateServerCTA } from "@/components/AffiliateServerCTA";
import { categories, getServersByCategory } from "@/data/servers";
import { getStatus } from "@/lib/trust/status-store";
import type { Verdict } from "@/lib/trust/types";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ filter?: string; sort?: string }>;
}

// Health ranking used by ?sort=uptime — true uptime % isn't tracked yet, so we
// order by latest verdict health (best first) as the closest honest proxy.
const HEALTH_RANK: Record<Verdict, number> = {
  GOOD: 0,
  WARN: 1,
  AUTH_REQUIRED: 2,
  DOWN: 3,
  UNPROBEABLE: 4,
};

export async function generateStaticParams() {
  return categories.map((category) => ({
    slug: category.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = categories.find(c => c.slug === slug);
  
  if (!category) {
    return { title: "Category Not Found | MyMCPTools" };
  }

  return {
    title: `${category.name} MCP Servers — ${category.description} | MyMCPTools`,
    description: `Discover ${category.name.toLowerCase()} MCP servers for AI assistants. Browse tools for ${category.description.toLowerCase()}.`,
    openGraph: {
      title: `${category.name} MCP Servers | MyMCPTools`,
      description: `Discover ${category.name.toLowerCase()} MCP servers for AI assistants.`,
    },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { filter, sort } = await searchParams;
  const category = categories.find(c => c.slug === slug);

  if (!category) {
    notFound();
  }

  const allCategoryServers = getServersByCategory(slug);
  const healthyOnly = filter === "healthy";
  const sortByUptime = sort === "uptime";

  let categoryServers = allCategoryServers;
  if (healthyOnly) {
    categoryServers = categoryServers.filter(
      (s) => getStatus(s.slug)?.verdict === "GOOD"
    );
  }
  if (sortByUptime) {
    categoryServers = [...categoryServers].sort((a, b) => {
      const ra = HEALTH_RANK[getStatus(a.slug)?.verdict ?? "UNPROBEABLE"];
      const rb = HEALTH_RANK[getStatus(b.slug)?.verdict ?? "UNPROBEABLE"];
      return ra - rb;
    });
  }

  const buildHref = (next: { filter?: boolean; sort?: boolean }) => {
    const sp = new URLSearchParams();
    const nextHealthy = next.filter ?? healthyOnly;
    const nextSort = next.sort ?? sortByUptime;
    if (nextHealthy) sp.set("filter", "healthy");
    if (nextSort) sp.set("sort", "uptime");
    const qs = sp.toString();
    return qs ? `/category/${slug}?${qs}` : `/category/${slug}`;
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": `${category.name} MCP Servers`,
    "description": `Discover ${category.name.toLowerCase()} MCP servers. ${category.description}.`,
    "url": `https://mymcptools.com/category/${slug}`,
    "numberOfItems": allCategoryServers.length,
    "hasPart": allCategoryServers.slice(0, 10).map(server => ({
      "@type": "SoftwareApplication",
      "name": server.name,
      "description": server.description,
      "url": `https://mymcptools.com/servers/${server.slug}`,
    })),
  };

  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="mb-8">
        <ol className="flex items-center space-x-2 text-sm text-gray-500">
          <li><Link href="/" className="hover:text-white transition">Home</Link></li>
          <li>/</li>
          <li><Link href="/category" className="hover:text-white transition">Categories</Link></li>
          <li>/</li>
          <li className="text-white">{category.name}</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center space-x-4 mb-4">
          <span className="text-5xl">{category.emoji}</span>
          <div>
            <h1 className="text-3xl font-bold text-white">{category.name} MCP Servers</h1>
            <p className="text-gray-500">
              {healthyOnly
                ? `${categoryServers.length} of ${allCategoryServers.length} healthy`
                : `${allCategoryServers.length} servers available`}
            </p>
          </div>
        </div>
        <p className="text-gray-400 max-w-2xl mt-4">{category.description}</p>
      </div>

      {/* Filter / Sort controls (SSR via URL search params) */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <Link
          href={buildHref({ filter: !healthyOnly })}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition ${
            healthyOnly
              ? "bg-green-500/10 border-green-500/40 text-green-300"
              : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" aria-hidden="true" />
          Healthy only
        </Link>
        <Link
          href={buildHref({ sort: !sortByUptime })}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition ${
            sortByUptime
              ? "bg-blue-500/10 border-blue-500/40 text-blue-300"
              : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700"
          }`}
        >
          Sort by uptime
        </Link>
        {(healthyOnly || sortByUptime) && (
          <Link
            href={`/category/${slug}`}
            className="text-sm text-gray-500 hover:text-gray-300 transition"
          >
            Clear
          </Link>
        )}
      </div>

      {/* Servers Grid */}
      {categoryServers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categoryServers.map(server => (
            <ServerCard key={server.slug} server={server} showCategory={false} />
          ))}
        </div>
      ) : (
        <p className="text-gray-500">
          {healthyOnly
            ? "No servers in this category are verified healthy right now."
            : "No servers found."}
        </p>
      )}

      {/* Affiliate CTA */}
      {categoryServers.length > 0 && (
        <div className="mt-12 max-w-sm">
          <AffiliateServerCTA serverCategories={[slug]} />
        </div>
      )}

      {/* Other Categories */}
      <div className="mt-16">
        <h2 className="text-xl font-semibold text-white mb-6">Other Categories</h2>
        <div className="flex flex-wrap gap-3">
          {categories
            .filter(c => c.slug !== slug)
            .map(cat => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg hover:border-blue-500/50 transition"
              >
                <span>{cat.emoji}</span>
                <span className="text-gray-300">{cat.name}</span>
              </Link>
            ))}
        </div>
      </div>
    </div>
    </>
  );
}
