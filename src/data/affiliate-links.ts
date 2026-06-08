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
    description: "Get alerted when your APIs, services, or MCP server dependencies go down. Used by 100K+ developers.",
    url: "https://betterstack.com/?ref=b-gnee&utm_source=mymcptools&utm_medium=affiliate&utm_campaign=sidebar",
    program: "PartnerStack / Better Stack",
    commission: "Revenue share",
    categories: ["api", "devops", "cloud", "database", "coding"],
    cta: "Start monitoring free →",
    badge: "Free Plan",
  },
  {
    slug: "1password",
    name: "1Password",
    tagline: "Secure your API keys & secrets",
    description: "Store and inject API keys, tokens, and credentials securely into your MCP server configs. Trusted by 150K+ developers.",
    url: "https://1password.partnerlinks.io/6t8opdyq764m?utm_source=mymcptools&utm_medium=affiliate&utm_campaign=sidebar",
    program: "PartnerStack",
    commission: "25% first year",
    categories: ["security", "coding", "devops", "api", "cloud"],
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
