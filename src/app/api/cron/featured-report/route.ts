import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { categories, getServerBySlug } from "@/data/servers";
import { runDueReports, type Query } from "@/lib/featured-report";

/**
 * Daily Vercel cron (vercel.json): mails each Featured buyer their 30-day
 * click report once the order is 30 days old. Due-window, claim-before-send
 * and unclaim-on-failure live in src/lib/featured-report.ts; this route only
 * supplies the warehouse and Resend.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET`. Anything else is refused.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FROM = "MyMCPTools <shibley@apistatuscheck.com>";

let pool: Pool | null = null;
function getPool(): Pool | null {
  const cs = process.env.ANALYTICS_DATABASE_URL?.replace(/\\n/g, "").trim();
  if (!cs) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: cs,
      ssl: { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 15_000,
    });
    pool.on("error", () => {});
  }
  return pool;
}

async function send(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.replace(/\\n/g, "").trim();
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: "shibley@apistatuscheck.com", subject, html }),
  });
  return res.ok;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.replace(/\\n/g, "").trim();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const p = getPool();
  if (!p) return NextResponse.json({ error: "warehouse not configured" }, { status: 503 });
  const query: Query = (sql, params) => p.query(sql, params);
  const run = await runDueReports({
    query,
    send,
    now: new Date(),
    catalogCategories: (slug) => getServerBySlug(slug)?.categories,
    categoryNames: new Map(categories.map((c) => [c.slug, c.name])),
  });
  return NextResponse.json(run);
}
