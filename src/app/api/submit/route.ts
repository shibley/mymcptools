import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "shibley@apistatuscheck.com";
const FROM_NAME = "MyMCPTools";
const ADMIN_EMAIL = "shibley@gmail.com";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) console.error("Resend error:", res.status, await res.text());
}

// Reserved github.com paths that are not user/org namespaces.
const GITHUB_RESERVED = new Set([
  "about", "apps", "blog", "collections", "contact", "customer-stories",
  "enterprise", "events", "explore", "features", "join", "login", "logout",
  "marketplace", "new", "notifications", "orgs", "pricing", "pulls", "search",
  "security", "settings", "signup", "sponsors", "stars", "topics", "trending",
]);

type RepoCheck =
  | { state: "ok"; stars: number; pushedAt: string; fullName: string }
  | { state: "missing" }
  | { state: "unknown"; reason: string };

/**
 * Parses owner/repo out of a github.com URL. Returns null when the URL points at
 * a bare namespace (github.com/foo), a reserved path, or anything malformed.
 */
function parseRepoPath(github: string): { owner: string; repo: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(github.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (parsed.hostname.toLowerCase() !== "github.com") return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const [owner, rawRepo] = segments;
  if (GITHUB_RESERVED.has(owner.toLowerCase())) return null;
  // GitHub owners cannot contain dots — this is what a pasted domain trips on.
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner)) return null;

  const repo = rawRepo.replace(/\.git$/i, "");
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(repo)) return null;

  return { owner, repo };
}

async function checkRepoExists(owner: string, repo: string): Promise<RepoCheck> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "MyMCPTools-Submit",
  };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers,
      signal: AbortSignal.timeout(6000),
    });
    if (res.status === 404) return { state: "missing" };
    if (!res.ok) return { state: "unknown", reason: `GitHub API ${res.status}` };
    const data = await res.json();
    return {
      state: "ok",
      stars: data.stargazers_count ?? 0,
      pushedAt: data.pushed_at ?? "unknown",
      fullName: data.full_name ?? `${owner}/${repo}`,
    };
  } catch (err) {
    // Never fail a legitimate submission because GitHub was slow or rate-limited.
    return { state: "unknown", reason: err instanceof Error ? err.message : "fetch failed" };
  }
}

function buildAdminEmailHtml(fields: {
  toolName: string;
  url: string;
  description: string;
  email: string;
  category: string;
  installType: string;
  website: string;
  github: string;
  submittedAt: string;
  repoCheck: RepoCheck;
}): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 32px; border-radius: 12px;">
      <h1 style="color: #22c55e; margin-top: 0;">🟢 New MCP Server Submission</h1>
      <p style="color:#94a3b8; margin:0 0 16px 0;">Submitted at ${fields.submittedAt}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr><td style="padding: 12px; border-bottom: 1px solid #1e293b; color: #94a3b8; width: 140px;">Server Name</td><td style="padding: 12px; border-bottom: 1px solid #1e293b; color: #fff; font-weight: 700;">${fields.toolName}</td></tr>
        <tr><td style="padding: 12px; border-bottom: 1px solid #1e293b; color: #94a3b8;">GitHub URL</td><td style="padding: 12px; border-bottom: 1px solid #1e293b;"><a href="${fields.github}" style="color: #60a5fa;">${fields.github}</a></td></tr>
        <tr><td style="padding: 12px; border-bottom: 1px solid #1e293b; color: #94a3b8;">Repo</td><td style="padding: 12px; border-bottom: 1px solid #1e293b; color: #e2e8f0;">${
          fields.repoCheck.state === "ok"
            ? `✅ ${fields.repoCheck.fullName} — ★${fields.repoCheck.stars}, last push ${fields.repoCheck.pushedAt.slice(0, 10)}`
            : `⚠️ unverified (${fields.repoCheck.state === "unknown" ? fields.repoCheck.reason : "missing"})`
        }</td></tr>
        ${fields.website ? `<tr><td style="padding: 12px; border-bottom: 1px solid #1e293b; color: #94a3b8;">Website</td><td style="padding: 12px; border-bottom: 1px solid #1e293b;"><a href="${fields.website}" style="color: #60a5fa;">${fields.website}</a></td></tr>` : ""}
        <tr><td style="padding: 12px; border-bottom: 1px solid #1e293b; color: #94a3b8;">Category</td><td style="padding: 12px; border-bottom: 1px solid #1e293b; color: #e2e8f0;">${fields.category}</td></tr>
        <tr><td style="padding: 12px; border-bottom: 1px solid #1e293b; color: #94a3b8;">Install Type</td><td style="padding: 12px; border-bottom: 1px solid #1e293b; color: #e2e8f0;">${fields.installType}</td></tr>
        <tr><td style="padding: 12px; border-bottom: 1px solid #1e293b; color: #94a3b8;">Description</td><td style="padding: 12px; border-bottom: 1px solid #1e293b; color: #e2e8f0;">${fields.description}</td></tr>
        <tr><td style="padding: 12px; border-bottom: 1px solid #1e293b; color: #94a3b8;">Submitter Email</td><td style="padding: 12px; border-bottom: 1px solid #1e293b;"><a href="mailto:${fields.email}" style="color: #60a5fa;">${fields.email}</a></td></tr>
      </table>
      <p style="color:#64748b; font-size:12px; margin-top:32px;">Submitted via MyMCPTools.com /submit form</p>
    </div>`;
}

function buildConfirmationEmailHtml(toolName: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 32px; border-radius: 12px;">
      <h1 style="color: #22c55e; margin-top: 0;">Thanks for submitting ${toolName}! 🎉</h1>
      <p style="font-size: 16px; line-height: 1.6;">We received your submission and will review it within 24-48 hours.</p>
      <p style="font-size: 14px; line-height: 1.6; color:#94a3b8;">If approved, your MCP server will appear in the <a href="https://mymcptools.com" style="color:#60a5fa;">MyMCPTools directory</a> and be visible to thousands of AI developers.</p>
      <p style="font-size: 14px; line-height: 1.6; color:#94a3b8;">In the meantime, feel free to share the directory with your users.</p>
      <p style="color: #94a3b8; font-size: 14px; margin-top: 24px;">— The MyMCPTools Team</p>
    </div>`;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Too many submissions. Try again later." }, { status: 429 });
    }

    const body = await req.json();

    // Honeypot check
    if (body.website_url) {
      return NextResponse.json({ success: true, message: "Submission received! We'll review your server within 24-48 hours." });
    }

    const { toolName, url, description, email, category, installType, website, github } = body;

    const missing: string[] = [];
    if (!toolName?.trim()) missing.push("toolName");
    if (!github?.trim()) missing.push("github");
    if (!description?.trim()) missing.push("description");
    if (!category?.trim()) missing.push("category");
    if (!installType?.trim()) missing.push("installType");
    if (!email?.trim()) missing.push("email");

    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const repoPath = parseRepoPath(github);
    if (!repoPath) {
      return NextResponse.json(
        { error: "Enter a link to the repository itself, e.g. https://github.com/owner/repo — not a homepage or profile." },
        { status: 400 }
      );
    }

    const repoCheck = await checkRepoExists(repoPath.owner, repoPath.repo);
    if (repoCheck.state === "missing") {
      return NextResponse.json(
        { error: `We couldn't find github.com/${repoPath.owner}/${repoPath.repo}. Check the URL — private repos can't be listed.` },
        { status: 400 }
      );
    }

    const submittedAt = new Date().toUTCString();

    await sendEmail(
      ADMIN_EMAIL,
      `🟢 New MCP Server Submission: ${toolName.trim()}`,
      buildAdminEmailHtml({
        toolName: toolName.trim(),
        url: url?.trim() || "",
        description: description.trim(),
        email: email.trim(),
        category: category.trim(),
        installType: installType.trim(),
        website: website?.trim() || "",
        github: github.trim(),
        submittedAt,
        repoCheck,
      })
    );

    await sendEmail(
      email.trim(),
      `We received your submission: ${toolName.trim()}`,
      buildConfirmationEmailHtml(toolName.trim())
    );

    return NextResponse.json({
      success: true,
      message: "Submission received! We'll review your MCP server within 24-48 hours.",
    });
  } catch (err) {
    console.error("Submit error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
