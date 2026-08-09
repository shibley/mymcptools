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

  {
    slug: 'github',
    verifiedOn: '2026-08-09',
    sources: [
      { label: 'github/github-mcp-server README', url: 'https://github.com/github/github-mcp-server' },
      { label: 'Remote server URL reference', url: 'https://github.com/github/github-mcp-server/blob/main/docs/remote-server.md' },
      { label: 'Claude install guide', url: 'https://github.com/github/github-mcp-server/blob/main/docs/installation-guides/install-claude.md' },
    ],
    intro:
      'There is no npm package for this server. `@github/mcp-server` returns 404 on the npm registry, so every `npx @github/mcp-server` line circulating in listings and blog posts fails on the first run — that is the single biggest source of wasted time here. GitHub ships it three ways instead: a hosted remote server at api.githubcopilot.com that needs no install, a Docker image, and a Go binary you build yourself. Take the remote server unless you are on GitHub Enterprise Server, which the remote server does not cover.',
    setup: {
      title: 'Setting up the GitHub MCP server',
      steps: [
        {
          title: 'Option A — the hosted remote server (start here)',
          body:
            'One HTTP endpoint, OAuth in the client, nothing to install or update. On Claude Code 2.1.1 and newer the documented form is add-json; older versions and some Windows shells need the legacy add syntax. VS Code, VS Code Insiders and Visual Studio all offer one-click install for the same URL.',
          code: 'claude mcp add-json github \'{"type":"http","url":"https://api.githubcopilot.com/mcp"}\'',
          codeLabel: 'shell',
        },
        {
          title: 'Cut the tool surface with a URL path, not a config file',
          body:
            'The remote server exposes each toolset at its own endpoint, which is the cleanest way to stop 100+ tools crowding the model\'s context. Append /readonly for a non-mutating variant, /x/{toolset} for one toolset, and combine them as /x/{toolset}/readonly. Toolsets available on the path include actions, code_quality, code_security, copilot, dependabot, discussions, gists, git, issues, labels, notifications, orgs, projects, pull_requests, repos, secret_protection, security_advisories, stargazers and users, plus two that are remote-only: copilot_spaces and github_support_docs_search. A path carries exactly one toolset; to combine several, send the X-MCP-Toolsets header with a comma-separated list.',
          code: `https://api.githubcopilot.com/mcp/            # default toolsets
https://api.githubcopilot.com/mcp/readonly   # no write tools
https://api.githubcopilot.com/mcp/x/issues   # issues only
https://api.githubcopilot.com/mcp/x/pull_requests/readonly`,
          codeLabel: 'endpoints',
        },
        {
          title: 'Option B — run it locally with Docker',
          body:
            'The image is ghcr.io/github/github-mcp-server. It can do the OAuth dance itself if you publish the callback port, or take a personal access token. Note the precedence rule from the docs: when GITHUB_PERSONAL_ACCESS_TOKEN is set it wins over OAuth, so a stale token in your environment silently overrides a fresh login.',
          code: `# OAuth (callback port must be published)
claude mcp add github -e GITHUB_OAUTH_CALLBACK_PORT=8085 -- \\
  docker run -i --rm -p 127.0.0.1:8085:8085 \\
  -e GITHUB_OAUTH_CALLBACK_PORT ghcr.io/github/github-mcp-server

# Personal access token
claude mcp add github -e GITHUB_PERSONAL_ACCESS_TOKEN=YOUR_PAT -- \\
  docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN \\
  ghcr.io/github/github-mcp-server`,
          codeLabel: 'shell',
        },
        {
          title: 'Option C — build the binary (and the GHES path)',
          body:
            'The repository is Go; building it yourself is the only option that works against GitHub Enterprise Server, since the hosted remote server does not serve GHES. Point it at your instance with GITHUB_HOST, including the https:// scheme — GHES does not accept http://.',
          code: `go build -o github-mcp-server ./cmd/github-mcp-server
GITHUB_HOST="https://YOURSUBDOMAIN.ghe.com" ./github-mcp-server stdio`,
          codeLabel: 'shell',
        },
      ],
    },
    tools: {
      title: 'Toolsets, and why you should not enable all of them',
      note:
        'Tools are grouped into toolsets, selected with --toolsets or GITHUB_TOOLSETS on the local server and with the URL path or X-MCP-Toolsets header on the remote one. The default set is context, repos, issues, pull_requests and users. `all` exists and is usually a mistake: every extra tool is context the model spends before it reads your question.',
      items: [
        { name: 'context', what: 'Who the authenticated user is and what GitHub context they are in. On by default; other tools lean on it.' },
        { name: 'repos', what: 'Repository, file, branch and commit operations. On by default.' },
        { name: 'issues', what: 'Issue read, create, comment and triage. On by default.' },
        { name: 'pull_requests', what: 'PR listing, diffs, reviews and merges. On by default.' },
        { name: 'actions', what: 'Workflow runs and logs — the toolset to add when you want the assistant to debug a red build.' },
        { name: 'code_security / secret_protection / dependabot / security_advisories', what: 'Code scanning alerts, secret scanning, Dependabot alerts and advisory data. Each is separate so you can grant one without the rest.' },
        { name: 'discussions / gists / labels / notifications / orgs / projects / stargazers / users', what: 'Narrower surfaces, off unless asked for.' },
        { name: 'copilot_spaces / github_support_docs_search', what: 'Remote-server-only toolsets; no local equivalent.' },
      ],
    },
    useCases: [
      {
        title: 'Triage a failing workflow without leaving the editor',
        prompt: 'The latest CI run on this branch failed. Pull the workflow run logs, find the first real error, and tell me which commit introduced it.',
        why: 'Needs the actions toolset, which is not on by default — connect to /x/actions or add actions to --toolsets first.',
      },
      {
        title: 'Review a pull request against the repo\'s own conventions',
        prompt: 'Read PR #412, then read CONTRIBUTING.md on main, and list every place the PR departs from the documented conventions.',
        why: 'Two toolsets in one task: pull_requests for the diff, repos for the file on main. Both are in the default set.',
      },
      {
        title: 'Give an agent read access to a repo and nothing else',
        prompt: 'Summarise the open issues labelled bug that have had no activity in 30 days.',
        why: 'Point the client at /x/issues/readonly. The endpoint, not a prompt instruction, is what makes it read-only.',
      },
    ],
    gotchas: [
      {
        question: 'Why does npx @github/mcp-server fail?',
        answer:
          'Because that package does not exist. `@github/mcp-server` is not published to the npm registry — the request 404s — so every npx invocation of it fails no matter what flags you pass. GitHub distributes the server as a hosted remote endpoint at api.githubcopilot.com, as the Docker image ghcr.io/github/github-mcp-server, and as a Go binary you build from source.',
      },
      {
        question: 'How do I make the GitHub MCP server read-only?',
        answer:
          'Three ways, depending on how you run it. On the remote server, connect to https://api.githubcopilot.com/mcp/readonly (or /x/{toolset}/readonly). On the binary, pass --read-only. On Docker, set GITHUB_READ_ONLY=1. There is also a separate --lockdown-mode / GITHUB_LOCKDOWN_MODE=1, which filters public repository content by whether its author has push access — a prompt-injection control, not a write control.',
      },
      {
        question: 'Does the GitHub MCP server work with GitHub Enterprise Server?',
        answer:
          'Only the self-hosted server does. The docs state GitHub Enterprise Server is not supported by the remote hosted server, so run the Docker image or the binary and set GITHUB_HOST to your instance URL. The scheme must be https:// — GHES does not support http://.',
      },
      {
        question: 'My PAT is set but OAuth login keeps being ignored — why?',
        answer:
          'That is documented precedence, not a bug: GITHUB_PERSONAL_ACCESS_TOKEN takes precedence over OAuth. If an old token is exported in your shell or left in a client config, it will be used instead of the account you just signed in as. Unset it to fall back to OAuth.',
      },
      {
        question: 'Which scopes does the GitHub MCP server need?',
        answer:
          'It depends entirely on which toolsets you enable — the requirement is per tool. The commonly needed ones are repo, security_events, gist, notifications and read:org. Enable toolsets first, then grant only the scopes those tools call for, rather than issuing a blanket-scoped token up front.',
      },
    ],
    comparison: {
      note: 'All three are the same codebase; the choice is about who runs the process.',
      items: [
        {
          name: 'Remote server (api.githubcopilot.com/mcp)',
          choose: 'Default. No install, no upgrades, OAuth in the client, and per-toolset read-only endpoints you can point different agents at.',
        },
        {
          name: 'Docker image (ghcr.io/github/github-mcp-server)',
          choose: 'When the token must not leave your machine, when you need a pinned version, or when you want GITHUB_READ_ONLY / GITHUB_LOCKDOWN_MODE enforced locally.',
        },
        {
          name: 'Go binary from source',
          choose: 'The GitHub Enterprise Server path, and the only way to run it where Docker is unavailable.',
        },
      ],
    },
  },

  {
    slug: 'figma',
    verifiedOn: '2026-08-09',
    sources: [
      { label: 'Figma MCP server — remote installation', url: 'https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/' },
      { label: 'Figma MCP server — desktop installation', url: 'https://developers.figma.com/docs/figma-mcp-server/local-server-installation/' },
      { label: 'Figma MCP server — tools and prompts', url: 'https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/' },
      { label: 'Figma MCP server — rate limits and access', url: 'https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/' },
    ],
    intro:
      'Most listings for "figma mcp" still hand you the desktop setup, and Figma\'s own docs no longer lead with it: the remote server at mcp.figma.com/mcp is now the recommended one, with the desktop server kept for specific organisation and enterprise cases. The difference is not cosmetic. Roughly a third of the tools — creating files, generating designs, uploading and downloading assets, searching connected libraries — exist only on the remote server. The desktop server\'s advantage is that it reads what you have selected in the running app.',
    setup: {
      title: 'Connecting to Figma MCP',
      steps: [
        {
          title: 'Option A — the remote server (recommended)',
          body:
            'Nothing to install. Point the client at the endpoint and complete Figma\'s OAuth flow. Cursor has it as a first-party plugin (/add-plugin figma), and VS Code takes it as an http-type server in mcp.json — note VS Code requires GitHub Copilot to be enabled before it will load MCP servers at all.',
          code: `# Claude Code
claude mcp add --transport http figma https://mcp.figma.com/mcp

# Codex CLI
codex mcp add figma --url https://mcp.figma.com/mcp`,
          codeLabel: 'shell',
        },
        {
          title: 'Option B — the desktop server, when you want canvas selection',
          body:
            'In the Figma desktop app: open a Design file, switch to Dev Mode (Shift+D), then in the MCP server section of the inspect panel click "Enable desktop MCP server". The app opens a local endpoint on port 3845. Because it lives inside the app, the tools resolve against your current selection rather than a file URL.',
          code: 'claude mcp add --transport http figma-desktop http://127.0.0.1:3845/mcp',
          codeLabel: 'shell',
        },
        {
          title: 'Check your plan actually allows the calls you plan to make',
          body:
            'Access is gated by plan and seat, and the Starter tier is effectively a trial: View and Collab seats get six tool calls per month. Professional gives Dev and Full seats 200 calls a day with a 10-per-minute ceiling; Organization raises that to 600 a day and 20 a minute; Enterprise is higher again. Per-minute limits apply on top of the daily or monthly cap, which is what people are hitting when a long generation stalls midway. Three tools are exempt from the limits entirely: add_code_connect_map, generate_figma_design and whoami.',
        },
        {
          title: 'Wire up Code Connect if you have a component library',
          body:
            'Without it the model emits generic markup for your components. get_code_connect_suggestions detects likely Figma-node-to-code-component mappings, send_code_connect_mappings confirms them, and get_code_connect_map reads back what is already mapped — after which generated code uses your component names instead of divs.',
        },
      ],
    },
    tools: {
      title: 'Tools, and which ones the desktop server does not have',
      note:
        'The read side is shared. Everything that writes to Figma or reaches across files is remote-only, marked below — this is the practical reason to prefer the remote server.',
      items: [
        { name: 'get_design_context', what: 'The main read tool: design context for a layer or selection, defaulting to React plus Tailwind output.' },
        { name: 'get_metadata', what: 'A sparse XML representation of the selection with basic properties — cheap to call before the heavier context tool.' },
        { name: 'get_screenshot', what: 'Takes a screenshot of the selection so the model can see the rendered result, not just the tree.' },
        { name: 'get_variable_defs', what: 'The variables and styles used in the selection — how you get design tokens instead of hex literals.' },
        { name: 'get_motion_context', what: 'Keyframe animation data for an animated node, returned with CSS and motion.dev snippets.' },
        { name: 'get_figjam', what: 'Converts a FigJam diagram to XML with node metadata and screenshots.' },
        { name: 'get_code_connect_map / get_code_connect_suggestions / send_code_connect_mappings / add_code_connect_map', what: 'Read, suggest, confirm and add Figma-node-to-code-component mappings.' },
        { name: 'get_shader_effect / get_shader_fill / list_shader_effects / list_shader_fills', what: 'Retrieve and page through shader effects and fills in the account library.' },
        { name: 'use_figma  (remote only)', what: 'The general-purpose write tool — creates and edits objects across Figma file types.' },
        { name: 'generate_figma_design  (remote only)', what: 'Generates design layers from interfaces into a new or existing file.' },
        { name: 'generate_diagram  (remote only)', what: 'Turns Mermaid syntax or a natural-language description into an editable FigJam diagram.' },
        { name: 'create_new_file  (remote only)', what: 'Creates a blank Design, FigJam or Slides file in the authenticated user\'s drafts.' },
        { name: 'search_design_system  (remote only)', what: 'Searches every connected library for components, variables and styles.' },
        { name: 'get_libraries / get_context_for_code_connect  (remote only)', what: 'Lists subscribed and available libraries; returns structured component metadata for Code Connect templates.' },
        { name: 'download_assets / upload_assets  (remote only)', what: 'Pulls rendered exports and source images out of a file; pushes PNG, JPG, GIF and WebP back in.' },
        { name: 'whoami  (remote only)', what: 'Returns the authenticated identity, email and seat — the fastest way to confirm which account and plan you are actually on.' },
      ],
    },
    useCases: [
      {
        title: 'Build a component from the frame you have selected',
        prompt: 'Read my current Figma selection and implement it as a React component using our design tokens rather than hard-coded values.',
        why: 'get_design_context plus get_variable_defs. On the desktop server this resolves against the live selection; on the remote server pass the file and node URL.',
      },
      {
        title: 'Turn a written flow into an editable FigJam diagram',
        prompt: 'Here is our checkout retry logic. Generate a FigJam diagram of it in my drafts.',
        why: 'generate_diagram accepts Mermaid or plain description and is remote-only — the desktop server cannot do this at all.',
      },
      {
        title: 'Find out whether a component already exists before building it',
        prompt: 'Search our design system for an existing toast or snackbar component before I add a new one.',
        why: 'search_design_system reaches across every connected library, which no read of a single file will do.',
      },
    ],
    gotchas: [
      {
        question: 'Should I use the remote Figma MCP server or the desktop one?',
        answer:
          'Remote, in almost all cases. Figma\'s own docs describe the desktop server as being for some specific organisation and enterprise use cases and recommend the remote version instead. The remote server is also the only one with the write and cross-file tools — use_figma, generate_figma_design, create_new_file, search_design_system, upload_assets and download_assets are all remote-only. Keep the desktop server for workflows that must act on whatever is selected in the running app.',
      },
      {
        question: 'Why do I only get a handful of Figma MCP tool calls?',
        answer:
          'You are on a Starter plan. Starter allows View and Collab seats six tool calls per month. Dev and Full seats on Professional get 200 a day at 10 per minute, Organization 600 a day at 20 per minute, and Enterprise more. Per-minute limits apply on top of the daily cap, so a burst can stall even when the daily budget is intact.',
      },
      {
        question: 'Is writing to the Figma canvas free?',
        answer:
          'For now. Figma\'s documentation states that writing to canvas is currently available for free during the beta period and will eventually become a usage-based paid feature. Anything you build on use_figma or generate_figma_design should assume a future cost per call.',
      },
      {
        question: 'Why does the Figma MCP server not appear in VS Code?',
        answer:
          'VS Code requires GitHub Copilot to be enabled before it will load MCP servers. Add the endpoint as an http-type entry under "servers" in mcp.json, not as a command — the Figma server is an HTTP endpoint in both its remote and desktop forms, with no stdio process to launch.',
      },
      {
        question: 'Why is the generated code generic instead of using our components?',
        answer:
          'Code Connect is not mapped. Without a mapping the server has no way to know your Figma components correspond to code components, so it emits plain markup. Run get_code_connect_suggestions, confirm with send_code_connect_mappings, and generated output starts naming your components.',
      },
    ],
    comparison: {
      items: [
        {
          name: 'Figma MCP server — remote (mcp.figma.com/mcp)',
          choose: 'The default. OAuth, no install, and the only place the write, generation, asset and design-system-search tools exist.',
        },
        {
          name: 'Figma MCP server — desktop (127.0.0.1:3845/mcp)',
          choose: 'When the workflow is "implement what I have selected right now", or when an organisation policy keeps file access on the machine.',
        },
        {
          name: 'figma-developer-mcp (GLips/Figma-Context-MCP)',
          choose: 'The popular third-party server, 15.6k stars, installed with npx figma-developer-mcp and a Figma API token. It reads files through the REST API, so it needs no desktop app and no Dev seat — but it cannot write to the canvas and has no Code Connect awareness.',
        },
      ],
    },
  },

  {
    slug: 'slack',
    verifiedOn: '2026-08-09',
    sources: [
      { label: 'korotovsky/slack-mcp-server README', url: 'https://github.com/korotovsky/slack-mcp-server' },
      { label: 'Authentication setup', url: 'https://github.com/korotovsky/slack-mcp-server/blob/master/docs/01-authentication-setup.md' },
      { label: 'Configuration and usage', url: 'https://github.com/korotovsky/slack-mcp-server/blob/master/docs/03-configuration-and-usage.md' },
    ],
    intro:
      'The reason this server exists is that it will run in a workspace where you cannot install a Slack app. It accepts your own browser session tokens (xoxc plus xoxd) as an alternative to OAuth, so there is no admin approval step and no bot in the member list. That is also the reason to think before installing it: those tokens are your full user session. Two safer modes exist — a user OAuth token (xoxp) or a bot token (xoxb) — and each trades away some capability, which the table below spells out.',
    setup: {
      title: 'Setting up the Slack MCP server',
      steps: [
        {
          title: 'Pick a token type first — it decides what works',
          body:
            'The server takes one of three: xoxp (user OAuth), xoxb (bot, most limited), or the xoxc + xoxd browser pair. Bot tokens cannot call Slack\'s search.messages API, so conversations_search_messages is out. The saved-items tools and @mention filtering in unreads need browser tokens specifically, and conversations_unreads falls back to a slower path on standard OAuth tokens.',
        },
        {
          title: 'Extract xoxc and xoxd, if you are going the browser-session route',
          body:
            'Open Slack in a browser, open developer tools, and in the console type "allow pasting" and press enter before pasting the snippet below — the value returned starts with xoxc-. Then switch to the Application tab, open Cookies, find the cookie named `d`, and copy its value; that is the xoxd token. Treat both as passwords.',
          code: 'JSON.parse(localStorage.localConfig_v2).teams[document.location.pathname.match(/^\\/client\\/([A-Z0-9]+)/)[1]].token',
          codeLabel: 'browser console',
        },
        {
          title: 'Add the server to your client',
          body:
            'The published npm package is slack-mcp-server; there is also a Docker image at ghcr.io/korotovsky/slack-mcp-server if you would rather not run it through npx. Stdio, SSE and HTTP transports are all supported — for the network transports bind with SLACK_MCP_HOST (default 127.0.0.1) and SLACK_MCP_PORT (default 13080), and set SLACK_MCP_API_KEY as the bearer token, since an unauthenticated Slack bridge on a shared host is an open door.',
          code: `{
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": ["-y", "slack-mcp-server@latest", "--transport", "stdio"],
      "env": {
        "SLACK_MCP_XOXC_TOKEN": "xoxc-...",
        "SLACK_MCP_XOXD_TOKEN": "xoxd-..."
      }
    }
  }
}`,
          codeLabel: 'claude_desktop_config.json',
        },
        {
          title: 'Let the caches build, or lose channel lookup by name',
          body:
            'The server keeps a users cache and a channels cache, at SLACK_MCP_USERS_CACHE and SLACK_MCP_CHANNELS_CACHE. With neither, message history arrives without user context. With only the channels cache, you can address channels by name but user enrichment is missing; with only the users cache, "#engineering" will not resolve and you are back to raw channel IDs. Both present is the intended state, and the first run is the one that populates them.',
        },
        {
          title: 'Decide, explicitly, whether it may write',
          body:
            'Posting is disabled by default. SLACK_MCP_ADD_MESSAGE_TOOL takes "true" to allow every channel, a comma-separated list of channel IDs to allow only those, or a "!" prefix on an ID to allow everything except it — a per-channel allowlist is the setting most teams actually want. Reactions and read-marking are gated separately behind SLACK_MCP_REACTION_TOOL and SLACK_MCP_MARK_TOOL.',
          code: '"SLACK_MCP_ADD_MESSAGE_TOOL": "C08XXXXXXXX,C09YYYYYYYY"',
          codeLabel: 'env',
        },
      ],
    },
    tools: {
      title: 'The 18 tools',
      note: 'Everything in the first group is read-only and on by default. Everything that writes is off until you set the matching environment variable.',
      items: [
        { name: 'conversations_history', what: 'Reads a channel or DM with smart pagination — the workhorse tool.' },
        { name: 'conversations_replies', what: 'Reads a thread from a parent message.' },
        { name: 'conversations_search_messages', what: 'Search across the workspace. Unavailable on a bot token: xoxb cannot call search.messages.' },
        { name: 'conversations_unreads', what: 'What you have not read. Works best with browser tokens; OAuth tokens take a slower fallback path, and @mention filtering is browser-token-only.' },
        { name: 'channels_list', what: 'Lists channels — this is what makes "#channel-name" resolvable, via the channels cache.' },
        { name: 'users_search', what: 'Finds users, and supplies the names that turn message history from IDs into readable text.' },
        { name: 'usergroups_list / usergroups_me', what: 'Reads user groups and the ones you belong to.' },
        { name: 'saved_list / saved_update / saved_clear_completed', what: 'Saved items. Browser tokens required.' },
        { name: 'conversations_add_message', what: 'Posts. Off unless SLACK_MCP_ADD_MESSAGE_TOOL is set — to "true", a channel-ID allowlist, or "!ID" to exclude one.' },
        { name: 'reactions_add / reactions_remove', what: 'Emoji reactions. Gated behind SLACK_MCP_REACTION_TOOL.' },
        { name: 'conversations_mark', what: 'Marks a conversation read. Gated behind SLACK_MCP_MARK_TOOL — it mutates your unread state, hence the separate switch.' },
        { name: 'usergroups_create / usergroups_update / usergroups_users_update', what: 'Writes to user groups: create one, edit it, change its membership.' },
      ],
    },
    useCases: [
      {
        title: 'Catch up on a channel without opening Slack',
        prompt: 'Summarise everything in #incidents since yesterday morning, grouped by incident, and list the open action items with owners.',
        why: 'conversations_history plus users_search. Without the users cache the summary comes back full of U0… IDs instead of names.',
      },
      {
        title: 'Find the decision, not the thread',
        prompt: 'Search the workspace for where we decided to drop the legacy billing endpoint and quote the message that settled it.',
        why: 'conversations_search_messages — the tool that does not exist on a bot token, which is the usual reason this prompt returns nothing.',
      },
      {
        title: 'Let it reply, but only in one channel',
        prompt: 'Post the deploy summary to #releases.',
        why: 'Set SLACK_MCP_ADD_MESSAGE_TOOL to that channel\'s ID alone. The allowlist is enforced in the server, so a confused model cannot post elsewhere.',
      },
    ],
    gotchas: [
      {
        question: 'Why can\'t the Slack MCP server post messages?',
        answer:
          'Posting is disabled by default for safety. Set SLACK_MCP_ADD_MESSAGE_TOOL to enable conversations_add_message: "true" for every channel, a comma-separated list of channel IDs to restrict it to those, or an ID prefixed with "!" to allow everywhere except that channel. Reactions and read-marking have their own switches, SLACK_MCP_REACTION_TOOL and SLACK_MCP_MARK_TOOL.',
      },
      {
        question: 'Do I need a Slack admin to approve this?',
        answer:
          'Not if you use browser-session tokens. Authenticating with the xoxc and xoxd pair reuses your existing signed-in session, so no Slack app is installed and no admin approval is requested — which is the whole point of the server for locked-down workspaces. The trade is that those tokens carry your full user access; a scoped xoxp user token or an xoxb bot token is the more conservative choice where an app install is possible.',
      },
      {
        question: 'Why does Slack MCP search return nothing on my bot token?',
        answer:
          'Bot tokens cannot use Slack\'s search.messages API, so conversations_search_messages does not work with xoxb. Switch to a user OAuth token (xoxp) or the browser-session pair if search matters. The same class of limit applies to saved items and to @mention filtering in unreads, both of which need browser tokens.',
      },
      {
        question: 'Why can\'t I reference a channel by #name?',
        answer:
          'The channels cache has not been built. SLACK_MCP_CHANNELS_CACHE is what maps names to IDs; without it you must pass raw channel IDs. Separately, SLACK_MCP_USERS_CACHE is what enriches message history with display names — with neither cache present you get IDs on both axes.',
      },
      {
        question: 'Is it safe to run the Slack MCP server over SSE or HTTP?',
        answer:
          'Only with the bearer token set. SLACK_MCP_API_KEY is the bearer token for the SSE and HTTP transports; leaving it unset on a bound port exposes your Slack session to anything that can reach the host. Defaults are conservative — SLACK_MCP_HOST is 127.0.0.1 and SLACK_MCP_PORT is 13080 — so the risk arrives when you change the host to reach it from elsewhere.',
      },
    ],
    comparison: {
      items: [
        {
          name: 'Browser session tokens (xoxc + xoxd)',
          choose: 'The no-admin path, and the only one with saved items, @mention-filtered unreads and full-speed unread reads. Highest access, so scope the write switches deliberately.',
        },
        {
          name: 'User OAuth token (xoxp)',
          choose: 'The middle ground: real OAuth scopes you can audit and revoke, search still works, unreads take a slower fallback path.',
        },
        {
          name: 'Bot token (xoxb)',
          choose: 'Most conservative and most limited — no message search at all, and only the channels the bot is invited to.',
        },
      ],
    },
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
