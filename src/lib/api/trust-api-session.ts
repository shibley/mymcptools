/**
 * The Stripe Checkout Session parameters for a Trust Data API purchase — both
 * plans. Lives outside the route so `scripts/pass-live-e2e.mts` can mint the
 * exact session a buyer gets (under the probe identity) and prove Stripe
 * accepts it, which a ?probe=1 dry run cannot.
 *
 *   pro  — $49/mo subscription (PRD P2-1).
 *   pass — $9 one-time, key live for 30 days, nothing renews (src/lib/api/pass.ts).
 */
import type Stripe from "stripe";
import { stripeEntryMetadata, type CheckoutEntry } from "./checkout-entry";
import { PASS_DAYS, PASS_PLAN_ID, PASS_PRICE_CENTS, type TrustApiPlan } from "./pass";
import { proProductDescription, proProductName } from "./pro-offer";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mymcptools.com";

// THE ORDER SUMMARY IS NOT A LITERAL. `@/lib/api/pro-offer` generates the name
// and description from the committed stores' row counts, so a promise with no
// data behind it cannot be shipped; `npm run offer:selfcheck` enforces that.
export const PRO_PRICE_CENTS = 4900;

/**
 * Where Stripe's back arrow goes. A buyer who pressed the button under a
 * server's verdict goes back to THAT server page, not to a /developers page
 * they never saw.
 */
export function cancelUrl(entry: CheckoutEntry): string {
  if (entry.kind === "server-page" && entry.server) {
    return `${SITE_URL}/servers/${encodeURIComponent(entry.server)}?checkout=cancelled#trust`;
  }
  return `${SITE_URL}/developers?cancelled=1`;
}

export function planSummary(plan: TrustApiPlan) {
  if (plan === "pass") {
    return {
      mode: "payment" as const,
      unit_amount: PASS_PRICE_CENTS,
      plan_id: PASS_PLAN_ID,
      name: `${proProductName()} — ${PASS_DAYS}-day key`,
      description:
        `One payment, no subscription: the key opens every /api/v1 endpoint for ${PASS_DAYS} days, then stops. ` +
        proProductDescription(),
    };
  }
  return {
    mode: "subscription" as const,
    unit_amount: PRO_PRICE_CENTS,
    plan_id: "pro",
    name: proProductName(),
    description: proProductDescription(),
  };
}

/**
 * `email` is optional: a GET from a script has no email to offer, and Stripe's
 * own hosted page collects one (and passes it back on the completed event as
 * `customer_details.email`, which the webhook reads).
 */
export function trustApiSessionParams(opts: {
  plan: TrustApiPlan;
  entry: CheckoutEntry;
  email?: string;
  useCase?: string;
  /** Extra metadata (the live e2e marks its session `probe: "1"`). */
  extraMetadata?: Record<string, string>;
}): Stripe.Checkout.SessionCreateParams {
  const p = planSummary(opts.plan);
  return {
    payment_method_types: ["card"],
    mode: p.mode,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: p.unit_amount,
          ...(p.mode === "subscription" ? { recurring: { interval: "month" as const } } : {}),
          product_data: { name: p.name, description: p.description },
        },
        quantity: 1,
      },
    ],
    ...(opts.email ? { customer_email: opts.email } : {}),
    metadata: {
      product: "trust-api",
      plan: p.plan_id,
      email: (opts.email || "").slice(0, 255),
      use_case: (opts.useCase || "").slice(0, 500),
      ...stripeEntryMetadata(opts.entry),
      ...(opts.extraMetadata || {}),
    },
    success_url: `${SITE_URL}/developers/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl(opts.entry),
  };
}
