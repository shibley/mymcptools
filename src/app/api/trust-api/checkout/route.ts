import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mymcptools.com";

// Trust Data API — self-serve Pro tier (PRD P2-1). $49/mo subscription,
// same headline price point as the Advertise "Basic" sponsor tier. Uses
// dynamic price_data (no pre-created Stripe product/price needed), same
// fallback pattern as /api/advertise/checkout.
const PRO_PRICE_CENTS = 4900;

export async function POST(req: NextRequest) {
  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 503 }
    );
  }

  let body: { email?: string; useCase?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, useCase } = body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: PRO_PRICE_CENTS,
          recurring: { interval: "month" },
          product_data: {
            name: "MyMCPTools Trust Data API — Pro",
            description:
              "Self-serve API key for the MCP Trust Data API: live status, uptime, latency, and drift for every probed MCP server. 120 req/min.",
          },
        },
        quantity: 1,
      },
    ],
    customer_email: email,
    metadata: {
      product: "trust-api",
      plan: "pro",
      email: email.slice(0, 255),
      use_case: (useCase || "").slice(0, 500),
    },
    success_url: `${SITE_URL}/developers/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/developers?cancelled=1`,
  });

  return NextResponse.json({ url: session.url });
}
