import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | MyMCPTools",
  description:
    "What MyMCPTools collects on its website, its MCP server and its Claude connector, how long it keeps it, and who it is shared with.",
  alternates: { canonical: "https://mymcptools.com/privacy" },
};

const h2 = "mt-10 mb-3 text-xl font-semibold text-white";
const p = "mb-4 text-gray-400 leading-relaxed";
const a = "text-blue-400 transition hover:text-blue-300";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-500">Last updated October 23, 2026</p>

      <p className={`${p} mt-6`}>
        MyMCPTools (mymcptools.com) is operated by Bity LLC. This page explains what we collect
        when you use the website, our MCP server at <code>/api/mcp</code> and our Claude connector
        at <code>/api/mcp/claude</code>.
      </p>

      <h2 className={h2}>MCP server and Claude connector</h2>
      <p className={p}>
        When an AI assistant such as Claude calls one of our tools, we receive only the tool
        arguments it sends (for example a search term or a server slug) and use them to answer that
        call. We do not receive your Claude account, your name, your email or your conversation.
      </p>
      <p className={p}>
        For each request we record: the endpoint, the JSON-RPC method and tool name, the client
        name the assistant reports (for example &ldquo;claude-ai&rdquo;), the HTTP status, the
        user agent, the country derived from the request, and a pseudonymous ID that is a one-way
        hash of the IP address and user agent with a salt that changes every UTC day. We do not
        store the raw IP address, the tool arguments or anything you typed. We use these records
        only to count usage and keep the service working.
      </p>

      <h2 className={h2}>Website</h2>
      <p className={p}>
        The website uses no cookies of its own. Page views and clicks on outbound links are counted with the same daily-rotating
        pseudonymous hash, plus the page path, referrer, and screen width; we also load a
        third-party page-view counter from tinystats.net. If you submit a server, we receive the
        details you enter, including your email address, so we can review the submission and reply.
        Paid listings are checked out through Stripe, which processes payment details under its own
        privacy policy; we never see your full card number.
      </p>

      <h2 className={h2}>Sharing and retention</h2>
      <p className={p}>
        We do not sell personal data or share it for advertising. Data is stored with our hosting,
        database and email providers (Vercel, Supabase, Resend) and with Stripe for payments.
        Usage records are kept as long as they are useful for counting usage over time; ask us and
        we will delete any submission or email correspondence tied to you.
      </p>

      <h2 className={h2}>Contact</h2>
      <p className={p}>
        Questions or deletion requests: <a className={a} href="mailto:shibley@apistatuscheck.com">shibley@apistatuscheck.com</a>.
        See also the <Link className={a} href="/support">support page</Link>.
      </p>
    </div>
  );
}
