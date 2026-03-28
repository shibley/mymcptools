import { Metadata } from "next";
import Link from "next/link";
import { generateComparisons, getFeaturedServers } from "@/data/servers";

export const metadata: Metadata = {
  title: "Compare MCP Servers — Side by Side Comparison | MyMCPTools",
  description: "Compare MCP servers side by side. Find the best Model Context Protocol server for your needs by comparing features, categories, and integrations.",
};

export default function ComparePage() {
  const comparisons = generateComparisons();
  const featured = getFeaturedServers();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Compare MCP Servers</h1>
        <p className="text-gray-400 max-w-2xl">
          Compare MCP servers side by side to find the best tool for your AI workflow.
          Select two servers to see detailed feature comparisons.
        </p>
      </div>

      {/* Popular Comparisons */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Popular Comparisons</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {comparisons.slice(0, 12).map(comp => (
            <Link
              key={comp.slug}
              href={`/compare/${comp.slug}`}
              className="group bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-900 font-medium group-hover:text-blue-600 transition-colors">
                  {comp.serverA.name}
                </span>
                <span className="text-gray-400 text-sm">vs</span>
                <span className="text-gray-900 font-medium group-hover:text-blue-600 transition-colors">
                  {comp.serverB.name}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* All Servers for Custom Comparison */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Featured Servers</h2>
        <p className="text-gray-400 mb-6">
          Click on any server to view its details and find comparison options.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {featured.map(server => (
            <Link
              key={server.slug}
              href={`/servers/${server.slug}`}
              className="bg-white border border-gray-200 rounded-lg p-4 text-center hover:border-blue-300 transition-all"
            >
              <span className="text-gray-900 text-sm font-medium">{server.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
