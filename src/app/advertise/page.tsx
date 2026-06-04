import Link from "next/link";
import { servers } from "@/data/servers";
import CheckoutButton from "./CheckoutButton";

const plans = [
  {
    name: "Basic",
    key: "basic",
    price: "$49",
    priceNote: " one-time",
    description: "Stand out in the directory",
    highlight: false,
    features: [
      "\"Featured\" badge on your listing",
      "Priority placement in category page",
      "Dofollow backlink to your repo/site",
      "SEO-optimized listing",
      "Listed within 24 hours",
    ],
    cta: "Get Basic",
  },
  {
    name: "Pro",
    key: "pro",
    price: "$99",
    priceNote: " one-time",
    description: "Maximum directory visibility",
    highlight: true,
    features: [
      "Everything in Basic, plus:",
      "Top of category page placement",
      "Comparison page priority",
      "Prominent \"Sponsored\" badge",
      "Homepage sponsored strip",
    ],
    cta: "Get Pro",
  },
  {
    name: "Premium",
    key: "premium",
    price: "$199",
    priceNote: " one-time",
    description: "The full spotlight treatment",
    highlight: false,
    features: [
      "Everything in Pro, plus:",
      "Dedicated blog post / review",
      "Top placement across all categories",
      "Social media mention",
      "Custom badge on listing",
      "Direct support channel",
    ],
    cta: "Get Premium",
  },
];

const stats = [
  { value: `${servers.length}+`, label: "MCP Servers" },
  { value: "5,000+", label: "Monthly Visitors" },
  { value: "500+", label: "Ranked Keywords" },
  { value: "2,200+", label: "Servers Indexed" },
];

export default async function AdvertisePage({
  searchParams,
}: {
  searchParams: Promise<{ server?: string }>;
}) {
  const params = await searchParams;
  const serverSlug = params?.server || "";
  const prefillServer = servers.find((s) => s.slug === serverSlug);
  const prefillServerName = prefillServer?.name || "";

  return (
    <div>
      {/* Claim Banner */}
      {prefillServer && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl px-6 py-4 flex items-center gap-3">
            <span className="text-xl">✨</span>
            <p className="text-gray-300 text-sm">
              Promoting <strong className="text-white">{prefillServer.name}</strong>? Choose a plan below to get featured placement, a sponsored badge, and a dofollow backlink.
            </p>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/15 to-amber-500/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 relative">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-6">
              <span className="text-blue-400 text-sm font-medium">📣 Sponsored Listings</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Get Your MCP Server{" "}
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-amber-400 bg-clip-text text-transparent">
                in Front of Developers
              </span>
            </h1>
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              MyMCPTools is the open directory for Model Context Protocol servers with{" "}
              <strong className="text-white">{servers.length}+ indexed servers</strong> and{" "}
              <strong className="text-white">5,000+ monthly developer visitors</strong> —
              engineers actively searching for MCP integrations for Claude, Cursor, and VS Code.
            </p>
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40"
            >
              Get Featured Today
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 mb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-gray-900/80 border border-gray-800 rounded-xl p-6 text-center backdrop-blur-sm"
            >
              <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-gray-500 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Traffic Sources */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-8">
          <h3 className="text-xl font-semibold text-center mb-6">Where Our Visitors Come From</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { source: "ChatGPT", detail: "Top referrer", icon: "🤖" },
              { source: "Google", detail: "Organic search", icon: "🔍" },
              { source: "Perplexity", detail: "AI search", icon: "⚡" },
              { source: "GitHub", detail: "Developer traffic", icon: "🐙" },
            ].map((item) => (
              <div key={item.source} className="flex flex-col items-center gap-1">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-white font-medium">{item.source}</span>
                <span className="text-gray-500 text-xs">{item.detail}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-500 text-sm mt-6">
            AI assistants actively recommend MCP servers listed in our directory.
          </p>
        </div>
      </section>

      {/* Why Advertise */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Why Advertise on MyMCPTools?</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Your ideal users are here — AI developers and agent builders actively looking for MCP integrations.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: "🎯",
              title: "Targeted Developer Audience",
              description:
                "Every visitor is specifically looking for MCP servers to use in their AI agents. No wasted impressions — just high-intent traffic from developers building with Claude, Cursor, and VS Code.",
            },
            {
              icon: "📈",
              title: "Growing Organic Traffic",
              description:
                "100% organic, SEO-driven traffic that compounds over time. Your featured listing benefits from our growing domain authority and 2,200+ indexed MCP servers.",
            },
            {
              icon: "🔗",
              title: "Permanent SEO Value",
              description:
                "Every listing includes a dofollow backlink. Your featured placement gives you premium link equity from a relevant, authoritative MCP server directory.",
            },
            {
              icon: "⚡",
              title: "Instant Credibility",
              description:
                "A \"Featured\" or \"Sponsored\" badge signals quality and production-readiness to developers evaluating your server.",
            },
            {
              icon: "📊",
              title: "Category Page Priority",
              description:
                "Featured servers get top placement in category pages — where developers browse and compare MCP servers for their stack.",
            },
            {
              icon: "💰",
              title: "Simple One-Time Pricing",
              description:
                "No subscriptions, no monthly invoices. Pay once and your server is featured. Monthly plans launching soon for ongoing top placement.",
            },
          ].map((benefit) => (
            <div
              key={benefit.title}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition"
            >
              <div className="text-3xl mb-3">{benefit.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{benefit.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16" id="pricing">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            One-time payment. No subscriptions. Monthly recurring plans coming soon.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-8 transition ${
                plan.highlight
                  ? "bg-gradient-to-b from-blue-600/15 to-purple-600/10 border-2 border-blue-500/40 shadow-lg shadow-blue-500/10"
                  : "bg-gray-900 border border-gray-800 hover:border-gray-700"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wide">
                    Most Popular
                  </span>
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <p className="text-gray-500 text-sm">{plan.description}</p>
              </div>
              <div className="mb-6">
                <div>
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-gray-500 text-sm ml-1">{plan.priceNote}</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
              <CheckoutButton
                plan={plan.key}
                highlight={plan.highlight}
                label={plan.cta}
                initialServerName={prefillServerName}
              />
              <p className="text-center text-gray-600 text-xs mt-3">
                <a
                  href={`mailto:shibley@mymcptools.com?subject=${encodeURIComponent(`${plan.name} Sponsored Listing — MyMCPTools`)}&body=${encodeURIComponent(`Hi,\n\nI'm interested in the ${plan.name} plan (${plan.price}) for a sponsored listing on MyMCPTools.\n\nServer Name: \nServer URL: \n\nThanks!`)}`}
                  className="hover:text-gray-400 transition"
                >
                  Prefer email? Contact us directly →
                </a>
              </p>
            </div>
          ))}
        </div>
        <p className="text-center text-gray-500 text-sm mt-8">
          Payments processed securely via Stripe. Need a custom arrangement?{" "}
          <a
            href="mailto:shibley@mymcptools.com?subject=Custom%20Sponsored%20Listing%20—%20MyMCPTools"
            className="text-blue-400 hover:text-blue-300"
          >
            Let&apos;s talk →
          </a>
        </p>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
        <div className="space-y-6">
          {[
            {
              q: "How quickly will my server be featured?",
              a: "Within 24 hours of payment. We'll set up your featured listing, add the sponsored badge, and position your server at the top of relevant category pages.",
            },
            {
              q: "Is this a one-time payment?",
              a: "Yes — current plans are one-time payments. Monthly recurring subscriptions for ongoing top placement are launching soon.",
            },
            {
              q: "What's included in the dedicated blog post (Premium)?",
              a: "A professionally written, SEO-optimized review article published on our blog. Includes use cases, installation guide, feature breakdown, and comparison with alternatives.",
            },
            {
              q: "Do I get a dofollow backlink?",
              a: "Yes! All plans include a permanent dofollow backlink to your GitHub repo or website, providing real SEO value from a relevant MCP directory.",
            },
            {
              q: "My server is already listed. Can I upgrade to featured?",
              a: "Yes! If your server is already in our directory, you can upgrade to any plan. Your existing listing will be enhanced with featured placement and a sponsored badge.",
            },
          ].map((faq) => (
            <div key={faq.q} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="font-semibold text-lg mb-2">{faq.q}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 mb-8">
        <div className="bg-gradient-to-r from-blue-600/20 via-purple-600/15 to-amber-500/10 border border-blue-500/20 rounded-2xl p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent" />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Reach More Developers?</h2>
            <p className="text-gray-400 mb-8 max-w-2xl mx-auto text-lg">
              Join the growing list of MCP servers reaching their target audience through MyMCPTools.
              Simple one-time pricing — no subscriptions, no surprises.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#pricing"
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition shadow-lg shadow-blue-600/25"
              >
                🚀 Get Featured Now
              </a>
              <Link
                href="/submit"
                className="inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-8 py-4 rounded-xl font-semibold transition"
              >
                Or Submit Free →
              </Link>
            </div>
            <p className="text-gray-500 text-sm mt-6">
              Questions?{" "}
              <a href="mailto:shibley@mymcptools.com" className="text-blue-400 hover:text-blue-300">
                shibley@mymcptools.com
              </a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
