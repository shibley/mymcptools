import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { randomBytes } from "node:crypto";
import { recordPaidListing } from "@/lib/paid-listings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "shibley@apistatuscheck.com";
const ADMIN_EMAIL = "shibley@gmail.com";

/** mcpt_live_<48 hex chars> — generated per Trust API subscription purchase. */
function generateApiKey(): string {
  return `mcpt_live_${randomBytes(24).toString("hex")}`;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `MyMCPTools <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  });
}

export async function POST(req: NextRequest) {
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const eventSession = event.data.object as Stripe.Checkout.Session;

    // Idempotency guard against Stripe redelivery of this event (slow
    // handler, transient error, etc). No DB exists in this project to key a
    // dedup table on, so — same pattern as keyseo's research-agent webhook —
    // use the Checkout Session's own metadata as the dedup store. Re-fetch
    // the live session rather than trusting the event payload, since the
    // payload is a stale creation-time snapshot and won't reflect a flag set
    // by an earlier delivery.
    const session = await stripe.checkout.sessions.retrieve(eventSession.id);
    const meta = session.metadata || {};

    if (meta.fulfilled === "true") {
      return NextResponse.json({ received: true, alreadyFulfilled: true });
    }

    if (meta.product === "trust-api") {
      // Trust Data API self-serve checkout (/api/trust-api/checkout, PRD
      // P2-1). No live DB — generate the key now, email it to the customer,
      // and tell admin the exact record to commit to src/data/api-keys.json
      // (same async-fulfillment pattern as Featured/Sponsored listings below).
      const { plan, email, use_case } = meta;
      const apiKey = generateApiKey();
      const record = {
        key: apiKey,
        email,
        plan: plan || "pro",
        created_at: new Date().toISOString(),
        status: "active",
      };

      await sendEmail(
        ADMIN_EMAIL,
        `🔑 Trust API Pro subscription: ${email}`,
        `
          <h2>New Trust Data API subscriber — PAID ✅</h2>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Plan:</strong> ${plan}</p>
          ${use_case ? `<p><strong>Use case:</strong> ${use_case}</p>` : ""}
          <p><strong>Generated key:</strong> <code>${apiKey}</code></p>
          <p><strong>Stripe Session:</strong> ${session.id}</p>
          <p><strong>Amount:</strong> $${((session.amount_total || 0) / 100).toFixed(2)}/mo</p>
          <hr/>
          <p>Append this record to <code>src/data/api-keys.json</code> and redeploy to activate:</p>
          <pre>${JSON.stringify(record, null, 2)}</pre>
        `
      );

      if (email) {
        await sendEmail(
          email,
          "Your MyMCPTools Trust Data API key",
          `
            <h2>Payment received — welcome to the Trust Data API 🔑</h2>
            <p>Hi,</p>
            <p>Your key: <code>${apiKey}</code></p>
            <p>It will be <strong>active within 24 hours</strong>. Once live, authenticate with:</p>
            <pre>curl https://mymcptools.com/api/v1/status -H "Authorization: Bearer ${apiKey}"</pre>
            <p>Docs: <a href="https://mymcptools.com/developers">mymcptools.com/developers</a></p>
            <p>Questions? Reply to this email.</p>
            <p>— MyMCPTools Team</p>
          `
        );
      }
      await stripe.checkout.sessions.update(session.id, {
        metadata: { ...meta, fulfilled: "true" },
      });
      return NextResponse.json({ received: true });
    }

    if (meta.plan && meta.server_name) {
      // Sponsored/advertise listing checkout (/api/advertise/checkout) —
      // distinct metadata schema from the $9 Featured Listing flow below.
      const { plan, server_name, server_url, contact_email } = meta;

      // Deliver first, notify second. Before thread #218 this branch only ever
      // emailed a human to set `sponsored: true` by hand in a data file; the
      // measured throughput of that step was 0 listings in 16 days.
      const sponsoredSlug = await recordPaidListing({
        stripeSessionId: session.id,
        sku: "sponsored",
        name: server_name,
        websiteUrl: server_url,
        contactEmail: contact_email,
        amountCents: session.amount_total ?? undefined,
      });

      await sendEmail(
        ADMIN_EMAIL,
        `💰 Sponsored Listing Payment (${plan}): ${server_name}`,
        `
          <h2>New Sponsored Listing — PAID ✅</h2>
          <p><strong>Plan:</strong> ${plan}</p>
          <p><strong>Server:</strong> ${server_name}</p>
          <p><strong>URL:</strong> <a href="${server_url}">${server_url}</a></p>
          <p><strong>Contact:</strong> ${contact_email}</p>
          <p><strong>Stripe Session:</strong> ${session.id}</p>
          <p><strong>Amount:</strong> $${((session.amount_total || 0) / 100).toFixed(2)}</p>
          <hr/>
          <p><strong>Auto-listed:</strong> ${sponsoredSlug ? `yes — <a href="https://mymcptools.com/servers/${sponsoredSlug}">/servers/${sponsoredSlug}</a> is live now` : "NO — the warehouse write failed, this one needs a hand-edit"}</p>
          <p>To promote it into the static catalog later, add it to <code>src/data/servers.ts</code> with <code>sponsored: true</code>; the overlay drops any slug the catalog already holds.</p>
        `
      );

      if (contact_email) {
        await sendEmail(
          contact_email,
          `Your Sponsored Listing is confirmed — ${server_name}`,
          `
            <h2>Payment received — you're sponsored! 💰</h2>
            <p>Hi,</p>
            <p>We've received your payment for a <strong>${plan}</strong> Sponsored Listing on MyMCPTools.</p>
            <p><strong>Server:</strong> ${server_name}<br/>
            <strong>URL:</strong> <a href="${server_url}">${server_url}</a></p>
            <p>${sponsoredSlug ? `Your sponsored placement is <strong>live now</strong>: <a href="https://mymcptools.com/servers/${sponsoredSlug}">mymcptools.com/servers/${sponsoredSlug}</a>` : "Your sponsored placement will be live within <strong>24 hours</strong>."}</p>
            <p>Questions? Reply to this email.</p>
            <p>— MyMCPTools Team</p>
          `
        );
      }
      await stripe.checkout.sessions.update(session.id, {
        metadata: { ...meta, fulfilled: "true" },
      });
      return NextResponse.json({ received: true });
    }

    // Featured Listing checkout (/api/checkout, $9 one-time)
    const { toolName, email, description, github, website, category, installType } = meta;

    if (!toolName) {
      // This Stripe account is shared across the whole Bity portfolio, and a
      // Stripe webhook endpoint receives every event on the account — not just
      // ones from this app. checkout.session.completed events from other
      // properties (e.g. an ASC Alert Pro trial) have no toolName metadata and
      // would otherwise fall through here and send a garbled "Featured Listing
      // PAID: undefined, $0.00" alert (real incident: cs_live_...lqNrBZMI8,
      // 2026-07-17, actually an ASC trial signup already handled by ASC's own
      // webhook). Ack and skip instead of alerting on someone else's event.
      // Don't mutate this session's metadata — it isn't ours, and another
      // property's own webhook may use metadata.fulfilled for its own
      // idempotency (mutating it here could cause that property to skip
      // processing its own legitimate event).
      console.log(`[webhook] Ignoring checkout.session.completed with no toolName metadata (session ${session.id}, likely a different property's event on this shared Stripe account)`);
      return NextResponse.json({ received: true, ignored: "not a featured listing" });
    }

    // Deliver, then notify. This is the branch thread #218 was opened on: the
    // one real order this property has ever taken (Coinrule, $9, 2026-09-03)
    // was emailed here, stamped `fulfilled` at email-send time, and then not
    // listed for 144 hours against a 24-hour promise. The listing now exists
    // the moment Stripe confirms payment.
    const featuredSlug = await recordPaidListing({
      stripeSessionId: session.id,
      sku: "featured",
      name: toolName,
      description,
      githubUrl: github,
      websiteUrl: website,
      category,
      installType,
      contactEmail: email,
      amountCents: session.amount_total ?? undefined,
    });

    // Notify admin
    await sendEmail(
      ADMIN_EMAIL,
      `⭐ Featured Listing Payment: ${toolName}`,
      `
        <h2>New Featured Listing — PAID ✅</h2>
        <p><strong>Server:</strong> ${toolName}</p>
        <p><strong>GitHub:</strong> <a href="${github}">${github}</a></p>
        ${website ? `<p><strong>Website:</strong> <a href="${website}">${website}</a></p>` : ""}
        <p><strong>Category:</strong> ${category}</p>
        <p><strong>Install:</strong> ${installType}</p>
        <p><strong>Description:</strong> ${description}</p>
        <p><strong>Submitter:</strong> ${email}</p>
        <p><strong>Stripe Session:</strong> ${session.id}</p>
        <p><strong>Amount:</strong> $${((session.amount_total || 0) / 100).toFixed(2)}</p>
        <hr/>
        <p><strong>Auto-listed:</strong> ${featuredSlug ? `yes — <a href="https://mymcptools.com/servers/${featuredSlug}">/servers/${featuredSlug}</a> is live now` : "NO — the warehouse write failed, this one needs a hand-edit"}</p>
        <p>The overlay row is rendered as <em>unverified</em> on purpose (no source_verified, no install_verified, verification: 'unresolved'). Verify the endpoint/repo, then promote it into <code>src/data/servers.ts</code> when you want the confident copy.</p>
      `
    );

    // Confirm to submitter
    if (email) {
      await sendEmail(
        email,
        `Your Featured MCP Listing is confirmed — ${toolName}`,
        `
          <h2>Payment received — you're featured! ⭐</h2>
          <p>Hi,</p>
          <p>We've received your payment for a <strong>Featured Listing</strong> on MyMCPTools.</p>
          <p><strong>Server:</strong> ${toolName}<br/>
          <strong>GitHub:</strong> <a href="${github}">${github}</a></p>
          <p>${featuredSlug ? `Your listing is <strong>live now</strong> with a Featured badge at the top of its category: <a href="https://mymcptools.com/servers/${featuredSlug}">mymcptools.com/servers/${featuredSlug}</a>` : "Your server will be reviewed within <strong>24 hours</strong> and listed with a Featured badge, appearing at the top of its category."}</p>
          <p>Questions? Reply to this email.</p>
          <p>— MyMCPTools Team</p>
        `
      );
    }

    await stripe.checkout.sessions.update(session.id, {
      metadata: { ...meta, fulfilled: "true" },
    });
  }

  return NextResponse.json({ received: true });
}
