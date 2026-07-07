import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "shibley@apistatuscheck.com";
const ADMIN_EMAIL = "shibley@gmail.com";

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
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata || {};

    if (meta.plan && meta.server_name) {
      // Sponsored/advertise listing checkout (/api/advertise/checkout) —
      // distinct metadata schema from the $9 Featured Listing flow below.
      const { plan, server_name, server_url, contact_email } = meta;

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
          <p>Set <code>sponsored: true</code> for this server in <code>src/data/probe-inventory.json</code>.</p>
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
            <p>Your sponsored placement will be live within <strong>24 hours</strong>.</p>
            <p>Questions? Reply to this email.</p>
            <p>— MyMCPTools Team</p>
          `
        );
      }
      return NextResponse.json({ received: true });
    }

    // Featured Listing checkout (/api/checkout, $9 one-time)
    const { toolName, email, description, github, website, category, installType } = meta;

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
        <p>This submission paid for <strong>Featured Listing</strong> — priority review + featured badge.</p>
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
          <p>Your server will be reviewed within <strong>24 hours</strong> and listed with a Featured badge, appearing at the top of its category.</p>
          <p>Questions? Reply to this email.</p>
          <p>— MyMCPTools Team</p>
        `
      );
    }
  }

  return NextResponse.json({ received: true });
}
