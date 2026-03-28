import { Metadata } from "next";
import Link from "next/link";
import { servers, categories } from "@/data/servers";
import { getServerPricing, getPricingBadge, type PricingModel } from "@/data/pricing";

export const metadata: Metadata = {
  title: "MCP Server Pricing Guide 2026: Compare Costs & Free Options | MyMCPTools",
  description: "Compare pricing for 270+ MCP servers. Find free, open-source, and freemium Model Context Protocol servers for Claude, Cursor, VS Code, and more.",
  alternates: {
    canonical: "https://mymcptools.com/pricing",
  },
};

export default function PricingIndexPage() {
  const year = new Date().getFullYear();

  // Group servers by pricing model
  const grouped: Record<PricingModel, typeof servers> = {
    'free': [],
    'open-source': [],
    'freemium': [],
    'paid': [],
  };

  servers.forEach((server) => {
    const pricing = getServerPricing(server.slug);
    grouped[pricing.pricing_model].push(server);
  });

  const sections: { model: PricingModel; title: string; description: string }[] = [
    { model: 'free', title: '🆓 Completely Free MCP Servers', description: 'These MCP servers and their underlying services are completely free.' },
    { model: 'open-source', title: '🟢 Open-Source MCP Servers', description: 'Free and open-source MCP servers. The underlying service may have costs.' },
    { model: 'freemium', title: '🔵 Freemium MCP Servers', description: 'Free tier available with paid plans for additional features.' },
    { model: 'paid', title: '🟠 Paid MCP Servers', description: 'The underlying service requires a paid subscription.' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-white transition">Home</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-300">Pricing</span>
      </nav>

      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          MCP Server Pricing Guide {year}
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Compare pricing for {servers.length}+ MCP servers. Find the right tool for your budget.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-6">
          <span className="bg-green-500/10 text-green-400 px-3 py-1 rounded-full text-sm">{grouped['free'].length} Free</span>
          <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-sm">{grouped['open-source'].length} Open Source</span>
          <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-sm">{grouped['freemium'].length} Freemium</span>
          <span className="bg-orange-500/10 text-orange-400 px-3 py-1 rounded-full text-sm">{grouped['paid'].length} Paid</span>
        </div>
      </div>

      {sections.map(({ model, title, description }) => (
        <section key={model} className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
          <p className="text-gray-400 mb-6">{description}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {grouped[model].map((server) => {
              const pricing = getServerPricing(server.slug);
              const badge = getPricingBadge(pricing.pricing_model);
              const category = categories.find((c) => c.slug === server.categories[0]);
              return (
                <Link
                  key={server.slug}
                  href={`/pricing/${server.slug}`}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-500/50 transition group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {category && <span>{category.emoji}</span>}
                    <h3 className="font-semibold text-white group-hover:text-blue-400 transition text-sm">{server.name}</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-2 line-clamp-2">{server.description}</p>
                  <div className="flex items-center gap-2">
                    <span className={`${badge.bgColor} ${badge.color} px-2 py-0.5 rounded-full text-xs font-medium`}>
                      {badge.label}
                    </span>
                    <span className="text-gray-600 text-xs">by {server.author}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
