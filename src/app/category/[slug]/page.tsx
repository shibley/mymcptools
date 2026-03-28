import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ServerCard } from "@/components/ServerCard";
import { categories, getServersByCategory } from "@/data/servers";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return categories.map((category) => ({
    slug: category.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = categories.find(c => c.slug === slug);
  
  if (!category) {
    return { title: "Category Not Found | MyMCPTools" };
  }

  return {
    title: `${category.name} MCP Servers — ${category.description} | MyMCPTools`,
    description: `Discover ${category.name.toLowerCase()} MCP servers for AI assistants. Browse tools for ${category.description.toLowerCase()}.`,
    openGraph: {
      title: `${category.name} MCP Servers | MyMCPTools`,
      description: `Discover ${category.name.toLowerCase()} MCP servers for AI assistants.`,
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = categories.find(c => c.slug === slug);

  if (!category) {
    notFound();
  }

  const categoryServers = getServersByCategory(slug);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="mb-8">
        <ol className="flex items-center space-x-2 text-sm text-gray-500">
          <li><Link href="/" className="hover:text-white transition">Home</Link></li>
          <li>/</li>
          <li><Link href="/category" className="hover:text-white transition">Categories</Link></li>
          <li>/</li>
          <li className="text-white">{category.name}</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center space-x-4 mb-4">
          <span className="text-5xl">{category.emoji}</span>
          <div>
            <h1 className="text-3xl font-bold text-white">{category.name} MCP Servers</h1>
            <p className="text-gray-500">{categoryServers.length} servers available</p>
          </div>
        </div>
        <p className="text-gray-400 max-w-2xl mt-4">{category.description}</p>
      </div>

      {/* Servers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categoryServers.map(server => (
          <ServerCard key={server.slug} server={server} showCategory={false} />
        ))}
      </div>

      {/* Other Categories */}
      <div className="mt-16">
        <h2 className="text-xl font-semibold text-white mb-6">Other Categories</h2>
        <div className="flex flex-wrap gap-3">
          {categories
            .filter(c => c.slug !== slug)
            .map(cat => (
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
    </div>
  );
}
