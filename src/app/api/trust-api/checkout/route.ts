import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  readCheckoutEntry,
  stripeEntryMetadata,
  type CheckoutEntry,
} from "@/lib/api/checkout-entry";
import { readPlan, type TrustApiPlan } from "@/lib/api/pass";
import {
  cancelUrl,
  planSummary,
  PRO_PRICE_CENTS,
  trustApiSessionParams,
} from "@/lib/api/trust-api-session";
import {
  classifyTrustApiCaller,
  isInternalProbe,
  recordCheckoutStart,
} from "@/lib/analytics/trust-api-usage";
import { proProductDescription, proProductName } from "@/lib/api/pro-offer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mymcptools.com";

// Trust Data API — two plans on one route (PRD P2-1 + 2026-10-05):
//   pro  — $49/mo subscription, the default and the machine-facing GET path.
//   pass — $9 one-time 30-day key, selected by `?plan=pass` (src/lib/api/pass.ts).
// Session parameters, order-summary copy and cancel_url live in
// @/lib/api/trust-api-session so a live e2e can mint the exact same session.

async function createSession(opts: {
  stripe: Stripe;
  plan: TrustApiPlan;
  email?: string;
  useCase?: string;
  entry: CheckoutEntry;
}) {
  return opts.stripe.checkout.sessions.create(trustApiSessionParams(opts));
}

/** What a ?probe=1 dry run reports: the session a press would have minted. */
function wouldCreate(plan: TrustApiPlan, entry: CheckoutEntry) {
  const p = planSummary(plan);
  return {
    mode: p.mode,
    unit_amount: p.unit_amount,
    order_summary: { name: p.name, description: p.description },
    metadata: { product: "trust-api", plan: p.plan_id, ...stripeEntryMetadata(entry) },
    cancel_url: cancelUrl(entry),
  };
}

function isFormPost(req: NextRequest): boolean {
  const ct = req.headers.get("content-type") || "";
  return ct.startsWith("application/x-www-form-urlencoded") || ct.startsWith("multipart/form-data");
}

/**
 * POST from a plain HTML <form> — the buy button under every server page's
 * Trust verdict (src/lib/api/server-page-door.ts). No email field and no JS:
 * Stripe's hosted page collects the email, exactly as the GET path relies on.
 * Answers 303 -> Stripe so the browser lands on the card form in one hop.
 *
 * Before this the server-page door was a link to /developers#pro, a second
 * marketing page with its own JSON form — one hop more between the 694
 * sessions/30d reading a verdict and a checkout, on a page that drew 2.
 */
async function formCheckout(req: NextRequest, entry: CheckoutEntry) {
  const plan = readPlan(req.nextUrl);
  if (isInternalProbe(req.headers, req.nextUrl)) {
    await recordCheckoutStart({ headers: req.headers, url: req.nextUrl, entry, plan, method: "POST", status: 200 });
    return NextResponse.json({
      probe: true,
      plan,
      would_create: wouldCreate(plan, entry),
      entry,
      note: "Dry run — no Stripe session was created. Drop ?probe=1 to buy.",
    });
  }

  // A form-submitting automated client still gets no cart (see the GET path).
  const caller = classifyTrustApiCaller(req.headers, req.nextUrl);
  if (caller.isCrawler) {
    await recordCheckoutStart({
      headers: req.headers,
      url: req.nextUrl,
      entry,
      plan,
      method: "POST",
      status: 303,
      outcome: "POST:offer-only",
    });
    return NextResponse.redirect(`${SITE_URL}/developers#pro`, 303);
  }

  if (!STRIPE_SECRET_KEY) {
    await recordCheckoutStart({ headers: req.headers, url: req.nextUrl, entry, plan, method: "POST", status: 503 });
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  try {
    const session = await createSession({ stripe: new Stripe(STRIPE_SECRET_KEY), plan, entry });
    // `POST:302` so demand:report's existing "reached Stripe" predicate
    // (utm_campaign like '%:302') counts it with the GET redirects.
    await recordCheckoutStart({ headers: req.headers, url: req.nextUrl, entry, plan, method: "POST", status: 302 });
    return NextResponse.redirect(session.url as string, 303);
  } catch {
    await recordCheckoutStart({ headers: req.headers, url: req.nextUrl, entry, plan, method: "POST", status: 500 });
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
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
  const plan = readPlan(req.nextUrl);
  const probe = isInternalProbe(req.headers, req.nextUrl);

  if (probe) {
    await recordCheckoutStart({
      headers: req.headers,
      url: req.nextUrl,
      entry,
      plan,
      method: "GET",
      status: 200,
    });
    return NextResponse.json({
      probe: true,
      // The literal order summary Stripe would render. Reporting it here is
      // what makes the last screen before the decision readable in
      // production without minting a cart — the reason the old copy went
      // 0/4 unnoticed is that nobody could see it without buying.
      would_create: wouldCreate(plan, entry),
      entry,
      note: "Dry run — no Stripe session was created. Drop ?probe=1 to buy.",
    });
  }

  // AN AUTOMATED CALLER GETS THE OFFER, NOT A CART. In the 30 days to
  // 2026-10-01 this GET minted 10 live Stripe sessions and 0 were paid: 8 came
  // from one frozen-UA crawler fleet (FOSSIL_UA in caller-class.ts) and one
  // from Amzn-SearchBot, which was classified a crawler and minted a cs_live_
  // anyway because only `?probe=1` was checked. A hosted card form is
  // unusable to a program, so the session could only ever expire — while it
  // read in demand:report as a buyer who "reached Stripe" and walked away,
  // pointing every fire at the checkout copy. Now a crawler is told what the
  // plan is and where a person can buy it, and its row says `GET:offer-only`.
  const caller = classifyTrustApiCaller(req.headers, req.nextUrl);
  if (caller.isCrawler) {
    await recordCheckoutStart({
      headers: req.headers,
      url: req.nextUrl,
      entry,
      plan,
      method: "GET",
      status: 200,
      outcome: "GET:offer-only",
    });
    return NextResponse.json({
      checkout: "not_created",
      reason: "automated client — a Stripe checkout page needs a person with a card",
      plan: {
        name: proProductName(),
        description: proProductDescription(),
        price_usd_per_month: PRO_PRICE_CENTS / 100,
      },
      buy: {
        browser: `${SITE_URL}/developers#pro`,
        api: `POST ${SITE_URL}/api/trust-api/checkout {"email": "..."} -> {"url": "<stripe checkout>"}`,
      },
    });
  }

  if (!STRIPE_SECRET_KEY) {
    await recordCheckoutStart({
      headers: req.headers,
      url: req.nextUrl,
      entry,
      plan,
      method: "GET",
      status: 503,
    });
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  try {
    const session = await createSession({
      stripe: new Stripe(STRIPE_SECRET_KEY),
      plan,
      entry,
    });
    await recordCheckoutStart({
      headers: req.headers,
      url: req.nextUrl,
      entry,
      plan,
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
      plan,
      method: "GET",
      status: 500,
    });
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const entry = readCheckoutEntry(req.nextUrl);
  if (isFormPost(req)) return formCheckout(req, entry);

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

  const session = await createSession({
    stripe: new Stripe(STRIPE_SECRET_KEY),
    plan: readPlan(req.nextUrl),
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
