import { Metadata } from "next";
import Link from "next/link";
import { getAllBlogPosts } from "@/data/blog";

export const metadata: Metadata = {
  title: "MCP Blog — Guides, Tutorials & News | MyMCPTools",
  description:
    "Learn about Model Context Protocol with in-depth guides, tutorials, and server recommendations. Best MCP servers for developers, data engineers, DevOps, and more.",
  keywords:
    "mcp blog, mcp guides, mcp tutorials, model context protocol, best mcp servers, mcp news",
};

export default function BlogPage() {
  const posts = getAllBlogPosts();
  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-white mb-4">
          MCP Blog
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Guides, tutorials, and deep dives into the Model Context Protocol
          ecosystem. Learn how to build better AI workflows with MCP servers.
        </p>
      </div>

      {/* Featured Post */}
      {featured && (
        <Link
          href={`/blog/${featured.slug}`}
          className="block bg-gray-900 border border-gray-800 rounded-xl p-8 mb-10 hover:border-blue-500/40 transition group"
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-full border border-blue-500/20">
              {featured.category}
            </span>
            <span className="text-gray-600 text-sm">
              {featured.readingTime}
            </span>
            <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-xs font-medium rounded-full border border-yellow-500/20">
              Featured
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-blue-400 transition">
            {featured.title}
          </h2>
          <p className="text-gray-400 mb-4 line-clamp-3">
            {featured.description}
          </p>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{featured.author}</span>
            <span>·</span>
            <time dateTime={featured.date}>
              {new Date(featured.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </div>
        </Link>
      )}

      {/* Posts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rest.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition group flex flex-col"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-full border border-blue-500/20">
                {post.category}
              </span>
              <span className="text-gray-600 text-sm">
                {post.readingTime}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition line-clamp-2">
              {post.title}
            </h2>
            <p className="text-gray-400 text-sm mb-4 line-clamp-3 flex-1">
              {post.description}
            </p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>{post.author}</span>
              <span>·</span>
              <time dateTime={post.date}>
                {new Date(post.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </div>
          </Link>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-16 text-center bg-gray-900 border border-gray-800 rounded-xl p-10">
        <h2 className="text-xl font-bold text-white mb-3">
          Discover 270+ MCP Servers
        </h2>
        <p className="text-gray-400 mb-6 max-w-md mx-auto">
          Browse the most comprehensive directory of Model Context Protocol
          servers. Filter by category, integration, and use case.
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
        >
          Browse MCP Servers →
        </Link>
      </div>
    </div>
  );
}
