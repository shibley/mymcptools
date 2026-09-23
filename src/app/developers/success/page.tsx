import Link from "next/link";

export default function TrustApiSuccessPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-lg mx-auto px-4 text-center">
        <div className="text-6xl mb-6">🔑</div>
        <h1 className="text-3xl font-bold text-white mb-4">You&apos;re subscribed!</h1>
        <p className="text-gray-400 mb-4 leading-relaxed">
          Thanks for subscribing to the Trust Data API. Your key is emailed and
          activated automatically — <strong className="text-white">no wait, no
          activation step</strong>. The email confirms its exact status; if anything
          went wrong on our side it says so there.
        </p>
        <pre className="text-left text-xs text-gray-300 bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 overflow-x-auto">
          curl https://mymcptools.com/api/v1/drift \{"\n"}
          {"  "}-H &quot;Authorization: Bearer &lt;your key&gt;&quot;
        </pre>
        <p className="text-gray-500 text-sm mb-8">
          Questions? Email{" "}
          <a href="mailto:shibley@mymcptools.com" className="text-blue-400 hover:text-blue-300">
            shibley@mymcptools.com
          </a>
        </p>
        <Link
          href="/developers"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition"
        >
          Back to API docs →
        </Link>
      </div>
    </div>
  );
}
