import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["puppeteer", "chordsheetjs"],
  allowedDevOrigins: [
    "oracle-vps-media.netbird.selfhosted",
    // Comma-separated extra hosts from .env (SONGBOOK_DEV_ALLOWED_ORIGINS).
    ...(process.env.SONGBOOK_DEV_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean),
  ],
  outputFileTracingIncludes: {
    "/api/pdf": [
      "./node_modules/puppeteer/**/*",
      "./node_modules/puppeteer-core/**/*",
      "./node_modules/@puppeteer/**/*",
      "./node_modules/chromium-bidi/**/*",
      "./node_modules/devtools-protocol/**/*",
      "./node_modules/cosmiconfig/**/*",
      "./node_modules/ws/**/*",
      "./node_modules/typed-query-selector/**/*",
    ],
  },
};

export default nextConfig;
