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

  const year = new Date().getFullYear();
  const alternatives = getRelatedServers(server, 10);
  const altNames = alternatives.slice(0, 3).map(a => a.name).join(', ');

  return {
    title: `Best ${server.name} MCP Server Alternatives ${year} | MyMCPTools`,
    description: `Top alternatives to ${server.name} MCP server in ${year}. Compare ${altNames} and more. Find the best MCP server for your needs.`,
    alternates: {
      canonical: `https://mymcptools.com/alternatives/${server.slug}`,
    },
    openGraph: {
      title: `Best ${server.name} MCP Server Alternatives ${year} | MyMCPTools`,
      description: `Compare the top alternatives to ${server.name} MCP server. ${alternatives.length} similar servers compared.`,
      url: `https://mymcptools.com/alternatives/${server.slug}`,
      type: "website",
    },
  };
}

function generateFAQs(serverName: string, alternatives: typeof servers, categoryName: string) {
  const year = new Date().getFullYear();
  const altNames = alternatives.slice(0, 5).map(a => a.name);

  return [
    {
      question: `What are the best alternatives to ${serverName} MCP Server?`,
      answer: `The top alternatives to ${serverName} MCP Server in ${year} include ${altNames.join(', ')}. Each offers similar functionality in the ${categoryName} category with different features, pricing, and compatibility.`,
    },
    {
      question: `Is there a free alternative to ${serverName} MCP Server?`,
      answer: (() => {
        const freeAlts = alternatives.filter(a => {
          const p = getServerPricing(a.slug);
          return hasFreeOption(p.pricing_model);
        }).slice(0, 3).map(a => a.name);
        return freeAlts.length > 0
          ? `Yes, free alternatives to ${serverName} include ${freeAlts.join(', ')}. These offer free tiers or are completely open-source.`
          : `Most alternatives to ${serverName} require paid subscriptions, though many offer free trials.`;
      })(),
    },
    {
      question: `How do I choose between ${serverName} and its alternatives?`,
      answer: `When choosing between ${serverName} and alternatives, consider: (1) Pricing — compare free tiers and paid plans, (2) Features — what specific capabilities you need, (3) Compatibility — which AI assistants (Claude, Cursor, VS Code) are supported, (4) Installation — npm, pip, docker, or other install methods.`,
    },
    {
      question: `Can I use multiple MCP servers at the same time?`,
      answer: `Yes! MCP (Model Context Protocol) supports running multiple servers simultaneously. You can use ${serverName} alongside other MCP servers to extend your AI assistant's capabilities across different services and tools.`,
    },
  ];
}

export default async function AlternativesPage({ params }: Props) {
  const { slug } = await params;
  const server = servers.find((s) => s.slug === slug);
  if (!server) notFound();

  const pricing = getServerPricing(slug);
  const badge = getPricingBadge(pricing.pricing_model);
  const category = categories.find((c) => c.slug === server.categories[0]);
  const alternatives = getRelatedServers(server, 10);
  const year = new Date().getFullYear();
  const faqs = generateFAQs(server.name, alternatives, category?.name || server.categories[0]);

  const schemas = [
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
        { "@type": "ListItem", position: 2, name: "Alternatives", item: "https://mymcptools.com/alternatives" },
        { "@type": "ListItem", position: 3, name: `${server.name} Alternatives`, item: `https://mymcptools.com/alternatives/${server.slug}` },
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
          <Link href={`/servers/${server.slug}`} className="hover:text-white transition">{server.name}</Link>
          <span className="mx-2">›</span>
          <span className="text-gray-300">Alternatives</span>
        </nav>

        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Best {server.name} MCP Server Alternatives {year}
          </h1>
          <p className="text-xl text-gray-400">
            {alternatives.length} alternatives to {server.name} for your AI workflow. Compare features, pricing, and compatibility.
          </p>
        </div>

        {/* Current Server Summary */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            {category && <span className="text-3xl">{category.emoji}</span>}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-lg font-semibold text-white">{server.name}</h2>
                <span className={`${badge.bgColor} ${badge.color} px-2 py-0.5 rounded-full text-xs font-medium`}>
                  {badge.label}
                </span>
                {server.official && (
                  <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full text-xs">✓ Official</span>
                )}
              </div>
              <p className="text-gray-400 text-sm mb-2">{server.description}</p>
              <p className="text-gray-500 text-xs">{pricing.pricing_details}</p>
            </div>
            <Link
              href={`/servers/${server.slug}`}
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap"
            >
              View Details
            </Link>
          </div>
        </div>

        {/* Alternatives List */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-6">
            Top {server.name} Alternatives
          </h2>
          <div className="space-y-4">
            {alternatives.map((alt, index) => {
              const altPricing = getServerPricing(alt.slug);
              const altBadge = getPricingBadge(altPricing.pricing_model);
              const altCategory = categories.find((c) => c.slug === alt.categories[0]);
              const sharedCategories = alt.categories.filter(c => server.categories.includes(c));
              const sorted = [server.slug, alt.slug].sort();
              const compareSlug = `${sorted[0]}-vs-${sorted[1]}`;

              return (
                <div key={alt.slug} className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-gray-600 text-sm font-medium">#{index + 1}</span>
                        {altCategory && <span className="text-lg">{altCategory.emoji}</span>}
                        <Link href={`/servers/${alt.slug}`} className="text-lg font-semibold text-white hover:text-blue-400 transition">
                          {alt.name}
                        </Link>
                        <span className={`${altBadge.bgColor} ${altBadge.color} px-2 py-0.5 rounded-full text-xs font-medium`}>
                          {altBadge.label}
                        </span>
                        {alt.official && (
                          <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full text-xs">✓ Official</span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm mb-2">{alt.description}</p>
                      <p className="text-gray-500 text-xs mb-3">{altPricing.pricing_details}</p>
                      <div className="flex flex-wrap gap-2">
                        {sharedCategories.map(cat => {
                          const c = categories.find(c => c.slug === cat);
                          return (
                            <span key={cat} className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">
                              {c?.emoji} {c?.name || cat}
                            </span>
                          );
                        })}
                        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded capitalize">
                          📦 {alt.install_type}
                        </span>
                      </div>
                    </div>
                    <div className="flex sm:flex-col gap-2 flex-shrink-0">
                      <Link
                        href={`/pricing/${alt.slug}`}
                        className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition text-center"
                      >
                        Pricing
                      </Link>
                      <Link
                        href={`/compare/${compareSlug}`}
                        className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 px-4 py-2 rounded-lg text-sm font-medium transition text-center"
                      >
                        Compare
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mb-10">
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

        {/* Internal Links */}
        <section>
          <h2 className="text-2xl font-bold mb-4 text-white">Related Pages</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link href={`/pricing/${server.slug}`} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-500/50 transition">
              <h3 className="font-semibold mb-1 text-white">💰 {server.name} Pricing</h3>
              <p className="text-gray-400 text-sm">Detailed pricing breakdown</p>
            </Link>
            <Link href={`/servers/${server.slug}`} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-500/50 transition">
              <h3 className="font-semibold mb-1 text-white">📋 {server.name} Details</h3>
              <p className="text-gray-400 text-sm">Full server info and install guide</p>
            </Link>
            {category && (
              <Link href={`/category/${category.slug}`} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-500/50 transition">
                <h3 className="font-semibold mb-1 text-white">{category.emoji} {category.name}</h3>
                <p className="text-gray-400 text-sm">Browse all {category.name.toLowerCase()} servers</p>
              </Link>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
