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
      {/* Hero */}
      <section className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
              Find the right MCP server
            </h1>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-8">
              Browse {servers.length}+ Model Context Protocol servers for Claude, Cursor, VS Code, and more. The open directory for AI tool integrations.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/category"
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all text-sm"
              >
                Browse All Servers
              </Link>
              <Link
                href="/submit"
                className="px-6 py-3 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-all text-sm"
              >
                Submit Your Server
              </Link>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-14 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{servers.length}+</div>
              <div className="text-xs text-gray-500 mt-1">MCP Servers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{categoriesWithCounts.length}</div>
              <div className="text-xs text-gray-500 mt-1">Categories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{integrationsWithCounts.length}</div>
              <div className="text-xs text-gray-500 mt-1">Integrations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{getOfficialServers().length}</div>
              <div className="text-xs text-gray-500 mt-1">Official</div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Servers */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Featured Servers</h2>
          <Link href="/category" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {featuredServers.map(server => (
            <ServerCard key={server.slug} server={server} />
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Browse by Category</h2>
          <Link href="/category" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {categoriesWithCounts.slice(0, 8).map(category => (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              className="group bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-all border border-transparent hover:border-gray-200"
            >
              <div className="flex items-center space-x-3 mb-1">
                <span className="text-xl">{category.emoji}</span>
                <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors text-sm">
                  {category.name}
                </h3>
              </div>
              <p className="text-xs text-gray-400 ml-8">{category.count} servers</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Integrations */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Integrations</h2>
          <Link href="/integration" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {integrationsWithCounts.map(integration => (
            <Link
              key={integration.slug}
              href={`/integration/${integration.slug}`}
              className="group bg-gray-50 rounded-lg p-4 text-center hover:bg-gray-100 transition-all border border-transparent hover:border-gray-200"
            >
              <span className="text-2xl block mb-2">{integration.icon}</span>
              <h3 className="font-medium text-gray-900 text-xs group-hover:text-blue-600 transition-colors">
                {integration.name}
              </h3>
              <p className="text-xs text-gray-400 mt-1">{integration.count}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Official Servers */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Official Servers</h2>
          <Link href="/category" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {officialServers.map(server => (
            <ServerCard key={server.slug} server={server} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="bg-gray-50 rounded-2xl p-8 md:p-12 text-center border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Built an MCP Server?
          </h2>
          <p className="text-gray-500 mb-6 max-w-xl mx-auto text-sm">
            Get your MCP server listed in the directory and reach thousands of developers
            looking for tools to supercharge their AI workflows.
          </p>
          <Link
            href="/submit"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all text-sm"
          >
            Submit Your Server →
          </Link>
        </div>
      </section>
    </div>
  );
}
