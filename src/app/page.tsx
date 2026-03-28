import Link from "next/link";
import { ServerCard } from "@/components/ServerCard";
import { servers, getCategoriesWithCounts, getIntegrationsWithCounts, getFeaturedServers, getOfficialServers } from "@/data/servers";

export default function Home() {
  const categoriesWithCounts = getCategoriesWithCounts();
  const integrationsWithCounts = getIntegrationsWithCounts();
  const featuredServers = getFeaturedServers().slice(0, 8);
  const officialServers = getOfficialServers().slice(0, 8);
  
  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 relative">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Discover{" "}
              <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                MCP Servers
              </span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
              The most comprehensive directory of Model Context Protocol servers.
              Find, compare, and integrate {servers.length}+ tools for Claude, Cursor, VS Code, and more.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/category"
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
              >
                Browse All Servers
              </Link>
              <Link
                href="/submit"
                className="px-8 py-3 bg-gray-800 text-white font-medium rounded-lg border border-gray-700 hover:bg-gray-700 transition-all"
              >
                Submit Your Server
              </Link>
            </div>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{servers.length}+</div>
              <div className="text-sm text-gray-400">MCP Servers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{categoriesWithCounts.length}</div>
              <div className="text-sm text-gray-400">Categories</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{integrationsWithCounts.length}</div>
              <div className="text-sm text-gray-400">Integrations</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{getOfficialServers().length}</div>
              <div className="text-sm text-gray-400">Official Servers</div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Servers */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white">⭐ Featured Servers</h2>
          <Link href="/category" className="text-purple-400 hover:text-purple-300 text-sm">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredServers.map(server => (
            <ServerCard key={server.slug} server={server} />
          ))}
        </div>
      </section>

      {/* Categories Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white">📂 Browse by Category</h2>
          <Link href="/category" className="text-purple-400 hover:text-purple-300 text-sm">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
          {categoriesWithCounts.slice(0, 8).map(category => (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              className="group bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-purple-500/50 hover:bg-gray-800/50 transition-all"
            >
              <div className="flex items-center space-x-3 mb-2">
                <span className="text-2xl">{category.emoji}</span>
                <h3 className="font-semibold text-white group-hover:text-purple-400 transition-colors">
                  {category.name}
                </h3>
              </div>
              <p className="text-sm text-gray-500">{category.count} servers</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Integrations */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white">🔌 Integrations</h2>
          <Link href="/integration" className="text-purple-400 hover:text-purple-300 text-sm">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {integrationsWithCounts.map(integration => (
            <Link
              key={integration.slug}
              href={`/integration/${integration.slug}`}
              className="group bg-gray-900 border border-gray-800 rounded-xl p-4 text-center hover:border-purple-500/50 hover:bg-gray-800/50 transition-all"
            >
              <span className="text-3xl block mb-2">{integration.icon}</span>
              <h3 className="font-medium text-white text-sm group-hover:text-purple-400 transition-colors">
                {integration.name}
              </h3>
              <p className="text-xs text-gray-500 mt-1">{integration.count} servers</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Official Servers */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white">✓ Official Servers</h2>
          <Link href="/category" className="text-purple-400 hover:text-purple-300 text-sm">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {officialServers.map(server => (
            <ServerCard key={server.slug} server={server} />
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-2xl p-8 md:p-12 text-center border border-purple-500/20">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Built an MCP Server?
          </h2>
          <p className="text-gray-300 mb-8 max-w-xl mx-auto">
            Get your MCP server listed in the directory and reach thousands of developers
            looking for tools to supercharge their AI workflows.
          </p>
          <Link
            href="/submit"
            className="inline-flex items-center px-8 py-3 bg-white text-gray-900 font-medium rounded-lg hover:bg-gray-100 transition-all"
          >
            Submit Your Server
            <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}
