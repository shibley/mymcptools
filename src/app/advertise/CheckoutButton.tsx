"use client";

import { useState } from "react";

export default function CheckoutButton({
  plan,
  highlight,
  label,
  initialServerName,
}: {
  plan: string;
  highlight: boolean;
  label: string;
  initialServerName?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [serverName, setServerName] = useState(initialServerName || "");
  const [serverUrl, setServerUrl] = useState("");
  const [email, setEmail] = useState("");

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/advertise/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, serverName, serverUrl, email }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Something went wrong. Please try again.");
        setLoading(false);
      }
    } catch {
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className={`block w-full text-center py-3 rounded-xl font-semibold transition cursor-pointer ${
          highlight
            ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25"
            : "bg-gray-800 hover:bg-gray-700 text-white"
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <form onSubmit={handleCheckout} className="space-y-3">
      <input
        type="text"
        required
        placeholder="MCP server name"
        value={serverName}
        onChange={(e) => setServerName(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />
      <input
        type="url"
        required
        placeholder="https://github.com/you/your-server"
        value={serverUrl}
        onChange={(e) => setServerUrl(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />
      <input
        type="email"
        required
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />
      <button
        type="submit"
        disabled={loading}
        className={`block w-full text-center py-3 rounded-xl font-semibold transition ${
          highlight
            ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25"
            : "bg-gray-800 hover:bg-gray-700 text-white"
        } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        {loading ? "Redirecting to Stripe..." : "Get Featured"}
      </button>
    </form>
  );
}
