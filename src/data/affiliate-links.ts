/**
 * Affiliate link configuration for MyMCPTools.
 * Contextual CTAs shown on server detail pages based on server category.
 * All links are active / approved programs.
 */

export interface AffiliateCTA {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  url: string;
  program: string;
  commission: string;
  /** Which server categories this CTA is relevant for. Empty = show on all. */
  categories: string[];
  cta: string;
  badge?: string; // e.g. "Free Trial"
}

export const AFFILIATE_CTAS: AffiliateCTA[] = [
  {
    slug: "better-stack",
    name: "Better Stack",
    tagline: "Monitor your MCP server endpoints",
    description: "Get alerted when your APIs, browser tests, payment pipelines, or MCP server dependencies go down. Used by 100K+ developers.",
    url: "https://betterstack.com/?ref=b-gnee&utm_source=mymcptools&utm_medium=affiliate&utm_campaign=sidebar",
    program: "PartnerStack / Better Stack",
    commission: "Revenue share",
    categories: ["api", "devops", "cloud", "database", "coding", "browser", "finance"],
    cta: "Start monitoring free →",
    badge: "Free Plan",
  },
  {
    slug: "1password",
    name: "1Password",
    tagline: "Secure your API keys & secrets",
    description: "Store and inject API keys, payment credentials, tokens, and file access secrets into your MCP server configs. Trusted by 150K+ developers.",
    url: "https://1password.partnerlinks.io/6t8opdyq764m?utm_source=mymcptools&utm_medium=affiliate&utm_campaign=sidebar",
    program: "PartnerStack",
    commission: "25% first year",
    categories: ["security", "coding", "devops", "api", "cloud", "filesystem", "finance"],
    cta: "Try 1Password free →",
    badge: "14-day Free Trial",
  },
  {
    slug: "elevenlabs",
    name: "ElevenLabs",
    tagline: "Add AI voice to your agents",
    description: "The leading voice AI platform. Add lifelike text-to-speech to your Claude agents via the ElevenLabs MCP server.",
    url: "https://try.elevenlabs.io/7j98rr4eeebw?utm_source=mymcptools&utm_medium=affiliate&utm_campaign=sidebar",
    program: "PartnerStack",
    commission: "22% for 12 months",
    categories: ["media", "ai", "communication"],
    cta: "Try ElevenLabs free →",
    badge: "Free Tier",
  },
  {
    slug: "murf-ai",
    name: "Murf AI",
    tagline: "Professional AI voiceovers",
    description: "120+ AI voices in 20+ languages. Perfect for building voice agents and automated audio content pipelines.",
    url: "https://get.murf.ai/kveyd98v1qu6?utm_source=mymcptools&utm_medium=affiliate&utm_campaign=sidebar",
    program: "PartnerStack",
    commission: "20% for 24 months",
    categories: ["media", "ai"],
    cta: "Try Murf free →",
    badge: "Free Plan",
  },
  {
    slug: "semrush",
    name: "Semrush",
    tagline: "SEO & content intelligence",
    description: "Keyword research, competitor analysis, and content optimization for content automation workflows.",
    url: "https://semrush.sjv.io/oNREJo?utm_source=mymcptools&utm_medium=affiliate&utm_campaign=sidebar",
    program: "Impact.com",
    commission: "$200/sale",
    categories: ["marketing", "analytics", "search"],
    cta: "Try Semrush free →",
    badge: "7-day Free Trial",
  },
  {
    slug: "gamma",
    name: "Gamma",
    tagline: "Turn agent output into polished decks",
    description: "AI-native presentation and document builder. Instantly transform your agent's content into shareable slides, docs, or webpages.",
    url: "https://try.gamma.app/iu7k55m0qa0c?utm_source=mymcptools&utm_medium=affiliate&utm_campaign=sidebar",
    program: "PartnerStack",
    commission: "30% first year",
    categories: ["productivity", "ai", "media"],
    cta: "Try Gamma free →",
    badge: "Free Plan",
  },
  {
    slug: "buffer",
    name: "Buffer",
    tagline: "Schedule social posts from your agents",
    description: "Connect Buffer to your MCP workflows and auto-schedule content across LinkedIn, Twitter, Instagram, and more.",
    url: "https://join.buffer.com/shibley-api-status-check?utm_source=mymcptools&utm_medium=affiliate&utm_campaign=sidebar",
    program: "dub.co/Buffer",
    commission: "25% first year",
    categories: ["productivity", "communication", "marketing", "travel"],
    cta: "Try Buffer free →",
    badge: "Free Plan",
  },
  {
    slug: "adcreative",
    name: "AdCreative.ai",
    tagline: "Generate ad creatives at scale",
    description: "AI-powered ad creative generation. Automate branded ad copy and visuals from your MCP agent pipelines.",
    url: "https://free-trial.adcreative.ai/yh4dtwq3dst0?utm_source=mymcptools&utm_medium=affiliate&utm_campaign=sidebar",
    program: "PartnerStack",
    commission: "30% revenue share",
    categories: ["marketing", "media", "gaming"],
    cta: "Try AdCreative.ai free →",
    badge: "Free Trial",
  },
  {
    slug: "activecampaign",
    name: "ActiveCampaign",
    tagline: "Automate email & CRM from your agents",
    description: "Connect your MCP agents to ActiveCampaign's email automation and CRM. Trigger campaigns, update contacts, and personalize outreach at scale.",
    url: "https://try.activecampaign.com/vw1jw6s8z6qi?utm_source=mymcptools&utm_medium=affiliate&utm_campaign=sidebar",
    program: "PartnerStack",
    commission: "30% recurring for 12 months",
    categories: ["communication", "marketing", "productivity"],
    cta: "Try ActiveCampaign free →",
    badge: "14-day Free Trial",
  },
  {
    slug: "consensus",
    name: "Consensus",
    tagline: "AI-powered research over 200M papers",
    description: "Search and synthesize academic research with AI. Perfect for knowledge-retrieval and RAG pipelines.",
    url: "https://get.consensus.app/rjusyyxmi02p?utm_source=mymcptools&utm_medium=affiliate&utm_campaign=sidebar",
    program: "PartnerStack",
    commission: "30% first 12 months",
    categories: ["search", "memory", "analytics", "ai"],
    cta: "Try Consensus free →",
    badge: "Free Plan",
  },
];

/**
 * Get the most relevant affiliate CTA(s) for a server's categories.
 * Returns up to `limit` CTAs, prioritizing category matches.
 */
export function getAffiliateCTAs(serverCategories: string[], limit = 1): AffiliateCTA[] {
  const matched = AFFILIATE_CTAS.filter(
    cta => cta.categories.length === 0 || cta.categories.some(c => serverCategories.includes(c))
  );
  const unmatched = AFFILIATE_CTAS.filter(
    cta => cta.categories.length > 0 && !cta.categories.some(c => serverCategories.includes(c))
  );
  return [...matched, ...unmatched].slice(0, limit);
}
