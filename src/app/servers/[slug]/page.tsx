import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { ServerCardCompact } from "@/components/ServerCard";
import { StatusBadge, LocalSignalBadge } from "@/components/StatusBadge";
import { UptimeSparkline } from "@/components/UptimeSparkline";
import { getStatus } from "@/lib/trust/status-store";
import { getStaticSignal } from "@/lib/trust/static-signals-store";
import { getHistory } from "@/lib/trust/history-store";
import { AffiliateServerCTA } from "@/components/AffiliateServerCTA";
import { servers, getServerBySlug, getRelatedServers, categories, integrations } from "@/data/servers";
import { getServerPricing, hasFreeOption } from "@/data/pricing";
import { getBlogPostsForServer } from "@/data/blog";

interface Props {
  params: Promise<{ slug: string }>;
}

function FreshnessBadge() {
  return (
    <span className="inline-flex items-center px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium rounded-full">
      Updated June 2026
    </span>
  );
}

function getFirstSentence(text: string) {
  return text.split(/(?<=\.)\s+/)[0]?.replace(/\.$/, "") || text;
}

export async function generateStaticParams() {
  return servers.map((server) => ({
    slug: server.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const server = getServerBySlug(slug);
  
  if (!server) {
    return { title: "Server Not Found | MyMCPTools" };
  }

  return {
    title: `${server.name} MCP Server — Setup, Features & Alternatives | MyMCPTools`,
    description: `${server.description} Learn how to install and configure the ${server.name} MCP server for Claude, Cursor, VS Code, and more.`,
    openGraph: {
      title: `${server.name} MCP Server | MyMCPTools`,
      description: server.description,
      type: "article",
    },
  };
}

export default async function ServerPage({ params }: Props) {
  const { slug } = await params;
  const server = getServerBySlug(slug);

  if (!server) {
    notFound();
  }

  const relatedServers = getRelatedServers(server, 5);
  const serverCategories = categories.filter(c => server.categories.includes(c.slug));
  const serverIntegrations = integrations.filter(i => server.integrations.includes(i.slug));
  const relatedBlogPosts = getBlogPostsForServer(server.slug);
  const pricing = getServerPricing(server.slug);
  const status = getStatus(server.slug);
  const isLocal = !status || status.verdict === "UNPROBEABLE";
  const staticSignal = isLocal ? getStaticSignal(server.slug) : undefined;
  const history = getHistory(server.slug);
  const hasUptimeHistory = history.some((p) => p.verdict !== "UNPROBEABLE");
  const primaryCategory = serverCategories[0]?.name || server.categories[0] || "MCP workflows";
  const capability = getFirstSentence(server.description);
  const installAnswer = server.install_command
    ? `Install ${server.name} with ${server.install_type}: ${server.install_command}`
    : `Install ${server.name} from its GitHub repository: ${server.github_url}`;
  const integrationsAnswer = serverIntegrations.length > 0
    ? `${server.name} integrates with ${serverIntegrations.map(i => i.name).join(", ")}.`
    : `${server.name} works with MCP-compatible clients such as Claude Desktop, Cursor, and VS Code.`;
  const faqItems = [
    {
      question: `What is ${server.name}?`,
      answer: `${server.name} is an MCP server built by ${server.author}. ${server.description}`,
    },
    {
      question: `Who built ${server.name}?`,
      answer: `${server.name} was built by ${server.author}.`,
    },
    {
      question: `Is ${server.name} free?`,
      answer: hasFreeOption(pricing.pricing_model)
        ? `Yes, ${server.name} has a free option. ${pricing.pricing_details}`
        : `${server.name} is free to install as an MCP server, but the underlying service may require payment. ${pricing.pricing_details}`,
    },
    {
      question: `How do I install ${server.name}?`,
      answer: installAnswer,
    },
    {
      question: `What does ${server.name} integrate with?`,
      answer: integrationsAnswer,
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": server.name,
    "description": server.description,
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "Any",
    "author": {
      "@type": "Organization",
      "name": server.author
    },
    "url": server.website_url || server.github_url,
    "downloadUrl": server.github_url,
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqItems.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="mb-8">
          <ol className="flex items-center space-x-2 text-sm text-gray-500">
            <li><Link href="/" className="hover:text-white transition">Home</Link></li>
            <li>/</li>
            <li><Link href="/category" className="hover:text-white transition">Servers</Link></li>
            <li>/</li>
            <li className="text-white">{server.name}</li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Header */}
            <div className="flex items-start space-x-4 mb-8">
              <span className="text-5xl">
                {serverCategories[0]?.emoji || "🔧"}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-white">{server.name}</h1>
                  <FreshnessBadge />
                  {server.official && (
                    <span className="px-2 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium rounded-full">
                      ✓ Official
                    </span>
                  )}
                  {server.featured && (
                    <span className="px-2 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium rounded-full">
                      ⭐ Featured
                    </span>
                  )}
                </div>
                <p className="text-gray-300 leading-relaxed mb-2">
                  The {server.name} MCP server, built by {server.author}, provides {capability.charAt(0).toLowerCase() + capability.slice(1)}. It is {server.official ? "officially maintained" : "community-built"} and best for {primaryCategory}.
                </p>
                <p className="text-gray-500">by {server.author}</p>
              </div>
            </div>

            {/* Description */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">About</h2>
              <p className="text-gray-400 leading-relaxed">{server.description}</p>
            </div>

            {/* Installation */}
            {server.install_command && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-white mb-4">Installation</h2>
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50">
                    <span className="text-sm text-gray-400">
                      {server.install_type === 'npm' ? 'npm / npx' : server.install_type}
                    </span>
                    <CopyButton text={server.install_command} />
                  </div>
                  <pre className="p-4 overflow-x-auto text-sm text-green-400">
                    <code>{server.install_command}</code>
                  </pre>
                </div>
              </div>
            )}

            {/* Categories */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">Categories</h2>
              <div className="flex flex-wrap gap-3">
                {serverCategories.map(cat => (
                  <Link
                    key={cat.slug}
                    href={`/category/${cat.slug}`}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg hover:border-blue-500/50 transition"
                  >
                    <span>{cat.emoji}</span>
                    <span className="text-gray-300">{cat.name}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Integrations */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">Works With</h2>
              <div className="flex flex-wrap gap-3">
                {serverIntegrations.map(int => (
                  <Link
                    key={int.slug}
                    href={`/integration/${int.slug}`}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg hover:border-blue-500/50 transition"
                  >
                    <span>{int.icon}</span>
                    <span className="text-gray-300">{int.name}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* FAQ Section */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">Frequently Asked Questions</h2>
              <div className="space-y-4">
                {faqItems.map((faq, index) => (
                  <details key={faq.question} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden group" open={index === 0}>
                    <summary className="px-6 py-4 cursor-pointer text-white font-medium hover:bg-gray-800/50 transition">
                      {faq.question}
                    </summary>
                    <div className="px-6 pb-4 text-gray-400">{faq.answer}</div>
                  </details>
                ))}
              </div>
            </div>

            {/* Related Blog Posts */}
            {relatedBlogPosts.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-white mb-4">Related Guides</h2>
                <div className="space-y-3">
                  {relatedBlogPosts.map(post => (
                    <Link
                      key={post.slug}
                      href={`/blog/${post.slug}`}
                      className="block bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-blue-500/50 transition"
                    >
                      <h3 className="text-white font-medium mb-1">{post.title}</h3>
                      <p className="text-gray-500 text-sm">{post.readingTime} • {post.category}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            <div className="flex flex-wrap gap-4">
              <a
                href={server.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-6 py-3 bg-gray-900 text-white font-medium rounded-lg border border-gray-800 hover:border-gray-700 hover:bg-gray-800 transition"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
                </svg>
                View on GitHub
              </a>
              {server.website_url && (
                <a
                  href={server.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
                >
                  Visit Website
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Live Trust Status */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">
                  {isLocal ? "Repo Health" : "Live Status"}
                </h3>
                {isLocal ? (
                  <LocalSignalBadge signal={staticSignal} />
                ) : (
                  <StatusBadge status={status} />
                )}
                {hasUptimeHistory && (
                  <div className="mt-3 flex items-center gap-3 px-1">
                    <UptimeSparkline history={history} />
                    <span className="text-xs text-gray-500">
                      Recent uptime
                    </span>
                  </div>
                )}
              </div>

              {/* Quick Info */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Info</h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm text-gray-500">Install Type</dt>
                    <dd className="text-gray-300 capitalize">{server.install_type}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Author</dt>
                    <dd className="text-gray-300">{server.author}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Categories</dt>
                    <dd className="text-gray-300">{server.categories.length}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Integrations</dt>
                    <dd className="text-gray-300">{server.integrations.length}</dd>
                  </div>
                </dl>
              </div>

              {/* Related Servers */}
              {relatedServers.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Related Servers</h3>
                  <div className="space-y-3">
                    {relatedServers.map(related => (
                      <ServerCardCompact key={related.slug} server={related} />
                    ))}
                  </div>
                </div>
              )}

              {/* Contextual Affiliate CTA */}
              <AffiliateServerCTA serverCategories={server.categories} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
