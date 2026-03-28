import { Metadata } from "next";
import Link from "next/link";
import { getCategoriesWithCounts } from "@/data/servers";

export const metadata: Metadata = {
  title: "MCP Server Categories — Browse by Type | MyMCPTools",
  description: "Browse MCP servers by category. Find database, API, browser automation, AI/ML, DevOps, and more types of Model Context Protocol servers.",
};

export default function CategoriesPage() {
  const categories = getCategoriesWithCounts();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-white mb-4">Browse by Category</h1>
        <p className="text-gray-400 max-w-2xl">
          Find MCP servers organized by what they do. From database integrations to browser automation,
          discover the right tools for your AI workflow.
        </p>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map(category => (
          <Link
            key={category.slug}
            href={`/category/${category.slug}`}
            className="group bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-purple-500/50 hover:bg-gray-800/50 transition-all"
          >
            <div className="flex items-center space-x-4 mb-4">
              <span className="text-4xl">{category.emoji}</span>
              <div>
                <h2 className="text-xl font-semibold text-white group-hover:text-purple-400 transition-colors">
                  {category.name}
                </h2>
                <p className="text-sm text-gray-500">{category.count} servers</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm">{category.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
