import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  readCheckoutEntry,
  stripeEntryMetadata,
  type CheckoutEntry,
} from "@/lib/api/checkout-entry";
import {
  isInternalProbe,
  recordCheckoutStart,
} from "@/lib/analytics/trust-api-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mymcptools.com";

// Trust Data API — self-serve Pro tier (PRD P2-1). $49/mo subscription,
// same headline price point as the Advertise "Basic" sponsor tier. Uses
// dynamic price_data (no pre-created Stripe product/price needed), same
// fallback pattern as /api/advertise/checkout.
const PRO_PRICE_CENTS = 4900;

/**
 * Build the Stripe session. `email` is optional: a GET from a script has no
 * email to offer, and Stripe's own hosted page collects one (and passes it back
 * on the completed event as `customer_details.email`, which the webhook reads).
 * Requiring one up front is exactly what made this surface unreachable from an
 * API 401.
 */
async function createProSession(opts: {
  stripe: Stripe;
  email?: string;
  useCase?: string;
  entry: CheckoutEntry;
}) {
  return opts.stripe.checkout.sessions.create({
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
    ...(opts.email ? { customer_email: opts.email } : {}),
    metadata: {
      product: "trust-api",
      plan: "pro",
      email: (opts.email || "").slice(0, 255),
      use_case: (opts.useCase || "").slice(0, 500),
      ...stripeEntryMetadata(opts.entry),
    },
    success_url: `${SITE_URL}/developers/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/developers?cancelled=1`,
  });
}

/**
 * GET /api/trust-api/checkout — the machine-followable buy path.
 *
 * Every key-gated 401 and 429 now hands back this URL, tagged with the endpoint
 * that denied the caller (`?endpoint=`) and the free-tier pointer that led them
 * there (`?via=`). One GET mints a subscription Checkout Session carrying that
 * attribution in its metadata and 302s straight to Stripe — no form, no
 * marketing page, no browser required to get there. Before this, the only route
 * to Stripe was a React form on /developers, which a script cannot fill in.
 *
 * `?probe=1` (or `X-Probe: 1`) is a DRY RUN: it reports exactly what would have
 * been created and touches neither Stripe nor a live session, so the funnel can
 * be walked in production without minting junk carts.
 */
export async function GET(req: NextRequest) {
  const entry = readCheckoutEntry(req.nextUrl);
  const probe = isInternalProbe(req.headers, req.nextUrl);

  if (probe) {
    await recordCheckoutStart({
      headers: req.headers,
      url: req.nextUrl,
      entry,
      method: "GET",
      status: 200,
    });
    return NextResponse.json({
      probe: true,
      would_create: {
        mode: "subscription",
        unit_amount: PRO_PRICE_CENTS,
        metadata: { product: "trust-api", plan: "pro", ...stripeEntryMetadata(entry) },
      },
      entry,
      note: "Dry run — no Stripe session was created. Drop ?probe=1 to buy.",
    });
  }

  if (!STRIPE_SECRET_KEY) {
    await recordCheckoutStart({
      headers: req.headers,
      url: req.nextUrl,
      entry,
      method: "GET",
      status: 503,
    });
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  try {
    const session = await createProSession({
      stripe: new Stripe(STRIPE_SECRET_KEY),
      entry,
    });
    await recordCheckoutStart({
      headers: req.headers,
      url: req.nextUrl,
      entry,
      method: "GET",
      status: 302,
    });
    // 303 so a caller that got here from a POST-ish client still follows with GET.
    return NextResponse.redirect(session.url as string, 303);
  } catch {
    await recordCheckoutStart({
      headers: req.headers,
      url: req.nextUrl,
      entry,
      method: "GET",
      status: 500,
    });
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const entry = readCheckoutEntry(req.nextUrl);

  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
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

  const session = await createProSession({
    stripe: new Stripe(STRIPE_SECRET_KEY),
    email,
    useCase,
    entry,
  });

  await recordCheckoutStart({
    headers: req.headers,
    url: req.nextUrl,
    entry,
    method: "POST",
    status: 200,
  });

  return NextResponse.json({ url: session.url });
}
