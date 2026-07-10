"use client";

import { useState } from "react";

export default function TrustApiCheckoutButton() {
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [useCase, setUseCase] = useState("");

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/trust-api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, useCase }),
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
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 cursor-pointer"
      >
        Get instant API access — $49/mo
      </button>
    );
  }

  return (
    <form
      onSubmit={handleCheckout}
      className="mx-auto flex max-w-sm flex-col gap-3 text-left"
    >
      <input
        type="email"
        required
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
      />
      <input
        type="text"
        placeholder="What are you building? (optional)"
        value={useCase}
        onChange={(e) => setUseCase(e.target.value)}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={loading}
        className={`block w-full rounded-xl bg-blue-600 py-3 text-center font-semibold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 ${
          loading ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        }`}
      >
        {loading ? "Redirecting to Stripe..." : "Subscribe — $49/mo"}
      </button>
    </form>
  );
}
