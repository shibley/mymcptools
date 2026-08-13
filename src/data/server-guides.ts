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

  {
    slug: 'stripe',
    verifiedOn: '2026-08-11',
    sources: [
      { label: 'Stripe docs — Model Context Protocol (MCP)', url: 'https://docs.stripe.com/mcp' },
      { label: 'stripe/ai (formerly stripe/agent-toolkit)', url: 'https://github.com/stripe/ai' },
    ],
    intro:
      'Most write-ups of "the Stripe MCP server" describe a local npm package you run with your secret key. That is not what Stripe documents any more. The server Stripe operates is remote — https://mcp.stripe.com — and the connection mechanism it wants is OAuth, so the thing you paste into a client is a URL, not an API key. Two consequences follow, and they are the whole reason this page exists: the sessions you create are revocable from the Dashboard rather than being as long-lived as a key, and an administrator has to switch MCP access on per environment before any of it works. Secret-key auth still exists, but it is the fallback for clients that cannot do OAuth and the path for autonomous agents, where the guidance is to use a restricted key rather than a live secret key.',
    setup: {
      title: 'Connecting to the Stripe MCP server',
      steps: [
        {
          title: 'Turn MCP access on first',
          body:
            'An administrator enables MCP access from Dashboard settings, and it is managed separately for sandbox and for live mode. If you enable it in a sandbox and then wonder why the live connection will not authorise, this is why — the two environments do not inherit from each other.',
        },
        {
          title: 'Claude Code',
          body:
            'Add it over HTTP transport, then run the /mcp command inside a session to complete the OAuth consent. The command exits successfully before you have authenticated, so a first tool call failing is expected if you skipped the second step.',
          code: 'claude mcp add --transport http stripe https://mcp.stripe.com/\nclaude /mcp',
          codeLabel: 'shell',
        },
        {
          title: 'Cursor and VS Code',
          body:
            'Both take the bare URL. Cursor wants { "url": "https://mcp.stripe.com" } under mcpServers in ~/.cursor/mcp.json; VS Code wants { "type": "http", "url": "https://mcp.stripe.com" } under servers in .vscode/mcp.json. Stripe publishes one-click install links for both from its MCP docs page.',
          code: '{\n  "mcpServers": {\n    "stripe": {\n      "url": "https://mcp.stripe.com"\n    }\n  }\n}',
          codeLabel: 'json — ~/.cursor/mcp.json',
        },
        {
          title: 'ChatGPT',
          body:
            'Supported on Pro, Plus, Business, Enterprise and Education accounts as a custom connector: server URL https://mcp.stripe.com, connection mechanism OAuth. The same server also works against OpenAI\'s Responses API when you are building an agent rather than chatting.',
        },
        {
          title: 'Clients that cannot do OAuth',
          body:
            'Pass a restricted API key as a bearer token in the Authorization header. Do not embed the key in code — supply it from a secrets vault or an environment variable. This is also the documented path for autonomous agents, where scoping the key to exactly the calls the agent needs is the only real containment you have.',
          code: '{\n  "stripe": {\n    "url": "https://mcp.stripe.com",\n    "headers": {\n      "Authorization": "Bearer rk_..."\n    }\n  }\n}',
          codeLabel: 'json',
        },
        {
          title: 'Connect platforms acting as a connected account',
          body:
            'OAuth cannot express this, so it is restricted-key only: use a restricted access key with the appropriate Connect permissions and add a Stripe-Account header carrying the acct_ id. This is how you let your own connected accounts make MCP calls through your platform.',
          code: '"headers": {\n  "Authorization": "Bearer rk_...",\n  "Stripe-Account": "acct_xxxxxxxxx"\n}',
          codeLabel: 'json',
        },
      ],
    },
    tools: {
      title: 'What the server exposes',
      note:
        'The design is deliberately not one tool per endpoint. Four generic API tools cover most of the surface so the tool schemas do not eat your context window, and only a handful of operations get a dedicated tool.',
      items: [
        { name: 'stripe_api_search', what: 'Find Stripe API methods by keyword — the discovery step before a read or a write.' },
        { name: 'stripe_api_details', what: 'Get the parameter detail for one specific API method.' },
        { name: 'stripe_api_read', what: 'Any supported GET. This is what answers "list customers", "retrieve this charge", "show me yesterday\'s payouts".' },
        { name: 'stripe_api_write', what: 'Any supported POST, PATCH, PUT or DELETE. The tool to gate behind human confirmation.' },
        { name: 'get_stripe_account_info', what: 'Retrieve the connected account — useful as a cheap "am I pointed at the right account and environment" check.' },
        { name: 'create_refund', what: 'A dedicated refund tool rather than a generic write.' },
        { name: 'search_stripe_documentation', what: 'Searches Stripe docs and support articles for a question in a given language.' },
        { name: 'stripe_implementation_planner', what: 'Walks you through the Stripe products for a goal — accepting payments, selling online, setting up billing.' },
        { name: 'stripe_report', what: 'Search, retrieve and create reports and report runs.' },
        { name: 'get_balance_summary', what: 'Public preview, Treasury: an interactive summary across the Stripe balance and Treasury accounts.' },
        { name: 'send_stripe_mcp_feedback', what: 'Sends feedback about the server itself back to Stripe.' },
      ],
    },
    useCases: [
      {
        title: 'Ask the account a revenue question without opening the Dashboard',
        prompt: 'List the charges that failed in the last 24 hours, group them by decline reason, and tell me which customers have an active subscription so I know who to follow up with.',
        why: 'Pure stripe_api_read work across charges, customers and subscriptions — the read-only shape worth running first to see whether the connection is scoped the way you expect.',
      },
      {
        title: 'Build a payment link from a product that does not exist yet',
        prompt: 'Create a product called "Annual plan" with a recurring yearly price of $290, then create a payment link for it and give me the URL.',
        why: 'Product, price and payment-link creation are all in the supported write set. Run it against a sandbox first — the same prompt in live mode creates a real, publicly payable link.',
      },
      {
        title: 'Plan an integration before writing any of it',
        prompt: 'I need to charge a one-off fee and then start a monthly subscription on the same card. Which Stripe objects should I use, in what order?',
        why: 'stripe_implementation_planner plus documentation search answers this without touching your account at all, so it is safe to run on a connection you have not finished scoping.',
      },
    ],
    gotchas: [
      {
        question: 'Is the Stripe MCP server an npm package I install locally?',
        answer:
          'No — not in Stripe\'s current documentation. The documented server is remote, at https://mcp.stripe.com, and you connect by URL over OAuth. There is an @stripe/mcp npm package, but it describes itself as a command-line tool for setting up the Stripe MCP server, not the server itself. Guides telling you to run a local server with sk_live_ are describing the older agent-toolkit shape.',
      },
      {
        question: 'What happened to the stripe/agent-toolkit GitHub repo?',
        answer:
          'It was renamed. github.com/stripe/agent-toolkit now redirects to github.com/stripe/ai — "one-stop shop for building AI-powered products and businesses with Stripe". The old URL still resolves because GitHub keeps rename redirects alive, which is exactly why a lot of directories (this one included, until recently) still show the dead name.',
      },
      {
        question: 'How do I revoke an AI client\'s access to my Stripe account?',
        answer:
          'Dashboard → user settings → OAuth sessions. Find the client session, open the overflow menu, choose Revoke access. Administrators can do the same for other users from Team and security → the team member → their OAuth sessions table, including Revoke all. Session management is scoped to the account or organization you are currently viewing and to the current environment, so revoking in live mode does not touch sandbox sessions.',
      },
      {
        question: 'Why can I not connect even though the URL is right?',
        answer:
          'MCP access is an account setting an administrator has to enable, and it is enabled separately for sandbox and for live mode. Check the environment you are actually authenticating against before debugging the client.',
      },
      {
        question: 'Is it safe to run the Stripe MCP server alongside other MCP servers?',
        answer:
          'Stripe explicitly recommends enabling human confirmation of tools and exercising caution when combining its MCP server with others, because of prompt-injection risk. A server that can call stripe_api_write is a server that can issue refunds and cancel subscriptions on instructions that arrived inside a web page.',
      },
      {
        question: 'Which API key should an autonomous agent use?',
        answer:
          'A restricted key, scoped to exactly the functionality the agent needs — Stripe\'s own wording is "strongly recommend". Provide it through a secrets vault or environment variable rather than embedding it. A live secret key handed to an agent is an unbounded grant over the account.',
      },
    ],
    comparison: {
      items: [
        {
          name: 'The Stripe CLI + agent skills',
          choose: 'Stripe now ships skills and plugins (stripe agent setup via the CLI) aimed at coding agents. If your agent is writing Stripe integration code, the skills path is what Stripe points at first; MCP is for querying and acting on the account.',
        },
        {
          name: 'A read-only setup',
          choose: 'There is no read-only endpoint variant. The way to get one is a restricted key with only read permissions, which also means giving up OAuth.',
        },
      ],
    },
  },

  {
    slug: 'microsoft-playwright-mcp',
    verifiedOn: '2026-08-11',
    sources: [
      { label: 'microsoft/playwright-mcp README', url: 'https://github.com/microsoft/playwright-mcp' },
      { label: '@playwright/mcp on npm', url: 'https://www.npmjs.com/package/@playwright/mcp' },
    ],
    intro:
      'Playwright MCP drives a real browser through Playwright\'s accessibility tree rather than screenshots, so it needs no vision model and its output is structured text a language model can act on deterministically. Before you install it, read the project\'s own caveat: Microsoft now says that if you are using a coding agent, you may be better served by the Playwright CLI with skills, because CLI invocations avoid loading large tool schemas and verbose accessibility trees into the context window. MCP is the right choice for agentic loops that want persistent browser state and iterative reasoning over page structure — exploratory automation, self-healing tests, long-running autonomous workflows — and the wrong choice if you mostly want a browser occasionally in a session already full of code.',
    setup: {
      title: 'Installing Playwright MCP',
      steps: [
        {
          title: 'Check the runtime',
          body: 'Node.js 18 or newer. Everything below runs through npx, so there is nothing to install globally.',
        },
        {
          title: 'Claude Code',
          body: 'One command, no arguments needed for a default headed persistent-profile setup.',
          code: 'claude mcp add playwright npx @playwright/mcp@latest',
          codeLabel: 'shell',
        },
        {
          title: 'Anything with a JSON config',
          body:
            'Cursor, Claude Desktop, Windsurf, Goose, Codex, LM Studio, Kiro, Copilot and others take the same stdio block. Flags go in args after the package name.',
          code: '{\n  "mcpServers": {\n    "playwright": {\n      "command": "npx",\n      "args": ["@playwright/mcp@latest"]\n    }\n  }\n}',
          codeLabel: 'json',
        },
        {
          title: 'Decide persistent or isolated before you run two clients',
          body:
            'The default is a persistent profile, so logins survive across sessions. It lives in ~/Library/Caches/ms-playwright/mcp-{channel}-{workspace-hash} on macOS, ~/.cache/ms-playwright/... on Linux and %USERPROFILE%\\AppData\\Local\\ms-playwright\\... on Windows, where the workspace hash comes from the MCP client\'s workspace root — so different projects get separate profiles automatically. A persistent profile can only be used by one browser instance at a time.',
        },
        {
          title: 'Run several clients in parallel',
          body:
            'Start each additional client with --isolated, or point it at a distinct --user-data-dir. Isolated sessions keep the profile in memory and lose all storage state when the browser closes; seed them with --storage-state pointing at a Playwright storage-state file if they need to start logged in.',
          code: '{\n  "mcpServers": {\n    "playwright": {\n      "command": "npx",\n      "args": [\n        "@playwright/mcp@latest",\n        "--isolated",\n        "--storage-state=/path/to/storage.json"\n      ]\n    }\n  }\n}',
          codeLabel: 'json',
        },
        {
          title: 'Turn on the capability groups you need',
          body:
            'Core automation, tab management and browser installation are always on. Everything else is opt-in behind --caps: config, network, storage, devtools, vision and pdf, plus testing for assertion tools. Note that the README\'s options table lists only vision, pdf and devtools while its tool sections document the rest — trust the tool sections, and verify with a tools/list against your own install.',
          code: 'npx @playwright/mcp@latest --caps=network,storage,testing',
          codeLabel: 'shell',
        },
      ],
    },
    tools: {
      title: 'The tool surface, by group',
      note:
        'Roughly 70 tools across eight groups. The ones worth knowing by name are the ones that change how you prompt.',
      items: [
        { name: 'browser_snapshot', what: 'The accessibility-tree snapshot the whole design rests on. Most other tools take a target reference produced by it.' },
        { name: 'browser_find', what: 'Locates an element without dumping a whole snapshot — the cheaper first move on a large page.' },
        { name: 'browser_click / browser_type / browser_fill_form / browser_select_option', what: 'Core interaction. fill_form fills several fields in one call rather than one tool call per input.' },
        { name: 'browser_evaluate / browser_run_code_unsafe', what: 'Arbitrary JavaScript in the page, and arbitrary Playwright code. Treat the latter as the escape hatch it is.' },
        { name: 'browser_console_messages / browser_network_requests', what: 'Read the console and the request log — how the agent debugs a page rather than just driving it.' },
        { name: 'browser_route / browser_unroute / browser_network_state_set', what: 'Request mocking and offline simulation. Opt-in via --caps=network.' },
        { name: 'browser_cookie_* / browser_localstorage_* / browser_sessionstorage_* / browser_storage_state', what: 'Full storage read-write, including exporting a storage state you can feed back in with --storage-state. Opt-in via --caps=storage.' },
        { name: 'browser_start_tracing / browser_start_video / browser_highlight / browser_annotate', what: 'Traces, screen recordings and visual annotation. Opt-in via --caps=devtools.' },
        { name: 'browser_mouse_click_xy / browser_mouse_drag_xy / browser_mouse_wheel', what: 'Coordinate-based input for canvas and other things with no accessibility tree. Opt-in via --caps=vision.' },
        { name: 'browser_generate_locator / browser_verify_text_visible / browser_verify_element_visible / browser_verify_value', what: 'Assertion and locator-generation tools for writing tests from a live session. Opt-in via --caps=testing.' },
        { name: 'browser_pdf_save', what: 'Save the page as a PDF. Opt-in via --caps=pdf.' },
      ],
    },
    useCases: [
      {
        title: 'Reproduce a bug report against your own logged-in staging site',
        prompt: 'Open our staging dashboard, follow these steps from the bug report, and tell me at which step the behaviour diverges from what the reporter described — include the console errors and any failing network requests.',
        why: 'Uses the persistent profile so you are already authenticated, and browser_console_messages plus browser_network_requests to explain the failure instead of only reporting it.',
      },
      {
        title: 'Turn a manual click-through into a Playwright test',
        prompt: 'Walk through the signup flow, then generate stable locators for each element you interacted with and write me a Playwright test asserting the success state.',
        why: 'browser_generate_locator and the verify_* tools exist for exactly this, but only with --caps=testing enabled.',
      },
      {
        title: 'Check a page against a flaky third-party API',
        prompt: 'Route the pricing API to return a 500, reload the page, and tell me what the user sees. Then set the browser offline and do it again.',
        why: 'Failure-path testing without touching the backend, via --caps=network. This is the workflow that justifies MCP over a CLI: the browser keeps its state across the whole investigation.',
      },
    ],
    gotchas: [
      {
        question: 'Why does Playwright MCP fail when I open it in a second client?',
        answer:
          'A persistent profile can only be used by one browser instance at a time, and the profile directory is keyed to the MCP client\'s workspace root — so two clients in the same workspace collide. Start the second one with --isolated or give it its own --user-data-dir.',
      },
      {
        question: 'Should I use Playwright MCP or the Playwright CLI with skills?',
        answer:
          'Microsoft\'s own README recommends the CLI plus skills for coding agents, because CLI calls do not load large tool schemas and verbose accessibility trees into the model context. It recommends MCP for specialised agentic loops that benefit from persistent state and iterative reasoning over page structure. If you are mostly writing code and occasionally need a browser, take the CLI.',
      },
      {
        question: 'Can Playwright MCP read files on my machine?',
        answer:
          'By default no — file-system access is restricted to workspace root directories, or the working directory if no roots are configured, and navigation to file:// URLs is blocked. --allow-unrestricted-file-access removes both restrictions, which is a meaningful thing to hand an agent.',
      },
      {
        question: 'Does --allowed-origins make the browser safe to point at the open web?',
        answer:
          'No. The README is explicit that both --allowed-origins and --blocked-origins do not serve as a security boundary and do not affect redirects. The blocklist is evaluated before the allowlist. Treat them as guardrails against accidents, not against an adversary.',
      },
      {
        question: 'Is it headless by default?',
        answer:
          'No — it runs headed by default. Pass --headless, or set PLAYWRIGHT_MCP_HEADLESS. Every CLI flag has a matching PLAYWRIGHT_MCP_* environment variable, which is usually the cleaner way to configure it in a container.',
      },
      {
        question: 'Why does it time out on a slow page?',
        answer:
          'Defaults are 5000ms for an action, 60000ms for a navigation, and a 500ms settle wait after each action. Raise them with --timeout-action, --timeout-navigation and --timeout-settle rather than retrying the prompt.',
      },
      {
        question: 'How do I cut token usage on big pages?',
        answer:
          'Three levers: --mobile emulates a generic mobile device (Pixel 10 on Chromium, iPhone 17 on WebKit) and mobile pages are usually lighter; --snapshot-mode=none stops returning a full snapshot with every response; --image-responses=omit drops image payloads. browser_find is also cheaper than a full browser_snapshot when you know what you are looking for.',
      },
    ],
    comparison: {
      note: 'Two different projects answer to "the Playwright MCP server". They are not the same code.',
      items: [
        {
          name: 'ExecuteAutomation Playwright MCP',
          slug: 'playwright',
          choose: 'Pick it for auto-generated Playwright test scripts, in-page JavaScript execution and a large device-preset library. Pick Microsoft\'s for the official, actively-maintained accessibility-tree server with the opt-in capability model.',
        },
        {
          name: 'Connecting to your own already-open browser',
          choose: 'Use --extension with the Playwright Extension (Edge and Chrome only) to attach to existing tabs and their logged-in state, or --cdp-endpoint to attach to a browser you launched yourself.',
        },
      ],
    },
  },

  {
    slug: 'sentry',
    verifiedOn: '2026-08-11',
    sources: [
      { label: 'getsentry/sentry-mcp README', url: 'https://github.com/getsentry/sentry-mcp' },
      { label: 'Sentry MCP service', url: 'https://mcp.sentry.dev' },
    ],
    intro:
      'Sentry is explicit that this is not a general-purpose wrapper around the Sentry API — it is built for human-in-the-loop coding agents, and the tool selection is skewed to debugging workflows rather than administration. The default deployment is remote, at https://mcp.sentry.dev/mcp, running on Cloudflare\'s remote-MCP infrastructure, so for Sentry SaaS there is nothing to install. The stdio transport exists mainly so self-hosted Sentry installs have a path, and the README describes it as still a work in progress. The one configuration decision that catches people out is unrelated to transport: the AI-powered search tools need their own LLM provider key, and without one they simply do not appear.',
    setup: {
      title: 'Connecting to Sentry MCP',
      steps: [
        {
          title: 'Sentry SaaS — use the remote server',
          body:
            'Point any OAuth-capable client at https://mcp.sentry.dev/mcp and complete the browser flow. There is no token to mint and nothing to install.',
          code: 'claude mcp add --transport http sentry https://mcp.sentry.dev/mcp',
          codeLabel: 'shell',
        },
        {
          title: 'Claude Code, as a plugin instead',
          body:
            'Installing it as a plugin gives you a sentry-mcp subagent that Claude delegates to automatically whenever the conversation touches Sentry errors, issues, traces or performance — rather than you having to steer every lookup. A separate experimental marketplace channel carries forward-looking tool variants.',
          code: 'claude plugin marketplace add getsentry/sentry-mcp\nclaude plugin install sentry-mcp@sentry-mcp',
          codeLabel: 'shell',
        },
        {
          title: 'Remote, but with your own Sentry token',
          body:
            'Clients that support custom headers can pass an upstream Sentry API token to the Cloudflare transport using the Sentry-Bearer scheme. This is intentionally not Bearer — Bearer is reserved for MCP OAuth access tokens. With Sentry-Bearer the worker does not store, validate, exchange or refresh the token; it forwards it through the same API calls an OAuth session would use, and token lifetime stays your problem.',
          code: '{\n  "mcpServers": {\n    "sentry": {\n      "url": "https://mcp.sentry.dev/mcp",\n      "headers": {\n        "Authorization": "Sentry-Bearer ${SENTRY_ACCESS_TOKEN}"\n      }\n    }\n  }\n}',
          codeLabel: 'json',
        },
        {
          title: 'Narrow what a direct-auth session can reach',
          body:
            'Direct remote auth defaults to every active MCP skill. Append ?skills=inspect,triage to expose only those, or ?disable-skills=seer to drop one. Worth doing on any connection you are not supervising.',
          code: 'https://mcp.sentry.dev/mcp?skills=inspect,triage',
          codeLabel: 'url',
        },
        {
          title: 'Self-hosted Sentry — stdio',
          body:
            'Create a User Auth Token with scopes org:read, project:read, project:write, team:read, team:write and event:write, then launch the stdio transport with --host set to the hostname only (no scheme, no path). Leave the host unset and the CLI targets Sentry SaaS.',
          code: 'npx @sentry/mcp-server@latest --access-token=TOKEN --host=sentry.example.com',
          codeLabel: 'shell',
        },
        {
          title: 'Self-hosted without TLS, or without Seer',
          body:
            'Internal deployments that only expose plain HTTP need --insecure-http. Features like Seer may not exist on a self-hosted instance at all; --disable-skills=seer stops the unsupported tools being advertised, which is cleaner than letting them fail at call time.',
          code: 'npx @sentry/mcp-server@latest --access-token=TOKEN --host=sentry.internal:9000 --insecure-http --disable-skills=seer',
          codeLabel: 'shell',
        },
        {
          title: 'Enable the AI-powered search tools',
          body:
            'search_events, search_issues and the other AI-powered search tools translate natural language into Sentry query syntax using an embedded agent, so they need an LLM provider: OpenAI, Azure OpenAI, Anthropic or OpenRouter. Set EMBEDDED_AGENT_PROVIDER explicitly — auto-detection from whichever API keys happen to be present is deprecated and will be removed.',
          code: '{\n  "mcpServers": {\n    "sentry": {\n      "command": "npx",\n      "args": ["@sentry/mcp-server"],\n      "env": {\n        "SENTRY_ACCESS_TOKEN": "your-token",\n        "EMBEDDED_AGENT_PROVIDER": "openai",\n        "OPENAI_API_KEY": "sk-..."\n      }\n    }\n  }\n}',
          codeLabel: 'json',
        },
      ],
    },
    useCases: [
      {
        title: 'Debug a production regression without leaving the editor',
        prompt: 'Find the issues in this project that first appeared after today\'s deploy, pull the stack trace for the highest-volume one, and tell me which change in the diff most likely caused it.',
        why: 'The workflow the server is actually designed for — issue search plus event detail plus your local code in the same context, which is the part the Sentry web UI cannot give an agent.',
      },
      {
        title: 'Triage before standup',
        prompt: 'What regressed in the last 24 hours across our projects — new issues only, ordered by users affected, and skip anything already assigned.',
        why: 'Natural-language filtering like this is what the AI-powered search tools are for, so it is the prompt that will silently do nothing useful if you never configured EMBEDDED_AGENT_PROVIDER.',
      },
      {
        title: 'Follow a slow request through a trace',
        prompt: 'Pull the trace for this event id and tell me which span accounts for most of the latency, and whether that span appears in other slow traces on the same endpoint.',
        why: 'Performance traces are in scope alongside errors, and reasoning over span timings is the kind of thing that is tedious to do by eye in a trace waterfall.',
      },
    ],
    gotchas: [
      {
        question: 'Why are search_events and search_issues missing from my Sentry MCP tools?',
        answer:
          'They need an LLM provider configured — OpenAI, Azure OpenAI, Anthropic or OpenRouter — because they use an embedded agent to translate natural language into Sentry query syntax. Without one, those specific tools are unavailable while everything else works normally. Set EMBEDDED_AGENT_PROVIDER as well as the provider key.',
      },
      {
        question: 'Why does Authorization: Bearer <sentry token> not work on the remote server?',
        answer:
          'Bearer is reserved for MCP OAuth access tokens. To pass an upstream Sentry API token to the remote transport, use the Sentry-Bearer scheme instead. The worker forwards that token without storing, validating, exchanging or refreshing it.',
      },
      {
        question: 'Do I need the stdio server if I use Sentry SaaS?',
        answer:
          'No. The remote server at mcp.sentry.dev is the primary deployment and needs no install. The stdio transport is described in the README as a work in progress, and its main reason to exist is self-hosted Sentry.',
      },
      {
        question: 'What scopes does the Sentry auth token need?',
        answer:
          'org:read, project:read, project:write, team:read, team:write and event:write. The write scopes are what let it triage — assign, resolve, comment — rather than only read.',
      },
      {
        question: 'What should SENTRY_HOST be set to?',
        answer:
          'The hostname only, for example sentry.example.com — not a URL with a scheme or path. Leave it unset for Sentry SaaS; only set it when you run self-hosted Sentry.',
      },
      {
        question: 'Can I limit which Sentry tools an agent sees?',
        answer:
          'Yes, through skills. On the remote server with direct auth, append ?skills=inspect,triage or ?disable-skills=seer to the URL. On stdio, use --disable-skills or the MCP_DISABLE_SKILLS environment variable with a comma-separated list.',
      },
    ],
    comparison: {
      items: [
        {
          name: 'Remote vs stdio',
          choose: 'Remote for Sentry SaaS: no install, OAuth, and it stays current. Stdio for self-hosted Sentry, or when you need the server pinned to a version you control.',
        },
        {
          name: 'MCP server vs the Claude Code plugin',
          choose: 'The plugin wraps the same server but adds a subagent Claude delegates to on its own. If you find yourself repeatedly telling Claude to go look in Sentry, take the plugin.',
        },
      ],
    },
  },
  {
    slug: 'supabase',
    verifiedOn: '2026-08-11',
    sources: [
      { label: 'Supabase Docs — Supabase MCP Server', url: 'https://supabase.com/docs/guides/ai-tools/mcp' },
      { label: 'supabase/mcp on GitHub', url: 'https://github.com/supabase/mcp' },
    ],
    intro:
      'Almost every third-party write-up of this server still tells you to mint a personal access token and run a local npx process. That is the old shape. Supabase now runs a hosted server at https://mcp.supabase.com/mcp using OAuth 2.1 with dynamic client registration — you paste a URL, a browser opens, you pick the organization, and there is no PAT to rotate. What replaces token management is URL configuration: three query parameters (read_only, project_ref, features) decide whether the agent can write, which project it can see, and which tool groups exist at all. Supabase itself is blunt about the reason those parameters matter — the docs tell you not to point this at production, and the prompt-injection example they give is a support ticket whose body contains the instructions.',
    setup: {
      title: 'Connecting the Supabase MCP server',
      steps: [
        {
          title: 'Add the hosted server to Claude Code',
          body:
            'Project scope writes the entry into .mcp.json in the repo, which is usually what you want — the server is per-project in practice even when the URL is not scoped yet. The features list is the full default set minus storage.',
          code: 'claude mcp add --scope project --transport http supabase \\\n  "https://mcp.supabase.com/mcp?features=docs,account,database,debugging,development,functions,branching"',
          codeLabel: 'shell',
        },
        {
          title: 'Or write .mcp.json by hand',
          body:
            'Any client that speaks Streamable HTTP takes the same URL. The type field is http; there is no command and no args because nothing runs locally.',
          code: '{\n  "mcpServers": {\n    "supabase": {\n      "type": "http",\n      "url": "https://mcp.supabase.com/mcp"\n    }\n  }\n}',
          codeLabel: 'json',
        },
        {
          title: 'Run the auth flow in a real terminal',
          body:
            'This is the step people lose an hour to. In Claude Code the /mcp authentication flow has to run in a regular terminal, not the IDE extension. Select the supabase server, choose Authenticate, and grant access to the organization that owns the project you actually want — picking the wrong org produces a connected server with an empty project list.',
          code: 'claude\n/mcp',
          codeLabel: 'shell',
        },
        {
          title: 'Scope it before you point it at anything real',
          body:
            'read_only=true executes every statement as a read-only Postgres user. project_ref=<id> limits the server to one project and, as a side effect, removes the account-management tools entirely — no create_project, no pause_project. The two combine, and the combination is the configuration to default to.',
          code: 'https://mcp.supabase.com/mcp?project_ref=abc123&read_only=true',
          codeLabel: 'url',
        },
        {
          title: 'Cut the tool surface with features=',
          body:
            'features takes a comma-separated list of groups and is the cheapest way to shrink both the attack surface and the token cost of the tool list. A schema-and-docs assistant needs two groups, not seven.',
          code: 'https://mcp.supabase.com/mcp?features=database,docs&read_only=true',
          codeLabel: 'url',
        },
        {
          title: 'Local development against the CLI',
          body:
            'When you are running the Supabase CLI locally, the MCP server is served by the local stack at http://localhost:54321/mcp. Same tools, no OAuth, and nothing of yours leaves the machine — the right place to experiment before you connect a cloud project.',
          code: 'http://localhost:54321/mcp',
          codeLabel: 'url',
        },
        {
          title: 'CI, where no browser exists',
          body:
            'Dynamic client registration needs a browser, so CI is the one case where you still mint a personal access token from the dashboard and pass it as an Authorization header. Not every client supports custom headers — check before you build a pipeline on it.',
          code: '{\n  "mcpServers": {\n    "supabase": {\n      "type": "http",\n      "url": "https://mcp.supabase.com/mcp?project_ref=${SUPABASE_PROJECT_REF}",\n      "headers": {\n        "Authorization": "Bearer ${SUPABASE_ACCESS_TOKEN}"\n      }\n    }\n  }\n}',
          codeLabel: 'json',
        },
      ],
    },
    tools: {
      title: 'Tool groups',
      note: 'Every group except storage is enabled by default. The account group is silently dropped whenever project_ref is set.',
      items: [
        { name: 'database', what: 'list_tables, list_extensions, list_migrations, apply_migration, execute_sql. apply_migration is a write even when the SQL looks harmless — read_only is what stops it.' },
        { name: 'debugging', what: 'get_logs across API, Postgres, Edge Functions, Auth, Storage and Realtime, plus get_advisors for Supabase\'s own security and performance findings.' },
        { name: 'development', what: 'get_project_url, get_publishable_keys (publishable and legacy anon keys), generate_typescript_types from the live schema.' },
        { name: 'functions', what: 'list_edge_functions, get_edge_function, deploy_edge_function — deployment from a chat window, so worth disabling on any connection you are not watching.' },
        { name: 'account', what: 'list/get projects and organizations, create_project, pause_project, restore_project, get_cost and confirm_cost. Disabled under project_ref.' },
        { name: 'docs', what: 'search_docs — the one group with no access to your data, and the reason to keep docs enabled even on a locked-down URL.' },
        { name: 'branching', what: 'Experimental and paid-plan only: create/list/delete branches plus merge, reset and rebase. This is what makes "test the migration first" a real workflow rather than advice.' },
        { name: 'storage', what: 'list_storage_buckets, get_storage_config, update_storage_config. Off by default; you have to name it in features= to get it.' },
      ],
    },
    useCases: [
      {
        title: 'Find the schema problem before the advisor email does',
        prompt: 'Run get_advisors for security and performance on this project and tell me which findings are caused by tables missing RLS policies, with the policy you would add for each.',
        why: 'get_advisors is the tool most people never discover, and it is the one that turns the server from a SQL runner into something that tells you what is wrong unprompted.',
      },
      {
        title: 'Migrate on a branch, not on the database',
        prompt: 'Create a development branch, apply a migration on it that adds a created_at timestamptz default now() to public.users, run the app\'s smoke queries against the branch, then tell me whether it is safe to merge.',
        why: 'Branching plus apply_migration is the combination Supabase recommends in place of connecting an agent to production, and it only works if you enabled the branching feature group on a paid plan.',
      },
      {
        title: 'Regenerate types after someone changed the schema in the dashboard',
        prompt: 'Generate TypeScript types from the current schema and diff them against src/types/database.ts, then list the code that will stop compiling.',
        why: 'generate_typescript_types plus your local files in one context is the thing the Supabase CLI cannot do on its own, because it cannot see the code that consumes the types.',
      },
    ],
    gotchas: [
      {
        question: 'Do I still need a Supabase personal access token for the MCP server?',
        answer:
          'No, not for normal use. The hosted server at mcp.supabase.com uses OAuth 2.1 with dynamic client registration, so your client opens a browser and you grant organization access. PATs are now only for CI, where no browser flow is possible, and are passed as an Authorization: Bearer header.',
      },
      {
        question: 'Why does authentication fail in the Claude Code IDE extension?',
        answer:
          'Run the /mcp flow in a regular terminal instead. Supabase\'s own instructions call this out explicitly: start claude in a plain terminal, run /mcp, select supabase, then Authenticate. Some clients prompt automatically during setup; others need this manual step.',
      },
      {
        question: 'Why are the project management tools missing?',
        answer:
          'You set project_ref in the URL. Project-scoped mode intentionally disables the whole account group — list_projects, create_project, pause_project, cost tools. That is the trade for confining the server to one project, and it is usually the right trade.',
      },
      {
        question: 'Why can the agent not see my storage buckets?',
        answer:
          'The storage group is the only one disabled by default. Add it explicitly, e.g. ?features=database,storage — and note that including it also brings update_storage_config, which is a write.',
      },
      {
        question: 'Is it safe to connect this to a production Supabase project?',
        answer:
          'Supabase says no. Their guidance is to use a development project with non-production or obfuscated data, and if you must touch real data, run with read_only=true, scope with project_ref, and restrict features. The stated reason is prompt injection: content stored in your own tables can carry instructions the model then follows. Supabase wraps SQL results with counter-instructions, and is explicit that this is not foolproof.',
      },
      {
        question: 'My client wants an OAuth client ID and secret — what do I do?',
        answer:
          'Some clients (Azure API Center is the example in the docs) do not support dynamic client registration. Create an OAuth app under your Supabase organization, use the website and callback URLs your client gives you, and grant write access to all scopes — fine-grained scopes are not available yet. Then paste the client ID and secret into the client.',
      },
    ],
    comparison: {
      items: [
        {
          name: 'Hosted server vs the local Supabase CLI endpoint',
          choose: 'Local (http://localhost:54321/mcp) while you are developing against the local stack — no auth, no cloud data. Hosted when the agent genuinely needs a cloud project, ideally a development one.',
        },
        {
          name: 'Supabase MCP vs a generic Postgres MCP server',
          slug: 'postgresql',
          choose: 'A Postgres server gives you SQL against the database and nothing else. Take Supabase MCP when you want the platform — logs, advisors, Edge Function deploys, branches, generated types. Take plain Postgres when you only want queries and would rather not hand out platform access at all.',
        },
        {
          name: 'MCP server vs the Supabase plugin for AI coding agents',
          choose: 'The plugin bundles the server with Supabase\'s agent skills in one setup step. Use it if you want the recommended defaults; wire the server directly when you need specific features= and read_only settings.',
        },
      ],
    },
  },
  {
    slug: 'vercel',
    verifiedOn: '2026-08-11',
    sources: [
      { label: 'Vercel Docs — Use Vercel\'s MCP server', url: 'https://vercel.com/docs/agent-resources/vercel-mcp' },
      { label: 'Vercel Docs — Vercel MCP tools reference', url: 'https://vercel.com/docs/agent-resources/vercel-mcp/tools' },
    ],
    intro:
      'Vercel MCP is a remote, OAuth-only server at https://mcp.vercel.com — in Beta, on all plans, with nothing to install. Two things about it are unusual enough to plan around. First, Vercel only accepts connections from AI clients it has reviewed and approved, so "my client cannot connect" is often not a bug you can fix. Second, nearly every tool takes a required teamId, which means an agent that has not yet called list_teams or read your .vercel/project.json will fail its first few calls in a way that looks like a permissions problem and is not. Vercel is also explicit about what a connection grants: the same access as your own Vercel user account.',
    setup: {
      title: 'Connecting to Vercel MCP',
      steps: [
        {
          title: 'One command for whichever agents you have',
          body:
            'add-mcp detects the AI clients installed on the machine and configures Vercel MCP for each. -y skips confirmation for the agents already used in the project directory, -g installs globally across projects.',
          code: 'npx add-mcp https://mcp.vercel.com',
          codeLabel: 'shell',
        },
        {
          title: 'Claude Code',
          body:
            'Add it as an HTTP transport from inside the project, then authenticate with /mcp once Claude is running. The browser flow is where you approve the connection for your account.',
          code: 'claude mcp add --transport http vercel https://mcp.vercel.com\nclaude\n/mcp',
          codeLabel: 'shell',
        },
        {
          title: 'Codex CLI',
          body:
            'Codex detects OAuth support when the server is added and opens the browser for authorization immediately, so there is no separate auth step.',
          code: 'codex mcp add vercel --url https://mcp.vercel.com',
          codeLabel: 'shell',
        },
        {
          title: 'Cursor and Windsurf',
          body:
            'Cursor takes the plain url key in .cursor/mcp.json and then shows a "Needs login" prompt you have to click to authorize. Windsurf uses serverUrl instead of url in mcp_config.json — the same value under a different key, which is a common copy-paste failure.',
          code: '// .cursor/mcp.json\n{ "mcpServers": { "vercel": { "url": "https://mcp.vercel.com" } } }\n\n// Windsurf mcp_config.json\n{ "mcpServers": { "vercel": { "serverUrl": "https://mcp.vercel.com" } } }',
          codeLabel: 'json',
        },
        {
          title: 'VS Code with Copilot — the authentication detour',
          body:
            'Add the server over HTTP via MCP: Add Server, then start it from MCP: List Servers. When the browser prompt appears, the documented path is counter-intuitive: click Allow, then Cancel on "Do you want Code to open the external website?", then answer Yes to the "try a different way? (URL Handler)" message, then Open. Following the obvious prompt instead is what leaves people stuck in a loop.',
          code: 'Cmd+Shift+P → MCP: Add Server → HTTP → https://mcp.vercel.com',
          codeLabel: 'text',
        },
        {
          title: 'Gemini CLI and Gemini Code Assist',
          body:
            'These do not speak remote MCP natively, so the documented configuration bridges through mcp-remote. Both read the same ~/.gemini/settings.json; restart the IDE after editing.',
          code: '{\n  "mcpServers": {\n    "vercel": {\n      "command": "npx",\n      "args": ["mcp-remote", "https://mcp.vercel.com"]\n    }\n  }\n}',
          codeLabel: 'json',
        },
        {
          title: 'Claude.ai, Claude Desktop and ChatGPT',
          body:
            'Both are custom-connector flows on paid plans. In Claude, Settings → Connectors → Add custom connector with the URL. In ChatGPT you must first enable Developer mode under Settings → Connectors → Advanced, then create a connector with authentication set to OAuth; it then appears under Developer mode in the composer.',
          code: 'https://mcp.vercel.com',
          codeLabel: 'url',
        },
      ],
    },
    tools: {
      title: 'What the tools actually do',
      note: 'Documentation tools are public. Everything else requires authentication, and most of it requires a teamId — a team ID or slug, found as orgId in .vercel/project.json or via list_teams.',
      items: [
        { name: 'search_vercel_documentation', what: 'Takes a topic and an optional token budget (default 2500). Public — it works before you authenticate anything.' },
        { name: 'list_teams / list_projects / get_project', what: 'The lookup chain. list_projects needs a teamId, get_project needs both projectId and teamId; IDs start with team_ and prj_ and both live in .vercel/project.json.' },
        { name: 'list_deployments / get_deployment', what: 'Deployment history with state and target, then full detail for one deployment by ID or hostname.' },
        { name: 'get_deployment_build_logs', what: 'Returns the tail by default because that is where build errors are. errorsOnly filters to error/stderr/exit/fatal; buildId disambiguates deployments with multiple builds.' },
        { name: 'get_runtime_errors', what: 'Grouped error clusters with counts, affected routes, sample messages and first/last seen. The docs say start here, then drill down. Maximum lookback is 7 days.' },
        { name: 'get_runtime_logs', what: 'Individual function log lines, filterable by environment, level, statusCode, source, request ID and full-text query. group_by returns counts by route, status code or deployment instead of lines — the difference between a readable answer and 1000 log entries.' },
        { name: 'get_web_analytics', what: 'count mode returns one total; aggregate mode returns rows grouped by up to two dimensions and requires since, until and by. Supports OData filters like requestPath eq \'/pricing\' and country eq \'US\'. Needs Web Analytics enabled on the project.' },
        { name: 'deploy_to_vercel', what: 'Deploys a file tree directly — no Git repo, no CLI. You pass target (preview or production), a name, and files as {file, data, encoding}; Vercel creates the project and detects the framework unless you override projectSettings.' },
        { name: 'Agent Runs tools', what: 'list_agent_run_projects and friends expose observability for agents built with the eve framework on Vercel — irrelevant unless you run those.' },
      ],
    },
    useCases: [
      {
        title: 'Diagnose a failed build without opening the dashboard',
        prompt: 'Get the build logs for the most recent failed deployment on this project with errorsOnly, then find the file in this repo the error points at and propose the fix.',
        why: 'errorsOnly plus the local checkout in one context is the whole point — the dashboard can show you the log, but it cannot read the code the log refers to.',
      },
      {
        title: 'Triage production errors in the right order',
        prompt: 'Show me the runtime error clusters for the last 24 hours, then for the largest cluster pull the matching runtime logs grouped by route and tell me which deployment introduced it.',
        why: 'get_runtime_errors first, get_runtime_logs second is the order the docs recommend, and group_by is what keeps the second call from returning a wall of lines.',
      },
      {
        title: 'Ask an analytics question the dashboard makes tedious',
        prompt: 'Aggregate web analytics for this project from July 16 to July 22 by day and route, filtered to country eq \'US\', and tell me which route lost the most traffic week over week.',
        why: 'aggregate mode with two dimensions and an OData filter is a query you would otherwise build by hand; note it only reaches back as far as your plan\'s reporting window.',
      },
    ],
    gotchas: [
      {
        question: 'Why can my AI client not connect to Vercel MCP?',
        answer:
          'Vercel only supports clients it has reviewed and approved. The current list is Claude Code, Claude.ai and Claude Desktop, ChatGPT, Codex CLI, Cursor, VS Code with Copilot, Devin, Raycast, Goose, Windsurf, Gemini Code Assist and Gemini CLI. If yours is not on it, no configuration will fix it — clients are added over time.',
      },
      {
        question: 'Why do Vercel MCP tools keep failing with a missing teamId?',
        answer:
          'teamId is a required parameter on most authenticated tools, including list_projects, get_deployment and the log tools. Give the agent the value up front: it is orgId in .vercel/project.json, or call list_teams first. The team slug works in place of the ID.',
      },
      {
        question: 'VS Code gets stuck authenticating to Vercel MCP — what is the fix?',
        answer:
          'Cancel the "Do you want Code to open the external website?" popup rather than accepting it. VS Code then offers "try a different way? (URL Handler)" — answer Yes, click Open, and complete the Vercel sign-in. This is the documented path, not a workaround.',
      },
      {
        question: 'How far back can Vercel MCP look at errors and analytics?',
        answer:
          'Runtime error clusters span at most 7 days. Runtime logs default to the last 24 hours and cap at 1000 entries per call. Analytics count queries can cover everything since Web Analytics was enabled, but aggregate queries are limited to your plan\'s reporting window.',
      },
      {
        question: 'What access does connecting Vercel MCP grant?',
        answer:
          'The same access as your Vercel user account — there is no reduced-scope mode. Vercel\'s guidance is to keep human confirmation of tool calls enabled, be careful running it alongside other MCP servers because of prompt injection, and verify you are pointed at the official https://mcp.vercel.com endpoint rather than a lookalike from a third-party marketplace.',
      },
      {
        question: 'Can Vercel MCP deploy without a Git repository?',
        answer:
          'Yes. deploy_to_vercel takes a file tree directly with a target of preview or production, creates the project if it does not exist, detects the framework and runs the build. Send source files only — Vercel installs dependencies itself.',
      },
    ],
    comparison: {
      items: [
        {
          name: 'Vercel MCP vs the Vercel CLI',
          choose: 'The CLI when you know the command. MCP when the task is a question — why did this build fail, which route regressed — because the answer needs logs and your code read together.',
        },
        {
          name: 'add-mcp vs per-client configuration',
          choose: 'add-mcp if you run several agents and want them all wired in one command. Per-client config when you need it in exactly one place, or when the client (Windsurf, Gemini) needs its own key shape.',
        },
        {
          name: 'Vercel MCP vs Netlify MCP',
          slug: 'netlify',
          choose: 'Whichever platform hosts the site — neither can see the other. Worth knowing that Vercel\'s is remote and OAuth-only with an approved-client list, which is a stricter connection model than most platform servers.',
        },
      ],
    },
  },
  {
    slug: 'cloudflare',
    verifiedOn: '2026-08-11',
    sources: [
      { label: 'Cloudflare Agents docs — Cloudflare\'s own MCP servers', url: 'https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/' },
      { label: 'Cloudflare Agents docs — Code Mode MCP server patterns', url: 'https://developers.cloudflare.com/agents/model-context-protocol/codemode/' },
      { label: 'cloudflare/mcp — Cloudflare API MCP server', url: 'https://github.com/cloudflare/mcp' },
      { label: 'cloudflare/mcp-server-cloudflare — product-specific servers', url: 'https://github.com/cloudflare/mcp-server-cloudflare' },
      { label: 'cloudflare/skills — agent plugin', url: 'https://github.com/cloudflare/skills' },
    ],
    intro:
      '"The Cloudflare MCP server" is not one thing, and picking the wrong one is the main way this goes badly. There are two families. The Cloudflare API MCP server at https://mcp.cloudflare.com/mcp exposes the entire Cloudflare API — over 2,500 endpoints across DNS, Workers, R2 and Zero Trust — behind exactly two tools, search and execute, using the Code Mode pattern. Separately there are sixteen product-specific servers, each on its own *.mcp.cloudflare.com/mcp hostname, with curated tools for one area: Observability, Workers Bindings, Radar, Browser Rendering, DNS Analytics, CASB and so on. The rule of thumb: if the task spans products or touches an endpoint nobody wrote a tool for, use the API server; if you want a small, legible tool list for one product — and want to see the tool names in your client — pick the product server. The two repos are different too, which is why star counts and issue trackers disagree: the API server is cloudflare/mcp, the sixteen are cloudflare/mcp-server-cloudflare.',
    setup: {
      title: 'Connecting to Cloudflare MCP',
      steps: [
        {
          title: 'The API server — one URL, OAuth on first use',
          body:
            'There is nothing to install and no package to pin. Add the URL, and on connect you are redirected to Cloudflare to authorize and choose which permissions the agent gets. Use the /mcp Streamable HTTP endpoint for anything new.',
          code: '{\n  "mcpServers": {\n    "cloudflare-api": {\n      "url": "https://mcp.cloudflare.com/mcp"\n    }\n  }\n}',
          codeLabel: 'json',
        },
        {
          title: 'A product-specific server — same shape, different hostname',
          body:
            'Every one of the sixteen follows the pattern https://<subdomain>.mcp.cloudflare.com/mcp. Nothing stops you adding several at once; each authorizes separately, and each adds its own tools to the context, which is the cost you are trading against the API server\'s two.',
          code: 'claude mcp add --transport http cloudflare-observability https://observability.mcp.cloudflare.com/mcp\nclaude mcp add --transport http cloudflare-bindings https://bindings.mcp.cloudflare.com/mcp',
          codeLabel: 'shell',
        },
        {
          title: 'Clients that cannot speak remote MCP',
          body:
            'Older clients that only launch local processes need a bridge. mcp-remote runs as a stdio child and proxies to the remote endpoint, handling the OAuth browser flow on your behalf. Swap the subdomain for whichever server you want.',
          code: '{\n  "mcpServers": {\n    "cloudflare": {\n      "command": "npx",\n      "args": ["mcp-remote", "https://bindings.mcp.cloudflare.com/mcp"]\n    }\n  }\n}',
          codeLabel: 'json',
        },
        {
          title: 'CI, where no browser exists',
          body:
            'OAuth is not an option in automation. Create a Cloudflare API token scoped to what the job needs and send it as a bearer token in the Authorization header — both user tokens and account tokens are accepted. This is the one place a long-lived credential belongs.',
          code: 'Authorization: Bearer <cloudflare-api-token>',
          codeLabel: 'http',
        },
        {
          title: 'Or install the skills plugin instead of wiring servers by hand',
          body:
            'cloudflare/skills bundles the MCP servers together with contextual skills and slash commands for building on Cloudflare. It works with any agent supporting the Agent Skills standard — Claude Code, OpenCode, OpenAI Codex and Pi. Cursor takes it from its marketplace, or via Settings → Rules → Add Rule → Remote Rule (GitHub) with cloudflare/skills.',
          code: '# Claude Code\n/plugin marketplace add cloudflare/skills\n\n# any agent, via the skills CLI\nnpx skills add https://github.com/cloudflare/skills',
          codeLabel: 'shell',
        },
      ],
    },
    tools: {
      title: 'Why the API server shows only two tools',
      note: 'Code Mode replaces a tool-per-endpoint listing with a sandbox the model writes JavaScript into. Cloudflare publishes the arithmetic: 2,594 endpoints as native MCP tools costs roughly 1,170,000 tokens of context with full schemas, or ~244,000 with required parameters only. Code Mode costs about 1,000 tokens, and stays there no matter how many endpoints exist — more than the entire context window of most models, reduced to a rounding error.',
      items: [
        { name: 'search', what: 'Runs model-written code against the OpenAPI document and returns only the operations, parameters or schemas the task needs. The full spec never leaves the sandbox — that is the whole point.' },
        { name: 'execute', what: 'Runs model-written code with an authenticated request function (codemode.request({ method, path })). The code composes calls and returns a focused result; the credential itself is never handed to the generated code.' },
        { name: '(product servers)', what: 'The sixteen domain servers are ordinary MCP servers with named tools — observability query tools, binding creation, Radar traffic lookups, page-to-markdown rendering. Use these when you want to read the tool list rather than trust generated code.' },
      ],
    },
    useCases: [
      {
        title: 'Debug a Worker that is throwing in production',
        prompt: 'Using the Cloudflare observability server, show me the errors my Worker has logged in the last hour, grouped by message, and tell me which route they came from.',
        why: 'This is what the Observability server at observability.mcp.cloudflare.com exists for, and it is a case where the product server beats the API server: the tools are already shaped like the question.',
      },
      {
        title: 'Change something the tool list does not cover',
        prompt: 'Find the Cloudflare API operations for zone rulesets, then list the rulesets on this zone with their id, name and phase.',
        why: 'Two calls: search narrows the OpenAPI document to /rulesets, execute runs the request. This is exactly the case the sixteen product servers cannot serve — nobody wrote a ruleset tool, but the endpoint has always been there.',
      },
      {
        title: 'Turn a live page into markdown without leaving the agent',
        prompt: 'Fetch this URL with the Cloudflare Browser Rendering server and give me the page as markdown, plus a screenshot.',
        why: 'browser.mcp.cloudflare.com renders and converts server-side. Worth knowing it exists before reaching for a scraping server — if you are already on Cloudflare, this needs no new account.',
      },
    ],
    gotchas: [
      {
        question: 'Which Cloudflare MCP server should I install?',
        answer:
          'Start with the API server at https://mcp.cloudflare.com/mcp if you want one connection that can reach anything, and accept that you cannot see the tool names in advance. Add a product-specific server when you are working inside one area repeatedly — Observability for debugging, Workers Bindings for building, Radar for Internet data — because its tools are curated and readable. Adding all sixteen is the one clearly wrong answer: you pay their combined tool descriptions on every request.',
      },
      {
        question: 'Why does my client fail to connect to the /sse endpoint?',
        answer:
          'The historical /sse URLs still resolve, but they are aliases pointing at the same Streamable HTTP handler — they no longer serve the deprecated HTTP+SSE transport. A client configured to force SSE will fail against a URL that looks correct. Switch it to Streamable HTTP or to automatic transport detection. The servers support the MCP 2026-07-28 specification and also accept stateless requests from 2025-era Streamable HTTP clients.',
      },
      {
        question: 'Is it safe to let the model write code against my Cloudflare account?',
        answer:
          'The sandbox is real: generated code runs in an isolated Dynamic Worker with direct outbound network access blocked by default, reaching external systems only through upstream MCP tools or the host request callback. But Cloudflare states plainly that code execution does not replace authorization — the sandbox stops exfiltration, it does not stop a destructive API call you granted permission for. Scope the OAuth grant, or the API token in CI, to what the agent actually needs.',
      },
      {
        question: 'Which repository do I file an issue against?',
        answer:
          'cloudflare/mcp is the API/Code Mode server. cloudflare/mcp-server-cloudflare is the monorepo behind all sixteen product servers, one directory per app under apps/. cloudflare/skills is the plugin bundle, not a server. Third-party write-ups routinely conflate the first two, which is also why you will see wildly different star counts cited for "the Cloudflare MCP server".',
      },
      {
        question: 'Do I need to install anything to use these?',
        answer:
          'No, and that is a change from most catalog entries. Every Cloudflare server is remote and hosted; the only npm package in the picture is mcp-remote, and only for clients that cannot open a remote MCP connection themselves. If a guide tells you to npm install a Cloudflare MCP server, it is describing a setup that no longer exists.',
      },
    ],
    comparison: {
      note: 'The useful comparison here is mostly internal — Cloudflare against itself.',
      items: [
        {
          name: 'Cloudflare API server vs the sixteen product servers',
          choose: 'API server for breadth and a fixed ~1,000-token context cost; product servers for a legible tool list in one area. Most people end up with the API server plus one product server, not sixteen.',
        },
        {
          name: 'Cloudflare Browser Rendering vs Playwright MCP',
          slug: 'microsoft-playwright-mcp',
          choose: 'Browser Rendering for stateless fetch-and-convert on infrastructure you already pay for. Playwright when the agent needs a persistent, interactive browser session it can click through.',
        },
        {
          name: 'Cloudflare Observability vs Sentry',
          slug: 'sentry',
          choose: 'Observability reads Workers logs and analytics at the platform level. Sentry is application-level error grouping across whatever you deploy. They answer different halves of "why is it broken".',
        },
      ],
    },
  },
  {
    slug: 'postgresql',
    verifiedOn: '2026-08-12',
    sources: [
      { label: 'modelcontextprotocol/servers-archived — src/postgres', url: 'https://github.com/modelcontextprotocol/servers-archived/tree/main/src/postgres' },
      { label: '@modelcontextprotocol/server-postgres on npm', url: 'https://www.npmjs.com/package/@modelcontextprotocol/server-postgres' },
      { label: 'crystaldba/postgres-mcp on GitHub', url: 'https://github.com/crystaldba/postgres-mcp' },
    ],
    intro:
      'Nearly every "connect Claude to Postgres" article still tells you to run npx @modelcontextprotocol/server-postgres. That server is retired. Its repository moved to modelcontextprotocol/servers-archived — a repo GitHub itself marks archived, described as "Reference MCP servers that are no longer maintained" — and the npm package carries a deprecation notice: "Package no longer supported." It still installs and still runs, which is exactly why the advice keeps propagating. What you get is one tool, query, executing read-only SQL, plus table schemas exposed as resources. No index advice, no health checks, and nothing has shipped in it for a long time. The live server people actually mean when they say "the Postgres MCP server" is Postgres MCP Pro (crystaldba/postgres-mcp, 3,184 stars) — nine tools, an explicit access-mode switch, and index tuning that runs real EXPLAIN plans against hypothetical indexes. This guide sets up the live one and tells you when the archived one is still the right call.',
    setup: {
      title: 'Setting up Postgres MCP Pro',
      steps: [
        {
          title: 'Pick an install method',
          body:
            'Docker is the one to default to: it needs nothing on the host, and the image rewrites localhost in your connection string to reach the host database (host.docker.internal on macOS and Windows, 172.17.0.1 on Linux) rather than looking inside the container — the failure that otherwise reads as "connection refused" against a database you can see running.',
          code: 'docker pull crystaldba/postgres-mcp\n# or, on the host:\npipx install postgres-mcp\nuv pip install postgres-mcp',
          codeLabel: 'shell',
        },
        {
          title: 'Wire it into Claude Desktop with Docker',
          body:
            'DATABASE_URI is passed by name in args and by value in env — that is deliberate in the project\'s own example, so the password is not baked into the argument list. The config file is at ~/Library/Application Support/Claude/claude_desktop_config.json on macOS and %APPDATA%/Claude/claude_desktop_config.json on Windows.',
          code: '{\n  "mcpServers": {\n    "postgres": {\n      "command": "docker",\n      "args": [\n        "run", "-i", "--rm",\n        "-e", "DATABASE_URI",\n        "crystaldba/postgres-mcp",\n        "--access-mode=unrestricted"\n      ],\n      "env": {\n        "DATABASE_URI": "postgresql://username:password@localhost:5432/dbname"\n      }\n    }\n  }\n}',
          codeLabel: 'json',
        },
        {
          title: 'Or run it from uvx with no container',
          body:
            'Same flags, no Docker daemon. This is the shape to use when the database is remote anyway and the localhost remapping buys you nothing.',
          code: '{\n  "mcpServers": {\n    "postgres": {\n      "command": "uvx",\n      "args": ["postgres-mcp", "--access-mode=unrestricted"],\n      "env": {\n        "DATABASE_URI": "postgresql://username:password@localhost:5432/dbname"\n      }\n    }\n  }\n}',
          codeLabel: 'json',
        },
        {
          title: 'Switch to restricted mode for anything you care about',
          body:
            'Replace --access-mode=unrestricted with --access-mode=restricted and every statement runs inside a read-only transaction. The parser also rejects COMMIT and ROLLBACK, which is the detail that makes it hold: without that, a model can close the read-only transaction and open a writable one, and the mode becomes decoration.',
          code: 'uvx postgres-mcp --access-mode=restricted',
          codeLabel: 'shell',
        },
        {
          title: 'Install the two extensions the good tools depend on',
          body:
            'pg_stat_statements is what get_top_queries and analyze_workload_indexes read; hypopg is what lets explain_query cost an index that does not exist yet. Without them the server still starts and those tools simply have nothing to say — a silent degradation that looks like the server being useless.',
          code: 'CREATE EXTENSION IF NOT EXISTS pg_stat_statements;\nCREATE EXTENSION IF NOT EXISTS hypopg;',
          codeLabel: 'sql',
        },
        {
          title: 'SSE, when the client will not spawn a process',
          body:
            'Start it with --transport=sse and it listens on port 8000; clients point at http://localhost:8000/sse. Useful for editors that only take a URL, and for running one server against a shared dev database instead of one process per developer.',
          code: 'docker run -p 8000:8000 \\\n  -e DATABASE_URI=postgresql://username:password@localhost:5432/dbname \\\n  crystaldba/postgres-mcp --access-mode=unrestricted --transport=sse',
          codeLabel: 'shell',
        },
      ],
    },
    tools: {
      title: 'The nine tools',
      note: 'The first four are what the archived reference server did, roughly. The last five are the reason to switch.',
      items: [
        { name: 'list_schemas', what: 'Inventory of database schemas — the usual first call before anything else knows where to look.' },
        { name: 'list_objects', what: 'Tables, views, sequences and extensions within a schema.' },
        { name: 'get_object_details', what: 'Columns, constraints and indexes for one object.' },
        { name: 'execute_sql', what: 'Runs SQL. In restricted mode it is confined to a read-only transaction; in unrestricted mode it will happily write.' },
        { name: 'explain_query', what: 'Execution plans, including plans costed against hypothetical indexes via hypopg — you can ask what a query would cost with an index before creating it.' },
        { name: 'get_top_queries', what: 'Slowest statements from pg_stat_statements.' },
        { name: 'analyze_workload_indexes', what: 'Finds the resource-heavy queries across the workload and proposes indexes for them.' },
        { name: 'analyze_query_indexes', what: 'The same recommendation engine pointed at up to ten specific queries you hand it.' },
        { name: 'analyze_db_health', what: 'Buffer cache, connections, invalid constraints, unused and duplicate indexes, sequence exhaustion, vacuum and replication state.' },
      ],
    },
    useCases: [
      {
        title: 'Index tuning that was actually costed, not guessed',
        prompt: 'Run analyze_workload_indexes, then for the top three recommendations use explain_query with the hypothetical index to show me the before and after plan cost. Do not create anything.',
        why: 'An LLM asked to suggest indexes will always suggest indexes. Making it route through hypopg means the numbers come from the planner rather than from the model, and you see the ones that would not have helped.',
      },
      {
        title: 'The health check nobody schedules',
        prompt: 'Run analyze_db_health and tell me which findings would cause an outage rather than a slowdown — start with sequence exhaustion and invalid constraints.',
        why: 'analyze_db_health covers the failures that are boring until the day an int4 sequence runs out. It is one tool call and there is no equivalent in the archived reference server.',
      },
      {
        title: 'Explain the schema you inherited',
        prompt: 'Using list_schemas, list_objects and get_object_details, write me a description of how orders, payments and refunds relate, and flag any foreign key I would expect to exist that does not.',
        why: 'This is the one thing the archived server could also do, and it remains the most common reason to connect a database at all — with the difference that constraints come back structured instead of as a SELECT you wrote by hand.',
      },
    ],
    gotchas: [
      {
        question: 'Is @modelcontextprotocol/server-postgres deprecated?',
        answer:
          'Yes. The npm package is flagged "Package no longer supported", and the source now lives in modelcontextprotocol/servers-archived, a repository GitHub reports as archived and whose description is "Reference MCP servers that are no longer maintained". It still installs and runs; it just is not being maintained, and it has a single query tool. Use it only for a throwaway read-only connection where you want zero dependencies.',
      },
      {
        question: 'Which Postgres MCP server should I use?',
        answer:
          'Postgres MCP Pro (crystaldba/postgres-mcp) for general use — it is the actively developed one, has nine tools instead of one, and has a real read-only mode. Take the Supabase or Neon server instead if your database is on that platform, because you also get branching, logs and platform tooling that a raw Postgres connection cannot see.',
      },
      {
        question: 'Why does the server say connection refused when my database is running?',
        answer:
          'Almost always Docker networking with localhost in the connection string. The Postgres MCP Pro image remaps it for you (host.docker.internal on macOS and Windows, 172.17.0.1 on Linux), so if you are on the archived server or a different image inside a container, write the host address explicitly rather than localhost.',
      },
      {
        question: 'Is restricted mode actually safe to point at production?',
        answer:
          'It is a genuine read-only transaction, and the parser rejects COMMIT and ROLLBACK specifically so the transaction cannot be escaped — that is more than most database MCP servers do. It still does not stop a query from reading data you did not intend to expose to a model, and it does not stop prompt injection from data stored in your own tables. Treat it as protection against the agent breaking things, not against it seeing things.',
      },
      {
        question: 'Which Postgres versions does it support?',
        answer:
          'Testing focuses on 15, 16 and 17, with stated plans to support 13 through 17. Older majors are not tested, and pg_stat_statements availability on managed providers varies, so confirm the extension exists before assuming the query-analysis tools will return anything.',
      },
      {
        question: 'Do I need an OpenAI API key?',
        answer:
          'No. OPENAI_API_KEY is optional and only used by the experimental LLM-based index tuning path. The standard index recommendations come from the workload statistics and the planner, not from a model.',
      },
    ],
    comparison: {
      items: [
        {
          name: 'Postgres MCP Pro vs the archived reference server',
          choose: 'Pro unless you specifically want the smallest possible surface — one npx process, one read-only query tool, no extensions, nothing maintained.',
        },
        {
          name: 'Postgres MCP vs Supabase MCP',
          slug: 'supabase',
          choose: 'Supabase if the database is a Supabase project: you additionally get logs, advisors, Edge Functions and branching. Plain Postgres when you want SQL and nothing else, including against a Supabase database via its connection string.',
        },
        {
          name: 'Postgres MCP vs Neon MCP',
          slug: 'neon',
          choose: 'Neon when the database is on Neon and you want branch-per-migration workflows. Postgres MCP Pro when you want index and health analysis, which the platform servers do not do at the same depth.',
        },
      ],
    },
  },
  {
    slug: 'neon',
    verifiedOn: '2026-08-12',
    sources: [
      { label: 'neondatabase/mcp-server-neon on GitHub', url: 'https://github.com/neondatabase/mcp-server-neon' },
      { label: 'Neon Docs — Neon MCP Server', url: 'https://neon.com/docs/ai/neon-mcp-server' },
    ],
    intro:
      'The Neon server is remote-first — there is nothing to install, you point a client at https://mcp.neon.tech/mcp and authorize in a browser — and that makes the interesting configuration entirely a matter of what you put in the URL. Three query params (readonly, category, projectId) decide whether the agent can write, which tool categories exist at all, and whether it can see one project or your whole account. This matters more here than on most servers because the default surface is roughly thirty tools spanning project creation, deletion, migrations and auth provisioning, and because Neon says plainly in its own README that the server is "intended for local development and IDE integrations only" and that it does not recommend running it against production. The other thing worth knowing before you start: the migration tools are two-phase on purpose, and the branch they create is what makes "let the agent change my schema" a defensible idea rather than a reckless one.',
    setup: {
      title: 'Connecting the Neon MCP server',
      steps: [
        {
          title: 'One command, if your editor is Cursor, VS Code or Claude Code',
          body:
            'neon init authenticates over OAuth, mints an API key for you, and writes the MCP config plus Neon\'s agent skills and the VS Code extension. It is the fastest path and the one to use unless you need a specific scoped URL.',
          code: 'npx neon@latest init',
          codeLabel: 'shell',
        },
        {
          title: 'Or register the hosted server everywhere at once',
          body:
            'add-mcp detects the agents and editors in the workspace and adds the entry to each. It is project-scoped by default; add -g to write it to the global MCP server list instead. On first connect a browser window opens for the OAuth grant.',
          code: 'npx add-mcp https://mcp.neon.tech/mcp',
          codeLabel: 'shell',
        },
        {
          title: 'Or write the config by hand',
          body:
            'Streamable HTTP, so there is no command and no args. Any client that speaks it takes this verbatim.',
          code: '{\n  "mcpServers": {\n    "Neon": {\n      "type": "http",\n      "url": "https://mcp.neon.tech/mcp"\n    }\n  }\n}',
          codeLabel: 'json',
        },
        {
          title: 'Constrain it in the URL before you connect anything real',
          body:
            'readonly=true removes the write tools and leaves run_sql available for read-only queries. projectId confines every operation to one project — and note that in project-scoped mode the docs-search tools search and fetch become unavailable. Config in the URL travels with each request and takes effect immediately, with no re-auth.',
          code: 'https://mcp.neon.tech/mcp?readonly=true&projectId=proj-123',
          codeLabel: 'url',
        },
        {
          title: 'Cut the tool list with category=',
          body:
            'category takes repeated params or a CSV, drawn from projects, branches, schema, querying, neon_auth, data_api, observability and docs. Dropping to two categories is the cheapest way to shrink both the risk and the tokens the tool list costs on every turn.',
          code: 'https://mcp.neon.tech/mcp?category=querying&category=schema',
          codeLabel: 'url',
        },
        {
          title: 'Check what a URL actually exposes before you trust it',
          body:
            'The server will tell you which tools a given configuration yields, without authenticating. Worth running once after you write a scoped URL, rather than assuming the params did what you meant.',
          code: 'curl "https://mcp.neon.tech/api/list-tools?readonly=true&category=querying"',
          codeLabel: 'shell',
        },
        {
          title: 'API-key auth, where no browser exists',
          body:
            'Create the key in the Neon Console and pass it as a bearer header. Use an organization key to confine access to that organization\'s projects. In this flow there is no OAuth scope exchange, so readonly=true in the URL is the only way to get read-only mode.',
          code: 'npx add-mcp https://mcp.neon.tech/mcp \\\n  --header "Authorization: Bearer <$NEON_API_KEY>"',
          codeLabel: 'shell',
        },
      ],
    },
    tools: {
      title: 'Tool categories',
      note: 'Roughly thirty tools, grouped by the scope category used for filtering and for the OAuth consent screen.',
      items: [
        { name: 'projects', what: 'list_projects (first 10 unless you raise limit), list_shared_projects, describe_project, list_organizations, plus create_project and delete_project behind write access.' },
        { name: 'branches', what: 'create_branch, delete_branch, describe_branch, list_branch_computes, compare_database_schema (diff against parent) and reset_from_parent, which auto-preserves a backup if the branch has children.' },
        { name: 'querying', what: 'run_sql, run_sql_transaction, get_connection_string. run_sql stays available in read-only mode but only for read-only queries.' },
        { name: 'schema', what: 'get_database_tables and describe_table_schema, plus the two-phase prepare_database_migration and complete_database_migration.' },
        { name: 'observability', what: 'query_logs, list_log_fields, list_log_field_values, and the optimization set — inspect_database, list_slow_queries, explain_sql_statement, prepare_query_tuning, complete_query_tuning.' },
        { name: 'neon_auth / data_api', what: 'provision_neon_auth, configure_neon_auth, get_neon_auth_config and provision_neon_data_api. All writes except reading the config; disable these unless you are actually provisioning.' },
        { name: 'docs', what: 'search, fetch, list_docs_resources, get_doc_resource — Neon\'s documentation, the only category with no access to your data. Note that search and fetch drop out under projectId.' },
      ],
    },
    useCases: [
      {
        title: 'Migrate on a branch, then decide',
        prompt: 'Use prepare_database_migration to add a created_at timestamptz default now() to public.users, run my smoke queries against the temporary branch, show me compare_database_schema against the parent, and stop before completing.',
        why: 'prepare creates a throwaway branch and applies the change there; complete is a separate call that merges it and cleans up. Stopping between the two is the whole point — you review a real applied schema, not a proposed diff.',
      },
      {
        title: 'Find the slow query and prove the fix',
        prompt: 'Run list_slow_queries, take the worst one, use explain_sql_statement to show the plan, then run prepare_query_tuning and tell me what it changed and what the new plan costs.',
        why: 'The tuning tools are two-phase like migrations, so the optimization is applied somewhere disposable first. This is the workflow that justifies giving an agent database access at all.',
      },
      {
        title: 'A read-only analyst on one project',
        prompt: 'Using only the tables in this project, tell me which accounts signed up in the last 30 days and never returned, and show the SQL you ran.',
        why: 'Point this at ?readonly=true&projectId=... and the agent physically cannot create, delete or migrate anything. It is the configuration to hand to anyone who is not the person on call.',
      },
    ],
    gotchas: [
      {
        question: 'Can I use the Neon MCP server in production?',
        answer:
          'Neon says no. Its README states the server is intended for local development and IDE integrations only and that it does not recommend production use, because it can execute powerful operations that lead to accidental or unauthorized changes. If you need something production-adjacent, use readonly=true with projectId and treat it as a reporting connection.',
      },
      {
        question: 'Why does the MCP server not see my organization\'s projects?',
        answer:
          'With OAuth the server defaults to projects under your personal Neon account. To reach organization projects you have to name the org_id or project_id in your prompt, or connect with an organization API key instead, which confines access to that organization by construction.',
      },
      {
        question: 'How do I make the Neon MCP server read-only?',
        answer:
          'Two ways, and which one applies depends on your auth. Under OAuth, uncheck Full access in the consent UI, or override it with ?readonly=true in the URL. Under API-key auth there is no scope exchange, so ?readonly=true is the mechanism. The legacy x-read-only header still works as a lower-priority fallback.',
      },
      {
        question: 'The connection fails and I have IP Allow enabled — what do I whitelist?',
        answer:
          'The static IPs for mcp.neon.tech: 34.192.103.46 and 23.22.233.166. Without them the OAuth flow can succeed while every subsequent database call fails, which reads as a broken server rather than a network rule.',
      },
      {
        question: 'My client does not support Streamable HTTP — is there an SSE endpoint?',
        answer:
          'Yes, https://mcp.neon.tech/sse, added with npx add-mcp https://mcp.neon.tech/sse --type sse. SSE is the deprecated transport in MCP and Streamable HTTP is recommended, so treat this as a compatibility path for older clients rather than a choice.',
      },
      {
        question: 'Do I need to run the server locally?',
        answer:
          'No, and generally you should not. The remote server at mcp.neon.tech is Neon-hosted and picks up new features as they ship; a local install pins you to whatever you last pulled. Node 18 or newer is only needed for the npx setup commands themselves.',
      },
    ],
    comparison: {
      items: [
        {
          name: 'Neon MCP vs a generic Postgres MCP server',
          slug: 'postgresql',
          choose: 'Neon when you want the platform — branches, migrations on a throwaway branch, logs, connection strings. A Postgres server when you want SQL and index analysis against the database itself and would rather not expose project creation and deletion at all.',
        },
        {
          name: 'Neon MCP vs Supabase MCP',
          slug: 'supabase',
          choose: 'Whichever hosts your database; they are not interchangeable. The shapes rhyme, though — both are hosted, both are OAuth, both put read-only and project scoping in URL params, and both tell you not to point them at production.',
        },
        {
          name: 'Remote server vs running mcp-server-neon locally',
          choose: 'Remote, in almost every case. Local exists for development on the server itself and needs Node 22+ with Corepack; it gains you nothing operationally and falls behind.',
        },
      ],
    },
  },
  {
    slug: 'clickhouse',
    verifiedOn: '2026-08-12',
    sources: [
      { label: 'ClickHouse/mcp-clickhouse on GitHub', url: 'https://github.com/ClickHouse/mcp-clickhouse' },
      { label: 'mcp-clickhouse on PyPI', url: 'https://pypi.org/project/mcp-clickhouse' },
      { label: 'ClickHouse SQL Playground', url: 'https://sql.clickhouse.com/' },
    ],
    intro:
      'Most of what goes wrong with this server is not the server. It is that `CLICKHOUSE_*` names two unrelated things and people configure one while thinking about the other: the variables that decide how this process dials your database, and the `CLICKHOUSE_MCP_*` variables that decide how MCP clients reach this process. The README calls that out explicitly, and it is worth internalising before you paste anything, because the failure mode is an opaque HTTP or TLS error in the server log rather than a message that says "wrong scheme". The second thing to know is that safety here is two-tier and off by default in a way that is genuinely useful: reads work with no flags, writes need `CLICKHOUSE_ALLOW_WRITE_ACCESS=true`, and `DROP`/`TRUNCATE` need `CLICKHOUSE_ALLOW_DROP=true` on top of that. And if you only want to see whether a ClickHouse-shaped agent is useful at all, you can point it at ClickHouse\'s public playground and never connect a cluster of your own.',
    setup: {
      title: 'Connecting mcp-clickhouse',
      steps: [
        {
          title: 'Try it against the public playground first',
          body:
            'No account, no cluster, no credentials — the demo user on ClickHouse\'s SQL Playground is read-only and populated with real datasets. This is the config to paste into Claude Desktop if what you want to know is whether the tools are worth wiring to your own data.',
          code: '{\n  "mcpServers": {\n    "mcp-clickhouse": {\n      "command": "uv",\n      "args": ["run", "--with", "mcp-clickhouse", "--python", "3.10", "mcp-clickhouse"],\n      "env": {\n        "CLICKHOUSE_HOST": "sql-clickhouse.clickhouse.com",\n        "CLICKHOUSE_PORT": "8443",\n        "CLICKHOUSE_USER": "demo",\n        "CLICKHOUSE_PASSWORD": "",\n        "CLICKHOUSE_SECURE": "true",\n        "CLICKHOUSE_VERIFY": "true"\n      }\n    }\n  }\n}',
          codeLabel: 'json',
        },
        {
          title: 'Point it at your own cluster',
          body:
            'Only three variables are required: `CLICKHOUSE_HOST`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`. Port defaults follow `CLICKHOUSE_SECURE` — 8443 when true, 8123 when false — so on ClickHouse Cloud you can usually leave the port unset entirely. The README is blunt about the user: treat it as any external client, grant the minimum privileges, never the default or an admin account.',
          code: 'CLICKHOUSE_HOST=your-instance.clickhouse.cloud\nCLICKHOUSE_USER=mcp_readonly\nCLICKHOUSE_PASSWORD=...\n# CLICKHOUSE_SECURE=true is the default and implies port 8443\n# CLICKHOUSE_DATABASE=analytics   # optional, avoids qualifying every table',
          codeLabel: 'env',
        },
        {
          title: 'Use the HTTP interface port, not the native one',
          body:
            'This server talks to ClickHouse over the HTTP interface via clickhouse-connect. 8123 plain and 8443 TLS work; 9000 and 9440 are the native TCP protocol that `clickhouse-client` uses and will not work here. If you see `Port 9000 is for clickhouse-client program`, that is the whole diagnosis.',
        },
        {
          title: 'Replace `uv` with its absolute path',
          body:
            'Claude Desktop does not inherit your shell PATH, so a bare `uv` resolves inconsistently or not at all. Run `which uv` and paste the result as `command`. The same applies to `python3` or `mcp-clickhouse` if you install from PyPI instead of running it with uv.',
          code: 'which uv\n# → /Users/you/.local/bin/uv',
          codeLabel: 'shell',
        },
        {
          title: 'Turn on writes only if you mean it, and drops separately',
          body:
            'Left alone, queries run with the `readonly=1` setting and mutations are impossible. `CLICKHOUSE_ALLOW_WRITE_ACCESS=true` unlocks DDL and DML; `DROP TABLE`, `DROP DATABASE`, `DROP VIEW`, `DROP DICTIONARY` and `TRUNCATE TABLE` stay blocked until `CLICKHOUSE_ALLOW_DROP=true` is also set. Read-only enforcement also survives being enabled here if the ClickHouse instance itself disallows writes.',
          code: '"env": {\n  "CLICKHOUSE_ALLOW_WRITE_ACCESS": "true",\n  "CLICKHOUSE_ALLOW_DROP": "true"\n}',
          codeLabel: 'json',
        },
        {
          title: 'HTTP transport: authentication is required, not optional',
          body:
            'stdio needs no auth because it never opens a socket. Under `http` or `sse` the process refuses to start unless exactly one of three things is configured: a static bearer token, a FastMCP auth provider, or an explicit development-only opt-out. Generate the token with `uuidgen` or `openssl rand -hex 32` and send it as `Authorization: Bearer <token>`.',
          code: 'CLICKHOUSE_MCP_SERVER_TRANSPORT=http\nCLICKHOUSE_MCP_BIND_HOST=0.0.0.0\nCLICKHOUSE_MCP_BIND_PORT=4200\nCLICKHOUSE_MCP_AUTH_TOKEN="$(openssl rand -hex 32)"\n# MCP endpoint:  http://localhost:4200/mcp\n# Health check:  http://localhost:4200/health',
          codeLabel: 'env',
        },
        {
          title: 'For an identity provider, hand auth to FastMCP',
          body:
            '`FASTMCP_SERVER_AUTH` takes the full class path of a FastMCP auth provider — Azure Entra, Google, GitHub, WorkOS — and the provider reads its own `FASTMCP_SERVER_AUTH_*` variables. Leave `CLICKHOUSE_MCP_AUTH_TOKEN` unset in this mode; the two are alternatives, not layers.',
          code: 'export FASTMCP_SERVER_AUTH=fastmcp.server.auth.providers.azure.AzureProvider\nexport FASTMCP_SERVER_AUTH_AZURE_TENANT_ID="<tenant-id>"\nexport FASTMCP_SERVER_AUTH_AZURE_CLIENT_ID="<client-id>"\nexport FASTMCP_SERVER_AUTH_AZURE_CLIENT_SECRET="<client-secret>"',
          codeLabel: 'shell',
        },
        {
          title: 'chDB, if you want queries without a cluster',
          body:
            'chDB is ClickHouse as an in-process engine, and it ships as an optional extra rather than being installed by default. Enabling it alone — `CLICKHOUSE_ENABLED=false` — gives you a server that queries files, URLs and external databases with no ClickHouse deployment behind it at all. `CHDB_DATA_PATH` defaults to `:memory:`; give it a path to persist.',
          code: '{\n  "command": "uv",\n  "args": ["run", "--with", "mcp-clickhouse[chdb]", "--python", "3.10", "mcp-clickhouse"],\n  "env": {\n    "CHDB_ENABLED": "true",\n    "CLICKHOUSE_ENABLED": "false",\n    "CHDB_DATA_PATH": "/path/to/chdb/data"\n  }\n}',
          codeLabel: 'json',
        },
      ],
    },
    tools: {
      title: 'Tools',
      note: 'Four, and the split matters: three go to your ClickHouse cluster, one goes to the embedded chDB engine and never touches it.',
      items: [
        { name: 'run_query', what: 'Executes arbitrary SQL against the cluster. Read-only by default via the `readonly=1` setting; subject to `CLICKHOUSE_MCP_QUERY_TIMEOUT`, which defaults to 30 seconds.' },
        { name: 'list_databases', what: 'Lists every database on the cluster. No arguments.' },
        { name: 'list_tables', what: 'Paginated. Takes `database`, plus optional `like`/`not_like` name filters, `page_token`, `page_size` (default 50) and `include_detailed_columns` (default true). Returns `tables`, `next_page_token` and `total_tables`.' },
        { name: 'run_chdb_select_query', what: 'SELECTs through chDB\'s embedded engine against files, URLs and external databases — no ETL and no cluster. Requires the `mcp-clickhouse[chdb]` extra and `CHDB_ENABLED=true`.' },
      ],
    },
    useCases: [
      {
        title: 'Explore a schema you have never seen',
        prompt: 'Run list_databases, then list_tables on the one that looks like production analytics with include_detailed_columns set to false, and summarise what each table appears to record from its name and create_table_query.',
        why: 'Setting `include_detailed_columns` to false is the trick on a wide schema: you keep the full `create_table_query` for every table but drop the per-column metadata, which is what otherwise blows the response past what the model will read in one turn.',
      },
      {
        title: 'Aggregate over a dataset you do not own',
        prompt: 'Using run_chdb_select_query, read the Parquet file at this URL and give me the top 20 values by count, without loading it anywhere.',
        why: 'chDB is the reason to reach for this server over a generic SQL one. Querying a remote file directly removes the load step entirely, and because it is in-process there is no cluster to provision for a one-off question.',
      },
      {
        title: 'Let an analyst loose on the cluster without risk',
        prompt: 'Answer questions about our event data using run_query only, and show me the SQL for every number you report.',
        why: 'With no write flags set, the connection is enforced read-only at the ClickHouse setting level rather than by prompt instruction. Pair it with a minimally-privileged database user and this is a safe default to hand to someone who is not on call.',
      },
    ],
    gotchas: [
      {
        question: 'Why does the ClickHouse MCP server fail to start with HTTP transport?',
        answer:
          'Because authentication is required by default on `http` and `sse`, and startup fails if none of the three modes is configured. Set `CLICKHOUSE_MCP_AUTH_TOKEN`, or `FASTMCP_SERVER_AUTH`, or — for local work only — `CLICKHOUSE_MCP_AUTH_DISABLED=true`. stdio, the default transport, is exempt because it communicates only over standard input and output.',
      },
      {
        question: 'I set CLICKHOUSE_SECURE=false because my MCP server is behind an ingress. Why did the database connection break?',
        answer:
          'Those are different layers. `CLICKHOUSE_SECURE`, `CLICKHOUSE_VERIFY` and `CLICKHOUSE_PORT` configure how this process reaches ClickHouse; they do nothing to the MCP protocol endpoint. Turning the flag off makes the server dial ClickHouse over plain HTTP, often against an HTTPS-only port, and the errors that come back are HTTP/TLS noise rather than a clear mismatch. Keep it aligned with how the pod reaches the database and configure ingress TLS separately.',
      },
      {
        question: 'Why do I get "Port 9000 is for clickhouse-client program"?',
        answer:
          'You pointed `CLICKHOUSE_PORT` at the native TCP protocol. This server uses the HTTP interface — 8123 plain, 8443 TLS, or whatever your deployment maps HTTP to. 9000 and 9440 belong to `clickhouse-client` and are not supported here.',
      },
      {
        question: 'Can the AI drop my tables?',
        answer:
          'Not without two separate opt-ins. Writes require `CLICKHOUSE_ALLOW_WRITE_ACCESS=true`, and even then `DROP TABLE`, `DROP DATABASE`, `DROP VIEW`, `DROP DICTIONARY` and `TRUNCATE TABLE` remain blocked until `CLICKHOUSE_ALLOW_DROP=true` is set as well. Neither is on by default.',
      },
      {
        question: 'Why do chDB queries fail with the server otherwise working?',
        answer:
          'chDB is an optional extra and is disabled by default. You need both the dependency — install `mcp-clickhouse[chdb]`, not plain `mcp-clickhouse` — and `CHDB_ENABLED=true`. Installing the extra without the flag, or the flag without the extra, both present as the tool simply not working.',
      },
      {
        question: 'Queries time out on large tables. Which timeout do I raise?',
        answer:
          'Probably `CLICKHOUSE_MCP_QUERY_TIMEOUT`, which caps the query tools at 30 seconds and produces `Query timed out after ...`. That is separate from `CLICKHOUSE_SEND_RECEIVE_TIMEOUT` (300s, the database client) and `CLICKHOUSE_CONNECT_TIMEOUT` (30s, establishing the connection). Match the error text to the layer before changing anything.',
      },
      {
        question: 'Is the /health endpoint safe to expose?',
        answer:
          'It is designed to be. It is deliberately unauthenticated so Kubernetes probes and load balancers can reach it without credentials, and the body is just `OK` or a generic 503 specifically to avoid leaking version strings or error detail. The corollary: a 200 from /health proves nothing about your bearer token. To test auth, POST a JSON-RPC request to `/mcp` with and without the header and confirm the unauthenticated one returns 401.',
      },
      {
        question: 'Can I connect through a reverse proxy or a load balancer with a different certificate hostname?',
        answer:
          'Yes. `CLICKHOUSE_SERVER_HOST_NAME` overrides the SNI hostname and the name used for certificate validation, and `CLICKHOUSE_PROXY_PATH` sets a URL path prefix when the HTTP interface is exposed under one, for example `/clickhouse`. Reach for these before disabling `CLICKHOUSE_VERIFY`.',
      },
    ],
    comparison: {
      items: [
        {
          name: 'ClickHouse MCP vs a Postgres MCP server',
          slug: 'postgresql',
          choose: 'Whichever holds the data — but note the difference in ambition. The Postgres servers add index tuning and health analysis; this one stays close to "run SQL, list things" and puts its extra surface into chDB and transport instead.',
        },
        {
          name: 'ClickHouse tools vs chDB tools',
          choose: 'The cluster tools when the data already lives in ClickHouse. chDB when it lives in files, URLs or another database and you would rather not load it anywhere first. Both can be on at once, and `CLICKHOUSE_ENABLED=false` gives you chDB alone.',
        },
        {
          name: 'stdio vs HTTP transport',
          choose: 'stdio for Claude Desktop and anything running on your machine — no listener, no auth to configure. HTTP or SSE only when the server has to be reachable over a network, at which point authentication stops being optional and you own a service.',
        },
      ],
    },
  },
  {
    slug: 'mongodb',
    verifiedOn: '2026-08-13',
    sources: [
      { label: 'mongodb-js/mongodb-mcp-server README', url: 'https://github.com/mongodb-js/mongodb-mcp-server' },
      { label: 'MongoDB Atlas — Service Accounts overview', url: 'https://www.mongodb.com/docs/atlas/api/service-accounts-overview/' },
      { label: 'MongoDB Atlas — service user roles', url: 'https://www.mongodb.com/docs/atlas/reference/user-roles/#service-user-roles' },
      { label: 'MCP specification — elicitation', url: 'https://modelcontextprotocol.io/specification/draft/client/elicitation' },
    ],
    intro:
      'There is only one MongoDB MCP server — `mongodb-js/mongodb-mcp-server`, maintained by MongoDB — so unlike Postgres you do not have to pick. What you do have to pick is which half of it you are turning on, because it is really two servers sharing a process. The database half talks to a deployment over a connection string and gives you `find`, `aggregate`, `explain`, index and schema tools. The Atlas half is a control plane: it creates clusters, database users and access-list entries, and it authenticates with Atlas Service Account credentials, not with your connection string. Set only `MDB_MCP_CONNECTION_STRING` and the Atlas tools never register; that is the single most common "the tools are missing" report, and it is configuration, not a bug. The other thing to know before you paste anything: `readOnly` defaults to false. MongoDB puts `--readOnly` in every example in its own README, which is a fair signal about what the default should be for an agent pointed at a real database.',
    setup: {
      title: 'Connecting the MongoDB MCP server',
      steps: [
        {
          title: 'Check your Node version first',
          body:
            'The server requires Node 22.13.0 or later. Node 20 still runs but is formally deprecated and will be removed in a future release, and the failure on an older runtime is a syntax or engine error at startup rather than anything that mentions MongoDB. Check before you debug anything else.',
          code: 'node -v\n# needs v22.13.0 or later',
          codeLabel: 'shell',
        },
        {
          title: 'Option A — a connection string, read-only',
          body:
            'This is the configuration to start from: it reaches one deployment, and no tool that creates, updates or deletes is registered at all. `MDB_MCP_CONNECTION_STRING` accepts anything the driver accepts, local or `mongodb+srv://` Atlas. Keep the credentials in `env` rather than in `args` — MongoDB explicitly recommends this, because command-line arguments show up in process lists and in whatever collects them.',
          code: '{\n  "mcpServers": {\n    "MongoDB": {\n      "command": "npx",\n      "args": ["-y", "mongodb-mcp-server@latest", "--readOnly"],\n      "env": {\n        "MDB_MCP_CONNECTION_STRING": "mongodb://localhost:27017/myDatabase"\n      }\n    }\n  }\n}',
          codeLabel: 'json',
        },
        {
          title: 'Option B — Atlas Service Account credentials',
          body:
            'The Atlas tools need a service account, created under Access Manager → Organization Access → Add New → Applications → Service Accounts. Give it an expiry. The client secret is shown once and never again. You also have to add the IP the server runs from to the API access list, or every Atlas call fails at the network layer before any permission is evaluated. Set both credentials and a connection string if you want both halves at once.',
          code: '{\n  "mcpServers": {\n    "MongoDB": {\n      "command": "npx",\n      "args": ["-y", "mongodb-mcp-server@latest", "--readOnly"],\n      "env": {\n        "MDB_MCP_API_CLIENT_ID": "<service-account-client-id>",\n        "MDB_MCP_API_CLIENT_SECRET": "<service-account-client-secret>"\n      }\n    }\n  }\n}',
          codeLabel: 'json',
        },
        {
          title: 'Give the service account the smallest role that works',
          body:
            'MongoDB’s own warning is that Organization Owner is rarely necessary and is a security risk, and the roles are granular enough that you never need it: Org Member or Org Read Only to list orgs and projects, Org Project Creator to create projects, Project Read Only to view clusters, Project Cluster Manager to create and scale them, Project IP Access List Admin for access lists, Project Database Access Admin for database users, Project Stream Processing Owner for the streams tools. Prefer project-level roles, scoped to the projects you actually want an agent touching.',
        },
        {
          title: 'Or connect at runtime instead of preconfiguring',
          body:
            'Leaving the connection string unset is a legitimate mode, not an incomplete one: the model calls the `connect` tool with a URI and gets back a `connectionId` to pass to subsequent calls, `list-connections` enumerates them and `disconnect` revokes one. Connections are scoped to the MCP session by default (`connectionScope`), so a session only sees what it opened and everything closes when it ends. A single scope holds at most ten open connections — past that the least-recently-used one is closed and its id revoked, which surfaces as a previously working `connectionId` suddenly being invalid.',
          code: 'MDB_MCP_CONNECTION_SCOPE=session   # default; "global" shares connections across sessions\nMDB_MCP_MAX_ACTIVE_CONNECTIONS=10  # default; LRU eviction past this',
          codeLabel: 'env',
        },
        {
          title: 'Docker, if you would rather not install Node',
          body:
            'The published image takes the same environment variables. Note that the flag form does not exist here — read-only is `MDB_MCP_READ_ONLY=true` passed as an environment variable, and `-i` is required because the container talks stdio to the client.',
          code: 'export MDB_MCP_CONNECTION_STRING="mongodb+srv://user:pass@cluster.mongodb.net/myDatabase"\n\ndocker run --rm -i \\\n  -e MDB_MCP_CONNECTION_STRING \\\n  -e MDB_MCP_READ_ONLY="true" \\\n  mongodb/mongodb-mcp-server:latest',
          codeLabel: 'shell',
        },
        {
          title: 'Verify the configuration without starting the server',
          body:
            '`--dryRun` dumps the resolved configuration and the list of tools that would be enabled, then exits. This is the fastest way to answer "why can the agent see `drop-collection`" or "why are there no Atlas tools" — you get the answer in a terminal instead of by interrogating the model. Precedence is command-line arguments, then environment variables, then the config file, so a stray flag beats the env you thought was authoritative.',
          code: 'npx -y mongodb-mcp-server@latest --readOnly --dryRun',
          codeLabel: 'shell',
        },
        {
          title: 'HTTP transport and the separate monitoring port',
          body:
            'Default transport is stdio. `--transport http` binds to 127.0.0.1:3000 and is the mode to use when the server is shared rather than launched per-client. Health checks and Prometheus metrics do not live on that port: they are a second listener that only starts when both `monitoringServerHost` and `monitoringServerPort` are set, exposing `/health` and, if you add it to `monitoringServerFeatures`, `/metrics`.',
          code: 'MDB_MCP_TRANSPORT=http\nMDB_MCP_HTTP_HOST=127.0.0.1\nMDB_MCP_HTTP_PORT=3000\nMDB_MCP_MONITORING_SERVER_HOST=127.0.0.1\nMDB_MCP_MONITORING_SERVER_PORT=9091\nMDB_MCP_MONITORING_SERVER_FEATURES=health-check,metrics',
          codeLabel: 'env',
        },
      ],
    },
    tools: {
      title: 'What it can do',
      note:
        'Roughly sixty tools in four families. The database tools need a connection; the Atlas tools need service account credentials; the Atlas Local tools drive containerised deployments; the Assistant tools search MongoDB’s own documentation. `--readOnly` removes every create, update and delete tool from all of them.',
      items: [
        { name: 'find', what: 'Run a find query against a collection. Capped by maxDocumentsPerQuery (100) and maxBytesPerQuery (16 MB).' },
        { name: 'aggregate / aggregate-db', what: 'Run an aggregation against a collection or a whole database. Always asks for confirmation when the pipeline contains $out or $merge.' },
        { name: 'explain', what: 'Return the execution statistics for the winning plan the query optimiser chose — the tool that makes "why is this slow" answerable.' },
        { name: 'collection-schema', what: 'Infer and describe the schema of a collection, which is how the model learns your document shape without you writing it out.' },
        { name: 'collection-indexes / create-index / drop-index', what: 'Inspect and manage indexes.' },
        { name: 'export', what: 'Export query or aggregation results as EJSON, retrievable at exported-data://{exportName}.' },
        { name: 'mongodb-logs', what: 'Return the most recent logged mongod events.' },
        { name: 'connect / list-connections / disconnect', what: 'Open, enumerate and revoke connections at runtime when no connection string is preconfigured.' },
        { name: 'atlas-list-clusters / atlas-inspect-cluster', what: 'Read the control plane: what exists, and what state it is in.' },
        { name: 'atlas-create-free-cluster / atlas-create-cluster', what: 'Provision. The dedicated version returns immediately — poll atlas-inspect-cluster until state is IDLE, because connection strings do not exist before then.' },
        { name: 'atlas-get-performance-advisor', what: 'Atlas’s own suggested indexes, drop-index suggestions, schema suggestions and up to fifty recent slow queries.' },
        { name: 'atlas-local-create-deployment', what: 'Create a local Atlas deployment in Docker; defaults to the preview image tag.' },
        { name: 'search-knowledge / list-knowledge-sources', what: 'Search MongoDB’s documentation and curated guidance from inside the client.' },
      ],
    },
    useCases: [
      {
        title: 'Diagnose a slow endpoint without a mongosh session',
        prompt:
          'Connect read-only, look at the orders collection, and explain the query {status: "pending", createdAt: {$gt: ISODate("2026-08-01")}}. Tell me whether it uses an index, and if not, which index would fix it and what it would cost to build.',
        why:
          '`explain` plus `collection-indexes` is the pairing that makes this worth doing conversationally — the model reads the winning plan and the existing indexes together, which is the part that is tedious by hand.',
      },
      {
        title: 'Refuse collection scans instead of noticing them later',
        prompt:
          'Run the same query again with indexCheck on, and if it is rejected, propose the index.',
        why:
          '`MDB_MCP_INDEX_CHECK=true` rejects any query that would do a collection scan. On a production replica that turns an agent from a plausible cause of a page into something that cannot start one.',
      },
      {
        title: 'Have Atlas tell you what to fix',
        prompt:
          'Use the performance advisor on the production cluster and summarise the suggested indexes, the drop suggestions, and the slowest recent queries.',
        why:
          '`atlas-get-performance-advisor` is the tool with the best ratio of value to risk in the whole server: it only reads, and it returns recommendations Atlas has already computed rather than asking a model to invent them.',
      },
    ],
    gotchas: [
      {
        question: 'Is the MongoDB MCP server read-only by default?',
        answer:
          'No. `MDB_MCP_READ_ONLY` / `--readOnly` defaults to false, so `insert-many`, `update-many`, `delete-many`, `drop-collection` and `drop-database` are all registered unless you say otherwise. Every example in MongoDB’s README passes `--readOnly` explicitly. Turning it on filters by operation type — read, connect and metadata tools stay, everything else is never registered, and the server logs which tools it withheld.',
      },
      {
        question: 'Why are the Atlas tools missing from the MongoDB MCP server?',
        answer:
          'Because they only register when `MDB_MCP_API_CLIENT_ID` and `MDB_MCP_API_CLIENT_SECRET` are set. A connection string authenticates you to a deployment; the Atlas tools talk to the Atlas Administration API, which is a different system with different credentials. Create a Service Account under Organization Access, add the server’s IP to the API access list, and run `--dryRun` to confirm the tools appear.',
      },
      {
        question: 'Will it ask before dropping a collection?',
        answer:
          'Only if your client supports MCP elicitation. `drop-database`, `drop-collection`, `delete-many`, `drop-index`, `atlas-create-db-user`, `atlas-create-access-list`, `atlas-streams-manage` and `atlas-streams-teardown` are confirmation-required by default — but if the client cannot elicit, the tool runs without confirmation. That is the important half of the sentence: a confirmation prompt is not a permission boundary. `--readOnly` or `--disabledTools` is.',
      },
      {
        question: 'Why did my find only return 100 documents?',
        answer:
          'That is `maxDocumentsPerQuery`, which defaults to 100 and is an upper bound on the tool’s own `limit` parameter, not a suggestion. There is a byte ceiling too, `maxBytesPerQuery` at 16 MB. Both are deliberate: the results go into a context window. Raise them if you must, or use `export` and read the EJSON rather than streaming a collection through the model.',
      },
      {
        question: 'Why does $where fail in a query?',
        answer:
          'Server-side JavaScript is disabled by default — `MDB_MCP_DISABLE_SERVER_SIDE_JS` is true, which blocks `$where`, `$function` and `$accumulator` in filters and pipelines. This is the correct default when the filter text is written by a language model. Rewrite the predicate as a normal query operator rather than turning the flag off.',
      },
      {
        question: 'How do I disable a whole category of tools?',
        answer:
          '`disabledTools` takes tool names, operation types (`create`, `update`, `delete`, `read`, `metadata`, `connect`) and categories (`atlas`, `mongodb`) in the same list. The syntax differs by configuration method and this trips people: comma-separated as an environment variable, space-separated as a command-line argument. Disabling `connect` means you must supply a connection string at startup.',
      },
      {
        question: 'Does connecting to an Atlas cluster create a database user?',
        answer:
          'Yes — `atlas-connect-cluster` provisions a temporary database user and deletes it automatically after `atlasTemporaryDatabaseUserLifetimeMs`, four hours by default. Worth knowing before someone finds an unfamiliar user in the Atlas audit log and treats it as an incident.',
      },
      {
        question: 'What Node version does mongodb-mcp-server need?',
        answer:
          'Node 22.13.0 or later. Node 20 is deprecated and slated for removal. Because the client launches the process, the version that matters is the one on the client’s PATH, not the one in the terminal where you tested it — Claude Desktop in particular does not inherit a shell-managed nvm PATH.',
      },
    ],
    comparison: {
      note:
        'The choice here is not between MongoDB MCP servers — there is one — but between how much of it you expose.',
      items: [
        {
          name: 'Connection string only vs Atlas credentials as well',
          choose:
            'Connection string only if the job is querying data. Add Atlas credentials when you want provisioning, users, access lists or the performance advisor — and give that service account project-scoped roles, since it is the half that can create billable infrastructure.',
        },
        {
          name: '--readOnly vs --disabledTools',
          choose:
            '`--readOnly` for the common case: one flag, drops every write tool across all four families. `--disabledTools` when the cut is not along read/write lines — for example allowing writes to data but removing the `atlas` category entirely.',
        },
        {
          name: 'MongoDB MCP vs a Postgres MCP server',
          slug: 'postgresql',
          choose:
            'Whichever holds the data, obviously — but note the difference in shape. The Postgres server is one focused tool surface with a parser-level access mode; this one is a database client and a cloud control plane in the same process, which is more reach and correspondingly more to fence off.',
        },
        {
          name: '"mongo mcp" vs "mongodb mcp"',
          choose:
            'Same server. There is no separate short-form project; both names resolve to `mongodb-js/mongodb-mcp-server`.',
        },
      ],
    },
  },
]

const guideBySlug = new Map(guides.map((g) => [g.slug, g] as const));

export function getServerGuide(slug: string): ServerGuide | undefined {
  return guideBySlug.get(slug);
}

export function guideSlugs(): string[] {
  return guides.map((g) => g.slug);
}

export { guides as serverGuides };
