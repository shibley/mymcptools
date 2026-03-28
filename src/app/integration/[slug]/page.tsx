import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ServerCard } from "@/components/ServerCard";
import { integrations, getServersByIntegration } from "@/data/servers";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return integrations.map((integration) => ({
    slug: integration.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const integration = integrations.find(i => i.slug === slug);
  
  if (!integration) {
    return { title: "Integration Not Found | MyMCPTools" };
  }

  return {
    title: `MCP Servers for ${integration.name} — Compatible Tools | MyMCPTools`,
    description: `Discover MCP servers that work with ${integration.name}. ${integration.description}`,
    openGraph: {
      title: `MCP Servers for ${integration.name} | MyMCPTools`,
      description: `Discover MCP servers that work with ${integration.name}.`,
    },
  };
}

export default async function IntegrationPage({ params }: Props) {
  const { slug } = await params;
  const integration = integrations.find(i => i.slug === slug);

  if (!integration) {
    notFound();
  }

  const integrationServers = getServersByIntegration(slug);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="mb-8">
        <ol className="flex items-center space-x-2 text-sm text-gray-400">
          <li><Link href="/" className="hover:text-white">Home</Link></li>
          <li>/</li>
          <li><Link href="/integration" className="hover:text-white">Integrations</Link></li>
          <li>/</li>
          <li className="text-white">{integration.name}</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center space-x-4 mb-4">
          <span className="text-5xl">{integration.icon}</span>
          <div>
            <h1 className="text-3xl font-bold text-white">MCP Servers for {integration.name}</h1>
            <p className="text-gray-400">{integrationServers.length} compatible servers</p>
          </div>
        </div>
        <p className="text-gray-400 max-w-2xl mt-4">{integration.description}</p>
      </div>

      {/* Servers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrationServers.map(server => (
          <ServerCard key={server.slug} server={server} />
        ))}
      </div>

      {/* Other Integrations */}
      <div className="mt-16">
        <h2 className="text-xl font-semibold text-white mb-6">Other Integrations</h2>
        <div className="flex flex-wrap gap-3">
          {integrations
            .filter(i => i.slug !== slug)
            .map(int => (
              <Link
                key={int.slug}
                href={`/integration/${int.slug}`}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:border-purple-500/50 transition-all"
              >
                <span>{int.icon}</span>
                <span className="text-white">{int.name}</span>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
