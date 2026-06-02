import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Submission Confirmed | MyMCPTools",
  robots: { index: false },
};

export default function SubmitSuccessPage({
  searchParams,
}: {
  searchParams: { featured?: string };
}) {
  const isFeatured = searchParams.featured === "1";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-gray-900 border border-green-800 rounded-xl p-8 text-center">
        <div className="text-5xl mb-4">{isFeatured ? "⭐" : "🎉"}</div>
        <h1 className="text-2xl font-bold text-white mb-3">
          {isFeatured ? "Featured Listing Confirmed!" : "Submission Received!"}
        </h1>
        <p className="text-gray-400 mb-6">
          {isFeatured
            ? "Payment confirmed. Your MCP server will be reviewed within 24 hours and listed with a Featured badge at the top of its category."
            : "Thanks for submitting your MCP server. We'll review it within 24-48 hours and notify you by email."}
        </p>
        {isFeatured && (
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-yellow-900/30 border border-yellow-700 rounded-lg text-yellow-300 text-sm">
            ⭐ Featured Badge · Priority Review · Top of Category
          </div>
        )}
        <div>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
          >
            Back to Directory
          </Link>
        </div>
      </div>
    </div>
  );
}
