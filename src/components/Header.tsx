"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              MyMCP
            </span>
            <span className="text-gray-400 text-sm font-medium">Tools</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/category" className="text-gray-400 hover:text-white transition text-sm">
              Categories
            </Link>
            <Link href="/integration" className="text-gray-400 hover:text-white transition text-sm">
              Integrations
            </Link>
            <Link href="/compare" className="text-gray-400 hover:text-white transition text-sm">
              Compare
            </Link>
            <Link href="/pricing" className="text-gray-400 hover:text-white transition text-sm">
              Pricing
            </Link>
            <Link href="/blog" className="text-gray-400 hover:text-white transition text-sm">
              Blog
            </Link>
          </nav>

          <form onSubmit={handleSearch} className="hidden lg:flex items-center">
            <div className="relative">
              <input
                type="text"
                placeholder="Search MCP servers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 px-4 py-2 pl-10 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
              />
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </form>

          <Link
            href="/submit"
            className="hidden md:inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
          >
            Submit Server
          </Link>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white transition"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-800 py-4 space-y-3">
            <form onSubmit={handleSearch} className="mb-4">
              <input
                type="text"
                placeholder="Search MCP servers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </form>
            <nav className="flex flex-col space-y-3">
              <Link href="/category" className="text-gray-400 hover:text-white transition py-2" onClick={() => setMobileMenuOpen(false)}>Categories</Link>
              <Link href="/integration" className="text-gray-400 hover:text-white transition py-2" onClick={() => setMobileMenuOpen(false)}>Integrations</Link>
              <Link href="/compare" className="text-gray-400 hover:text-white transition py-2" onClick={() => setMobileMenuOpen(false)}>Compare</Link>
              <Link href="/pricing" className="text-gray-400 hover:text-white transition py-2" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
              <Link href="/blog" className="text-gray-400 hover:text-white transition py-2" onClick={() => setMobileMenuOpen(false)}>Blog</Link>
              <Link href="/submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition text-center" onClick={() => setMobileMenuOpen(false)}>Submit Server</Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
