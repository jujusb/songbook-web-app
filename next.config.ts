import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["puppeteer", "chordsheetjs"],
  allowedDevOrigins: ["oracle-vps-media.netbird.selfhosted"],
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
