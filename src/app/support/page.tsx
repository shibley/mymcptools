import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support | MyMCPTools",
  description: "How to get help with MyMCPTools, its MCP server and its Claude connector.",
  alternates: { canonical: "https://mymcptools.com/support" },
};

const h2 = "mt-10 mb-3 text-xl font-semibold text-white";
const p = "mb-4 text-gray-400 leading-relaxed";
const a = "text-blue-400 transition hover:text-blue-300";

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-white">Support</h1>

      <p className={`${p} mt-6`}>
        Email <a className={a} href="mailto:shibley@apistatuscheck.com?subject=MyMCPTools%20support">shibley@apistatuscheck.com</a>{" "}
        with the subject &ldquo;MyMCPTools support&rdquo;. A person reads every message, usually
        within two business days. MyMCPTools is operated by Bity LLC.
      </p>

      <h2 className={h2}>MCP server and Claude connector</h2>
      <p className={p}>
        Setup and the list of tools are on the <Link className={a} href="/mcp-server">MCP server page</Link>.
        If a tool returns an error or data that looks wrong, include the tool name, what you asked,
        and roughly when, so we can find it.
      </p>
      <ul className="mb-4 list-disc space-y-2 pl-6 text-gray-400">
        <li>
          <strong className="text-gray-300">Connector does not connect:</strong> check the URL is
          exactly <code>https://mymcptools.com/api/mcp/claude</code> with no sign-in configured.
        </li>
        <li>
          <strong className="text-gray-300">A server shows as down or unprobed:</strong> statuses
          come from our scheduled MCP handshakes. Local (stdio) servers cannot be probed and show a
          repository-freshness signal instead. The <Link className={a} href="/status">status page</Link>{" "}
          shows when each server was last checked.
        </li>
        <li>
          <strong className="text-gray-300">A listing is wrong or missing:</strong> email us, or
          use the <Link className={a} href="/submit">submit page</Link> to add a server.
        </li>
      </ul>

      <h2 className={h2}>Privacy and security</h2>
      <p className={p}>
        Report a security concern to the same address. Our data practices are on the{" "}
        <Link className={a} href="/privacy">privacy page</Link>.
      </p>
    </div>
  );
}
