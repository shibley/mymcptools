"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

export default function SubmitPage() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = {
      toolName: (form.elements.namedItem("name") as HTMLInputElement).value,
      description: (form.elements.namedItem("description") as HTMLTextAreaElement).value,
      github: (form.elements.namedItem("github") as HTMLInputElement).value,
      website: (form.elements.namedItem("website") as HTMLInputElement).value,
      category: (form.elements.namedItem("category") as HTMLSelectElement).value,
      installType: (form.elements.namedItem("install") as HTMLSelectElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      // honeypot
      website_url: (form.elements.namedItem("website_url") as HTMLInputElement)?.value || "",
    };

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "Something went wrong. Please try again.");
        setStatus("error");
      } else {
        setStatus("success");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-gray-900 border border-green-800 rounded-xl p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-white mb-3">Submission Received!</h1>
          <p className="text-gray-400 mb-6">
            Thanks for submitting your MCP server. We&apos;ll review it within 24-48 hours and notify you by email.
          </p>
          <Link href="/" className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition">
            Back to Directory
          </Link>
        </div>
      </div>
    );
  }

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
        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Honeypot - hidden from real users */}
          <input type="text" name="website_url" style={{ display: "none" }} tabIndex={-1} autoComplete="off" />

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

          {/* Error message */}
          {status === "error" && (
            <div className="px-4 py-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
              {errorMsg}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg transition"
          >
            {status === "submitting" ? "Submitting…" : "Submit Server"}
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
