import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Puppeteer ships a native Chromium binary that must not be bundled by webpack.
  serverExternalPackages: ["puppeteer", "puppeteer-core"],
};

export default nextConfig;
