"use client";

import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import { ackDoorHref, cleanDoorEntry, type MakerDoorEntry, type SubmittedFields } from "@/lib/maker-door";

type ListingTier = "free" | "featured" | "pro";

export default function SubmitPage() {
  const [tier, setTier] = useState<ListingTier>("free");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  // Maker door (src/lib/maker-door.ts): a server page links here with the
  // listing's own fields so its maintainer lands on Featured, form filled.
  // Read in an effect rather than useSearchParams so the page stays static.
  const [prefill, setPrefill] = useState<Record<string, string>>({});
  const [doorServer, setDoorServer] = useState<string>("");
  // Which maker door opened this page (server page, ack mail, success screen).
  const [doorFrom, setDoorFrom] = useState<MakerDoorEntry | undefined>(undefined);
  // A free submission's fields, handed back by the success screen's door.
  const [sent, setSent] = useState<{ fields: SubmittedFields; server?: string } | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get("tier");
    if (t === "featured" || t === "pro") setTier(t);
    const server = sp.get("server") || "";
    if (/^[A-Za-z0-9][A-Za-z0-9-]{0,79}$/.test(server)) setDoorServer(server);
    setDoorFrom(cleanDoorEntry(sp.get("from")));
    const next: Record<string, string> = {};
    for (const k of ["name", "description", "github", "website", "category", "install", "email"]) {
      const v = sp.get(k);
      if (v) next[k] = v.slice(0, 500);
    }
    setPrefill(next);
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = {
      toolName: (form.elements.namedItem("name") as HTMLInputElement).value,
      description: (form.elements.namedItem("description") as HTMLTextAreaElement).value,
      github: (form.elements.namedItem("github") as HTMLInputElement).value,
      website: (form.elements.namedItem("website") as HTMLInputElement).value,
      category: (form.elements.namedItem("category") as HTMLSelectElement).value,
      installType: (form.elements.namedItem("install") as HTMLSelectElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      website_url: (form.elements.namedItem("website_url") as HTMLInputElement)?.value || "",
      // The checkout route whitelists this; anything unknown falls back to $9.
      tier,
      // Catalog slug from the maker door; the route re-validates it and the
      // webhook only honours a slug the catalog really holds.
      server: doorServer || undefined,
      from: doorFrom ?? (doorServer ? "server-page" : undefined),
    };

    // Honeypot check
    if (data.website_url) {
      setStatus("success");
      return;
    }

    if (tier === "featured" || tier === "pro") {
      // Stripe checkout flow
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) {
          setErrorMsg(json.error || "Checkout failed. Please try again.");
          setStatus("error");
        } else if (json.url) {
          window.location.href = json.url;
        }
      } catch {
        setErrorMsg("Network error. Please try again.");
        setStatus("error");
      }
      return;
    }

    // Free submission
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "Something went wrong. Please try again.");
        setStatus("error");
      } else {
        setSent({
          fields: {
            toolName: data.toolName,
            description: data.description,
            github: data.github,
            website: data.website,
            category: data.category,
            installType: data.installType,
            email: data.email,
          },
          server: typeof json.server === "string" ? json.server : undefined,
        });
        setStatus("success");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-gray-900 border border-green-800 rounded-xl p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-white mb-3">Submission Received!</h1>
          <p className="text-gray-400 mb-6">
            Thanks for submitting your MCP server. We&apos;ll review it within 24-48 hours and notify you by email.
          </p>
          {sent && (
            // MAKER DOOR, entry `submit-success` (src/lib/maker-door.ts): the
            // one moment a maker is certainly on the page, with the $9 tier
            // one press away and every field they just typed carried over.
            <div data-maker-door="submit-success" className="mb-6 rounded-lg border border-yellow-800/60 bg-yellow-950/20 p-5 text-left">
              <p className="font-semibold text-yellow-300 mb-1">Want {sent.fields.toolName} featured? $9 once.</p>
              <p className="text-sm text-gray-400 mb-4">
                Priority review within 24 hours, a Featured badge on the listing, and the top of its category. Your details carry over.
              </p>
              <a
                href={ackDoorHref(sent.fields, "submit-success", sent.server)}
                onClick={(e) => {
                  // Same page: a hash-only reload would keep the success state.
                  e.preventDefault();
                  window.location.assign(ackDoorHref(sent.fields, "submit-success", sent.server));
                }}
                rel="nofollow"
                className="inline-block px-5 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-gray-950 font-semibold rounded-lg transition"
              >
                Feature it — $9 once
              </a>
            </div>
          )}
          <Link href="/" className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition">
            Back to Directory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-white mb-4">
          {doorServer || doorFrom ? `Feature ${prefill.name || "your server"} on MyMCPTools` : "Submit Your MCP Server"}
        </h1>
        <p className="text-gray-400">
          {doorServer ? (
            <>
              Already listed at{" "}
              <Link href={`/servers/${doorServer}`} className="text-blue-400 hover:text-blue-300">
                /servers/{doorServer}
              </Link>
              . Featured adds the badge to that page and moves it to the top of its category the moment payment clears.
            </>
          ) : (
            "Get your server listed in the directory and reach thousands of developers."
          )}
        </p>
      </div>

      {/* Tier Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <button
          type="button"
          onClick={() => setTier("free")}
          className={`rounded-xl border p-5 text-left transition ${
            tier === "free"
              ? "border-blue-500 bg-blue-950/40"
              : "border-gray-700 bg-gray-900 hover:border-gray-500"
          }`}
        >
          <div className="text-lg font-semibold text-white mb-1">Free</div>
          <div className="text-2xl font-bold text-white mb-2">$0</div>
          <ul className="space-y-1 text-sm text-gray-400">
            <li>✓ Standard directory listing</li>
            <li>✓ Reviewed within 24–48 hrs</li>
            <li>✓ Category + search indexed</li>
          </ul>
        </button>

        <button
          type="button"
          onClick={() => setTier("featured")}
          className={`rounded-xl border p-5 text-left transition relative ${
            tier === "featured"
              ? "border-yellow-500 bg-yellow-950/30"
              : "border-gray-700 bg-gray-900 hover:border-yellow-700"
          }`}
        >
          <div className="absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-600/30 text-yellow-300 border border-yellow-700">
            RECOMMENDED
          </div>
          <div className="text-lg font-semibold text-white mb-1">Featured</div>
          <div className="text-2xl font-bold text-white mb-2">
            $9 <span className="text-base font-normal text-gray-400">one-time</span>
          </div>
          <ul className="space-y-1 text-sm text-gray-400">
            <li>⭐ Featured badge on listing</li>
            <li>✓ Top of category placement</li>
            <li>✓ Priority review within 24 hrs</li>
            <li>✓ Highlighted in search results</li>
          </ul>
        </button>

        {/*
          $49 Pro — thread #325. This is /advertise's existing "Basic" plan at
          its existing price, moved to the surface the buyer is actually on.
          /advertise was seen by 0 of 1,148 human web sessions; /submit is where
          the property's only sale came from. $9 stays live as the control.
        */}
        <button
          type="button"
          onClick={() => setTier("pro")}
          className={`rounded-xl border p-5 text-left transition ${
            tier === "pro"
              ? "border-emerald-500 bg-emerald-950/30"
              : "border-gray-700 bg-gray-900 hover:border-emerald-700"
          }`}
        >
          <div className="text-lg font-semibold text-white mb-1">Pro</div>
          <div className="text-2xl font-bold text-white mb-2">
            $49 <span className="text-base font-normal text-gray-400">one-time</span>
          </div>
          <ul className="space-y-1 text-sm text-gray-400">
            <li>⭐ Everything in Featured</li>
            <li>✓ Dofollow link to your repo and site</li>
            <li>✓ Homepage placement for 30 days</li>
            <li>✓ Listed within 24 hrs, reviewed by hand</li>
          </ul>
        </button>
      </div>

      {/* Submission Form */}
      <div className={`rounded-xl border p-8 ${tier !== "free" ? "bg-gray-900 border-yellow-800/50" : "bg-gray-900 border-gray-800"}`}>
        {(tier === "featured" || tier === "pro") && (
          <div className="mb-6 flex items-center gap-2 text-sm text-yellow-300 bg-yellow-900/20 border border-yellow-800/50 rounded-lg px-4 py-3">
            ⭐ Featured listing — you&apos;ll be redirected to secure checkout after filling out this form.
          </div>
        )}

        <form id="form" key={Object.keys(prefill).length ? "prefilled" : "blank"} className="space-y-6" onSubmit={handleSubmit}>
          {/* Honeypot */}
          <input type="text" name="website_url" style={{ display: "none" }} tabIndex={-1} autoComplete="off" />

          {/* Server Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
              Server Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              defaultValue={prefill.name}
              required
              placeholder="e.g., My Awesome MCP Server"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              defaultValue={prefill.description}
              required
              rows={3}
              placeholder="What does your server do? Keep it concise but informative."
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* GitHub URL */}
          <div>
            <label htmlFor="github" className="block text-sm font-medium text-gray-300 mb-2">
              GitHub Repository URL *
            </label>
            <input
              type="url"
              id="github"
              name="github"
              defaultValue={prefill.github}
              required
              placeholder="https://github.com/username/repo"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Website URL */}
          <div>
            <label htmlFor="website" className="block text-sm font-medium text-gray-300 mb-2">
              Website URL (optional)
            </label>
            <input
              type="url"
              id="website"
              name="website"
              defaultValue={prefill.website}
              placeholder="https://yourwebsite.com"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-2">
              Primary Category *
            </label>
            <select
              id="category"
              name="category"
              defaultValue={prefill.category ?? ""}
              required
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500 transition"
            >
              <option value="">Select a category</option>
              <option value="filesystem">📁 Filesystem</option>
              <option value="database">🗄️ Database</option>
              <option value="api">🌐 API & Web</option>
              <option value="search">🔍 Search</option>
              <option value="coding">💻 Coding & Dev</option>
              <option value="browser">🌍 Browser</option>
              <option value="cloud">☁️ Cloud</option>
              <option value="devops">🔧 DevOps & CI/CD</option>
              <option value="ai">🤖 AI & ML</option>
              <option value="communication">💬 Communication</option>
              <option value="productivity">📋 Productivity</option>
              <option value="finance">💰 Finance</option>
              <option value="security">🔒 Security</option>
              <option value="analytics">📊 Analytics</option>
              <option value="media">🎬 Media</option>
              <option value="memory">🧠 Memory & Knowledge</option>
            </select>
          </div>

          {/* Install Type */}
          <div>
            <label htmlFor="install" className="block text-sm font-medium text-gray-300 mb-2">
              Install Type *
            </label>
            <select
              id="install"
              name="install"
              defaultValue={prefill.install ?? ""}
              required
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500 transition"
            >
              <option value="">Select install type</option>
              <option value="npm">npm / npx</option>
              <option value="pip">pip (Python)</option>
              <option value="binary">Binary</option>
              <option value="docker">Docker</option>
              <option value="source">Source</option>
              {/* 2026-09-25: added after Noveum's founder wrote in saying the
                  form offered only local install types, so he could not submit
                  a hosted server without picking an inaccurate one. The
                  MCPServer type has allowed 'remote' all along. */}
              <option value="remote">Hosted / remote endpoint (no local install)</option>
            </select>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
              Your Email *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              defaultValue={prefill.email}
              placeholder="you@example.com"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
            />
            <p className="mt-1 text-xs text-gray-500">We&apos;ll notify you when your server is listed.</p>
          </div>

          {/* Error */}
          {status === "error" && (
            <div className="px-4 py-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
              {errorMsg}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={status === "submitting"}
            className={`w-full px-6 py-3 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg transition ${
              tier === "featured"
                ? "bg-yellow-600 hover:bg-yellow-500"
                : tier === "pro"
                ? "bg-emerald-600 hover:bg-emerald-500"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {status === "submitting"
              ? "Processing…"
              : tier === "featured"
              ? "Continue to Checkout — $9"
              : tier === "pro"
              ? "Continue to Checkout — $49"
              : "Submit Server — Free"}
          </button>
        </form>
      </div>

      {/* Guidelines */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold text-white mb-4">Submission Guidelines</h2>
        <ul className="space-y-3 text-gray-400">
          <li className="flex items-start">
            <span className="text-green-400 mr-2">✓</span>
            Server must implement the Model Context Protocol
          </li>
          <li className="flex items-start">
            <span className="text-green-400 mr-2">✓</span>
            Public GitHub repository with documentation
          </li>
          <li className="flex items-start">
            <span className="text-green-400 mr-2">✓</span>
            Clear installation instructions
          </li>
          <li className="flex items-start">
            <span className="text-green-400 mr-2">✓</span>
            Working and actively maintained
          </li>
        </ul>
      </div>

      <div className="mt-8 text-center">
        <Link href="/" className="text-blue-400 hover:text-blue-300 transition">
          ← Back to directory
        </Link>
      </div>
    </div>
  );
}
