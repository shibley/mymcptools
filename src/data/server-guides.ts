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
  {
    slug: 'jira',
    verifiedOn: '2026-08-10',
    sources: [
      { label: 'atlassian/atlassian-mcp-server README', url: 'https://github.com/atlassian/atlassian-mcp-server' },
      { label: 'atlassian/atlassian-mcp-server server.json (MCP registry entry)', url: 'https://github.com/atlassian/atlassian-mcp-server/blob/main/server.json' },
      { label: 'Atlassian Support — Getting started with the Atlassian Rovo MCP Server', url: 'https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/' },
      { label: 'Atlassian Support — Supported tools', url: 'https://support.atlassian.com/atlassian-rovo-mcp-server/docs/supported-tools/' },
      { label: 'Atlassian Support — Troubleshooting and verifying your setup', url: 'https://support.atlassian.com/atlassian-rovo-mcp-server/docs/troubleshooting-and-verifying-your-setup/' },
    ],
    intro:
      'There is no separate "Jira MCP server" from Atlassian. Jira is one product surface of a single hosted server — the Atlassian Rovo MCP Server — that also carries Confluence, Jira Service Management, Bitbucket Cloud and Compass, so connecting it once gives you all of them your account can see. The part that trips people up is the endpoint: the URL in most blog posts and in a lot of copied config is https://mcp.atlassian.com/v1/mcp, and the URL Atlassian now recommends is https://mcp.atlassian.com/v1/mcp/authv2. Both still resolve, and the older Server-Sent Events endpoint /v1/sse is still supported but explicitly on the way out — Atlassian tells custom clients to move off it. Use /mcp/authv2 for a browser OAuth 2.1 login, which is what almost everyone wants; /v1/mcp is the one the docs point at for API-token configurations. Nothing installs locally either way, so there is no package to fail and no version to pin.',
    setup: {
      title: 'Connecting Jira over the Atlassian Rovo MCP Server',
      steps: [
        {
          title: 'Add the remote server to Claude Code',
          body:
            'One command, no package download. Claude Code opens a browser for the OAuth 2.1 consent screen the first time you call a tool; after that the session is remembered.',
          code: 'claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp/authv2',
          codeLabel: 'shell',
        },
        {
          title: 'Or paste the config directly, for any HTTP-capable client',
          body:
            'This is the exact .mcp.json Atlassian ships in the repository root, so it is the config to copy rather than one reconstructed from a screenshot. Cursor, VS Code and ChatGPT also have one-click install links in the README that encode the same URL.',
          code: '{\n  "mcpServers": {\n    "atlassian": {\n      "type": "http",\n      "url": "https://mcp.atlassian.com/v1/mcp/authv2"\n    }\n  }\n}',
          codeLabel: 'json',
        },
        {
          title: 'Clients that only speak stdio need the mcp-remote proxy',
          body:
            'If your client cannot open a streamable-HTTP connection itself, it runs mcp-remote locally to bridge to the hosted endpoint. Atlassian lists Node.js v18+ as a prerequisite for exactly this path — that requirement is about the proxy, not about the server.',
          code: 'npx -y mcp-remote https://mcp.atlassian.com/v1/mcp/authv2',
          codeLabel: 'shell',
        },
        {
          title: 'Let the first consent be an admin, or the rest of the team is blocked',
          body:
            'The Rovo MCP app is not a Marketplace install. It is registered just-in-time the first time somebody on your site completes the OAuth 2.1 (3LO) consent flow, and that first user has to hold access to every product the MCP scopes request. Get that wrong and later users hit "Your site admin must authorize this app". After the first install, a user with only Jira (or only Confluence) can consent for their own product. The app then shows up under Connected apps in Atlassian Administration, where it can be reviewed or revoked.',
        },
        {
          title: 'Pin the cloudId and project key so the model stops probing',
          body:
            'Every session otherwise opens with getAccessibleAtlassianResources and a project lookup before it does the thing you asked for. Atlassian publishes this AGENTS.md block to short-circuit those calls; the maxResults line matters as much as the IDs, because an unbounded JQL search will happily return enough issues to blow the context window.',
          code: '## Atlassian Rovo MCP\n\nWhen connected to atlassian-rovo-mcp:\n- **MUST** use Jira project key = YOURPROJ\n- **MUST** use cloudId = "https://yoursite.atlassian.net" (do NOT call getAccessibleAtlassianResources)\n- **MUST** use `maxResults: 10` for ALL Jira JQL search operations.',
          codeLabel: 'markdown',
        },
      ],
    },
    tools: {
      title: 'The Jira tools, by permission group',
      note:
        'Access is granted per permission group, not per tool — an org admin turns on read_jira, write_jira or search_jira, and each tool inherits its group. That is why "it can read my issues but not comment" is a normal, deliberate state rather than a bug. atlassianUserInfo and getAccessibleAtlassianResources are common to every product.',
      items: [
        { name: 'getJiraIssue (read)', what: 'Fetch one issue by ID or key — the workhorse behind "summarise PROJ-412".' },
        { name: 'searchJiraIssuesUsingJql (search)', what: 'The only search tool, and it takes raw JQL. Natural-language questions get translated to JQL by the model, so a bad answer is usually a bad query — ask it to show you the JQL.' },
        { name: 'getVisibleJiraProjects (read)', what: 'Lists the projects your account can see. Pin the key in AGENTS.md to skip it.' },
        { name: 'getTransitionsForJiraIssue (read)', what: 'The legal next statuses for an issue. Must be called before a transition, because workflow names differ per project.' },
        { name: 'transitionJiraIssue (write)', what: 'Moves an issue through a workflow transition returned by the call above.' },
        { name: 'editJiraIssue (write)', what: 'Updates fields on an existing issue.' },
        { name: 'addCommentToJiraIssue (write)', what: 'Adds a comment, or edits an existing one when a commentID is supplied.' },
        { name: 'addWorklogToJiraIssue (write)', what: 'Logs time against an issue.' },
        { name: 'getJiraIssueTypeMetaWithFields (read)', what: 'Create-field metadata for a project and issue type — what a create call is allowed to set, including required custom fields.' },
        { name: 'getJiraProjectIssueTypesMetadata (read)', what: 'The issue types available in a project.' },
        { name: 'getIssueLinkTypes / getJiraIssueRemoteIssueLinks (read)', what: 'Link vocabulary, and the remote links on an issue — this is how a ticket resolves to its Confluence page.' },
        { name: 'lookupJiraAccountId (read)', what: 'Resolves a name or email to an account ID, which is what assignee fields actually want.' },
        { name: 'searchAtlassian / fetchAtlassian (platform)', what: 'Rovo-powered natural-language search across Jira and Confluence together, and fetch-by-ARI. Reach for these when the question spans both products.' },
      ],
    },
    useCases: [
      {
        title: 'Sprint status without opening a board',
        prompt: 'Using JQL, find every issue in PROJ in the current sprint that is not Done, group them by assignee, and flag anything that has not been updated in 5 days.',
        why: 'One searchJiraIssuesUsingJql call plus model-side grouping. Naming JQL explicitly is the difference between a real query and a guess.',
      },
      {
        title: 'Meeting notes to a triaged backlog',
        prompt: 'Here are my notes. Create Jira issues in PROJ for each action item, set the issue type from getJiraProjectIssueTypesMetadata, assign each one with lookupJiraAccountId, and show me the list before you create anything.',
        why: 'The metadata and account-ID lookups are what stop the create call failing on a required custom field or an unresolvable assignee. Atlassian ships a "capture tasks from meeting notes" skill for this exact flow.',
      },
      {
        title: 'Close the loop on a release ticket',
        prompt: 'For PROJ-812, list the available transitions, move it to the one that means code review is finished, and add a comment linking the Confluence release-plan page.',
        why: 'Exercises getTransitionsForJiraIssue before transitionJiraIssue — the ordering that avoids an invalid-transition error on a customised workflow.',
      },
    ],
    gotchas: [
      {
        question: 'Which Atlassian MCP endpoint should I use — /v1/mcp or /v1/mcp/authv2?',
        answer:
          'Use https://mcp.atlassian.com/v1/mcp/authv2 for a normal browser-based OAuth 2.1 login; it is the endpoint Atlassian recommends and the one in its own .mcp.json, its Cursor and VS Code install links, and its Claude Code command. https://mcp.atlassian.com/v1/mcp still works and is the one the docs reference for API-token configurations. The legacy SSE endpoint https://mcp.atlassian.com/v1/sse is still supported but Atlassian advises moving custom clients off it to /mcp or /mcp/authv2. Both current endpoints are listed as remotes in the server.json Atlassian publishes to the MCP registry.',
      },
      {
        question: 'Why do I get "Your site admin must authorize this app"?',
        answer:
          'Because nobody has completed the first 3LO consent for your site yet. The Rovo MCP app is installed just-in-time rather than through the Marketplace, and the first person to consent must have access to all the products the MCP scopes ask for. An admin needs to run the connection flow once; after that, users with access to only one product can consent for that product.',
      },
      {
        question: 'Why do Jira Service Management or Bitbucket tools not appear?',
        answer:
          'They are not available over OAuth 2.1 at all. Jira Service Management and Bitbucket Cloud tools require API token authentication, and Bitbucket needs a scoped token specifically; Compass is the mirror image and is OAuth-only. API token auth also has to be switched on by an org admin under Atlassian Administration → Rovo → Rovo MCP server → Authentication before any token will work.',
      },
      {
        question: 'Why does the connection fail with a permission error from my machine?',
        answer:
          'If your organisation uses IP allowlisting for Atlassian Cloud, calls through the MCP server honour it, and you will see "You don\'t have permission to connect from this IP address." Connect from an allowed network or VPN range, or have an admin add yours. Separately, an OAuth flow that loops or fails to redirect usually means the browser is blocking pop-ups or http://localhost:3334 is blocked.',
      },
      {
        question: 'It connects but returns nothing, or only some of my issues.',
        answer:
          'Empty or partial results are the documented symptom of an expired token or missing scopes — re-authenticate and check what you approved at login. A total silence is more often that the tools were never enabled for the session: re-run the connection flow and enable the Jira tools. Everything the server returns is filtered by your existing Jira project and issue permissions, so a query that works in the browser under one account will legitimately return less under another.',
      },
      {
        question: 'Does the Atlassian MCP server work with Jira Server or Data Center?',
        answer:
          'No. It is a cloud-hosted bridge to Atlassian Cloud sites and there is no self-hosted build of it. For Server or Data Center you need a community server that talks to your own instance with a Personal Access Token — see the comparison below.',
      },
      {
        question: 'Can I use it from a script or CI, with no browser?',
        answer:
          'Yes, via API token authentication, which exists for exactly these headless and service-style setups. It needs the admin enablement described above plus a personal API token scoped to the tools you intend to call. Every tool call is written to the organisation audit log under Rovo MCP User Actions either way, which is worth knowing before pointing an unattended agent at it.',
      },
    ],
    comparison: {
      note:
        'One hosted server covers several products, so "which Jira MCP server" is usually really a question about deployment and auth.',
      items: [
        {
          name: 'Confluence, same server',
          slug: 'confluence',
          choose: 'Nothing extra to install — the same connection carries the Confluence tools. Our Confluence guide covers that tool surface and the CQL side.',
        },
        {
          name: 'sooperset/mcp-atlassian (community)',
          choose: 'The one to use for Jira Server or Data Center, which the official server does not support. Runs locally via uvx mcp-atlassian, covers Confluence v6.0+ and Jira v8.14+, and authenticates with a Personal Access Token on self-hosted or an API token on Cloud. Not an Atlassian product.',
        },
        {
          name: 'Bitbucket',
          slug: 'bitbucket',
          choose: 'Bitbucket over the official server is API-token-only and admin-gated. If you want OAuth or a richer pull-request tool surface, the community Bitbucket server is the pragmatic pick.',
        },
        {
          name: 'mcp-remote',
          slug: 'mcp-remote',
          choose: 'Not an alternative — the proxy your client runs if it cannot speak streamable HTTP itself. This is why Node.js v18+ shows up in the prerequisites.',
        },
      ],
    },
  },
  {
    slug: 'confluence',
    verifiedOn: '2026-08-10',
    sources: [
      { label: 'atlassian/atlassian-mcp-server README', url: 'https://github.com/atlassian/atlassian-mcp-server' },
      { label: 'Atlassian Support — Supported tools', url: 'https://support.atlassian.com/atlassian-rovo-mcp-server/docs/supported-tools/' },
      { label: 'Atlassian Support — Getting started with the Atlassian Rovo MCP Server', url: 'https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/' },
      { label: 'sooperset/mcp-atlassian README', url: 'https://github.com/sooperset/mcp-atlassian' },
    ],
    intro:
      'Confluence has no MCP server of its own. It is a product surface on the Atlassian Rovo MCP Server, the same hosted endpoint that serves Jira, so if you already connected for Jira you already have the Confluence tools and there is nothing else to install. What is worth reading separately is the tool surface, because it is shaped nothing like Jira\'s: content is addressed by page ID rather than by a human-readable key, search is CQL and not JQL, and comments split into two distinct types with separate create and read tools. Most disappointing first sessions with Confluence over MCP come from one of those three, not from the connection.',
    setup: {
      title: 'Connecting Confluence and pointing it at the right space',
      steps: [
        {
          title: 'Add the server, if you have not already for Jira',
          body:
            'Same endpoint, same OAuth 2.1 consent. Use https://mcp.atlassian.com/v1/mcp/authv2 rather than the older /v1/mcp that circulates in older config — both resolve, but authv2 is the one Atlassian recommends and ships in its own config file.',
          code: 'claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp/authv2',
          codeLabel: 'shell',
        },
        {
          title: 'Confirm the Confluence tools were actually enabled',
          body:
            'Confluence has its own read/write/search permission groups that an org admin grants independently of Jira\'s, so a working Jira connection tells you nothing about Confluence. Ask for your spaces first — it is the cheapest call that proves read access end to end. If it comes back empty, re-run the connection flow and enable the Confluence tools; Atlassian lists that as the documented cause of a silent client.',
          code: 'What Confluence spaces do I have access to?',
          codeLabel: 'prompt',
        },
        {
          title: 'Pin the spaceId, not the space name',
          body:
            'Confluence tools want a numeric spaceId, and every session that lacks one starts by listing spaces to find it. Add it to AGENTS.md alongside the cloudId. The limit line matters here more than in Jira: a CQL search across a large wiki returns page bodies, and unbounded results are the usual reason a Confluence session runs out of context halfway through an answer.',
          code: '## Atlassian Rovo MCP\n\nWhen connected to atlassian-rovo-mcp:\n- **MUST** use Confluence spaceId = "123456"\n- **MUST** use cloudId = "https://yoursite.atlassian.net" (do NOT call getAccessibleAtlassianResources)\n- **MUST** use `limit: 10` for ALL Confluence CQL search operations.',
          codeLabel: 'markdown',
        },
      ],
    },
    tools: {
      title: 'The Confluence tools, by permission group',
      note:
        'Seven read tools, four write, one search. Note what is absent: there is no delete, no page-move and no attachment tool, so an agent cannot destroy a page tree through this server however it is prompted — the worst it can do is create clutter or overwrite a body with updateConfluencePage.',
      items: [
        { name: 'getConfluencePage (read)', what: 'Fetch a page or live doc by ID. Live docs are handled by the same tool, not a separate one.' },
        { name: 'searchConfluenceUsingCql (search)', what: 'The only Confluence search, and it takes CQL — Confluence Query Language, a different syntax from Jira\'s JQL. Ask the model to show the CQL it used when results look wrong.' },
        { name: 'getConfluenceSpaces (read)', what: 'Lists the spaces you can see; how you find a spaceId once, so you can pin it.' },
        { name: 'getPagesInConfluenceSpace (read)', what: 'The pages in a space — the flat listing.' },
        { name: 'getConfluencePageDescendants (read)', what: 'The subtree under a parent page. This, not the flat listing, is what answers "summarise this section of the wiki".' },
        { name: 'createConfluencePage (write)', what: 'Creates a page or live doc. Needs the spaceId, which is why pinning it removes a whole discovery round-trip.' },
        { name: 'updateConfluencePage (write)', what: 'Updates an existing page or live doc. It replaces content rather than appending, so ask for a diff before letting it run on a page anyone depends on.' },
        { name: 'getConfluencePageFooterComments / createConfluenceFooterComment', what: 'The comment thread at the bottom of a page. Create also handles replies.' },
        { name: 'getConfluencePageInlineComments / createConfluenceInlineComment', what: 'Comments anchored to selected text. Separate from footer comments in both directions — reading one does not return the other, which is the usual reason "it missed my comment".' },
        { name: 'getConfluenceCommentChildren (read)', what: 'Replies to a comment. Threads are not returned nested by default; this is how you walk them.' },
        { name: 'searchAtlassian / fetchAtlassian (platform)', what: 'Rovo natural-language search across Confluence and Jira together, and fetch-by-ARI. The right tool when the question crosses products — "the doc linked from this ticket".' },
        { name: 'getTeamworkGraphContext / getTeamworkGraphObject (platform)', what: 'The relationship layer between Atlassian entities. What makes a page resolve to the work items and people around it instead of being read as loose text.' },
      ],
    },
    useCases: [
      {
        title: 'Summarise a documentation subtree, not a single page',
        prompt: 'Get the descendants of Confluence page 1234567, then summarise the onboarding process they describe as a numbered list, and tell me which of those pages contradict each other.',
        why: 'getConfluencePageDescendants is the tool people miss. Pointing at a parent page and asking for descendants is what turns a wiki section into a single answer.',
      },
      {
        title: 'Find the doc behind the ticket',
        prompt: 'For PROJ-812, list its remote issue links, open the Confluence page they point to, and tell me whether the acceptance criteria in the ticket match the spec on the page.',
        why: 'Crosses both products in one session — getJiraIssueRemoteIssueLinks on the Jira side, getConfluencePage on the other. This is the case the single shared server exists for.',
      },
      {
        title: 'Draft into the wiki with review before write',
        prompt: 'Search Confluence with CQL for pages in space 123456 updated in the last 30 days about our deployment process, then draft a consolidated runbook page. Show me the draft; do not create the page until I say so.',
        why: 'createConfluencePage is a write tool with no undo through MCP. Making the draft an explicit checkpoint is the habit that keeps that safe.',
      },
    ],
    gotchas: [
      {
        question: 'Do I need a separate Confluence MCP server if I already set up Jira?',
        answer:
          'No. Jira and Confluence are two product surfaces on the same hosted Atlassian Rovo MCP Server at https://mcp.atlassian.com/v1/mcp/authv2 — one connection, one OAuth consent. What can differ is authorisation: Confluence read, write and search are separate permission groups that an admin grants independently, so Jira can work perfectly while Confluence returns nothing.',
      },
      {
        question: 'Why does Confluence search ignore what I asked for?',
        answer:
          'Because searchConfluenceUsingCql takes CQL, not JQL and not English. The model writes the query, and a wrong query looks exactly like a bad answer. Ask it to print the CQL it ran. For genuinely fuzzy questions, searchAtlassian — the Rovo natural-language tool — is usually the better instrument than trying to coax CQL out of a vague prompt.',
      },
      {
        question: 'It did not see my comment on the page.',
        answer:
          'Confluence has two comment types and the server keeps them apart. getConfluencePageFooterComments returns the thread at the bottom of the page; getConfluencePageInlineComments returns comments anchored to selected text. Neither includes the other, and replies need getConfluenceCommentChildren on top. Say which kind you mean, or ask for both.',
      },
      {
        question: 'Can it delete or move Confluence pages?',
        answer:
          'No. The write group is createConfluencePage, updateConfluencePage and the two comment-creation tools — there is no delete, no move and no attachment tool in the supported set. The real risk is updateConfluencePage replacing a body, so review before write on any page that matters. Every call is recorded in the organisation audit log under Rovo MCP User Actions.',
      },
      {
        question: 'Why can it read some spaces and not others?',
        answer:
          'The server never widens your access — results are filtered by your existing Confluence space and page permissions, so restricted spaces are invisible to it exactly as they are to you in the browser. If a space you can genuinely open is still missing, the documented causes are an expired token or scopes you did not approve at login; re-authenticate and check the consent screen.',
      },
      {
        question: 'Does this work with Confluence Data Center?',
        answer:
          'No — the official server is Cloud-only. sooperset/mcp-atlassian is the community server for self-hosted, covering Confluence v6.0+ and Jira v8.14+ with a Personal Access Token, run locally with uvx mcp-atlassian. It is not an Atlassian product and its auth model is a long-lived token rather than OAuth, so scope it narrowly.',
      },
    ],
    comparison: {
      items: [
        {
          name: 'Jira, same server',
          slug: 'jira',
          choose: 'The other half of this connection. Our Jira guide covers the endpoint choice, the 3LO admin-consent trap and the JQL tool surface in full.',
        },
        {
          name: 'sooperset/mcp-atlassian (community)',
          choose: 'Pick this when Confluence is Server or Data Center, or when you need a locally run process instead of a hosted endpoint. Cloud is supported too, via API token.',
        },
        {
          name: 'Notion',
          slug: 'notion',
          choose: 'If the question is really "which wiki should my agent write into", Notion\'s hosted MCP server has the closer equivalent of a full page-editing surface. Confluence over MCP cannot delete or move anything.',
        },
      ],
    },
  },
  {
    slug: 'datadog',
    verifiedOn: '2026-08-10',
    sources: [
      { label: 'Datadog docs — Set Up the Datadog MCP Server', url: 'https://docs.datadoghq.com/mcp_server/setup/' },
      { label: 'Datadog docs — MCP Server Tools reference', url: 'https://docs.datadoghq.com/mcp_server/tools/' },
      { label: 'Datadog docs — MCP Server overview', url: 'https://docs.datadoghq.com/bits_ai/mcp_server/' },
    ],
    intro:
      'There is nothing to install. The Datadog MCP Server is a hosted endpoint on your own Datadog site — `https://mcp.<your-site>/api/unstable/mcp-server/mcp` — and you authorise it with OAuth from inside your client, not with a package and a pair of keys. Two things decide whether the setup goes well. First, use the vendor plugin or connector for your client rather than a hand-written config: Datadog ships one for Claude Code, Claude, Cursor, VS Code/Copilot, JetBrains and OpenCode, and the docs say to remove any earlier manual entry so the two do not fight. Second, choose your toolsets. The default `core` toolset is deliberately small; the full catalogue runs to hundreds of tools across two dozen toolsets, and `toolsets=all` will eat a large share of your context window before you have asked anything.',
    setup: {
      title: 'Connecting to the Datadog MCP Server',
      steps: [
        {
          title: 'Check your site is supported',
          body:
            'The MCP Server is not GovCloud compatible — it is unavailable on app.ddog-gov.com and us2.ddog-gov.com. Everything else (US1, US3, US5, EU1, AP1, AP2, UK1) is supported. Your endpoint is the mcp. host for your own site, so a US1 org uses https://mcp.datadoghq.com/api/unstable/mcp-server/mcp and an EU1 org uses https://mcp.datadoghq.eu/api/unstable/mcp-server/mcp. Getting this wrong is the usual cause of an auth loop that never completes: the org you log into has to be the org the host belongs to.',
        },
        {
          title: 'Grant yourself mcp_read (and mcp_write if you want writes)',
          body:
            'Datadog gates MCP behind two role permissions of its own, on top of the normal resource permissions. `mcp_read` covers reading tools, `mcp_write` covers anything that creates or modifies. The Standard Role has both already; a custom role needs the MCP Read / MCP Write checkboxes ticked under Organization Settings → Roles. The resource permission still applies as well — reading monitors needs `mcp_read` *and* Monitors Read, which is why a correctly connected server can still answer "no monitors found".',
        },
        {
          title: 'Claude Code — install the plugin, not a raw server entry',
          body:
            'The plugin bundles the server with Datadog\'s own skills and auto-updates. After installing, `/ddsetup` picks your site and runs the OAuth flow, `/ddtoolsets` turns on product toolsets, and `/reload-plugins` applies changes. If you had added the server by hand before, delete that entry first.',
          code: `/plugin install datadog@claude-plugins-official
/ddsetup
/ddtoolsets`,
          codeLabel: 'Claude Code',
        },
        {
          title: 'Claude (desktop and web) — use the directory connector',
          body:
            'Install the Datadog connector from the Claude Connectors Directory via + → Add Connector, then complete OAuth. It includes MCP Apps for in-product visualisations, which a custom connector pointed at the same URL does not get. Again: if Datadog is already there as a custom connector, remove it to avoid conflicts.',
        },
        {
          title: 'Any other client — add the endpoint over HTTP',
          body:
            'For clients with no plugin, add the endpoint as a streamable-HTTP server and let the client run OAuth. Append `?toolsets=` to the URL to pick tool groups — this only works on the remote/OAuth path, and the Codex CLI wants the `X-Datadog-MCP-Toolsets` header instead of the query parameter.',
          code: 'claude mcp add --transport http datadog-mcp "https://mcp.datadoghq.com/api/unstable/mcp-server/mcp?toolsets=core,dbm"',
          codeLabel: 'shell',
        },
        {
          title: 'CI or a server, where OAuth cannot run — use a token header',
          body:
            'Header auth is the documented fallback. A Personal Access Token (for a user) or Service Access Token (for a service account) as a bearer token is preferred, and needs no API key at all. The older form — `DD_API_KEY` plus `DD_APPLICATION_KEY` as HTTP headers — still works, and is worth knowing because it is what almost every third-party write-up about this server describes as *the* way in.',
          code: `{
  "mcpServers": {
    "datadog": {
      "type": "http",
      "url": "https://mcp.datadoghq.com/api/unstable/mcp-server/mcp",
      "headers": { "Authorization": "Bearer <YOUR_ACCESS_TOKEN>" }
    }
  }
}`,
          codeLabel: 'mcp.json',
        },
      ],
    },
    tools: {
      title: 'Toolsets, and the tools worth knowing in each',
      note:
        'Only `core` loads by default. Generally-available toolsets are alerting, audit-trail, cost, dashboards, data-observability, dbm, ddsql, error-tracking, feature-flags, kubernetes, llmobs, networks, onboarding, product-analytics, profiling, reference-tables, rum, security, software-delivery, synthetics, widgets and workflows. Four more are in Preview and are excluded from `toolsets=all` — ask for `apm`, `cases`, `code-exec` or `remote-actions` by name. `omit_tools=` drops individual tools after toolsets resolve, which is how you keep a toolset but remove its write half.',
      items: [
        { name: 'search_datadog_logs / analyze_datadog_logs', what: 'core. The first searches and returns log events; the second runs SQL over them for counts and aggregations. Both need Logs Read Data and Logs Read Index Data.' },
        { name: 'get_datadog_metric / get_datadog_metric_context', what: 'core. Query a metric, and separately discover its tags and tag values so the query can be filtered correctly. The context call is the one people skip and then wonder why a tag filter matches nothing.' },
        { name: 'get_datadog_trace / search_datadog_spans', what: 'core. Fetch a full trace by trace ID, or search spans. Large traces may come back truncated.' },
        { name: 'search_datadog_monitors / create_datadog_monitor', what: 'core / alerting. Note the deliberate safety rail: a monitor created over MCP lands in draft and sends no notifications until it is published in the UI.' },
        { name: 'get_monitor_coverage', what: 'alerting. Answers "what is not monitored" for a service or host — the question that is tedious to ask any other way.' },
        { name: 'ddsql_run_query (+ ddsql_get_spec, ddsql_schema_search_tables)', what: 'ddsql. SQL across infrastructure, logs, metrics, RUM and spans. Have the agent read the spec and schema first; DDSQL is not standard SQL.' },
        { name: 'get_datadog_database_explain_plans / optimize_datadog_database_query', what: 'dbm. PostgreSQL explain plans and optimisation analysis pulled from Database Monitoring, keyed by query signature.' },
        { name: 'execute_code', what: 'code-exec, Preview. Runs agent-authored TypeScript in a Datadog-managed sandbox with direct API access — one call instead of a dozen tool round-trips for a multi-signal investigation.' },
        { name: 'datadog_remote_action_restricted_shell_run_command', what: 'remote-actions, Preview. Read-only shell commands on an Agent-instrumented host, through a Private Action Runner. Needs Connections Resolve and Private Action Runner Contribute.' },
      ],
    },
    useCases: [
      {
        title: 'Incident triage across three signals',
        prompt:
          'The checkout service p99 spiked in the last hour. Pull the metric, find the slowest spans in that window, and search ERROR logs for that service over the same range. Tell me what changed.',
        why: 'This is what the server is for: the correlation step is the expensive part of on-call, and core alone covers metrics, spans and logs.',
      },
      {
        title: 'Find the monitoring gaps before the next incident',
        prompt: 'Using get_monitor_coverage, list the services in the catalog with no latency or error-rate monitor, then draft monitors for the top three as drafts.',
        why: 'Drafts do not page anyone, so this is safe to run against production. You review and publish in the UI.',
      },
      {
        title: 'Cost, without opening a dashboard',
        prompt: 'List the current cost recommendations ranked by estimated daily savings, and for the top one explain which resources it applies to.',
        why: 'Needs the `cost` toolset and Cloud Cost Management Read; it is a one-call answer that otherwise takes a meeting.',
      },
    ],
    gotchas: [
      {
        question: 'Does the Datadog MCP server need DD_API_KEY and DD_APP_KEY?',
        answer:
          'No. OAuth is the recommended path and manages no long-lived credentials at all; a Personal or Service Access Token as an `Authorization: Bearer` header is the preferred fallback and needs no API key. API-key auth does exist, but the header names are `DD_API_KEY` and `DD_APPLICATION_KEY` — not `DD_APP_KEY` — and it is the last option in Datadog\'s own docs, not the first.',
      },
      {
        question: 'Is there an npm package for the Datadog MCP server?',
        answer:
          'No. It is a hosted endpoint on your Datadog site, so there is nothing to `npx`. What is packaged is the client-side integration: the Claude Code plugin, the Cursor and Copilot plugins, the Claude connector and the OpenCode plugin. Any install command you find that npx-installs a "datadog-mcp" package is a third-party server, not this one.',
      },
      {
        question: 'Why does Datadog MCP only show a handful of tools?',
        answer:
          'Because `core` is the default toolset and everything else is opt-in. Add `?toolsets=...` to the endpoint URL, or run `/ddtoolsets` in Claude Code. Preview toolsets (`apm`, `cases`, `code-exec`, `remote-actions`) are not in `toolsets=all` and must be named explicitly.',
      },
      {
        question: 'Why do I get "no results" even though the connection works?',
        answer:
          'Almost always a permission, not a bug. `mcp_read` gets you the tool; the resource permission gets you the data. Reading monitors needs Monitors Read as well, logs need Logs Read Data *and* Logs Read Index Data, APM needs APM Read. Custom roles are where this bites.',
      },
      {
        question: 'Are there rate limits on the Datadog MCP server?',
        answer:
          'Yes, and the docs say they are subject to change: a burst limit of 50 requests per 10 seconds on tool calls, and 50,000 tool calls per month. MCP usage data is retained for 120 days.',
      },
      {
        question: 'Can I use the Datadog MCP server on GovCloud?',
        answer: 'No. It is explicitly not GovCloud compatible — unsupported on app.ddog-gov.com and us2.ddog-gov.com.',
      },
      {
        question: 'Can I stop the agent from being able to change things?',
        answer:
          'Three ways, and they compose. Do not grant `mcp_write`. Use `omit_tools=` to strip specific write tools from the list the client ever sees. And restrict where connections can come from with the org IP allowlist, which applies to the MCP server too.',
      },
    ],
    comparison: {
      note: 'The alternatives here are not other Datadog servers — they are the other observability endpoints your agent might reach for.',
      items: [
        {
          name: 'Datadog Claude Code plugin vs. a manual server entry',
          choose: 'Use the plugin. It carries skills, auto-updates, and Datadog explicitly says to remove a manual entry if you install it. Hand-written config is for clients with no plugin.',
        },
        {
          name: 'Sentry',
          slug: 'sentry',
          choose: 'For error-first debugging with stack traces and release attribution. Datadog gets you the whole telemetry surface; Sentry gets you deeper into one exception.',
        },
        {
          name: 'Grafana',
          slug: 'grafana',
          choose: 'When your data lives in Prometheus/Loki and Grafana is the pane of glass. The Grafana server is a locally run process against your own stack, not a vendor-hosted endpoint.',
        },
      ],
    },
  },
  {
    slug: 'hubspot',
    verifiedOn: '2026-08-10',
    sources: [
      { label: 'HubSpot developers — MCP Server', url: 'https://developers.hubspot.com/mcp' },
      { label: 'HubSpot changelog — MCP Server public beta', url: 'https://developers.hubspot.com/changelog/mcp-server-beta' },
      { label: 'Live check — mcp.hubspot.com OAuth resource metadata', url: 'https://mcp.hubspot.com/.well-known/oauth-protected-resource' },
    ],
    intro:
      'Three different things get called "the HubSpot MCP server", and the one most write-ups describe is the one you probably do not want. The current answer for working with CRM data is a hosted remote server at https://mcp.hubspot.com, authorised with OAuth against a user-level app. Separately there is a Developer MCP server, installed locally through the HubSpot CLI with `hs mcp setup`, whose job is helping you *build HubSpot apps* — not query contacts. And there is the original May-2025 public beta, an npm package configured with a private-app access token; that is the version nearly every blog post still copies, and it is not what HubSpot documents today.',
    setup: {
      title: 'Connecting to the HubSpot MCP server',
      steps: [
        {
          title: 'Decide which server you actually need',
          body:
            'CRM data — contacts, companies, deals, tickets, engagements? Remote server, below. Building or debugging a HubSpot app, project or UI extension? That is the Developer MCP server: `npm i -g @hubspot/cli` then `hs mcp setup`, which prompts you to pick your agentic tools. It requires Developer Platform v2025.2. The two are not substitutes for each other.',
          code: 'hs mcp setup',
          codeLabel: 'shell',
        },
        {
          title: 'Create a user-level app with the scopes you want',
          body:
            'Access is controlled by a HubSpot user-level app and its scopes, and this is the step that decides what the agent can touch. Grant read scopes for the CRM objects you want reachable and nothing else — the app, not the client, is your blast-radius control.',
        },
        {
          title: 'Add the endpoint to your client and complete OAuth',
          body:
            'The endpoint is the bare host, https://mcp.hubspot.com — with no /mcp path. (Verified: a POST to the root returns 401 with `WWW-Authenticate: Bearer resource_metadata="https://mcp.hubspot.com/.well-known/oauth-protected-resource"`, while /mcp returns 404. If your client reports "not found" rather than an auth prompt, you have a path on the end.)',
          code: 'claude mcp add --transport http hubspot https://mcp.hubspot.com',
          codeLabel: 'shell',
        },
        {
          title: 'Point it at a sandbox first',
          body:
            'HubSpot\'s own beta guidance is to experiment in a developer sandbox or other non-production account, and to read every write confirmation prompt rather than clicking through it: "LLM\'s are prone to hallucination, always review when prompted for permission to use an MCP tool that makes changes to your account." A CRM is a system of record; a hallucinated deal-stage update is a real one.',
        },
      ],
    },
    tools: {
      title: 'What the remote server can reach',
      note:
        'HubSpot documents this as data surface rather than a fixed tool list, and says the accessible types will increase over time as more MCP tools ship. The read/write versus read-only split is the part worth planning around.',
      items: [
        { name: 'CRM objects — read and write', what: 'Contacts, companies, deals, tickets, carts, products, orders, line items, invoices, quotes, subscriptions and segments (lists).' },
        { name: 'Engagements — read and write', what: 'Calls, emails, meetings, notes and tasks. This is what makes "log a note on this contact" work.' },
        { name: 'Associations', what: 'Reading and creating associations between objects — the contact-to-deal-to-company graph, not just flat records.' },
        { name: 'Organisational context — read only', what: 'Users, teams, reporting structures, owners, roles and seats.' },
        { name: 'Marketing and content — read only', what: 'Campaigns and campaign metrics, landing pages, website pages and blog posts.' },
        { name: 'UI navigation', what: 'Opening specific screens in the HubSpot UI, so the assistant can hand you off to the right record instead of describing it.' },
      ],
    },
    useCases: [
      {
        title: 'Brief yourself before a call',
        prompt: 'Find the contact for this email address, list their open deals with stage and amount, and summarise the last five engagements in date order.',
        why: 'Reads across objects, engagements and associations in one pass — exactly the join that is slow to do by clicking.',
      },
      {
        title: 'Log the call afterwards',
        prompt: 'Log a call engagement on that contact with these notes, then create a follow-up task for Thursday and associate both with the open deal.',
        why: 'Writes are the point of the write scopes; the association step is what keeps the record useful later.',
      },
      {
        title: 'Pipeline hygiene',
        prompt: 'List deals in the Proposal stage with no engagement in the last 21 days, with owner and amount. Do not change anything.',
        why: 'A read-only prompt against read-only scopes is the safest way to get value out of this server on day one.',
      },
    ],
    gotchas: [
      {
        question: 'Does the HubSpot MCP server use a private app access token?',
        answer:
          'Not the current one. The remote server at mcp.hubspot.com authorises with OAuth 2.0 against a user-level app; HubSpot has said it is moving to OAuth 2.1 with PKCE and refresh-token rotation. The private-app-token-in-a-JSON-config setup belongs to the original npm beta from May 2025, which is what most third-party guides still show.',
      },
      {
        question: 'What is the HubSpot MCP server URL?',
        answer:
          'https://mcp.hubspot.com, with nothing after the host. Adding /mcp gives a 404, not an auth challenge — a useful way to tell a wrong URL from a wrong token.',
      },
      {
        question: 'What is the difference between the HubSpot MCP server and the Developer MCP server?',
        answer:
          'Audience. The remote server exposes your CRM data to an assistant. The Developer MCP server, installed with `hs mcp setup` from the HubSpot CLI, helps you build on HubSpot\'s developer platform and requires Developer Platform v2025.2. The npm package @hubspot/mcp-server describes itself as the server "for developers building HubSpot Apps" — so if you installed that expecting contacts, you installed the other one.',
      },
      {
        question: 'Can HubSpot MCP read sensitive data properties?',
        answer:
          'No. Custom Sensitive Data Properties and Personal Health Information are excluded from what the server can access, independent of the scopes you grant.',
      },
      {
        question: 'Why can the assistant read contacts but not create anything?',
        answer:
          'Because the app was created with read scopes, which is what HubSpot\'s setup guidance suggests by default. Write access is a property of the user-level app\'s scopes; nothing in the client config can grant it.',
      },
      {
        question: 'Is the HubSpot MCP server generally available?',
        answer:
          'It entered public beta in May 2025 and HubSpot still describes it as evolving — more functionality, an improved authentication system, and a data surface that grows as tools are added. Treat tool availability as a moving target and re-read the docs before depending on a specific capability.',
      },
    ],
    comparison: {
      items: [
        {
          name: 'HubSpot/mcp-server (the beta repo)',
          choose: 'Historical. The repo exists and the npm package @hubspot/mcp-server is still published, but it is the developer-platform server; for CRM work the hosted endpoint is the documented path.',
        },
        {
          name: 'Salesforce',
          slug: 'salesforce',
          choose: 'The same job in the other CRM. If you are choosing between them for an agent, the deciding factor is usually which one your org already runs, not the MCP surface.',
        },
        {
          name: 'Airtable',
          slug: 'airtable',
          choose: 'When "CRM" is really a table you own. Airtable over MCP gives full field-level read/write with no scope model to negotiate, and no sensitive-property exclusions.',
        },
      ],
    },
  },
  {
    slug: 'n8n',
    verifiedOn: '2026-08-10',
    sources: [
      { label: 'czlonkowski/n8n-mcp README', url: 'https://github.com/czlonkowski/n8n-mcp' },
      { label: 'n8n-mcp — Claude Code setup guide', url: 'https://github.com/czlonkowski/n8n-mcp/blob/main/docs/CLAUDE_CODE_SETUP.md' },
      { label: 'n8n-mcp — self-hosting guide', url: 'https://github.com/czlonkowski/n8n-mcp/blob/main/docs/SELF_HOSTING.md' },
      { label: 'n8n docs — MCP Server Trigger node', url: 'https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.mcptrigger/' },
    ],
    intro:
      'n8n-MCP is not a workflow execution engine, and expecting it to be one is the single biggest source of disappointment with it. What it is: a searchable reference to 2,412 n8n nodes (829 core, 1,583 community) with 99% property coverage, 66.5% operation coverage, 2,352 workflow templates, and validators that check a node config or a whole workflow *before* you deploy it. Give it your instance\'s API credentials and it gains a second half — 16 management tools that create, update, deploy and inspect workflows on that instance. It is also a community project by Romuald Czlonkowski (22.6k★, MIT), not something n8n publishes, and it is unrelated to n8n\'s own MCP Server Trigger node, which points the other way: that node makes an n8n workflow *into* an MCP server for clients to call.',
    setup: {
      title: 'Setting up n8n-MCP',
      steps: [
        {
          title: 'Fastest path — the hosted instance',
          body:
            'dashboard.n8n-mcp.com is the maintainer\'s hosted version: sign up, take an API key, connect your client. Free tier is 100 tool calls per day and the node/template data is kept current, which is the part that goes stale in a local install.',
        },
        {
          title: 'Local — add it to Claude Code, docs tools only',
          body:
            'MCP_MODE=stdio is required, not cosmetic: without it the process writes log lines to stdout and the client reports JSON parse errors like "Unexpected token…". LOG_LEVEL=error and DISABLE_CONSOLE_OUTPUT=true exist for the same reason.',
          code: `claude mcp add n8n-mcp \\
  -e MCP_MODE=stdio \\
  -e LOG_LEVEL=error \\
  -e DISABLE_CONSOLE_OUTPUT=true \\
  -- npx n8n-mcp`,
          codeLabel: 'shell',
        },
        {
          title: 'Add your instance to unlock the management tools',
          body:
            'The n8n API credentials are optional. Without them you get documentation, templates and validation. With them you additionally get create/update/execute/inspect against that instance. For a local n8n, N8N_API_URL is http://localhost:5678 — or http://host.docker.internal:5678 if n8n-MCP itself runs in Docker.',
          code: `claude mcp add n8n-mcp \\
  -e MCP_MODE=stdio \\
  -e LOG_LEVEL=error \\
  -e DISABLE_CONSOLE_OUTPUT=true \\
  -e N8N_API_URL=https://your-n8n-instance.com \\
  -e N8N_API_KEY=your-api-key \\
  -- npx n8n-mcp`,
          codeLabel: 'shell',
        },
        {
          title: 'Docker, including the loopback trap',
          body:
            'The image is ghcr.io/czlonkowski/n8n-mcp:latest. If N8N_API_URL points at localhost or host.docker.internal you must also set WEBHOOK_SECURITY_MODE=moderate — the SSRF gate covers both webhook triggers and the API client, and the default `strict` mode rejects loopback addresses outright. `moderate` allows localhost while still blocking RFC1918 ranges and cloud metadata endpoints.',
          code: `{
  "mcpServers": {
    "n8n-mcp": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "MCP_MODE=stdio",
        "-e", "LOG_LEVEL=error",
        "-e", "DISABLE_CONSOLE_OUTPUT=true",
        "-e", "N8N_API_URL=http://host.docker.internal:5678",
        "-e", "N8N_API_KEY=your-api-key",
        "-e", "WEBHOOK_SECURITY_MODE=moderate",
        "ghcr.io/czlonkowski/n8n-mcp:latest"
      ]
    }
  }
}`,
          codeLabel: 'claude_desktop_config.json',
        },
        {
          title: 'Behind Cloudflare Access',
          body:
            'Set N8N_CF_CLIENT_ID and N8N_CF_CLIENT_SECRET; they are sent as CF-Access-Client-Id / CF-Access-Client-Secret on API requests, health probes and webhook executions. The token is scoped to the N8N_API_URL origin only — a webhook on a different host deliberately does not receive it.',
        },
      ],
    },
    tools: {
      title: 'The 23 tools, in the order you actually use them',
      note:
        'Seven documentation tools always load; the sixteen n8n_* management tools appear only when API credentials are present. `DISABLED_TOOLS` and `DISABLED_TOOL_OPERATIONS` (e.g. `n8n_executions:delete`) let you remove capabilities you do not want an agent to have.',
      items: [
        { name: 'search_templates / get_template', what: 'Start here. 2,352 templates, searchable by node type — `{searchMode: "by_nodes", nodeTypes: ["n8n-nodes-base.slack"]}`. Using a template requires the documented attribution line crediting its author.' },
        { name: 'search_nodes', what: 'Find nodes by keyword. `includeExamples: true` pulls real configurations; `source: "community"|"verified"` filters the 1,583 community nodes.' },
        { name: 'get_node', what: 'The token-economics tool. `detail: "minimal"` is ~200 tokens, `"standard"` is the default, `"full"` is 3,000–8,000 tokens per node. `mode: "search_properties"` with a propertyQuery finds one property without loading the schema; `mode: "docs"` returns readable markdown.' },
        { name: 'validate_node', what: 'Run `mode: "minimal"` first (<100ms, required fields only), then `mode: "full", profile: "runtime"` for full validation with suggested fixes.' },
        { name: 'validate_workflow', what: 'Whole-workflow check — connections and expressions, not just per-node fields. The documented order is minimal → full → workflow.' },
        { name: 'n8n_create_workflow / n8n_update_partial_workflow', what: 'Management. Partial (diff-style) updates need n8n 2.32+; they let an agent change one node without rewriting the workflow JSON.' },
        { name: 'n8n_autofix_workflow / n8n_validate_workflow', what: 'Validate what is already deployed, and attempt repairs against the live instance.' },
        { name: 'n8n_test_workflow / n8n_executions', what: 'Trigger a workflow and read execution history — the closest this server comes to "running" things, and only with API credentials.' },
        { name: 'n8n_manage_credentials / n8n_audit_instance / n8n_health_check', what: 'Instance-level operations. Folder management needs n8n 2.19+; some evaluation features need 2.30+.' },
      ],
    },
    useCases: [
      {
        title: 'Build a workflow that works on the first deploy',
        prompt:
          'Search templates for a Slack-to-Google-Sheets workflow. If nothing fits, find the nodes, get their standard details with examples, configure every parameter explicitly, then validate each node and the whole workflow before creating it.',
        why: 'This is the documented pattern, and the reason it exists is the failure mode below: relying on default parameter values is the primary cause of runtime failures.',
      },
      {
        title: 'Explain a node you have never used',
        prompt: 'Get the docs for the n8n LangChain AI Agent node and list which properties are required versus optional, with an example config.',
        why: 'No API credentials needed — this half of the server is a documentation index, which is also why it is useful before you have an instance at all.',
      },
      {
        title: 'Fix a broken deployed workflow',
        prompt: 'Validate workflow <id> on my instance, then use a partial update to fix only the nodes that fail validation. Show me the diff before applying it.',
        why: 'Partial updates (n8n 2.32+) keep the change small, which matters because the project\'s own top-line warning is never to let AI edit production workflows directly.',
      },
    ],
    gotchas: [
      {
        question: 'Can n8n-MCP execute my n8n workflows?',
        answer:
          'Only indirectly, and only with credentials. The server itself is a documentation, template and validation layer; workflow execution happens through the n8n_* management tools calling your instance\'s API, which requires N8N_API_URL and N8N_API_KEY. With no credentials it cannot run anything at all.',
      },
      {
        question: 'Is n8n-mcp the official n8n MCP server?',
        answer:
          'No. It is a community project by Romuald Czlonkowski (MIT, 22.6k stars) and is not published by n8n. The confusion is worth clearing up because n8n does ship MCP functionality of its own — the MCP Server Trigger node — which does the opposite thing: it exposes an n8n workflow as an MCP server over SSE or Streamable HTTP, with bearer or header auth, at a randomly generated URL path. It does not support stdio.',
      },
      {
        question: 'Why do I get "Unexpected token" JSON errors in Claude Desktop?',
        answer:
          'MCP_MODE is not set to stdio. Without it, log output goes to stdout and corrupts the JSON-RPC stream. Set MCP_MODE=stdio, and LOG_LEVEL=error plus DISABLE_CONSOLE_OUTPUT=true alongside it.',
      },
      {
        question: 'Why does it fail to reach my local n8n instance?',
        answer:
          'The SSRF gate. Default WEBHOOK_SECURITY_MODE is strict, which rejects loopback addresses for both webhook triggers and the API client. Set WEBHOOK_SECURITY_MODE=moderate when N8N_API_URL is localhost or host.docker.internal — it still blocks private networks and cloud metadata.',
      },
      {
        question: 'Why does the agent build workflows that fail at runtime?',
        answer:
          'Because it left parameters at their defaults. The project states this directly: default values are the primary cause of runtime failures, so every parameter controlling node behaviour must be configured explicitly. Coverage is also uneven — 66.5% of node operations are documented, and `includeExamples` availability varies by node popularity.',
      },
      {
        question: 'How much context does it consume?',
        answer:
          'Enough to plan for. `get_node` with `detail: "full"` costs 3,000–8,000 tokens per node, so use `minimal` or `standard`, or `mode: "search_properties"` to fetch one property. Minimal validation returns in under 100ms.',
      },
      {
        question: 'Is it safe to point at production?',
        answer:
          'The maintainer\'s own answer is no: copy the workflow first, test in development, export backups, validate before deploying. If you need a harder guarantee, use DISABLED_TOOLS or DISABLED_TOOL_OPERATIONS to remove destructive operations from the tool list entirely.',
      },
    ],
    comparison: {
      items: [
        {
          name: 'n8n MCP Server Trigger (built into n8n)',
          choose: 'Use this when you want your n8n workflows to be tools an agent can call. SSE or Streamable HTTP, bearer/header auth, no stdio. It is the mirror image of n8n-mcp, not a competitor.',
        },
        {
          name: 'dashboard.n8n-mcp.com (hosted)',
          choose: 'Pick the hosted tier when you do not want to keep a node/template database current. 100 tool calls/day free; self-host when you need more or cannot send queries out.',
        },
        {
          name: 'Zapier',
          slug: 'zapier',
          choose: 'If the goal is "let the agent trigger automations" and you have no n8n instance, Zapier\'s MCP surface is action-oriented out of the box. n8n-mcp is for building n8n workflows, which is a different job.',
        },
      ],
    },
  },
  {
    slug: 'blender-mcp',
    verifiedOn: '2026-08-10',
    sources: [
      { label: 'blender-mcp on PyPI (README, v1.8.0)', url: 'https://pypi.org/project/blender-mcp/' },
      { label: 'BlenderMCP official site', url: 'https://blendermcp.org/' },
      { label: 'Live check — GitHub repo redirect and PyPI release metadata', url: 'https://pypi.org/pypi/blender-mcp/json' },
    ],
    intro:
      'BlenderMCP is two pieces, and people who install one and not the other account for most of the "it connects but nothing happens" reports. `addon.py` runs inside Blender and opens a socket server on port 9876; the `blender-mcp` Python package is the MCP server your client speaks to, which relays commands into that socket. So Blender has to be open, the addon has to be enabled, and you have to have pressed "Connect to Claude" in the BlenderMCP sidebar tab before any tool call can work. Requirements are Blender 3.0+ and Python 3.10+, and the install is via uv — the project is emphatic that you install uv with its official installer, not `pip install uv`, which may not create the `uvx` command your client needs.',
    setup: {
      title: 'Setting up BlenderMCP',
      steps: [
        {
          title: 'Install uv properly',
          body:
            'macOS: `brew install uv`. Windows: `powershell -c "irm https://astral.sh/uv/install.ps1 | iex"`, then add %USERPROFILE%\\.local\\bin to your user PATH and restart the client. Linux: `curl -LsSf https://astral.sh/uv/install.sh | sh`, then open a new shell. Do not proceed before uv works.',
          code: 'brew install uv   # macOS',
          codeLabel: 'shell',
        },
        {
          title: 'Install and enable the Blender addon',
          body:
            'Download addon.py from the project, then in Blender: Edit → Preferences → Add-ons → Install…, select addon.py, and tick the box next to "Interface: Blender MCP". Note that the upstream GitHub repository currently does not resolve — github.com/ahujasid/blender-mcp redirects to github.com/MCPBlender/blender-mcp, which returns 404 as of this verification date — so blendermcp.org is the place to start looking for the addon file. The PyPI release is unaffected and current.',
        },
        {
          title: 'Add the server to your client',
          body:
            'Claude Desktop: Settings → Developer → Edit Config. Claude Code: `claude mcp add blender uvx blender-mcp`. Cursor takes the same JSON globally or in .cursor/mcp.json. On Windows, wrap it: `"command": "cmd", "args": ["/c", "uvx", "blender-mcp"]`. Run only one instance of the MCP server — Cursor or Claude Desktop, not both.',
          code: `{
  "mcpServers": {
    "blender": {
      "command": "uvx",
      "args": ["blender-mcp"]
    }
  }
}`,
          codeLabel: 'claude_desktop_config.json',
        },
        {
          title: 'If the client cannot find uvx',
          body:
            'A GUI-launched client does not inherit your terminal PATH, so a bare `"command": "uvx"` can fail with `spawn uvx ENOENT` even though uvx works in a shell. Use the absolute path from `which uvx` / `where uvx` (e.g. /opt/homebrew/bin/uvx), then fully quit and relaunch the client — Cmd-Q on macOS, quit from the system tray on Windows.',
        },
        {
          title: 'Pin Python if you have conda, pyenv or asdf',
          body:
            'uv picks the interpreter, and on machines with an auto-activated conda base it can pick one that fails to build dependencies. Pin 3.11 and prefer uv-managed interpreters. If a failed attempt keeps replaying after you fix it, clear the cache: `uv cache clean blender-mcp && uvx --refresh blender-mcp`.',
          code: `{
  "mcpServers": {
    "blender": {
      "command": "uvx",
      "args": ["--python", "3.11", "blender-mcp"],
      "env": { "UV_PYTHON_PREFERENCE": "only-managed" }
    }
  }
}`,
          codeLabel: 'mcp config',
        },
        {
          title: 'Start the connection inside Blender',
          body:
            'In the 3D View sidebar (press N), open the BlenderMCP tab, optionally tick Poly Haven to allow asset downloads, and click "Connect to Claude". Do not run the uvx command yourself in a terminal — the client starts it. Sometimes the first command does not go through and it works from the second onward.',
        },
      ],
    },
    tools: {
      title: 'What it can do, and the asset services behind it',
      note:
        'Communication is a JSON protocol over TCP — commands carry a type and optional params, responses carry a status plus result or message. BLENDER_HOST (default localhost) and BLENDER_PORT (default 9876) let the MCP server talk to Blender on another machine.',
      items: [
        { name: 'Scene and object inspection', what: 'Read the scene graph and object details, including viewport screenshots so the model can see what it just built.' },
        { name: 'Object creation and modification', what: 'Create, modify and delete 3D objects; position, scale and orient them.' },
        { name: 'Material control', what: 'Apply and modify materials and colours on existing objects.' },
        { name: 'execute_blender_code', what: 'Runs arbitrary Python in Blender. This is the escape hatch that makes everything else possible and the single most dangerous tool here — always save your work first.' },
        { name: 'Poly Haven assets', what: 'Search and download models, textures and HDRIs through the Poly Haven API. Off unless you tick the checkbox in the addon panel, because it downloads files to your machine.' },
        { name: 'Hyper3D Rodin generation', what: 'Generate 3D models from a prompt. The free trial key is limited per day; beyond that, bring your own from hyper3d.ai or fal.ai.' },
        { name: 'Sketchfab search and download', what: 'Search and pull Sketchfab models, with your own Sketchfab API key.' },
        { name: 'Hunyuan3D', what: 'Additional generation backend, configured with a SecretId/SecretKey pair and an API URL.' },
      ],
    },
    useCases: [
      {
        title: 'Block out a scene from a description',
        prompt: 'Create a low poly scene in a dungeon, with a dragon guarding a pot of gold.',
        why: 'The canonical demo, and a fair test of whether the addon connection is live: you should see geometry appear in the viewport as tools run.',
      },
      {
        title: 'Dress a scene with real assets',
        prompt: 'Create a beach vibe using HDRIs, textures and models like rocks and vegetation from Poly Haven.',
        why: 'Requires the Poly Haven checkbox to be on. The project notes the model can be erratic about Poly Haven, so expect to steer it.',
      },
      {
        title: 'Fix look and framing',
        prompt: 'Make this car red and metallic, make the lighting like a studio, then point the camera at the scene and make it isometric.',
        why: 'Material and camera work is where the natural-language interface beats hunting through panels, and it is safe — no code execution needed.',
      },
    ],
    gotchas: [
      {
        question: 'Why does Blender MCP connect but nothing happens in Blender?',
        answer:
          'The addon side is not running. Blender must be open with the "Interface: Blender MCP" addon enabled, and you must have clicked "Connect to Claude" in the BlenderMCP sidebar tab (press N to show the sidebar). Also do not run `uvx blender-mcp` in a terminal yourself — the client launches it. If the first command still fails, try again; the project documents that the first one sometimes does not go through.',
      },
      {
        question: 'Where do I download addon.py now that the GitHub repo 404s?',
        answer:
          'As of 2026-08-10, github.com/ahujasid/blender-mcp redirects to github.com/MCPBlender/blender-mcp and that URL returns 404 — the repository has been moved or taken private. The PyPI package is still being released (1.8.0, uploaded 2026-08-03), so `uvx blender-mcp` continues to work; blendermcp.org is the project\'s own site and the place to look for the current addon file. Treat any third-party mirror of addon.py with suspicion: it runs arbitrary Python inside Blender.',
      },
      {
        question: 'Why does uvx fail with spawn uvx ENOENT?',
        answer:
          'Your client was launched from a GUI and does not have uv on its PATH. Replace "uvx" with the absolute path from `which uvx` or `where uvx`, or on Windows use `"command": "cmd", "args": ["/c", "uvx", "blender-mcp"]`. Then fully quit and relaunch the client.',
      },
      {
        question: 'Can I run BlenderMCP with Blender on another machine?',
        answer: 'Yes. Set BLENDER_HOST and BLENDER_PORT — for example BLENDER_HOST=host.docker.internal, BLENDER_PORT=9876. Default is localhost:9876.',
      },
      {
        question: 'Is execute_blender_code safe?',
        answer:
          'It runs arbitrary Python inside Blender, which is exactly as powerful and as dangerous as that sounds. The project says to use it with caution outside experiments and to always save your work first. Complex requests are also better broken into steps — timeouts are a documented failure mode for large single operations.',
      },
      {
        question: 'Does BlenderMCP send telemetry?',
        answer:
          'Yes, anonymous usage data by default. With consent checked it can include anonymised prompts, code snippets and screenshots; unchecked it collects only tool names, success/failure and duration. Turn it off entirely with DISABLE_TELEMETRY=true, either in the env block of your MCP config or on the command line.',
      },
      {
        question: 'Do I need API keys?',
        answer:
          'Not for core modelling. Asset and generation services need their own: store the Sketchfab and Hyper3D keys and the Hunyuan3D SecretId/SecretKey in Edit → Preferences → Add-ons → Blender MCP so they survive restarts, or inject them for headless use as BLENDERMCP_SKETCHFAB_API_KEY, BLENDERMCP_HYPER3D_API_KEY, BLENDERMCP_HUNYUAN3D_SECRET_ID, BLENDERMCP_HUNYUAN3D_SECRET_KEY and BLENDERMCP_HUNYUAN3D_API_URL.',
      },
      {
        question: 'Is BlenderMCP made by Blender?',
        answer: 'No. The project states plainly that it is a third-party integration, not made by Blender. It is by Siddharth Ahuja.',
      },
    ],
    comparison: {
      note: 'Only run one MCP server against a single Blender instance — the addon exposes one socket.',
      items: [
        {
          name: 'Running it from Cursor and Claude Desktop at once',
          choose: 'Do not. The project warns explicitly to run only one instance of the MCP server, in one client.',
        },
        {
          name: 'Hyper3D Rodin vs. Poly Haven',
          choose: 'Poly Haven when a real asset exists — it is a library of CC0 models, textures and HDRIs. Hyper3D when nothing exists and you need something generated, accepting trial-key daily limits.',
        },
        {
          name: 'Driving a game engine instead',
          choose: 'If the destination is a game engine rather than a render, an engine-side MCP server skips the export step entirely. Blender is the better answer for modelling, materials and stills.',
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
