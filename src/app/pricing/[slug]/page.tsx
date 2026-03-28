import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { servers, categories, getRelatedServers } from "@/data/servers";
import { getServerPricing, getPricingBadge, hasFreeOption } from "@/data/pricing";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return servers.map((server) => ({ slug: server.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const server = servers.find((s) => s.slug === slug);
  if (!server) return {};

  const pricing = getServerPricing(slug);
  const isFree = hasFreeOption(pricing.pricing_model);
  const freeText = isFree ? " & Free Options" : "";
  const year = new Date().getFullYear();

  return {
    title: `${server.name} MCP Server Pricing ${year}: Plans, Costs${freeText} | MyMCPTools`,
    description: `${server.name} MCP server pricing for ${year}. ${pricing.pricing_details.slice(0, 120)}. Compare costs, free options, and alternatives.`,
    alternates: {
      canonical: `https://mymcptools.com/pricing/${server.slug}`,
    },
    openGraph: {
      title: `${server.name} MCP Server Pricing ${year} — Plans & Costs | MyMCPTools`,
      description: `Complete ${server.name} MCP server pricing breakdown for ${year}. ${pricing.pricing_details.slice(0, 100)}`,
      url: `https://mymcptools.com/pricing/${server.slug}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${server.name} MCP Server Pricing ${year} — Plans & Costs`,
      description: `${server.name} MCP server pricing plans, features, and alternatives compared.`,
    },
  };
}

function generateFAQs(serverName: string, pricingModel: string, pricingDetails: string, categoryName: string) {
  const isFree = pricingModel === 'free' || pricingModel === 'open-source' || pricingModel === 'freemium';
  const year = new Date().getFullYear();

  const faqs = [
    {
      question: `Is ${serverName} MCP Server free to use?`,
      answer: pricingModel === 'open-source'
        ? `Yes, the ${serverName} MCP server is completely free and open-source. You can install and use it at no cost. However, the underlying ${serverName} service may have its own pricing tiers.`
        : pricingModel === 'free'
        ? `Yes, the ${serverName} MCP server and the underlying service are both free to use.`
        : pricingModel === 'freemium'
        ? `The ${serverName} MCP server itself is free to install. The underlying ${serverName} service offers a free tier with limited features, plus paid plans for additional capabilities.`
        : `The ${serverName} MCP server is free to install, but the underlying ${serverName} service requires a paid subscription to use.`,
    },
    {
      question: `How much does ${serverName} MCP Server cost in ${year}?`,
      answer: `${pricingDetails} The MCP server component is always free to install and configure with your AI assistant.`,
    },
    {
      question: `What are the best alternatives to ${serverName} MCP Server?`,
      answer: `There are several alternative MCP servers in the ${categoryName} category. Visit the ${serverName} alternatives page on MyMCPTools to compare features, pricing, and compatibility with AI assistants like Claude, Cursor, and VS Code.`,
    },
  ];

  if (isFree) {
    faqs.push({
      question: `What's included in the ${serverName} free tier?`,
      answer: pricingModel === 'open-source'
        ? `The ${serverName} MCP server is fully open-source with all features available for free. Some managed/cloud versions of the underlying service may offer additional paid features.`
        : `The ${serverName} free tier typically includes core functionality with usage limits. Check the official ${serverName} website for the most up-to-date free tier details and limitations.`,
    });
  }

  faqs.push({
    question: `Does ${serverName} work with Claude Desktop, Cursor, and VS Code?`,
    answer: `Yes, the ${serverName} MCP server is compatible with popular AI assistants and code editors that support the Model Context Protocol (MCP), including Claude Desktop, Cursor, VS Code, Windsurf, and Cline.`,
  });

  return faqs;
}

export default async function PricingPage({ params }: Props) {
  const { slug } = await params;
  const server = servers.find((s) => s.slug === slug);
  if (!server) notFound();

  const pricing = getServerPricing(slug);
  const badge = getPricingBadge(pricing.pricing_model);
  const isFree = hasFreeOption(pricing.pricing_model);
  const category = categories.find((c) => c.slug === server.categories[0]);
  const relatedServers = getRelatedServers(server, 6);
  const year = new Date().getFullYear();
  const faqs = generateFAQs(server.name, pricing.pricing_model, pricing.pricing_details, category?.name || server.categories[0]);

  const lastUpdated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // JSON-LD structured data
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: `${server.name} MCP Server`,
      description: server.description,
      url: `https://mymcptools.com/servers/${server.slug}`,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Cross-platform",
      offers: {
        "@type": "Offer",
        price: isFree ? "0" : undefined,
        priceCurrency: "USD",
        description: pricing.pricing_details,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://mymcptools.com" },
        { "@type": "ListItem", position: 2, name: "Pricing", item: "https://mymcptools.com/pricing" },
        { "@type": "ListItem", position: 3, name: `${server.name} Pricing`, item: `https://mymcptools.com/pricing/${server.slug}` },
      ],
    },
  ];

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-white transition">Home</Link>
          <span className="mx-2">›</span>
          <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
          <span className="mx-2">›</span>
          <span className="text-gray-300">{server.name}</span>
        </nav>

        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-start gap-4 mb-4">
            {category && <span className="text-4xl">{category.emoji}</span>}
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white">
                {server.name} MCP Server Pricing {year}
              </h1>
              <p className="text-xl text-gray-400 mt-2">
                Complete pricing guide for the {server.name} MCP server — costs, free options, and what you&apos;ll pay.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.bgColor} ${badge.color}`}>
              {badge.label}
            </span>
            <span className="text-gray-500 text-sm">by {server.author}</span>
            {server.official && (
              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-full">✓ Official</span>
            )}
            <span className="text-gray-600 text-xs">Updated {lastUpdated}</span>
          </div>
        </div>

        {/* TL;DR Box */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-10">
          <h2 className="text-xl font-semibold mb-3 text-white">
            💰 How Much Does {server.name} MCP Server Cost?
          </h2>
          <p className="text-gray-300 leading-relaxed">
            {pricing.pricing_details}
          </p>
          {pricing.pricing_url && (
            <a
              href={pricing.pricing_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center mt-3 text-blue-400 hover:text-blue-300 text-sm transition"
            >
              See official {server.name} pricing →
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-10">
            {/* Is it Free? */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-white">
                Is {server.name} MCP Server Free?
              </h2>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                {isFree ? (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-green-400 text-xl">✓</span>
                      <span className="text-green-400 font-semibold text-lg">
                        Yes, {server.name} MCP Server has free options
                      </span>
                    </div>
                    <p className="text-gray-300 leading-relaxed">
                      {pricing.pricing_model === 'open-source' ? (
                        <>The {server.name} MCP server is completely free and open-source. You can install it, use it, and even modify the source code. Note that while the MCP server itself is free, the underlying {server.name} service may have its own pricing tiers for API access or premium features.</>
                      ) : pricing.pricing_model === 'free' ? (
                        <>The {server.name} MCP server and the underlying service are both free to use. There are no hidden costs or paid tiers required to get started.</>
                      ) : (
                        <>The {server.name} MCP server itself is free to install and use. The underlying {server.name} service offers a free tier that lets you get started without paying. Paid plans are available for additional features and higher usage limits.</>
                      )}
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-orange-400 text-xl">✗</span>
                      <span className="text-orange-400 font-semibold text-lg">
                        {server.name} requires a paid subscription
                      </span>
                    </div>
                    <p className="text-gray-300 leading-relaxed">
                      While the {server.name} MCP server is free to install, the underlying {server.name} service requires a paid subscription or pay-as-you-go payment to use. Check the official {server.name} website for current pricing and any free trial offers.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Cost Breakdown */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-white">
                {server.name} Cost Breakdown: Server vs Service
              </h2>
              <div className="space-y-4">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-green-400 text-lg">🆓</span>
                    <h3 className="font-semibold text-white">MCP Server (Always Free)</h3>
                  </div>
                  <p className="text-gray-400 text-sm">
                    The {server.name} MCP server is the connector that lets your AI assistant (Claude, Cursor, VS Code, etc.) interact with {server.name}. This component is always free to install and use — it&apos;s just a bridge between your AI tool and the service.
                  </p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-lg ${isFree ? '💚' : '💰'}`}>{isFree ? '💚' : '💰'}</span>
                    <h3 className="font-semibold text-white">
                      {server.name} Service ({badge.label})
                    </h3>
                  </div>
                  <p className="text-gray-400 text-sm">
                    {pricing.pricing_details}
                  </p>
                  {pricing.pricing_url && (
                    <a
                      href={pricing.pricing_url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center mt-2 text-blue-400 hover:text-blue-300 text-sm transition"
                    >
                      View official pricing →
                    </a>
                  )}
                </div>
              </div>
            </section>

            {/* Installation */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-white">
                How to Install {server.name} MCP Server
              </h2>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded capitalize">{server.install_type}</span>
                </div>
                {server.install_command && (
                  <code className="block bg-gray-950 text-green-400 p-3 rounded-lg text-sm font-mono overflow-x-auto">
                    {server.install_command}
                  </code>
                )}
                <p className="text-gray-500 text-xs mt-3">
                  Compatible with: {server.integrations.map(i => {
                    const names: Record<string, string> = { 'claude-desktop': 'Claude Desktop', 'cursor': 'Cursor', 'vs-code': 'VS Code', 'windsurf': 'Windsurf', 'cline': 'Cline', 'zed': 'Zed', 'continue': 'Continue' };
                    return names[i] || i;
                  }).join(', ')}
                </p>
              </div>
            </section>

            {/* FAQ Section */}
            <section>
              <h2 className="text-2xl font-bold mb-6 text-white">
                Frequently Asked Questions
              </h2>
              <div className="space-y-4">
                {faqs.map((faq, i) => (
                  <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <h3 className="font-semibold text-lg mb-2 text-white">{faq.question}</h3>
                    <p className="text-gray-400 leading-relaxed">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* CTA */}
            <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 rounded-xl p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-white font-semibold text-lg">Looking for {server.name} alternatives?</p>
                  <p className="text-gray-400 text-sm">Compare similar MCP servers with different pricing and features.</p>
                </div>
                <Link
                  href={`/alternatives/${server.slug}`}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition whitespace-nowrap"
                >
                  View Alternatives →
                </Link>
              </div>
            </div>

            {/* Internal Links */}
            <section>
              <h2 className="text-2xl font-bold mb-4 text-white">Learn More</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link
                  href={`/servers/${server.slug}`}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-500/50 transition"
                >
                  <h3 className="font-semibold mb-1 text-white">📋 {server.name} Details</h3>
                  <p className="text-gray-400 text-sm">Full server details, install guide, and features</p>
                </Link>
                <Link
                  href={`/alternatives/${server.slug}`}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-500/50 transition"
                >
                  <h3 className="font-semibold mb-1 text-white">🔄 {server.name} Alternatives</h3>
                  <p className="text-gray-400 text-sm">Compare with similar MCP servers</p>
                </Link>
                {category && (
                  <Link
                    href={`/category/${category.slug}`}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-500/50 transition"
                  >
                    <h3 className="font-semibold mb-1 text-white">{category.emoji} {category.name} Servers</h3>
                    <p className="text-gray-400 text-sm">Browse all {category.name.toLowerCase()} MCP servers</p>
                  </Link>
                )}
                <Link
                  href="/compare"
                  className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-500/50 transition"
                >
                  <h3 className="font-semibold mb-1 text-white">⚖️ Compare Servers</h3>
                  <p className="text-gray-400 text-sm">Compare any two MCP servers side by side</p>
                </Link>
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Info Card */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sticky top-20">
              <h3 className="font-semibold text-white mb-4">Quick Info</h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">Pricing Model</dt>
                  <dd className={`font-medium ${badge.color}`}>{badge.label}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Install Type</dt>
                  <dd className="text-gray-300 capitalize">{server.install_type}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Author</dt>
                  <dd className="text-gray-300">{server.author}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Categories</dt>
                  <dd className="flex flex-wrap gap-1 mt-1">
                    {server.categories.map(cat => {
                      const c = categories.find(c => c.slug === cat);
                      return (
                        <Link key={cat} href={`/category/${cat}`} className="inline-flex items-center text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded hover:bg-gray-700 transition">
                          {c?.emoji} {c?.name || cat}
                        </Link>
                      );
                    })}
                  </dd>
                </div>
                {server.github_url && (
                  <div>
                    <dt className="text-gray-500">Source Code</dt>
                    <dd>
                      <a href={server.github_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm transition">
                        View on GitHub →
                      </a>
                    </dd>
                  </div>
                )}
                {pricing.pricing_url && (
                  <div>
                    <dt className="text-gray-500">Official Pricing</dt>
                    <dd>
                      <a href={pricing.pricing_url} target="_blank" rel="noopener noreferrer nofollow" className="text-blue-400 hover:text-blue-300 text-sm transition">
                        View Pricing →
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Related Servers */}
            {relatedServers.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold text-white mb-4">Related Servers</h3>
                <div className="space-y-3">
                  {relatedServers.map((related) => {
                    const relatedPricing = getServerPricing(related.slug);
                    const relatedBadge = getPricingBadge(relatedPricing.pricing_model);
                    return (
                      <Link
                        key={related.slug}
                        href={`/pricing/${related.slug}`}
                        className="block p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">{related.name}</span>
                          <span className={`text-xs ${relatedBadge.color}`}>{relatedBadge.label}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{related.description}</p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
