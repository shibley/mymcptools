import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mymcptools.com";

// $9 one-time featured listing fee
const FEATURED_PRICE_CENTS = 900;

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
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { toolName, email, description, github, website, category, installType } = body;

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
          unit_amount: FEATURED_PRICE_CENTS,
          product_data: {
            name: "Featured MCP Server Listing",
            description: `Priority review + Featured badge for: ${toolName}`,
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
      listingType: "featured",
    },
    success_url: `${SITE_URL}/submit/success?session_id={CHECKOUT_SESSION_ID}&featured=1`,
    cancel_url: `${SITE_URL}/submit?cancelled=1`,
  });

  return NextResponse.json({ url: session.url });
}
