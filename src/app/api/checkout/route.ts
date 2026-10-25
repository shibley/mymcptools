import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { cleanDoorEntry, cleanServerSlug, MAKER_DOOR_FROM } from "@/lib/maker-door";
import { featuredCharge } from "@/lib/featured-price";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mymcptools.com";

/**
 * The Featured listing checkout (/submit and every maker door).
 *
 * ONE PAID TIER since 2026-10-22: Featured, $49 one-time, on the stored Stripe
 * Price in lib/featured-price.ts. Thread #325's $9-vs-$49 ladder is closed by
 * owner decision — lifetime it took one $9 order (Coinrule) and nothing at $49
 * — and its "Pro" arm was the same deliverable, so `tier=pro` from an old link
 * now resolves to Featured. The only sub-$49 charge is the dated grandfather in
 * featuredCharge() (Arcmira, 10ML, until 2026-11-05 PT), charged inline because
 * the stored Price is $49.
 *
 * The webhook records every order as sku 'featured'; amount_cents separates a
 * grandfathered $9 from a $49 in analytics.mcpt_paid_listings.
 */
export const LISTING_TIERS = {
  featured: { label: "Featured MCP Server Listing" },
} as const;

export type ListingTier = keyof typeof LISTING_TIERS;

/** Every value ("pro" from an old link included) is the Featured tier — never trust the body. */
export function resolveTier(raw: unknown): ListingTier {
  void raw;
  return "featured";
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

  const charge = featuredCharge(email);
  const stripe = new Stripe(STRIPE_SECRET_KEY);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      charge.priceId
        ? { price: charge.priceId, quantity: 1 }
        : {
            // Grandfathered $9 (featuredCharge): inline, because the stored Price is $49.
            price_data: {
              currency: "usd",
              unit_amount: charge.cents,
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
      ...(charge.grandfathered ? { grandfathered: charge.grandfathered } : {}),
      ...(server ? { server } : {}),
      ...(entry ? { entry } : {}),
    },
    success_url: `${SITE_URL}/submit/success?session_id={CHECKOUT_SESSION_ID}&featured=1&tier=${tier}`,
    // A maker who backs out returns to their own listing, not a blank form.
    cancel_url: server ? `${SITE_URL}/servers/${server}?cancelled=1` : `${SITE_URL}/submit?cancelled=1`,
  });

  return NextResponse.json({ url: session.url });
}
