import { Metadata } from "next";
import Link from "next/link";
import { ServerCard } from "@/components/ServerCard";
import { searchServers } from "@/data/servers";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `Search results for "${q}" | MyMCPTools` : "Search MCP Servers | MyMCPTools",
    description: "Search the comprehensive directory of MCP servers. Find tools for databases, APIs, browser automation, and more.",
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q || "";
  const results = query ? searchServers(query) : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-white mb-4">Search Results</h1>
        {query ? (
          <p className="text-gray-400">
            {results.length} results for &quot;{query}&quot;
          </p>
        ) : (
          <p className="text-gray-400">
            Enter a search term to find MCP servers.
          </p>
        )}
      </div>

      {/* Results */}
      {results.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map(server => (
            <ServerCard key={server.slug} server={server} />
          ))}
        </div>
      ) : query ? (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-4">No servers found matching your search.</p>
          <Link href="/category" className="text-blue-400 hover:text-blue-300 transition">
            Browse all categories →
          </Link>
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-4">Try searching for &quot;database&quot;, &quot;github&quot;, or &quot;browser&quot;</p>
          <Link href="/category" className="text-blue-400 hover:text-blue-300 transition">
            Or browse all categories →
          </Link>
        </div>
      )}
    </div>
  );
}
