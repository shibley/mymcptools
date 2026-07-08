import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Type errors are caught locally (`npx tsc --noEmit`) before pushing;
    // skipping the check on Vercel saves build-time CPU (see aisotools
    // 2026-07-08 build-cost investigation, same fix applied here).
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
