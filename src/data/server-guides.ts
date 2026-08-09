/**
 * Per-server long-form guides.
 *
 * Every `/servers/[slug]` page is generated from the same template: description,
 * install command, categories, integrations, five templated FAQs. That is enough
 * to be a listing and not enough to be the best result for `[tool] mcp server`,
 * which is the query these pages exist to win. The pages that outrank us answer
 * the questions a person actually arrives with — which of the several servers
 * with this name do I want, what exactly do I paste where, and what breaks on
 * first run — and none of that can be derived from a catalog row.
 *
 * So it lives here, hand-written per server, and renders only for the slugs that
 * have an entry. There is deliberately no fallback and no generator: a guide with
 * invented setup steps is worse than no guide, because a reader finds out by
 * pasting it into a terminal.
 *
 * RULES FOR ADDING ONE (see also mymcptools-sprint-spec-v1.md):
 *  - Every command, env var, tool name and endpoint must be read from the
 *    project's own README or docs, not recalled. Record where, in `sources`.
 *  - `verifiedOn` is the date a human actually re-read those sources. It renders
 *    on the page, so it has to be true.
 *  - If a fact could not be confirmed, leave the field out. Sections are all
 *    optional for exactly this reason.
 */

export interface GuideStep {
  /** Imperative, e.g. "Create an internal integration". */
  title: string;
  body: string;
  /** Optional copy-paste block: a shell command or a config snippet. */
  code?: string;
  /** Language hint for the code block label. */
  codeLabel?: string;
}

export interface GuideTool {
  name: string;
  what: string;
}

export interface GuideUseCase {
  title: string;
  /** A prompt a reader can paste into their client verbatim. */
  prompt: string;
  why: string;
}

export interface GuideGotcha {
  /** Phrased as the question a searcher would type, so it can feed FAQ schema. */
  question: string;
  answer: string;
}

export interface GuideComparison {
  /** Display name of the thing being compared against. */
  name: string;
  /** Catalog slug, when the alternative is also listed here. */
  slug?: string;
  /** The one-line answer to "which do I pick". */
  choose: string;
}

export interface ServerGuide {
  slug: string;
  /** ISO date the sources below were last read end-to-end. */
  verifiedOn: string;
  sources: { label: string; url: string }[];
  /** One paragraph that frames the decision, above the setup steps. */
  intro?: string;
  setup?: { title: string; steps: GuideStep[] };
  tools?: { title: string; note?: string; items: GuideTool[] };
  useCases?: GuideUseCase[];
  gotchas?: GuideGotcha[];
  comparison?: { note?: string; items: GuideComparison[] };
}

const guides: ServerGuide[] = [
  {
    slug: 'notion',
    verifiedOn: '2026-08-09',
    sources: [
      { label: 'makenotion/notion-mcp-server README', url: 'https://github.com/makenotion/notion-mcp-server' },
      { label: 'Notion MCP docs — overview', url: 'https://developers.notion.com/guides/mcp/overview' },
      { label: 'Notion MCP docs — connect a client', url: 'https://developers.notion.com/guides/mcp/get-started-with-mcp' },
    ],
    intro:
      'There are two Notion MCP servers, both from Notion, and picking the wrong one is the most common way this setup goes sideways. The hosted remote server at mcp.notion.com/mcp needs no install and no token — you authorise it with OAuth from inside your client. The local npm server, @notionhq/notion-mcp-server, is the older one; its README now says Notion is only actively supporting the remote server and may sunset the repository. Use the remote server unless you specifically need to run the process yourself, pin a version, or point it at a self-managed deployment.',
    setup: {
      title: 'Setting up Notion MCP',
      steps: [
        {
          title: 'Option A — connect the hosted server (recommended)',
          body:
            'Nothing to install. In Claude Code, add the remote endpoint and complete the OAuth flow with /mcp. Cursor takes the same URL as a `url` entry in mcp.json, VS Code as an http-type server in .vscode/mcp.json, and Claude Desktop and ChatGPT both take it under Settings → Connectors → Add Connector.',
          code: 'claude mcp add --transport http notion https://mcp.notion.com/mcp',
          codeLabel: 'shell',
        },
        {
          title: 'Option B — create an internal integration (local server only)',
          body:
            'The local server authenticates with an integration token, not OAuth. Create an internal integration at notion.so/profile/integrations. If you only want the assistant to read, grant just "Read content" under Capabilities — that is the cleanest way to bound the blast radius, since the token is what an LLM will be holding.',
        },
        {
          title: 'Share the pages you want reachable',
          body:
            'A fresh integration can see nothing. Open the integration\'s Access tab and select the pages and databases to expose, or go to a page → ⋯ → Connect to integration. Access is inherited, so sharing a parent page covers its children. This step is where most "the search tool returns nothing" reports end.',
        },
        {
          title: 'Point your client at the local server',
          body:
            'Add the server to claude_desktop_config.json or .cursor/mcp.json with the token in NOTION_TOKEN. The older OPENAPI_MCP_HEADERS form still works and is what you need if you want to pin the Notion-Version header yourself, but NOTION_TOKEN is the documented recommendation.',
          code: `{
  "mcpServers": {
    "notionApi": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": { "NOTION_TOKEN": "ntn_****" }
    }
  }
}`,
          codeLabel: 'claude_desktop_config.json',
        },
      ],
    },
    tools: {
      title: 'What changed in v2.0 of the local server',
      note:
        'v2.0.0 moved to the 2025-09-03 Notion API, where a database is addressed through its data sources. Three tools were removed and seven added — 22 total, up from 19. No config change is needed (clients re-discover tools on start), but hardcoded tool names in your prompts will break.',
      items: [
        { name: 'query-data-source', what: 'Replaces post-database-query. Filters and sorts a data source; takes data_source_id, not database_id.' },
        { name: 'retrieve-a-data-source', what: 'Schema and properties for one data source — the call you want before writing rows.' },
        { name: 'update-a-data-source', what: 'Replaces update-a-database.' },
        { name: 'create-a-data-source', what: 'Replaces create-a-database; parents off parent.page_id.' },
        { name: 'retrieve-a-database', what: 'Still present. Returns database metadata including the list of data source IDs it contains.' },
        { name: 'retrieve-page-markdown', what: 'Reads a whole page as Markdown instead of block JSON — far cheaper in tokens. include_transcript inlines meeting-note transcripts.' },
        { name: 'update-page-markdown', what: 'Edits page content as Markdown: replace_content to overwrite, update_content for targeted find-and-replace.' },
        { name: 'move-page', what: 'Moves a page to a different parent.' },
        { name: 'list-data-source-templates', what: 'Lists templates available in a data source.' },
      ],
    },
    useCases: [
      {
        title: 'Turn a conversation into a spec page',
        prompt: 'Create a page named "Q3 billing migration" under the Development page, summarising what we just decided, with a Risks section and an Open questions section.',
        why: 'Two calls — a search to resolve the parent page, then a create. This is the workflow the README itself uses as its worked example.',
      },
      {
        title: 'Read a long doc without burning context',
        prompt: 'Read the "Billing architecture" page as Markdown and tell me which parts contradict the new pricing model.',
        why: 'retrieve-page-markdown returns prose rather than a block tree, which is the difference between a page fitting in context and not.',
      },
      {
        title: 'Query a database as data, not as pages',
        prompt: 'In the Customers database, list every row where Plan is Enterprise and Renewal is before October, sorted by renewal date.',
        why: 'Post-v2.0 this resolves the database to a data source first — the reason older prompts referencing database_id stopped working.',
      },
    ],
    gotchas: [
      {
        question: 'Why does Notion MCP search return nothing even though my token works?',
        answer:
          'The integration has not been given access to any content. A Notion integration token authenticates but grants nothing by default — you have to share pages and databases with it explicitly, from the integration\'s Access tab or per-page via ⋯ → Connect to integration.',
      },
      {
        question: 'Why did post-database-query stop working?',
        answer:
          'It was removed in v2.0.0 of @notionhq/notion-mcp-server, along with update-a-database and create-a-database, when the server moved to the 2025-09-03 API. Use query-data-source, update-a-data-source and create-a-data-source, and pass data_source_id where you used to pass database_id.',
      },
      {
        question: 'Should I use the local Notion MCP server or the remote one?',
        answer:
          'Remote, unless you have a specific reason not to. Notion states it is prioritising and only actively supporting the remote server at mcp.notion.com/mcp, that issues and pull requests on the local repository are not actively monitored, and that the local repository may be sunset. The local server remains the right choice for pinning a version or running the process inside your own network.',
      },
      {
        question: 'Is it safe to expose the Notion MCP server over HTTP?',
        answer:
          'Only with bearer auth on. The Streamable HTTP transport requires a token by default and will generate one if you do not supply --auth-token or AUTH_TOKEN. The --unsafe-disable-auth flag turns that off and the README is blunt about the consequence: the server can become reachable to pages you visit via DNS rebinding. Use it only on an isolated network.',
      },
    ],
    comparison: {
      items: [
        {
          name: 'Notion MCP (hosted, mcp.notion.com/mcp)',
          choose: 'Default choice. OAuth instead of tokens, no install, actively supported, and workspace owners can audit and revoke client connections from Settings → Connections.',
        },
        {
          name: '@notionhq/notion-mcp-server (local)',
          choose: 'When you need a pinned version, a self-hosted process, or multi-tenant token passthrough on one deployment.',
        },
      ],
    },
  },

  {
    slug: 'obsidian',
    verifiedOn: '2026-08-09',
    sources: [
      { label: 'MarkusPfundstein/mcp-obsidian README', url: 'https://github.com/MarkusPfundstein/mcp-obsidian' },
      { label: 'coddingtonbear/obsidian-local-rest-api', url: 'https://github.com/coddingtonbear/obsidian-local-rest-api' },
    ],
    intro:
      'This server does not read your vault off disk. It talks to the Obsidian Local REST API community plugin over HTTP, which means Obsidian has to be running with that plugin enabled for any tool call to succeed — the single fact that explains almost every failed first attempt. The upside of the design is that you get Obsidian\'s own search and its heading- and block-aware patching rather than a naive file walker.',
    setup: {
      title: 'Setting up the Obsidian MCP server',
      steps: [
        {
          title: 'Install the Local REST API plugin first',
          body:
            'In Obsidian: Settings → Community plugins → Browse → "Local REST API" (coddingtonbear). Install, enable, then copy the API key from the plugin\'s settings screen. Nothing below works until this plugin is running.',
        },
        {
          title: 'Add the server to your client config',
          body:
            'The published package runs through uvx. Set OBSIDIAN_API_KEY to the key from the plugin; host defaults to 127.0.0.1 and port to 27124, so both can be omitted unless you changed them. If Claude cannot find uvx, put the absolute path from `which uvx` in the command field — a known rough edge called out in the README.',
          code: `{
  "mcpServers": {
    "mcp-obsidian": {
      "command": "uvx",
      "args": ["mcp-obsidian"],
      "env": {
        "OBSIDIAN_API_KEY": "<your_api_key_here>",
        "OBSIDIAN_HOST": "127.0.0.1",
        "OBSIDIAN_PORT": "27124"
      }
    }
  }
}`,
          codeLabel: 'claude_desktop_config.json',
        },
        {
          title: 'Tell the assistant to use Obsidian once',
          body:
            'The README\'s own advice: open with an instruction to use Obsidian, and the tools get called reliably from then on. Without it, models tend to answer from memory rather than reaching for the vault.',
        },
      ],
    },
    tools: {
      title: 'The seven tools',
      note: 'That is the whole surface — small, and worth knowing exactly, because it tells you what to ask for.',
      items: [
        { name: 'list_files_in_vault', what: 'Everything in the vault root.' },
        { name: 'list_files_in_dir', what: 'One folder, for when the root listing is too large to be useful.' },
        { name: 'get_file_contents', what: 'Reads a single note by path.' },
        { name: 'search', what: 'Full-text search across every note — the tool that makes a large vault usable.' },
        { name: 'patch_content', what: 'Inserts relative to a heading, block reference, or frontmatter field. This is the one to reach for when editing an existing note, since it does not rewrite the file.' },
        { name: 'append_content', what: 'Appends to an existing note, or creates it.' },
        { name: 'delete_file', what: 'Removes a note or directory. Irreversible from the assistant\'s side — Obsidian\'s own trash settings are your only safety net.' },
      ],
    },
    useCases: [
      {
        title: 'Summarise the last meeting into a new note',
        prompt: 'Use Obsidian. Summarise the most recent architecture call note and write it to "summary meeting.md" with a short intro I can paste into an email.',
        why: 'get_file_contents then append_content — the README\'s canonical example, and the workflow most people install this for.',
      },
      {
        title: 'Recover context scattered across years of notes',
        prompt: 'Use Obsidian. Search for every file mentioning Azure CosmosDB and explain the context each mention appears in.',
        why: 'search hits the plugin\'s index rather than reading files one by one, so it stays fast on vaults of thousands of notes.',
      },
      {
        title: 'Append under a specific heading without rewriting the note',
        prompt: 'Use Obsidian. Add today\'s decisions under the "Decisions" heading in "Project Atlas.md" — leave the rest of the note untouched.',
        why: 'patch_content targets the heading directly, which is the difference between an edit and a model regenerating your note.',
      },
    ],
    gotchas: [
      {
        question: 'Why do all Obsidian MCP tool calls fail with a connection error?',
        answer:
          'Obsidian is closed, or the Local REST API plugin is not enabled. The server is a bridge to that plugin\'s HTTP endpoint on 127.0.0.1:27124 — with the app shut, there is nothing listening. Open Obsidian and confirm the plugin is on before debugging anything else.',
      },
      {
        question: 'Claude says it cannot find uvx — how do I fix it?',
        answer:
          'Client processes often do not inherit your shell PATH. Run `which uvx` and paste the absolute path into the "command" field of the config instead of the bare name.',
      },
      {
        question: 'Which port does the Obsidian Local REST API use?',
        answer:
          'Port 27124 and host 127.0.0.1 by default. Both are configurable in the plugin, and OBSIDIAN_PORT / OBSIDIAN_HOST must be set to match if you change them.',
      },
      {
        question: 'Can I read my vault without giving the assistant write access?',
        answer:
          'Not through this server — the tool list is fixed and includes append_content, patch_content and delete_file. If you want read-only, restrict it at the plugin or vault level, or work on a copied vault.',
      },
    ],
    comparison: {
      note: 'Two servers are commonly confused because both are called "Obsidian MCP".',
      items: [
        {
          name: 'mcp-obsidian (MarkusPfundstein)',
          choose: 'The maintained one, and the one this page documents. Python/uvx, ~4,200 stars, bridges the Local REST API plugin. Pick this unless you have a reason not to.',
        },
        {
          name: 'obsidian-mcp (StevenStavrakis)',
          slug: 'obsidian-mcp',
          choose: 'A Node alternative, ~720 stars, with no commits since June 2025. Worth knowing about, but a stale dependency for a daily workflow.',
        },
      ],
    },
  },

  {
    slug: 'linear',
    verifiedOn: '2026-08-09',
    sources: [{ label: 'Linear docs — MCP server', url: 'https://linear.app/docs/mcp' }],
    intro:
      'Linear\'s MCP server is first-party, remote, and centrally hosted — there is no repository to clone and no package to install, which is why this page has no GitHub link. You point a client at an HTTPS endpoint and authorise it. The detail worth knowing before you set it up is that there are two endpoints, and the read-only one is the better default for anything you are not supervising closely.',
    setup: {
      title: 'Connecting to Linear MCP',
      steps: [
        {
          title: 'Pick read-write or read-only',
          body:
            'https://mcp.linear.app/mcp is read-write. For read-only there are two routes: connect to https://mcp.linear.app/mcp/readonly, which only ever exposes read tools, or use the standard endpoint and request only the `read` OAuth scope — clients that do get a token that cannot reach write APIs. An agent that can silently re-title and re-status issues in a shared tracker is worth a moment\'s thought.',
        },
        {
          title: 'Claude Code',
          body: 'Add it over HTTP transport, then run /mcp inside a session to complete the OAuth flow.',
          code: 'claude mcp add --transport http linear-server https://mcp.linear.app/mcp',
          codeLabel: 'shell',
        },
        {
          title: 'Claude Desktop, Claude.ai and Cursor',
          body:
            'Claude Desktop and Claude.ai connect through Settings → Connectors rather than a config file. Cursor has Linear in its MCP directory, so it installs from there without hand-written JSON.',
        },
        {
          title: 'Codex',
          body:
            'One command, which prompts the login. On a first-ever MCP setup in Codex you also need experimental_use_rmcp_client = true under [features] in ~/.codex/config.toml.',
          code: 'codex mcp add linear --url https://mcp.linear.app/mcp',
          codeLabel: 'shell',
        },
        {
          title: 'Anything that only speaks stdio',
          body:
            'Older clients — and VS Code, Windsurf and Zed as documented — bridge to the remote server through mcp-remote. Command `npx`, arguments `-y mcp-remote https://mcp.linear.app/mcp`, no environment variables.',
          code: 'npx -y mcp-remote https://mcp.linear.app/mcp',
          codeLabel: 'shell',
        },
      ],
    },
    useCases: [
      {
        title: 'Turn a planning doc into a structured project',
        prompt: 'Read this planning document, create a Linear project reflecting its objective, scope and timeline, then create issues for the work — each with a clear title and a description capturing the problem, the goal, the proposed approach and any open questions.',
        why: 'Linear publishes this as a worked example. The value is not the issue creation, it is that descriptions arrive populated instead of as bare titles someone has to fill in later.',
      },
      {
        title: 'Ask the tracker a question instead of building a view',
        prompt: 'What is still open in the current cycle for my team, and which of it has been in review for more than three days?',
        why: 'Read tools only — a good first workflow to run against the /mcp/readonly endpoint before granting write access.',
      },
      {
        title: 'File an issue from the code you are looking at',
        prompt: 'Create a Linear issue for the race condition in this file, with a reproduction from the failing test, and link it to the current project.',
        why: 'Keeps the context that produced the bug attached to it, which is the part that normally gets lost between editor and tracker.',
      },
    ],
    gotchas: [
      {
        question: 'Is there a GitHub repo or npm package for the Linear MCP server?',
        answer:
          'No. It is a hosted remote server run by Linear at mcp.linear.app, following the authenticated remote MCP spec. Any install command claiming to be "the Linear MCP package" is not Linear\'s — the only local component in Linear\'s own documentation is mcp-remote, a generic bridge for stdio-only clients.',
      },
      {
        question: 'How do I give an AI client read-only access to Linear?',
        answer:
          'Connect to https://mcp.linear.app/mcp/readonly, which exposes read tools only, or request just the `read` OAuth scope against the standard endpoint — the resulting token cannot reach write APIs either way.',
      },
      {
        question: 'Can I authenticate with a Linear API key instead of OAuth?',
        answer:
          'Yes. The interactive setup uses OAuth 2.1 with dynamic client registration, but Linear documents authenticating directly with a bearer token or a Linear API key as an alternative. Jules, for example, connects with an API key generated under Settings → Account → Security & Access.',
      },
      {
        question: 'Does Linear MCP work with Okta SSO?',
        answer:
          'Yes, through enterprise-managed authorization. Configure SAML for Linear first, then enable MCP enterprise managed authentication on the Okta identity provider in Linear and supply the Okta issuer URI, so external clients authenticate against your Okta access policies.',
      },
    ],
  },
];

const guideBySlug = new Map(guides.map((g) => [g.slug, g] as const));

export function getServerGuide(slug: string): ServerGuide | undefined {
  return guideBySlug.get(slug);
}

export function guideSlugs(): string[] {
  return guides.map((g) => g.slug);
}

export { guides as serverGuides };
