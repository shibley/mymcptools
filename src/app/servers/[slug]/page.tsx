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
import { getTrustVerdict } from "@/lib/trust/verdict-store";
import { TrustGradeSummary } from "@/components/TrustGrade";
import { TrustSignalList } from "@/components/TrustSignals";
import { AffiliateServerCTA } from "@/components/AffiliateServerCTA";
import { servers, getServerBySlug, getRelatedServers, categories, integrations, registryLabel } from "@/data/servers";
import { getServerGuide } from "@/data/server-guides";
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

/**
 * True when the catalog holds no public artifact for this server at all — no
 * repository it could confirm, no install command, no website.
 *
 * 427 entries (17% of the catalog) are in this state. Every other page here
 * ends with something a reader can act on; these end with nothing, while the
 * meta description still promises "learn how to install and configure" it and
 * the body still narrates the server as an established thing. That gap is the
 * problem: the page reads as a listing for working software and then, silently,
 * offers no way to get it.
 *
 * The fix is not to hide the page — the name is a real search query and the
 * description is real information. It is to say the missing part out loud, in
 * the slot where the Installation block would otherwise be, and to stop the
 * metadata promising steps that do not exist.
 */
function hasNoPublicArtifact(server: { github_url: string | null; install_command?: string; website_url?: string }) {
  return !server.github_url && !server.install_command?.trim() && !server.website_url;
}

/**
 * Lower-cases the first character so a description can be injected mid-sentence.
 * Left alone when the second character is also upper-case, so acronyms and
 * product names that lead a description ("AI-powered…", "API access…",
 * "GitHub…") aren't mangled into "aI-powered".
 */
function uncapitalize(text: string) {
  if (/^[A-Z][A-Z]/.test(text)) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Upper-cases the first character so a description can start a sentence. */
function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * True when a description already opens by naming the server itself — either
 * "Supabase MCP Server connects…" or "The Brave Search MCP server is…".
 *
 * The mid-sentence templates below ("X MCP Server provides …") assume the
 * description is a bare noun phrase. Roughly 80 of the deepest, most-enriched
 * entries are not: they open with a full self-naming sentence, which rendered
 * as "Supabase MCP Server provides supabase MCP Server connects…" — a
 * duplicated name plus a lower-cased proper noun, in the <title>-adjacent meta
 * description and OpenGraph copy of exactly the pages we most want ranking.
 * When the description names itself, let it stand as its own sentence instead
 * of forcing it into the template.
 */
/**
 * The display phrase for a server, avoiding "MCP Inspector MCP Server".
 *
 * Every title, meta description and intro line here appends "MCP Server" to
 * the base name, which is right for "Supabase" and wrong for the handful of
 * entries whose own name already leads with "MCP" — the MCP Inspector, MCP
 * Sports, MCP Provenance Monitor. Those rendered a doubled acronym in the
 * <title>, which is the one string a searcher reads before clicking.
 * `mcpPhrase("MCP Inspector")` → "MCP Inspector"; `mcpPhrase("Supabase")` →
 * "Supabase MCP Server". The lower-cased variant is for mid-sentence use.
 *
 * The leading-MCP check is not enough on its own: the gateway entries added
 * 2026-08-02 are named "ContextForge MCP Gateway" / "Docker MCP Gateway", where
 * the acronym sits mid-name, and those rendered "… MCP Gateway MCP Server".
 * The general rule is simply that a name already carrying "MCP" as a word does
 * not need the phrase appended — `\s+MCP\s+Servers?$` is stripped from the base
 * name upstream, so anything reaching here with an "MCP" in it is a name like
 * "MCP Inspector" or "Docker MCP Gateway" that already reads correctly.
 */
function mcpPhrase(baseName: string, lower = false) {
  if (/\bMCP\b/i.test(baseName)) return baseName;
  return `${baseName} MCP ${lower ? "server" : "Server"}`;
}

function isSelfNaming(text: string, baseName: string) {
  const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^(the\\s+)?${escaped}\\b`, "i").test(text.trim());
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

  const baseName = server.name.replace(/\s+MCP\s+Servers?$/i, "").trim();
  // Descriptions are authored as lowercase-safe noun phrases so they read as
  // grammar when injected mid-sentence (see the intro line below). Anywhere a
  // description *starts* a sentence it has to be re-capitalised first.
  const sentenceDescription = isSelfNaming(server.description, baseName)
    ? capitalize(server.description)
    : `${mcpPhrase(baseName)} provides ${uncapitalize(server.description)}`;

  // Promising install steps on a page that has none is the single clearest way
  // to lose a click twice: once to the bounce, once to the search engine noting
  // the mismatch between the snippet and the page.
  const unverified = hasNoPublicArtifact(server);
  // A page carrying a hand-written guide is a different page, and the snippet
  // should say so — "Setup Guide" is what someone searching `[tool] mcp server`
  // is looking for, and here it is a promise the page actually keeps.
  const guide = getServerGuide(slug);

  return {
    title: unverified
      ? `${mcpPhrase(baseName)} — What We Could Verify | MyMCPTools`
      : guide
        ? `${mcpPhrase(baseName)} — Setup Guide, Tools & Alternatives | MyMCPTools`
        : `${mcpPhrase(baseName)} — Setup, Features & Alternatives | MyMCPTools`,
    description: unverified
      ? `${sentenceDescription} No public repository or published package has been confirmed for the ${mcpPhrase(baseName, true)} — here is what the catalog can and cannot verify.`
      : guide
        ? `Step-by-step setup for the ${mcpPhrase(baseName, true)} in Claude, Cursor, VS Code and Codex, its tool list, worked prompts, and the mistakes that break a first install — verified against the project's own docs ${guide.verifiedOn}.`
        : `${sentenceDescription} Learn how to install and configure the ${mcpPhrase(baseName, true)} for Claude, Cursor, VS Code, and more.`,
    openGraph: {
      title: `${mcpPhrase(baseName)} | MyMCPTools`,
      description: sentenceDescription,
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
  const trust = getTrustVerdict(server.slug);
  const hasUptimeHistory = history.some((p) => p.verdict !== "UNPROBEABLE");
  const primaryCategory = serverCategories[0]?.name || server.categories[0] || "MCP workflows";
  const baseName = server.name.replace(/\s+MCP\s+Servers?$/i, "").trim();
  const capability = getFirstSentence(server.description);
  const installAnswer = server.install_command && server.install_verified !== false
    ? `Install ${server.name} with ${server.install_type}: ${server.install_command}`
    : server.install_command && server.install_verified === false
      ? `The install command commonly listed for ${server.name} (${server.install_command}) points at a package that is not published to ${registryLabel(server.install_type)}, so it will fail. Install it from source instead${server.github_url ? `: ${server.github_url}` : '.'}`
    : server.github_url
      ? `Install ${server.name} from its GitHub repository: ${server.github_url}`
      : `${server.name} has no verified public repository, so there is no confirmed install command for it.`;
  const integrationsAnswer = serverIntegrations.length > 0
    ? `${server.name} integrates with ${serverIntegrations.map(i => i.name).join(", ")}.`
    : `${server.name} works with MCP-compatible clients such as Claude Desktop, Cursor, and VS Code.`;
  // Hand-written long-form guide, for the handful of slugs that have one.
  const guide = getServerGuide(server.slug);
  const faqItems = [
    // Guide gotchas lead: they are the questions people actually search
    // ("why does X return nothing"), where the five below are definitional.
    // They also carry into the FAQPage schema built from this same array.
    ...(guide?.gotchas ?? []).map((g) => ({ question: g.question, answer: g.answer })),
    {
      question: `What is ${server.name}?`,
      answer: `${baseName} is an MCP server built by ${server.author}. ${capitalize(server.description)}`,
    },
    {
      question: `Who built ${server.name}?`,
      answer: `${server.name} was built by ${server.author}.`,
    },
    {
      question: `Is ${server.name} free?`,
      answer: hasFreeOption(pricing.pricing_model)
        ? `Yes, ${server.name} has a free option. ${pricing.pricing_details}`
        : `${baseName} is free to install as an MCP server, but the underlying service may require payment. ${pricing.pricing_details}`,
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
    "url": server.website_url || server.github_url || undefined,
    "downloadUrl": server.github_url || undefined,
  };

  // HowTo schema, only where there are real steps to describe. Emitting it from
  // a template would be describing steps we do not have.
  const howToJsonLd = guide?.setup
    ? {
        "@context": "https://schema.org",
        "@type": "HowTo",
        "name": guide.setup.title,
        "description": guide.intro,
        "step": guide.setup.steps.map((step, i) => ({
          "@type": "HowToStep",
          "position": i + 1,
          "name": step.title,
          "text": step.code ? `${step.body} ${step.code}` : step.body,
        })),
      }
    : null;

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
      {howToJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd).replace(/</g, "\\u003c") }}
        />
      )}
      
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
                  {trust && trust.score !== null && (
                    <a
                      href="#trust"
                      className="inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-900 px-2.5 py-1 text-xs font-medium text-gray-300 transition hover:border-gray-600"
                    >
                      Trust grade <span className="font-bold text-white">{trust.tier}</span>
                      <span className="text-gray-500">{trust.score}/100</span>
                    </a>
                  )}
                </div>
                <p className="text-gray-300 leading-relaxed mb-2">
                  {isSelfNaming(capability, baseName) ? (
                    <>
                      {capitalize(capability)}. Built by {server.author}, it is{" "}
                      {server.official ? "officially maintained" : "community-built"} and best for {primaryCategory}.
                    </>
                  ) : (
                    <>
                      The {mcpPhrase(baseName, true)}, built by {server.author}, provides {uncapitalize(capability)}. It is{" "}
                      {server.official ? "officially maintained" : "community-built"} and best for {primaryCategory}.
                    </>
                  )}
                </p>
                <p className="text-gray-500">by {server.author}</p>
              </div>
            </div>

            {/* Description */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">About</h2>
              <p className="text-gray-400 leading-relaxed">{server.description}</p>
            </div>

            {/* Trust verdict — the score plus, always, the reasons behind it.
                A grade with no working shown is just an opinion with a number
                attached, so the full signal list renders inline rather than
                behind a link. */}
            {trust && (
              <div className="mb-8" id="trust">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-xl font-semibold text-white">Trust verdict</h2>
                  <Link href="/trust" className="text-sm text-blue-400 transition hover:text-blue-300">
                    How grades are computed →
                  </Link>
                </div>
                <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
                  <TrustGradeSummary
                    tier={trust.tier}
                    score={trust.score}
                    confidence={trust.confidence}
                    evidenceCount={trust.evidenceCount}
                    size="lg"
                  />
                  <p className="mt-4 text-sm leading-relaxed text-gray-400">{trust.summary}</p>

                  <div className="mt-6 border-t border-gray-800 pt-5">
                    <TrustSignalList signals={trust.signals} />
                  </div>
                </div>
              </div>
            )}

            {/* Nothing to install, nothing to read, nothing to visit. Rather than
                end the page in silence — which reads as "we just didn't fill this
                in" — state the gap in the slot the Installation block would have
                occupied, and point at the places a reader can check for themselves. */}
            {hasNoPublicArtifact(server) && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-white mb-4">What we could verify</h2>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
                  <p className="text-sm leading-relaxed text-amber-100/90">
                    No public repository, published package, or project website has been
                    confirmed for {server.name}. The description above reflects what the
                    server is reported to do; we have not been able to verify an
                    implementation behind it, so there is no install command to give you
                    and no star count worth quoting.
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-gray-400">
                    If you maintain it, or you know the repository, the fastest way to fix
                    this listing is to point us at the source.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <a
                      href={`https://github.com/search?q=${encodeURIComponent(`${baseName} mcp server`)}&type=repositories`}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-300 transition hover:border-blue-500/50"
                    >
                      Search GitHub for it
                    </a>
                    <Link
                      href={`/category/${serverCategories[0]?.slug || "developer-tools"}`}
                      className="inline-flex items-center rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-300 transition hover:border-blue-500/50"
                    >
                      Browse verified {primaryCategory} servers
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Installation */}
            {server.install_command && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-white mb-4">Installation</h2>
                <div className={`bg-gray-900 border rounded-xl overflow-hidden ${server.install_verified === false ? 'border-amber-500/40' : 'border-gray-800'}`}>
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50">
                    <span className="text-sm text-gray-400">
                      {server.install_type === 'npm' ? 'npm / npx' : server.install_type}
                    </span>
                    {server.install_verified === false ? (
                      <span className="text-xs font-medium text-amber-400">⚠️ Not on the registry</span>
                    ) : (
                      <CopyButton text={server.install_command} />
                    )}
                  </div>
                  <pre className={`p-4 overflow-x-auto text-sm ${server.install_verified === false ? 'text-gray-500 line-through decoration-amber-500/60' : 'text-green-400'}`}>
                    <code>{server.install_command}</code>
                  </pre>
                  {/* An install command that 404s on the registry is worse than no
                      command at all — it sends people to a terminal error. Say so
                      instead of offering a copy button. */}
                  {server.install_verified === false && (
                    <p className="border-t border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
                      This command will fail: <code className="text-amber-100">{server.install_command?.split(/\s+/).find(t => !t.startsWith('-') && !['npx', 'uvx', 'pip', 'install', 'npm', 'docker', 'run'].includes(t))}</code> is not published to {registryLabel(server.install_type)} (checked {server.install_checked}).
                      {server.github_url
                        ? ' Install from the repository below instead.'
                        : ' No verified repository is on file for this server either, so treat it as unconfirmed.'}
                    </p>
                  )}
                  {server.install_verified === true && (
                    <p className="border-t border-gray-800 px-4 py-2 text-xs text-gray-500">
                      Package confirmed live on {registryLabel(server.install_type)} — checked {server.install_checked}.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Hand-written guide ─────────────────────────────────────────
                Only renders for slugs with an entry in server-guides.ts. This is
                the part of the page that is not derivable from the catalog row:
                which of the similarly-named servers to pick, what to paste
                where, and what breaks first. */}
            {guide && (
              <>
                {guide.intro && (
                  <div className="mb-8 rounded-xl border border-blue-500/25 bg-blue-500/5 p-5">
                    <p className="text-gray-300 leading-relaxed">{guide.intro}</p>
                  </div>
                )}

                {guide.setup && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold text-white mb-4">{guide.setup.title}</h2>
                    <ol className="space-y-5">
                      {guide.setup.steps.map((step, i) => (
                        <li key={step.title} className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
                          <h3 className="text-white font-medium mb-2">
                            <span className="mr-2 text-gray-500">{i + 1}.</span>
                            {step.title}
                          </h3>
                          <p className="text-gray-400 leading-relaxed">{step.body}</p>
                          {step.code && (
                            <div className="mt-4 overflow-hidden rounded-lg border border-gray-800 bg-gray-950">
                              <div className="flex items-center justify-between bg-gray-800/50 px-4 py-2">
                                <span className="text-xs text-gray-400">{step.codeLabel || "config"}</span>
                                <CopyButton text={step.code} />
                              </div>
                              <pre className="overflow-x-auto p-4 text-sm text-green-400">
                                <code>{step.code}</code>
                              </pre>
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {guide.tools && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold text-white mb-4">{guide.tools.title}</h2>
                    {guide.tools.note && (
                      <p className="mb-4 text-gray-400 leading-relaxed">{guide.tools.note}</p>
                    )}
                    <div className="divide-y divide-gray-800 overflow-hidden rounded-xl border border-gray-800 bg-gray-900/60">
                      {guide.tools.items.map((tool) => (
                        <div key={tool.name} className="p-4 sm:flex sm:gap-4">
                          <code className="shrink-0 text-sm text-blue-300 sm:w-56">{tool.name}</code>
                          <p className="mt-1 text-sm leading-relaxed text-gray-400 sm:mt-0">{tool.what}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {guide.useCases && guide.useCases.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold text-white mb-4">What people use it for</h2>
                    <div className="space-y-4">
                      {guide.useCases.map((uc) => (
                        <div key={uc.title} className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
                          <h3 className="text-white font-medium mb-3">{uc.title}</h3>
                          <blockquote className="border-l-2 border-blue-500/50 pl-4 text-gray-300 italic">
                            &ldquo;{uc.prompt}&rdquo;
                          </blockquote>
                          <p className="mt-3 text-sm leading-relaxed text-gray-500">{uc.why}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {guide.comparison && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold text-white mb-4">Which one should you use?</h2>
                    {guide.comparison.note && (
                      <p className="mb-4 text-gray-400 leading-relaxed">{guide.comparison.note}</p>
                    )}
                    <div className="space-y-3">
                      {guide.comparison.items.map((item) => (
                        <div key={item.name} className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
                          <h3 className="text-white font-medium mb-1">
                            {item.slug ? (
                              <Link href={`/servers/${item.slug}`} className="text-blue-400 transition hover:text-blue-300">
                                {item.name}
                              </Link>
                            ) : (
                              item.name
                            )}
                          </h3>
                          <p className="text-sm leading-relaxed text-gray-400">{item.choose}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Where the guide's claims came from. A setup guide that cannot
                    be checked is just a confident paragraph. */}
                <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900/40 p-5">
                  <p className="text-sm text-gray-500">
                    Every command, environment variable, and endpoint above was read from the
                    project&rsquo;s own documentation on {guide.verifiedOn}:{" "}
                    {guide.sources.map((source, i) => (
                      <span key={source.url}>
                        {i > 0 && ", "}
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 underline decoration-gray-700 underline-offset-2 transition hover:text-blue-400"
                        >
                          {source.label}
                        </a>
                      </span>
                    ))}
                    .
                  </p>
                </div>
              </>
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
              {server.github_url ? (
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
              ) : (
                /* No repository we could confirm exists. Showing a dead link
                   would be worse than showing none — say so plainly instead. */
                <span className="inline-flex items-center px-6 py-3 bg-gray-900/60 text-gray-400 text-sm rounded-lg border border-gray-800">
                  No verified public repository
                </span>
              )}
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
