import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Submit Your MCP Server | MyMCPTools",
  description: "Get your MCP server listed in the MyMCPTools directory. Reach thousands of developers looking for AI tools and integrations.",
};

export default function SubmitPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-white mb-4">Submit Your MCP Server</h1>
        <p className="text-gray-400">
          Get your server listed in the directory and reach thousands of developers.
        </p>
      </div>

      {/* Submission Form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
        <form className="space-y-6">
          {/* Server Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
              Server Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              placeholder="e.g., My Awesome MCP Server"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={3}
              placeholder="What does your server do? Keep it concise but informative."
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* GitHub URL */}
          <div>
            <label htmlFor="github" className="block text-sm font-medium text-gray-300 mb-2">
              GitHub Repository URL *
            </label>
            <input
              type="url"
              id="github"
              name="github"
              required
              placeholder="https://github.com/username/repo"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Website URL */}
          <div>
            <label htmlFor="website" className="block text-sm font-medium text-gray-300 mb-2">
              Website URL (optional)
            </label>
            <input
              type="url"
              id="website"
              name="website"
              placeholder="https://yourwebsite.com"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-2">
              Primary Category *
            </label>
            <select
              id="category"
              name="category"
              required
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500 transition"
            >
              <option value="">Select a category</option>
              <option value="filesystem">📁 Filesystem</option>
              <option value="database">🗄️ Database</option>
              <option value="api">🌐 API & Web</option>
              <option value="search">🔍 Search</option>
              <option value="coding">💻 Coding & Dev</option>
              <option value="browser">🌍 Browser</option>
              <option value="cloud">☁️ Cloud</option>
              <option value="devops">🔧 DevOps & CI/CD</option>
              <option value="ai">🤖 AI & ML</option>
              <option value="communication">💬 Communication</option>
              <option value="productivity">📋 Productivity</option>
              <option value="finance">💰 Finance</option>
              <option value="security">🔒 Security</option>
              <option value="analytics">📊 Analytics</option>
              <option value="media">🎬 Media</option>
              <option value="memory">🧠 Memory & Knowledge</option>
            </select>
          </div>

          {/* Install Type */}
          <div>
            <label htmlFor="install" className="block text-sm font-medium text-gray-300 mb-2">
              Install Type *
            </label>
            <select
              id="install"
              name="install"
              required
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500 transition"
            >
              <option value="">Select install type</option>
              <option value="npm">npm / npx</option>
              <option value="pip">pip (Python)</option>
              <option value="binary">Binary</option>
              <option value="docker">Docker</option>
              <option value="source">Source</option>
            </select>
          </div>

          {/* Your Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
              Your Email *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              placeholder="you@example.com"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
            />
            <p className="mt-1 text-xs text-gray-500">We&apos;ll notify you when your server is listed.</p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
          >
            Submit Server
          </button>
        </form>
      </div>

      {/* Guidelines */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold text-white mb-4">Submission Guidelines</h2>
        <ul className="space-y-3 text-gray-400">
          <li className="flex items-start">
            <span className="text-green-400 mr-2">✓</span>
            Server must implement the Model Context Protocol
          </li>
          <li className="flex items-start">
            <span className="text-green-400 mr-2">✓</span>
            Public GitHub repository with documentation
          </li>
          <li className="flex items-start">
            <span className="text-green-400 mr-2">✓</span>
            Clear installation instructions
          </li>
          <li className="flex items-start">
            <span className="text-green-400 mr-2">✓</span>
            Working and actively maintained
          </li>
        </ul>
      </div>

      {/* Back Link */}
      <div className="mt-8 text-center">
        <Link href="/" className="text-blue-400 hover:text-blue-300 transition">
          ← Back to directory
        </Link>
      </div>
    </div>
  );
}
