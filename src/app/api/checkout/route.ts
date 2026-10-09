import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { cleanDoorEntry, cleanServerSlug, MAKER_DOOR_FROM } from "@/lib/maker-door";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mymcptools.com";

/**
 * Listing tiers offered on /submit (thread #325, 2026-09-27).
 *
 * WHY A SECOND PAID TIER EXISTS. Measured 2026-08-30 -> 2026-09-27: 52
 * submission acks (45 distinct servers) and $9.00 of cash = $0.1731 of cash per
 * free submission, against aisotools' measured constant of $0.1877 — 92.2%.
 * This property is NOT converting badly; it is priced at $9 where the
 * comparable SKU is $79, and $0.1877/submission x 53.8 submissions/mo caps it
 * at $10.10/mo no matter how well it converts.
 *
 * The $49 price is not invented here — it is /advertise's existing "Basic"
 * plan, which sells the same deliverable (Featured badge + priority category
 * placement + dofollow link) and has been seen by **0 of 1,148** human web
 * sessions in the beacon's lifetime because it lives in the header nav and the
 * median session is 1.46 pageviews deep. The buyer is on /submit; the price was
 * on /advertise. This moves the price to the buyer.
 *
 * KEEP $9 LIVE. Both tiers ship together on purpose: $9 is the control. Read
 * the elasticity straight off the warehouse, no new column needed —
 *   select amount_cents, count(*) from analytics.mcpt_paid_listings group by 1;
 * The webhook records both as sku 'featured' because the deliverable is
 * identical; `amount_cents` is what separates them.
 *
 * GATE: >= 1.02 $49 sales/month clears the $50/mo additive bar. Verdict date
 * 2026-11-27 (two full inflow cycles, n ~ 108 submissions). Below that, the
 * price lever is falsified and the cap stands at the $0.1877 constant.
 */
export const LISTING_TIERS = {
  featured: { cents: 900, label: "Featured MCP Server Listing" },
  pro: { cents: 4900, label: "Pro MCP Server Listing" },
} as const;

export type ListingTier = keyof typeof LISTING_TIERS;

/** Anything not in the table is treated as the $9 tier — never trust the body. */
export function resolveTier(raw: unknown): ListingTier {
  return raw === "pro" ? "pro" : "featured";
}

export async function POST(req: NextRequest) {
  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 503 }
    );
  }

  let body: {
    toolName?: string;
    description?: string;
    github?: string;
    website?: string;
    category?: string;
    installType?: string;
    email?: string;
    tier?: string;
    server?: string;
    from?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { toolName, email, description, github, website, category, installType } = body;
  const tier = resolveTier(body.tier);
  const plan = LISTING_TIERS[tier];
  // Maker door: the catalog slug this order is FOR. Whitelisted here and again
  // in the webhook (resolveListingSlug only honours a real catalog slug).
  const server = cleanServerSlug(body.server);
  // Which maker door sold it (server page, ack mail, success screen). Kept
  // even with no `server` — a brand-new server's ack door has no catalog slug.
  const entry = cleanDoorEntry(body.from) ?? (server ? MAKER_DOOR_FROM : undefined);

  if (!toolName || !email || !github || !category || !installType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: plan.cents,
          product_data: {
            name: plan.label,
            description: `Featured badge, live the minute payment clears: ${toolName}`,
            images: ["https://mymcptools.com/og-image.png"],
          },
        },
        quantity: 1,
      },
    ],
    customer_email: email,
    metadata: {
      toolName: toolName.slice(0, 500),
      description: (description || "").slice(0, 500),
      github: (github || "").slice(0, 500),
      website: (website || "").slice(0, 500),
      category: category.slice(0, 100),
      installType: installType.slice(0, 100),
      email: email.slice(0, 255),
      listingType: tier,
      ...(server ? { server } : {}),
      ...(entry ? { entry } : {}),
    },
    success_url: `${SITE_URL}/submit/success?session_id={CHECKOUT_SESSION_ID}&featured=1&tier=${tier}`,
    // A maker who backs out returns to their own listing, not a blank form.
    cancel_url: server ? `${SITE_URL}/servers/${server}?cancelled=1` : `${SITE_URL}/submit?cancelled=1`,
  });

  return NextResponse.json({ url: session.url });
}
