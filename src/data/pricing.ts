// Pricing data for all MCP servers
// Kept separate to avoid bloating the main servers.ts

export type PricingModel = 'free' | 'freemium' | 'paid' | 'open-source';

export interface PricingInfo {
  pricing_model: PricingModel;
  pricing_details: string;
  pricing_url?: string;
}

// Map of server slug -> pricing info
export const pricingData: Record<string, PricingInfo> = {
  // === OFFICIAL REFERENCE SERVERS (all open-source/free) ===
  'everything': {
    pricing_model: 'open-source',
    pricing_details: 'Completely free and open-source reference server by Anthropic. No underlying service costs.',
  },
  'fetch': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source by Anthropic. Fetches web content directly — no API key or paid service required.',
  },
  'filesystem': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source by Anthropic. Operates on your local filesystem with no external dependencies or costs.',
  },
  'git': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source by Anthropic. Works with local Git repositories — no paid service required.',
  },
  'memory': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source by Anthropic. Knowledge graph stored locally — no external service costs.',
  },
  'sequential-thinking': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source by Anthropic. Runs locally with no external API dependencies.',
  },
  'time': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source by Anthropic. Time and timezone conversion with no external costs.',
  },

  // === THIRD-PARTY OFFICIAL SERVERS ===
  '21st-dev-magic': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free. 21st.dev offers a free tier for UI components. Pro plans available for advanced features. See official site for current pricing.',
    pricing_url: 'https://www.21st.dev/pricing',
  },
  'apify': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Apify platform: Free tier with $5/mo platform credits. Starter: $49/mo. Scale: $499/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://apify.com/pricing',
  },
  'github': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. GitHub: Free tier for public repos and limited private repos. Team: $4/user/mo. Enterprise: $21/user/mo.',
    pricing_url: 'https://github.com/pricing',
  },
  'gitlab': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free. GitLab: Free tier with 5 users. Premium: $29/user/mo. Ultimate: $99/user/mo.',
    pricing_url: 'https://about.gitlab.com/pricing/',
  },
  'aws': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. AWS services use pay-as-you-go pricing. Free tier available for many services for 12 months. Costs vary by service usage.',
    pricing_url: 'https://aws.amazon.com/pricing/',
  },
  'cloudflare': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Cloudflare: Generous free tier for Workers, KV, R2, D1. Workers Paid: $5/mo. Pro: $20/mo. Business: $200/mo.',
    pricing_url: 'https://www.cloudflare.com/plans/',
  },
  'browserbase': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Browserbase: Free tier with limited browser sessions. Paid plans for higher volume. See official pricing for current rates.',
    pricing_url: 'https://www.browserbase.com/pricing',
  },
  'firecrawl': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Firecrawl: Free tier with 500 credits. Hobby: $16/mo (3,000 credits). Standard: $83/mo. Growth: $333/mo.',
    pricing_url: 'https://www.firecrawl.dev/pricing',
  },
  'exa': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Exa: Free tier with 1,000 searches/mo. Pro plans available for higher volume. See official pricing.',
    pricing_url: 'https://exa.ai/pricing',
  },
  'brave-search': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Brave Search API: Free tier with 2,000 queries/mo. Paid plans for higher volume starting at $3/1000 queries.',
    pricing_url: 'https://brave.com/search/api/',
  },
  'notion': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Notion: Free for personal use. Plus: $10/user/mo. Business: $18/user/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://www.notion.so/pricing',
  },
  'linear': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free. Linear: Free tier for small teams. Standard: $8/user/mo. Plus: $14/user/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://linear.app/pricing',
  },
  'slack': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Slack: Free tier with limited history. Pro: $8.75/user/mo. Business+: $12.50/user/mo. Enterprise Grid: Custom.',
    pricing_url: 'https://slack.com/pricing',
  },
  'hubspot': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. HubSpot CRM: Free tier available. Starter: $20/mo. Professional: $890/mo. Enterprise: $3,600/mo.',
    pricing_url: 'https://www.hubspot.com/pricing',
  },
  'stripe': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Stripe: Pay-per-transaction pricing at 2.9% + 30¢ per card charge. No monthly fees. Volume discounts available.',
    pricing_url: 'https://stripe.com/pricing',
  },
  'mongodb': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. MongoDB Atlas: Free tier (512MB). Shared: from $9/mo. Dedicated: from $57/mo. Enterprise: Custom.',
    pricing_url: 'https://www.mongodb.com/pricing',
  },
  'postgresql': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source MCP server. PostgreSQL is free and open-source. Hosting costs depend on your infrastructure choice.',
  },
  'sqlite': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source MCP server. SQLite is public domain — completely free with no external service costs.',
  },
  'redis': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Redis Cloud: Free tier (30MB). Essentials: from $7/mo. Pro: Custom pricing. Self-hosted Redis is free.',
    pricing_url: 'https://redis.io/pricing/',
  },
  'supabase': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Supabase: Free tier (500MB, 50K monthly active users). Pro: $25/mo. Team: $599/mo. Enterprise: Custom.',
    pricing_url: 'https://supabase.com/pricing',
  },
  'neon': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Neon: Free tier (0.5 GiB storage). Launch: $19/mo. Scale: $69/mo. Business: $700/mo.',
    pricing_url: 'https://neon.tech/pricing',
  },
  'clickhouse': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. ClickHouse Cloud: Free trial available. Pay-as-you-go pricing. Self-hosted ClickHouse is free and open-source.',
    pricing_url: 'https://clickhouse.com/pricing',
  },
  'neo4j': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Neo4j Aura: Free tier available. Professional: from $65/mo. Enterprise: Custom pricing. Community edition is free.',
    pricing_url: 'https://neo4j.com/pricing/',
  },
  'milvus': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source MCP server. Milvus is open-source. Zilliz Cloud (managed): Free tier available, paid plans for production use.',
    pricing_url: 'https://zilliz.com/pricing',
  },
  'chroma': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source MCP server. Chroma is open-source and free to self-host. Chroma Cloud currently in development.',
  },
  'vercel': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Vercel: Hobby (free). Pro: $20/user/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://vercel.com/pricing',
  },
  'netlify': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Netlify: Free tier (100GB bandwidth). Pro: $19/mo. Business: $99/mo. Enterprise: Custom.',
    pricing_url: 'https://www.netlify.com/pricing/',
  },
  'docker': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Docker Desktop: Free for personal and small business. Pro: $5/mo. Team: $9/user/mo. Business: $24/user/mo.',
    pricing_url: 'https://www.docker.com/pricing/',
  },
  'puppeteer': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source MCP server. Puppeteer is free and open-source by Google. No service costs — runs locally.',
  },
  'playwright': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source MCP server. Playwright is free and open-source by Microsoft. No service costs — runs locally.',
  },
  'sentry': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Sentry: Developer tier (free, 5K errors/mo). Team: $26/mo. Business: $80/mo. Enterprise: Custom.',
    pricing_url: 'https://sentry.io/pricing/',
  },
  'datadog': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Datadog: Free tier (5 hosts). Pro: $15/host/mo. Enterprise: $23/host/mo. Additional products priced separately.',
    pricing_url: 'https://www.datadoghq.com/pricing/',
  },
  'grafana': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Grafana Cloud: Free tier (10K metrics, 50GB logs). Pro: $29/mo. Advanced: $299/mo. Self-hosted is free.',
    pricing_url: 'https://grafana.com/pricing/',
  },
  'axiom': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Axiom: Free tier (500GB ingest/mo). Team: $25/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://axiom.co/pricing',
  },
  'openai': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. OpenAI API: Pay-per-token pricing. GPT-4o: ~$5/1M input tokens. GPT-3.5 Turbo: ~$0.50/1M input tokens. See official pricing.',
    pricing_url: 'https://openai.com/pricing',
  },
  'huggingface': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Hugging Face: Free tier for public models. Pro: $9/mo. Enterprise Hub: Custom pricing. Inference API has free and paid tiers.',
    pricing_url: 'https://huggingface.co/pricing',
  },
  'langfuse': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Langfuse Cloud: Free tier (50K observations/mo). Pro: from $59/mo. Enterprise: Custom. Self-hosted is free.',
    pricing_url: 'https://langfuse.com/pricing',
  },
  'e2b': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. E2B: Free tier with limited sandbox hours. Pro: $45/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://e2b.dev/pricing',
  },
  'figma': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Figma: Free tier (3 projects). Professional: $15/editor/mo. Organization: $45/editor/mo. Enterprise: $75/editor/mo.',
    pricing_url: 'https://www.figma.com/pricing/',
  },
  'twilio': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Twilio: Pay-as-you-go pricing. SMS from $0.0079/msg. Voice from $0.0085/min. Free trial credits available.',
    pricing_url: 'https://www.twilio.com/en-us/pricing',
  },
  'sendgrid': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. SendGrid (by Twilio): Free tier (100 emails/day). Essentials: $19.95/mo. Pro: $89.95/mo. Premier: Custom.',
    pricing_url: 'https://sendgrid.com/en-us/pricing',
  },
  'resend': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Resend: Free tier (3,000 emails/mo, 100/day). Pro: $20/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://resend.com/pricing',
  },
  'google-drive': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Google Drive: 15GB free with Google account. Google One: from $1.99/mo (100GB). Workspace: from $7/user/mo.',
    pricing_url: 'https://one.google.com/about/plans',
  },
  'google-maps': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Google Maps Platform: $200/mo free credit. Pay-as-you-go after that. Geocoding: $5/1000 requests.',
    pricing_url: 'https://mapsplatform.google.com/pricing/',
  },
  'dropbox': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Dropbox: Basic (free, 2GB). Plus: $11.99/mo. Professional: $22/mo. Business: from $15/user/mo.',
    pricing_url: 'https://www.dropbox.com/plans',
  },
  'airtable': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Airtable: Free tier (1,000 records/base). Team: $20/seat/mo. Business: $45/seat/mo. Enterprise: Custom.',
    pricing_url: 'https://airtable.com/pricing',
  },
  'asana': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Asana: Personal (free, up to 10 users). Starter: $10.99/user/mo. Advanced: $24.99/user/mo. Enterprise: Custom.',
    pricing_url: 'https://asana.com/pricing',
  },
  'jira': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Jira: Free tier (up to 10 users). Standard: $8.15/user/mo. Premium: $16/user/mo. Enterprise: Custom.',
    pricing_url: 'https://www.atlassian.com/software/jira/pricing',
  },
  'confluence': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Confluence: Free tier (up to 10 users). Standard: $6.05/user/mo. Premium: $11.55/user/mo. Enterprise: Custom.',
    pricing_url: 'https://www.atlassian.com/software/confluence/pricing',
  },
  'todoist': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Todoist: Free tier (5 projects). Pro: $4/mo. Business: $6/user/mo.',
    pricing_url: 'https://todoist.com/pricing',
  },
  'circleci': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. CircleCI: Free tier (6,000 build minutes/mo). Performance: from $15/mo. Scale: Custom pricing.',
    pricing_url: 'https://circleci.com/pricing/',
  },
  'buildkite': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Buildkite: Free for open-source. Developer: Free. Team: $15/user/mo. Enterprise: Custom.',
    pricing_url: 'https://buildkite.com/pricing',
  },
  'jenkins': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source MCP server. Jenkins is free and open-source. CloudBees (commercial Jenkins) offers paid enterprise support.',
  },
  'kubernetes': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source MCP server. Kubernetes is free and open-source. Cloud-managed K8s (EKS, GKE, AKS) have cluster management fees starting around $0.10/hr.',
  },
  'terraform': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Terraform CLI: Free and open-source. Terraform Cloud: Free tier (up to 500 resources). Team: $20/user/mo. Business: Custom.',
    pricing_url: 'https://www.hashicorp.com/products/terraform/pricing',
  },
  'brightdata': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Bright Data: Pay-as-you-go proxy and scraping. Residential proxies from $8.40/GB. Free trial available.',
    pricing_url: 'https://brightdata.com/pricing',
  },
  'algolia': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Algolia: Free tier (10K search requests/mo). Grow: from $1 per 1K requests. Premium: Custom pricing.',
    pricing_url: 'https://www.algolia.com/pricing/',
  },
  'elasticsearch': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Elasticsearch: Open-source and free to self-host. Elastic Cloud: Free trial, then from $95/mo. Enterprise: Custom.',
    pricing_url: 'https://www.elastic.co/pricing/',
  },
  'meilisearch': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Meilisearch: Free and open-source self-hosted. Cloud: Free tier, Pro from $30/mo.',
    pricing_url: 'https://www.meilisearch.com/pricing',
  },
  'coinbase': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Coinbase: Free to create account. Trading fees vary by volume. Advanced Trade: 0.05%-0.60% maker/taker fees.',
    pricing_url: 'https://www.coinbase.com/advanced-fees',
  },
  'coingecko': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. CoinGecko API: Free tier (30 calls/min). Analyst: $14/mo. Lite: $129/mo. Pro: $499/mo.',
    pricing_url: 'https://www.coingecko.com/en/api/pricing',
  },
  'plaid': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Plaid: Free sandbox environment. Production: Pay-per-connection pricing. Contact sales for rates.',
    pricing_url: 'https://plaid.com/pricing/',
  },
  'shopify': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Shopify: Basic: $39/mo. Shopify: $105/mo. Advanced: $399/mo. Plus: from $2,300/mo. 3-day free trial.',
    pricing_url: 'https://www.shopify.com/pricing',
  },
  'youtube': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. YouTube Data API: Free quota (10,000 units/day). Additional quota available through Google Cloud billing.',
    pricing_url: 'https://developers.google.com/youtube/v3/getting-started',
  },
  'spotify': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Spotify Web API: Free to use with rate limits. Spotify Premium not required for API access.',
    pricing_url: 'https://developer.spotify.com/',
  },
  'cloudinary': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Cloudinary: Free tier (25 credits/mo). Plus: $89/mo. Advanced: $224/mo. Enterprise: Custom.',
    pricing_url: 'https://cloudinary.com/pricing',
  },
  'elevenlabs': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. ElevenLabs: Free tier (10K characters/mo). Starter: $5/mo. Creator: $22/mo. Pro: $99/mo. Scale: $330/mo.',
    pricing_url: 'https://elevenlabs.io/pricing',
  },
  'discord': {
    pricing_model: 'free',
    pricing_details: 'The MCP server is free and open-source. Discord: Free to use. Discord Bot API is free. Nitro subscription optional for enhanced user features.',
  },
  'telegram': {
    pricing_model: 'free',
    pricing_details: 'The MCP server is free and open-source. Telegram: Free to use. Bot API is completely free with no rate limits on most methods.',
  },
  'whatsapp': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. WhatsApp Business API: Per-conversation pricing varies by country. First 1,000 conversations/mo free. Business verification required.',
    pricing_url: 'https://developers.facebook.com/docs/whatsapp/pricing/',
  },
  'cal-com': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Cal.com: Free tier (self-hosted). Cloud: Free for individuals. Team: $15/user/mo. Enterprise: Custom.',
    pricing_url: 'https://cal.com/pricing',
  },
  'calendly': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Calendly: Free tier (1 event type). Standard: $12/seat/mo. Teams: $20/seat/mo. Enterprise: Custom.',
    pricing_url: 'https://calendly.com/pricing',
  },
  'obsidian': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Obsidian: Free for personal use. Commercial license: $50/user/year. Sync: $5/mo. Publish: $10/mo.',
    pricing_url: 'https://obsidian.md/pricing',
  },
  'roam': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Roam Research: Pro: $15/mo or $165/year. Believer: $500 for 5 years.',
    pricing_url: 'https://roamresearch.com/#/app/help/page/Bm9C7YMeV',
  },
  'snyk': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Snyk: Free tier (200 open-source tests/mo). Team: $25/dev/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://snyk.io/plans/',
  },
  'sonarqube': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. SonarQube: Community Edition (free, open-source). Developer: from $150/year. Enterprise: from $20K/year. Data Center: Custom.',
    pricing_url: 'https://www.sonarsource.com/plans-and-pricing/',
  },
  'crowdstrike': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. CrowdStrike Falcon: Enterprise pricing — contact sales. Falcon Go for small business from $299.95/yr for 5 devices.',
    pricing_url: 'https://www.crowdstrike.com/platform/pricing/',
  },
  'auth0': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Auth0: Free tier (7,500 active users). Essentials: from $35/mo. Professional: from $240/mo. Enterprise: Custom.',
    pricing_url: 'https://auth0.com/pricing',
  },
  'aws-bedrock': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. AWS Bedrock: Pay-per-token pricing. Varies by model — Claude, Llama, etc. On-demand and provisioned throughput available.',
    pricing_url: 'https://aws.amazon.com/bedrock/pricing/',
  },
  'azure': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Azure: Free tier with $200 credit for 30 days. 55+ always-free services. Pay-as-you-go after free tier.',
    pricing_url: 'https://azure.microsoft.com/en-us/pricing/',
  },
  'gcp': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Google Cloud: $300 free credit for 90 days. Always-free tier for many services. Pay-as-you-go pricing.',
    pricing_url: 'https://cloud.google.com/pricing',
  },
  'firebase': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Firebase: Spark plan (free). Blaze plan: pay-as-you-go with generous free quotas.',
    pricing_url: 'https://firebase.google.com/pricing',
  },
  'heroku': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Heroku: Mini dyno: $5/mo. Basic: $7/mo. Standard: $25/mo. Performance: $250/mo. Student plan available.',
    pricing_url: 'https://www.heroku.com/pricing',
  },
  'digitalocean': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. DigitalOcean: Droplets from $4/mo. App Platform from $5/mo. Managed databases from $15/mo. $200 free credit for new accounts.',
    pricing_url: 'https://www.digitalocean.com/pricing',
  },
  'datadog-rum': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Datadog RUM: From $1.50/1K sessions/mo. Session Replay: additional $1.80/1K sessions. 14-day free trial.',
    pricing_url: 'https://www.datadoghq.com/pricing/?product=real-user-monitoring',
  },
  'mixpanel': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Mixpanel: Free tier (20M events/mo). Growth: from $28/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://mixpanel.com/pricing/',
  },
  'amplitude': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Amplitude: Starter (free). Plus: from $49/mo. Growth: Custom pricing. Enterprise: Custom.',
    pricing_url: 'https://amplitude.com/pricing',
  },
  'posthog': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. PostHog: Free tier (1M events/mo). Pay-as-you-go after. Self-hosted is free and open-source.',
    pricing_url: 'https://posthog.com/pricing',
  },
  'segment': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Segment: Free tier (1,000 visitors/mo). Team: from $120/mo. Business: Custom pricing.',
    pricing_url: 'https://segment.com/pricing/',
  },
  'zapier': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Zapier: Free tier (100 tasks/mo). Starter: $29.99/mo. Professional: $73.50/mo. Team: $103.50/mo.',
    pricing_url: 'https://zapier.com/pricing',
  },
  'make': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Make (formerly Integromat): Free tier (1,000 ops/mo). Core: $10.59/mo. Pro: $18.82/mo. Teams: $34.12/mo.',
    pricing_url: 'https://www.make.com/en/pricing',
  },
  'n8n': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. n8n: Free and open-source (self-hosted). Cloud Starter: $24/mo. Pro: $60/mo. Enterprise: Custom.',
    pricing_url: 'https://n8n.io/pricing/',
  },
  'retool': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Retool: Free tier (5 users). Team: $10/user/mo. Business: $50/user/mo. Enterprise: Custom.',
    pricing_url: 'https://retool.com/pricing',
  },
  'snowflake': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Snowflake: Usage-based pricing. Compute from $2/credit. Storage from $23/TB/mo. $400 free trial credit.',
    pricing_url: 'https://www.snowflake.com/en/data-cloud/pricing/',
  },
  'databricks': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Databricks: Usage-based pricing varies by cloud provider. Community Edition is free. Enterprise: Contact sales.',
    pricing_url: 'https://www.databricks.com/product/pricing',
  },
  'bigquery': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. BigQuery: Free tier (1TB queries/mo, 10GB storage). On-demand: $6.25/TB queried. Flat-rate options available.',
    pricing_url: 'https://cloud.google.com/bigquery/pricing',
  },
  'duckdb': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source MCP server. DuckDB is free, open-source, and runs locally. No external service costs.',
  },
  'pinecone': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Pinecone: Free tier (100K vectors). Standard: from $70/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://www.pinecone.io/pricing/',
  },
  'weaviate': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Weaviate: Open-source (self-hosted free). Cloud Sandbox: Free. Serverless: from $25/mo. Enterprise: Custom.',
    pricing_url: 'https://weaviate.io/pricing',
  },
  'qdrant': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Qdrant: Open-source (self-hosted free). Cloud: Free tier (1GB). From $25/mo for higher tiers.',
    pricing_url: 'https://qdrant.tech/pricing/',
  },
  'astra-db': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Astra DB (DataStax): Free tier (80GB, 40M read/write). Pay-as-you-go after. Enterprise: Custom.',
    pricing_url: 'https://www.datastax.com/products/datastax-astra/pricing',
  },
  'planetscale': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. PlanetScale: Scaler Pro from $39/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://planetscale.com/pricing',
  },
  'turso': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Turso: Starter (free, 500 databases, 9GB). Scaler: $29/mo. Enterprise: Custom.',
    pricing_url: 'https://turso.tech/pricing',
  },
  'upstash': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Upstash: Free tier (10K commands/day). Pay-as-you-go: from $0.2/100K commands. Pro: from $10/mo.',
    pricing_url: 'https://upstash.com/pricing',
  },
  'convex': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Convex: Free tier (generous limits). Pro: $25/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://www.convex.dev/pricing',
  },
  'pagerduty': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. PagerDuty: Free tier (up to 5 users). Professional: $21/user/mo. Business: $41/user/mo. Enterprise: Custom.',
    pricing_url: 'https://www.pagerduty.com/pricing/',
  },
  'opsgenie': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Opsgenie: Free tier (5 users). Essentials: $9/user/mo. Standard: $19/user/mo. Enterprise: $29/user/mo.',
    pricing_url: 'https://www.atlassian.com/software/opsgenie/pricing',
  },
  'newrelic': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. New Relic: Free tier (100GB data/mo). Standard: $0.30/GB. Pro: $0.50/GB. Enterprise: Custom. One full user free.',
    pricing_url: 'https://newrelic.com/pricing',
  },
  'dynatrace': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Dynatrace: Full-stack monitoring from $0.08/hr per host. 15-day free trial. Enterprise: Custom pricing.',
    pricing_url: 'https://www.dynatrace.com/pricing/',
  },
  'honeycomb': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Honeycomb: Free tier (20M events/mo). Pro: usage-based pricing. Enterprise: Custom.',
    pricing_url: 'https://www.honeycomb.io/pricing',
  },
  'lightstep': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Lightstep (now ServiceNow Cloud Observability): Free tier available. Paid plans from $10/user/mo.',
    pricing_url: 'https://www.servicenow.com/products/observability.html',
  },
  'launchdarkly': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. LaunchDarkly: Foundation: free. Pro: from $12/seat/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://launchdarkly.com/pricing/',
  },
  'split': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Split (now Harness Feature Flags): Free tier available. Team: from $33/mo. Enterprise: Custom.',
    pricing_url: 'https://www.harness.io/pricing?module=ff',
  },
  'flagsmith': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Flagsmith: Free tier (50K requests/mo). Startup: $45/mo. Scale-up: $200/mo. Enterprise: Custom. Open-source self-hosted option.',
    pricing_url: 'https://flagsmith.com/pricing/',
  },
  'intercom': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Intercom: Essential: $39/seat/mo. Advanced: $99/seat/mo. Expert: $139/seat/mo. 14-day free trial.',
    pricing_url: 'https://www.intercom.com/pricing',
  },
  'zendesk': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Zendesk: Suite Team: $55/agent/mo. Suite Growth: $89/agent/mo. Suite Professional: $115/agent/mo. Enterprise: Custom.',
    pricing_url: 'https://www.zendesk.com/pricing/',
  },
  'freshdesk': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Freshdesk: Free tier (up to 2 agents). Growth: $15/agent/mo. Pro: $49/agent/mo. Enterprise: $79/agent/mo.',
    pricing_url: 'https://www.freshworks.com/freshdesk/pricing/',
  },
  'salesforce': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Salesforce: Starter: $25/user/mo. Professional: $80/user/mo. Enterprise: $165/user/mo. Unlimited: $330/user/mo.',
    pricing_url: 'https://www.salesforce.com/editions-pricing/overview/',
  },
  'pipedrive': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Pipedrive: Essential: $14/user/mo. Advanced: $29/user/mo. Professional: $59/user/mo. Enterprise: $79/user/mo. 14-day trial.',
    pricing_url: 'https://www.pipedrive.com/en/pricing',
  },
  'close': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Close CRM: Startup: $49/user/mo. Professional: $99/user/mo. Enterprise: $139/user/mo. 14-day free trial.',
    pricing_url: 'https://www.close.com/pricing',
  },
  'monday': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Monday.com: Free tier (up to 2 seats). Basic: $12/seat/mo. Standard: $14/seat/mo. Pro: $24/seat/mo. Enterprise: Custom.',
    pricing_url: 'https://monday.com/pricing/',
  },
  'clickup': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. ClickUp: Free tier available. Unlimited: $7/member/mo. Business: $12/member/mo. Enterprise: Custom.',
    pricing_url: 'https://clickup.com/pricing',
  },
  'wrike': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Wrike: Free tier available. Team: $10/user/mo. Business: $24.80/user/mo. Enterprise: Custom. Pinnacle: Custom.',
    pricing_url: 'https://www.wrike.com/price/',
  },
  'basecamp': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Basecamp: $15/user/mo. Pro Unlimited: $349/mo flat (unlimited users). Free for students and teachers.',
    pricing_url: 'https://basecamp.com/pricing',
  },
  'trello': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Trello: Free tier (unlimited boards, 10 boards per workspace). Standard: $5/user/mo. Premium: $10/user/mo. Enterprise: $17.50/user/mo.',
    pricing_url: 'https://trello.com/pricing',
  },
  'coda': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Coda: Free tier. Pro: $10/doc maker/mo. Team: $30/doc maker/mo. Enterprise: Custom.',
    pricing_url: 'https://coda.io/pricing',
  },
  'fibery': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Fibery: Free tier (up to 5 users). Pro: $10/user/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://fibery.io/pricing',
  },
  'twitter': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. X (Twitter) API: Free tier (limited). Basic: $100/mo. Pro: $5,000/mo. Enterprise: Custom.',
    pricing_url: 'https://developer.x.com/en/portal/products',
  },
  'reddit': {
    pricing_model: 'free',
    pricing_details: 'The MCP server is free and open-source. Reddit API: Free for non-commercial use with rate limits. Commercial use requires a paid plan.',
  },
  'hackernews': {
    pricing_model: 'free',
    pricing_details: 'The MCP server is free and open-source. Hacker News API: Completely free with no authentication required.',
  },
  'producthunt': {
    pricing_model: 'free',
    pricing_details: 'The MCP server is free and open-source. Product Hunt API: Free to use.',
  },
  'arxiv': {
    pricing_model: 'free',
    pricing_details: 'The MCP server is free and open-source. arXiv API: Completely free. Open access to scientific papers.',
  },
  'semantic-scholar': {
    pricing_model: 'free',
    pricing_details: 'The MCP server is free and open-source. Semantic Scholar API: Free to use with rate limits. No paid tiers.',
  },
  'wolfram-alpha': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Wolfram Alpha API: Free tier (2,000 queries/mo). Standard: $25/mo (100K queries). Pro: from $5/mo for personal use.',
    pricing_url: 'https://products.wolframalpha.com/api',
  },
  'weather': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source MCP server for weather data via the National Weather Service API (free, no API key required).',
  },
  'stock-data': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Stock data API costs vary by provider. Many offer free tiers with delayed data.',
  },
  'alpha-vantage': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Alpha Vantage: Free tier (25 API calls/day). Premium: from $49.99/mo for higher limits and more endpoints.',
    pricing_url: 'https://www.alphavantage.co/premium/',
  },
  'image-generation': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source MCP server. Image generation costs depend on the underlying model/API used.',
  },
  'replicate': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Replicate: Pay-per-prediction. Pricing varies by model. Most models: $0.0001–$0.05 per prediction. Free tier with some credits.',
    pricing_url: 'https://replicate.com/pricing',
  },
  'stability-ai': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Stability AI: Free tier with limited credits. Creator: $9.99/mo. Enterprise: Custom. Open-source models available for self-hosting.',
    pricing_url: 'https://platform.stability.ai/pricing',
  },
  'anthropic-claude': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Anthropic API: Pay-per-token. Claude Sonnet: ~$3/1M input, $15/1M output tokens. Claude Opus: ~$15/1M input, $75/1M output.',
    pricing_url: 'https://www.anthropic.com/pricing',
  },
  'cohere': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Cohere: Free trial tier. Production: Pay-per-token. Command: from $1/1M tokens. Enterprise: Custom pricing.',
    pricing_url: 'https://cohere.com/pricing',
  },
  'mistral': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Mistral AI: Free tier available. API: Pay-per-token from $0.04/1M tokens. Enterprise: Custom. Open-source models available.',
    pricing_url: 'https://mistral.ai/products#pricing',
  },
  'perplexity': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Perplexity: Free tier (limited queries). Pro: $20/mo. API: Pay-per-query from $0.005/query.',
    pricing_url: 'https://www.perplexity.ai/pro',
  },
  'tavily': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Tavily: Free tier (1,000 API credits/mo). Starter: $40/mo. Growth: $150/mo. Enterprise: Custom.',
    pricing_url: 'https://tavily.com/#pricing',
  },
  'serper': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Serper: Free tier (2,500 queries/mo). Developer: $50/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://serper.dev/pricing',
  },
  'you-com': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. You.com: Free tier available. Pro: $15/mo. API: Pay-per-query pricing. Enterprise: Custom.',
    pricing_url: 'https://you.com/plans',
  },
  'kagi': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Kagi Search: Starter: $5/mo (300 searches). Professional: $10/mo (unlimited). Ultimate: $25/mo.',
    pricing_url: 'https://kagi.com/pricing',
  },
  'browserless': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Browserless: Free tier (limited usage). Scale: from $50/mo. Enterprise: Custom. Open-source self-hosting available.',
    pricing_url: 'https://www.browserless.io/pricing',
  },
  'scrapingbee': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. ScrapingBee: Free trial (1,000 credits). Freelance: $49/mo. Startup: $99/mo. Business: $249/mo.',
    pricing_url: 'https://www.scrapingbee.com/#pricing',
  },
  'crawlee': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source MCP server. Crawlee is free and open-source by Apify. No service costs for self-hosted usage.',
  },
  'oxylabs': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Oxylabs: Residential proxies from $8/GB. Datacenter proxies from $1.20/IP. Web Scraper API from $49/mo.',
    pricing_url: 'https://oxylabs.io/pricing',
  },
  'agentql': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. AgentQL: Free tier available with limited usage. Paid plans for production use. See official pricing.',
    pricing_url: 'https://www.agentql.com/pricing',
  },
  'hyperbrowser': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Hyperbrowser: Free tier with limited sessions. Paid plans for higher volume. See official pricing.',
    pricing_url: 'https://www.hyperbrowser.ai/pricing',
  },
  'daytona': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Daytona: Open-source and free for self-hosting. Cloud: Free tier available. Paid plans for teams.',
    pricing_url: 'https://www.daytona.io/pricing',
  },
  'replit': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Replit: Free tier. Replit Core: $25/mo. Teams: from $15/user/mo.',
    pricing_url: 'https://replit.com/pricing',
  },
  'codespaces': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. GitHub Codespaces: Free tier (120 core-hours/mo). Pay-as-you-go: from $0.18/hr for 2-core. Included in some GitHub plans.',
    pricing_url: 'https://github.com/features/codespaces',
  },
  'gitpod': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Gitpod: Free tier (50 hours/mo). Personal: $9/mo. Professional: $25/mo. Organization: Custom.',
    pricing_url: 'https://www.gitpod.io/pricing',
  },
  'stackblitz': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. StackBlitz: Free for public projects. Personal: $9/mo. Teams: from $19/user/mo.',
    pricing_url: 'https://stackblitz.com/pricing',
  },
  'codesandbox': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. CodeSandbox: Free tier. Pro: $9/user/mo. Team Pro: $15/user/mo. Organization: Custom.',
    pricing_url: 'https://codesandbox.io/pricing',
  },
  'codeium': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Codeium (Windsurf): Free tier for individual developers. Teams: $15/user/mo. Enterprise: Custom.',
    pricing_url: 'https://codeium.com/pricing',
  },
  'tabnine': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Tabnine: Starter (free). Dev: $9/user/mo. Enterprise: Custom. Self-hosted options available.',
    pricing_url: 'https://www.tabnine.com/pricing/',
  },
  'sourcegraph': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Sourcegraph: Free for public code. Cody Pro: $9/user/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://sourcegraph.com/pricing',
  },
  'semgrep': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Semgrep: Free and open-source for CLI. Semgrep Cloud: Free tier. Team: from $40/contributor/mo. Enterprise: Custom.',
    pricing_url: 'https://semgrep.dev/pricing',
  },
  'coderabbit': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. CodeRabbit: Free for open-source. Pro: $15/user/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://coderabbit.ai/pricing',
  },
  'codacy': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Codacy: Free for open-source. Pro: from $15/user/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://www.codacy.com/pricing',
  },
  'qodana': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Qodana (JetBrains): Community Edition (free). Ultimate: included with JetBrains All Products Pack ($289/yr). Enterprise: Custom.',
    pricing_url: 'https://www.jetbrains.com/qodana/buy/',
  },
  'deepl': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. DeepL: Free tier (500K characters/mo). Pro: $5.49/mo + usage. API Business: Custom pricing.',
    pricing_url: 'https://www.deepl.com/en/pro#developer',
  },
  'box': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Box: Individual (free, 10GB). Personal Pro: $14/mo. Business: from $20/user/mo. Enterprise: Custom.',
    pricing_url: 'https://www.box.com/pricing',
  },
  'graphlit': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Graphlit: Free tier available. Paid plans for production use. See official pricing.',
    pricing_url: 'https://graphlit.com/pricing',
  },
  'needle': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Needle: Free tier available. Paid plans for teams and production use. See official pricing.',
  },
  'inkeep': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Inkeep: Starter plan available. Growth and Enterprise tiers for higher usage. See official pricing.',
    pricing_url: 'https://inkeep.com/pricing',
  },
  'composio': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Composio: Free tier. Pro: from $29/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://composio.dev/pricing',
  },
  'nango': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Nango: Free tier. Scale: from $200/mo. Enterprise: Custom. Open-source self-hosted option.',
    pricing_url: 'https://www.nango.dev/pricing',
  },
  'integration-app': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Integration.app: Free tier. Growth: from $249/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://integration.app/pricing',
  },
  'arize-phoenix': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Arize Phoenix: Open-source and free for self-hosting. Arize Cloud: Free tier. Paid plans for production.',
    pricing_url: 'https://arize.com/pricing/',
  },
  'comet-opik': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Comet Opik: Free tier. Pro: from $39/mo. Enterprise: Custom pricing. Open-source self-hosted option.',
    pricing_url: 'https://www.comet.com/pricing',
  },
  'logfire': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Pydantic Logfire: Free tier available. Pro and Enterprise tiers for higher usage. See official pricing.',
    pricing_url: 'https://pydantic.dev/logfire',
  },
  'customer-io': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Customer.io: Essentials: from $100/mo. Premium: from $1,000/mo. Enterprise: Custom. 14-day free trial.',
    pricing_url: 'https://customer.io/pricing/',
  },
  'courier': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Courier: Free tier (10K notifications/mo). Business: from $500/mo. Enterprise: Custom.',
    pricing_url: 'https://www.courier.com/pricing/',
  },
  'knock': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Knock: Free tier (10K messages/mo). Business: from $250/mo. Enterprise: Custom.',
    pricing_url: 'https://knock.app/pricing',
  },
  'glean': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Glean: Enterprise pricing — contact sales for a quote. No public pricing tiers.',
    pricing_url: 'https://www.glean.com/',
  },
  'descript': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Descript: Free tier (1 hr transcription). Hobbyist: $8/mo. Creator: $24/mo. Business: $33/mo. Enterprise: Custom.',
    pricing_url: 'https://www.descript.com/pricing',
  },
  'cartesia': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Cartesia: Free tier with limited usage. Paid plans for production voice AI. See official pricing.',
    pricing_url: 'https://cartesia.ai/pricing',
  },
  'gyazo': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Gyazo: Free tier (limited history). Gyazo Pro: $4.99/mo. Teams: from $5/user/mo.',
    pricing_url: 'https://gyazo.com/pricing',
  },
  'canva': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Canva: Free tier. Pro: $12.99/mo. Teams: $14.99/user/mo. Enterprise: Custom.',
    pricing_url: 'https://www.canva.com/pricing/',
  },
  'appium': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source MCP server. Appium is free and open-source. No service costs — runs locally for mobile testing.',
  },
  'browserstack': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. BrowserStack: Live: from $29/mo. Automate: from $129/mo. App testing: from $199/mo. Enterprise: Custom.',
    pricing_url: 'https://www.browserstack.com/pricing',
  },
  'lambdatest': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. LambdaTest: Free tier (limited). Live: from $15/mo. Automation: from $45/mo. Enterprise: Custom.',
    pricing_url: 'https://www.lambdatest.com/pricing',
  },
  'burp-suite': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Burp Suite: Community Edition (free). Professional: $449/user/year. Enterprise: from $6,995/year.',
    pricing_url: 'https://portswigger.net/burp/pro',
  },
  'cycode': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Cycode: Enterprise pricing — contact sales. Free trial available for complete ASPM platform.',
    pricing_url: 'https://cycode.com/pricing/',
  },
  'gitguardian': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. GitGuardian: Free for individual developers. Teams: from $50/dev/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://www.gitguardian.com/pricing',
  },
  'endor-labs': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Endor Labs: Free tier for open-source. Teams and Enterprise plans available. Contact sales for pricing.',
    pricing_url: 'https://www.endorlabs.com/pricing',
  },
  'boostsecurity': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. BoostSecurity: Enterprise pricing — contact sales for a quote.',
    pricing_url: 'https://www.boostsecurity.io/',
  },
  'label-studio': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Label Studio: Open-source (free, self-hosted). Enterprise: Custom pricing for managed hosting and advanced features.',
    pricing_url: 'https://humansignal.com/pricing/',
  },
  'defang': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Defang: Free tier for development. Paid plans for production deployments. See official pricing.',
    pricing_url: 'https://defang.io/pricing',
  },
  'aiven': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Aiven: Free tier for select services. Hobbyist from $19/mo. Business from $99/mo. Enterprise: Custom.',
    pricing_url: 'https://aiven.io/pricing',
  },
  'apache-doris': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source MCP server. Apache Doris is free and open-source. SelectDB Cloud (managed) offers paid plans.',
  },
  'greptimedb': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. GreptimeDB: Open-source (free, self-hosted). GreptimeCloud: Free tier available. Paid plans for production.',
    pricing_url: 'https://greptime.com/pricing',
  },
  'harper': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source MCP server. HarperDB offers a free tier and paid cloud plans. Self-hosted is free.',
    pricing_url: 'https://www.harperdb.io/pricing',
  },
  'keboola': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Keboola: Professional: from $850/mo. Enterprise: Custom pricing. Free trial available.',
    pricing_url: 'https://www.keboola.com/pricing',
  },
  'momento': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Momento: Free tier (5GB transfer/mo). Pay-as-you-go after free tier. See official pricing.',
    pricing_url: 'https://www.gomomento.com/pricing',
  },
  'fireproof': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source MCP server. Fireproof is an open-source database. Free to use and self-host.',
  },
  'nile': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Nile: Free tier available. Scale and Enterprise tiers for production use. See official pricing.',
    pricing_url: 'https://www.thenile.dev/pricing',
  },
  'dolt': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source MCP server. Dolt is free and open-source (Git for data). DoltHub offers free and paid plans for hosted databases.',
    pricing_url: 'https://www.dolthub.com/pricing',
  },
  'mariadb': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. MariaDB: Community Server (free, open-source). SkySQL (cloud): pay-as-you-go from $39/mo. Enterprise: Custom.',
    pricing_url: 'https://mariadb.com/pricing/',
  },
  'couchbase': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Couchbase: Community Edition (free). Capella Cloud: Free tier available. Enterprise: Contact sales.',
    pricing_url: 'https://www.couchbase.com/pricing/',
  },
  'falkordb': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. FalkorDB: Open-source (free, self-hosted). Cloud: Free tier available. Pro and Enterprise plans.',
    pricing_url: 'https://www.falkordb.com/pricing/',
  },
  'memgraph': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Memgraph: Community (free, in-memory). Enterprise: Custom pricing. Cloud: Managed hosting available.',
    pricing_url: 'https://memgraph.com/pricing',
  },
  'kuzu': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source MCP server. Kùzu is free and open-source. Embeddable graph database with no service costs.',
  },
  'gremlin': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Gremlin: Enterprise pricing — contact sales. Free tier for limited chaos engineering. 30-day free trial.',
    pricing_url: 'https://www.gremlin.com/pricing/',
  },
  'bitrise': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Bitrise: Hobby (free). Starter: $75/mo. Growing: $150/mo. Enterprise: Custom.',
    pricing_url: 'https://bitrise.io/pricing',
  },
  'cloudbees': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. CloudBees: Enterprise pricing — contact sales for CI/CD platform pricing.',
    pricing_url: 'https://www.cloudbees.com/',
  },
  'deployhq': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. DeployHQ: Free tier (1 project). Basic: $10/mo. Plus: $20/mo. Premium: $40/mo.',
    pricing_url: 'https://www.deployhq.com/pricing',
  },
  'jfrog': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. JFrog: Free tier. Team: from $150/mo. Enterprise: Custom pricing. Cloud and self-hosted options.',
    pricing_url: 'https://jfrog.com/pricing/',
  },
  'netdata': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Netdata: Free and open-source (self-hosted, unlimited nodes). Netdata Cloud: Free tier. Business: from $0.99/node/mo.',
    pricing_url: 'https://www.netdata.cloud/pricing/',
  },
  'last9': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Last9: Free tier available. Pay-as-you-go and Enterprise tiers. See official pricing.',
    pricing_url: 'https://last9.io/pricing/',
  },
  'metoro': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Metoro: Free tier available. Paid plans for production observability. See official pricing.',
    pricing_url: 'https://metoro.io/pricing',
  },
  'microsoft-clarity': {
    pricing_model: 'free',
    pricing_details: 'The MCP server is free and open-source. Microsoft Clarity: Completely free web analytics and heatmaps. No paid tiers — free forever.',
    pricing_url: 'https://clarity.microsoft.com/',
  },
  'globalping': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Globalping: Free tier (100 credits/hr). Pro: Custom pricing for higher volume.',
    pricing_url: 'https://www.jsdelivr.com/globalping',
  },
  'homeassistant': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source MCP server. Home Assistant is free and open-source. Nabu Casa (cloud): $6.50/mo for remote access and voice control.',
    pricing_url: 'https://www.home-assistant.io/cloud/',
  },
  'hue': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Philips Hue: Free app and API. Requires Hue Bridge (~$60 one-time) and Hue-compatible smart lights.',
  },
  'aqara': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Aqara: Free app and cloud. Requires Aqara hub and smart home devices (sold separately).',
  },
  'baidu-map': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Baidu Maps API: Free tier with quotas. Paid plans for commercial/higher-volume use.',
  },
  'mapbox': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Mapbox: Free tier (50K map loads/mo, 100K geocoding requests). Pay-as-you-go after free tier.',
    pricing_url: 'https://www.mapbox.com/pricing',
  },
  'builtwith': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. BuiltWith: Free basic lookups. Pro: $295/mo. Team: $495/mo. Enterprise: Custom.',
    pricing_url: 'https://builtwith.com/plans',
  },
  'hunter': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Hunter.io: Free tier (25 searches/mo). Starter: $49/mo. Growth: $149/mo. Business: $499/mo.',
    pricing_url: 'https://hunter.io/pricing',
  },
  'mercado-libre': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Mercado Libre API: Free to use. Seller fees apply per transaction on the marketplace.',
  },
  'audiense': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Audiense: Audience Intelligence from $696/mo. Twitter Marketing: Custom. Enterprise: Custom pricing.',
    pricing_url: 'https://audiense.com/pricing',
  },
  'atlan': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Atlan: Enterprise pricing — contact sales for data catalog and governance platform pricing.',
    pricing_url: 'https://atlan.com/',
  },
  'datahub': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. DataHub: Open-source (free, self-hosted). Acryl Cloud (managed): Paid plans available. See pricing.',
    pricing_url: 'https://www.acryldata.io/pricing',
  },
  'alation': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Alation: Enterprise pricing — contact sales for data intelligence platform pricing.',
    pricing_url: 'https://www.alation.com/',
  },
  'apollo-graph': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Apollo GraphQL: Free tier. Dedicated: from $3,300/yr. Enterprise: Custom. Open-source libraries available.',
    pricing_url: 'https://www.apollographql.com/pricing',
  },
  'grafbase': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Grafbase: Free tier. Pro: from $29/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://grafbase.com/pricing',
  },
  'devexpress': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. DevExpress: Universal: $1,799/yr. DXperience: from $999/yr. Individual component suites available. Free trial.',
    pricing_url: 'https://www.devexpress.com/buy/',
  },
  'microsoft-learn': {
    pricing_model: 'free',
    pricing_details: 'The MCP server is free and open-source. Microsoft Learn: Completely free learning platform and documentation.',
  },
  'homebrew': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source MCP server. Homebrew is free and open-source. No service costs — runs locally on macOS/Linux.',
  },
  'gitkraken': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. GitKraken: Free for public repos. Pro: $4.95/user/mo. Teams: $8.95/user/mo. Enterprise: Custom.',
    pricing_url: 'https://www.gitkraken.com/pricing',
  },
  'jetbrains': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. JetBrains: Individual IDEs from $149/yr. All Products Pack: $289/yr. Community editions are free.',
    pricing_url: 'https://www.jetbrains.com/store/',
  },
  'chrome-devtools': {
    pricing_model: 'free',
    pricing_details: 'The MCP server is free and open-source. Chrome DevTools: Free, built into Google Chrome browser.',
  },
  'kiln': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Kiln: Free tier available. Pro and Enterprise plans for teams. See official pricing.',
  },
  'line': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. LINE Messaging API: Free tier (500 messages/mo). Light: from $5/mo. Standard: from $15/mo.',
    pricing_url: 'https://developers.line.biz/en/services/messaging-api/',
  },
  'infobip': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Infobip: Pay-per-message pricing. SMS, WhatsApp, email — rates vary by channel and region. Free trial available.',
    pricing_url: 'https://www.infobip.com/pricing',
  },
  'clicksend': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. ClickSend: SMS from $0.0236/msg. Email: $0.0069/email. Voice: from $0.013/msg. Free trial credits.',
    pricing_url: 'https://www.clicksend.com/pricing/',
  },
  'mailgun': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Mailgun: Free tier (100 emails/day for 3 months). Foundation: $35/mo. Scale: $90/mo. Enterprise: Custom.',
    pricing_url: 'https://www.mailgun.com/pricing/',
  },
  'mailjet': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Mailjet: Free tier (6,000 emails/mo). Essential: from $17/mo. Premium: from $27/mo. Enterprise: Custom.',
    pricing_url: 'https://www.mailjet.com/pricing/',
  },
  'elastic-email': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Elastic Email: Free tier (100 emails/day). Starter: $11/mo. Pro: $30/mo. Enterprise: Custom.',
    pricing_url: 'https://elasticemail.com/pricing',
  },
  'alpaca': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Alpaca: Commission-free stock trading. Market data: Free tier available. Broker API: Custom pricing.',
    pricing_url: 'https://alpaca.markets/pricing',
  },
  'coinex': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. CoinEx: Free to create account. Trading fees: 0.2% maker/taker (discounts with CET token).',
    pricing_url: 'https://www.coinex.com/fees',
  },
  'coinstats': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. CoinStats: Free tier. Pro: $9.99/mo. Premium: $24.99/mo.',
    pricing_url: 'https://coinstats.app/pricing',
  },
  'cashfree': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Cashfree: Transaction-based pricing. Payment Gateway: ~2% per transaction. Payouts: from ₹5 per transaction.',
    pricing_url: 'https://www.cashfree.com/pricing',
  },
  'flutterwave': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Flutterwave: Transaction-based pricing. Local payments: 1.4%. International: 3.8%. No monthly fees.',
    pricing_url: 'https://flutterwave.com/gb/pricing',
  },
  'chargebee': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Chargebee: Starter (free up to $250K revenue). Performance: from $599/mo. Enterprise: Custom.',
    pricing_url: 'https://www.chargebee.com/pricing/',
  },
  'boldsign': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. BoldSign: Free tier (limited). Essentials: $10/user/mo. Professional: $20/user/mo. Business: Custom.',
    pricing_url: 'https://boldsign.com/pricing/',
  },
  'esignatures': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. eSignatures.io: Free tier with limited documents. Pro: from $12/mo. Business: from $25/mo.',
    pricing_url: 'https://esignatures.io/pricing',
  },
  'nutrient': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Nutrient (formerly PSPDFKit): Enterprise pricing for document SDKs. Contact sales for a custom quote.',
    pricing_url: 'https://www.nutrient.io/pricing/',
  },
  'datawrapper': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Datawrapper: Free tier. Custom: from $599/mo. Enterprise: Custom pricing.',
    pricing_url: 'https://www.datawrapper.de/pricing',
  },
  'liveblocks': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Liveblocks: Free tier (up to 200 MAU). Starter: $25/mo. Pro: $99/mo. Enterprise: Custom.',
    pricing_url: 'https://liveblocks.io/pricing',
  },
  'anytype': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Anytype: Free for personal use (local-first). Multiplayer/network features: pricing TBD.',
  },
  'growi': {
    pricing_model: 'open-source',
    pricing_details: 'Free and open-source MCP server. GROWI is free and open-source. Self-hosted wiki system. GROWI.cloud offers managed hosting.',
  },
  'devrev': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. DevRev: Free tier available. Pro and Enterprise plans for teams. See official pricing.',
    pricing_url: 'https://devrev.ai/pricing',
  },
  'atono': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Atono: Free tier available. Paid plans for teams. See official pricing.',
    pricing_url: 'https://atono.io',
  },
  'dart': {
    pricing_model: 'freemium',
    pricing_details: 'The MCP server is free and open-source. Dart: Free tier available. Premium: from $8/user/mo. See official pricing.',
    pricing_url: 'https://itsdart.com/pricing',
  },
  'cortex': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Cortex: Enterprise pricing — contact sales for internal developer portal pricing.',
    pricing_url: 'https://www.cortex.io/pricing',
  },
  'drata': {
    pricing_model: 'paid',
    pricing_details: 'The MCP server is free and open-source. Drata: Enterprise pricing — contact sales for compliance automation platform pricing.',
    pricing_url: 'https://drata.com/pricing',
  },
};

// Helper to get pricing for a server
export function getServerPricing(slug: string): PricingInfo {
  return pricingData[slug] || {
    pricing_model: 'open-source' as PricingModel,
    pricing_details: 'This MCP server is free and open-source. Check the GitHub repository for details.',
  };
}

// Get pricing model badge info
export function getPricingBadge(model: PricingModel): { label: string; color: string; bgColor: string } {
  switch (model) {
    case 'free':
      return { label: 'Free', color: 'text-green-400', bgColor: 'bg-green-500/10' };
    case 'open-source':
      return { label: 'Open Source', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' };
    case 'freemium':
      return { label: 'Freemium', color: 'text-blue-400', bgColor: 'bg-blue-500/10' };
    case 'paid':
      return { label: 'Paid', color: 'text-orange-400', bgColor: 'bg-orange-500/10' };
  }
}

// Check if server has a free option
export function hasFreeOption(model: PricingModel): boolean {
  return model === 'free' || model === 'open-source' || model === 'freemium';
}
