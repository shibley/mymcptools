import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mymcptools.com";

// One-time pricing — create these products in Stripe dashboard and paste price IDs here
// TODO: Replace placeholder IDs with real ones from Stripe dashboard
// Basic $49 | Pro $99 | Premium $199
const PRICE_MAP: Record<string, string> = {
  basic: process.env.STRIPE_PRICE_ADVERTISE_BASIC || "price_basic_placeholder",
  pro: process.env.STRIPE_PRICE_ADVERTISE_PRO || "price_pro_placeholder",
  premium: process.env.STRIPE_PRICE_ADVERTISE_PREMIUM || "price_premium_placeholder",
};

const PLAN_AMOUNTS: Record<string, number> = {
  basic: 4900,
  pro: 9900,
  premium: 19900,
};

export async function POST(req: NextRequest) {
  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  let body: {
    plan?: string;
    serverName?: string;
    serverUrl?: string;
    email?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { plan, serverName, serverUrl, email } = body;

  if (!plan || !serverName || !serverUrl || !email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!PLAN_AMOUNTS[plan]) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const priceId = PRICE_MAP[plan];
  const isPlaceholder = priceId.includes("placeholder");

  let sessionUrl: string;

  if (isPlaceholder) {
    // Fallback: create a dynamic price (no pre-created Stripe product needed)
    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        mode: "payment",
        "payment_method_types[0]": "card",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String(PLAN_AMOUNTS[plan]),
        "line_items[0][price_data][product_data][name]": `MyMCPTools ${plan.charAt(0).toUpperCase() + plan.slice(1)} Sponsored Listing`,
        "line_items[0][price_data][product_data][description]": `Featured placement for: ${serverName}`,
        "line_items[0][quantity]": "1",
        customer_email: email,
        "metadata[plan]": plan,
        "metadata[server_name]": serverName.slice(0, 500),
        "metadata[server_url]": serverUrl.slice(0, 500),
        "metadata[contact_email]": email.slice(0, 255),
        success_url: `${SITE_URL}/advertise/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${SITE_URL}/advertise?cancelled=1`,
      }).toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      console.error("Stripe error:", JSON.stringify(session));
      return NextResponse.json(
        { error: session.error?.message || "Stripe error" },
        { status: 500 }
      );
    }

    sessionUrl = session.url;
  } else {
    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        mode: "payment",
        "payment_method_types[0]": "card",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        customer_email: email,
        "metadata[plan]": plan,
        "metadata[server_name]": serverName.slice(0, 500),
        "metadata[server_url]": serverUrl.slice(0, 500),
        "metadata[contact_email]": email.slice(0, 255),
        success_url: `${SITE_URL}/advertise/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${SITE_URL}/advertise?cancelled=1`,
      }).toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      console.error("Stripe error:", JSON.stringify(session));
      return NextResponse.json(
        { error: session.error?.message || "Stripe error" },
        { status: 500 }
      );
    }

    sessionUrl = session.url;
  }

  return NextResponse.json({ url: sessionUrl });
}
