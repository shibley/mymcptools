import Link from "next/link";

export default function AdvertiseSuccessPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-lg mx-auto px-4 text-center">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="text-3xl font-bold text-white mb-4">You&apos;re Featured!</h1>
        <p className="text-gray-400 mb-4 leading-relaxed">
          Thanks for your purchase. We&apos;ll set up your sponsored listing within 24 hours and
          send a confirmation to your email.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          Questions? Email{" "}
          <a href="mailto:shibley@mymcptools.com" className="text-blue-400 hover:text-blue-300">
            shibley@mymcptools.com
          </a>
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition"
        >
          Browse Directory →
        </Link>
      </div>
    </div>
  );
}
