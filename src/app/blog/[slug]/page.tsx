import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { blogPosts, getBlogPostBySlug } from "@/data/blog";
import { getServerBySlug } from "@/data/servers";
import { ServerCardCompact } from "@/components/ServerCard";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return { title: "Post Not Found | MyMCPTools Blog" };
  }

  return {
    title: `${post.title} | MyMCPTools Blog`,
    description: post.description,
    keywords: post.keywords.join(", "),
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const relatedServers = post.relatedServerSlugs
    .map((s) => getServerBySlug(s))
    .filter(Boolean);

  const otherPosts = blogPosts.filter((p) => p.slug !== slug).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      "@type": "Organization",
      name: post.author,
      url: "https://mymcptools.com",
    },
    publisher: {
      "@type": "Organization",
      name: "MyMCPTools",
      url: "https://mymcptools.com",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://mymcptools.com/blog/${slug}`,
    },
    keywords: post.keywords.join(", "),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://mymcptools.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: "https://mymcptools.com/blog",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: `https://mymcptools.com/blog/${slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="mb-8">
          <ol className="flex items-center space-x-2 text-sm text-gray-500">
            <li>
              <Link href="/" className="hover:text-white transition">
                Home
              </Link>
            </li>
            <li>/</li>
            <li>
              <Link href="/blog" className="hover:text-white transition">
                Blog
              </Link>
            </li>
            <li>/</li>
            <li className="text-white truncate max-w-[200px]">{post.title}</li>
          </ol>
        </nav>

        {/* Article Header */}
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-full border border-blue-500/20">
              {post.category}
            </span>
            <span className="text-gray-500 text-sm">{post.readingTime}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
            {post.title}
          </h1>
          <p className="text-lg text-gray-400 mb-4">{post.description}</p>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>By {post.author}</span>
            <span>·</span>
            <time dateTime={post.date}>
              {new Date(post.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </div>
        </header>

        {/* Article Content */}
        <article
          className="prose prose-invert prose-lg max-w-none
            prose-headings:text-white prose-headings:font-bold
            prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
            prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
            prose-p:text-gray-300 prose-p:leading-relaxed
            prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
            prose-strong:text-white
            prose-li:text-gray-300
            prose-code:text-blue-300 prose-code:bg-gray-800/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
            prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-800 prose-pre:rounded-xl
            prose-ol:text-gray-300 prose-ul:text-gray-300"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Related MCP Servers */}
        {relatedServers.length > 0 && (
          <section className="mt-16 pt-10 border-t border-gray-800">
            <h2 className="text-xl font-bold text-white mb-6">
              🔧 MCP Servers Mentioned in This Article
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {relatedServers.map(
                (server) =>
                  server && (
                    <ServerCardCompact key={server.slug} server={server} />
                  )
              )}
            </div>
          </section>
        )}

        {/* More Articles */}
        {otherPosts.length > 0 && (
          <section className="mt-16 pt-10 border-t border-gray-800">
            <h2 className="text-xl font-bold text-white mb-6">
              📚 More from the Blog
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {otherPosts.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition group"
                >
                  <span className="text-xs text-blue-400 font-medium">
                    {p.category}
                  </span>
                  <h3 className="text-white font-semibold mt-2 mb-2 group-hover:text-blue-400 transition line-clamp-2">
                    {p.title}
                  </h3>
                  <p className="text-gray-500 text-sm line-clamp-2">
                    {p.description}
                  </p>
                  <span className="text-gray-600 text-xs mt-3 block">
                    {p.readingTime}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
