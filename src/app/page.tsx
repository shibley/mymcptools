import Link from "next/link";
import { ServerCard } from "@/components/ServerCard";
import { servers, getCategoriesWithCounts, getIntegrationsWithCounts, getFeaturedServers, getOfficialServers } from "@/data/servers";
import { getServerPricing, getPricingBadge } from "@/data/pricing";

export default function Home() {
  const categoriesWithCounts = getCategoriesWithCounts();
  const integrationsWithCounts = getIntegrationsWithCounts();
  const featuredServers = getFeaturedServers().slice(0, 8);
  const officialServers = getOfficialServers().slice(0, 8);
  
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.15),_transparent_55%),radial-gradient(circle_at_20%_20%,_rgba(168,85,247,0.12),_transparent_40%)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 relative">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-6">
              Find the{" "}
              <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Right MCP Server
              </span>{" "}
              for Any Task
            </h1>
            <p className="text-lg sm:text-xl text-gray-400 mb-6">
              Browse {servers.length}+ Model Context Protocol servers for Claude, Cursor, VS Code, and more. The open directory for AI tool integrations.
            </p>
            <div className="mb-6 text-sm sm:text-base text-gray-300 font-medium">
              {servers.length}+ MCP servers across {categoriesWithCounts.length} categories
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/category"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition text-sm"
              >
                Browse All Servers
              </Link>
              <Link
                href="/submit"
                className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition text-sm"
              >
                Submit Your Server
              </Link>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {["Database", "API & Web", "Browser", "AI & ML", "DevOps", "Coding"].map((tag) => (
                <Link
                  key={tag}
                  href={`/category/${tag.toLowerCase().replace(/ & /g, "-").replace(/ /g, "-")}`}
                  className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm hover:bg-gray-700 cursor-pointer transition"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-14 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{servers.length}+</div>
              <div className="text-xs text-gray-500 mt-1">MCP Servers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{categoriesWithCounts.length}</div>
              <div className="text-xs text-gray-500 mt-1">Categories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{integrationsWithCounts.length}</div>
              <div className="text-xs text-gray-500 mt-1">Integrations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{getOfficialServers().length}</div>
              <div className="text-xs text-gray-500 mt-1">Official</div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Servers */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-white">Featured Servers</h2>
            <p className="text-gray-400 mt-2">Hand-picked MCP servers for your AI workflows.</p>
          </div>
          <Link href="/category" className="text-blue-400 hover:text-blue-300 text-sm">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {featuredServers.map(server => (
            <ServerCard key={server.slug} server={server} />
          ))}
        </div>
      </section>

      {/* Newsletter */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-2xl border border-gray-800 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-950 p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Get new MCP servers in your inbox weekly</h2>
            <p className="text-gray-400 mt-2">
              One concise email with new servers, trending picks, and featured standouts.
            </p>
          </div>
          <form className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <input
              type="email"
              name="email"
              required
              placeholder="you@company.com"
              className="w-full sm:w-72 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 text-gray-100 placeholder-gray-500"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl text-sm font-semibold transition"
            >
              Subscribe
            </button>
          </form>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-white">📂 Browse by Category</h2>
          <Link href="/category" className="text-blue-400 hover:text-blue-300 text-sm">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {categoriesWithCounts.slice(0, 8).map(category => (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-500/50 transition group text-center"
            >
              <div className="mb-2 flex justify-center">
                <span className="text-2xl">{category.emoji}</span>
              </div>
              <h3 className="font-semibold text-white group-hover:text-blue-400 transition text-sm">
                {category.name}
              </h3>
              <p className="text-gray-500 text-xs mt-1">{category.count} servers</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Integrations */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-white">🔌 Integrations</h2>
          <Link href="/integration" className="text-blue-400 hover:text-blue-300 text-sm">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {integrationsWithCounts.map(integration => (
            <Link
              key={integration.slug}
              href={`/integration/${integration.slug}`}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center hover:border-blue-500/50 transition group"
            >
              <span className="text-2xl block mb-2">{integration.icon}</span>
              <h3 className="font-medium text-white text-xs group-hover:text-blue-400 transition">
                {integration.name}
              </h3>
              <p className="text-xs text-gray-500 mt-1">{integration.count}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Official Servers */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-white">Official Servers</h2>
            <p className="text-gray-400 mt-2">Verified and maintained by the original authors.</p>
          </div>
          <Link href="/category" className="text-blue-400 hover:text-blue-300 text-sm">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {officialServers.map(server => (
            <ServerCard key={server.slug} server={server} />
          ))}
        </div>
      </section>

      {/* Popular Pricing */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white">💰 Popular Server Pricing</h2>
            <p className="text-gray-400 mt-2">Check pricing for the most popular MCP servers.</p>
          </div>
          <Link href="/pricing" className="text-blue-400 hover:text-blue-300 text-sm">
            View all pricing →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {featuredServers.slice(0, 8).map(server => {
            const pricing = getServerPricing(server.slug);
            const priceBadge = getPricingBadge(pricing.pricing_model);
            return (
              <Link
                key={server.slug}
                href={`/pricing/${server.slug}`}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-blue-500/50 transition group"
              >
                <h3 className="font-semibold text-white group-hover:text-blue-400 transition text-sm mb-1">{server.name}</h3>
                <span className={`inline-block ${priceBadge.bgColor} ${priceBadge.color} px-2 py-0.5 rounded-full text-xs font-medium`}>
                  {priceBadge.label}
                </span>
                <p className="text-gray-500 text-xs mt-2 line-clamp-2">{pricing.pricing_details.slice(0, 80)}…</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/20 rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Built an MCP Server?
          </h2>
          <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
            Get your MCP server listed in the directory and reach thousands of developers
            looking for tools to supercharge their AI workflows. Free to submit.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition"
            >
              Submit Your Server (Free)
            </Link>
            <Link
              href="/category"
              className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition"
            >
              Browse Directory
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
